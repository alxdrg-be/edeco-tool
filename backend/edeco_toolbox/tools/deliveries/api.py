"""Prepare a checked PDF delivery and an immutable audit record. Never send mail."""

import csv
import hashlib
import html
import io
import json
import zipfile
from datetime import date
from pathlib import PurePosixPath
from uuid import UUID

from fastapi import File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from ..file_rename.api import MAX_FILE, MAX_TOTAL, validate_names

PREFIX = "/api/tools/planlieferung"


class Plan(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    filename: str = Field(min_length=5, max_length=180)
    floor: str = Field(min_length=1, max_length=40)
    plan_type: str = Field(min_length=1, max_length=80)
    index: str = Field(max_length=80)
    scale: str = Field(min_length=1, max_length=80)


class Delivery(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    request_id: UUID
    project_id: str = Field(min_length=1, max_length=80)
    project_version: int = Field(ge=1)
    recipient: str = Field(min_length=1, max_length=500)
    delivery_date: date
    title: str = Field(min_length=1, max_length=180)
    notes: str = Field(default="", max_length=2000)
    plans: list[Plan] = Field(min_length=1, max_length=100)


def spreadsheet_cell(value):
    value = str(value)
    return "'" + value if value.lstrip().startswith(("=", "+", "-", "@")) or value.startswith(("\t", "\r", "\n")) else value


def plan_list(summary):
    rows = [["Projektnummer", "Projekt", "Lieferdatum", "Empfänger", "Original", "Dateiname", "Geschoss", "Planart", "Index", "Massstab", "SHA-256"]]
    for plan in summary["plans"]:
        rows.append([summary["project_number"], summary["project_name"], summary["delivery_date"], summary["recipient"],
                     plan["original"], plan["filename"], plan["floor"], plan["plan_type"], plan["index"], plan["scale"], plan["sha256"]])
    stream = io.StringIO(newline="")
    writer = csv.writer(stream, delimiter=";")
    writer.writerows([[spreadsheet_cell(value) for value in row] for row in rows])
    table = "".join("<tr>" + "".join(f"<{tag}>{html.escape(str(value))}</{tag}>" for value in row[4:10]) + "</tr>"
                    for index, row in enumerate(rows) for tag in ["th" if index == 0 else "td"])
    page = ("<!doctype html><html lang='de'><meta charset='utf-8'><title>Planliste</title>"
            "<style>body{font:14px Arial;margin:36px;color:#203039}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccd6da;padding:8px;text-align:left;overflow-wrap:anywhere}h1{color:#017c92}@media print{button{display:none}}</style>"
            f"<h1>{html.escape(summary['title'])}</h1><p>Projekt: {html.escape(summary['project_number'])} · {html.escape(summary['project_name'])}</p>"
            f"<p>Lieferdatum: {summary['delivery_date']} · Empfänger: {html.escape(summary['recipient'])}</p>"
            f"<p>{html.escape(summary['notes'])}</p><table>{table}</table><p>Vorbereitetes Paket. Versand wird separat bestätigt.</p></html>")
    return stream.getvalue().encode("utf-8-sig"), page.encode("utf-8")


def register(app):
    store = app.state.project_hub
    authorize = app.state.project_authorize
    perform = app.state.project_perform

    @app.post(PREFIX + "/prepare")
    async def prepare(request: Request, manifest: str = Form(..., max_length=100000), files: list[UploadFile] = File(...)):
        authorize(request)
        try:
            try:
                delivery = Delivery.model_validate_json(manifest)
                names = [plan.filename for plan in delivery.plans]
                validate_names(names)
                if len(files) != len(names):
                    raise ValueError("Dateien und Planliste stimmen nicht überein.")
            except (ValueError, ValidationError):
                raise HTTPException(400, "Bitte Projekt, Empfänger, Lieferdatum und alle Planangaben sowie eindeutige PDF-Namen prüfen.") from None
            project = perform(lambda: store.get(delivery.project_id))
            summary = delivery.model_dump(mode="json", exclude={"request_id", "project_version"})
            summary.update(id=str(delivery.request_id), project_number=project["number"], project_name=project["name"])
            output, total = io.BytesIO(), 0
            with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_STORED) as archive:
                for upload, plan in zip(files, summary["plans"]):
                    content = await upload.read(MAX_FILE + 1)
                    total += len(content)
                    if not content or len(content) > MAX_FILE or total > MAX_TOTAL or not content.lstrip().startswith(b"%PDF-"):
                        raise HTTPException(400, "Bitte gültige PDFs mit höchstens 30 MB je Datei und insgesamt 150 MB verwenden.")
                    plan.update(original=PurePosixPath((upload.filename or "Plan.pdf").replace("\\", "/")).name,
                                sha256=hashlib.sha256(content).hexdigest(), size=len(content))
                    archive.writestr(plan["filename"], content)
                fingerprint = hashlib.sha256(json.dumps(summary, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
                # Create list outputs first, then persist only a successful preparation.
                csv_data, html_data = plan_list(summary)
                archive.writestr("Planliste.csv", csv_data)
                archive.writestr("Planliste.html", html_data)
                archive.writestr("Planliste.json", json.dumps(summary, ensure_ascii=False, indent=2).encode())
            perform(lambda: store.record_delivery(summary, fingerprint, delivery.project_version))
            return Response(output.getvalue(), media_type="application/zip", headers={
                "Content-Disposition": 'attachment; filename="edeco-planlieferung.zip"', "X-Edeco-Delivery-ID": summary["id"]})
        finally:
            for upload in files:
                await upload.close()

    @app.post(PREFIX + "/{delivery_id}/sent")
    def sent(request: Request, delivery_id: str):
        authorize(request)
        perform(lambda: store.mark_delivery_sent(delivery_id))
        return {"ok": True}
