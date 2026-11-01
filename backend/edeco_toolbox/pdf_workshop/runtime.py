"""Owned, private offline Stirling Core runtime. Never downloads at application startup."""
import atexit
import json
import logging
import os
from pathlib import Path
import secrets
import socket
import sys
import tempfile
import threading
import time

import httpx

from ..paths import local_home
from . import ROOT
from .winjob import JobProcess


def runtime_root():
    if getattr(sys, 'frozen', False):
        return Path(sys._MEIPASS) / 'pdf-runtime'
    return Path(os.environ.get('EDECO_PDF_RUNTIME', Path(__file__).resolve().parents[3] / 'packaging' / 'pdf-runtime'))


class PdfRuntime:
    def __init__(self):
        self.root = runtime_root()
        self.secret = secrets.token_urlsafe(48)
        self.url = ''
        self.ready = False
        self.message = 'Der lokale PDF-Dienst wird gestartet.'
        self.process = None
        self.workspace = None
        self.lock = threading.Lock()
        self.stopping = threading.Event()
        self.thread = None
        atexit.register(self.close)

    def start(self):
        with self.lock:
            if self.thread is None:
                self.thread = threading.Thread(target=self._run, name='edeco-pdf-runtime', daemon=True)
                self.thread.start()

    def _run(self):
        try:
            if sys.platform != 'win32':
                raise RuntimeError('Die gebündelte PDF-Laufzeit benötigt Windows x64.')
            manifest = json.loads((self.root / 'manifest.json').read_text(encoding='utf-8'))
            for relative in manifest['required']:
                if not (self.root / relative).is_file():
                    raise RuntimeError('Die PDF-Laufzeit ist unvollständig. Bitte das vollständige Setup erneut installieren.')
            with socket.socket() as listener:
                listener.bind(('127.0.0.1', 0))
                port = listener.getsockname()[1]
            self.url = f'http://127.0.0.1:{port}'
            home = local_home() / 'pdf-workshop' / 'sessions'
            home.mkdir(parents=True, exist_ok=True)
            self.workspace = tempfile.TemporaryDirectory(prefix='session-', dir=home)
            work = Path(self.workspace.name)
            temp = work / 'tmp'; temp.mkdir()
            # No inherited Java agents/options, remote service settings or host PDF binaries.
            env = {key: value for key, value in os.environ.items() if not key.upper().startswith(
                ('SYSTEM_', 'SECURITY_', 'SERVER_', 'SPRING_', 'ENDPOINTS_', 'UI_', 'JAVA_', 'JDK_', '_JAVA_', 'STIRLING_', 'DOCKER_', 'PIPELINE_', 'PROCESS_EXECUTOR_'))}
            env.update({
                'PATH': os.pathsep.join(str(self.root / part) for part in ('java/bin', 'tesseract', 'qpdf/bin')) + os.pathsep + str(Path(os.environ.get('SystemRoot', 'C:/Windows')) / 'System32'),
                'TEMP': str(temp), 'TMP': str(temp),
                'LOCALAPPDATA': str(work / 'local'), 'APPDATA': str(work / 'roaming'),
                'EDECO_ENGINE_SECRET': self.secret,
                'TESSDATA_PREFIX': str(self.root / 'tesseract/tessdata'),
                'SYSTEM_TESSDATADIR': str(self.root / 'tesseract/tessdata'),
                'SYSTEM_ROOTURIPATH': ROOT,
                'SYSTEM_DEFAULTLOCALE': 'de-DE',
                'UI_APPNAMENAVBAR': 'edeco PDF-Werkstatt',
                'UI_DEFAULTSTARTUPVIEW': 'tools',
                'UI_DEFAULTHIDEUNAVAILABLETOOLS': 'true',
                'UI_DEFAULTHIDEUNAVAILABLECONVERSIONS': 'true',
                'SECURITY_ENABLELOGIN': 'false',
                'SYSTEM_ENABLEANALYTICS': 'false', 'SYSTEM_ENABLEPOSTHOG': 'false',
                'SYSTEM_ENABLESCARF': 'false', 'SYSTEM_SHOWUPDATE': 'false',
                'SYSTEM_GOOGLEVISIBILITY': 'false', 'SYSTEM_ENABLEDESKTOPINSTALLSLIDE': 'false',
                'SYSTEM_ENABLEEASTEREGGS': 'false', 'TOOLRECOMMENDATIONS_ENABLED': 'false',
                'ENDPOINTS_GROUPSTOREMOVE': 'LibreOffice,Unoconvert,Weasyprint,Calibre,Pdftohtml,OpenCV,Ghostscript,OCRmyPDF,ImageMagick,rar,Automation,DeveloperTools,DocParse',
                'ENDPOINTS_TOREMOVE': 'url-to-pdf,html-to-pdf,pdf-to-video,auto-rotate-pdf,form-detection,timestamp-pdf',
                'SYSTEM_MAXFILESIZE': '100',
            })
            command = [str(self.root / 'java/bin/java.exe'), '-Xms64m', '-Xmx1536m',
                       '--enable-native-access=ALL-UNNAMED', '-Djava.awt.headless=true',
                       f'-Djava.io.tmpdir={temp}', f'-Duser.home={work}',
                       '-jar', str(self.root / 'stirling.jar'), '--server.address=127.0.0.1',
                       f'--server.port={port}', '--spring.cloud.config.enabled=false',
                       f'--logging.file.name={work / "engine.log"}']
            with self.lock:
                if self.stopping.is_set():
                    return
                self.process = JobProcess(command, cwd=work, env=env, log=work / 'engine.log')
            with httpx.Client(trust_env=False, timeout=2, headers={'X-Edeco-Engine': self.secret}) as client:
                deadline = time.monotonic() + 150
                while not self.stopping.is_set() and time.monotonic() < deadline:
                    if self.process.poll() is not None:
                        raise RuntimeError('Der lokale PDF-Dienst wurde unerwartet beendet.')
                    try:
                        response = client.get(self.url + ROOT + '/api/v1/info/status')
                        if response.status_code == 200 and response.json().get('status') == 'UP':
                            self.ready = True
                            self.message = 'PDF-Verarbeitung auf diesem Computer · offline bereit.'
                            return
                    except (httpx.HTTPError, ValueError):
                        pass
                    self.stopping.wait(.5)
            if not self.stopping.is_set():
                raise RuntimeError('Der lokale PDF-Dienst startet nicht innerhalb von 150 Sekunden.')
        except Exception as exc:
            self.message = str(exc)
            logging.exception('Offline PDF runtime failed')
            self._stop_process()

    def health(self):
        if self.ready and self.process and self.process.poll() is not None:
            self.ready = False
            self.message = 'Der lokale PDF-Dienst wurde beendet. Bitte die Toolbox neu starten.'
        return {'ready': self.ready, 'version': '3.2.2' if self.ready else '', 'message': self.message}

    def _stop_process(self):
        with self.lock:
            if self.process:
                self.process.close()
                self.process = None
        self.ready = False

    def close(self):
        self.stopping.set()
        if self.thread and self.thread is not threading.current_thread():
            self.thread.join(timeout=5)
        self._stop_process()
        if self.workspace:
            try:
                self.workspace.cleanup()
            except OSError:
                logging.warning('PDF session cleanup deferred: %s', self.workspace.name)
            self.workspace = None
