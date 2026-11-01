import { useEffect, useRef, useState } from "react";
import { useDialogFocus } from "../../useDialogFocus";
import { request, type DocumentInfo } from "./api";
import SetupGuide from "./SetupGuide";
interface Folder { path: string; recursive: boolean; linked_files: number; last_sync?: string | null }
export default function FolderSettings({ sessionKey, onDocuments, onClose }: {sessionKey: string; onDocuments: (documents: DocumentInfo[])=>void; onClose: ()=>void}) {
  const ref=useRef<HTMLDivElement>(null), [folder,setFolder]=useState<Folder|null>(null), [path,setPath]=useState(""), [recursive,setRecursive]=useState(true), [busy,setBusy]=useState(false), [error,setError]=useState(""), [notice,setNotice]=useState("");
  useDialogFocus(ref,()=>{if(!busy)onClose();});
  useEffect(()=>{let alive=true;request<Folder>("/folder",sessionKey).then(data=>{if(alive){setFolder(data);setPath(data.path);setRecursive(data.recursive);}}).catch(e=>{if(alive)setError(String(e));});return()=>{alive=false;};},[sessionKey]);
  async function sync(save: boolean) {
    setBusy(true);setError("");setNotice("");
    try {
      if(save){const data=await request<Folder>("/folder",sessionKey,{method:"POST",body:JSON.stringify({path,recursive})});setFolder(data);setPath(data.path);}
      const data=await request<{folder:Folder;documents:DocumentInfo[];added:number;unchanged:number;removed:number;errors:string[]}>("/folder/sync",sessionKey,{method:"POST"});
      setFolder(data.folder);onDocuments(data.documents);setNotice(`${data.added} neu/aktualisiert · ${data.unchanged} unverändert · ${data.removed} alte lokale Kopien entfernt.${data.errors.length ? " Hinweise: "+data.errors.join(" · ") : ""}`);
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function disconnect(){setBusy(true);setError("");try{const data=await request<Folder>("/folder",sessionKey,{method:"POST",body:JSON.stringify({path:"",recursive:true})});setFolder(data);setPath("");setNotice("Ordner getrennt. Die vorhandenen lokalen Kopien bleiben erhalten.");}catch(e){setError(String(e));}finally{setBusy(false);}}
  return <div className="modal-back"><div ref={ref} className="modal doc-ai-settings" role="dialog" aria-modal="true" aria-labelledby="doc-folder-title" tabIndex={-1}>
    <h2 id="doc-folder-title">Dokumentordner verbinden</h2><p>Serverdateien werden nur gelesen. Bei „Jetzt aktualisieren“ werden verwaltete lokale Kopien an den Ordnerstand angepasst; entfernte Dateien verschwinden dabei aus dem verwalteten lokalen Index.</p>
    <form onSubmit={event=>{event.preventDefault();void sync(true);}}><label>Ordnerpfad<input className="input" required value={path} onChange={event=>setPath(event.target.value)} placeholder={'\\\\SERVER\\Unterlagen'} disabled={!folder||busy}/></label>
    <label className="doc-checkbox"><input type="checkbox" checked={recursive} onChange={event=>setRecursive(event.target.checked)} disabled={!folder||busy}/>Unterordner einbeziehen</label>
    <p className="doc-help">PDF, TXT und Markdown · bis 200 Dateien / 250 MB gesamt und 100 MB je Datei. Windows-Leserechte erforderlich. Keine automatische Hintergrundüberwachung. Jeder Toolbox-PC hat einen eigenen Index.</p>
    {folder?.last_sync&&<p>Zuletzt aktualisiert: {new Date(folder.last_sync).toLocaleString()} · {folder.linked_files} Dateien</p>}
    {error&&<p role="alert" className="doc-error">{error}</p>}{notice&&<p role="status" className="doc-notice">{notice}</p>}
    <div className="doc-actions"><button type="submit" className="btn primary" disabled={!folder||busy||!path.trim()}>{busy?"Dokumente werden eingelesen …":"Verbinden und einlesen"}</button><button type="button" className="btn" disabled={!folder?.path||busy||path!==folder.path||recursive!==folder.recursive} onClick={()=>void sync(false)}>Jetzt aktualisieren</button><button type="button" className="btn" disabled={!folder?.path||busy} onClick={()=>void disconnect()}>Verbindung trennen</button></div></form>
    <SetupGuide/><button className="btn" disabled={busy} onClick={onClose}>Schliessen</button>
  </div></div>;
}
