
    'use strict';
    // 6. ZUSTAND UND HILFSFUNKTIONEN. Keine Framework- oder Build-Abhängigkeit.
    let catalogue = [], metadata = {}, imageInventory = [], currentDetail = null;
    let detailRequest=0, searchRequest=0, searchTimer, revealTree=()=>{};
    const api = async (path,body) => { const response=await fetch(path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});const data=await response.json();if(!response.ok)throw Error(data.error || 'Anfrage fehlgeschlagen');return data; };
    const categoryNames = { complete:'Komplettpositionen', assembly:'Kalkulationskomponenten', single:'Einzelteile' };
    const categorySingular = { complete:'Komplettposition', assembly:'Kalkulationskomponente', single:'Einzelposition' };
    const state = { article:null, va:null, tab:'composition', filter:'all', results:[], activeResult:0, expanded:new Set(), saved:[], leaves:[], leafView:false };
    const $ = id => document.getElementById(id);
    const icon = (name,extra='') => `<svg class="icon ${extra}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
    const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('de-CH').replace(/ß/g,'ss');
    const numberLabel = number => String(number).length === 6 ? String(number).replace(/(\d{3})(\d{3})/,'$1 $2') : String(number);
    const eNumberLabel = number => number ? String(number).replace(/\s/g,'').replace(/(\d{3})(\d{3})(\d{3})/,'$1 $2 $3') : '—';
    const productIdentifiers = () => {
      const entries=currentDetail?.identifiers || [];
      const values=field=>[...new Set(entries.map(x=>x[field]).filter(Boolean))];
      return {e_nr:values('e_nr').map(eNumberLabel).join(' / ') || null,b_nr:values('b_nr').join(' / ') || null};
    };
    const amountLabel = value => value==null?'—':new Intl.NumberFormat('de-CH',{maximumFractionDigits:4}).format(value);
    const currentArticle = () => catalogue.find(a => a.id === state.article);
    const currentRecipe = () => currentArticle().recipes[state.va] ?? null;
    const savedKey = (id,va) => `${id}:${va}`;
    let toastTimer;
    function toast(message) { $('toast').textContent=message; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2800); }
    function persistSaved() { try { localStorage.setItem('bim2steiger:merkliste:v1',JSON.stringify(state.saved)); } catch { $('storageNotice').hidden=false; toast('Bitte Favoriten als JSON sichern.'); } }
    try {
      const stored=JSON.parse(localStorage.getItem('bim2steiger:merkliste:v1') || '[]');
      const seen=new Set();
      if(Array.isArray(stored)) state.saved=stored.filter(item => {
        if(!item || typeof item!=='object') return false;
        const key=savedKey(item.id,item.va);
        if(typeof item.id!=='string' || typeof item.va!=='string' || seen.has(key)) return false;
        
    seen.add(key); return true;
      }).map(({id,va})=>({id,va}));
    } catch { $('storageNotice').hidden=false; }

    // 7. KATALOGBAUM. Native <details>-Elemente machen das Akkordeon tastaturbedienbar.
    const symbolFor=(number,va=null)=>imageInventory.find(i=>i.kind!=='product' && i.number===number && (!i.va||!va||i.va===va));
    const previewIcon=(number,va,fallback)=>{const source=symbolFor(number,va);return source?`<img src="${escapeHTML(source.file)}" alt="Originalsymbol Artikel ${escapeHTML(number)}" title="${escapeHTML(source.source)}">`:icon(fallback);};
    function treeButton(a) { return `<button class="tree-article ${a.id===state.article?'selected':''}" data-select="${escapeHTML(a.id)}"><span class="thumb">${previewIcon(a.number,null,a.icon)}</span><span>${escapeHTML(a.title)}<span class="small-number mono">${numberLabel(a.number)}</span></span></button>`; }
    function renderTree() {
      const roots=new Map();
      for(const a of catalogue) {
        for(const path of a.chapters.length?a.chapters:[['Kalkulationskomponenten']]) {
          let level=roots;
          path.forEach((label,index)=>{if(!level.has(label))level.set(label,{label,children:new Map(),articles:new Map(),count:new Set()});const node=level.get(label);node.count.add(a.id);if(index===path.length-1)node.articles.set(a.id,a);level=node.children;});
        }
      }
      let nodeId=0;
      const nodes=new Map();
      function branch(level) { return [...level.values()].map(node=>{const id=String(nodeId++);nodes.set(id,node);return `<details class="tree-section" data-tree-node="${id}"><summary>${icon('chevron','chevron')}<span>${escapeHTML(node.label)}</span><span class="section-count">${node.count.size}</span></summary><div class="tree-branch">${branch(node.children)}<div data-tree-items="${id}"></div></div></details>`;}).join(''); }
      $('catalogueTree').innerHTML=branch(roots);
      function fill(id,limit=40) {const node=nodes.get(id),items=[...node.articles.values()];const container=document.querySelector(`[data-tree-items="${id}"]`);container.innerHTML=items.slice(0,limit).map(treeButton).join('')+(items.length>limit?`<button class="tree-article" data-tree-more="${id}" data-limit="${limit+40}">Weitere ${Math.min(40,items.length-limit)} anzeigen (${limit}/${items.length})</button>`:'');}
      $('catalogueTree').querySelectorAll('[data-tree-node]').forEach(el=>el.addEventListener('toggle',()=>{if(el.open&&!el.dataset.loaded){fill(el.dataset.treeNode);el.dataset.loaded='true';}}));
      $('catalogueTree').onclick=e=>{const more=e.target.closest('[data-tree-more]');if(more)fill(more.dataset.treeMore,Number(more.dataset.limit));};
      // Open the selected article's path without rendering thousands of article buttons.
      revealTree=()=>{for(const [id,node] of nodes)if(node.count.has(state.article)){const el=document.querySelector(`[data-tree-node="${id}"]`);el.open=true;if(node.articles.has(state.article)){fill(id,Math.max(40,[...node.articles.keys()].indexOf(state.article)+1));el.dataset.loaded='true';}}};
      revealTree();
      $('sampleCount').textContent=`${amountLabel(metadata.catalogue_articles)} Katalogartikel · ${amountLabel(metadata.component_only_articles)} Kalkulationskomponenten`;
      $('footerSampleCount').textContent=amountLabel(metadata.catalogue_articles);
    }

    
    // Schematische, direkt im Dokument hinterlegte Bildplatzhalter. Keine Herstellerbilder.
    function drawing(type,large=false) {
      if(currentArticle().portal_image) return `<img src="${escapeHTML(currentArticle().portal_image)}" alt="Originalzeichnung Artikel ${escapeHTML(currentArticle().number)}" style="max-width:90%;max-height:${large?'60dvh':'210px'};width:${large?'384px':'auto'};height:auto;object-fit:contain">`;
      const drawings={
        switch:`<ellipse cx="151" cy="246" rx="88" ry="13" fill="#e0e7f2" opacity=".6"/><path d="m75 62 151-13 15 15v159l-150 15-16-15Z" fill="#e2e8f1" stroke="#b4c2d6" stroke-width="1.4"/><path d="m75 62 150-13v159L75 223Z" fill="#fff" stroke="#bdcadd" stroke-width="1.4"/><path d="m90 78 119-11v126L90 207Z" fill="#f3f6fb" stroke="#c3cfe0"/><path d="m99 88 100-9v104L99 195Z" fill="#fff" stroke="#b9c7db"/><path d="m107 96 82-7v16l-82 7Z" fill="#edf2f9"/><path d="m102 188 93-10" stroke="#c3cfe0"/><path d="m225 49 16 15M225 208l16 15M75 223l16 15" stroke="#adbed6"/><path d="M50 62v161M43 62h14M43 223h14" stroke="#a3b6d3" stroke-width=".9"/><text x="37" y="147" fill="#91a4c1" font-size="8" font-family="monospace" transform="rotate(-90 37 147)">UP / WAND</text><path d="m90 35 118-11M90 30v10M208 19v10" stroke="#a3b6d3" stroke-width=".9"/><circle cx="244" cy="80" r="4" fill="#315ce7"/><path d="M248 80h27" stroke="#a3b6d3"/><text x="241" y="71" fill="#8fa3c2" font-size="7" font-family="monospace">01</text>`,
        cable:`<ellipse cx="149" cy="234" rx="92" ry="18" fill="#e4eaf4"/><g fill="none" stroke-linecap="round"><ellipse cx="147" cy="146" rx="81" ry="66" stroke="#8b9fbe" stroke-width="21"/><ellipse cx="147" cy="146" rx="55" ry="44" stroke="#acbad0" stroke-width="16"/><ellipse cx="147" cy="146" rx="30" ry="24" stroke="#c5d0e0" stroke-width="12"/><path d="M222 163q35 0 35 38v14" stroke="#8b9fbe" stroke-width="17"/><path d="M253 215v20M258 215v20M263 214v20" stroke="#315ce7" stroke-width="3"/></g><path d="M51 63h182M51 58v10M233 58v10" stroke="#a3b6d3"/><text x="109" y="52" fill="#91a4c1" font-size="8" font-family="monospace">LEITUNG / ROHR</text>`,
        box:`<ellipse cx="151" cy="235" rx="89" ry="14" fill="#dfe7f3"/><path d="m64 101 115-42 65 52-117 45Z" fill="#e2e9f4" stroke="#a6b8d2"/><path d="M64 101v83l63 53v-81Z" fill="#b6c7df" stroke="#95aaca"/><path d="m127 156 117-45v82l-117 44Z" fill="#cad7e9" stroke="#a0b2cc"/><path d="m79 104 98-34 51 40-99 37Z" fill="#7d96bb"/><path d="m79 104 50 40 1-33 48-20-1-21" fill="#a2b5d1"/><ellipse cx="169" cy="178" rx="13" ry="18" fill="#a0b4d0" transform="rotate(12 169 178)"/><ellipse cx="212" cy="160" rx="11" ry="15" fill="#a0b4d0" transform="rotate(12 212 160)"/><path d="m74 65 97-34M71 60l5 11M169 26l5 11" stroke="#a3b6d3"/><text x="81" y="42" fill="#91a4c1" font-size="8" font-family="monospace">EINBAU / MONTAGE</text>`,
        light:`<ellipse cx="149" cy="229" rx="87" ry="13" fill="#e1e8f3"/><path d="M65 148q0 42 85 42t85-42v-24H65Z" fill="#d2ddeb" stroke="#a7b9d3"/><ellipse cx="150" cy="124" rx="85" ry="42" fill="#fff" stroke="#b6c6dc" stroke-width="1.5"/><ellipse cx="150" cy="124" rx="70" ry="31" fill="#f6f8fd" stroke="#dde5f0"/><path d="M150 82V51h49" fill="none" stroke="#a4b8d6"/><circle cx="202" cy="51" r="4" fill="#315ce7"/><path d="M77 203h145M77 198v10M222 198v10" stroke="#a3b6d3"/><text x="112" y="220" fill="#91a4c1" font-size="8" font-family="monospace">MONTAGE / ANSCHLUSS</text>`
      };
      return `<svg viewBox="0 0 300 280" class="product-drawing" role="img" aria-label="Schematische Darstellung: ${escapeHTML(currentArticle().title)}">${drawings[type] || drawings.box}</svg>`;
    }

    // 8. DETAILANSICHT. Eine VA-Auswahl zeigt ausschliesslich das zugehörige Rezept.
    function adaptArticle(d) {
      const a=d.article, basic=d.root?.basic_data?.length?d.root.basic_data:(a.basic_data || []);
      const field=name=>basic.find(x=>x.label===name)?.value || '';
      function items(rid,path=[]) {if(path.includes(rid))throw Error('Zyklus in der Zusammensetzung');const r=d.graph[rid];if(!r)throw Error('Unterrezept fehlt');return (r.items.length?r.items:r.atomic?[r.atomic]:[]).map(i=>({...i,children:i.recipe?items(i.recipe,[...path,rid]):null}));}
      const image=symbolFor(a.number,d.selected.va);
      return {...a,id:a.number,title:a.name,icon:componentIcon(a.name),kind:a.complete_position?'complete':a.source_kind==='composition_only'?'assembly':'single',
        section:a.locations[0]?.chapter.slice(1).join(' / ') || 'Kalkulationskomponenten',chapters:a.locations.map(x=>x.chapter),
        placement:field('Bezeichnung Z2'),subtitle:a.groups?.join(' · ') || '',text:d.root?.article_text || a.text,
        vas:d.variants.map(v=>v.va),basic_data:basic,properties:[['Erfassungsstatus',statusLabel(d.selected.status)],['Rezeptversion',d.recipe?.id || 'Nicht erfasst']],
        portal_image:image?.file,image,recipes:{[d.selected.va]:d.recipe?items(d.recipe.id):null}};
    }
    function statusLabel(status) {return ({text_without_calculation:'Textposition ohne Kalkulation',captured_with_components:'Bestandteile erfasst',captured_without_components:'Kalkulation ohne weitere Unterteilung',expanded_inside_complete_position:'Als Unterbaugruppe erfasst',not_captured:'Zusammensetzung nicht erfasst',observed_component:'In einer Kalkulation beobachtet'})[status] || status;}
    async function selectArticle(id,va=null,updateHash=true,recipe=null) {
      const request=++detailRequest;
      $('detailStatus').textContent='Position wird geladen …';
      $('positionCard').setAttribute('aria-busy','true');
      $('savePosition').disabled=true;$('addTender').disabled=true;$('copyNumber').disabled=true;
      try {
        const d=await api('/api/article?'+new URLSearchParams({number:id,...(va?{va}:{}),...(recipe?{recipe}:{})}));
        if(request!==detailRequest)return;
        const article=adaptArticle(d);currentDetail=d;
        const index=catalogue.findIndex(a=>a.id===id);if(index<0)catalogue.push(article);else catalogue[index]=article;
        state.article=id;state.va=d.selected.va;state.expanded.clear();state.leaves=[];state.leafView=false;
        if(updateHash)history.replaceState(null,'',`#position/${encodeURIComponent(id)}/${encodeURIComponent(state.va)}${d.recipe_alternatives.length>1?'/'+encodeURIComponent(d.recipe.id):''}`);
        $('breadcrumbCategory').textContent=categoryNames[article.kind];$('breadcrumbSection').textContent=article.section;
        $('kindBadge').textContent=categorySingular[article.kind];$('articleNumber').textContent=numberLabel(article.number);
        $('articleTitle').textContent=article.title;$('articleSubtitle').textContent=article.subtitle;
        $('productDrawing').innerHTML=drawing(article.icon);
        $('productCaption').textContent=article.image?`Originalsymbol · Artikel ${article.number} · ${article.image.width} × ${article.image.height} px`:'Schematische Darstellung · kein Produktfoto';
        $('openProductImage').disabled=!article.image;
        const ids=productIdentifiers();
        $('articleFacts').innerHTML=`<div class="fact"><dt>Verlegungsart (VA)</dt><dd><label class="sr-only" for="vaSelect">Verlegungsart wählen</label><select class="va-select" id="vaSelect">${d.variants.map(v=>`<option value="${escapeHTML(v.va)}" ${v.va===state.va?'selected':''}>${escapeHTML(v.va)} · ${escapeHTML(statusLabel(v.status))}</option>`).join('')}</select></dd></div><div class="fact"><dt>Katalogbereich</dt><dd>${escapeHTML(article.section)}</dd></div><div class="fact"><dt>E-Nr.</dt><dd class="identifier">${escapeHTML(ids.e_nr || '—')}</dd></div><div class="fact"><dt>B-Nr. / Bestellnummer</dt><dd class="identifier">${escapeHTML(ids.b_nr || '—')}</dd></div>`;
        $('vaSelect').onchange=e=>selectArticle(id,e.target.value);
        $('detailStatus').textContent=statusLabel(d.selected.status)+(d.root?.captured_at?' · erfasst '+new Date(d.root.captured_at).toLocaleDateString('de-CH'):'')+(d.identifiers.length>1?' · Mehrere Produktkennungen: Quellen unter Eigenschaften prüfen.':'');
        if(d.recipe_alternatives.length>1){$('articleFacts').insertAdjacentHTML('beforeend',`<div class="fact" style="grid-column:1/-1"><dt>Beobachtete Rezeptversion</dt><dd><select class="va-select" id="recipeSelect" aria-label="Rezeptversion wählen">${d.recipe_alternatives.map(r=>`<option value="${escapeHTML(r)}" ${r===d.recipe.id?'selected':''}>${escapeHTML(r)}</option>`).join('')}</select></dd></div>`);$('recipeSelect').onchange=e=>selectArticle(id,state.va,true,e.target.value);}
        renderComposition();renderProperties();
        $('panel-description').innerHTML=`<div class="panel-heading"><div><h3>Originaler Katalogtext</h3><p>Gespeicherte Quelle dieser Position.</p></div></div><div class="source-text">${escapeHTML(article.text)}</div>`;
        renderRelated();updateSaveButton();revealTree();closeSidebar();
        $('addTender').disabled=article.source_kind==='composition_only';$('copyNumber').disabled=false;
        document.querySelectorAll('.tree-article[data-select]').forEach(b=>{b.classList.toggle('selected',b.dataset.select===id);if(b.dataset.select===id)b.setAttribute('aria-current','true');else b.removeAttribute('aria-current');});
        if(d.recipe) {
          try {const leaves=await api('/api/expand?'+new URLSearchParams({number:id,va:state.va,quantity:'1',recipe:d.recipe.id}));if(request!==detailRequest)return;state.leaves=leaves;$('leafView').disabled=false;}
          catch(error){if(request===detailRequest)$('expandStatus').textContent='Endbestandteile konnten nicht geladen werden: '+error.message;}
        }
      } catch(error) {if(request===detailRequest){$('detailStatus').textContent='Position nicht verfügbar: '+error.message;toast(error.message);if(currentDetail){updateSaveButton();$('addTender').disabled=currentDetail.article.source_kind==='composition_only';$('copyNumber').disabled=false;}}}
      finally {if(request===detailRequest)$('positionCard').setAttribute('aria-busy','false');}
    }
    
    function renderComposition() {
      const recipe=currentRecipe();$('componentCount').textContent=recipe?recipe.length:'—';
      if(!recipe){$('panel-composition').innerHTML=`<div class="empty-state">${icon('layers')}<p>${escapeHTML(currentDetail.root?.capture_note || 'Für diese Artikel-/VA-Kombination ist keine Zusammensetzung erfasst.')}</p><p>Fehlende Daten bedeuten nicht, dass keine Bestandteile enthalten sind.</p></div>`;return;}
      const nested=recipe.some(i=>i.children?.length);
      $('panel-composition').innerHTML=`<div class="panel-heading"><div><h3>So setzt sich die Position zusammen</h3><p>${recipe.length} direkte Bestandteile · VA ${escapeHTML(state.va)} · ${currentDetail.recipe.items.length?'Mengen je Elternteil und Stammposition':'Kalkulationssumme ohne weitere Unterteilung'}</p></div><div class="flex gap-3">${nested?`<button class="text-button" id="expandComponents">${icon('expand')}<span>Alle aufklappen</span></button>`:''}<button class="text-button" id="leafView" disabled>Endbestandteile</button></div></div><div class="components-scroll"><table class="components-table"><thead><tr><th>Artikel-Nr.</th><th>Bestandteil</th><th>VA</th><th>Je Elternteil</th><th>Je Stammposition</th></tr></thead><tbody id="componentRows"></tbody></table></div><p class="table-note">${icon('info')}<span id="expandStatus">Quellmengen ohne ergänzte Einheit. Mengen entlang aller Ebenen multiplizieren; Baugruppen und Endbestandteile nicht zusätzlich addieren. Negative Werte sind Abzüge.</span></p>`;
      $('leafView').onclick=()=>{state.leafView=!state.leafView;$('leafView').textContent=state.leafView?'Zusammensetzung':'Endbestandteile';if($('expandComponents'))$('expandComponents').hidden=state.leafView;renderComponentRows();};
      if(nested)$('expandComponents').onclick=()=>{const keys=[];const collect=(items,prefix='')=>items.forEach((item,i)=>{const key=prefix+i;if(item.children?.length){keys.push(key);collect(item.children,key+'.');}});collect(recipe);const allOpen=keys.every(key=>state.expanded.has(key));if(allOpen)state.expanded.clear();else keys.forEach(key=>state.expanded.add(key));$('expandComponents').querySelector('span').textContent=allOpen?'Alle aufklappen':'Alle zuklappen';renderComponentRows();};
      renderComponentRows();
    }
    function renderComponentRows() {
      const focusedKey=document.activeElement?.dataset?.expand,rows=[];
      function row(item,depth,key,total,hasChildren=false) {
        const expanded=state.expanded.has(key);
        const label=item.cost_kind==='external_service'?' · Fremdleistung':item.cost_kind==='portal_net_cost_inferred'?' · Kostenklassifikation abgeleitet':'';
        return `<tr class="component-row ${depth?'nested':''} ${total<0?'negative':''}"><td class="mono"><button class="component-link" data-component="${escapeHTML(item.number)}" data-va="${escapeHTML(item.va)}">${escapeHTML(numberLabel(item.number))}</button></td><td><div class="component-name" style="padding-left:${depth*18}px">${hasChildren?`<button class="component-toggle" data-expand="${key}" aria-label="Unterbestandteile von ${escapeHTML(item.name)}" aria-expanded="${expanded}">${icon('chevron')}</button>`:`<span class="component-icon">${previewIcon(item.number,item.va,componentIcon(item.name))}</span>`}<span class="component-text"><span>${escapeHTML(item.name+label)}</span><span class="component-identifiers"><span>E-Nr. <b class="mono">${escapeHTML(eNumberLabel(item.eldas))}</b></span><span>B-Nr. <b class="mono">${escapeHTML(item.manufacturer_number || '—')}</b></span></span>${state.leafView?`<span class="component-identifiers">Pfad: ${escapeHTML(item.path.join(' → '))} · ${item.material_counted?'Material gemäss Quelle':'Ohne Materiallieferung'}</span>`:''}</span></div></td><td><span class="va-pill mono">${escapeHTML(item.va)}</span></td><td class="quantity mono">${state.leafView?'—':amountLabel(item.quantity)}</td><td class="quantity mono">${amountLabel(total)}</td></tr>`;
      }
      function visit(items,depth=0,prefix='',multiplier=1) {items.forEach((item,i)=>{const key=prefix+i,total=multiplier*item.quantity,hasChildren=!!item.children?.length;rows.push(row(item,depth,key,total,hasChildren));if(hasChildren&&state.expanded.has(key))visit(item.children,depth+1,key+'.',total);});}
      if(state.leafView)state.leaves.forEach((item,i)=>rows.push(row(item,0,String(i),item.quantity)));else visit(currentRecipe());
      $('componentRows').innerHTML=rows.join('');
      $('componentRows').querySelectorAll('[data-expand]').forEach(b=>b.onclick=()=>{const key=b.dataset.expand;state.expanded.has(key)?state.expanded.delete(key):state.expanded.add(key);renderComponentRows();});
      if(focusedKey)$('componentRows').querySelector(`[data-expand="${focusedKey}"]`)?.focus({preventScroll:true});
    }
    
    function componentIcon(name) { const n=normalize(name);return /schalter|taster/.test(n)?'switch':/kabel|draht|rohr/.test(n)?'cable':/leuchte/.test(n)?'light':'box'; }
    function renderProperties() {
      const a=currentArticle();
      const identifiers=productIdentifiers();
      const properties=[['Artikelnummer',numberLabel(a.number)],['E-Nr.',identifiers.e_nr || '—'],['B-Nr. / Bestellnummer',identifiers.b_nr || '—'],['Positionstyp',categorySingular[a.kind]],['Verlegungsart',state.va],['Katalogjahr','2026'],['Ausführung',a.placement || 'Siehe Artikeltext'],['Mengeneinheit','In der Quelle nicht ausgewiesen'],...a.properties];
      $('panel-properties').innerHTML=`<div class="panel-heading"><div><h3>Eigenschaften & Begriffe</h3><p>Originalangaben und ausdrücklich erklärte Abkürzungen.</p></div></div><dl class="properties-grid">${properties.map(([label,value])=>`<div class="property"><dt>${escapeHTML(label)}</dt><dd>${escapeHTML(value)}</dd></div>`).join('')}</dl>`;
      if(currentDetail.identifiers.length) $('panel-properties').insertAdjacentHTML('beforeend',`<div class="panel-heading" style="margin-top:25px"><div><h3>Produktkennungen und Herkunft</h3><p>Nur die gewählte Artikel-/VA-Kombination.</p></div></div>${currentDetail.identifiers.map(entry=>`<p class="source-text">E-Nr. ${escapeHTML(eNumberLabel(entry.e_nr))} · B-Nr. ${escapeHTML(entry.b_nr || '—')}<br>${escapeHTML(entry.source)}${entry.sources.map(s=>`<br>Quelle: ${escapeHTML(s.number)} / VA ${escapeHTML(s.va)} · ${escapeHTML(s.recipe)}`).join('')}</p>`).join('')}`);
      if(a.basic_data?.length) $('panel-properties').insertAdjacentHTML('beforeend',`<div class="panel-heading" style="margin-top:25px"><div><h3>Grunddaten aus dem Steiger-Katalog</h3><p>Die Felder gehören zur gewählten Position. Leere Originalfelder bleiben leer.</p></div></div><dl class="properties-grid">${a.basic_data.map(row=>`<div class="property"><dt>${escapeHTML(row.label)}</dt><dd>${row.checkbox===true?'Ja':row.checkbox===false?'Nein':escapeHTML(row.value || '—')}</dd></div>`).join('')}</dl>`);
    }
    function renderRelated() {
      const a=currentArticle();
      const others=[...catalogue.filter(x=>x.id!==a.id && x.kind===a.kind),...catalogue.filter(x=>x.id!==a.id && x.kind!==a.kind)].slice(0,3);
      $('relatedGrid').innerHTML=others.map(x=>`<button class="related-card" data-select="${escapeHTML(x.id)}"><span class="related-thumb">${icon(x.icon)}</span><span><h4>${escapeHTML(x.shortTitle || x.title)}</h4><p class="mono">${numberLabel(x.number)} <span style="font-family:'Segoe UI',sans-serif">· ${categorySingular[x.kind]}</span></p></span></button>`).join('');
    }
    function setTab(name,focus=false) {
      state.tab=name;
      document.querySelectorAll('[data-tab]').forEach(button=>{const active=button.dataset.tab===name;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1; if(active&&focus) button.focus();});
      document.querySelectorAll('[role=tabpanel]').forEach(panel=>panel.hidden=panel.id!==`panel-${name}`);
    }

    // 9. SUCHFUNKTION: Originaltext + geprüfte Synonyme, keine automatische Artikelzuordnung.
    function openSearch() { if($('listDialog').open) $('listDialog').close(); $('searchDialog').showModal(); renderSearch(); $('searchInput').focus(); }
    async function renderSearch() {
      const request=++searchRequest;
      const query=$('searchInput').value;
      state.results=[];$('searchResults').innerHTML='<div class="empty-state">Katalog wird durchsucht …</div>';$('searchCount').textContent='';$('searchInput').removeAttribute('aria-activedescendant');
      try {
        const data=await api('/api/search?'+new URLSearchParams({q:query,kind:state.filter,limit:'100'}));
        if(request!==searchRequest)return;
        state.results=data.map(a=>({id:a.number,number:a.number,title:a.name,kind:a.complete_position?'complete':a.source_kind==='composition_only'?'assembly':'single',section:a.chapter.join(' / ') || 'Kalkulationskomponenten',icon:componentIcon(a.name)}));state.activeResult=0;
        $('searchLabel').textContent=query?'Suchergebnisse':'Katalog entdecken';$('searchCount').textContent=`${data.length===100?'Erste ':''}${data.length} Treffer${data.length===100?' · Suche eingrenzen':''}`;
        $('searchResults').innerHTML=data.length?state.results.map((a,i)=>`<button class="search-result ${i===0?'active':''}" id="result-${i}" role="option" aria-selected="${i===0}" data-result="${i}"><span class="search-thumb">${previewIcon(a.number,null,a.icon)}</span><span><span class="result-name">${escapeHTML(a.title)}</span><span class="result-meta" style="display:block"><span class="mono">${numberLabel(a.number)}</span> · ${categoryNames[a.kind]} / ${escapeHTML(a.section)}</span></span>${icon('arrow','result-arrow')}</button>`).join(''):`<div class="empty-state">${icon('search')}<p>Keine Position gefunden.</p><p>Artikelnummer, Beschreibung, E-Nr. oder Bestellnummer verwenden.</p></div>`;
        if(data.length)$('searchInput').setAttribute('aria-activedescendant','result-0');
      } catch(error) {if(request===searchRequest)$('searchResults').innerHTML=`<div class="empty-state">Suche nicht verfügbar: ${escapeHTML(error.message)}</div>`;}
    }
    
    function activateResult(index) { if(!state.results.length) return;state.activeResult=(index+state.results.length)%state.results.length;document.querySelectorAll('.search-result').forEach((button,i)=>{button.classList.toggle('active',i===state.activeResult);button.setAttribute('aria-selected',String(i===state.activeResult));});const active=$(`result-${state.activeResult}`);$('searchInput').setAttribute('aria-activedescendant',active.id);active.scrollIntoView({block:'nearest'}); }
    async function chooseSearchResult(index) { const article=state.results[index];if(!article) return;$('searchDialog').close();await selectArticle(article.id);$('articleTitle').setAttribute('tabindex','-1');$('articleTitle').focus({preventScroll:true});window.scrollTo({top:0}); }

    // 10. MERKLISTE: lokal speichern; JSON mit Artikel, VA und Herkunft exportieren.
    function updateSaveButton() {
      const a=currentArticle(); if(!a)return; const saved=state.saved.some(item=>savedKey(item.id,item.va)===savedKey(a.id,state.va));
      const button=$('savePosition'); button.disabled=a.kind==='assembly'; button.classList.toggle('saved',saved); button.classList.toggle('primary',!saved);
      button.innerHTML=`${icon(saved?'check':'plus')}<span>${a.kind==='assembly'?'Nur als Kalkulationsbestandteil erfasst':saved?'In deinen Favoriten':'Zu Favoriten hinzufügen'}</span>`;
      document.querySelectorAll('[data-saved-count]').forEach(el=>el.textContent=state.saved.length);
    }
    function renderSaved() {
      $('savedItems').innerHTML=state.saved.length?state.saved.map((item,index)=>{
        const a=catalogue.find(x=>x.id===item.id) || {number:item.id,title:item.id,icon:'box'};
        return `<div class="saved-item"><span class="search-thumb">${icon(a.icon)}</span><button class="saved-open" data-saved-open="${index}">${escapeHTML(a.title)}<span class="mono">${numberLabel(a.number)} · VA ${escapeHTML(item.va)}</span></button><button class="icon-button" data-remove="${index}" aria-label="${escapeHTML(a.title)} aus Favoriten entfernen">${icon('trash')}</button></div>`;
      }).join(''):`<div class="empty-state">${icon('bookmark')}<p>Du hast noch keine Favoriten.</p><p style="font-size:10px;margin-top:7px">Öffne eine Position und füge sie hier hinzu.</p></div>`;
      $('exportList').disabled=!state.saved.length;
    }
    function openList() { if($('searchDialog').open) $('searchDialog').close();closeSidebar();renderSaved();$('listDialog').showModal(); }
    function closeSidebar() { document.body.classList.remove('nav-open');$('menuToggle').setAttribute('aria-expanded','false'); }

    // 11. EREIGNISSE. Delegation hält dynamische Artikelkarten einfach austauschbar.
    document.addEventListener('click',e=>{
      const component=e.target.closest('[data-component]');if(component)selectArticle(component.dataset.component,component.dataset.va);
      const selection=e.target.closest('[data-select]');if(selection){selectArticle(selection.dataset.select);window.scrollTo({top:0,behavior:'instant'});}
      if(e.target.closest('[data-open-list]')) openList();
      const closer=e.target.closest('[data-close-dialog]');if(closer) $(closer.dataset.closeDialog).close();
      const result=e.target.closest('[data-result]');if(result) chooseSearchResult(Number(result.dataset.result));
      const remove=e.target.closest('[data-remove]');if(remove){state.saved.splice(Number(remove.dataset.remove),1);persistSaved();renderSaved();updateSaveButton();}
      const savedOpen=e.target.closest('[data-saved-open]');if(savedOpen){const item=state.saved[Number(savedOpen.dataset.savedOpen)];$('listDialog').close();selectArticle(item.id,item.va);window.scrollTo({top:0});}
    });
    $('searchTrigger').addEventListener('click',openSearch);
    $('openKnowledge').addEventListener('click',()=>{$('knowledgeDialog').showModal();});
    $('openProductImage').addEventListener('click',()=>{$('imageTitle').textContent=currentArticle().title;$('imageSource').textContent=currentArticle().image.source+' · '+$('productCaption').textContent+' · erfasst '+currentArticle().image.captured_at;$('imageDialogBody').innerHTML=drawing(currentArticle().icon,true);$('imageDialog').showModal();});
    $('searchInput').addEventListener('input',()=>{++searchRequest;state.results=[];clearTimeout(searchTimer);searchTimer=setTimeout(renderSearch,180);});
    document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{state.filter=button.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));renderSearch();$('searchInput').focus();}));
    $('searchResults').addEventListener('focusin',e=>{const option=e.target.closest('[data-result]');if(option) activateResult(Number(option.dataset.result));});
    $('searchDialog').addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();$('searchDialog').close();}});
    $('searchDialog').addEventListener('keydown',e=>{if(e.target!==$('searchInput') && !e.target.closest('.search-result')) return;if(e.key==='ArrowDown'){e.preventDefault();activateResult(state.activeResult+1);}else if(e.key==='ArrowUp'){e.preventDefault();activateResult(state.activeResult-1);}else if(e.key==='Enter'){e.preventDefault();chooseSearchResult(state.activeResult);}});
    document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();if(!$('searchDialog').open) openSearch();}if(e.key==='Escape') closeSidebar();});
    document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}));
    document.querySelectorAll('[data-tab]').forEach(button=>{
      button.addEventListener('click',()=>setTab(button.dataset.tab));
      button.addEventListener('keydown',e=>{const tabs=['composition','properties','description'],i=tabs.indexOf(state.tab);if(['ArrowRight','ArrowLeft','Home','End'].includes(e.key)){e.preventDefault();setTab(e.key==='Home'?tabs[0]:e.key==='End'?tabs[2]:tabs[(i+(e.key==='ArrowRight'?1:2))%3],true);}});
    });
    $('savePosition').addEventListener('click',()=>{const a=currentArticle();if(a.kind==='assembly')return;const exists=state.saved.some(i=>savedKey(i.id,i.va)===savedKey(a.id,state.va));if(exists){openList();return;}state.saved.push({id:a.id,va:state.va});persistSaved();updateSaveButton();toast('Position zu den Favoriten hinzugefügt.');});
    $('copyNumber').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(currentArticle().number);toast('Artikelnummer kopiert.');}catch{toast(`Artikelnummer: ${numberLabel(currentArticle().number)}`);}});
    $('exportList').addEventListener('click',()=>{
      const data={format:'BIM2STEIGER-Favoriten',version:1,catalogue_year:2026,exported_at:new Date().toISOString(),note:'Favoriten, keine fertige Ausschreibung. BKP, Mengen und Einheiten sind noch festzulegen.',positions:state.saved.map(item=>{const a=catalogue.find(x=>x.id===item.id) || {number:item.id,title:item.id,icon:'box'};return{number:a.number,va:item.va,name:a.title,source:'Steiger 2026',unit:null};})};
      const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='BIM2STEIGER_Favoriten.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    });
    $('menuToggle').addEventListener('click',()=>{const open=document.body.classList.toggle('nav-open');$('menuToggle').setAttribute('aria-expanded',String(open));});
    $('sidebarShade').addEventListener('click',closeSidebar);
    $('catalogueHome').addEventListener('click',()=>{selectArticle('112001','00');window.scrollTo({top:0});});
    function readHash() {const parts=location.hash.match(/^#position\/([^/]+)(?:\/([^/]+))?(?:\/([^/]+))?$/);if(parts){try{return selectArticle(decodeURIComponent(parts[1]),parts[2]?decodeURIComponent(parts[2]):null,false,parts[3]?decodeURIComponent(parts[3]):null);}catch{}}return selectArticle('112001','00',false);}
    window.addEventListener('hashchange',readHash);
    async function start() {
      $('detailStatus').textContent='Katalog wird verbunden …';$('savePosition').disabled=true;$('addTender').disabled=true;$('copyNumber').disabled=true;$('openProductImage').disabled=true;
      try {
        const data=await Promise.all([api('/api/meta'),api('/api/catalogue'),api('/images/inventory.json')]);
        [metadata,,imageInventory]=data;
        catalogue=data[1].map(a=>({...a,id:a.number,title:a.name,icon:componentIcon(a.name),kind:a.complete_position?'complete':a.source_kind==='composition_only'?'assembly':'single',section:a.chapters[0]?.slice(1).join(' / ') || 'Kalkulationskomponenten'}));
        await readHash();renderTree();setTab(state.tab);
      }catch(error){$('detailStatus').textContent='Katalog nicht verfügbar. Bitte server.py starten und diese Ansicht über http://127.0.0.1:8765/bim2steiger.html öffnen. '+error.message;}
    }
    
    start();
