"""Lokaler IFC-STEP-Import. Modellwerte und 2D-Projektionen bleiben getrennt."""

from collections import Counter, defaultdict
import math
from pathlib import Path

import ifcopenshell
from ifcopenshell.util import element as ifc_element, unit as ifc_unit

from .geometry import geometry_settings, room_polygons
from .model import BuildingModel, Element

MAX_FILE_BYTES = 256 * 1024 * 1024
MAX_PRODUCTS = 100_000
_READ_ERRORS = (AttributeError, TypeError, RuntimeError, ValueError, IndexError, KeyError, ifcopenshell.Error)
_SI_UNITS = {"LENGTHUNIT": ("METRE", 1), "AREAUNIT": ("SQUARE_METRE", 2), "VOLUMEUNIT": ("CUBIC_METRE", 3)}
# Net floor area and net volume take precedence over gross quantities.
_MEASURES = {
    "AREAUNIT": ("netfloorarea", "netarea", "nettofläche", "nettoflaeche", "grossfloorarea", "grossarea", "floorarea", "raumfläche", "raumflaeche", "area", "fläche", "flaeche"),
    "VOLUMEUNIT": ("netvolume", "nettovolumen", "grossvolume", "raumvolumen", "volume", "volumen"),
}


def _value(value):
    """Scalar IFC values stay typed; entity references stay finite and identifiable."""
    if isinstance(value, ifcopenshell.entity_instance):
        if not value.id():
            return _value(value.wrappedValue)
        return f"#{value.id()} {value.is_a()}"
    if isinstance(value, (tuple, list)):
        return [_value(v) for v in value]
    if isinstance(value, dict):
        return {k: _value(v) for k, v in value.items()}
    if isinstance(value, float) and not math.isfinite(value):
        return None
    return value


def _member_value(member, depth=0):
    if member.is_a("IfcPhysicalSimpleQuantity"):
        return _value(member[3])
    if member.is_a("IfcPropertySingleValue"):
        return _value(member.NominalValue)
    if member.is_a("IfcPropertyEnumeratedValue"):
        return _value(member.EnumerationValues)
    if member.is_a("IfcPropertyListValue"):
        return _value(member.ListValues)
    if member.is_a("IfcPropertyReferenceValue"):
        return _value(member.PropertyReference)
    nested = getattr(member, "HasProperties", ()) or getattr(member, "HasQuantities", ())
    if nested and depth < 12:
        return {child.Name: _member_value(child, depth + 1) for child in nested if child.Name}
    # Bounded/table values have several fields. Keep the actual data and units.
    return {k: _value(v) for k, v in member.get_info().items()
            if k not in {"type", "id", "Name", "Description"} and v is not None}


def _si_factor(unit, unit_type, seen=frozenset()):
    if not unit or unit.id() in seen or getattr(unit, "UnitType", None) != unit_type:
        return None
    if unit.is_a("IfcSIUnit"):
        name, exponent = _SI_UNITS[unit_type]
        if unit.Name == name:
            return ifc_unit.get_prefix_multiplier(unit.Prefix) ** exponent
        return None
    if unit.is_a("IfcConversionBasedUnit") and unit.ConversionFactor:
        conversion = unit.ConversionFactor
        factor = _si_factor(conversion.UnitComponent, unit_type, seen | {unit.id()})
        if factor is not None and conversion.ValueComponent:
            value = factor * float(conversion.ValueComponent.wrappedValue)
            if value > 0 and math.isfinite(value):
                return value
    return None


def _measure(name, member, value, project_units):
    if not isinstance(value, (float, int)) or isinstance(value, bool) or value < 0:
        return None
    token = "".join(c for c in name.casefold() if c.isalnum())
    for unit_type, names in _MEASURES.items():
        if token not in names:
            continue
        explicit_unit = getattr(member, "Unit", None)
        measure_type = "Area" if unit_type == "AREAUNIT" else "Volume"
        if member.is_a("IfcPhysicalSimpleQuantity") and not member.is_a(f"IfcQuantity{measure_type}"):
            continue
        if member.is_a("IfcPropertySingleValue"):
            nominal = member.NominalValue
            if not explicit_unit and not nominal.is_a(f"Ifc{measure_type}Measure"):
                continue
        unit = explicit_unit or project_units.get(unit_type)
        factor = _si_factor(unit, unit_type)
        if factor is not None and math.isfinite(value * factor):
            return unit_type, names.index(token), value * factor
    return None


def _definitions(product):
    product_type = ifc_element.get_type(product)
    if product_type:
        yield from (product_type.HasPropertySets or ())
    for rel in getattr(product, "IsDefinedBy", ()):
        if rel.is_a("IfcRelDefinesByProperties"):
            definition = rel.RelatingPropertyDefinition
            if isinstance(definition, tuple):
                yield from definition
            elif definition and definition.is_a("IfcPropertySetDefinitionSet"):
                yield from definition.wrappedValue
            elif definition:
                yield definition


