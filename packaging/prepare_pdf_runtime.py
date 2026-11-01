"""Build-time only: locked downloads, portable extraction, Core session filter and notices.

Run with a JDK 25 on PATH. --offline requires an already populated cache.
No installer, registry registration, download or host tool is needed by the shipped app.
"""
import argparse
import copy
import hashlib
import html
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import tomllib
import tarfile
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / 'packaging'


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def extract(archive, destination):
    with zipfile.ZipFile(archive) as source:
        for member in source.infolist():
            target = (destination / member.filename).resolve()
            if not target.is_relative_to(destination.resolve()):
                raise ValueError('Archive path escapes destination')
        source.extractall(destination)


def run(command, **kwargs):
    subprocess.run(list(map(str, command)), check=True, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0), **kwargs)


def prepare(args):
    lock = json.loads((PACK / 'pdf-runtime.lock.json').read_text(encoding='utf-8-sig'))
    cache = PACK / 'pdf-runtime-cache'; cache.mkdir(exist_ok=True)
    for item in lock['files']:
        target = cache / item['name']
        if not target.exists():
            if args.offline:
                raise ValueError(f'Missing locked input: {target.name}')
            request = urllib.request.Request(item['url'], headers={'User-Agent': 'edeco-runtime-builder'})
            partial = target.with_suffix(target.suffix + '.part')
            with urllib.request.urlopen(request, timeout=180) as response, partial.open('wb') as output:
                shutil.copyfileobj(response, output)
            partial.replace(target)
        if digest(target) != item['sha256']:
            raise ValueError(f'SHA-256 mismatch: {target.name}')
    output = PACK / 'pdf-runtime'
    if output.exists():
        raise ValueError('pdf-runtime already exists; keep it or move it aside before rebuilding')
    with tempfile.TemporaryDirectory(prefix='pdf-stage-', dir=cache) as temporary:
        stage = Path(temporary)
        runtime = stage / 'runtime'; runtime.mkdir()
        webview_stage = stage / 'webview'; webview_stage.mkdir()
        run(['expand.exe', cache / 'webview2.cab', '-F:*', webview_stage], stdout=subprocess.DEVNULL)
        webview = next(webview_stage.rglob('msedgewebview2.exe')).parent
        shutil.copytree(webview, runtime / 'webview2')
        extract(cache / 'java.zip', stage / 'java')
        java = next((stage / 'java').glob('*/bin/java.exe')).parents[1]
        shutil.copytree(java, runtime / 'java')
        extract(cache / 'qpdf.zip', stage / 'qpdf')
        qpdf = next((stage / 'qpdf').rglob('qpdf.exe')).parents[1]
        shutil.copytree(qpdf, runtime / 'qpdf')
        seven = Path(args.sevenzip) if args.sevenzip else stage / 'seven/Files/7-Zip/7z.exe'
        if not args.sevenzip:
            run(['msiexec.exe', '/a', cache / '7zip.msi', '/qn', f'TARGETDIR={stage / "seven"}'])
            if not seven.exists():
                seven = next((stage / 'seven').rglob('7z.exe'))
        run([seven, 'x', cache / 'tesseract.exe', f'-o{stage / "tesseract"}', '-y'], stdout=subprocess.DEVNULL)
        tess = next((stage / 'tesseract').rglob('tesseract.exe')).parent
        # Ship the OCR executable's actual DLL closure; training programs bring unrelated tools.
        import pefile
        pending = ['tesseract.exe']; needed = set()
        while pending:
            name = pending.pop()
            if name in needed:
                continue
            needed.add(name)
            with pefile.PE(str(tess / name)) as binary:
                imports = [entry.dll.decode().lower() for entry in getattr(binary, 'DIRECTORY_ENTRY_IMPORT', [])]
                imports += [entry.dll.decode().lower() for entry in getattr(binary, 'DIRECTORY_ENTRY_DELAY_IMPORT', [])]
            pending.extend(name for name in imports if (tess / name).is_file() and name not in needed)
        (runtime / 'tesseract').mkdir()
        for name in sorted(needed):
            shutil.copy2(tess / name, runtime / 'tesseract' / name)
        shutil.copytree(tess / 'doc', runtime / 'tesseract/doc')
        shutil.copytree(tess / 'tessdata', runtime / 'tesseract/tessdata')
        data = runtime / 'tesseract/tessdata'; data.mkdir(exist_ok=True)
        for language in ('deu', 'eng', 'osd'):
            shutil.copy2(cache / f'{language}.traineddata', data)
        # The official Core artifact has no proprietary classes. Fail closed on flavor drift.
        with zipfile.ZipFile(cache / 'stirling.jar') as jar:
            if any(name.startswith(('BOOT-INF/classes/stirling/software/proprietary/', 'BOOT-INF/classes/stirling/software/saas/'))
                   or name.startswith(('BOOT-INF/lib/proprietary-', 'BOOT-INF/lib/saas-')) for name in jar.namelist()):
                raise ValueError('Expected free Stirling Core; proprietary classes found')
            libraries = stage / 'compile'; libraries.mkdir()
            for name in jar.namelist():
                if name.startswith('BOOT-INF/lib/') and name.endswith('.jar') and any(
                        part in name for part in ('jakarta.servlet-api-', 'spring-core-', 'spring-context-')):
                    (libraries / Path(name).name).write_bytes(jar.read(name))
            classes = stage / 'classes'; classes.mkdir()
            javac = args.javac or shutil.which('javac')
            if not javac:
                raise ValueError('Build requires javac from JDK 25')
            run([javac, '--release', '25', '-cp', str(libraries / '*'), '-d', classes, PACK / 'java/EdecoSessionFilter.java'])
            with zipfile.ZipFile(runtime / 'stirling.jar', 'w') as patched:
                for entry in jar.infolist():
                    if entry.filename == 'BOOT-INF/lib/jpdfium-natives-linux-x64-1.1.6.jar':
                        continue
                    content = jar.read(entry.filename)
                    if entry.filename in ('BOOT-INF/classpath.idx', 'BOOT-INF/layers.idx'):
                        content = content.replace(b'jpdfium-natives-linux-x64-1.1.6.jar', b'jpdfium-natives-windows-x64-1.1.6.jar')
                    patched.writestr(copy.copy(entry), content)
                patched.write(cache / 'jpdfium-natives-windows-x64-1.1.6.jar', 'BOOT-INF/lib/jpdfium-natives-windows-x64-1.1.6.jar', compress_type=zipfile.ZIP_STORED)
                for file in classes.rglob('*.class'):
                    patched.write(file, 'BOOT-INF/classes/' + file.relative_to(classes).as_posix())
            notices = runtime / 'licenses'; notices.mkdir()
            for name in jar.namelist():
                if name.startswith('BOOT-INF/classes/static/') and any(token in name for token in ('ThirdPartyLicenses.html', '3rdPartyLicenses.json')) and not name.endswith(('.gz', '.br')):
                    (notices / Path(name).name).write_bytes(jar.read(name))
            # Preserve the license/notice files of every nested Java library.
            import io
            with (notices / 'java-dependency-notices.txt').open('w', encoding='utf-8') as report:
                for name in jar.namelist():
                    if name.startswith('BOOT-INF/lib/') and name.endswith('.jar'):
                        with zipfile.ZipFile(io.BytesIO(jar.read(name))) as library:
                            for entry in library.namelist():
                                if not entry.endswith('/') and Path(entry).name.lower().startswith(('license', 'notice', 'copying')):
                                    report.write(f'\n\n===== {name}: {entry} =====\n')
                                    report.write(library.read(entry).decode('utf-8', errors='replace'))
        shutil.copy2(ROOT / 'deployment/pdf-workshop/STIRLING-LICENSE.txt', notices)
        shutil.copy2(PACK / 'licenses/WebView2-LICENSE.html', notices)
        shutil.copy2(PACK / 'java/EdecoSessionFilter.java', notices)
        shutil.copy2(PACK / 'pdf-runtime.lock.json', notices)
        with zipfile.ZipFile(cache / 'jpdfium-natives-windows-x64-1.1.6.jar') as native:
            for name in native.namelist():
                if name.startswith('licenses/') and not name.endswith('/'):
                    (notices / ('jpdfium-' + Path(name).name)).write_bytes(native.read(name))
        for name in ('java-source.tar.gz', 'stirling-source.zip', 'tesseract-source.zip', 'tessdata-LICENSE', 'jpdfium-source.zip'):
            shutil.copy2(cache / name, notices)
        with (notices / 'ocr-dependency-notices.txt').open('w', encoding='utf-8') as report:
            for item in lock['files']:
                name = item['name']
                if name.startswith('GCC-'):
                    shutil.copy2(cache / name, notices)
                if not name.startswith('source-'):
                    continue
                shutil.copy2(cache / name, notices)
                with tarfile.open(cache / name, 'r:gz') as source:
                    for member in source.getmembers():
                        if member.isfile() and member.size < 2_000_000 and Path(member.name).name.lower().startswith(('license', 'copying', 'copyright', 'notice')):
                            report.write(f'\n\n===== {name}: {member.name} =====\n')
                            report.write(source.extractfile(member).read().decode('utf-8', errors='replace'))
        for folder in (runtime / 'java', runtime / 'tesseract', runtime / 'qpdf', runtime / 'webview2'):
            for file in folder.rglob('*'):
                if file.is_file() and (file.name.lower().startswith(('license', 'notice', 'copying', 'authors')) or '/legal/' in file.as_posix()):
                    target = notices / (folder.name + '-' + file.relative_to(folder).as_posix().replace('/', '_'))
                    shutil.copy2(file, target)
        links = ''.join(f'<li><a href="/api/tools/pdf-werkstatt/licenses/{html.escape(file.name)}">{html.escape(file.name)}</a></li>' for file in sorted(notices.iterdir()))
        unsupported = set()
        with zipfile.ZipFile(cache / 'stirling-source.zip') as source:
            for name in source.namelist():
                if '/frontend/public/locales/' in name and name.endswith('/translation.toml'):
                    translations = tomllib.loads(source.read(name).decode('utf-8-sig'))
                    options = translations.get('ocr', {}).get('settings', {})
                    unsupported.update(value for key, value in options.get('advancedOptions', {}).items() if key != 'label')
                    value = options.get('compatibilityMode', {}).get('label')
                    if value:
                        unsupported.add(value)
                    value = options.get('ocrMode', {}).get('strict')
                    if value:
                        unsupported.add(value)
        (runtime / 'offline-options.json').write_text(json.dumps(sorted(unsupported), ensure_ascii=False), encoding='utf-8')
        (runtime / 'NOTICE.html').write_text('<!doctype html><html lang="de"><meta charset="utf-8"><title>Info / Lizenzen</title><style>body{font:16px system-ui;max-width:1000px;margin:3em auto;padding:1em}li{margin:.4em}</style><h1>edeco PDF-Werkstatt · Info / Lizenzen</h1><p>Stirling PDF Core 3.2.2 · Copyright Stirling PDF Inc. · MIT. Die edeco-Anpassung ergänzt Branding, lokalen Sitzungsschutz und Windows-Paketierung. Kostenlose Core-Ausgabe ohne proprietäre Stirling-Module.</p><p>Enthalten: Eclipse Temurin OpenJDK 25 (GPLv2 mit Classpath Exception), Tesseract 5.4 und Sprachdaten (Apache-2.0), qpdf 12.4.2 (Apache-2.0), Windows-PDFium und Microsoft Edge WebView2 Fixed Runtime (Microsoft-Lizenzbedingungen). Originalhinweise und Quellen sind unten und im Ordner licenses enthalten. Die Java- und PDF-Komponenten werden ausschliesslich lokal ausgeführt.</p><p>Das Programmfenster nutzt Microsoft WebView2. Diese Komponente kann gemäss Microsoft-Datenschutzerklärung Nutzungsdaten an Microsoft senden; dies ist keine Voraussetzung für PDF-Verarbeitung. Mit der Nutzung gelten die beigefügten Microsoft-Bedingungen. Die vollständigen Chromium-Drittanbieterhinweise können über show_third_party_software_licenses.bat im Ordner webview2 geöffnet werden.</p><p>OCR verwendet Tesseract direkt. OCRmyPDF-Optionen wie Entzerren und Reinigen sind in dieser Ausgabe nicht verfügbar. Office-, HTML-/Webseiten-, E-Book-, Video- und KI-Konvertierung werden nicht mitgeliefert.</p><ul>' + links + '</ul></html>', encoding='utf-8')
        required = ['java/bin/java.exe', 'stirling.jar', 'tesseract/tesseract.exe', 'qpdf/bin/qpdf.exe', 'webview2/msedgewebview2.exe',
                    'tesseract/tessdata/deu.traineddata', 'tesseract/tessdata/eng.traineddata', 'tesseract/tessdata/osd.traineddata', 'NOTICE.html']
        for name in required:
            if not (runtime / name).is_file():
                raise ValueError(f'Incomplete runtime: {name}')
        manifest = {'schema': 1, 'version': lock['stirling_version'], 'required': required,
                    'files': {file.relative_to(runtime).as_posix(): digest(file) for file in sorted(runtime.rglob('*')) if file.is_file()}}
        (runtime / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
        runtime.rename(output)
    print(f'Offline runtime ready: {output}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--offline', action='store_true')
    parser.add_argument('--javac')
    parser.add_argument('--sevenzip')
    prepare(parser.parse_args())
