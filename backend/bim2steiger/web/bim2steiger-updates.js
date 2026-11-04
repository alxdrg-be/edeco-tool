'use strict';
(() => {
  if(location.protocol==='file:')return;
  const byId=id=>document.getElementById(id);
  let snapshot=null,busy=false;
  let automatic=true;try{automatic=JSON.parse(localStorage.getItem('bim2steiger:updates:v1')||'{}').automatic!==false;}catch{}
  const automaticInput=byId('autoCheckUpdates');automaticInput.checked=automatic;
  automaticInput.onchange=()=>{automatic=automaticInput.checked;try{localStorage.setItem('bim2steiger:updates:v1',JSON.stringify({automatic}));}catch{}};
  const footer=document.createElement('button');footer.className='version-button';footer.type='button';footer.id='versionStatus';footer.textContent='Version und Updates';
  document.querySelector('.footer').append(footer);
  const label=version=>version.version+(version.build?' · Build '+version.build:' · Entwicklungsstand');
  const request=async(path,post=false)=>{
    const response=await fetch(localUrl(path),post?{method:'POST',headers:{'Content-Type':'application/json','X-BIM2STEIGER-Update':snapshot.session_key},body:'{}'}:{});
    const result=await response.json();if(!response.ok)throw Error(result.error||'Updateanfrage fehlgeschlagen.');return result;
  };
  const statusLabel={available:'Verfügbar',current:'Aktuell',unchecked:'Offen',unavailable:'Nicht möglich',installer_started:'Installation',checking:'Prüfung'};
  function markStatus(status){
    const card=byId('updateStatusCard');if(card)card.dataset.status=status||'unchecked';
    const pill=byId('updatePill');if(pill)pill.textContent=statusLabel[status]||'Updates';
  }
  function paint(data){
    snapshot=data;markStatus(data.status);if(data.managed_by_toolbox){automatic=false;automaticInput.checked=false;automaticInput.disabled=true;byId('checkUpdates').disabled=true;document.querySelectorAll('#settingsDialog a[href*="releases"]').forEach(a=>a.hidden=true);}byId('installedVersion').textContent='BIM2STEIGER '+label(data.current);
    byId('runtimeVersion').textContent=data.installed?'Installierte Windows-Version':'Lokaler Quellcode-Start';
    byId('updateResult').textContent=data.message+(data.status==='available'?' '+data.latest.tag:'');
    byId('updateCheckedAt').textContent=data.checked_at?'Zuletzt geprüft: '+new Date(data.checked_at).toLocaleString('de-CH'):'';
    byId('installUpdate').hidden=!data.can_install;byId('installUpdate').disabled=busy;
    byId('updateInstallHint').textContent=!data.installed?'Dieser Quellcode-Ordner wird nicht vom Setup überschrieben. Für die installierte Anwendung das Windows-Setup auf GitHub verwenden.':data.can_install?'Das Setup wird heruntergeladen und vor dem Start anhand seiner SHA-256-Prüfsumme geprüft. BIM2STEIGER schliesst sich zuerst. Danach öffnet sich der Assistent.':'';
    if(data.managed_by_toolbox){byId('updateInstallHint').textContent='Einzelprogramm-Updates sind innerhalb des Toolhubs deaktiviert.';byId('settingsDialog').querySelector('.settings-note').textContent='Updates werden gemeinsam für alle Werkzeuge bereitgestellt.';}
    footer.textContent='BIM2STEIGER '+label(data.current)+' · '+({available:'Update verfügbar',current:'Aktuell',unchecked:'Updates ansehen',unavailable:'Updateprüfung nicht möglich',installer_started:'Installation geöffnet'}[data.status]||'Updates');
    byId('updateNotice').hidden=!['available','unavailable','installer_started'].includes(data.status);
    byId('updateNoticeText').textContent=data.status==='available'?'Neue Programmversion verfügbar: '+data.latest.tag:data.message;
  }
  async function check(){
    if(busy)return;busy=true;byId('checkUpdates').disabled=true;byId('installUpdate').disabled=true;markStatus('checking');byId('updateResult').textContent='GitHub wird auf neue Programmversionen geprüft …';
    try{if(!snapshot)snapshot=await request('/api/updates');paint(await request('/api/updates/check',true));}
    catch(error){markStatus('unavailable');byId('updateResult').textContent=error.message;footer.textContent='Version und Updates · Prüfung fehlgeschlagen';}
    finally{busy=false;byId('checkUpdates').disabled=false;byId('installUpdate').disabled=false;}
  }
  async function open(){
    if(!byId('settingsDialog').open)byId('settingsDialog').showModal();
    try{paint(await request('/api/updates'));}catch{byId('updateResult').textContent='Für Einstellungen und Updates bitte den lokalen Server neu starten.';}
    try{const response=await fetch(localUrl('/api/source-status')),data=await response.json();if(!response.ok)throw Error();
      byId('settingsDataStatus').textContent=data.media_articles.toLocaleString('de-CH')+' Artikel mit Originalabbildung. '+data.detail_variants.toLocaleString('de-CH')+' von '+data.planned_detail_variants.toLocaleString('de-CH')+' zusätzlichen Artikel-/VA-Quellen erfasst. '+(data.details_complete?'Grunddatenerfassung abgeschlossen.':'Weitere Grunddatenbilder fehlen noch.');
    }catch{byId('settingsDataStatus').textContent='Datenstand derzeit nicht erreichbar.';}
  }
  document.querySelectorAll('[data-open-settings]').forEach(button=>button.addEventListener('click',open));footer.onclick=open;
  byId('checkUpdates').onclick=check;
  byId('settingsOpenSources').onclick=()=>{byId('settingsDialog').close();byId('openSourceStatus').click();};
  byId('installUpdate').onclick=async()=>{
    if(busy||!snapshot?.can_install)return;busy=true;byId('installUpdate').disabled=true;byId('checkUpdates').disabled=true;byId('updateResult').textContent='Update wird heruntergeladen und geprüft …';
    try{paint(await request('/api/updates/install',true));}
    catch(error){byId('updateResult').textContent=error.message;}
    finally{busy=false;byId('installUpdate').disabled=false;byId('checkUpdates').disabled=false;}
  };
  request('/api/updates').then(data=>{paint(data);if(automatic&&!data.managed_by_toolbox&&(!data.checked_at||Date.now()-Date.parse(data.checked_at)>300000))check();}).catch(()=>{footer.textContent='Einstellungen · Server neu starten';});
})();
