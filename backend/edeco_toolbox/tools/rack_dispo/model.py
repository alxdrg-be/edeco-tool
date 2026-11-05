"""Versioned rack interchange model, shared with ui/src/tools/rack-dispo/types.ts.

Only structural validation happens here. A collision is a planning result and
must remain exportable; it is never silently moved or presented as approved.
"""

from __future__ import annotations

import math
import re
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

HE_MM = 44.45
PANEL_WIDTH_MM = 482.6
Text = Annotated[str, Field(max_length=2000)]
Id = Annotated[str, Field(min_length=1, max_length=120)]
Dimension = Annotated[float, Field(ge=0, le=100000)]
PositiveDimension = Annotated[float, Field(ge=.001, le=100000)]
Weight = Annotated[float, Field(ge=0, le=1000000)]
Power = Annotated[float, Field(ge=0, le=10000000)]
Side = Literal["front", "rear", "zero-left", "zero-right", "zero-rear"]
WorkState = Literal["open", "ordered", "delivered", "done", "not-required"]
INVALID_TEXT = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\ud800-\udfff\ufffe\uffff]")


def _metadata_size(value: Any, depth: int = 0) -> int:
    if depth > 10:
        raise ValueError("Metadaten sind zu tief verschachtelt.")
    if value is None or isinstance(value, bool):
        return 1
    if isinstance(value, (int, float)):
        if not math.isfinite(value):
            raise ValueError("Metadaten müssen endliche Zahlen enthalten.")
        return 1
    if isinstance(value, str):
        if len(value) > 10000 or INVALID_TEXT.search(value):
            raise ValueError("Metadaten-Text ist zu lang.")
        return 1
    if isinstance(value, list):
        if len(value) > 1000:
            raise ValueError("Zu viele Metadaten-Einträge.")
        count = 1 + sum(_metadata_size(item, depth + 1) for item in value)
    elif isinstance(value, dict):
        if len(value) > 1000 or any(not isinstance(key, str) or len(key) > 120 or key in ("__proto__", "constructor", "prototype") for key in value):
            raise ValueError("Ungültiger Metadaten-Schlüssel.")
        count = 1 + sum(_metadata_size(item, depth + 1) for item in value.values())
    else:
        raise ValueError("Metadaten müssen JSON-Werte sein.")
    if count > 100000:
        raise ValueError("Zu viele Metadaten.")
    return count


class Record(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False)
    metadata: dict[str, Any] | None = None

    @field_validator("*", mode="after")
    @classmethod
    def valid_text(cls, value):
        if isinstance(value, str) and INVALID_TEXT.search(value):
            raise ValueError("Text enthält ungültige Steuerzeichen oder Unicode-Zeichen.")
        return value

    @model_validator(mode="after")
    def validate_metadata(self):
        if self.metadata is not None:
            _metadata_size(self.metadata)
        return self


class Rack(Record):
    id: Id
    label: Text
    units: Annotated[int, Field(ge=1, le=60)]
    widthMm: PositiveDimension
    heightMm: PositiveDimension
    depthMm: PositiveDimension
    usableDepthMm: Dimension | None
    frontDoorClearanceMm: Dimension | None
    rearDoorClearanceMm: Dimension | None
    weightLimitKg: Weight | None
    powerBudgetW: Power | None
    room: Text
    notes: Text


class DeviceProfile(Record):
    id: Id
    name: Text
    kind: Literal["patch", "switch", "fiber", "manager", "shelf", "blank", "ups", "pdu", "earth", "reserve", "custom"]
    units: Annotated[int, Field(ge=0, le=60)]
    depthMm: Dimension | None
    inwardCableMm: Dimension | None
    outwardCableMm: Dimension | None
    weightKg: Weight | None
    powerW: Power | None
    loadLimitKg: Weight | None
    portCount: Annotated[int, Field(ge=0, le=288)]
    medium: Literal["RJ45", "LWL", "none"]
    manufacturer: Text
    article: Text
    source: Text
    verified: bool


class Placement(Record):
    id: Id
    rackId: Id
    profileId: Id
    label: Text
    startUnit: Annotated[int, Field(ge=1, le=60)]
    side: Side
    status: Literal["planned", "existing", "removed"]
    delivery: WorkState
    montage: WorkState
    notes: Text
    supportedById: Id | None
    zeroStartMm: Dimension | None
    zeroHeightMm: Dimension | None
    zeroInwardOffsetMm: Dimension | None


class PortRow(Record):
    placementId: Id
    number: Annotated[int, Field(ge=1, le=288)]
    label: Text
    target: Text
    outlet: Text
    room: Text
    state: Literal["unknown", "not-built", "built", "occupied"]


