# PyInstaller build description. Run from the project root:
#   pyinstaller packaging/edeco_toolbox.spec --noconfirm
from pathlib import Path
from shutil import copyfile

from PyInstaller.utils.hooks import collect_data_files, collect_dynamic_libs, collect_submodules, copy_metadata

root = Path(SPECPATH).parent

a = Analysis(
    [str(root / "packaging" / "toolbox_launcher.py")],
    pathex=[str(root / "backend")],
    binaries=collect_dynamic_libs("pypdfium2_raw"),
    datas=[(str(root / "ui" / "dist"), "ui/dist"),
           (str(root / "backend" / "nova_legend" / "legend" / "template_texts.json"), "nova_legend/legend"),
           (str(root / "backend" / "bim2steiger" / "data"), "bim2steiger/data"),
           (str(root / "backend" / "bim2steiger" / "web"), "bim2steiger/web"),
           (str(root / "backend" / "bim2steiger" / "version.json"), "bim2steiger"),
           (str(root / "packaging" / "toolbox.ico"), "packaging")]
          + collect_data_files("ezdxf") + collect_data_files("pypdfium2")
          + collect_data_files("pypdfium2_raw") + copy_metadata("pypdfium2"),
    hiddenimports=(collect_submodules("edeco_toolbox") + collect_submodules("nova_legend") + collect_submodules("uvicorn")
                   + collect_submodules("ezdxf.addons.drawing") + ["ezdxf.addons.importer"]
                   + collect_submodules("python_multipart") + ["multipart", "webview"]),
    excludes=["tkinter", "matplotlib", "pytest"],
    noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="edeco-Toolbox",
    console=False,
    icon=str(root / "packaging" / "toolbox.ico"),
    version=None,
)
coll = COLLECT(exe, a.binaries, a.datas, name="edeco-Toolbox")

# CLR reads the process configuration next to the EXE, not inside _internal.
copyfile(root / "packaging" / "edeco-Toolbox.exe.config",
         Path(DISTPATH) / "edeco-Toolbox" / "edeco-Toolbox.exe.config")
