"""DWG import: convert to DXF with the ODA File Converter, then read the DXF.

Command line of the converter:
    ODAFileConverter <input folder> <output folder> <version> <type> <recurse> <audit> [filter]
e.g. "ACAD2013" "DXF" "0" "1" "plan.dwg"
The audit flag is always enabled when reading DWG. The workshop's optional
DXF audit runs separately on the converted working copy.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from .. import config
from .dxf import read_dxf
from .model import ImportResult


MISSING_MESSAGE = ("Für DWG-Dateien wird der ODA File Converter gebraucht. Er ist nicht installiert. "
                   "Alternative: Plan in Nova als DXF exportieren und diese Datei importieren.")


class ConverterMissing(RuntimeError):
    pass


class ConversionFailed(RuntimeError):
    pass


def convert_dwg_to_dxf(dwg: Path, oda_exe: str, out_dir: Path, version: str = "ACAD2013", *,
                       timeout: float = 300) -> Path:
    if not oda_exe:
        raise ConverterMissing(MISSING_MESSAGE)
    try:
        oda_exe = config.validate_oda_converter(oda_exe)
    except config.InvalidODAPath as exc:
        raise ConverterMissing(str(exc)) from None
    in_dir = Path(tempfile.mkdtemp(prefix="nl_dwg_in_"))
    try:
        src = in_dir / dwg.name
        shutil.copy2(dwg, src)
        flags = 0x08000000 if sys.platform == "win32" else 0  # CREATE_NO_WINDOW
        proc = subprocess.run(
            [oda_exe, str(in_dir), str(out_dir), version, "DXF", "0", "1", dwg.name],
            stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            timeout=timeout, creationflags=flags)  # noqa: S603 - fixed program
        target = out_dir / (dwg.stem + ".dxf")
        if proc.returncode != 0:
            raise ConversionFailed(f"Der ODA File Converter meldet einen Fehler (Code {proc.returncode}). "
                                   "Eine mögliche Teilausgabe wurde verworfen.")
        if not target.is_file() or not target.stat().st_size:
            raise ConversionFailed("Der ODA File Converter hat keine lesbare DXF-Datei erzeugt.")
        return target
    finally:
        shutil.rmtree(in_dir, ignore_errors=True)


def read_dwg(path: str | Path, oda_exe: str) -> ImportResult:
    out_dir = Path(tempfile.mkdtemp(prefix="nl_dwg_out_"))
    try:
        dxf = convert_dwg_to_dxf(Path(path), oda_exe, out_dir)
        result = read_dxf(dxf)
        result.format = "dwg"
        return result
    finally:
        shutil.rmtree(out_dir, ignore_errors=True)