def _property_sets(product, project_units, is_room, counts):
    psets = {}
    measures = {}
    for definition in _definitions(product):
        set_name = getattr(definition, "Name", None)
        if not set_name:
            counts["pset"] += 1
            continue
        props = psets.setdefault(set_name, {})
        if definition.is_a("IfcPropertySet"):
            members = definition.HasProperties
        elif definition.is_a("IfcElementQuantity"):
            members = definition.Quantities
        else:
            # Predefined sets in older IFC schemas store their properties as attributes.
            props.update({definition.attribute_name(i): _value(definition[i]) for i in range(4, len(definition))})
            continue
        for member in members or ():
            if not member or not member.Name:
                counts["pset"] += 1
                continue
            name = member.Name
            key = (set_name, name)
            try:
                props[name] = _member_value(member)
                if is_room:
                    # An explicit occurrence value (also null) overrides its type.
                    measures.pop(key, None)
                    match = _measure(name, member, props[name], project_units)
                    if match:
                        measures[key] = match
            except _READ_ERRORS:
                counts["pset"] += 1
    def best(unit_type):
        matches = [item for item in measures.values() if item[0] == unit_type]
        return min(matches, key=lambda item: item[1])[2] if matches else None
    return psets, best("AREAUNIT"), best("VOLUMEUNIT")


def _class_chain(product):
    declaration = product.wrapped_data.declaration().as_entity()
    classes = []
    while declaration:
        classes.append(declaration.name())
        declaration = declaration.supertype()
    return classes


class SpatialIndex:
    """Explicit spatial/aggregation relations, including multiple room boundaries."""

    def __init__(self, model, products):
        self.parents = defaultdict(set)
        self.related_spaces = defaultdict(set)
        self.storeys = {}
        self.spaces = {p.id() for p in products if p.is_a("IfcSpace")}
        relations = [
            ("IfcRelAggregates", "RelatingObject", "RelatedObjects"),
            ("IfcRelContainedInSpatialStructure", "RelatingStructure", "RelatedElements"),
            ("IfcRelNests", "RelatingObject", "RelatedObjects"),
        ]
        for kind, parent_key, children_key in relations:
            for rel in model.by_type(kind):
                parent = getattr(rel, parent_key)
                if parent:
                    for child in getattr(rel, children_key) or ():
                        if child:
                            self.parents[child.id()].add(parent.id())
        for rel in model.by_type("IfcRelReferencedInSpatialStructure"):
            if rel.RelatingStructure and rel.RelatingStructure.id() in self.spaces:
                for child in rel.RelatedElements or ():
                    if child:
                        self.related_spaces[child.id()].add(rel.RelatingStructure.id())
        for rel in model.by_type("IfcRelSpaceBoundary"):
            if rel.RelatingSpace and rel.RelatingSpace.id() in self.spaces and rel.RelatedBuildingElement:
                self.related_spaces[rel.RelatedBuildingElement.id()].add(rel.RelatingSpace.id())
        storeys = [p for p in products if p.is_a("IfcBuildingStorey")]
        names = Counter(p.Name or p.LongName for p in storeys)
        for floor in storeys:
            label = floor.Name or floor.LongName or f"Geschoss #{floor.id()}"
            if names[label] > 1:
                label = f"{label} (#{floor.id()})"
            self.storeys[floor.id()] = label

    def resolve(self, step):
        found_rooms = set(self.related_spaces.get(step, ()))
        storeys = set()
        seen = set()
        pending = [step]
        while pending:
            item = pending.pop()
            if item in seen:
                continue
            seen.add(item)
            if item in self.storeys:
                storeys.add(self.storeys[item])
                continue
            if item in self.spaces and item != step:
                found_rooms.add(item)
            found_rooms.update(self.related_spaces.get(item, ()))
            pending.extend(self.parents.get(item, ()))
        if not storeys and found_rooms:
            # A referenced/bounding element may lack direct containment.
            pending = list(found_rooms)
            while pending:
                item = pending.pop()
                if item in seen:
                    continue
                seen.add(item)
                if item in self.storeys:
                    storeys.add(self.storeys[item])
                else:
                    pending.extend(self.parents.get(item, ()))
        return next(iter(storeys)) if len(storeys) == 1 else "", found_rooms


