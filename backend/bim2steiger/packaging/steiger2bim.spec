# pyinstaller packaging/steiger2bim.spec --noconfirm
from pathlib import Path

from PyInstaller.utils.hooks import collect_all

root = Path(SPECPATH).parent

datas = [
    (str(root / "web"), "web"),
    (str(root / "data"), "data"),
    (str(root / "version.json"), "."),
    (str(root / "packaging" / "app.ico"), "packaging"),
]
binaries = []
hiddenimports = ["core", "importers", "rules", "elda_export", "updates", "ifc_import", "n4_import", "olefile"]

# pythonnet belongs to the Edge window. Without it the frozen program
# cannot open its own window.
view_datas, view_bins, view_hidden = collect_all("webview")
datas += view_datas
binaries += view_bins
hiddenimports += view_hidden
for package in ("pythonnet", "clr_loader", "clr"):
    try:
        extra_datas, extra_bins, extra_hidden = collect_all(package)
    except Exception:
        continue
    datas += extra_datas
    binaries += extra_bins
    hiddenimports += extra_hidden

a = Analysis(
    [str(root / "packaging" / "launcher.py")],
    pathex=[str(root)],
    datas=datas,
    binaries=binaries,
    hiddenimports=hiddenimports,
    excludes=["tkinter", "pytest"],
    noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="BIM2STEIGER",
    console=False,
    icon=str(root / "packaging" / "app.ico"),
)
coll = COLLECT(exe, a.binaries, a.datas, name="BIM2STEIGER")
