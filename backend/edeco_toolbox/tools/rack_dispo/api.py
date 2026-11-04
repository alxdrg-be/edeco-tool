"""Transient, local-only export; central Toolhub local_security applies."""

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import Response
from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool

from .model import ExportRequest
from .render import csv_bytes, dxf_bytes, filename, pdf_bytes, svg_bytes

PREFIX = "/api/tools/rack-dispo"
MAX_BODY_BYTES = 12 * 1024 * 1024


def register(app: FastAPI) -> None:
    @app.post(PREFIX + "/export", tags=["rack-dispo"])
    async def export(request: Request):
        raw = bytearray()
        async for chunk in request.stream():
            if len(raw) + len(chunk) > MAX_BODY_BYTES:
                raise HTTPException(413, "Rack-Dokument ist zu gross (maximal 12 MiB).")
            raw.extend(chunk)
        try:
            payload = ExportRequest.model_validate_json(raw)
        except ValidationError as error:
            # Avoid including entire project documents or unserialisable
            # exception objects in the error response.
            details = [{"loc": list(item["loc"]), "msg": item["msg"], "type": item["type"]} for item in error.errors(include_input=False)[:30]]
            raise HTTPException(422, details) from error
        renderers = {"pdf": (pdf_bytes, "application/pdf"), "svg": (svg_bytes, "image/svg+xml"), "dxf": (dxf_bytes, "application/dxf")}
        if payload.format in ("ports-csv", "bom-csv"):
            data = await run_in_threadpool(csv_bytes, payload, payload.format == "ports-csv")
            media_type = "text/csv; charset=utf-8"
        else:
            renderer, media_type = renderers[payload.format]
            data = await run_in_threadpool(renderer, payload)
        return Response(data, media_type=media_type, headers={"Content-Disposition": f'attachment; filename="{filename(payload)}"', "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"})
