"""Updates from this project's GitHub releases; credentials stay in memory."""
import hashlib,hmac,json,os,re,secrets,shutil,subprocess,sys,tempfile,threading
from datetime import datetime,timezone
from pathlib import Path
from urllib.error import HTTPError,URLError
from urllib.parse import urlparse
from urllib.request import Request,HTTPRedirectHandler,build_opener

REPOSITORY='Dobolino/BIM2STEIGER'
RELEASES_URL='https://github.com/'+REPOSITORY+'/releases/latest'
API='https://api.github.com/repos/'+REPOSITORY
ASSET_NAME=re.compile(r'(?:BIM2STEIGER|Steiger2Bim)-Setup-\d+\.\d+\.\d+\.exe')

def version_key(value):
    match=re.fullmatch(r'v?(\d+)\.(\d+)\.(\d+)(?:-build\.(\d+))?',value or '')
    if not match:raise ValueError('Unbekannte Versionskennung')
    return tuple(int(part or 0) for part in match.groups())

class ReleaseRedirect(HTTPRedirectHandler):
    def redirect_request(self,request,fp,code,msg,headers,newurl):
        parsed=urlparse(newurl)
        if parsed.scheme!='https' or parsed.hostname not in ('api.github.com','github.com','release-assets.githubusercontent.com','objects.githubusercontent.com'):
            raise ValueError('Unbekanntes Downloadziel')
        redirected=super().redirect_request(request,fp,code,msg,headers,newurl)
        if redirected and parsed.hostname!='api.github.com':redirected.remove_header('Authorization')
        return redirected

