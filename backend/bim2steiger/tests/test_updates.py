import hashlib,io,json,os,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request
from updates import API,ASSET_NAME,UpdateManager,ReleaseRedirect,download_verified,version_key

def release(tag='v0.3.1-build.7'):
    return {'tag_name':tag,'html_url':'https://github.com/Dobolino/BIM2STEIGER/releases/tag/'+tag,
            'assets':[{'name':'BIM2STEIGER-Setup-0.3.1.exe','url':API+'/releases/assets/123','state':'uploaded','digest':'sha256:'+'a'*64,'size':20}]}

class InstallerScriptTests(unittest.TestCase):
    def test_uninstall_is_not_blocked_by_a_running_program_mutex(self):
        script=(Path(__file__).resolve().parents[1]/'packaging'/'setup.iss').read_text(encoding='utf-8')
        self.assertNotIn('AppMutex',script)
        self.assertIn('CloseApplications=force',script)
        self.assertIn('{uninstallexe}',script)
        self.assertIn('ForgetMissingInstallation',script)
        self.assertIn('{B4E8A1C2-6D30-4F77-9A12-8C5E2B7D4A90}_is1',script)
        self.assertIn('DefaultDirName={localappdata}\\Programs\\BIM2STEIGER',script)
        self.assertIn('BIM2STEIGER.exe',script)
        self.assertIn('BIM2STEIGER-Setup-',script)
        self.assertIsNotNone(ASSET_NAME.fullmatch('BIM2STEIGER-Setup-0.3.1.exe'))
        self.assertIsNotNone(ASSET_NAME.fullmatch('Steiger2Bim-Setup-0.3.1.exe'))

class UpdateTests(unittest.TestCase):
    def setUp(self):
        self.base=Path(__file__).resolve().parents[1]/'.work/test-updates';self.base.mkdir(parents=True,exist_ok=True)
        self.directory=tempfile.TemporaryDirectory(dir=self.base);self.root=Path(self.directory.name).resolve()
        (self.root/'version.json').write_text(json.dumps({'version':'0.3.0','build':6}))
        self.manager=UpdateManager(self.root)
    def tearDown(self):
        self.assertTrue(self.root.is_relative_to(self.base.resolve()));self.directory.cleanup()
    def test_versions_compare_patch_and_build_numerically(self):
        self.assertGreater(version_key('v0.3.1-build.7'),version_key('v0.3.0-build.60'))
        self.assertGreater(version_key('v0.3.0-build.10'),version_key('v0.3.0-build.9'))
        with self.assertRaises(ValueError):version_key('../../setup.exe')
    def test_new_release_requires_a_single_known_asset_with_digest(self):
        self.assertEqual(self.manager._apply_release(release())['status'],'available')
        self.assertIsNotNone(self.manager.asset)
        r=release();r['assets'][0]['url']='https://example.com/installer.exe'
        self.manager._apply_release(r);self.assertIsNone(self.manager.asset)
        r=release();r['assets'][0]['digest']=None
        self.manager._apply_release(r);self.assertIsNone(self.manager.asset)
    def test_old_or_same_version_is_not_an_update(self):
        for tag in ('v0.3.0-build.6','v0.2.9-build.100'):
            self.assertEqual(self.manager._apply_release(release(tag))['status'],'current')
    def test_private_repository_without_login_is_reported_honestly(self):
        with patch('updates.github_credential',return_value=None),patch.object(self.manager,'_fetch_latest',side_effect=HTTPError(API,404,'Not Found',None,None)):
            result=self.manager.check()
        self.assertEqual(result['status'],'unavailable');self.assertFalse(result['can_install'])
        self.assertIn('privat',result['message']);self.assertNotIn('token',json.dumps(result))
    def test_source_checkout_cannot_be_overwritten_by_installer(self):
        self.manager.installed=False
        with self.assertRaisesRegex(ValueError,'Quellcode'):
            self.manager.install()
    def test_download_must_match_hash_and_size_before_execution(self):
        data=b'original setup bytes';expected=hashlib.sha256(data).hexdigest();target=self.root/'setup.exe'
        download_verified(io.BytesIO(data),target,expected,len(data));self.assertEqual(target.read_bytes(),data)
        target.unlink()
        with self.assertRaisesRegex(ValueError,'Prüfsumme'):
            download_verified(io.BytesIO(data),target,'0'*64,len(data))
        self.assertFalse(target.exists())
        with self.assertRaises(ValueError):download_verified(io.BytesIO(data),target,expected,len(data)-1)
        self.assertFalse(target.exists())
    def test_existing_file_is_not_deleted_on_download_collision(self):
        target=self.root/'setup.exe';target.write_bytes(b'existing')
        with self.assertRaises(FileExistsError):download_verified(io.BytesIO(b'new'),target,'0'*64,3)
        self.assertEqual(target.read_bytes(),b'existing')
    def test_redirect_does_not_forward_github_credentials_to_asset_host(self):
        request=Request(API+'/releases/assets/123',headers={'Authorization':'Bearer test-only'})
        redirect=ReleaseRedirect().redirect_request(request,None,302,'Found',{},'https://release-assets.githubusercontent.com/file')
        self.assertIsNone(redirect.get_header('Authorization'))
        with self.assertRaises(ValueError):ReleaseRedirect().redirect_request(request,None,302,'Found',{},'https://example.com/file')

    def test_installer_starts_only_after_a_verified_download_and_only_once(self):
        data=b'verified installer';r=release();r['assets'][0].update(size=len(data),digest='sha256:'+hashlib.sha256(data).hexdigest())
        self.manager.state=self.manager._apply_release(r);self.manager.installed=True;folder=self.root/'installer';folder.mkdir()
        with patch('updates.sys.platform','win32'),patch('updates.tempfile.mkdtemp',return_value=str(folder)),patch.object(self.manager,'_request',return_value=io.BytesIO(data)),patch('updates._shell_execute',return_value=False),patch('updates.subprocess.Popen') as start:
            result=self.manager.install();self.assertEqual(result['status'],'installer_started');start.assert_called_once()
            command=start.call_args.args[0];script=command[-1]
            setup=next(folder.glob('*.exe'));self.assertEqual(setup.read_bytes(),data)
            self.assertEqual(command[0],'powershell.exe')
            self.assertIn(f'Wait-Process -Id {os.getpid()}',script)
            self.assertIn(str(setup),script)
            self.assertIn('/FORCECLOSEAPPLICATIONS',script)
            self.assertIn('/NORESTARTAPPLICATIONS',script)
            with self.assertRaises(ValueError):self.manager.install()
            self.assertEqual(self.manager.check()['status'],'installer_started')
            start.assert_called_once()

    def test_tampered_installer_is_never_executed(self):
        r=release();self.manager.state=self.manager._apply_release(r);self.manager.installed=True;folder=self.root/'tampered';folder.mkdir()
        with patch('updates.sys.platform','win32'),patch('updates.tempfile.mkdtemp',return_value=str(folder)),patch.object(self.manager,'_request',return_value=io.BytesIO(b'x'*20)),patch('updates.subprocess.Popen') as start:
            with self.assertRaisesRegex(ValueError,'Prüfsumme'):self.manager.install()
            start.assert_not_called()

