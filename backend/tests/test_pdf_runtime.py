"""Windows ownership and the complete locked runtime, not just mocked process calls."""
import ctypes
from ctypes import wintypes as w
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time

import pytest

from edeco_toolbox.pdf_workshop.runtime import runtime_root
from edeco_toolbox.pdf_workshop.winjob import JobProcess

pytestmark = pytest.mark.skipif(sys.platform != 'win32', reason='Windows Job Objects')


def test_prepared_runtime_has_every_manifest_file_and_license():
    root = runtime_root()
    if not os.environ.get('EDECO_TEST_PDF_RUNTIME'):
        pytest.skip('Explicit offline runtime test required')
    manifest = json.loads((root / 'manifest.json').read_text())
    for name, digest in manifest['files'].items():
        with (root / name).open('rb') as file:
            assert hashlib.file_digest(file, 'sha256').hexdigest() == digest, name
    assert (root / 'licenses/java-source.tar.gz').is_file()
    assert (root / 'licenses/stirling-source.zip').is_file()
    assert (root / 'licenses/EdecoSessionFilter.java').is_file()


@pytest.mark.parametrize('crash', [False, True])
def test_job_closes_descendants_even_when_owner_is_killed(tmp_path, crash):
    marker = tmp_path / 'pids.json'
    child_code = "import subprocess,sys,time,json; from pathlib import Path; child=subprocess.Popen([sys.executable,'-c','import time;time.sleep(300)']); Path(sys.argv[1]).write_text(json.dumps([__import__('os').getpid(),child.pid])); time.sleep(300)"
    owner_code = "import sys,time,os; sys.path.insert(0,sys.argv[1]); from edeco_toolbox.pdf_workshop.winjob import JobProcess; p=JobProcess([sys.executable,'-c',sys.argv[2],sys.argv[3]],cwd=sys.argv[4],env=dict(os.environ),log=None); time.sleep(300)"
    owner = None
    if crash:
        owner = subprocess.Popen([sys.executable, '-c', owner_code, str(Path(__file__).resolve().parents[1]), child_code, str(marker), str(tmp_path)], creationflags=subprocess.CREATE_NO_WINDOW)
    else:
        process = JobProcess([sys.executable, '-c', child_code, str(marker)], cwd=tmp_path, env=dict(os.environ), log=None)
    handles = []
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel.OpenProcess.argtypes = [w.DWORD, w.BOOL, w.DWORD]; kernel.OpenProcess.restype = w.HANDLE
    kernel.WaitForSingleObject.argtypes = [w.HANDLE, w.DWORD]; kernel.WaitForSingleObject.restype = w.DWORD
    kernel.CloseHandle.argtypes = [w.HANDLE]
    try:
        for _ in range(100):
            if marker.exists():
                try:
                    pids = json.loads(marker.read_text())
                    break
                except ValueError:
                    pass
            time.sleep(.1)
        else:
            pytest.fail('Contained descendants did not start')
        for pid in pids:
            handle = kernel.OpenProcess(0x100000, False, pid)
            assert handle
            handles.append(handle)
        if crash:
            owner.terminate(); owner.wait(timeout=10)
        else:
            process.close()
        assert all(kernel.WaitForSingleObject(handle, 10000) == 0 for handle in handles)
    finally:
        if owner and owner.poll() is None:
            owner.terminate(); owner.wait(timeout=10)
        if not crash:
            process.close()
        for handle in handles:
            kernel.CloseHandle(handle)