def read_ifc_products(path: Path):
    """Gemeinsame Eingabe und Modellgrenzen für Raumprüfung und 3D-Szene."""
    path = Path(path)
    try:
        size = path.stat().st_size
    except OSError as exc:
        raise ValueError("Die lokale IFC-Datei konnte nicht geöffnet werden.") from exc
    if size > MAX_FILE_BYTES:
        raise ValueError("Die IFC-Datei ist grösser als 256 MiB. Bitte geschossweise exportieren.")
    try:
        with path.open("rb") as stream:
            if b"ISO-10303-21;" not in stream.read(2048).upper():
                raise ValueError("Die Datei enthält keinen IFC-STEP-Kopf.")
            stream.seek(max(size - 65_536, 0))
            has_end_marker = b"END-ISO-10303-21;" in stream.read().upper()
        model = ifcopenshell.open(path, format=".ifc")
        products = model.by_type("IfcProduct")
    except (OSError, *_READ_ERRORS) as exc:
        raise ValueError("Die IFC-Datei konnte nicht als STEP-Modell gelesen werden. Bitte den IFC-Export prüfen.") from exc
    if not products:
        raise ValueError("Das IFC-Modell enthält keine lesbaren Räume oder Modellobjekte (IfcProduct).")
    if len(products) > MAX_PRODUCTS:
        raise ValueError(f"Das Modell enthält mehr als {MAX_PRODUCTS} Objekte. Bitte einen Teilmodell-Export verwenden.")

    return model, products, has_end_marker


def product_ids(products):
    guids = Counter(p.GlobalId for p in products)
    ids = {p.id(): p.GlobalId if p.GlobalId and guids[p.GlobalId] == 1 else f"#{p.id()}" for p in products}
    ambiguous = sum(1 for p in products if not p.GlobalId or guids[p.GlobalId] > 1)
    return ids, ambiguous


def model_units(model):
    projects = model.by_type("IfcProject")
    units = projects[0].UnitsInContext if projects else None
    return {u.UnitType: u for u in (units.Units or ()) if hasattr(u, "UnitType")} if units else {}


def length_factor(project_units):
    # IfcOpenShell assumes metres when a length unit is missing. For example,
    # millimetre coordinates would then be presented at a 1000-fold scale.
    try:
        return _si_factor(project_units.get("LENGTHUNIT"), "LENGTHUNIT")
    except _READ_ERRORS:
        return None


def parse_ifc(path: Path, *, source: str | None = None) -> BuildingModel:
    path = Path(path)
    model, products, has_end_marker = read_ifc_products(path)
    counts = Counter()
    ids, counts["id"] = product_ids(products)
    spatial = SpatialIndex(model, products)
    project_units = model_units(model)
    scale = length_factor(project_units)
    settings = geometry_settings() if scale is not None else None
    elements = []
    class_cache = {}
    for product in products:
        step = product.id()
        kind = product.is_a()
        room = step in spatial.spaces
        if kind not in class_cache:
            class_cache[kind] = _class_chain(product)
        storey, rooms = spatial.resolve(step)
        attrs = {}
        for i in range(len(product)):
            try:
                attrs[product.attribute_name(i)] = _value(product[i])
            except _READ_ERRORS:
                counts["attrs"] += 1
        try:
            psets, area, volume = _property_sets(product, project_units, room, counts)
        except _READ_ERRORS:
            psets, area, volume = {}, None, None
            counts["pset"] += 1
        polygons = []
        if room:
            try:
                polygons = room_polygons(product, settings) if settings is not None else []
            except _READ_ERRORS:
                # The remaining rooms and the attributes still have independent value.
                pass
            counts["outline"] += int(not polygons)
            counts["no_storey"] += int(not storey)
        label = attrs.get("Name") or ""
        elements.append(Element(
            id=ids[step], ifc_class=kind, name=(attrs.get("LongName") or label) if room else label,
            number=label if room else attrs.get("Tag") or "", storey=storey,
            room_ids=[ids[n] for n in sorted(rooms) if n != step], attributes=attrs, psets=psets,
            area_m2=area, volume_m3=volume, polygons=polygons, classes=class_cache[kind],
        ))
    messages = {
        "id": "Objekte ohne eindeutige GlobalId (STEP-ID als Ersatz)",
        "attrs": "Nicht lesbare Attribute",
        "pset": "Unvollständig gelesene Eigenschaftseinträge",
        "no_storey": "Räume ohne eindeutige Geschosszuordnung",
        "outline": "Räume ohne darstellbare Kontur (über die Raumliste einsehbar)",
    }
    warnings = [f"{message}: {counts[key]}." for key, message in messages.items() if counts[key]]
    if spatial.spaces and scale is None:
        warnings.append("Die Modell-Längeneinheit fehlt oder ist ungültig. Die massstäbliche Grundrissdarstellung ist daher nicht möglich.")
    if not has_end_marker:
        warnings.append("Das STEP-Ende fehlt. Die Datei könnte unvollständig sein. Bitte mit dem ursprünglichen Export vergleichen.")
    if not spatial.spaces:
        warnings.append("Das Modell enthält keine IfcSpace-Räume. Die Elemente sind im Inspektor verfügbar.")
    return BuildingModel(elements, source or path.name, warnings)
