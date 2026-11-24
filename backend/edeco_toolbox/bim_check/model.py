"""Formatneutrales Datenmodell für den lokalen BIM-Check."""

from dataclasses import dataclass, field
from typing import Any


@dataclass
class Element:
    """Storey ist der lesbare Geschossname. Raumbezüge verweisen auf Element-IDs.

    Polygone enthalten Ringe (Aussenring zuerst, dann Löcher) mit XY-Punkten
    in Metern im gemeinsamen Modellkoordinatensystem.
    """

    id: str
    ifc_class: str
    name: str
    number: str = ""
    storey: str = ""
    room_ids: list[str] = field(default_factory=list)
    attributes: dict[str, Any] = field(default_factory=dict)
    psets: dict[str, dict[str, Any]] = field(default_factory=dict)
    area_m2: float | None = None
    volume_m3: float | None = None
    polygons: list[list[list[tuple[float, float]]]] = field(default_factory=list)
    classes: list[str] = field(default_factory=list)


@dataclass
class BuildingModel:
    elements: list[Element]
    source: str
    warnings: list[str] = field(default_factory=list)
    declared_attributes: list[str] = field(default_factory=list)
