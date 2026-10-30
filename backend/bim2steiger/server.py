#!/usr/bin/env python3
"""Start locally: python server.py. No dependencies for catalogue/CSV/JSON.

The installed program opens its own window. The system browser is used only
with --browser.
"""
import argparse,base64,binascii,gzip,hashlib,hmac,inspect,json,mimetypes,os,sys,threading,time,webbrowser
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse,parse_qs,unquote
from urllib.request import urlopen
from core import Catalogue,aggregate_tender,catalogue_editions
from importers import import_model
from rules import match_assignments
from elda_export import export_messerli,titles_from_navigation
from updates import UpdateManager

def app_root():
    if getattr(sys,'frozen',False):return Path(getattr(sys,'_MEIPASS'))
    return Path(__file__).resolve().parent
ROOT=app_root()
# Nova and IFC plans are sent as Base64, so the body is about a third larger than the file.
# IFC models are sometimes about 200 MB; 250 MB leaves room for that size.
MAX_IMPORT_FILE=250_000_000
MAX_IMPORT_BODY=360_000_000
CAT=Catalogue()
UPDATES=UpdateManager(ROOT)
PROJECT_ID=hashlib.sha256(str(ROOT).casefold().encode()).hexdigest()

def same_instance(port):
    try:
        with urlopen(f'http://127.0.0.1:{port}/api/app',timeout=.3) as response:value=json.load(response)
        return value.get('application')=='BIM2STEIGER' and value.get('project_id')==PROJECT_ID
    except (OSError,ValueError):return False
