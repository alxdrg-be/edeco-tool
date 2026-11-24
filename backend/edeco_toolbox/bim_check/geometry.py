"""IFC-Raumumrisse als Projektion der tatsächlichen Geometrie in Modellkoordinaten."""

import ifcopenshell.geom
import numpy as np
import shapely
from ifcopenshell import ifcopenshell_wrapper as wrapper
from ifcopenshell.util.shape import get_edges, get_faces, get_vertices

# Komplexe Einzelgeometrien dürfen die Auswertung der Eigenschaften nicht blockieren.
MAX_FACES = 100_000


def geometry_settings():
    settings = ifcopenshell.geom.settings()
    settings.set("use-world-coords", True)
    settings.set("dimensionality", wrapper.CURVES_SURFACES_AND_SOLIDS)
    return settings


def _outline(mesh, footprint):
    vertices = get_vertices(mesh)[:, :2]
    if not len(vertices) or not np.isfinite(vertices).all():
        return None
    faces = get_faces(mesh)
    if len(faces) > MAX_FACES:
        raise ValueError("zu viele Dreiecke")
    if len(faces):
        triangles = shapely.polygons(vertices[faces])
        surfaces = triangles[shapely.area(triangles) > 0]
        if len(surfaces):
            return shapely.union_all(surfaces)

    # Ein 2D-FootPrint darf aus geschlossenen Kurven statt Flächen bestehen.
    # Linien mit Beschriftungen oder Achsen sind keine Raumumrisse.
    if footprint:
        edges = get_edges(mesh)
        if len(edges) > MAX_FACES:
            raise ValueError("zu viele Kanten")
        if len(edges):
            return shapely.build_area(shapely.multilinestrings(vertices[edges]))
    return None


def room_polygons(space, settings):
    representation = space.Representation
    if not representation:
        return []
    representations = representation.Representations or ()
    footprints = [r for r in representations if (r.RepresentationIdentifier or "").lower() == "footprint"]
    bodies = [r for r in representations if (r.RepresentationIdentifier or "").lower() in {"body", "facetation", ""}]
    for rep in footprints + bodies:
        try:
            # Die native Geometrie gehört dem Shape. Die Referenz während des Auslesens halten.
            shape = ifcopenshell.geom.create_shape(settings, space, rep)
            outline = _outline(shape.geometry, rep in footprints)
        except (RuntimeError, ValueError, IndexError, TypeError, shapely.errors.GEOSException):
            continue
        if outline is None or outline.is_empty:
            continue
        result = []
        for polygon in shapely.get_parts(outline):
            if polygon.geom_type == "Polygon" and not polygon.is_empty:
                result.append([list(ring.coords) for ring in (polygon.exterior, *polygon.interiors)])
        if result:
            return result
    return []