def github_credential():
    """Use an existing GitHub sign-in, without prompting or saving a new token."""
    git=shutil.which('git')
    if not git:return None
    environment={**os.environ,'GIT_TERMINAL_PROMPT':'0','GCM_INTERACTIVE':'never'}
    try:
        result=subprocess.run([git,'credential','fill'],input='protocol=https\nhost=github.com\npath='+REPOSITORY+'.git\n\n',
                              capture_output=True,text=True,timeout=5,env=environment,
                              creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
        fields=dict(line.split('=',1) for line in result.stdout.splitlines() if '=' in line)
        return fields.get('password') if result.returncode==0 else None
    except (OSError,subprocess.TimeoutExpired):return None

def _shell_execute(command,folder,show=1):
    """Open a program through the Windows shell so it is not a child of this process."""
    import ctypes
    parameters=' '.join(f'"{part}"' if any(mark in str(part) for mark in ' \t"') else str(part) for part in command[1:])
    started=ctypes.windll.shell32.ShellExecuteW(None,'open',str(command[0]),parameters,str(folder),show)
    return started>32
def _waiter_command(pid,target,folder):
    """Start the setup only after this process has released the install mutex."""
    quote=lambda value:"'"+str(value).replace("'","''")+"'"
    script=(f"Wait-Process -Id {int(pid)} -ErrorAction SilentlyContinue; "
            f"Start-Process -FilePath {quote(target)} -ArgumentList '/FORCECLOSEAPPLICATIONS','/NORESTARTAPPLICATIONS' "
            f"-WorkingDirectory {quote(folder)}")
    return ['powershell.exe','-NoProfile','-WindowStyle','Hidden','-Command',script]
def launch_setup(target,folder):
    """Start the checked setup outside this process so it can replace the program files."""
    if sys.platform!='win32':
        subprocess.Popen([str(target),'/FORCECLOSEAPPLICATIONS','/NORESTARTAPPLICATIONS'],cwd=folder)
        return
    command=_waiter_command(os.getpid(),target,folder)
    try:
        if _shell_execute(command,folder,0):return
    except Exception:pass
    # DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP | CREATE_BREAKAWAY_FROM_JOB
    subprocess.Popen(command,cwd=folder,creationflags=0x00000008|0x00000200|0x01000000)
def download_verified(response,target,expected,size):
    digest=hashlib.sha256();written=0;created=False
    try:
        with target.open('xb') as stream:
            created=True
            while chunk:=response.read(1024*1024):
                written+=len(chunk)
                if written>size or written>512*1024*1024:raise ValueError('Download ist grösser als angekündigt')
                digest.update(chunk);stream.write(chunk)
        if written!=size or not hmac.compare_digest(digest.hexdigest(),expected):
            raise ValueError('Die Prüfsumme des Setups stimmt nicht. Installation abgebrochen.')
    except Exception:
        if created:target.unlink(missing_ok=True)
        raise

class UpdateManager:
    def __init__(self,root):
        self.root=Path(root);self.session_key=secrets.token_urlsafe(32);self.lock=threading.Lock()
        self.version=json.loads((self.root/'version.json').read_text(encoding='utf8'))
        self.installed=bool(getattr(sys,'frozen',False));self.asset=None;self.token=None
        self.state={'status':'unchecked','message':'Noch nicht geprüft.','checked_at':None}
    def public(self):
        return {**self.state,'current':self.version,'installed':self.installed,'release_url':RELEASES_URL,
                'session_key':self.session_key,'can_install':bool(self.installed and sys.platform=='win32' and self.asset and self.state['status']=='available')}
    def _request(self,url,binary=False):
        if not url.startswith(API+'/releases'):raise ValueError('Unbekannte Updatequelle')
        headers={'Accept':'application/octet-stream' if binary else 'application/vnd.github+json',
                 'User-Agent':'BIM2STEIGER-Updater','X-GitHub-Api-Version':'2022-11-28'}
        if self.token:headers['Authorization']='Bearer '+self.token
        return build_opener(ReleaseRedirect()).open(Request(url,headers=headers),timeout=20)
    def _fetch_latest(self):
        with self._request(API+'/releases/latest') as response:
            content=response.read(2_000_001)
            if len(content)>2_000_000:raise ValueError('Updateantwort ist zu gross')
            return json.loads(content)
    def _apply_release(self,release):
        tag=release['tag_name'];latest=version_key(tag)
        current=version_key(self.version['version']+'-build.'+str(self.version.get('build',0)))
        self.asset=None
        if release.get('draft') or release.get('prerelease'):raise ValueError('Kein freigegebener Build')
        url=release.get('html_url','')
        if not url.startswith('https://github.com/'+REPOSITORY+'/releases/tag/'):raise ValueError('Unbekannte Releasequelle')
        state={'latest':{'tag':tag,'name':str(release.get('name') or tag),'url':url},'status':'available' if latest>current else 'current',
               'message':'Ein Update ist verfügbar.' if latest>current else 'Kein neueres veröffentlichtes Update vorhanden.'}
        candidates=[a for a in release.get('assets',[]) if ASSET_NAME.fullmatch(a.get('name','')) and a.get('state')=='uploaded']
        if len(candidates)==1:
            candidate=candidates[0];digest=re.fullmatch(r'sha256:([a-f0-9]{64})',candidate.get('digest') or '')
            if digest and re.fullmatch(re.escape(API)+r'/releases/assets/\d+',candidate.get('url','')) and 0<candidate.get('size',0)<=512*1024*1024:
                self.asset={**candidate,'expected_sha256':digest[1]}
        if state['status']=='available' and not self.asset:state['message']='Update verfügbar. Bitte das Setup auf der Release-Seite öffnen; eine eindeutige geprüfte Setupdatei fehlt.'
        return state
    def check(self):
        if self.state['status']=='installer_started':return self.public()
        if not self.lock.acquire(blocking=False):raise ValueError('Eine Updateaktion läuft bereits.')
        try:
            self.token=github_credential()
            try:self.state=self._apply_release(self._fetch_latest())
            except HTTPError as error:
                self.asset=None
                message='Das private GitHub-Repository ist hier nicht angemeldet. Bitte die Release-Seite im Browser öffnen.' if error.code in (401,403,404) else 'GitHub konnte gerade nicht geprüft werden. Später erneut versuchen.'
                self.state={'status':'unavailable','message':message}
            except (URLError,OSError,ValueError,KeyError,TypeError):
                self.asset=None;self.state={'status':'unavailable','message':'Updateprüfung nicht erreichbar. Internetverbindung prüfen oder die Release-Seite öffnen.'}
            self.state['checked_at']=datetime.now(timezone.utc).isoformat()
            return self.public()
        finally:self.lock.release()
    def install(self):
        if not self.installed or sys.platform!='win32':raise ValueError('Dieser Quellcode-Start wird nicht überschrieben. Für Programmupdates die installierte Windows-Version verwenden.')
        if not self.lock.acquire(blocking=False):raise ValueError('Eine Updateaktion läuft bereits.')
        try:
            if not self.asset or self.state['status']!='available':raise ValueError('Zuerst ein verfügbares Update prüfen.')
            # The caller cannot supply a path, URL or command. Only this checked release is used.
            asset=dict(self.asset);folder=Path(tempfile.mkdtemp(prefix='BIM2STEIGER-Update-'));target=folder/asset['name']
            with self._request(asset['url'],binary=True) as response:
                download_verified(response,target,asset['expected_sha256'],asset['size'])
            launch_setup(target,folder)
            self.state={**self.state,'status':'installer_started','message':'BIM2STEIGER schliesst sich. Der Installationsassistent öffnet sich danach.'}
            return self.public()
        finally:self.lock.release()