class Handler(BaseHTTPRequestHandler):
    def log_message(self,fmt,*args):pass
    def send_bytes(self,data,content_type,cache=None):
        headers={}
        if cache:headers['Cache-Control']=cache
        if len(data)>4096 and not content_type.startswith('application/pdf') and 'gzip' in (self.headers.get('Accept-Encoding') or ''):
            data=gzip.compress(data,compresslevel=5);headers['Content-Encoding']='gzip'
        self.send_response(200)
        self.send_header('Content-Type',content_type);self.send_header('Content-Length',str(len(data)));self.send_header('X-Content-Type-Options','nosniff')
        for key,value in headers.items():self.send_header(key,value)
        self.end_headers();self.wfile.write(data)
        try:self.wfile.flush()
        except Exception:pass
    def send_json(self,value,status=200):
        data=json.dumps(value,ensure_ascii=False,allow_nan=False).encode('utf-8')
        if status!=200 or len(data)<=4096 or 'gzip' not in (self.headers.get('Accept-Encoding') or ''):
            self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Content-Length',str(len(data)));self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.end_headers();self.wfile.write(data)
            try:self.wfile.flush()
            except Exception:pass
            return
        self.send_bytes(data,'application/json; charset=utf-8','no-store')
    def do_GET(self):
        u=urlparse(self.path);q=parse_qs(u.query)
        try:
            if u.path=='/api/app':return self.send_json({'application':'BIM2STEIGER','project_id':PROJECT_ID,'start_page':'/bim2steiger.html','version':UPDATES.version})
            if u.path=='/api/updates':return self.send_json(UPDATES.public())
            if u.path=='/api/source-status':
                folder=ROOT/'data/portal_capture'
                plan=json.loads((folder/'plan.json').read_text(encoding='utf8')) if (folder/'plan.json').exists() else []
                details_plan=json.loads((folder/'details-plan.json').read_text(encoding='utf8')) if (folder/'details-plan.json').exists() else []
                images=json.loads((ROOT/'web/images/inventory.json').read_text(encoding='utf8'))
                pages=len(list((folder/'pages').glob('*.json')));details=len(list((folder/'details').glob('*.json')))
                planned_details=sum(len(p['targets']) for p in details_plan)
                return self.send_json({'year':2026,'catalogue_pages':pages,'planned_catalogue_pages':len(plan),'detail_variants':details,'planned_detail_variants':planned_details,'media_articles':len({i['number'] for i in images}),'media_files':len({i['file'] for i in images}),'catalogue_previews_complete':bool(plan) and pages==len(plan),'details_complete':bool(planned_details) and details==planned_details,'source':'https://digital.asteigerag.ch/dashboard'})
            if u.path=='/api/meta':
                meta=CAT.metadata();meta['editions']=catalogue_editions(meta.get('year') or 2026);return self.send_json(meta)
            if u.path=='/api/catalogue':return self.send_json(CAT.navigation)
            if u.path=='/api/search':return self.send_json(CAT.search(q.get('q',[''])[0],q.get('kind',['all'])[0],int(q.get('limit',['60'])[0]),q.get('va',[''])[0]))
            if u.path=='/api/article':return self.send_json(CAT.article(q.get('number',[''])[0],q.get('va',[None])[0],q.get('recipe',[None])[0]))
            if u.path=='/api/expand':return self.send_json(CAT.expand(q.get('number',[''])[0],q.get('va',[''])[0],q.get('quantity',['1'])[0],q.get('recipe',[None])[0]))
            if u.path.startswith('/api/'):return self.send_json({'error':'Unbekannte Schnittstelle'},404)
            relative=unquote(u.path).lstrip('/') or 'index.html'
            base=(ROOT/'web').resolve();path=(base/relative).resolve()
            if not path.is_relative_to(base) or not path.is_file():return self.send_json({'error':'Datei nicht gefunden'},404)
            data=path.read_bytes();kind=(mimetypes.guess_type(path)[0] or 'application/octet-stream')+('; charset=utf-8' if path.suffix in ['.html','.js','.css','.json'] else '')
            cache='public, max-age=604800' if path.suffix.lower() in {'.png','.jpg','.jpeg','.webp','.gif'} else None
            self.send_bytes(data,kind,cache)
        except (ValueError,KeyError) as e:self.send_json({'error':str(e)},400)
        except Exception:self.send_json({'error':'Katalog konnte nicht gelesen werden. Datenbank und Startordner prüfen.'},500)
    def do_POST(self):
        try:
            if self.path.startswith('/api/updates/'):
                port=self.server.server_address[1]
                hosts={f'127.0.0.1:{port}',f'localhost:{port}'}
                origin=self.headers.get('Origin')
                if self.headers.get('Host') not in hosts or (origin and origin not in {'http://'+host for host in hosts}) or not hmac.compare_digest(self.headers.get('X-BIM2STEIGER-Update',''),UPDATES.session_key):
                    return self.send_json({'error':'Updateaktion bitte direkt in BIM2STEIGER ausführen.'},403)
            length=int(self.headers.get('Content-Length',0))
            if length<=0 or length>MAX_IMPORT_BODY:return self.send_json({'error':'Die Datei ist zu gross. Nova- und IFC-Dateien bis 250 MB sind möglich.'},413)
            body=json.loads(self.rfile.read(length))
            if self.path=='/api/updates/check':return self.send_json(UPDATES.check())
            if self.path=='/api/updates/install':
                result=UPDATES.install();self.send_json(result)
                threading.Timer(0.4,quit_program).start();return
            if self.path=='/api/import':
                if body.get('content_base64'):
                    try:payload=base64.b64decode(body['content_base64'],validate=True)
                    except (binascii.Error,ValueError) as exc:raise ValueError('Die Datei konnte nicht gelesen werden.') from exc
                else:payload=body.get('text','')
                elements,warnings=import_model(body.get('filename',''),payload)
                return self.send_json({'elements':elements,'warnings':warnings})
            if self.path=='/api/tender/aggregate':return self.send_json({'lines':aggregate_tender(body['lines'])})
            if self.path=='/api/rules/match':return self.send_json(match_assignments(body.get('elements') or [],body.get('rules') or [],CAT))
            if self.path=='/api/tender/elda':
                payload,warnings=export_messerli(body.get('lines') or [],project=body.get('project') or '',chapter_titles=titles_from_navigation(CAT.navigation),catalogue_year=body.get('catalogue_year') or 2026,outline=body.get('outline') or [])
                return self.send_json({'content_base64':base64.b64encode(payload).decode('ascii'),'warnings':warnings,'encoding':'cp850'})
            return self.send_json({'error':'Unbekannte Schnittstelle'},404)
        except (ValueError,KeyError,TypeError) as e:self.send_json({'error':str(e)},400)
        except Exception:self.send_json({'error':'Import konnte nicht verarbeitet werden'},500)
