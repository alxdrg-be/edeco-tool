"""Isoliert native IFC-Geometrie und grosse Excel-Importe vom lokalen Toolhub."""

import json
import sys
from dataclasses import asdict
from pathlib import Path

from .storage import encode, json_output, read_model, write_model


def main(args: list[str]) -> int:
    operation, model_folder, job_folder, model_id, filename = args
    model_path, job = Path(model_folder), Path(job_folder)
    try:
        if operation == "scene":
            from .scene import write_scene
            write_scene(model_path / "model.ifc", job / "scene.json")
        elif operation == "check":
            from .guide import read_guide
            from .checks import evaluate
            from .workbook import report_xlsx

            guide = read_guide(job / "input.xlsx")
            model = read_model(model_path)
            report = evaluate(model, guide)
            # Stream potentially large results one row at a time.
            with json_output(job / "results.json") as write:
                write('{"rows":[')
                for index, row in enumerate(report.rows):
                    if index:
                        write(",")
                    write(encode(asdict(row)))
                metadata = {"rules": [asdict(rule) for rule in guide.rules], "counts": report.counts,
                            "pass_rate": report.pass_rate, "warnings": list(dict.fromkeys([*guide.warnings, *report.warnings]))}
                write("]," + encode(metadata)[1:])
            (job / "report.xlsx").write_bytes(report_xlsx(
                report, model_filename=model.source, guide_filename=filename, rules=guide.rules,
            ))
        else:
            if operation == "ifc":
                from .ifc import parse_ifc
                model = parse_ifc(job / "input.ifc")
            else:
                from .nova import parse_nova
                model = parse_nova(job / "input.xlsx")
            model.source = filename
            write_model(model_path, model, model_id, filename, "IFC" if operation == "ifc" else "NOVA")
    except ValueError as exc:
        (job / "error.json").write_text(json.dumps(str(exc)[:1600]), encoding="utf-8")
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
