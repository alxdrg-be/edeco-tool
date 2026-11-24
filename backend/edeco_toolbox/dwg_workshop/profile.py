"""Office layer rules shared by the preview and the editable DXF copy."""

from math import isclose

from ezdxf.lldxf.const import VALID_DXF_LINEWEIGHTS
from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Literal


class LayerRule(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    contains: str = Field(min_length=1, max_length=255)
    action: Literal["keep", "grey", "hide"]
    lineweight_mm: float | None = Field(default=None, ge=0, le=2.11, allow_inf_nan=False)

    @field_validator("lineweight_mm")
    @classmethod
    def standard_lineweight(cls, value):
        if value is not None and not any(isclose(value, weight / 100, abs_tol=1e-8) for weight in VALID_DXF_LINEWEIGHTS):
            raise ValueError("Linienstärke ausserhalb der DXF-Normstufen.")
        return value


class Profile(BaseModel):
    model_config = ConfigDict(extra="forbid")
    rules: list[LayerRule] = Field(default_factory=list, max_length=128)
    remove_wipeouts: bool = False
    remove_text_backgrounds: bool = False
