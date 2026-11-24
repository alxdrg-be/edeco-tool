"""Vermaschte IFC-Körper in Modellkoordinaten für den lokalen 3D-Viewer."""

from collections import Counter
import json
from pathlib import Path
from time import monotonic

import ifcopenshell
import ifcopenshell.geom
import numpy as np
from ifcopenshell.util.shape import get_faces, get_vertices

from .ifc import SpatialIndex, length_factor, model_units, product_ids, read_ifc_products

# Renderbare Teilansicht: Ganze Objekte übernehmen, Räume zuerst. Einzelne
# Gebäude mit komplexer Möblierung dürfen den Kontext nicht verdrängen.
STRUCTURAL_CLASSES = ("IfcWall", "IfcSlab", "IfcColumn", "IfcBeam", "IfcRoof", "IfcCurtainWall",
                      "IfcStair", "IfcStairFlight", "IfcRamp", "IfcRampFlight", "IfcFooting")
MAX_MESHES = 6_000
MAX_ATTEMPTS = 16_000
MAX_FACES_PER_MESH = 100_000
MAX_TRIANGLES = 300_000
MAX_SCENE_BYTES = 32 * 1024 * 1024
MAX_GEOMETRY_SECONDS = 100
_GEOMETRY_ERRORS = (RuntimeError, ValueError, TypeError, AttributeError, IndexError, ifcopenshell.Error)


def _representations(product):
    shape = product.Representation
    if not shape:
        return []
    bodies, fallback = [], []
    for rep in shape.Representations or ():
        name = (rep.RepresentationIdentifier or "").casefold()
        if not rep.is_a("IfcShapeRepresentation") or (rep.RepresentationType or "").casefold() == "boundingbox":
            continue
        context = rep.ContextOfItems
        if context is None or context.CoordinateSpaceDimension != 3:
            continue
        if name in {"body", "facetation"}:
            bodies.append(rep)
        elif name in {"", "body-fallback"}:
            fallback.append(rep)
    return bodies + fallback


def _spans_three_dimensions(vertices):
    # Ein geneigtes einzelnes Polygon spannt in X, Y und Z auf, ist aber
    # weiterhin nur ein Grundriss. Prüfe die Dicke senkrecht zur eigenen Ebene.
    offsets = vertices - vertices[0]
    first = offsets[np.argmax(np.einsum("ij,ij->i", offsets, offsets))]
    normals = np.cross(offsets, first)
    normal = normals[np.argmax(np.einsum("ij,ij->i", normals, normals))]
    size = np.linalg.norm(normal)
    return size > 0 and np.max(np.abs(offsets @ (normal / size))) > 1e-6


def _mesh(product, representations, settings, room, remaining_faces):
    too_large = False
    for rep in representations:
        try:
            # Das Shape hält den Speicher der nativen Triangulierung am Leben.
            shape = ifcopenshell.geom.create_shape(settings, product, rep)
            faces = get_faces(shape.geometry)
            if not len(faces):
                continue
            if len(faces) > min(MAX_FACES_PER_MESH, remaining_faces):
                too_large = True
                continue
            vertices = get_vertices(shape.geometry)
            if faces.min() < 0 or faces.max() >= len(vertices):
                continue
            used, indices = np.unique(faces.ravel(), return_inverse=True)
            vertices = vertices[used]
            if not np.isfinite(vertices).all() or (room and not _spans_three_dimensions(vertices)):
                continue
            return {"positions": vertices.round(6).ravel().tolist(), "indices": indices.ravel().tolist()}, too_large
        except _GEOMETRY_ERRORS:
            continue
    return None, too_large


def write_scene(ifc_path: Path, destination: Path) -> None:
    """Schreibt eine abgeschlossene JSON-Szene. Der Aufrufer veröffentlicht sie atomar."""
    model, products, complete = read_ifc_products(ifc_path)
    ids, _ = product_ids(products)
    spatial = SpatialIndex(model, products)
    rooms = [product for product in products if product.id() in spatial.spaces]
    # Wände und Geschossdecken haben auch in grossen Modellen zuerst Platz.
    context = [product for name in STRUCTURAL_CLASSES for product in model.by_type(name)]
    warnings = []
    if not complete:
        warnings.append("Das STEP-Ende fehlt. Die Gebäudeansicht kann unvollständig sein.")
    settings = None
    if length_factor(model_units(model)) is None:
        warnings.append("Die Modell-Längeneinheit fehlt oder ist ungültig. Eine massstäbliche 3D-Ansicht ist nicht möglich.")
    else:
        settings = ifcopenshell.geom.settings()
        settings.set("use-world-coords", True)
    counts = Counter()
    stop = monotonic() + MAX_GEOMETRY_SECONDS
    with Path(destination).open("wb") as output:
        output.write(b'{"meshes":[')
        for kind, group in (("room", rooms), ("structure", context)):
            if settings is None:
                break
            for index, product in enumerate(group):
                if (counts["meshes"] >= MAX_MESHES or counts["attempts"] >= MAX_ATTEMPTS
                        or counts["faces"] >= MAX_TRIANGLES or monotonic() > stop):
                    counts["limit"] += len(group) - index
                    break
                try:
                    representations = _representations(product)
                except _GEOMETRY_ERRORS:
                    representations = []
                if not representations:
                    counts[kind] += 1
                    continue
                counts["attempts"] += 1
                mesh, too_large = _mesh(product, representations, settings, kind == "room", MAX_TRIANGLES - counts["faces"])
                if mesh is None:
                    counts["limit" if too_large else kind] += 1
                    continue
                storey, _room_ids = spatial.resolve(product.id())
                part = {"id": ids[product.id()], "kind": kind, "storey": storey, **mesh}
                payload = json.dumps(part, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode("utf-8")
                # Reserve for closing JSON and aggregate warning messages.
                if output.tell() + len(payload) + 4096 >= MAX_SCENE_BYTES:
                    counts["limit"] += 1
                    continue
                if counts["meshes"]:
                    output.write(b",")
                output.write(payload)
                counts["meshes"] += 1
                counts["faces"] += len(mesh["indices"]) // 3
        if counts["room"]:
            warnings.append(f"Räume ohne darstellbaren 3D-Körper: {counts['room']}. Sie bleiben in der Raumliste verfügbar.")
        if counts["structure"]:
            warnings.append(f"Bauteile der Gebäudestruktur ohne darstellbare Körpergeometrie: {counts['structure']}.")
        if counts["limit"]:
            warnings.append(f"Darstellungsgrenze erreicht. Ausgelassene Objekte: {counts['limit']}. "
                            "Für weitere Details ein kleineres Teilmodell öffnen.")
        if not rooms:
            warnings.append("Das Modell enthält keine IfcSpace-Räume.")
        if not context and rooms:
            warnings.append("Das Modell enthält keine Bauteile der unterstützten Gebäudestruktur.")
        output.write(b'],"warnings":' + json.dumps(warnings, ensure_ascii=False).encode("utf-8") + b',"schema_version":1}')
