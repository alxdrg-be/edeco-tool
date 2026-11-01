"""ZIP64 portable output; Python avoids Compress-Archive's 2 GB per-file limit."""
import argparse
from pathlib import Path
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument('--version', required=True)
args = parser.parse_args()
source = Path('dist/edeco-Toolbox')
output = Path(f'dist-installer/edeco-Toolbox-Portable-{args.version}.zip')
output.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6, allowZip64=True) as archive:
    for file in sorted(source.rglob('*')):
        if file.is_file():
            archive.write(file, file.relative_to(source.parent))
print(output)
