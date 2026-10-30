"""Start the local application, reusing only an instance of this project folder."""
import argparse,hashlib,json,socket,subprocess,sys,time,webbrowser
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen

ROOT=Path(__file__).resolve().parent
PROJECT_ID=hashlib.sha256(str(ROOT).casefold().encode()).hexdigest()

def instance(port):
    try:
        with urlopen(f'http://127.0.0.1:{port}/api/app',timeout=.5) as response:
            value=json.load(response)
        return value.get('application')=='BIM2STEIGER' and value.get('project_id')==PROJECT_ID
    except (URLError,OSError,ValueError):return False

def available(port):
    with socket.socket() as probe:
        try:probe.bind(('127.0.0.1',port));return True
        except OSError:return False

def start(open_ui=True,browser=False):
    ports=range(8765,8781)
    port=next((p for p in ports if instance(p)),None)
    if port is None:
        port=next((p for p in ports if available(p)),None)
        if port is None:raise RuntimeError('Kein freier lokaler Port zwischen 8765 und 8780.')
        subprocess.Popen([sys.executable,str(ROOT/'server.py'),'--port',str(port)],cwd=ROOT,
                         creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0),
                         stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        for _ in range(50):
            if instance(port):break
            time.sleep(.2)
        else:raise RuntimeError('Lokaler Server konnte nicht gestartet werden. server.py im Projektordner prüfen.')
    url=f'http://127.0.0.1:{port}/bim2steiger.html'
    if open_ui and browser:webbrowser.open(url)
    elif open_ui:
        from server import show_program,window_failure_message
        if not show_program(url):raise RuntimeError(window_failure_message(show_program.last_error))
    return url

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--no-open',action='store_true');parser.add_argument('--browser',action='store_true');args=parser.parse_args()
    try:print(start(not args.no_open,args.browser))
    except (RuntimeError,OSError) as error:sys.exit(str(error))
