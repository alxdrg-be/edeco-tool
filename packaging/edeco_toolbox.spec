# PyInstaller build description. Run from the project root:
#   pyinstaller packaging/edeco_toolbox.spec --noconfirm
from pathlib import Path
from shutil import copyfile, copytree, rmtree

from PyInstaller.utils.hooks import collect_data_files, collect_dynamic_libs, collect_submodules, copy_metadata

root = Path(SPECPATH).parent
pdf_runtime = root / 'packaging' / 'pdf-runtime'
if not (pdf_runtime / 'manifest.json').is_file():
    raise RuntimeError('Prepare the locked offline PDF runtime before building the Toolbox')

# BIM2STEIGER ships what it reads at run time. The source data the catalogue database is
# rebuilt from, the portal evidence and the design mock-up stay in the repository only.
BIM_SOURCE_ONLY = {"data/catalogue.json", "data/assemblies.json", "data/chapter_information.json",
                   "data/source_snapshots.zip", "web/bim2steiger-mockup.html"}
bim_root = root / "backend" / "bim2steiger"
bim_datas = []
for folder in ("data", "web"):
    for item in sorted((bim_root / folder).iterdir()):
        relative = f"{folder}/{item.name}"
        if relative in BIM_SOURCE_ONLY:
            continue
        bim_datas.append((str(item), f"bim2steiger/{relative}" if item.is_dir() else f"bim2steiger/{folder}"))
missing = [name for name in BIM_SOURCE_ONLY if not (bim_root / name).exists()]
if missing:
    raise RuntimeError(f"BIM2STEIGER exclusion list is out of date: {missing}")

a = Analysis(
    [str(root / "packaging" / "toolbox_launcher.py")],
    pathex=[str(root / "backend")],
    binaries=collect_dynamic_libs("pypdfium2_raw"),
    datas=[(str(root / "ui" / "dist"), "ui/dist"),
           (str(root / "backend" / "nova_legend" / "legend" / "template_texts.json"), "nova_legend/legend"),
           (str(root / "backend" / "nova_legend" / "legend" / "resources"), "nova_legend/legend/resources"),
           *bim_datas,
           (str(root / "backend" / "bim2steiger" / "version.json"), "bim2steiger"),
           (str(root / "backend" / "edeco_toolbox" / "pdf_workshop" / "assets"), "edeco_toolbox/pdf_workshop/assets"),
           (str(root / "packaging" / "toolbox.ico"), "packaging")]
          + collect_data_files("ezdxf") + collect_data_files("pypdfium2")
          + collect_data_files("pypdfium2_raw") + copy_metadata("pypdfium2") + copy_metadata("pypdf"),
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
runtime_destination = Path(DISTPATH) / 'edeco-Toolbox' / '_internal' / 'pdf-runtime'
if runtime_destination.exists():
    if not runtime_destination.resolve().is_relative_to(Path(DISTPATH).resolve()):
        raise RuntimeError('Runtime output must stay inside the build directory')
    rmtree(runtime_destination)
copytree(pdf_runtime, runtime_destination)
copyfile(root / 'packaging' / 'PORTABLE_README.txt', Path(DISTPATH) / 'edeco-Toolbox' / 'LIESMICH.txt')

# CLR reads the process configuration next to the EXE, not inside _internal.
copyfile(root / "packaging" / "edeco-Toolbox.exe.config",
         Path(DISTPATH) / "edeco-Toolbox" / "edeco-Toolbox.exe.config")