class UpdateEndpointTests(unittest.TestCase):
    def test_install_rejects_external_origin_and_wrong_nonce(self):
        import server
        from types import SimpleNamespace
        for origin,nonce in [('https://example.com',server.UPDATES.session_key),('http://127.0.0.1:8765','wrong')]:
            handler=object.__new__(server.Handler);handler.path='/api/updates/install'
            handler.server=SimpleNamespace(server_address=('127.0.0.1',8765))
            handler.headers={'Host':'127.0.0.1:8765','Origin':origin,'X-BIM2STEIGER-Update':nonce}
            results=[];handler.send_json=lambda value,status=200:results.append((value,status))
            with patch.object(server.UPDATES,'install') as install:
                handler.do_POST();install.assert_not_called()
            self.assertEqual(results[0][1],403)

class StartupTests(unittest.TestCase):
    def test_closing_the_window_ends_the_process(self):
        import server
        class Event:
            def __init__(self):self.handlers=[]
            def __iadd__(self,handler):self.handlers.append(handler);return self
        event=Event();window=type('Window',(),{'events':type('Events',(),{'closed':event})()})()
        server.bind_window_exit(window)
        with patch('server.os._exit') as stop:
            event.handlers[0]();stop.assert_called_once_with(0)
    def test_reopening_installed_app_reuses_its_existing_server(self):
        import server
        with patch.object(server.sys,'frozen',True,create=True),patch.object(server,'same_instance',side_effect=lambda port:port==8767),patch.object(server,'ThreadingHTTPServer') as create,patch.object(server,'show_program',return_value=True) as window,patch.object(server.webbrowser,'open') as browser:
            server.main([]);create.assert_not_called();browser.assert_not_called();window.assert_called_once_with('http://127.0.0.1:8767/bim2steiger.html')
    def test_installed_app_uses_free_port_when_source_app_is_running(self):
        import server
        from unittest.mock import Mock
        http=Mock()
        with patch.object(server.sys,'frozen',True,create=True),patch.object(server,'same_instance',return_value=False),patch.object(server,'ThreadingHTTPServer',side_effect=[OSError('busy'),http]) as create,patch.object(server,'show_program',return_value=True) as window,patch.object(server.webbrowser,'open') as browser:
            server.main([]);self.assertEqual(create.call_args.args[0],('127.0.0.1',8766));browser.assert_not_called();window.assert_called_once_with('http://127.0.0.1:8766/bim2steiger.html')
    def test_explicit_build_smoke_test_port_opens_no_browser(self):
        import server
        with patch.object(server.sys,'frozen',True,create=True),patch.object(server,'same_instance') as find,patch.object(server,'ThreadingHTTPServer') as create,patch.object(server,'show_program') as window,patch.object(server.webbrowser,'open') as browser:
            server.main(['--port','8799']);find.assert_not_called();browser.assert_not_called();window.assert_not_called();self.assertEqual(create.call_args.args[0],('127.0.0.1',8799))
    def test_browser_flag_is_the_only_way_to_open_the_system_browser(self):
        import server
        with patch.object(server.sys,'frozen',True,create=True),patch.object(server,'same_instance',side_effect=lambda port:port==8767),patch.object(server,'ThreadingHTTPServer'),patch.object(server,'show_program') as window,patch.object(server.webbrowser,'open') as browser:
            server.main(['--browser']);window.assert_not_called();browser.assert_called_once_with('http://127.0.0.1:8767/bim2steiger.html')
