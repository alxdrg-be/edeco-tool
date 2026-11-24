"""Bounded document contract shared with the Verteiler-Dispo frontend.

Only structural validity is enforced here. A mechanically impossible placement
must remain loadable and exportable as a planning conflict instead of disappearing.
"""

from __future__ import annotations

import re
from typing import Annotated, Literal
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field as PField, field_validator, model_validator

Text = Annotated[str, PField(max_length=2000)]
Id = Annotated[str, PField(min_length=1, max_length=120)]
Coord = Annotated[float, PField(ge=-100000, le=100000)]
Dimension = Annotated[float, PField(ge=.01, le=100000)]
Nonnegative = Annotated[float, PField(ge=0, le=10000000)]
Color = Annotated[str, PField(pattern=r"^#[0-9a-fA-F]{6}$")]
INVALID_TEXT = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\ud800-\udfff\ufffe\uffff]")
DeviceKind = Literal['switch', 'rcd', 'mcb', 'knx', 'terminal', 'busbar', 'custom', 'reserve']


class Record(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True, allow_inf_nan=False)

    @field_validator('*', mode='after')
    @classmethod
    def valid_text(cls, value):
        if isinstance(value, str) and INVALID_TEXT.search(value):
            raise ValueError('Text enthält ungültige Steuerzeichen oder Unicode-Zeichen.')
        return value


class SourceRef(Record):
    id: Id
    issuer: Text
    title: Text
    url: Annotated[str, PField(max_length=2500)]
    edition: Text
    checked_on: Annotated[str, PField(max_length=80)]
    sha256: Annotated[str, PField(max_length=64)]
    pages: Text
    notes: Text

    @field_validator('url')
    @classmethod
    def safe_url(cls, value):
        if value:
            parsed = urlsplit(value)
            if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or parsed.password:
                raise ValueError('Quellenlinks benötigen eine normale HTTP-/HTTPS-Adresse.')
        return value

    @field_validator('sha256')
    @classmethod
    def valid_hash(cls, value):
        if value and not re.fullmatch(r'[0-9a-fA-F]{64}', value):
            raise ValueError('Die Quellenprüfsumme muss SHA-256 entsprechen.')
        return value


class Rect(Record):
    x_mm: Coord
    y_mm: Coord
    width_mm: Dimension
    height_mm: Dimension


class Field(Rect):
    id: Id
    name: Text
    role: Literal['equipment', 'meter', 'connection', 'control', 'spare']
    sealed: bool


class Rail(Record):
    id: Id
    field_id: Id
    name: Text
    x_mm: Coord
    y_mm: Coord
    z_mm: Coord
    length_mm: Dimension
    te_pitch_mm: Annotated[float, PField(ge=.1, le=1000)]


class ReservedZone(Rect):
    id: Id
    name: Text
    source_id: Id | None


class DeviceProfile(Record):
    id: Id
    name: Text
    kind: DeviceKind
    manufacturer: Text
    article: Text
    width_mm: Dimension
    height_mm: Dimension
    depth_mm: Nonnegative | None
    te: Annotated[float, PField(gt=0, le=1000)] | None
    mounting: Literal['din', 'plate', 'free']
    power_loss_w: Nonnegative | None
    rated_current_a: Nonnegative | None
    clearance_mm: Nonnegative
    source_ids: Annotated[list[Id], PField(max_length=30)]
    geometry_status: Literal['generic', 'documented']
    terminal_kind: Text
    busbar_section_width_mm: Dimension | None
    busbar_section_thickness_mm: Dimension | None


class Placement(Record):
    id: Id
    profile_id: Id
    rail_id: Id | None
    field_id: Id | None
    label: Text
    x_mm: Coord
    y_mm: Coord
    z_mm: Coord
    rotation: Literal[0, 90, 180, 270]
    status: Literal['planned', 'existing', 'removed']
    source_circuit_id: Id | None
    notes: Text

    @field_validator('rotation', mode='before')
    @classmethod
    def exact_rotation(cls, value):
        if type(value) is not int:
            raise ValueError('Drehung muss eine ganze Gradzahl sein.')
        return value


class Cover(Rect):
    id: Id
    name: Text
    z_mm: Coord
    material: Text
    thickness_mm: Nonnegative | None
    transparent: bool
    color: Color
    source_id: Id | None
    cutouts: Annotated[list[Rect], PField(max_length=300)]


class Cabinet(Record):
    id: Id
    name: Text
    kind: Literal['UV', 'HV']
    manufacturer: Text
    system: Text
    article: Text
    width_mm: Dimension
    height_mm: Dimension
    depth_mm: Dimension
    inner_width_mm: Dimension
    inner_height_mm: Dimension
    usable_depth_mm: Nonnegative | None
    color_outer: Color
    color_inner: Color
    ral_outer: Text = ''
    ral_inner: Text = ''
    fields: Annotated[list[Field], PField(max_length=100)]
    rails: Annotated[list[Rail], PField(max_length=300)]
    placements: Annotated[list[Placement], PField(max_length=1500)]
    covers: Annotated[list[Cover], PField(max_length=200)]
    reserved_zones: Annotated[list[ReservedZone], PField(max_length=200)]


