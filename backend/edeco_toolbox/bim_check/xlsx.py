"""Arbeitsmappen für Regel- und Nova-Import lokal und zeilenweise öffnen."""

from contextlib import contextmanager
from pathlib import Path
from xml.etree.ElementTree import ParseError
from zipfile import BadZipFile, ZipFile

from openpyxl import load_workbook
from openpyxl.utils.exceptions import InvalidFileException


@contextmanager
def open_xlsx(path: Path, *, data_only: bool):
    try:
        with ZipFile(path) as archive:
            if sum(entry.file_size for entry in archive.infolist()) > 256 * 1024 * 1024:
                raise ValueError("Die entpackte Excel-Datei ist grösser als 256 MiB.")
        book = load_workbook(path, read_only=True, data_only=data_only, keep_links=False)
    except (BadZipFile, InvalidFileException, KeyError, ParseError, OSError) as exc:
        raise ValueError("Die Datei lässt sich nicht als XLSX-Arbeitsmappe lesen.") from exc
    try:
        yield book
    except (BadZipFile, ParseError, OSError) as exc:
        raise ValueError("Mindestens ein Arbeitsblatt der Excel-Datei ist beschädigt.") from exc
    finally:
        book.close()
