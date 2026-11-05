"""Plan uploads stop at the same 250 MB ceiling as the other large file routes."""

import io

import pytest
from fastapi import HTTPException

from nova_legend.api.projects import PLAN_UPLOAD_LIMIT, copy_limited


def test_plan_upload_limit_matches_the_toolbox_ceiling():
    assert PLAN_UPLOAD_LIMIT == 250 * 1024 * 1024


def test_plan_copy_stops_above_the_given_limit_and_removes_the_partial_file(tmp_path):
    limit = 1024 * 1024
    dest = tmp_path / "plan.dxf"
    with pytest.raises(HTTPException) as caught:
        copy_limited(io.BytesIO(b"x" * (limit + 1)), dest, limit)
    assert caught.value.status_code == 413
    assert "1 MB" in caught.value.detail
    assert not dest.exists()
    ok = tmp_path / "ok.dxf"
    copy_limited(io.BytesIO(b"0\nSECTION"), ok, limit)
    assert ok.read_bytes().startswith(b"0")