def window_failure_message(exc):
    detail=str(exc).strip()
    if getattr(sys,'frozen',False):
        text=('BIM2STEIGER konnte das eigene Fenster nicht öffnen.\n'
              'Der Browser wird nicht geöffnet.\n\n'
              'Auf diesem PC wird Microsoft Edge WebView2 benötigt. '
              'Ist Edge installiert, ist die Laufzeit meist schon da. '
              'Sonst die WebView2-Laufzeit installieren und BIM2STEIGER neu starten:\n'
              'https://go.microsoft.com/fwlink/p/?LinkId=2124703')
    else:
        text=('BIM2STEIGER öffnet ein eigenes Fenster, nicht den Browser.\n'
              'Dafür fehlt pywebview, oder das Fenster liess sich nicht starten.\n\n'
              'pip install pywebview\n\n'
              'Nur zum Prüfen im Browser: python server.py --open --browser')
    return text+('\n\n'+detail if detail else '')
_instance_mutex=None
def hold_install_mutex():
    """Let the setup see that this program still has its files open."""
    global _instance_mutex
    if sys.platform!='win32':return
    import ctypes
    _instance_mutex=ctypes.windll.kernel32.CreateMutexW(None,False,'BIM2STEIGER-Instance')
def end_process(*_args):
    """Release the program files. A closed window must not stay in Task Manager."""
    os._exit(0)
def bind_window_exit(window):
    window.events.closed += end_process
def quit_program():
    """End this process so the waiting setup can open without the still-running notice."""
    end_process()
def show_program(url):
    """Open BIM2STEIGER in its own window. Never falls back to the system browser."""
    show_program.last_error=None
    deadline=time.time()+8
    probe=url.split('/bim2steiger.html',1)[0]+'/api/app'
    while time.time()<deadline:
        try:
            with urlopen(probe,timeout=1):break
        except OSError:time.sleep(.1)
    try:
        import webview
    except Exception as exc:
        show_program.last_error=exc;return False
    try:
        webview.settings['ALLOW_DOWNLOADS']=True
        options=dict(width=1400,height=900,min_size=(960,640),background_color='#F5F7FA')
        icon=ROOT/'packaging'/'app.ico'
        if icon.is_file() and 'icon' in inspect.signature(webview.create_window).parameters:
            options['icon']=str(icon)
        window=webview.create_window('BIM2STEIGER',url,**options)
        try:bind_window_exit(window)
        except Exception:pass
        webview.start()
        end_process()
        return True
    except Exception as exc:
        show_program.last_error=exc;return False
def main(argv=None):
    arguments=list(sys.argv[1:] if argv is None else argv)
    parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=8765);parser.add_argument('--open',action='store_true');parser.add_argument('--browser',action='store_true');args=parser.parse_args(arguments)
    explicit_port=any(argument=='--port' or argument.startswith('--port=') for argument in arguments)
    interactive=args.open or args.browser or (getattr(sys,'frozen',False) and not explicit_port)
    def fail(message):
        if sys.platform=='win32' and getattr(sys,'frozen',False):
            import ctypes;ctypes.windll.user32.MessageBoxW(0,message,'BIM2STEIGER',0x10)
        sys.exit(message)
    def open_ui(url):
        if args.browser:webbrowser.open(url);return
        if not show_program(url):fail(window_failure_message(show_program.last_error))
    hold_install_mutex()
    if not (ROOT/'data/catalogue.sqlite').exists():fail('Katalogdaten fehlen: data/catalogue.sqlite')
    def warm_catalogue():
        try:CAT.navigation;CAT.identifier_search
        except Exception:pass
    threading.Thread(target=warm_catalogue,daemon=True).start()
    if interactive and not explicit_port:
        existing=next((port for port in range(8765,8781) if same_instance(port)),None)
        if existing is not None:open_ui(f'http://127.0.0.1:{existing}/bim2steiger.html');return
    ports=range(8765,8781) if interactive and not explicit_port else [args.port]
    server=None
    for port in ports:
        try:server=ThreadingHTTPServer(('127.0.0.1',port),Handler);args.port=port;break
        except OSError:continue
    if server is None:fail('Kein freier lokaler Port. Einen anderen Port wählen oder die laufende Anwendung öffnen.')
    page=f'http://127.0.0.1:{args.port}/bim2steiger.html'
    print(f'BIM2STEIGER: {page} (Beenden mit Strg+C)',flush=True)
    if interactive:
        threading.Thread(target=server.serve_forever,daemon=True).start()
        try:open_ui(page)
        finally:server.shutdown();server.server_close()
        return
    try:server.serve_forever()
    except KeyboardInterrupt:pass
    finally:server.server_close()
if __name__=='__main__':main()
