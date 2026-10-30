'use strict';
    // API adapter for the complete local catalogue, using the approved Beta layout.
    const dataset={assets:{photos:{}}};
    const articles=[],byKey=new Map(),detailCache=new Map(),detailLoads=new Map(),failedFavorites=new Set();
    let metadata={},currentDetail=null,activeArticle=null,navRecords=[],imageInventory=[],imageIndex=new Map(),chapterImages=new Map(),catalogueNodes=new Map(),catalogueRoots=new Map(),groupExtensions=new Map(),catalogueNotes=[],cataloguePdfs=new Map(),detailRequest=0,searchRequest=0,searchTimer,revealTree=()=>{},refillTree=()=>{},savedSidebarWidth=null,savedCatalogueYear=null,savedTenderYear=null;
    const localUrl=path=>location.pathname.startsWith('/tools/bim2steiger/')&&path.startsWith('/')?'/tools/bim2steiger'+path:path;
    let pendingToolRequests=0;
    const api=async(path,body)=>{pendingToolRequests++;try{const response=await fetch(localUrl(path),body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});const value=await response.json();if(!response.ok)throw Error(value.error||'Anfrage fehlgeschlagen');return value;}finally{pendingToolRequests--;}};
    const $=id=>document.getElementById(id);
    const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const labelHtml=v=>esc(String(v??'').replace(/[A-Za-zÄÖÜäöü]{18,}/g,word=>word.replace(/(geräte|kombination|verteil|installation|leitung|schalter|sicherung|beleucht|komponente|artikel)(?=[A-Za-zÄÖÜäöü]{6,})/gi,'$1\u0000'))).replaceAll('\u0000','<wbr>');
    const icon=(name,extra='')=>`<svg class="icon ${extra}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
    const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/ß/g,'ss');
    const compact=v=>norm(v).replace(/[\s.\-/]/g,'');
    const number=v=>String(v).length===6?String(v).replace(/(\d{3})(\d{3})/,'$1 $2'):String(v);
    const eNumber=v=>v?String(v).replace(/^(\d{3})(\d{3})(\d{3})$/,'$1 $2 $3'):'—';
    const qty=v=>String(v);
    const state={searchKind:'all',recipe:null,leafView:false,leaves:[],expanded:new Set(),selected:'112001/00',view:'article',chapter:'',tab:'composition',results:[],active:0,from:null,favorites:[],favoriteCategory:'all',favoriteList:'all',theme:document.documentElement.dataset.theme,knowledgePinned:false,sidebarWidth:null,catalogueYear:null,tenderCatalogueYear:null};
    const current=()=>activeArticle||byKey.get(state.selected);
    // Eigene Eingabe- und Bestätigungsdialoge; das Programmfenster zeigt keine Browserdialoge.
    function askDialog({title,text='',label='',value=null,submit='Speichern'}){
      return new Promise(resolve=>{
        const dialog=$('askDialog'),input=$('askInput');
        $('askTitle').textContent=title;$('askText').textContent=text;$('askText').hidden=!text;
        $('askLabelWrap').hidden=value===null;$('askLabel').textContent=label;input.value=value??'';input.required=value!==null;$('askSubmit').textContent=submit;
        dialog.returnValue='';
        dialog.addEventListener('close',()=>resolve(dialog.returnValue==='ok'?(value===null?true:input.value.trim()):null),{once:true});
        dialog.showModal();(value===null?$('askSubmit'):input).focus();if(value!==null)input.select();
      });
    }
    const askText=(title,label,value='')=>askDialog({title,label,value});
    const askConfirm=async(title,text,submit='Bestätigen')=>!!(await askDialog({title,text,submit}));
    let toastTimer;
    function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2500);}
    // Favoriten werden nach dem Laden der Navigation aus beiden bestehenden Ansichten übernommen.
    // Notizen und eigene Listen liegen getrennt vom bisherigen Favoritenschlüssel.
    const favoriteExtraKey='bim2steiger:favoriten-extra:v1';
    let favoriteExtra={notes:{},lists:[]};
    try{const saved=JSON.parse(localStorage.getItem(favoriteExtraKey)||'null');if(saved&&typeof saved.notes==='object'&&Array.isArray(saved.lists))favoriteExtra=saved;}catch{}
    function saveFavoriteExtra(){try{localStorage.setItem(favoriteExtraKey,JSON.stringify(favoriteExtra));}catch{toast('Notizen können lokal nicht gespeichert werden. Bitte Favoriten als JSON sichern.');}}
    function forgetFavorite(key){delete favoriteExtra.notes[key];for(const list of favoriteExtra.lists)list.keys=list.keys.filter(k=>k!==key);saveFavoriteExtra();}
    function saveFavorites(){try{localStorage.setItem('bim2steiger:merkliste:v1',JSON.stringify(state.favorites.map(key=>{const [id,va]=key.split('/');return {id,va};})));}catch{toast('Lokale Speicherung ist nicht verfügbar. Bitte Favoriten als JSON sichern.');}}
    // Anzeigeeinstellungen und Favoriten verwenden getrennte, bestehende lokale Speicherbereiche.
    try{const preferences=JSON.parse(localStorage.getItem('bim2steiger:beta:preferences:v1')||'{}');state.knowledgePinned=preferences?.knowledgePinned===true;if(Number.isFinite(preferences?.sidebarWidth))savedSidebarWidth=preferences.sidebarWidth;if(Number.isFinite(preferences?.catalogueYear))savedCatalogueYear=preferences.catalogueYear;if(Number.isFinite(preferences?.tenderCatalogueYear))savedTenderYear=preferences.tenderCatalogueYear;}catch{}
    function savePreferences(){try{const payload={theme:state.theme,knowledgePinned:state.knowledgePinned};if(Number.isFinite(state.sidebarWidth))payload.sidebarWidth=state.sidebarWidth;if(Number.isFinite(state.catalogueYear))payload.catalogueYear=state.catalogueYear;if(Number.isFinite(state.tenderCatalogueYear))payload.tenderCatalogueYear=state.tenderCatalogueYear;localStorage.setItem('bim2steiger:beta:preferences:v1',JSON.stringify(payload));}catch{toast('Anzeigeeinstellungen können nicht dauerhaft gespeichert werden.');}}
    function applyTheme(){
      document.documentElement.dataset.theme=state.theme;
      const dark=state.theme==='dark',label=dark?'Tagmodus aktivieren':'Nachtmodus aktivieren';
      $('themeToggle').setAttribute('aria-pressed',String(dark));$('themeToggle').setAttribute('aria-label',label);$('themeToggle').title=label;
      $('themeToggle').innerHTML=icon(dark?'sun':'moon');
    }
    function setKnowledgePinned(pinned,{persist=true,show=false}={}){
      const panel=$('knowledgePanel'),dialog=$('knowledgeDialog');
      state.knowledgePinned=pinned;
      if(dialog.open)dialog.close();
      document.body.classList.toggle('help-pinned',pinned);
      if(pinned)document.querySelector('.layout').append(panel);else dialog.append(panel);
      $('pinKnowledge').setAttribute('aria-pressed',String(pinned));
      const label=pinned?'Wissen lösen':'Wissen anpinnen';$('pinKnowledge').setAttribute('aria-label',label);$('pinKnowledge').title=label;
      $('openKnowledge').setAttribute('aria-expanded',String(pinned));
      if(!pinned&&show){dialog.showModal();$('openKnowledge').setAttribute('aria-expanded','true');}
      if(persist)savePreferences();
    }
    function openKnowledge(){
      if(state.knowledgePinned){$('knowledgePanel').scrollIntoView({block:'nearest'});$('knowledgePanel').focus({preventScroll:true});return;}
      if(!$('knowledgeDialog').open)$('knowledgeDialog').showModal();
      $('openKnowledge').setAttribute('aria-expanded','true');
    }
    function closeKnowledge(){
      if(state.knowledgePinned)setKnowledgePinned(false);else $('knowledgeDialog').close();
      $('openKnowledge').setAttribute('aria-expanded','false');$('openKnowledge').focus({preventScroll:true});
    }
    // Katalogpfade kommen aus catalogue.json. Reine Kalkulationsbestandteile behalten eine eigene Gruppe.
    const categoryPaths=a=>a.catalogue_paths?.length?a.catalogue_paths:[['Kalkulationsbestandteile','Kalkulationsbestandteil']];
    function showView(view){
      if(view!=='article'){++detailRequest;$('programmeStatus').textContent='';}
      state.view=view;const reserved=catalogueReserved()&&(view==='article'||view==='chapter');
      $('catalogueReserve').hidden=!reserved;$('homeView').hidden=view!=='home';$('articleView').hidden=view!=='article'||reserved;$('chapterView').hidden=view!=='chapter'||reserved;$('favoritesView').hidden=view!=='favorites';$('projectView').hidden=view!=='ausschreibung';
      const active={navHome:'home',openFavorites:'favorites',sidebarFavorites:'favorites',navCatalogue:'chapter',openTender:'ausschreibung'};
      for(const [id,section] of Object.entries(active)){if(view===section)$(id).setAttribute('aria-current','page');else $(id).removeAttribute('aria-current');}
      document.querySelector('.catalogue-tree').hidden=view==='ausschreibung';document.querySelector('.catalogue-tree-head').hidden=view==='ausschreibung';
      const title={home:'Start',chapter:'Katalog',favorites:'Favoriten',ausschreibung:'Ausschreibung'}[view];
      document.title=(title?title+' · ':'')+'BIM2STEIGER';
    }
    function renderIdentitySearch(id,label,value,context=''){
      const link=$(id);link.hidden=!value;
      if(!value){link.removeAttribute('href');link.removeAttribute('aria-label');link.removeAttribute('title');return;}
      link.href='https://www.google.ch/search?'+new URLSearchParams({q:['"'+value+'"',context].filter(Boolean).join(' ')});
      const description=label+' '+value+' im Web suchen (neuer Tab)';
      link.setAttribute('aria-label',description);link.title=description;
    }
    const photoFor=a=>a.photo_key?byKey.get(a.photo_key):a.photo_id?a:null;
    const photoAsset=a=>a?.photo_id?dataset.assets.photos[a.photo_id]:null;
    const hasPicture=a=>!!(a?.schema||extensionOf(a));
    const preview=a=>{
      const extension=a.schema?null:extensionOf(a),file=a.schema||extension?.file;
      if(!file)return `<span role="img" aria-label="${esc(schemaNote(a))}" title="${esc(schemaNote(a))}">${icon(a.symbol)}</span>`;
      const note=extension?extensionNote(a,extension):'Artikelbild '+a.number;
      return `<img src="${esc(file)}" alt="${esc(note)}" title="${esc(note)}" class="original-preview" loading="lazy" decoding="async">`;
    };

    const chapterSort=(a,b)=>{const rank=node=>node.document&&!node.numbers.size?1:0,delta=rank(a)-rank(b);if(delta)return delta;return (chapterImages.get(chapterKey(a.path))?.index||a.label).localeCompare(chapterImages.get(chapterKey(b.path))?.index||b.label,'de-CH',{numeric:true});};
    function renderTree(){
      const roots=new Map(),nodes=new Map();let nodeId=0;
      catalogueNodes=new Map();catalogueRoots=roots;
      for(const a of navRecords)for(const path of a.chapters.length?a.chapters:[['Kalkulationsbestandteile','Kalkulationsbestandteil']]){
        let level=roots;path.forEach((label,index)=>{if(!level.has(label))level.set(label,{label,path:path.slice(0,index+1),children:new Map(),items:new Map(),numbers:new Set(),document:false,text:''});const node=level.get(label);node.numbers.add(a.number);if(index===path.length-1)node.items.set(a.number,a);level=node.children;});
      }
      for(const note of catalogueNotes){let level=roots;note.path.forEach((label,index)=>{if(!level.has(label))level.set(label,{label,path:note.path.slice(0,index+1),children:new Map(),items:new Map(),numbers:new Set(),document:true,text:'',pdf:''});const node=level.get(label);node.document=true;if(index===note.path.length-1){node.text=note.text||'';node.pdf=cataloguePdfs.get(chapterKey(note.path))||'';}level=node.children;});}
      const sectionCount=node=>node.document&&!node.numbers.size?(node.children.size||''):node.numbers.size;
      const branch=level=>[...level.values()].sort(chapterSort).map(node=>{const id=String(nodeId++),key=chapterKey(node.path),image=chapterImages.get(key);nodes.set(id,node);catalogueNodes.set(key,node);return `<details class="tree-section" data-tree-node="${id}" data-chapter-key="${esc(key)}"><summary><button type="button" class="tree-toggle" data-tree-toggle aria-expanded="false" aria-label="${esc(node.label)} aufklappen">${icon('chevron','chevron')}</button>${image?`<img class="chapter-icon" loading="lazy" decoding="async" src="${esc(image.file)}" alt="">`:''}<button type="button" class="tree-chapter" data-open-chapter="${esc(key)}">${labelHtml(node.label)}</button><span class="section-count mono">${sectionCount(node)}</span></summary><div class="tree-branch">${branch(node.children)}<div data-tree-items="${id}"></div></div></details>`;}).join('');
      $('catalogueTree').innerHTML=branch(roots);
      function fill(id,limit=40){const node=nodes.get(id),items=[...node.items.values()],shown=Math.max(limit,40);const host=document.querySelector(`[data-tree-node="${id}"]`);if(host)host.dataset.limit=String(shown);document.querySelector(`[data-tree-items="${id}"]`).innerHTML=items.slice(0,shown).map(nav=>{const va=nav.vas.includes('00')?'00':nav.vas[0],a=byKey.get(nav.number+'/'+va)||ensureArticle(nav.number,va,nav.name);return `<button class="tree-button ${nav.number===current()?.number?'selected':''}" data-select="${esc(a.key)}" data-number="${esc(a.number)}"><span class="tree-icon ${hasPicture(a)?'has-original':''}">${preview(a)}</span><span>${labelHtml(a.name)}<small>${number(a.number)}</small></span></button>`;}).join('')+(items.length>shown?`<button class="tree-button" data-tree-more="${id}" data-limit="${shown+40}">Weitere ${Math.min(40,items.length-shown)} anzeigen (${shown}/${items.length})</button>`:'');}
      refillTree=()=>{document.querySelectorAll('[data-tree-node][data-loaded]').forEach(el=>fill(el.dataset.treeNode,Number(el.dataset.limit||40)));if(state.view==='chapter')renderChapterPage();};
      const syncToggle=el=>{const button=el.querySelector(':scope > summary [data-tree-toggle]');if(button){button.setAttribute('aria-expanded',String(el.open));button.setAttribute('aria-label',el.querySelector('.tree-chapter')?.textContent+(el.open?' zuklappen':' aufklappen'));}};
      $('catalogueTree').querySelectorAll('[data-tree-node]').forEach(el=>el.addEventListener('toggle',()=>{syncToggle(el);if(el.open&&!el.dataset.loaded){fill(el.dataset.treeNode);el.dataset.loaded='true';}updateCollapse();}));
      $('catalogueTree').addEventListener('click',e=>{
        const toggle=e.target.closest('[data-tree-toggle]');
        if(toggle){e.preventDefault();e.stopPropagation();const details=toggle.closest('details');details.open=!details.open;return;}
        const chapter=e.target.closest('[data-open-chapter]');
        if(chapter){e.preventDefault();e.stopPropagation();showChapter(chapter.dataset.openChapter);return;}
        const more=e.target.closest('[data-tree-more]');if(more)fill(more.dataset.treeMore,Number(more.dataset.limit));
      });
      revealTree=number=>{for(const [id,node] of nodes)if(node.numbers.has(number)){const el=document.querySelector(`[data-tree-node="${id}"]`);el.open=true;if(node.items.has(number)){fill(id,Math.max(40,[...node.items.keys()].indexOf(number)+1));el.dataset.loaded='true';}}};
      $('sampleCount').textContent=`${metadata.catalogue_articles.toLocaleString('de-CH')} Katalogartikel · ${metadata.component_only_articles} Kalkulationsbestandteile`;
      updateCollapse();
    }
    // Tastatur im Katalogbaum: ↑/↓ wechseln, → aufklappen oder hinein, ← zuklappen oder zur Elternebene, Pos1/Ende.
    $('catalogueTree').addEventListener('keydown',e=>{
      if(!['ArrowDown','ArrowUp','ArrowRight','ArrowLeft','Home','End'].includes(e.key)||e.altKey||e.ctrlKey||e.metaKey)return;
      const item=e.target.closest('.tree-chapter,.tree-button');if(!item)return;
      const items=[...$('catalogueTree').querySelectorAll('.tree-chapter,.tree-button')].filter(el=>el.offsetParent!==null);
      const index=items.indexOf(item),details=item.closest('details'),chapter=item.classList.contains('tree-chapter');
      const parentChapter=()=>(chapter?details.parentElement.closest('details'):details)?.querySelector(':scope > summary .tree-chapter');
      let target=null;e.preventDefault();
      if(e.key==='ArrowDown')target=items[index+1];
      else if(e.key==='ArrowUp')target=items[index-1];
      else if(e.key==='Home')target=items[0];
      else if(e.key==='End')target=items.at(-1);
      else if(e.key==='ArrowRight'&&chapter){if(!details.open)details.open=true;else target=items[index+1];}
      else if(e.key==='ArrowLeft'){if(chapter&&details.open)details.open=false;else target=parentChapter();}
      if(target){target.focus();target.scrollIntoView({block:'nearest'});}
    });
    function updateCollapse(){const open=document.querySelector('#catalogueTree details[open]');$('collapseTree').disabled=!open;}
    function markChapter(key){
      document.querySelectorAll('.tree-section.selected,.tree-chapter.selected').forEach(el=>el.classList.remove('selected'));
      document.querySelectorAll('.tree-chapter[aria-current]').forEach(el=>el.removeAttribute('aria-current'));
      if(!key)return;
      const section=[...document.querySelectorAll('[data-chapter-key]')].find(el=>el.dataset.chapterKey===key);
      if(!section)return;
      section.classList.add('selected');
      const button=section.querySelector(':scope > summary .tree-chapter');
      if(button){button.classList.add('selected');button.setAttribute('aria-current','true');}
    }
    function chapterForArticle(articleNumber){
      let found='';
      for(const [key,node] of catalogueNodes)if(node.items.has(articleNumber)&&key.length>=found.length)found=key;
      return found;
    }
    function articleButton(nav){
      const va=nav.vas.includes('00')?'00':nav.vas[0],a=byKey.get(nav.number+'/'+va)||ensureArticle(nav.number,va,nav.name);
      return `<button class="chapter-article" type="button" data-select="${esc(a.key)}" data-number="${esc(a.number)}"><span class="tree-icon ${hasPicture(a)?'has-original':''}">${preview(a)}</span><span class="chapter-article-name">${labelHtml(a.name)}</span><span class="mono">${number(a.number)}</span><span class="va-pill mono">VA ${esc(va)}</span></button>`;
    }
    function renderChapterPage(){
      const node=state.chapter?catalogueNodes.get(state.chapter):null;
      if(state.chapter&&!node){$('chapterTitle').textContent='Katalog';$('chapterSubtitle').textContent='Diese Kategorie ist nicht im lokalen Katalog.';$('chapterBody').innerHTML='';return;}
      const path=node?node.path:[];
      const crumbs=['Katalog',...path];
      $('chapterBreadcrumb').innerHTML=crumbs.map((label,index)=>{const target=index===0?'':crumbs.slice(1,index+1).join(' › ');const current=index===crumbs.length-1;return `${index?icon('chevron'):''}${current?`<span>${esc(label)}</span>`:`<button type="button" class="source-link" data-open-chapter="${esc(target)}">${esc(label)}</button>`}`;}).join('');
      $('chapterTitle').textContent=node?node.label:'Katalog';
      const children=[...(node?node.children:catalogueRoots).values()].sort(chapterSort);
      const leaves=children.length>0&&children.every(child=>child.children.size===0);
      const countLabel=count=>count.toLocaleString('de-CH')+' '+(count===1?'Position':'Positionen');
      const documentNode=!!(node&&node.document&&!node.numbers.size);
      $('chapterSubtitle').textContent=node?.pdf?'Originalseite aus dem Steiger-Katalog 2026.':documentNode?'Text aus dem Steiger-Katalog 2026.':node?countLabel(node.numbers.size)+' in diesem Kapitel. Ein Klick öffnet die Position.':'Kapitel des lokalen Katalogs. Ein Klick öffnet die nächste Ebene auf dieser Seite.';
      const groups=documentNode||!leaves?`<div class="chapter-cards">${children.map(child=>chapterCard(child)).join('')}</div>`:children.map(child=>`<section class="chapter-group"><button type="button" class="chapter-group-head" data-open-chapter="${esc(chapterKey(child.path))}"><strong>${esc(child.label)}</strong><span class="count">${child.numbers.size.toLocaleString('de-CH')}</span></button><div>${[...child.items.values()].sort((a,b)=>a.number.localeCompare(b.number,'de-CH',{numeric:true})).map(articleButton).join('')}</div></section>`).join('');
      const direct=node?[...node.items.values()].sort((a,b)=>a.number.localeCompare(b.number,'de-CH',{numeric:true})):[];
      const pdfFrame=node?.pdf?`<iframe class="catalogue-pdf" title="${esc(node.label)}" src="${esc(node.pdf)}#view=FitH"></iframe>`:'';
      const noteText=!pdfFrame&&node?.text?`<div class="original-text catalogue-note">${linkCatalogueNote(node.text)}</div>`:'';
      $('chapterBody').innerHTML=pdfFrame+noteText+(direct.length?`<section class="chapter-group"><div class="chapter-group-head"><strong>Positionen in diesem Kapitel</strong><span class="count">${direct.length}</span></div><div>${direct.map(articleButton).join('')}</div></section>`:'')+(children.length?`<div class="chapter-groups">${groups}</div>`:'');
      markChapter(state.chapter);
    }
    // Kapitelkarte mit Kapitelillustration aus chapters.json, sofern vorhanden.
    function linkCatalogueNote(text){
      if(!linkCatalogueNote.numbers)linkCatalogueNote.numbers=new Set(navRecords.map(article=>article.number));
      const known=linkCatalogueNote.numbers,tokens=[];
      const mark=(label,value)=>{tokens.push({label,value});return `\u0000${tokens.length-1}\u0000`;};
      const body=esc(text).replace(/\b(\d{3}) (\d{3})\b/g,(match,left,right)=>known.has(left+right)?mark(match,left+right):match).replace(/\b(\d{4,6})\b/g,(match,value)=>known.has(value)?mark(match,value):match);
      return body.replace(/\u0000(\d+)\u0000/g,(_,index)=>{const token=tokens[Number(index)];return `<button type="button" class="source-link" data-select="${esc(token.value)}">${token.label}</button>`;});
    }
    function chapterCard(child){
      const key=chapterKey(child.path),image=chapterImages.get(key),documentNode=child.document&&!child.numbers.size;
      const count=documentNode?child.children.size:child.numbers.size;
      const detail=documentNode?(child.children.size?child.children.size.toLocaleString('de-CH')+' Abschnitte':(child.pdf?'Original-PDF':'Katalogtext')):`${child.children.size?child.children.size.toLocaleString('de-CH')+' Unterkapitel · ':''}${count.toLocaleString('de-CH')} ${count===1?'Position':'Positionen'}`;
      return `<button type="button" class="chapter-card" data-open-chapter="${esc(key)}">${image?`<img class="chapter-card-image" src="${esc(image.file)}" alt="" loading="lazy" decoding="async">`:`<span class="chapter-card-image">${icon(documentNode?'book':'layers')}</span>`}<span><strong>${esc(child.label)}</strong><small>${detail}</small></span><span class="count">${documentNode&&!count?'':count.toLocaleString('de-CH')}</span></button>`;
    }
    function showChapter(key,{hash=true}={}){
      if(key&&!catalogueNodes.has(key)){toast('Diese Kategorie ist nicht im lokalen Katalog.');return;}
      showView('chapter');state.chapter=key||'';
      const section=key?[...document.querySelectorAll('[data-chapter-key]')].find(el=>el.dataset.chapterKey===key):null;
      if(section)section.open=true;
      renderChapterPage();
      if(hash){const next=key?'#katalog/'+encodeURIComponent(key):'#katalog';if(location.hash!==next)location.hash=next;}
      closeSidebar();window.scrollTo({top:0});$('chapterTitle').focus({preventScroll:true});
    }
    function setTab(name,focus=false){state.tab=name;document.querySelectorAll('[data-tab]').forEach(b=>{const active=b.dataset.tab===name;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;if(active&&focus)b.focus();});document.querySelectorAll('[role=tabpanel]').forEach(p=>p.hidden=p.id!==`panel-${name}`);}
    function otherVas(number,va){
      const seen=new Set();
      for(const image of imageIndex.get(String(number))||[])if(image.va&&image.va!==String(va))seen.add(image.va);
      return [...seen];
    }
    function schemaNote(a){
      const others=otherVas(a.number,a.va);
      return 'Schema aus der Bezeichnung. Kein Originalbild für diese VA.'+(others.length?` Originalbild gibt es für VA ${others.slice(0,3).join(', ')}.`:'');
    }
    function sketchKind(text){
      const t=String(text||'').toLowerCase();
      if(/verteil|schrank|kombination/.test(t))return 'board';
      if(/litze|\bdraht\b|ader/.test(t))return 'wire';
      if(/abdeck|streifen|blende/.test(t))return 'strip';
      if(/kabel|leitung|\brohr\b/.test(t))return 'cable';
      if(/leucht/.test(t))return 'light';
      if(/schalter|taster|dimmer/.test(t))return 'switch';
      if(/sicherung|schutzschalter|fi-ls|ls-sch/.test(t))return 'breaker';
      return 'part';
    }
    function coreCount(text){
      const match=String(text||'').match(/(\d+)\s*x\s*\d/i);
      const count=match?Number(match[1]):0;
      return count>=2&&count<=7?count:0;
    }
    function sketch(article){
      const text=[article.name,article.subtitle,article.text].filter(Boolean).join(' ');
      const kind=sketchKind(text);
      const mark='<text x="80" y="118" text-anchor="middle" font-size="9" fill="#6d84a8" font-family="Segoe UI,Arial,sans-serif">Schema</text>';
      const cores=coreCount(text)||(kind==='wire'?1:3);
      const dots=Array.from({length:cores},(_,index)=>{
        const angle=-Math.PI/2+index*2*Math.PI/cores,cx=80+Math.cos(angle)*16,cy=52+Math.sin(angle)*16;
        return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="6" fill="#d08a45" stroke="#8a5a28"/>`;
      }).join('');
      const drawings={
        board:'<rect x="28" y="16" width="104" height="86" rx="6" fill="#f4f7fd" stroke="#315ce7" stroke-width="2"/><rect x="38" y="26" width="84" height="14" rx="2" fill="#fff" stroke="#8aa0c8"/><circle cx="48" cy="33" r="3.5" fill="#315ce7"/><rect x="38" y="46" width="18" height="28" rx="2" fill="#fff" stroke="#315ce7"/><rect x="60" y="46" width="18" height="28" rx="2" fill="#fff" stroke="#315ce7"/><rect x="82" y="46" width="18" height="28" rx="2" fill="#fff" stroke="#315ce7"/><rect x="104" y="46" width="18" height="28" rx="2" fill="#e7eefc" stroke="#315ce7"/><path d="M38 84h84" stroke="#c5d2e8"/>',
        cable:`<circle cx="80" cy="52" r="34" fill="#243044"/><circle cx="80" cy="52" r="26" fill="#315ce7" opacity=".35"/>${dots}`,
        wire:'<rect x="24" y="40" width="112" height="24" rx="12" fill="#243044"/><rect x="24" y="46" width="78" height="12" rx="6" fill="#d08a45"/><circle cx="34" cy="52" r="4" fill="#f0c08a"/>',
        strip:'<rect x="22" y="46" width="116" height="16" rx="3" fill="#e7eefc" stroke="#315ce7" stroke-width="2"/><path d="M32 46v16M48 46v16M64 46v16M80 46v16M96 46v16M112 46v16" stroke="#8aa0c8"/>',
        light:'<path d="M62 78h36l-4 10H66l-4-10Z" fill="#f4f7fd" stroke="#315ce7" stroke-width="2"/><path d="M58 46a22 22 0 1 1 44 0c0 10-6 16-10 22H68c-4-6-10-12-10-22Z" fill="#fff8e8" stroke="#315ce7" stroke-width="2"/><path d="M74 92h12" stroke="#315ce7" stroke-width="2"/>',
        switch:'<rect x="46" y="22" width="68" height="78" rx="8" fill="#f4f7fd" stroke="#315ce7" stroke-width="2"/><rect x="62" y="40" width="36" height="22" rx="11" fill="#fff" stroke="#315ce7" stroke-width="2"/><circle cx="74" cy="51" r="5" fill="#315ce7"/>',
        breaker:'<rect x="58" y="16" width="44" height="88" rx="4" fill="#f4f7fd" stroke="#315ce7" stroke-width="2"/><rect x="70" y="28" width="20" height="16" rx="2" fill="#fff" stroke="#8aa0c8"/><path d="M80 52v18" stroke="#315ce7" stroke-width="3"/><circle cx="80" cy="76" r="6" fill="#315ce7"/>',
        part:'<rect x="40" y="20" width="80" height="80" rx="8" fill="#f4f7fd" stroke="#315ce7" stroke-width="2"/><path d="M58 60h44M80 38v44" stroke="#8aa0c8" stroke-width="2"/>'
      };
      return `<svg class="schema-sketch" viewBox="0 0 160 124" role="img" aria-hidden="true">${drawings[kind]||drawings.part}${mark}</svg>`;
    }
    function extensionOf(article){return article.schema?null:groupExtensions.get(String(article.number))||null;}
    function extensionNote(article,extension){return `Erweiterung von Artikel ${number(extension.from)} in der Gruppe ${extension.group}. Diese Position hat kein eigenes Katalogbild; das Bild gehört zur Ausgangsposition.`;}
    function renderMedia(a){
      const extension=extensionOf(a);
      const sketching=!a.schema&&!extension;
      $('schemaStage').classList.toggle('is-sketch',sketching);
      if(extension){
        const note=extensionNote(a,extension);
        $('schemaStage').innerHTML=`<img class="schema-image" src="${esc(extension.file)}" alt="Bild der Gruppe ${esc(extension.group)}">${icon('search','thumbnail-zoom')}`;
        $('schemaStage').title=note;$('schemaStage').setAttribute('aria-label',note);
        $('photoActions').innerHTML=`<span class="media-missing">${esc(note)}</span>`;
        return;
      }
      if(sketching){
        const note=schemaNote(a);
        $('schemaStage').innerHTML=sketch(a);
        $('schemaStage').title=note;$('schemaStage').setAttribute('aria-label',note);
      }else{
        $('schemaStage').innerHTML=`<img class="schema-image" src="${esc(a.schema)}" alt="Artikelbild ${esc(a.number)}">${icon('search','thumbnail-zoom')}`;
        $('schemaStage').title='Artikelbild vergrössern';$('schemaStage').setAttribute('aria-label','Artikelbild vergrössern');
      }
      const extras=(a.media||[]).filter(i=>i.file&&i.file!==a.schema);
      const pictures=extras.map((item,index)=>{
        const wide=item.width&&item.height&&item.width/item.height>1.6;
        const name=item.role||(item.kind==='product'?'Produktfoto':'Bild');
        return `<button class="article-thumbnail${wide?' wide-thumb':''}" type="button" data-zoom="media" data-media-index="${index}" aria-label="${esc(name)} vergrössern" title="${esc(name)}"><img class="schema-image" src="${esc(item.file)}" alt="">${icon('search','thumbnail-zoom')}</button>`;
      }).join('');
      $('photoActions').innerHTML=(sketching?`<span class="media-missing">${esc(schemaNote(a))}</span>`:'')+pictures;
    }
    function renderComposition(a){
      const d=currentDetail,r=d?.recipe;
      const tab=$('tab-composition');
      if(tab.firstChild)tab.firstChild.textContent=r?'Besteht aus':'Einzelteil';
      $('componentCount').hidden=!r;
      $('componentCount').textContent=r?String(r.items.length):'';
      if(!r){$('panel-composition').innerHTML=`<div class="empty-state">${icon('layers')}<p>Einzelteil ohne eigene Zusammensetzung.</p><p>${d?.portal_details?.rows?.length?'Eine zusätzliche Original-Kalkulation ist als Quelle in den Stammdaten einsehbar.':'Die Kennungen stammen aus der Kalkulation, in der dieses Teil vorkommt.'}</p></div>`;return;}
      const rows=[];
      const row=(item,level,path,edge='')=>{
        const part=ensureArticle(item.number,item.va,item.name),nested=item.recipe&&d.graph[item.recipe];
        const expanded=state.expanded.has(path),quantity=state.leafView?item.quantity:(item.quantity_raw??item.quantity);
        const classes=[level?'composition-nested':'',edge].filter(Boolean).join(' ');
        rows.push(`<tr${classes?` class="${classes}"`:''} style="--nest:${level}" data-part="${esc(part.key)}" ${item.recipe?`data-part-recipe="${esc(item.recipe)}"`:''}><td><span class="component-symbol ${hasPicture(part)?'has-original':''}">${preview(part)}</span></td><td class="component-name"><div class="component-name-inner">${nested?`<button class="recipe-toggle" data-recipe-toggle="${esc(path)}" aria-expanded="${expanded}" aria-label="Unterbaugruppe ${esc(item.name)} ${expanded?'zuklappen':'aufklappen'}">${icon('chevron')}</button>`:`<span class="recipe-toggle recipe-toggle-spacer" aria-hidden="true"></span>`}<button class="part-link" data-part="${esc(part.key)}" ${item.recipe?`data-part-recipe="${esc(item.recipe)}"`:''}>${esc(item.name)}</button></div>${state.leafView?`<details class="component-context"><summary>Rezeptpfad und Materialstatus</summary>${esc(item.path.join(' → '))}<br>${item.material_counted?'Materiallieferung berücksichtigt':'Keine zusätzliche Materiallieferung'} · Einheit ${esc(item.unit||'nicht ausgewiesen')}</details>`:''}</td><td class="identity-cell mono">${number(item.number)}</td><td class="identity-cell mono">${esc(eNumber(item.eldas))}</td><td class="identity-cell mono">${esc(item.manufacturer_number||'—')}</td><td><span class="va-pill mono">${esc(item.va)}</span></td><td class="quantity mono ${Number(quantity)<0?'negative':''}">${esc(qty(quantity))}</td><td><span class="row-arrow" title="Position öffnen">${icon('arrow')}</span></td></tr>`);
        if(nested&&expanded)nested.items.forEach((child,index)=>row(child,level+1,path+'.'+index,[index===0?'nest-start':'',index===nested.items.length-1?'nest-end':''].filter(Boolean).join(' ')));
      };
      if(state.leafView)state.leaves.forEach((item,index)=>row(item,0,'leaf'+index));else r.items.forEach((item,index)=>row(item,0,String(index)));
      $('panel-composition').innerHTML=`<div class="section-heading"><h3>${state.leafView?'Überprüfbare Endbestandteile':'Zusammensetzung'}</h3><p>${state.leafView?'Je 1 Stammposition. Mengen über alle Ebenen multipliziert; Elternbaugruppen nicht zusätzlich addiert.':'Mengen gelten je direktem Elternteil. Der linke Pfeil klappt die Unterbaugruppe auf, der rechte öffnet die Position.'}</p></div>`+(rows.length?`<div class="composition-scroll" role="region" aria-label="Bauteile der Position, horizontal scrollbar" tabindex="0"><table class="composition-table"><thead><tr><th scope="col"><span class="sr-only">Symbol</span></th><th scope="col">Name</th><th scope="col">Artikelnummer</th><th scope="col">E-Nr.</th><th scope="col">B-Nr.</th><th scope="col">VA</th><th scope="col">Menge</th><th scope="col"><span class="sr-only">Details</span></th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`:`<p class="empty-state">Keine weitere Unterteilung erfasst. Die Original-Kalkulationssumme steht in den Stammdaten; «Endbestandteile» verwendet diese Quelle.</p>`)+`<details class="table-help"><summary>Hinweise und Herkunft</summary><p>Negative Mengen bleiben Abzüge. Fehlende Einheiten und Preise werden nicht ergänzt. Verwendetes Rezept: <span class="mono">${esc(r.id)}</span>.</p></details>`;
    }
    function renderFavoriteButton(){const saved=state.favorites.includes(state.selected);$('saveFavorite').setAttribute('aria-pressed',String(saved));$('saveFavorite').classList.toggle('primary',!saved);$('saveFavorite').innerHTML=icon(saved?'check':'plus')+`<span>${saved?'In deinen Favoriten':'Zu Favoriten hinzufügen'}</span>`;$('favoriteCount').textContent=state.favorites.length;$('sidebarFavoriteCount').textContent=state.favorites.length;}
    // Brotkrümel folgen dem Original-Katalogpfad; jede Ebene öffnet das Kapitel.
    function renderArticleBreadcrumb(a){
      const path=a.catalogue_paths?.[0]||[];
      const link=(label,key)=>`<button type="button" class="source-link" data-open-chapter="${esc(key)}">${esc(label)}</button>`;
      $('articleBreadcrumb').innerHTML=[link('Katalog',''),...path.map((label,index)=>catalogueNodes.has(chapterKey(path.slice(0,index+1)))?link(label,chapterKey(path.slice(0,index+1))):`<span>${esc(label)}</span>`)].join(icon('chevron'));
    }
    function paintArticle(key,{from=null,hash=true}={}){
      const a=byKey.get(key);if(!a){toast('Diese Position ist nicht im lokalen Katalog vorhanden.');return;}
      showView('article');state.selected=key;state.from=from;
      if(hash)location.hash='position/'+key;
      rememberRecent(key);
      $('articleCode').textContent=number(a.number);$('articleCode').setAttribute('aria-label','Artikelnummer '+a.number);$('articleTitle').textContent=a.name;$('articleSubtitle').textContent=a.subtitle;
      $('kindBadge').textContent=a.complete?'Komplettposition':'Bestandteil';renderArticleBreadcrumb(a);
      renderIdentifierChoices(a);$('eNumber').textContent=eNumber(a.e_nr);$('bNumber').textContent=a.b_nr||'—';
      renderIdentitySearch('eNumberSearch','E-Nr.',a.e_nr);renderIdentitySearch('bNumberSearch','B-Nr.',a.b_nr,a.name);
      $('identityNote').textContent='Für diese Position sind keine E-/B-Nummern im Katalog erfasst.';
      $('identityNote').parentElement.hidden=!!(a.e_nr||a.b_nr);$('identities').hidden=!(a.e_nr||a.b_nr);
      const variants=(currentDetail?.variants||[]).map(v=>({key:a.number+'/'+v.va,va:v.va}));$('vaSelect').innerHTML=variants.map(v=>`<option value="${esc(v.key)}" ${v.key===key?'selected':''}>${esc(v.va)}</option>`).join('');
      renderMedia(a);renderComposition(a);renderFavoriteButton();
      const properties=[['Steiger-Artikelnummer',a.number],['E-Nr.',eNumber(a.e_nr)],['B-Nr. / Bestellnummer',a.b_nr||'—'],['Verlegungsart (VA)',a.va],['Mengeneinheit',a.unit||'In der Quelle nicht ausgewiesen'],['Herkunft',a.source]];
      $('panel-properties').innerHTML=`<div class="section-heading"><div><h3>Stammdaten dieser Position</h3><p>Originalnummern bleiben als Zeichenketten erhalten.</p></div></div><dl class="properties">${properties.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`;
      $('panel-description').innerHTML=`<div class="section-heading"><div><h3>Originaler Artikeltext</h3><p>Gespeicherter Steiger-Katalogstand 2026.</p></div></div><p class="original-text">${esc(a.text)}</p>`;
      const parent=from&&byKey.get(from);$('backToParent').hidden=!parent;if(parent)$('backToParent').querySelector('span').textContent=`Zurück zu ${number(parent.number)} · ${parent.name}`;
      document.querySelectorAll('.tree-button').forEach(b=>{const active=b.dataset.number===a.number;b.classList.toggle('selected',active);if(active)b.setAttribute('aria-current','true');else b.removeAttribute('aria-current');});revealTree(a.number);markChapter(chapterForArticle(a.number));
      closeSidebar();
    }
    function readHash(){
      if(!navRecords.length)return;
      if(!location.hash||location.hash==='#'||location.hash==='#start'){showHome({hash:false});return;}
      if(location.hash==='#favoriten'){showFavorites({hash:false});return;}
      if(location.hash==='#katalog'||location.hash.startsWith('#katalog/')){showChapter(location.hash==='#katalog'?'':decodeURIComponent(location.hash.slice('#katalog/'.length)),{hash:false});return;}
      const ausschreibung={ '#ausschreibung':'','#zuordnung':'zuordnung','#import':'dateiimport','#dateiimport':'dateiimport','#export':'uebergabe','#uebergabe':'uebergabe' };
      if(Object.hasOwn(ausschreibung,location.hash)){showAusschreibung({hash:false,scroll:ausschreibung[location.hash]});return;}
      try{
        const m=location.hash.match(/^#position\/([^/]+)(?:\/([^/]+))?(?:\/([^/]+))?$/),number=m?decodeURIComponent(m[1]):'',va=m?.[2]?decodeURIComponent(m[2]):null,recipe=m?.[3]?decodeURIComponent(m[3]):null;
        if(!m){showHome({hash:false});return;}
        const key=va?number+'/'+va:defaultKey(navRecords.find(a=>a.number===number));
        if(key!==state.selected||recipe!==state.recipe||!$('articleTitle').textContent||state.view!=='article')selectArticle(key,{hash:false,recipe});
      }catch(error){toast(error.message);}
    }
    function catalogueReserved(){return (metadata.editions||[]).some(edition=>edition.year===state.catalogueYear&&edition.status==='reserved');}
    function renderCatalogueChoices(){
      const editions=metadata.editions||[];
      if(!editions.length)return;
      if(!editions.some(edition=>edition.year===state.catalogueYear))state.catalogueYear=editions.find(edition=>edition.status==='available')?.year||editions[0].year;
      if(!editions.some(edition=>edition.year===state.tenderCatalogueYear))state.tenderCatalogueYear=state.catalogueYear;
      const catalogueSelect=$('catalogueSwitch');
      catalogueSelect.innerHTML=editions.map(edition=>`<option value="${edition.year}">${esc(edition.label||('Katalog '+edition.year))}${edition.status==='reserved'?' · Vorbehalt':''}</option>`).join('');
      catalogueSelect.value=String(state.catalogueYear);
      const select=$('tenderCatalogue'),lineSelect=$('tenderLineCatalogue');
      const options=editions.map(edition=>`<option value="${edition.year}">${edition.year}${edition.status==='reserved'?' · Vorbehalt':''}</option>`).join('');
      if(select){select.innerHTML=options;select.value=String(state.tenderCatalogueYear);}
      if(lineSelect){lineSelect.innerHTML=options;lineSelect.value=String(state.tenderCatalogueYear);}
      document.querySelectorAll('.catalogue-year').forEach(el=>{el.textContent=String(state.catalogueYear);});
      const index=document.querySelector('.position-index');if(index)index.textContent=`STEIGER / ${state.catalogueYear}`;
      const edition=editions.find(item=>item.year===state.catalogueYear);
      $('reserveTitle').textContent=`Katalog ${state.catalogueYear}`;
      $('reserveText').textContent=edition?.note||'Die Artikel dieses Jahrgangs sind noch nicht erfasst.';
      $('reserveBack').textContent=`Katalog ${metadata.year} öffnen`;
      const tenderEdition=editions.find(item=>item.year===state.tenderCatalogueYear);
      $('tenderCatalogueNote').textContent=tenderEdition?.status==='reserved'
        ?`Neue Positionen gehören zum vorgemerkten Katalog ${tenderEdition.year}. Der Artikeltext kommt bis zur Erfassung aus dem Katalog ${metadata.year}.`
        :`Neue Positionen gehören zum Katalog ${tenderEdition?.year||metadata.year}.`;
    }
    function applyCatalogueYear(year,{persist=true}={}){
      state.catalogueYear=Number(year);renderCatalogueChoices();
      if(persist)savePreferences();
      if(state.view)showView(state.view);
    }
    async function renderSearch(){
      const request=++searchRequest,query=$('searchInput').value.trim();state.results=[];state.active=0;
      if(catalogueReserved()){$('searchLabel').textContent='Katalog '+state.catalogueYear;$('searchCount').textContent='Vorbehalt';$('searchResults').innerHTML=`<div class="empty-state">${icon('layers')}<p>Katalog ${state.catalogueYear} ist vorgemerkt. Die Artikelsuche gilt für den erfassten Katalog ${metadata.year}.</p></div>`;return;}
      $('searchCount').textContent='Suche läuft …';$('searchInput').removeAttribute('aria-activedescendant');$('searchResults').innerHTML='';
      try{
        const filterVa=$('searchVa').value,imageOnly=$('searchImage').checked,filtered=!!(filterVa||imageOnly),limit=imageOnly?200:100;
        const result=await api('/api/search?'+new URLSearchParams({q:query,kind:state.searchKind,limit:String(limit),...(filterVa?{va:filterVa}:{})}));
        if(request!==searchRequest)return;
        const digits=compact(query);
        state.results=result.filter(item=>!filterVa||item.vas.some(v=>v.va===filterVa)).map(item=>{const matched=item.vas.find(v=>compact(item.number+v.va)===digits),va=filterVa||matched?.va||item.identifier_matches?.[0]?.va||(item.vas.some(v=>v.va==='00')?'00':item.vas[0]?.va);return {...ensureArticle(item.number,va,item.name),identifier_matches:item.identifier_matches||[]};}).filter(a=>!imageOnly||hasPicture(a)||a.photo_id).slice(0,100);
        $('searchLabel').textContent=query?'Suchergebnisse':'Katalog entdecken';$('searchCount').textContent=state.results.length+' Treffer'+(filtered?' · gefiltert':'')+(result.length===limit?' · Suche eingrenzen für mehr':'');
        $('searchResults').innerHTML=state.results.length?state.results.map((a,index)=>`<button class="search-result ${index===0?'active':''}" id="result-${index}" role="option" aria-selected="${index===0}" data-result="${index}"><span class="result-symbol ${hasPicture(a)?'has-original':''}">${preview(a)}</span><span><strong>${esc(a.name)}</strong><small><span class="mono">${number(a.number)} / VA ${esc(a.va)}</span> · ${a.complete?'Komplettposition':a.source_kind==='composition_only'?'Kalkulationsbestandteil':'Einzelartikel'}</small>${a.identifier_matches.length?`<small>E-Nr. ${esc(eNumber(a.identifier_matches[0].e_nr))} · B-Nr. ${esc(a.identifier_matches[0].b_nr||'—')}${a.identifier_matches.length>1?' · Weitere VA/Quellen im Detail':''}</small>`:''}</span>${icon('arrow')}</button>`).join(''):`<div class="empty-state">${icon('search')}<p>Keine passende Position im lokalen Katalog gefunden.</p></div>`;
        if(state.results.length)$('searchInput').setAttribute('aria-activedescendant','result-0');
      }catch(error){if(request===searchRequest){$('searchCount').textContent='Suche nicht verfügbar';$('searchResults').innerHTML=`<div class="empty-state">${esc(error.message)}</div>`;}}
    }
    function renderSearchVaOptions(){
      const counts=new Map();for(const a of navRecords)for(const va of a.vas)counts.set(va,(counts.get(va)||0)+1);
      const current=$('searchVa').value;
      $('searchVa').innerHTML='<option value="">Alle VA</option>'+[...counts].sort((a,b)=>a[0].localeCompare(b[0],'de-CH',{numeric:true})).map(([va,count])=>`<option value="${esc(va)}">VA ${esc(va)} · ${count.toLocaleString('de-CH')}</option>`).join('');
      $('searchVa').value=current;
    }
    function openSearch(){if($('searchVa').options.length<2)renderSearchVaOptions();renderSearch();$('searchDialog').showModal();$('searchInput').focus();}
    function activateResult(index){if(!state.results.length)return;state.active=(index+state.results.length)%state.results.length;document.querySelectorAll('.search-result').forEach((b,i)=>{b.classList.toggle('active',i===state.active);b.setAttribute('aria-selected',String(i===state.active));});const target=$('result-'+state.active);$('searchInput').setAttribute('aria-activedescendant',target.id);target.scrollIntoView({block:'nearest'});}
    async function chooseResult(index){const a=state.results[index];if(!a)return;$('searchDialog').close();if(await selectArticle(a.key))focusArticle();}
    function focusArticle(){$('articleTitle').tabIndex=-1;$('articleTitle').focus({preventScroll:true});window.scrollTo({top:0});}
    let imageFromHistory=false;
    function showPicture(title,subtitle,html){
      $('imageTitle').textContent=title;$('imageSubtitle').textContent=subtitle;$('imageBody').innerHTML=html;$('imageCaption').textContent='';
      if(!(history.state&&history.state.bim2steigerImage))$('imageDialog').open?null:history.pushState({bim2steigerImage:true},'');
      $('imageDialog').showModal();
    }
    function openImage(kind){
      const a=current();
      if(kind==='media')return;
      const subtitle=`Artikel ${number(a.number)} / VA ${a.va}`;
      if(!a.schema){const extension=extensionOf(a);if(extension){showPicture(a.name,subtitle,`<img src="${esc(extension.file)}" alt="Bild der Gruppe ${esc(extension.group)}">`);$('imageCaption').textContent=extensionNote(a,extension);return;}showPicture(a.name,subtitle,sketch(a));$('imageCaption').textContent=schemaNote(a);return;}
      showPicture(a.name,subtitle,`<img src="${esc(a.schema)}" alt="Artikelbild ${esc(a.number)}">`);
    }
    function openMedia(index){
      const a=current(),item=(a.media||[]).filter(i=>i.file&&i.file!==a.schema)[index];
      if(!item)return;
      showPicture(a.name,`Artikel ${number(a.number)} / VA ${a.va}`,`<img src="${esc(item.file)}" alt="${esc(a.name)}">`);
    }
    function renderFavorites(){
      if(state.favoriteList!=='all'&&!favoriteExtra.lists.some(l=>l.id===state.favoriteList))state.favoriteList='all';
      const activeList=favoriteExtra.lists.find(l=>l.id===state.favoriteList),shownKeys=activeList?state.favorites.filter(k=>activeList.keys.includes(k)):state.favorites;
      const listChip=(id,label,count)=>`<button class="favorite-filter" data-favorite-list="${esc(id)}" aria-pressed="${state.favoriteList===id}">${esc(label)}<span>${count}</span></button>`;
      $('favoriteLists').innerHTML=state.favorites.length?`<span class="favorite-lists-label">Listen</span>${listChip('all','Alle Favoriten',state.favorites.length)}${favoriteExtra.lists.map(l=>listChip(l.id,l.name,l.keys.filter(k=>state.favorites.includes(k)).length)).join('')}<button class="text-action" data-favorite-list-new>${icon('plus')}Neue Liste</button>${activeList?`<button class="text-action" data-favorite-list-rename>Umbenennen</button><button class="text-action" data-favorite-list-delete>Liste löschen</button>`:''}`:'';
      const groups=new Map();
      for(const key of shownKeys){
        const a=byKey.get(key);if(!a)continue;
        for(const path of categoryPaths(a)){
          const id=path.join(' › ');if(!groups.has(id))groups.set(id,{id,path,items:[]});
          if(!groups.get(id).items.some(item=>item.key===key))groups.get(id).items.push(a);
        }
      }
      const sorted=[...groups.values()].sort((a,b)=>a.id.localeCompare(b.id,'de-CH',{numeric:true}));
      if(state.favoriteCategory!=='all'&&!groups.has(state.favoriteCategory))state.favoriteCategory='all';
      $('favoritesSummary').textContent=state.favorites.length?`${state.favorites.length} ${state.favorites.length===1?'Favorit':'Favoriten'} · ${groups.size} ${groups.size===1?'Kategorie':'Kategorien'}`:'Deine persönliche Auswahl beginnt hier.';
      const filter=(id,label,count)=>`<button class="favorite-filter" data-favorite-filter="${esc(id)}" aria-pressed="${state.favoriteCategory===id}">${esc(label)}<span>${count}</span></button>`;
      $('favoriteFilters').innerHTML=shownKeys.length?filter('all','Alle Kategorien',shownKeys.length)+sorted.map(group=>filter(group.id,group.path.at(-1),group.items.length)).join(''):'';
      const visible=sorted.filter(group=>state.favoriteCategory==='all'||state.favoriteCategory===group.id);
      $('favoriteGroups').innerHTML=visible.length?visible.map(group=>`<section class="favorite-group" aria-label="${esc(group.path.join(' › '))}"><div class="favorite-group-head"><div><p>${esc(group.path.slice(0,-1).join(' › '))}</p><h2>${esc(group.path.at(-1))}</h2></div><span class="count">${group.items.length}</span></div><div class="favorite-list">${group.items.sort((a,b)=>a.number.localeCompare(b.number,'de-CH',{numeric:true})||a.va.localeCompare(b.va)).map(a=>`<div class="favorite-card"><button class="favorite-open" data-favorite-open="${esc(a.key)}" aria-label="${esc(a.name)} · Artikel ${esc(a.number)} · VA ${esc(a.va)} öffnen"><span class="favorite-symbol ${hasPicture(a)?'has-original':''}">${preview(a)}</span><span class="favorite-info"><span class="favorite-name">${esc(a.name)}</span><span class="favorite-code mono">Art. ${number(a.number)} <span class="va-pill">VA ${esc(a.va)}</span></span><span class="favorite-identities"><span>E-Nr. <b class="mono">${esc(eNumber(a.e_nr))}</b></span><span>B-Nr. <b class="mono">${esc(a.b_nr||'—')}</b></span></span>${favoriteExtra.notes[a.key]?`<span class="favorite-note">${icon('note')}${esc(favoriteExtra.notes[a.key])}</span>`:''}</span></button><button class="icon-button" data-favorite-note="${esc(a.key)}" aria-label="Notiz und Listen für ${esc(a.name)} / VA ${esc(a.va)}" title="Notiz und Listen">${icon('note')}</button><button class="icon-button" data-remove-favorite="${esc(a.key)}" aria-label="${esc(a.name)} / VA ${esc(a.va)} aus Favoriten entfernen" title="Aus Favoriten entfernen">${icon('close')}</button></div>`).join('')}</div></section>`).join(''):activeList&&state.favorites.length?`<div class="favorites-empty">${icon('bookmark')}<h2>Liste «${esc(activeList.name)}» ist leer</h2><p>Über das Notizsymbol einer Position ordnest du sie dieser Liste zu.</p></div>`:`<div class="favorites-empty">${icon('bookmark')}<h2>Noch keine Favoriten</h2><p>Öffne eine Position und wähle «Zu Favoriten hinzufügen». Sie erscheint hier mit Symbol in ihrer Katalogkategorie.</p><button class="button primary" data-select="${esc(state.selected)}">${icon('layers')}Katalog entdecken</button></div>`;
          hydrateFavorites();
    }
    function openFavoriteNote(key){
      const a=byKey.get(key);if(!a)return;
      $('favoriteNoteDialog').dataset.key=key;$('favoriteNoteSubtitle').textContent=`${number(a.number)} / VA ${a.va} · ${a.name}`;
      $('favoriteNote').value=favoriteExtra.notes[key]||'';$('favoriteNewList').value='';
      $('favoriteListChoices').innerHTML=favoriteExtra.lists.length?favoriteExtra.lists.map(l=>`<label class="check-row"><input type="checkbox" value="${esc(l.id)}" ${l.keys.includes(key)?'checked':''}>${esc(l.name)}</label>`).join(''):'<p class="muted">Noch keine Liste. Gib unten einen Namen ein.</p>';
      $('favoriteNoteDialog').returnValue='';$('favoriteNoteDialog').showModal();$('favoriteNote').focus();
    }
    $('favoriteNoteDialog').addEventListener('close',()=>{
      const dialog=$('favoriteNoteDialog'),key=dialog.dataset.key;if(dialog.returnValue!=='ok'||!key)return;
      const note=$('favoriteNote').value.trim();if(note)favoriteExtra.notes[key]=note;else delete favoriteExtra.notes[key];
      const chosen=new Set([...$('favoriteListChoices').querySelectorAll('input:checked')].map(i=>i.value));
      const created=$('favoriteNewList').value.trim();if(created){const id=crypto.randomUUID();favoriteExtra.lists.push({id,name:created,keys:[]});chosen.add(id);}
      for(const list of favoriteExtra.lists){const has=list.keys.includes(key);if(chosen.has(list.id)&&!has)list.keys.push(key);if(!chosen.has(list.id)&&has)list.keys=list.keys.filter(k=>k!==key);}
      saveFavoriteExtra();renderFavorites();toast('Notiz und Listen gespeichert.');
    });
    // Zuletzt angesehene Positionen bleiben lokal auf diesem Gerät.
    const recentStorage='bim2steiger:zuletzt:v1',recentLimit=8;
    function loadRecent(){try{const saved=JSON.parse(localStorage.getItem(recentStorage)||'[]');return Array.isArray(saved)?saved.filter(k=>typeof k==='string'&&/^[^/]+\/[^/]+$/.test(k)):[];}catch{return [];}}
    function rememberRecent(key){const list=[key,...loadRecent().filter(k=>k!==key)].slice(0,recentLimit);try{localStorage.setItem(recentStorage,JSON.stringify(list));}catch{}}
    function renderHome(){
      const count=(value,one,many)=>value.toLocaleString('de-CH')+' '+(value===1?one:many);
      $('homeSubtitle').textContent=(metadata.catalogue_articles?'Steiger-Katalog '+(metadata.year||'')+' · '+count(metadata.catalogue_articles,'Artikel','Artikel')+'. ':'')+'Position suchen, Kapitel öffnen oder an der Ausschreibung weiterarbeiten.';
      $('homeCatalogueInfo').textContent=catalogueRoots?count(catalogueRoots.size,'Hauptkapitel','Hauptkapitel'):'Kapitel und Positionen';
      $('homeFavoriteInfo').textContent=state.favorites.length?count(state.favorites.length,'Position','Positionen'):'Noch keine Favoriten';
      const tender=Number($('tenderCount').textContent)||0;
      $('homeTenderInfo').textContent=tender?count(tender,'Position','Positionen'):'Noch keine Positionen';
      const recent=loadRecent().map(key=>{const [n,va]=key.split('/');const nav=navRecords.find(a=>a.number===n);return nav&&nav.vas.includes(va)?(byKey.get(key)||ensureArticle(n,va,nav.name)):null;}).filter(Boolean);
      $('clearRecent').hidden=!recent.length;
      $('homeRecent').innerHTML=recent.length?`<div>${recent.map(a=>`<button class="chapter-article" type="button" data-select="${esc(a.key)}" data-number="${esc(a.number)}"><span class="tree-icon ${hasPicture(a)?'has-original':''}">${preview(a)}</span><span class="chapter-article-name">${labelHtml(a.name)}</span><span class="mono">${number(a.number)}</span><span class="va-pill mono">VA ${esc(a.va)}</span></button>`).join('')}</div>`:'<p class="home-empty">Noch keine Position geöffnet. Über die Suche oder den Katalog findest du die erste Position.</p>';
      $('homeChapters').innerHTML=catalogueRoots?[...catalogueRoots.values()].sort(chapterSort).map(child=>chapterCard(child)).join(''):'';
    }
    function showHome({hash=true}={}){
      showView('home');renderHome();markChapter('');
      document.querySelectorAll('.tree-button.selected').forEach(b=>{b.classList.remove('selected');b.removeAttribute('aria-current');});
      if(hash&&location.hash!=='#start')location.hash='start';
      closeSidebar();window.scrollTo({top:0});$('homeTitle').focus({preventScroll:true});
    }
    function showFavorites({hash=true}={}){
      showView('favorites');renderFavoriteButton();renderFavorites();
      if(hash)location.hash='favoriten';closeSidebar();window.scrollTo({top:0});$('favoritesTitle').focus({preventScroll:true});
    }
    function closeSidebar(){
      const restoreFocus=window.matchMedia('(max-width:740px)').matches&&$('catalogueSidebar').contains(document.activeElement);
      document.body.classList.remove('nav-open');$('menuToggle').setAttribute('aria-expanded','false');
      if(restoreFocus)$('menuToggle').focus({preventScroll:true});
    }

    let modelImport=null;
    try{const stored=JSON.parse(localStorage.getItem('bim2steiger:beta:model-import:v1')||'null');if(stored&&typeof stored.filename==='string'&&Array.isArray(stored.elements))modelImport=stored;}catch{}
    const hasLocalAPI=()=>/^https?:$/.test(location.protocol);
    function renderModelImport(){
      const elements=modelImport?.elements||[],ready=hasLocalAPI();
      $('modelFile').disabled=!ready;$('importServerHint').hidden=ready;
      const objectCount=elements.length+' '+(elements.length===1?'Objekt':'Objekte');
      $('importStatus').textContent=modelImport?modelImport.filename+' · '+objectCount:'Noch keine Datei importiert.';
      $('modelSource').textContent=modelImport?'Quelle: '+modelImport.filename+' · Importiert am '+new Date(modelImport.imported_at).toLocaleString('de-CH'):'Nach dem Import siehst du hier die übernommenen Objekte und offene Angaben.';
      $('importMetrics').hidden=!modelImport;$('importReviewState').hidden=!modelImport;
      const roomOf=e=>[e.room_number,e.room_name].filter(Boolean).join(' · ')||e.room;
      const metrics=[[elements.length,elements.length===1?'Objekt übernommen':'Objekte übernommen'],[elements.filter(e=>e.storey).length,'mit Geschoss'],[elements.filter(e=>!roomOf(e)).length,'ohne Raum'],[elements.filter(e=>!e.unit).length,'ohne Mengeneinheit']];
      $('importMetrics').innerHTML=metrics.map(([count,label])=>`<div class="import-metric"><strong>${count}</strong><span>${label}</span></div>`).join('');
      const warnings=(modelImport?.warnings||[]).map(w=>`<p class="workflow-note">${esc(w)}</p>`).join('');
      $('importObjects').innerHTML=elements.slice(0,10).map(e=>`<div class="object-row"><span><strong>${esc(e.name||e.id)}</strong><small>${esc([e.storey,roomOf(e)].filter(Boolean).join(' / ')||'Raum noch offen')} · ${esc(e.number?'Art. '+e.number+' / VA '+(e.va||'offen'):e.properties?.nova_item?'Nova '+e.properties.nova_item:'Artikelzuordnung noch offen')}</small></span><span class="mono ${e.quantity<0?'negative':''}">${esc(e.quantity)} ${esc(e.unit||'Einheit offen')}</span></div>`).join('')+(modelImport?`<p class="workflow-note" style="margin-top:13px">${elements.length>10?'Vorschau der ersten 10 Objekte. ':''}Alle Importobjekte sind ungeprüft.</p>${warnings}<details class="table-help"><summary>Hinweis zu fehlenden Mengen</summary><p>Ohne Mengenfeld zählt ein Objekt als Anzahl 1. Das ist keine Längen- oder Flächenermittlung. IFC-Raumnummer ist der Name des IfcSpace, der Raumname dessen Langname.</p></details>`:'');
      $('exportSourceState').textContent=modelImport?objectCount:'Noch offen';$('exportSourceState').className='badge '+(modelImport?'blue':'planned');
      $('saveModelReview').hidden=!elements.length;$('discardModelImport').hidden=!modelImport;
      renderAssignments();
    }
    function saveModelImport(){
      try{if(modelImport)localStorage.setItem('bim2steiger:beta:model-import:v1',JSON.stringify(modelImport));else localStorage.removeItem('bim2steiger:beta:model-import:v1');}catch{toast('Lokale Speicherung ist nicht verfügbar. Bitte den Import als JSON sichern.');}
      if(typeof activeProject==='function'&&activeProject()){activeProject().model_import=modelImport;saveProjects();}
    }
    // Zuordnung: gleiche Objekte nach Bezeichnung gruppieren, Vorschläge aus der Katalogsuche, Wahl immer durch die Nutzerin oder den Nutzer.
    const suggestionCache=new Map();
    const objectName=e=>String(e.name||e.id||'Ohne Bezeichnung').trim();
    const navByNumber=number=>navRecords.find(a=>a.number===String(number));
    function assignmentGroups(){
      const groups=new Map();
      for(const e of modelImport?.elements||[]){const name=objectName(e);if(!groups.has(name))groups.set(name,{name,elements:[]});groups.get(name).elements.push(e);}
      return [...groups.values()].sort((a,b)=>b.elements.length-a.elements.length||a.name.localeCompare(b.name,'de-CH'));
    }
    function groupAssignment(group){
      const first=group.elements[0];if(!first.number)return null;
      const same=group.elements.every(e=>e.number===first.number&&(e.va||'')===(first.va||''));
      return same?{number:String(first.number),va:String(first.va||''),source:first.assignment_source||'Aus der Importdatei'}:{mixed:true};
    }
    async function loadSuggestions(name){
      if(suggestionCache.has(name))return suggestionCache.get(name);
      const tokens=norm(name).replace(/[^a-z0-9äöü]+/g,' ').split(' ').filter(t=>t.length>=3&&!/^\d+$/.test(t)&&!/^ifc/.test(t)).slice(0,4);
      let found=[];
      for(let count=tokens.length;count>0&&!found.length;count--){
        try{found=await api('/api/search?'+new URLSearchParams({q:tokens.slice(0,count).join(' '),kind:'all',limit:'4'}));}catch{found=[];}
      }
      const result=found.filter(item=>item.source_kind!=='composition_only').slice(0,3).map(item=>({number:item.number,name:item.name,va:item.vas.some(v=>v.va==='00')?'00':item.vas[0]?.va||''}));
      suggestionCache.set(name,result);return result;
    }
    const RULES_KEY='bim2steiger:zuordnung-regeln:v1';
    function loadRules(){try{const saved=JSON.parse(localStorage.getItem(RULES_KEY)||'null');if(saved&&saved.schema_version==='1.0.0'&&Array.isArray(saved.rules))return saved.rules;}catch{}return [];}
    function saveRules(rules){try{localStorage.setItem(RULES_KEY,JSON.stringify({schema_version:'1.0.0',rules}));}catch{toast('Regeln können lokal nicht gespeichert werden.');}}
    function sharedValue(group,field){const values=[...new Set(group.elements.map(e=>String(e[field]||'').trim()))];return values.length===1?values[0]:'';}
    function ruleFromGroup(group,numberValue,va,bkp,unit){
      const nova=[...new Set(group.elements.map(e=>e.properties?.nova_item).filter(Boolean))];
      const classes=[...new Set(group.elements.map(e=>e.ifc_class).filter(value=>value&&value!=='NovaSymbol'))];
      const criteria={};let source='';
      if(nova.length===1&&group.elements.every(e=>e.ifc_class==='NovaSymbol'||e.properties?.nova_item)){criteria.nova_item=nova[0];source='NOVA';}
      else if(classes.length===1){criteria.ifc_class=classes[0];criteria.name_contains=[group.name];source='IFC';}
      else criteria.name_contains=[group.name];
      return {rule_id:'r_'+crypto.randomUUID().slice(0,8),source_type:source,match_criteria:criteria,target:{article_number:String(numberValue),va:String(va),bkp,unit,description:navByNumber(numberValue)?.name||group.name,default_catalog_year:metadata.year||2026}};
    }
    async function applySavedRules({quiet=false}={}){
      const rules=loadRules();
      if(!rules.length){if(!quiet)toast('Noch keine gespeicherten Regeln.');return null;}
      if(!modelImport?.elements.length)return null;
      const result=await api('/api/rules/match',{elements:modelImport.elements,rules});
      let applied=0,skipped=0;
      result.matches.forEach((match,index)=>{
        const element=modelImport.elements[index];if(!match)return;
        if(match.catalogue_error){skipped++;return;}
        if(element.number&&!String(element.assignment_source||'').startsWith('Regel '))return;
        element.number=match.number;element.va=match.va;if(match.bkp)element.bkp=match.bkp;if(match.unit)element.unit=match.unit;
        element.rule_id=match.rule_id;element.recipe_id=match.recipe_id||null;element.assignment_source='Regel '+match.rule_id;element.assigned_at=new Date().toISOString();delete element.transferred_at;applied++;
      });
      if(!quiet||applied)saveModelImport();
      return {applied,skipped,invalid:(result.errors||[]).length};
    }
    function renderAssignments(){
      const host=$('assignGroups');if(!host)return;
      const groups=assignmentGroups(),assigned=groups.filter(g=>{const a=groupAssignment(g);return a&&!a.mixed;}).length;
      $('assignState').textContent=groups.length?`${assigned} von ${groups.length} Gruppen zugeordnet`:'Noch offen';$('assignState').className='badge '+(groups.length&&assigned===groups.length?'blue':'planned');
      $('assignStepState').textContent=groups.length?`${assigned} / ${groups.length} Gruppen`:'Noch offen';
      $('exportAssignState').textContent=groups.length?`${assigned} / ${groups.length} Gruppen`:'Noch offen';$('exportAssignState').className='badge '+(groups.length&&assigned===groups.length?'blue':'planned');
      const open=(modelImport?.elements||[]).filter(e=>e.number&&e.va&&!e.transferred_at).length;
      $('assignToTender').hidden=!open;$('assignToTender').lastChild.textContent=`${open} zugeordnete ${open===1?'Objekt':'Objekte'} in die Ausschreibung übernehmen`;
      if($('applyRules'))$('applyRules').hidden=!groups.length;
      if(!groups.length){host.innerHTML='<p class="home-empty">Nach dem Import erscheinen hier die Objektgruppen.</p>';return;}
      host.innerHTML=groups.map((g,index)=>{
        const a=groupAssignment(g),nav=a&&!a.mixed?navByNumber(a.number):null;
        const quantity=g.elements.reduce((sum,e)=>sum+(Number(e.quantity)||0),0);
        const storeys=[...new Set(g.elements.map(e=>e.storey).filter(Boolean))],rooms=[...new Set(g.elements.map(e=>[e.room_number,e.room_name].filter(Boolean).join(' · ')||e.room).filter(Boolean))];
        const place=[storeys.length===1?storeys[0]:storeys.length?storeys.length+' Geschosse':'Geschoss offen',rooms.length===1?rooms[0]:rooms.length?rooms.length+' Räume':'Raum offen'].join(' · ');
        const bkp=sharedValue(g,'bkp'),unit=sharedValue(g,'unit')||'Stk';
        const current=a?.mixed?'<span class="badge planned">Unterschiedlich zugeordnet</span>':a?`<span class="assign-current${nav&&nav.vas.includes(a.va)?'':' invalid'}"><button type="button" class="source-link" data-select="${esc(a.number+'/'+(a.va||'00'))}">${number(a.number)} / VA ${esc(a.va||'offen')}</button> ${esc(nav?.name||'Nicht im Katalog')} · <small>${esc(a.source)}</small></span><button type="button" class="text-action" data-assign-clear="${index}">Aufheben</button>`:'<span class="muted">Noch keine Steiger-Position</span>';
        return `<article class="assign-group" data-assign-group="${index}"><div class="assign-head"><div><strong>${esc(g.name)}</strong><small>${g.elements.length} ${g.elements.length===1?'Objekt':'Objekte'} · Menge ${esc(qty(Math.round(quantity*1000)/1000))} · ${esc(place)}</small></div><div class="assign-status">${current}</div></div><div class="assign-suggestions" data-suggestions="${index}"><span class="muted">Vorschläge werden gesucht …</span></div><form class="assign-manual" data-assign-manual="${index}"><label>Artikelnummer<input name="number" inputmode="numeric" placeholder="z. B. 109874" required></label><label>VA<input name="va" placeholder="00" maxlength="4"></label><label>BKP<input name="bkp" value="${esc(bkp)}" placeholder="232.5"></label><label>Einheit<input name="unit" value="${esc(unit)}" placeholder="Stk"></label><button class="button" type="submit">Zuordnen</button><button class="button" type="button" data-assign-rule="${index}">Als Regel merken</button></form></article>`;
      }).join('');
      fillSuggestions(groups);
    }
    let suggestionRun=0;
    async function fillSuggestions(groups){
      const run=++suggestionRun;
      for(const [index,g] of groups.slice(0,40).entries()){
        const list=await loadSuggestions(g.name);if(run!==suggestionRun)return;
        const host=document.querySelector(`[data-suggestions="${index}"]`);if(!host)continue;
        host.innerHTML=list.length?'<span class="muted">Vorschläge:</span>'+list.map(item=>`<button type="button" class="assign-chip" data-assign-pick="${index}" data-number="${esc(item.number)}" data-va="${esc(item.va)}"><span class="mono">${number(item.number)} / ${esc(item.va)}</span> ${esc(item.name)}</button>`).join(''):'<span class="muted">Kein Vorschlag gefunden. Nummer unten eingeben oder mit Ctrl K suchen.</span>';
      }
      groups.slice(40).forEach((g,offset)=>{const host=document.querySelector(`[data-suggestions="${offset+40}"]`);if(host)host.innerHTML='<span class="muted">Nummer unten eingeben. Vorschläge erscheinen für die ersten 40 Gruppen.</span>';});
    }
    function assignGroup(index,numberValue,va,source,extra={}){
      const g=assignmentGroups()[index];if(!g)return;
      const nav=navByNumber(numberValue);if(!nav)return toast('Artikel '+numberValue+' ist nicht im lokalen Katalog.');
      va=va||(nav.vas.includes('00')?'00':nav.vas[0]);if(!nav.vas.includes(va))return toast(`VA ${va} gibt es für ${number(nav.number)} nicht. Verfügbar: ${nav.vas.join(', ')}.`);
      for(const e of g.elements){e.number=nav.number;e.va=va;e.assignment_source=source;e.assigned_at=new Date().toISOString();if(extra.bkp)e.bkp=extra.bkp;if(extra.unit)e.unit=extra.unit;if('rule_id' in extra)e.rule_id=extra.rule_id;if('recipe_id' in extra)e.recipe_id=extra.recipe_id;delete e.transferred_at;}
      saveModelImport();renderModelImport();toast(`${g.elements.length} ${g.elements.length===1?'Objekt':'Objekte'} → ${number(nav.number)} / VA ${va}.`);
    }
    function rememberGroupInputs(){
      document.querySelectorAll('[data-assign-group]').forEach(card=>{
        const group=assignmentGroups()[Number(card.dataset.assignGroup)];if(!group)return;
        const bkp=card.querySelector('[name=bkp]')?.value.trim()||'',unit=card.querySelector('[name=unit]')?.value.trim()||'';
        for(const element of group.elements){if(bkp)element.bkp=bkp;if(unit)element.unit=unit;}
      });
    }
    $('assignGroups').addEventListener('click',async e=>{
      const pick=e.target.closest('[data-assign-pick]');if(pick){assignGroup(Number(pick.dataset.assignPick),pick.dataset.number,pick.dataset.va,'Vorschlag aus der Katalogsuche',{rule_id:''});return;}
      const clear=e.target.closest('[data-assign-clear]');if(clear){const g=assignmentGroups()[Number(clear.dataset.assignClear)];for(const el of g.elements){delete el.number;delete el.va;delete el.assignment_source;delete el.assigned_at;delete el.transferred_at;delete el.rule_id;delete el.recipe_id;}saveModelImport();renderModelImport();return;}
      const ruleButton=e.target.closest('[data-assign-rule]');if(!ruleButton)return;
      const form=ruleButton.closest('form');const index=Number(ruleButton.dataset.assignRule);const group=assignmentGroups()[index];if(!form||!group)return;
      const numberValue=form.elements.number.value.replace(/\s/g,'')||groupAssignment(group)?.number||'';
      const va=form.elements.va.value.trim()||groupAssignment(group)?.va||'';
      const bkp=form.elements.bkp.value.trim(),unit=form.elements.unit.value.trim();
      if(!numberValue||!va||!bkp||!unit)return toast('Artikel, VA, BKP und Einheit eintragen, dann die Regel merken.');
      const nav=navByNumber(numberValue);if(!nav||!nav.vas.includes(va))return toast('Artikel und VA müssen im Katalog stehen.');
      const created=ruleFromGroup(group,nav.number,va,bkp,unit);
      const rules=loadRules().filter(rule=>JSON.stringify(rule.match_criteria)!==JSON.stringify(created.match_criteria)||rule.source_type!==created.source_type);
      rules.unshift(created);saveRules(rules);
      for(const element of group.elements){delete element.number;delete element.va;delete element.assignment_source;}
      try{await applySavedRules({quiet:true});renderModelImport();toast('Regel '+created.rule_id+' gemerkt. Sie gilt für dieselbe Kennung im nächsten Import.');}
      catch(error){toast(error.message);}
    });
    $('assignGroups').addEventListener('submit',e=>{const form=e.target.closest('[data-assign-manual]');if(!form)return;e.preventDefault();const bkp=form.elements.bkp.value.trim(),unit=form.elements.unit.value.trim();assignGroup(Number(form.dataset.assignManual),form.elements.number.value.replace(/\s/g,''),form.elements.va.value.trim(),'Manuell zugeordnet',{...(bkp?{bkp}:{}),...(unit?{unit}:{}),rule_id:''});});
    if($('applyRules'))$('applyRules').onclick=async()=>{
      try{const result=await applySavedRules();if(!result)return;renderModelImport();const detail=[result.applied+' Objekte aus Regeln zugeordnet'];if(result.skipped)detail.push(result.skipped+' ohne Katalogposition');if(result.invalid)detail.push(result.invalid+' Regeln ungültig');toast(detail.join(', ')+'.');}
      catch(error){toast(error.message);}
    };
    $('assignToTender').onclick=async()=>{
      rememberGroupInputs();
      const open=(modelImport?.elements||[]).filter(e=>e.number&&e.va&&!e.transferred_at);if(!open.length)return;
      const missing=open.filter(e=>!String(e.bkp||'').trim()||!String(e.unit||'').trim());
      if(missing.length){const names=[...new Set(missing.map(objectName))].slice(0,3).join(', ');return toast(`BKP und Einheit fehlen noch bei ${missing.length} Objekten (${names}).`);}
      const edition=(metadata.editions||[]).find(item=>item.year===state.tenderCatalogueYear)||{year:metadata.year,status:'available'};
      const roomOf=e=>[e.room_number,e.room_name].filter(Boolean).join(' · ')||e.room||'';
      for(const e of open){const nav=navByNumber(e.number);tenderLines.push({id:crypto.randomUUID(),number:String(e.number),va:String(e.va),name:nav?.name||objectName(e),quantity:Number(e.quantity)||1,unit:e.unit,bkp:e.bkp,storey:e.storey||'',room:roomOf(e),system:e.system||'',placement:e.placement||'',recipe_id:e.recipe_id||null,rule_id:e.rule_id||'',catalogue_year:edition.year,catalogue_status:edition.status,source_catalogue_year:metadata.year,catalogue_captured_at:null,reference_k_price:null,sources:[{kind:'model_import',file:modelImport.filename,object:e.id||objectName(e),rule_id:e.rule_id||''}]});e.transferred_at=new Date().toISOString();}
      persistTender();renderTender();saveModelImport();renderModelImport();toast(open.length+' Objekte übernommen. Gleiche Positionen kannst du jetzt verdichten.');
    };
    function showAusschreibung({hash=true,scroll=''}={}){
      showView('ausschreibung');renderModelImport();
      $('importPanel').hidden=false;$('exportPanel').hidden=false;
      closeSidebar();
      if(hash&&location.hash!=='#ausschreibung')location.hash='ausschreibung';
      const target=scroll?$(scroll):null;
      if(target)target.scrollIntoView({block:'start'});else window.scrollTo({top:0});
      if(!scroll)$('projectTitle').focus({preventScroll:true});
    }
    async function fileBase64(file){
      const bytes=new Uint8Array(await file.arrayBuffer());const parts=[];const chunk=32766;
      for(let i=0;i<bytes.length;i+=chunk)parts.push(btoa(String.fromCharCode.apply(null,bytes.subarray(i,i+chunk))));
      return parts.join('');
    }
    $('modelFile').onchange=async e=>{
      const file=e.target.files[0];if(!file)return;
      const input=e.target;pendingToolRequests++;input.disabled=true;$('importStatus').textContent='Datei wird eingelesen …';
      try{
        if(!hasLocalAPI())throw new Error('Für den Import bitte die lokale Anwendung starten.');
        if(!/\.(csv|json|ifc|n4d|n4m)$/i.test(file.name))throw new Error('Unterstützt werden CSV, JSON, IFC, N4D und N4M.');
        if(file.size>250_000_000)throw new Error('Die Datei ist zu gross. Bitte einen Export unter 250 MB verwenden.');
        const payload=/\.(n4d|n4m|ifc)$/i.test(file.name)?{filename:file.name,content_base64:await fileBase64(file)}:{filename:file.name,text:await file.text()};
        const response=await fetch(localUrl('/api/import'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
        const result=await response.json();if(!response.ok)throw new Error(result.error||'Import fehlgeschlagen.');
        if(!Array.isArray(result.elements))throw new Error('Die Importantwort enthält keine Objektliste.');
        modelImport={filename:file.name,imported_at:new Date().toISOString(),elements:result.elements,warnings:Array.isArray(result.warnings)?result.warnings:[]};
        saveModelImport();
        try{await applySavedRules({quiet:true});}catch{}
        renderModelImport();
      }catch(error){$('importStatus').textContent=error.message;}finally{pendingToolRequests--;input.disabled=!hasLocalAPI();input.value='';}
    };
    $('discardModelImport').onclick=()=>{modelImport=null;saveModelImport();renderModelImport();toast('Modellimport verworfen.');};
    $('saveModelReview').onclick=()=>{
      if(!modelImport?.elements.length)return;
      const exportData={schema_version:'bim2steiger.model-review.v1',status:'unreviewed',created_at:new Date().toISOString(),source:{filename:modelImport.filename,imported_at:modelImport.imported_at},warnings:modelImport.warnings||[],elements:modelImport.elements};
      const url=URL.createObjectURL(new Blob([JSON.stringify(exportData,null,2)],{type:'application/json;charset=utf-8'}));
      const link=document.createElement('a');link.href=url;link.download='BIM2STEIGER_Modellimport.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    };


    const escapeHTML=esc,amountLabel=qty;
    const chapterKey=path=>path.map(label=>label.trim().replace(/\s+/g,' ')).join(' › ');
    const symbolForName=name=>/rohr|leitung|draht|kabel/i.test(name)?'pipe':/lampe|leucht/i.test(name)?'bulb':/schalter|taster/i.test(name)?'switch':'box';
    const defaultKey=nav=>{if(!nav)throw Error('Artikel ist nicht im lokalen Katalog vorhanden.');return nav.number+'/'+(nav.vas.includes('00')?'00':nav.vas[0]);};
    const imageMatches=(image,va)=>image.va?image.va===va:!image.vas?.length||image.vas.includes(va);
    function distinctMedia(list){
      // Katalogvorschau und das erste Grunddatenbild sind dasselbe Symbol in zwei Grössen.
      // Das JPEG bleibt, auch wenn es ähnlich beschnitten ist.
      const area=image=>(image.width||0)*(image.height||0);
      const photo=image=>/\.jpe?g$/i.test(image.file||'')||image.kind==='product';
      const kept=[];
      for(const image of list){
        if(photo(image)){kept.push(image);continue;}
        const ratio=image.width&&image.height?image.width/image.height:0;
        const index=kept.findIndex(other=>{
          if(photo(other))return false;
          const otherRatio=other.width&&other.height?other.width/other.height:0;
          const previewTwin=(image.kind==='preview'||other.kind==='preview')&&(image.ordinal===0||other.ordinal===0);
          if(previewTwin)return true;
          if(!ratio||!otherRatio)return false;
          return Math.abs(ratio-otherRatio)/Math.max(ratio,otherRatio)<0.03;
        });
        if(index<0){kept.push(image);continue;}
        if(area(image)>area(kept[index]))kept[index]=image;
      }
      return kept;
    }
    function applyImages(a){
      const seen=new Set();a.media=distinctMedia((imageIndex.get(a.number)||[]).filter(i=>imageMatches(i,a.va)).filter(i=>{const key=i.sha256||i.file;if(seen.has(key))return false;seen.add(key);return true;}));
      const symbol=a.media.find(i=>i.kind==='symbol'||!i.kind)||a.media.find(i=>i.kind==='preview')||a.media.find(i=>i.kind!=='product');
      a.schema=symbol?.file||null;a.schema_info=symbol||null;
      const photo=a.media.find(i=>i.kind==='product');if(photo){a.photo_id=photo.file;dataset.assets.photos[photo.file]={...photo,src:photo.file,url:photo.source_url||'https://digital.asteigerag.ch/dashboard'};}
      return a;
    }
    function ensureArticle(number,va,name=''){
      number=String(number);va=String(va??'');const key=number+'/'+va;
      if(!byKey.has(key)){const nav=navRecords.find(a=>a.number===number);const a={key,number,va,name:name||nav?.name||number,short:name||nav?.name||number,complete:nav?.complete_position||false,source_kind:nav?.source_kind||'composition_only',catalogue_paths:nav?.chapters||[],symbol:symbolForName(name||nav?.name||''),e_nr:null,b_nr:null,parts:[],text:'',source:'Steiger-Katalog '+(metadata.year||2026)};byKey.set(key,applyImages(a));articles.push(a);}
      return byKey.get(key);
    }
    async function loadDetail(key,recipe=null){
      const cacheKey=key+'|'+(recipe||''),cached=detailCache.get(cacheKey);if(cached&&Date.now()-cached.loaded_at<300000)return cached;if(detailLoads.has(cacheKey))return detailLoads.get(cacheKey);
      const promise=(async()=>{const [number,va]=key.split('/');const detail=await api('/api/article?'+new URLSearchParams({number,va,...(recipe?{recipe}:{})}));
        for(const image of detail.portal_details?.images||[]){const entries=imageIndex.get(number)||[];if(!entries.some(i=>i.file===image.file&&i.va===image.va&&i.kind===image.kind))entries.push(image);imageIndex.set(number,entries);}
        const a=applyImages({...ensureArticle(detail.article.number,detail.selected.va,detail.article.name)});
        Object.assign(a,{complete:!!detail.article.complete_position,source_kind:detail.article.source_kind,catalogue_paths:detail.article.locations.map(location=>location.chapter),symbol:symbolForName(detail.article.name)});
        Object.assign(a,{name:detail.article.name,short:detail.article.name,subtitle:detail.article.complete_position?(detail.root?.basic_data||detail.article.basic_data||[]).filter(f=>/^Bezeichnung Z[2-9]$/.test(f.label)&&String(f.value||'').trim()).map(f=>String(f.value).trim()).join(' · '):'Einzelartikel · '+(detail.article.source_kind==='composition_only'?'Kalkulationsbestandteil':'Katalogartikel'),text:detail.portal_details?.article_text||detail.root?.article_text||detail.article.text,unit:detail.article.unit,source:detail.portal_details?detail.portal_details.source+' · '+detail.portal_details.captured_at:detail.root?detail.root.source+' · '+detail.root.captured_at:'Steiger-Katalog '+metadata.year,identifiers:detail.identifiers,parts:detail.recipe?.items.map(item=>({key:item.number+'/'+item.va,quantity:item.quantity}))||[]});
        const first=detail.identifiers[0]||{};a.e_nr=first.e_nr||null;a.b_nr=first.b_nr||null;
        for(const item of Object.values(detail.graph).flatMap(r=>r.items))ensureArticle(item.number,item.va,item.name);
        a.photo_key=null;
        if(!a.photo_id){const contained=Object.values(detail.graph).flatMap(r=>r.items).map(i=>byKey.get(i.number+'/'+i.va)).find(p=>p?.photo_id);if(contained)a.photo_key=contained.key;}
        byKey.set(a.key,a);const result={detail,article:a,loaded_at:Date.now()};detailCache.set(cacheKey,result);return result;
      })();detailLoads.set(cacheKey,promise);try{return await promise;}finally{detailLoads.delete(cacheKey);}
    }
    async function selectArticle(key,options={},hashArgument=true,recipeArgument=null){
      if(typeof options==='string'){key=key+'/'+options;options={hash:hashArgument,recipe:recipeArgument};}
      if(!String(key).includes('/'))key=defaultKey(navRecords.find(a=>a.number===key));
      const {from=null,hash=true,recipe=null}=options,request=++detailRequest;
      $('programmeStatus').textContent='Position wird geladen …';$('addTender').disabled=true;
      try{
        const loaded=await loadDetail(key,recipe);if(request!==detailRequest)return;
        currentDetail=loaded.detail;activeArticle=loaded.article;byKey.set(loaded.article.key,loaded.article);state.recipe=recipe;state.leafView=false;state.leaves=[];state.expanded.clear();
        paintArticle(loaded.article.key,{from,hash:false});
        const alternatives=currentDetail.recipe_alternatives;$('recipeChoices').hidden=alternatives.length<2;
        $('recipeSelect').innerHTML=alternatives.map((id,index)=>`<option value="${esc(id)}" ${id===currentDetail.recipe?.id?'selected':''}>Variante ${index+1} · ${esc(id)}</option>`).join('');
        $('addTender').disabled=currentDetail.article.source_kind==='composition_only';
        $('addTender').title=currentDetail.article.source_kind==='composition_only'?'Kalkulationsbestandteile übernimmst du mit der Komplettposition.':'In die Ausschreibung übernehmen';
        $('programmeStatus').textContent='';
        const basic=currentDetail.portal_details?.basic_data||currentDetail.root?.basic_data||currentDetail.selected.basic_data||currentDetail.article.basic_data||[];
        const totals=currentDetail.root?.recipe===currentDetail.recipe?.id?currentDetail.root?.summary||{}:{};
        $('panel-properties').insertAdjacentHTML('beforeend',`<details class="table-help"><summary>Grunddaten und Quellenkontext</summary><dl class="properties">${basic.map(f=>`<div><dt>${esc(f.label)}</dt><dd>${esc(f.checkbox===null||f.checkbox===undefined?(f.value||'—'):(f.checkbox?'Ja':'Nein'))}</dd></div>`).join('')}</dl>${loaded.article.identifiers.map(pair=>`<p>E-Nr. ${esc(eNumber(pair.e_nr))} · B-Nr. ${esc(pair.b_nr||'—')}<br>${esc(pair.source)}<br>${esc((pair.sources||[]).map(s=>s.number+' / VA '+s.va+' · '+s.recipe).join('; '))}</p>`).join('')}</details>${Object.keys(totals).length?`<details class="table-help"><summary>Originale Kalkulationssumme (Referenz)</summary><dl class="properties">${Object.entries(totals).map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(value??'—')}</dd></div>`).join('')}</dl><p>CHF / Stunden gemäss Katalogquelle; keine aktuelle Unternehmerofferte.</p></details>`:''}`);
        renderPortalSource(currentDetail);
        if(hash)location.hash='position/'+loaded.article.key+(recipe?'/'+encodeURIComponent(recipe):'');
        return true;
      }catch(error){if(request===detailRequest){$('programmeStatus').textContent=error.message;toast(error.message);}}
    }
    function identifierCaption(pair){
      const calculations=(pair?.sources||[]).filter(source=>source.number);
      const origins=pair?.origins||[];
      const fromBasics=pair?.source==='Grunddaten dieser Position'||origins.includes('Grunddaten dieser Position');
      if(fromBasics&&calculations.length){const listed=calculations.slice(0,3).map(source=>number(source.number)+' / VA '+source.va).join(', ');const more=calculations.length>3?` und ${calculations.length-3} weitere`:'';return `Dieselbe Kennung steht in den Grunddaten und in der Kalkulation ${listed}${more}.`;}
      if(calculations.length)return `Erfasst in der Kalkulation ${calculations.slice(0,3).map(source=>number(source.number)+' / VA '+source.va).join(', ')}.`;
      return '';
    }
    function identifierOption(pair){
      const calculations=(pair.sources||[]).filter(source=>source.number);
      const place=pair.source==='Grunddaten dieser Position'?'Grunddaten':calculations.length?`Kalkulation ${number(calculations[0].number)} / VA ${calculations[0].va}`:(pair.source||'Quelle');
      return `E-Nr. ${eNumber(pair.e_nr)} · B-Nr. ${pair.b_nr||'—'} · ${place}`;
    }
    function renderIdentifierChoices(a){
      const pairs=a.identifiers||[];const several=pairs.length>1;const caption=identifierCaption(pairs[0]);
      $('identifierChoices').hidden=!several&&!caption;
      $('identifierSelect').hidden=!several;$('identifierSelect').previousElementSibling.hidden=!several;
      $('identifierSelect').innerHTML=pairs.map((p,index)=>`<option value="${index}">${esc(identifierOption(p))}</option>`).join('');
      $('identifierSource').textContent=caption;
    }
    function renderPortalSource(detail){
      const source=detail.portal_details;if(!source)return;
      if(source.rows?.length){
        $('panel-properties').insertAdjacentHTML('beforeend',`<details class="table-help"><summary>Zusätzlich erfasste Portal-Kalkulation ansehen</summary><p>Originale Quelldaten vom ${esc(source.captured_at)}. Diese Nacherfassung ersetzt die geprüften Rezepte nicht automatisch.</p><div class="composition-scroll" tabindex="0" role="region" aria-label="Originale Kalkulationsquelle"><table class="components-table"><thead><tr><th>Name</th><th>Artikel</th><th>VA</th><th>Menge je Elternteil</th><th>Nettopreis</th><th>K-Zeit</th><th>E-Nr.</th><th>B-Nr.</th></tr></thead><tbody>${source.rows.map(row=>{const c=row.cells;return `<tr><td style="padding-left:${10+Math.min(row.level,12)*10}px">${esc(c[0])}</td>${[1,2,3,4,6,8,9].map(index=>`<td class="mono">${esc(c[index]||'—')}</td>`).join('')}</tr>`;}).join('')}</tbody></table></div></details>`);
      }
      if(detail.article.text&&detail.article.text!==current().text)$('panel-description').insertAdjacentHTML('beforeend',`<details class="table-help"><summary>Katalogbeschreibung mit Kontext</summary><p class="original-text">${esc(detail.article.text)}</p></details>`);
    }
    function hydrateFavorites(){
      if(detailLoads.size>=4)return;
      for(const key of state.favorites){if(failedFavorites.has(key)||detailCache.has(key+'|')||detailLoads.has(key+'|'))continue;
        loadDetail(key).then(()=>{if(state.view==='favorites')renderFavorites();}).catch(()=>{failedFavorites.add(key);});
        if(detailLoads.size>=4)break;
      }
    }
    function restoreFavorites(){
      const keys=[];
      try{const saved=JSON.parse(localStorage.getItem('bim2steiger:merkliste:v1')||'[]');if(Array.isArray(saved))for(const item of saved)if(typeof item?.id==='string'&&typeof item.va==='string')keys.push(item.id+'/'+item.va);}catch{}
      const migrationKey='bim2steiger:beta:favoriten:migrated-to-catalogue:v1';let migrate=false;
      try{migrate=localStorage.getItem(migrationKey)!=='true';if(migrate){const saved=JSON.parse(localStorage.getItem('bim2steiger:beta:favoriten:v1')||'[]');if(Array.isArray(saved))keys.push(...saved.filter(k=>typeof k==='string'&&/^\d+\/\d+$/.test(k)));}}catch{}
      state.favorites=[...new Set(keys)];for(const key of state.favorites){const [number,va]=key.split('/');ensureArticle(number,va);}
      renderFavoriteButton();
      if(migrate)try{localStorage.setItem('bim2steiger:merkliste:v1',JSON.stringify(state.favorites.map(key=>{const [id,va]=key.split('/');return {id,va};})));localStorage.setItem(migrationKey,'true');}catch{}
    }
    async function startProgram(){
      if(location.protocol==='file:')return;
      try{
        const data=await Promise.all([api('/api/meta'),api('/api/catalogue'),api('/images/chapters.json').catch(()=>[]),api('/catalogue-notes.json').catch(()=>[]),api('/images/group-extensions.json').catch(()=>({})),api('/catalogue-pdfs.json').catch(()=>[])]);[metadata,navRecords]=data;
        chapterImages=new Map(data[2].filter(c=>c.path?.length).map(c=>[chapterKey(c.path),c]));
        catalogueNotes=Array.isArray(data[3])?data[3].filter(note=>Array.isArray(note.path)&&note.path.length):[];
        groupExtensions=new Map(Object.entries(data[4]||{}));
        cataloguePdfs=new Map((Array.isArray(data[5])?data[5]:[]).filter(item=>Array.isArray(item.path)&&item.file).map(item=>[chapterKey(item.path),item.file]));
        restoreFavorites();renderTree();state.catalogueYear=savedCatalogueYear;state.tenderCatalogueYear=savedTenderYear;renderCatalogueChoices();if(typeof renderTender==='function')renderTender();$('catalogueCoverage').textContent=metadata.catalogue_articles.toLocaleString('de-CH')+' Artikel';
        $('programmeStatus').textContent='';readHash();
        api('/images/inventory.json').then(list=>{
          imageInventory=list;for(const image of list){if(!imageIndex.has(image.number))imageIndex.set(image.number,[]);imageIndex.get(image.number).push(image);}
          for(const article of byKey.values())applyImages(article);
          if(state.view==='article'&&current()){renderMedia(current());if(currentDetail)renderComposition(current());}else if(state.view==='favorites')renderFavorites();else if(state.view==='home')renderHome();
          refillTree();$('catalogueCoverage').textContent=metadata.catalogue_articles.toLocaleString('de-CH')+' Artikel · '+new Set(list.map(i=>i.number)).size.toLocaleString('de-CH')+' mit Bild';
        }).catch(()=>{});
      }catch(error){$('programmeStatus').textContent='Lokale Anwendung starten und /bim2steiger.html über den Server öffnen. '+error.message;}
    }
    $('recipeSelect').onchange=e=>selectArticle(state.selected,{recipe:e.target.value});
    $('openSourceStatus').onclick=async()=>{
      $('sourceStatusBody').textContent='Datenstand wird geladen …';$('sourceStatusDialog').showModal();
      try{const d=await api('/api/source-status');$('sourceStatusBody').innerHTML=`<dl class="properties"><div><dt>Katalogartikel</dt><dd>${metadata.catalogue_articles.toLocaleString('de-CH')}</dd></div><div><dt>Artikel mit Originalabbildung</dt><dd>${d.media_articles.toLocaleString('de-CH')}</dd></div><div><dt>Gelesene Katalogseiten</dt><dd>${d.catalogue_pages} / ${d.planned_catalogue_pages}</dd></div><div><dt>Bearbeitete Artikel-/VA-Quellen</dt><dd>${d.detail_variants.toLocaleString('de-CH')} / ${d.planned_detail_variants.toLocaleString('de-CH')}</dd></div></dl><p>${d.details_complete?'Die geplanten Artikeldialoge sind erfasst.':'Die zusätzliche Grunddaten- und Bilderfassung ist noch nicht vollständig.'} Fehlende Originalbilder bleiben kenntlich. Neue Kalkulationsquellen werden vor einer automatischen Mengenübernahme gesondert geprüft.</p><p>Quelle: Steiger-Katalog ${d.year} · lokale Kopie.</p>`;}catch(error){$('sourceStatusBody').textContent=error.message;}
    };
    $('identifierSelect').onchange=e=>{const a=current(),pair=a.identifiers[Number(e.target.value)];a.e_nr=pair.e_nr;a.b_nr=pair.b_nr;$('eNumber').textContent=eNumber(pair.e_nr);$('bNumber').textContent=pair.b_nr||'—';$('identifierSource').textContent=identifierCaption(pair);$('identityNote').parentElement.hidden=!!(pair.e_nr||pair.b_nr);$('identities').hidden=!(pair.e_nr||pair.b_nr);renderIdentitySearch('eNumberSearch','E-Nr.',pair.e_nr);renderIdentitySearch('bNumberSearch','B-Nr.',pair.b_nr,a.name);};
    $('exportFavorites').onclick=()=>{const positions=state.favorites.map(key=>{const a=byKey.get(key);return {number:a.number,va:a.va,name:a.name};});const url=URL.createObjectURL(new Blob([JSON.stringify({format:'BIM2STEIGER-Favoriten',version:2,catalogue_year:metadata.year,positions,notes:favoriteExtra.notes,lists:favoriteExtra.lists},null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='BIM2STEIGER_Favoriten.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
    $('favoritesFile').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;const data=JSON.parse(await file.text());if(data.format!=='BIM2STEIGER-Favoriten'||!Array.isArray(data.positions))throw Error('Keine passende Favoritendatei.');for(const p of data.positions)if(typeof p.number!=='string'||typeof p.va!=='string')throw Error('Artikelnummer und VA müssen Zeichenketten sein.');for(const p of data.positions){ensureArticle(p.number,p.va,p.name);state.favorites.push(p.number+'/'+p.va);}state.favorites=[...new Set(state.favorites)];if(data.notes&&typeof data.notes==='object')for(const [key,value] of Object.entries(data.notes))if(typeof value==='string')favoriteExtra.notes[key]=value;if(Array.isArray(data.lists))for(const list of data.lists){if(typeof list?.name!=='string'||!Array.isArray(list.keys))continue;const existing=favoriteExtra.lists.find(l=>l.name===list.name);const keys=list.keys.filter(k=>typeof k==='string');if(existing)existing.keys=[...new Set([...existing.keys,...keys])];else favoriteExtra.lists.push({id:crypto.randomUUID(),name:list.name,keys});}saveFavoriteExtra();saveFavorites();renderFavoriteButton();renderFavorites();toast('Favoriten geladen.');}catch(error){toast(error.message);}e.target.value='';};
    $('searchVa').onchange=renderSearch;$('searchImage').onchange=renderSearch;
    document.querySelectorAll('[data-search-kind]').forEach(button=>button.onclick=()=>{state.searchKind=button.dataset.searchKind;document.querySelectorAll('[data-search-kind]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));renderSearch();});
    document.addEventListener('click',async e=>{
      const toggle=e.target.closest('[data-recipe-toggle]');if(toggle){const key=toggle.dataset.recipeToggle;state.expanded.has(key)?state.expanded.delete(key):state.expanded.add(key);renderComposition(current());document.querySelector(`[data-recipe-toggle="${key}"]`)?.focus({preventScroll:true});}
      const mode=e.target.closest('[data-composition-mode]');if(mode){try{if(mode.dataset.compositionMode==='leaves'){const d=currentDetail;const selected=state.selected;const leaves=await api('/api/expand?'+new URLSearchParams({number:d.article.number,va:d.selected.va,quantity:'1',recipe:d.recipe.id}));if(selected!==state.selected||d!==currentDetail)return;state.leaves=leaves;state.leafView=true;}else state.leafView=false;renderComposition(current());}catch(error){toast(error.message);}}
    });

    // 10 · Ereignisse. Daten und Ansichtswechsel bleiben voneinander getrennt.
    document.addEventListener('click',async e=>{
      const openedChapter=e.target.closest('[data-open-chapter]');if(openedChapter&&!e.target.closest('#catalogueTree')){showChapter(openedChapter.dataset.openChapter);return;}
      const selection=e.target.closest('[data-select]');if(selection){if(await selectArticle(selection.dataset.select)){setTab('composition');focusArticle();}}
      const part=e.target.closest('[data-part]');if(part&&!e.target.closest('[data-recipe-toggle]')){if(await selectArticle(part.dataset.part,{from:state.selected,recipe:part.dataset.partRecipe||null})){setTab('composition');focusArticle();}}
      const close=e.target.closest('[data-close],[data-close-dialog]');if(close)$(close.dataset.close||close.dataset.closeDialog).close();
      const result=e.target.closest('[data-result]');if(result)chooseResult(Number(result.dataset.result));
      const zoom=e.target.closest('[data-zoom]');if(zoom){if(zoom.dataset.zoom==='media')openMedia(Number(zoom.dataset.mediaIndex));else openImage(zoom.dataset.zoom);}
      const favorite=e.target.closest('[data-favorite-open]');if(favorite){if(await selectArticle(favorite.dataset.favoriteOpen)){setTab('composition');focusArticle();}}
      const remove=e.target.closest('[data-remove-favorite]');if(remove){state.favorites=state.favorites.filter(k=>k!==remove.dataset.removeFavorite);forgetFavorite(remove.dataset.removeFavorite);saveFavorites();renderFavoriteButton();renderFavorites();($('favoriteGroups').querySelector('[data-remove-favorite]')||$('favoritesTitle')).focus({preventScroll:true});toast('Position aus Favoriten entfernt.');}
      const listChip=e.target.closest('[data-favorite-list]');if(listChip){state.favoriteList=listChip.dataset.favoriteList;state.favoriteCategory='all';renderFavorites();return;}
      if(e.target.closest('[data-favorite-list-new]')){const name=await askText('Neue Favoritenliste','Name der Liste','');if(name){const id=crypto.randomUUID();favoriteExtra.lists.push({id,name,keys:[]});saveFavoriteExtra();state.favoriteList=id;renderFavorites();}return;}
      if(e.target.closest('[data-favorite-list-rename]')){const list=favoriteExtra.lists.find(l=>l.id===state.favoriteList);const name=list&&await askText('Liste umbenennen','Name der Liste',list.name);if(name){list.name=name;saveFavoriteExtra();renderFavorites();}return;}
      if(e.target.closest('[data-favorite-list-delete]')){const list=favoriteExtra.lists.find(l=>l.id===state.favoriteList);if(list&&await askConfirm('Liste löschen',`Liste «${list.name}» löschen? Die Favoriten selbst bleiben erhalten.`,'Liste löschen')){favoriteExtra.lists=favoriteExtra.lists.filter(l=>l!==list);saveFavoriteExtra();state.favoriteList='all';renderFavorites();}return;}
      const note=e.target.closest('[data-favorite-note]');if(note){openFavoriteNote(note.dataset.favoriteNote);return;}
      const filter=e.target.closest('[data-favorite-filter]');if(filter){state.favoriteCategory=filter.dataset.favoriteFilter;renderFavorites();[...$('favoriteFilters').querySelectorAll('button')].find(b=>b.dataset.favoriteFilter===state.favoriteCategory)?.focus({preventScroll:true});}
    });
    $('openSearch').onclick=openSearch;$('searchInput').oninput=()=>{++searchRequest;state.results=[];$('searchResults').innerHTML='';$('searchCount').textContent='Suche läuft …';$('searchInput').removeAttribute('aria-activedescendant');clearTimeout(searchTimer);searchTimer=setTimeout(renderSearch,180);};
    $('searchInput').onkeydown=e=>{if(e.key==='ArrowDown'){e.preventDefault();activateResult(state.active+1);}else if(e.key==='ArrowUp'){e.preventDefault();activateResult(state.active-1);}else if(e.key==='Enter'){e.preventDefault();chooseResult(state.active);}};
    $('searchResults').onfocusin=e=>{const result=e.target.closest('[data-result]');if(result)activateResult(Number(result.dataset.result));};
    $('vaSelect').onchange=e=>selectArticle(e.target.value,{from:state.from});
    $('backToParent').onclick=async()=>{const parent=state.from;if(await selectArticle(parent)){setTab('composition');focusArticle();}};
    $('saveFavorite').onclick=()=>{const key=state.selected,saved=state.favorites.includes(key);state.favorites=saved?state.favorites.filter(k=>k!==key):[...state.favorites,key];if(saved)forgetFavorite(key);saveFavorites();renderFavoriteButton();toast(saved?'Position aus Favoriten entfernt.':'Position zu Favoriten hinzugefügt.');};
    for(const id of ['openFavorites','sidebarFavorites'])$(id).onclick=e=>{e.preventDefault();showFavorites();};
    $('themeToggle').onclick=()=>{state.theme=state.theme==='dark'?'light':'dark';applyTheme();savePreferences();};
    $('pinKnowledge').onclick=()=>{setKnowledgePinned(!state.knowledgePinned,{show:true});$('pinKnowledge').focus({preventScroll:true});};
    $('closeKnowledge').onclick=closeKnowledge;
    $('knowledgeDialog').addEventListener('close',()=>{$('openKnowledge').setAttribute('aria-expanded',String(state.knowledgePinned));if(!state.knowledgePinned&&!$('knowledgeDialog').open)$('openKnowledge').focus({preventScroll:true});});
    $('copyNumber').onclick=async()=>{try{await navigator.clipboard.writeText(current().number);toast('Artikelnummer kopiert.');}catch{toast('Artikelnummer: '+current().number);}};
    $('showArticleText').onclick=()=>{setTab('description',true);$('panel-description').scrollIntoView({block:'nearest'});};
    $('openKnowledge').onclick=openKnowledge;
    $('menuToggle').onclick=()=>{const open=document.body.classList.toggle('nav-open');$('menuToggle').setAttribute('aria-expanded',String(open));};$('sidebarShade').onclick=closeSidebar;
    document.querySelectorAll('[data-tab]').forEach(b=>{b.onclick=()=>setTab(b.dataset.tab);b.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const tabs=['composition','properties','description'],i=tabs.indexOf(state.tab);setTab(e.key==='Home'?tabs[0]:e.key==='End'?tabs[2]:tabs[(i+(e.key==='ArrowRight'?1:2))%3],true);};});
    document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();if(!document.querySelector('dialog[open]'))openSearch();}if(e.key==='Escape')closeSidebar();});
    document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{const r=d.getBoundingClientRect();if(e.target===d&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))d.close();}));
    $('imageDialog').addEventListener('close',()=>{if(imageFromHistory){imageFromHistory=false;return;}if(history.state&&history.state.bim2steigerImage)history.back();});
    window.addEventListener('popstate',()=>{if($('imageDialog').open){imageFromHistory=true;$('imageDialog').close();}});
    $('collapseTree').onclick=()=>{document.querySelectorAll('#catalogueTree details[open]').forEach(el=>{el.open=false;});updateCollapse();};
    $('navCatalogue').onclick=()=>showChapter('');
    $('homeSearch').onclick=openSearch;
    $('navHome').onclick=e=>{e.preventDefault();showHome();};
    $('clearRecent').onclick=()=>{try{localStorage.removeItem(recentStorage);}catch{}renderHome();};
    $('catalogueSwitch').onchange=()=>applyCatalogueYear($('catalogueSwitch').value);
    $('reserveBack').onclick=()=>{const available=(metadata.editions||[]).find(edition=>edition.status==='available');if(available)applyCatalogueYear(available.year);};
    const sidebarLimits={min:240,max:560};
    function setSidebarWidth(px,{persist=false}={}){
      const width=Math.min(sidebarLimits.max,Math.max(sidebarLimits.min,Math.round(px)));
      document.documentElement.style.setProperty('--sidebar',width+'px');
      state.sidebarWidth=width;const handle=$('sidebarResizer');
      handle.setAttribute('aria-valuenow',String(width));handle.setAttribute('aria-valuemin',String(sidebarLimits.min));handle.setAttribute('aria-valuemax',String(sidebarLimits.max));
      if(persist)savePreferences();
    }
    if(Number.isFinite(savedSidebarWidth))setSidebarWidth(savedSidebarWidth);
    $('sidebarResizer').onpointerdown=event=>{
      if(window.matchMedia('(max-width:740px)').matches)return;
      event.preventDefault();event.currentTarget.focus({preventScroll:true});const startX=event.clientX,start=state.sidebarWidth||Math.round(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sidebar'))||300);
      document.body.classList.add('sidebar-resizing');event.currentTarget.setPointerCapture(event.pointerId);
      const move=ev=>setSidebarWidth(start+(ev.clientX-startX));
      const up=()=>{document.body.classList.remove('sidebar-resizing');event.currentTarget.removeEventListener('pointermove',move);event.currentTarget.removeEventListener('pointerup',up);savePreferences();};
      event.currentTarget.addEventListener('pointermove',move);event.currentTarget.addEventListener('pointerup',up);
    };
    $('sidebarResizer').onkeydown=event=>{const step=event.shiftKey?40:16,current=state.sidebarWidth||300;if(event.key==='ArrowRight'){event.preventDefault();setSidebarWidth(current+step,{persist:true});}else if(event.key==='ArrowLeft'){event.preventDefault();setSidebarWidth(current-step,{persist:true});}else if(event.key==='Home'){event.preventDefault();setSidebarWidth(sidebarLimits.min,{persist:true});}else if(event.key==='End'){event.preventDefault();setSidebarWidth(sidebarLimits.max,{persist:true});}};
    window.addEventListener('hashchange',()=>{if($('imageDialog').open){imageFromHistory=true;$('imageDialog').close();}readHash();});applyTheme();setKnowledgePinned(state.knowledgePinned,{persist:false});startProgram();setTab('composition');
