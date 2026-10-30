'use strict';
// The same document and storage key as the existing complete programme interface.
let tenderLines=[],tenderDraft=null;
try {const stored=JSON.parse(localStorage.getItem('steiger2bim.tender.v1') || '[]');if(Array.isArray(stored))tenderLines=stored;}
catch {toast('Gespeicherte Ausschreibung konnte nicht gelesen werden.');}
function tenderCount() {$('tenderCount').textContent=tenderLines.length;}
function persistTender() {try{localStorage.setItem('steiger2bim.tender.v1',JSON.stringify(tenderLines));}catch{toast('Ausschreibung als JSON sichern: lokale Speicherung nicht verfügbar.');}const project=activeProject();if(project){project.lines=tenderLines;saveProjects();}tenderCount();}
function renderTender() {
  $('tenderLines').innerHTML=tenderLines.length?`<table class="components-table"><thead><tr><th>BKP</th><th>Geschoss / Raum</th><th>Anlage / Verlegung</th><th>Artikel / VA</th><th>Katalog</th><th>Bezeichnung</th><th>Menge / Einheit</th><th></th></tr></thead><tbody>${tenderLines.map((l,i)=>`<tr><td>${escapeHTML(l.bkp)}</td><td>${escapeHTML([l.storey,l.room].filter(Boolean).join(' / '))}</td><td>${escapeHTML([l.system,l.placement].filter(Boolean).join(' / '))}</td><td><button class="component-link" data-tender-open="${i}">${escapeHTML(l.number)} / ${escapeHTML(l.va)}</button>${l.rule_id?`<small>Regel ${escapeHTML(l.rule_id)}</small>`:''}</td><td>${escapeHTML(String(l.catalogue_year||''))}${l.catalogue_status==='reserved'?' · Vorbehalt':''}${l.source_catalogue_year&&l.source_catalogue_year!==l.catalogue_year?' · Artikel '+escapeHTML(String(l.source_catalogue_year)):''}</td><td>${escapeHTML(l.name)}</td><td>${amountLabel(l.quantity)} ${escapeHTML(l.unit)}</td><td><button class="button" data-tender-remove="${i}" aria-label="Position ${i+1} entfernen">×</button></td></tr>`).join('')}</tbody></table>`:'<div class="empty-state">Noch keine Positionen übernommen.</div>';
  renderBkpCoverage();
  for(const id of ['aggregateTender','exportTender','exportTenderCsv','exportTenderXlsx'])$(id).disabled=!tenderLines.length;
  renderMesserliOutline();
}
$('addTender').onclick=()=>{if(!currentDetail || currentDetail.article.source_kind==='composition_only')return;if(catalogueReserved())return toast('Katalog '+state.catalogueYear+' ist vorgemerkt. Positionen übernimmst du aus dem erfassten Katalog.');tenderDraft=currentDetail;const form=$('tenderForm');form.reset();if(typeof renderCatalogueChoices==='function')renderCatalogueChoices();$('tenderLineCatalogue').value=String(state.tenderCatalogueYear||metadata.year);$('tenderArticleName').textContent=`${tenderDraft.article.number} / VA ${tenderDraft.selected.va} · ${tenderDraft.article.name}`;$('addTenderDialog').showModal();};
$('tenderForm').onsubmit=e=>{
  e.preventDefault();const f=e.target.elements,quantity=Number(f.quantity.value),bkp=f.bkp.value.trim(),unit=f.unit.value;
  if(!Number.isFinite(quantity)||quantity<0||!bkp||!unit)return toast('Menge, BKP und Einheit prüfen.');
  const d=tenderDraft;if(!d)return toast('Bitte die Position erneut zur Übernahme öffnen.');
  try {const latest=JSON.parse(localStorage.getItem('steiger2bim.tender.v1')||'[]');if(Array.isArray(latest))tenderLines=latest;}catch{}
  const chosenYear=Number(f.catalogue_year.value),edition=(metadata.editions||[]).find(item=>item.year===chosenYear);
  if(!edition)return toast('Bitte einen Katalog der Ausschreibung wählen.');
  state.tenderCatalogueYear=chosenYear;savePreferences();
  tenderLines.push({id:crypto.randomUUID(),number:d.article.number,va:d.selected.va,name:d.article.name,quantity,unit,bkp,
    storey:f.storey.value.trim(),room:f.room.value.trim(),system:f.system.value.trim(),placement:f.placement.value.trim(),
    recipe_id:d.recipe?.id??null,catalogue_year:edition.year,catalogue_status:edition.status,source_catalogue_year:metadata.year,catalogue_captured_at:d.root?.captured_at??null,
    reference_k_price:d.root?.recipe===d.recipe?.id?d.root?.summary?.['≈ Akkordpreis']??null:null,sources:[]});
  persistTender();renderCatalogueChoices();tenderDraft=null;$('addTenderDialog').close();toast(edition.status==='reserved'?'Position für den vorgemerkten Katalog '+edition.year+' übernommen. Der Artikeltext stammt aus '+metadata.year+'.':'Position mit BKP und Raumzuordnung übernommen.');
};
$('openTender').onclick=()=>{try{const stored=JSON.parse(localStorage.getItem('steiger2bim.tender.v1')||'[]');if(Array.isArray(stored))tenderLines=stored;}catch{}tenderCount();renderTender();showAusschreibung();};
$('aggregateTender').onclick=async()=>{const before=tenderLines.length;$('aggregateTender').disabled=true;try{tenderLines=(await api('/api/tender/aggregate',{lines:tenderLines})).lines;persistTender();renderTender();$('tenderStatus').textContent=`${before} → ${tenderLines.length} Positionen. BKP, Geschoss, Raum, Anlage, Verlegung, Einheit, Artikel, VA, Rezept, Regel und Katalogjahr bleiben getrennt. Ohne Raum keine Verdichtung.`;}catch(error){$('tenderStatus').textContent=error.message;}finally{$('aggregateTender').disabled=!tenderLines.length;}};
$('exportTender').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({schema_version:'1.0.0',created_at:new Date().toISOString(),catalogue:metadata,tender_catalogue_year:state.tenderCatalogueYear,lines:tenderLines},null,2)],{type:'application/json;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='BIM2STEIGER_Ausschreibung.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('tenderCatalogue').onchange=()=>{state.tenderCatalogueYear=Number($('tenderCatalogue').value);savePreferences();renderCatalogueChoices();};
$('tenderLines').onclick=e=>{const remove=e.target.closest('[data-tender-remove]');if(remove){tenderLines.splice(Number(remove.dataset.tenderRemove),1);persistTender();renderTender();}const open=e.target.closest('[data-tender-open]');if(open){const l=tenderLines[Number(open.dataset.tenderOpen)];if(catalogueReserved()){const available=(metadata.editions||[]).find(edition=>edition.status==='available');if(available)applyCatalogueYear(available.year);}selectArticle(l.number+'/'+l.va,{recipe:l.recipe_id});}};

// Projekte: Die aktive Ausschreibung bleibt unter dem bisherigen Schlüssel, damit die ältere Oberfläche sie weiter liest.
const PROJECTS_KEY='bim2steiger:projekte:v1',MODEL_KEY='bim2steiger:beta:model-import:v1';
let projectStore=null;
function saveProjects(){try{localStorage.setItem(PROJECTS_KEY,JSON.stringify(projectStore));}catch{toast('Projekte können lokal nicht gespeichert werden. Bitte als JSON sichern.');}}
function activeProject(){return projectStore?.projects.find(p=>p.id===projectStore.active)||null;}
function loadProjects(){
  try{const stored=JSON.parse(localStorage.getItem(PROJECTS_KEY)||'null');if(stored&&Array.isArray(stored.projects)&&stored.projects.length)projectStore=stored;}catch{}
  if(!projectStore){const id=crypto.randomUUID();projectStore={active:id,projects:[{id,name:'Projekt 1',created_at:new Date().toISOString(),lines:tenderLines,model_import:modelImport}]};saveProjects();}
  if(!activeProject())projectStore.active=projectStore.projects[0].id;
  // Der bisherige Schlüssel bleibt massgebend, falls die ältere Oberfläche ihn geändert hat.
  const project=activeProject();project.lines=tenderLines;project.model_import=modelImport;saveProjects();
}
function renderProjects(){
  $('projectSelect').innerHTML=projectStore.projects.map(p=>`<option value="${escapeHTML(p.id)}">${escapeHTML(p.name)} · ${p.lines?.length||0} ${p.lines?.length===1?'Position':'Positionen'}</option>`).join('');
  $('projectSelect').value=projectStore.active;$('deleteProject').disabled=projectStore.projects.length<2;
  const project=activeProject();$('projectBreadcrumb').textContent='Ausschreibung · '+project.name;
  $('projectNote').textContent='Positionen und Modellimport gehören zum gewählten Projekt. Alles bleibt auf diesem Gerät gespeichert.';
}
function switchProject(id){
  const current=activeProject();if(current){current.lines=tenderLines;current.model_import=modelImport;}
  projectStore.active=id;const next=activeProject();tenderLines=Array.isArray(next.lines)?next.lines:[];modelImport=next.model_import||null;
  try{if(modelImport)localStorage.setItem(MODEL_KEY,JSON.stringify(modelImport));else localStorage.removeItem(MODEL_KEY);}catch{}
  persistTender();renderTender();renderProjects();if(typeof renderModelImport==='function')renderModelImport();
}
$('projectSelect').onchange=e=>{switchProject(e.target.value);toast('Projekt «'+activeProject().name+'» geöffnet.');};
$('newProject').onclick=async()=>{const name=await askText('Neues Projekt','Projektname',`Projekt ${projectStore.projects.length+1}`);if(!name)return;const id=crypto.randomUUID();projectStore.projects.push({id,name,created_at:new Date().toISOString(),lines:[],model_import:null});switchProject(id);toast('Projekt «'+name+'» angelegt.');};
$('renameProject').onclick=async()=>{const project=activeProject(),name=await askText('Projekt umbenennen','Projektname',project.name);if(!name)return;project.name=name;saveProjects();renderProjects();};
$('deleteProject').onclick=async()=>{if(projectStore.projects.length<2)return;const project=activeProject();if(!await askConfirm('Projekt löschen',`Projekt «${project.name}» mit ${tenderLines.length} Positionen und seinem Modellimport löschen? Das lässt sich nicht rückgängig machen.`,'Projekt löschen'))return;projectStore.projects=projectStore.projects.filter(p=>p.id!==project.id);projectStore.active=null;switchProject(projectStore.projects[0].id);toast('Projekt gelöscht.');};

// Export als CSV (Semikolon, UTF-8 mit BOM für Excel) und als XLSX ohne externe Bibliothek.
const TENDER_COLUMNS=[['Projekt',()=>activeProject()?.name||''],['BKP',l=>l.bkp],['Geschoss',l=>l.storey],['Raum',l=>l.room],['Anlage',l=>l.system],['Verlegung',l=>l.placement],['Artikelnummer',l=>l.number],['VA',l=>l.va],['Bezeichnung',l=>l.name],['Menge',l=>l.quantity],['Einheit',l=>l.unit],['Katalog',l=>l.catalogue_year],['Rezept',l=>l.recipe_id],['Regel',l=>l.rule_id]];
function bkpCode(value){return (String(value||'').match(/(?<![A-Za-z0-9])(\d{2,3}(?:\.\d+)*)(?![A-Za-z0-9])/)||[])[1]||'';}
function bkpNodes(code){
  const parts=String(code||'').split('.'),group=parts[0];
  if(!/^\d+$/.test(group))return code?[code]:[];
  const nodes=group.length>=2?[group.slice(0,2)]:[];
  if(group.length>2)nodes.push(group);
  let current=nodes[nodes.length-1]||group;
  for(const segment of parts.slice(1)){
    if(/^\d+$/.test(segment)&&segment.length>1){current=current+'.'+segment[0];nodes.push(current);current=current+segment.slice(1);nodes.push(current);}
    else {current=current+'.'+segment;nodes.push(current);}
  }
  return [...new Set(nodes)];
}
function messerliStore(){
  const project=activeProject();
  if(!project)return {schema:'1.0.0',chapters:{}};
  if(!project.messerli||project.messerli.schema!=='1.0.0'||typeof project.messerli.chapters!=='object'||!project.messerli.chapters)project.messerli={schema:'1.0.0',chapters:{}};
  return project.messerli;
}
function ensureOutlineChapter(code){const store=messerliStore();if(!store.chapters[code])store.chapters[code]={title:'',texts:[]};return store.chapters[code];}
function catalogueChapterTitle(code){const hit=bkpChapters().find(([chapter])=>chapter===code);return hit?hit[1]:'';}
function positionFileText(line){return typeof line.export_text==='string'?line.export_text:[line.name,line.storey,line.room].filter(Boolean).join(', ');}
function outlineNodes(){
  const codes=new Set();
  for(const line of tenderLines){const code=bkpCode(line.bkp);if(code)for(const node of bkpNodes(code))codes.add(node);}
  for(const code of Object.keys(messerliStore().chapters))if(bkpCode(code)===code)for(const node of bkpNodes(code))codes.add(node);
  return [...codes].sort((a,b)=>a.localeCompare(b,'de-CH',{numeric:true}));
}
function chapterUsed(code){return tenderLines.some(line=>bkpNodes(bkpCode(line.bkp)).includes(code));}
function messerliReady(){
  if(tenderLines.some(line=>bkpCode(line.bkp)&&/^\d+$/.test(String(line.number||'').replace(/\s/g,''))&&/^\d+$/.test(String(line.va||'').trim())))return true;
  return Object.entries(messerliStore().chapters).some(([code,chapter])=>bkpCode(code)&&(String(chapter.title||'').trim()||(chapter.texts||[]).some(text=>String(text).trim())));
}
function messerliOutlinePayload(){
  return Object.entries(messerliStore().chapters).map(([code,chapter])=>({code,title:String(chapter.title||'').trim(),texts:(chapter.texts||[]).map(text=>String(text).trim()).filter(Boolean)})).filter(item=>item.title||item.texts.length);
}
function updateMesserliButtons(){
  const ready=messerliReady();
  for(const id of ['exportTenderElda','exportMesserli']){const el=$(id);if(el)el.disabled=!ready;}
  const eldaState=$('exportEldaState');if(eldaState){eldaState.textContent=ready?'Bereit':'Noch offen';eldaState.className='badge '+(ready?'blue':'planned');}
}
function renderMesserliOutline(){
  const host=$('messerliOutline');if(!host)return;
  const nodes=outlineNodes();
  if(!nodes.length){host.innerHTML='<p class="workflow-note">Noch kein Kapitel. Übernommene Positionen erscheinen hier nach BKP, oder du fügst ein Kapitel ein.</p>';updateMesserliButtons();return;}
  host.innerHTML=nodes.map(code=>{
    const chapter=messerliStore().chapters[code]||{title:'',texts:[]};
    const depth=Math.max(0,bkpNodes(code).length-1);
    const catalogue=catalogueChapterTitle(code);
    const lines=tenderLines.map((line,index)=>({line,index})).filter(item=>bkpCode(item.line.bkp)===code);
    const texts=(chapter.texts||[]).map((text,index)=>`<label>Titeltext<textarea data-outline-text="${index}">${escapeHTML(text)}</textarea></label><button class="button" type="button" data-outline-remove-text="${index}">Text entfernen</button>`).join('');
    const positions=lines.map(({line,index})=>`<div class="outline-position"><label>BKP<input data-line-bkp="${index}" value="${escapeHTML(line.bkp||'')}" aria-label="BKP der Position ${index+1}"></label><label>Text in der Datei<textarea data-line-text="${index}">${escapeHTML(positionFileText(line))}</textarea></label><p class="outline-meta">${escapeHTML(String(line.number))} / ${escapeHTML(String(line.va))} · ${escapeHTML(String(line.quantity))} ${escapeHTML(line.unit||'')}</p></div>`).join('');
    return `<section class="outline-chapter" data-outline-code="${escapeHTML(code)}" style="margin-left:${depth*16}px"><div class="assign-head"><strong class="mono">${escapeHTML(code)}</strong>${catalogue?`<small>Katalog: ${escapeHTML(catalogue)}</small>`:''}</div><label>Titel<input data-outline-title value="${escapeHTML(chapter.title||'')}" placeholder="${escapeHTML(catalogue||code)}" aria-label="Titel ${escapeHTML(code)}"></label>${texts}${positions?`<div class="outline-positions">${positions}</div>`:''}<div class="export-actions"><button class="button" type="button" data-outline-add-text>Titeltext einfügen</button>${chapterUsed(code)?'':`<button class="button" type="button" data-outline-remove>Kapitel entfernen</button>`}</div></section>`;
  }).join('');
  host.querySelectorAll('[data-outline-title]').forEach(input=>{input.oninput=()=>{ensureOutlineChapter(input.closest('[data-outline-code]').dataset.outlineCode).title=input.value;saveProjects();updateMesserliButtons();};});
  host.querySelectorAll('[data-outline-text]').forEach(input=>{input.oninput=()=>{const chapter=ensureOutlineChapter(input.closest('[data-outline-code]').dataset.outlineCode);chapter.texts[Number(input.dataset.outlineText)]=input.value;saveProjects();updateMesserliButtons();};});
  host.querySelectorAll('[data-outline-add-text]').forEach(button=>{button.onclick=()=>{const code=button.closest('[data-outline-code]').dataset.outlineCode;ensureOutlineChapter(code).texts.push('');saveProjects();renderMesserliOutline();const fields=[...host.querySelectorAll(`[data-outline-code="${CSS.escape(code)}"] [data-outline-text]`)];fields.at(-1)?.focus();};});
  host.querySelectorAll('[data-outline-remove-text]').forEach(button=>{button.onclick=()=>{ensureOutlineChapter(button.closest('[data-outline-code]').dataset.outlineCode).texts.splice(Number(button.dataset.outlineRemoveText),1);saveProjects();renderMesserliOutline();};});
  host.querySelectorAll('[data-outline-remove]').forEach(button=>{button.onclick=()=>{delete messerliStore().chapters[button.closest('[data-outline-code]').dataset.outlineCode];saveProjects();renderMesserliOutline();};});
  host.querySelectorAll('[data-line-text]').forEach(input=>{input.oninput=()=>{const line=tenderLines[Number(input.dataset.lineText)];if(!line)return;line.export_text=input.value;persistTender();};});
  host.querySelectorAll('[data-line-bkp]').forEach(input=>{input.onchange=()=>{const line=tenderLines[Number(input.dataset.lineBkp)];if(!line)return;const code=bkpCode(input.value);if(!code){input.value=line.bkp||'';toast('BKP als Code eintragen, zum Beispiel 232.5.');return;}line.bkp=code;persistTender();renderTender();};});
  updateMesserliButtons();
}
function bkpChapters(){
  const found=new Map();
  if(typeof navRecords!=='undefined')for(const article of navRecords)for(const path of article.chapters||[]){
    if(path[0]!=='Komplett-Installationen'||!path[1])continue;
    const code=bkpCode(path[1]);if(code&&!found.has(code))found.set(code,path[1].slice(code.length).trim()||path[1]);
  }
  return [...found.entries()].sort((a,b)=>a[0].localeCompare(b[0],'de-CH',{numeric:true}));
}
function renderBkpCoverage(){
  const host=$('bkpCoverage');if(!host)return;
  const chapters=bkpChapters();if(!chapters.length){host.innerHTML='';return;}
  const assigned=new Map(chapters.map(([code])=>[code,[]]));
  for(const line of tenderLines){
    const code=bkpCode(line.bkp);
    const hit=chapters.filter(([chapter])=>code===chapter||code.startsWith(chapter+'.')).sort((a,b)=>b[0].length-a[0].length)[0];
    if(hit)assigned.get(hit[0]).push(line);
  }
  const filled=chapters.filter(([code])=>assigned.get(code).length).length;
  host.innerHTML=`<h3 class="coverage-title">BKP 230, Kapitel aus dem Katalog</h3><p class="workflow-note">${filled} von ${chapters.length} Kapiteln haben Positionen in dieser Ausschreibung. Leer heisst: noch nichts übernommen, nicht dass die Leistung im Gebäude fehlt.</p><table class="components-table"><thead><tr><th>BKP</th><th>Kapitel</th><th>Positionen</th><th>Menge</th></tr></thead><tbody>${chapters.map(([code,label])=>{const lines=assigned.get(code);const quantity=lines.reduce((sum,line)=>sum+(Number(line.quantity)||0),0);return `<tr><td class="mono">${escapeHTML(code)}</td><td>${escapeHTML(label)}</td><td>${lines.length?lines.length:'leer'}</td><td>${lines.length?amountLabel(Math.round(quantity*1000)/1000):''}</td></tr>`;}).join('')}</tbody></table>`;
}
function tenderRows(){return [TENDER_COLUMNS.map(c=>c[0]),...tenderLines.map(l=>TENDER_COLUMNS.map(c=>c[1](l)??''))];}
function tenderFileName(ext){return 'BIM2STEIGER_'+(activeProject()?.name||'Ausschreibung').replace(/[^\w\-äöüÄÖÜ ]+/g,'').trim().replace(/\s+/g,'_')+'.'+ext;}
function download(blob,name){const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function exportMesserliFile(){
  if(!messerliReady())return;
  try{
    const result=await api('/api/tender/elda',{lines:tenderLines,project:activeProject()?.name||'',catalogue_year:state.tenderCatalogueYear||metadata.year||2026,outline:messerliOutlinePayload()});
    const bytes=Uint8Array.from(atob(result.content_base64),c=>c.charCodeAt(0));
    download(new Blob([bytes],{type:'application/octet-stream'}),tenderFileName('DAT'));
    if(result.warnings&&result.warnings.length)toast(result.warnings[0]);
  }catch(error){toast(error.message||'Messerli-Datei konnte nicht erstellt werden.');}
}
$('exportTenderElda').onclick=exportMesserliFile;
$('exportMesserli').onclick=exportMesserliFile;
$('addMesserliChapter').onclick=async()=>{const entered=await askText('BKP-Kapitel','BKP-Code, zum Beispiel 232.5','');if(!entered)return;const code=bkpCode(entered);if(!code)return toast('BKP als Code eintragen, zum Beispiel 232.5.');if(outlineNodes().includes(code))return toast('Kapitel '+code+' steht schon im Aufbau.');ensureOutlineChapter(code);saveProjects();renderMesserliOutline();};
$('exportTenderCsv').onclick=()=>{
  const cell=v=>{const text=String(v);return /[";\n\r]/.test(text)?'"'+text.replaceAll('"','""')+'"':text;};
  const csv=tenderRows().map(row=>row.map(v=>typeof v==='number'?String(v).replace('.',','):cell(v)).join(';')).join('\r\n');
  download(new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8'}),tenderFileName('csv'));
};
function crc32(bytes){let c,crc=-1;for(let i=0;i<bytes.length;i++){c=(crc^bytes[i])&255;for(let k=0;k<8;k++)c=c&1?(c>>>1)^0xEDB88320:c>>>1;crc=(crc>>>8)^c;}return (crc^-1)>>>0;}
function zipStore(files){
  const encoder=new TextEncoder(),parts=[],central=[];let offset=0;
  const u16=v=>[v&255,(v>>>8)&255],u32=v=>[v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255];
  for(const [name,text] of files){
    const data=encoder.encode(text),path=encoder.encode(name),crc=crc32(data);
    const head=[...u32(0x04034b50),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0x21),...u32(crc),...u32(data.length),...u32(data.length),...u16(path.length),...u16(0)];
    parts.push(new Uint8Array(head),path,data);
    central.push(new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0x21),...u32(crc),...u32(data.length),...u32(data.length),...u16(path.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset)]),path);
    offset+=head.length+path.length+data.length;
  }
  const size=central.reduce((sum,part)=>sum+part.length,0);
  return new Blob([...parts,...central,new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(files.length),...u16(files.length),...u32(size),...u32(offset),...u16(0)])],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
$('exportTenderXlsx').onclick=()=>{
  const xml=v=>String(v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');
  const column=i=>String.fromCharCode(65+i);
  const rows=tenderRows().map((row,r)=>`<row r="${r+1}">${row.map((v,i)=>typeof v==='number'&&Number.isFinite(v)?`<c r="${column(i)}${r+1}"><v>${v}</v></c>`:`<c r="${column(i)}${r+1}" t="inlineStr"${r===0?' s="1"':''}><is><t xml:space="preserve">${xml(v)}</t></is></c>`).join('')}</row>`).join('');
  const sheet=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="8" width="14" customWidth="1"/><col min="9" max="9" width="44" customWidth="1"/><col min="10" max="13" width="11" customWidth="1"/></cols><sheetData>${rows}</sheetData><autoFilter ref="A1:${column(TENDER_COLUMNS.length-1)}${tenderLines.length+1}"/></worksheet>`;
  const files=[
    ['[Content_Types].xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
    ['_rels/.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Ausschreibung" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">Ausschreibung!$A$1:$'+column(TENDER_COLUMNS.length-1)+'$'+(tenderLines.length+1)+'</definedName></definedNames></workbook>'],
    ['xl/_rels/workbook.xml.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
    ['xl/styles.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'],
    ['xl/worksheets/sheet1.xml',sheet]
  ];
  download(zipStore(files),tenderFileName('xlsx'));
};
loadProjects();renderProjects();tenderCount();renderTender();
