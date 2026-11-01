"""Developer probe of the shipped Windows runtime, without any remote PDF service."""
import os
from pathlib import Path
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
from edeco_toolbox.pdf_workshop.runtime import PdfRuntime

runtime = PdfRuntime()
try:
    runtime.start()
    for _ in range(310):
        if runtime.ready or (runtime.thread and not runtime.thread.is_alive()):
            break
        time.sleep(.5)
    print(runtime.health(), flush=True)
    if runtime.workspace:
        log = Path(runtime.workspace.name) / 'engine.log'
        if log.exists():
            Path('output').mkdir(exist_ok=True)
            Path('output/pdf-engine-probe.log').write_bytes(log.read_bytes())
    if not runtime.ready:
        raise SystemExit(1)
    import httpx
    assert httpx.get(runtime.url + '/tools/pdf-werkstatt/api/v1/info/status', trust_env=False).status_code == 403
    from edeco_toolbox.pdf_workshop.client import StirlingClient
    client = StirlingClient(runtime.url, engine_secret=runtime.secret)
    assert client.health()['ready']
    print('Direct unauthenticated engine access blocked; authenticated health passed', flush=True)
finally:
    runtime.close()