class Ratings(Record):
    rated_voltage_v: Nonnegative | None
    rated_current_a: Nonnegative | None
    ip_closed: Annotated[str, PField(max_length=80)]
    ip_open_covered: Annotated[str, PField(max_length=80)]
    access_protection: Annotated[str, PField(max_length=80)]
    icw_ka: Nonnegative | None
    icw_duration_s: Nonnegative | None
    ipk_ka: Nonnegative | None
    icc_ka: Nonnegative | None
    protective_device_ref: Text
    source_ids: Annotated[list[Id], PField(max_length=30)]
    notes: Text


class DistributionDocument(Record):
    schema_version: Literal[1]
    id: Id
    name: Text
    project_id: Id | None
    project_number: Annotated[str, PField(max_length=180)]
    project_name: Text
    location: Text
    author: Text
    drawing_number: Text
    schematic_ref: Text
    index: Annotated[str, PField(max_length=120)]
    date: Annotated[str, PField(max_length=80)]
    revision: Annotated[int, PField(ge=0, le=2147483647)]
    system_profile_id: Annotated[str, PField(max_length=120)]
    vnb_id: Literal['none', 'iwb', 'primeo', 'ebl']
    vnb_profile_version: Text
    sources: Annotated[list[SourceRef], PField(max_length=300)]
    profiles: Annotated[list[DeviceProfile], PField(max_length=500)]
    cabinet: Cabinet
    ratings: Ratings

    @field_validator('schema_version', mode='before')
    @classmethod
    def exact_version(cls, value):
        if type(value) is not int or value != 1:
            raise ValueError('Erwartet wird Verteiler-Dateiversion 1.')
        return value

    @model_validator(mode='after')
    def references(self):
        def ids(items, label):
            values = [item.id for item in items]
            if len(values) != len(set(values)):
                raise ValueError(f'{label}: IDs müssen eindeutig sein.')
            return set(values)

        source_ids = ids(self.sources, 'Quellen')
        profile_ids = ids(self.profiles, 'Geräteprofile')
        fields = ids(self.cabinet.fields, 'Felder')
        rails = ids(self.cabinet.rails, 'Schienen')
        ids(self.cabinet.placements, 'Platzierungen')
        ids(self.cabinet.covers, 'Abdeckungen')
        ids(self.cabinet.reserved_zones, 'Sperrbereiche')
        all_physical = [self.cabinet.id, *fields, *rails,
                        *[p.id for p in self.cabinet.placements],
                        *[c.id for c in self.cabinet.covers],
                        *[z.id for z in self.cabinet.reserved_zones]]
        if len(all_physical) != len(set(all_physical)):
            raise ValueError('Physische Objekt-IDs müssen auch über Objektarten hinweg eindeutig sein.')

        for rail in self.cabinet.rails:
            if rail.field_id not in fields:
                raise ValueError('Schiene verweist auf ein unbekanntes Feld.')
        for placement in self.cabinet.placements:
            if placement.profile_id not in profile_ids:
                raise ValueError('Platzierung verweist auf ein unbekanntes Geräteprofil.')
            if placement.rail_id is not None and placement.rail_id not in rails:
                raise ValueError('Platzierung verweist auf eine unbekannte Schiene.')
            if placement.field_id is not None and placement.field_id not in fields:
                raise ValueError('Platzierung verweist auf ein unbekanntes Feld.')
        for profile in self.profiles:
            if set(profile.source_ids) - source_ids:
                raise ValueError('Geräteprofil verweist auf eine unbekannte Quelle.')
        if set(self.ratings.source_ids) - source_ids:
            raise ValueError('Bemessungsangaben verweisen auf eine unbekannte Quelle.')
        for item in [*self.cabinet.covers, *self.cabinet.reserved_zones]:
            if item.source_id is not None and item.source_id not in source_ids:
                raise ValueError('Objekt verweist auf eine unbekannte Quelle.')
        return self


class Issue(Record):
    id: Annotated[str, PField(min_length=1, max_length=500)]
    code: Annotated[str, PField(max_length=120)]
    severity: Literal['error', 'warning', 'open', 'info']
    message: Text
    explanation: Text
    target_id: Id
    field: Annotated[str, PField(max_length=120)]
    actual: Text
    expected: Text
    source_ids: Annotated[list[Id], PField(max_length=30)]
    remedies: Annotated[list[Text], PField(max_length=20)]


class Analysis(Record):
    issues: Annotated[list[Issue], PField(max_length=20000)]
    occupied_te: Annotated[float, PField(ge=0, le=1e15)]
    free_te: Annotated[float, PField(ge=0, le=1e15)]
    known_loss_w: Annotated[float, PField(ge=0, le=1e15)]
    missing_loss_count: Annotated[int, PField(ge=0)]
    document_hash: Annotated[str, PField(pattern=r'^[0-9a-f]{64}$')]