class RackDocument(Record):
    version: Literal[1]
    name: Text
    projectId: Id | None = None
    projectNumber: Annotated[str, Field(max_length=120)] | None = None
    room: Text
    author: Text
    index: Text
    date: Text
    racks: Annotated[list[Rack], Field(min_length=1, max_length=50)]
    profiles: Annotated[list[DeviceProfile], Field(max_length=300)]
    placements: Annotated[list[Placement], Field(max_length=2000)]
    ports: Annotated[list[PortRow], Field(max_length=24000)]

    @field_validator("version", mode="before")
    @classmethod
    def exact_version(cls, value):
        if type(value) is not int or value != 1:
            raise ValueError("Erwartet wird Rack-Dateiversion 1.")
        return value

    @model_validator(mode="after")
    def references(self):
        all_ids = [record.id for record in [*self.racks, *self.profiles, *self.placements]]
        if any(not item.strip() for item in all_ids) or len(set(all_ids)) != len(all_ids):
            raise ValueError("Leere oder doppelte Objekt-Kennung.")
        count = sum(_metadata_size(record.metadata) for record in [self, *self.racks, *self.profiles, *self.placements, *self.ports] if record.metadata is not None)
        if count > 100000:
            raise ValueError("Zu viele Metadaten im Rack-Dokument.")
        def keyed(records, name):
            result = {record.id: record for record in records}
            if len(result) != len(records):
                raise ValueError(f"Doppelte {name}-Kennung.")
            return result

        racks = keyed(self.racks, "Rack")
        profiles = keyed(self.profiles, "Profil")
        placements = keyed(self.placements, "Platzierungs")
        for placement in self.placements:
            if placement.rackId not in racks or placement.profileId not in profiles:
                raise ValueError("Platzierung verweist auf ein unbekanntes Rack oder Profil.")
            if placement.supportedById is not None:
                support = placements.get(placement.supportedById)
                if support is None or support.id == placement.id or support.rackId != placement.rackId or profiles[support.profileId].kind != "shelf":
                    raise ValueError("Ungültiger Fachboden-Verweis.")
        seen = set()
        for port in self.ports:
            placement = placements.get(port.placementId)
            key = (port.placementId, port.number)
            if placement is None or port.number > profiles[placement.profileId].portCount:
                raise ValueError("Port verweist auf eine unbekannte Platzierung oder Portnummer.")
            if key in seen:
                raise ValueError("Doppelte Portnummer pro Platzierung.")
            seen.add(key)
        return self


class Sheet(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    rackId: Id
    view: Literal["front", "rear"]
    svg: Annotated[str, Field(min_length=20, max_length=4 * 1024 * 1024)]


class ExportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False)
    document: RackDocument
    rack_ids: Annotated[list[Id], Field(min_length=1, max_length=50)] | None = None
    views: Annotated[list[Literal["front", "rear"]], Field(min_length=1, max_length=2)] = ["front", "rear"]
    format: Literal["pdf", "svg", "dxf", "ports-csv", "bom-csv"]
    # A4 sheets drawn by the program itself (one per rack and view). PDF and SVG
    # are made from exactly this markup so preview and export cannot differ.
    sheets: Annotated[list[Sheet], Field(max_length=100)] | None = None

    @model_validator(mode="after")
    def selection(self):
        if len(set(self.views)) != len(self.views):
            raise ValueError("Eine Ansicht darf nur einmal gewählt werden.")
        if self.rack_ids is not None:
            if len(set(self.rack_ids)) != len(self.rack_ids) or not set(self.rack_ids) <= {rack.id for rack in self.document.racks}:
                raise ValueError("Ungültige Rackauswahl.")
        if self.sheets is not None:
            selected = {rack.id for rack in self.selected_racks()}
            if any(sheet.rackId not in selected or sheet.view not in self.views for sheet in self.sheets):
                raise ValueError("Planblatt passt nicht zur Rack- oder Ansichtsauswahl.")
        racks = {rack.id for rack in self.selected_racks()}
        profiles = {profile.id: profile for profile in self.document.profiles}
        capacity = sum(profiles[placement.profileId].portCount for placement in self.document.placements if placement.rackId in racks and placement.status != "removed" and (placement.side in self.views or placement.side.startswith("zero-")))
        if capacity > 24000:
            raise ValueError("Exportauswahl enthält mehr als 24'000 Ports. Bitte weniger Racks gleichzeitig exportieren.")
        return self

    def selected_racks(self):
        selected = set(self.rack_ids) if self.rack_ids is not None else None
        return [rack for rack in self.document.racks if selected is None or rack.id in selected]
