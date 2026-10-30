// Run through the documented CUA browser session. No cookies, tokens or private APIs.
// The tab must already show the user's signed-in catalogue for the requested year.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export async function createCapture(root, plan, options={}) {
  const folder=path.join(root,'data','portal_capture');
  await fs.mkdir(path.join(folder,'pages'),{recursive:true});
  await fs.mkdir(path.join(root,'web','images','portal-2026'),{recursive:true});
  const inventoryPath=path.join(root,'web','images','inventory.json');
  const stateFolder=options.stateFolder||folder;
  await fs.mkdir(stateFolder,{recursive:true});
  let inventory=options.inventory||JSON.parse(await fs.readFile(inventoryPath,'utf8'));
  const knownFiles=new Set(inventory.map(i=>i.file));
  const chaptersPath=path.join(root,'web','images','chapters.json');
  let chapters=[];try{chapters=JSON.parse(await fs.readFile(chaptersPath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  const statusPath=path.join(stateFolder,'status.json');
  let status={year:2026,source:'https://digital.asteigerag.ch/dashboard',planned_pages:plan.length,completed:[],errors:[],started_at:new Date().toISOString()};
  try { status={...status,...JSON.parse(await fs.readFile(statusPath,'utf8'))}; } catch(e) { if(e.code!=='ENOENT')throw e; }
  if(options.status)status={...status,...options.status};
  status.planned_pages=plan.length;
  const save=async()=>{
    status.updated_at=new Date().toISOString();
    status.image_articles=new Set(inventory.map(i=>i.number)).size;
    status.images=inventory.length;
    status.complete=status.completed.length===plan.length;
    const inventoryState=path.join(stateFolder,'inventory.json');
    await fs.writeFile(inventoryState+'.capture-next',JSON.stringify(inventory,null,2)+'\n');
    await fs.rename(inventoryState+'.capture-next',inventoryState);
    await fs.writeFile(statusPath+'.capture-next',JSON.stringify(status,null,2)+'\n');
    await fs.rename(statusPath+'.capture-next',statusPath);
  };
  async function imageRecord(image,number,vas,source,page,kind='preview',ordinal=null) {
    const match=image.src?.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,\s*([\s\S]+)$/);
    if(!match||!image.width||!image.height)return null;
    const bytes=Buffer.from(match[2].replace(/\s/g,''),'base64');
    if(!bytes.length)throw Error('Leeres Bild für '+number);
    const sha256=crypto.createHash('sha256').update(bytes).digest('hex');
    const ext=match[1]==='jpeg'?'jpg':match[1];
    const file='images/portal-2026/'+sha256+'.'+ext;
    if(!knownFiles.has(file)){await fs.writeFile(path.join(root,'web',...file.split('/')),bytes);knownFiles.add(file);}
    const entry={number,va:vas.length===1?vas[0]:null,vas,kind,role:kind==='preview'?'Originale Katalogvorschau':kind==='chapter'?'Originale Kapitelillustration':'Originalbild aus den Grunddaten',
      source,source_url:status.source,portal_page:page,catalogue_year:2026,captured_at:new Date().toISOString(),width:image.width,height:image.height,file,sha256};
    if(ordinal!==null)entry.ordinal=ordinal;
    if(kind!=='chapter'&&!inventory.some(i=>i.number===number&&i.file===file&&i.kind===kind&&i.ordinal===entry.ordinal&&JSON.stringify(i.vas||[i.va])===JSON.stringify(vas)))inventory.push(entry);
    return entry;
  }
  async function selectPage(tab,p) {
    const indices=p.index.split('_');
    for(let depth=2;depth<indices.length;depth++) {
      const index=indices.slice(0,depth).join('_');
      const node=await tab.playwright.evaluate(index=>{
        const e=document.querySelector('li[data-treeindex="'+index+'"]');
        return e?{expanded:e.getAttribute('aria-expanded'),label:e.querySelector(':scope > div .k-treeview-leaf-text')?.textContent.trim()}:null;
      },index);
      if(!node)throw Error('Kapitel fehlt: '+index);
      if(node.expanded==='false') {
        await tab.playwright.locator('li[data-treeindex="'+index+'"]').press('ArrowRight',{timeoutMs:5000});
        await tab.playwright.locator('li[data-treeindex="'+index+'"][aria-expanded="true"]').waitFor({state:'attached',timeoutMs:5000});
      }
    }
    const label=await tab.playwright.evaluate(index=>document.querySelector('li[data-treeindex="'+index+'"] > div .k-treeview-leaf-text')?.textContent.trim(),p.index);
    if(label?.replace(/\s+/g,' ')!==p.label.replace(/\s+/g,' '))throw Error('Kapitel geändert: '+p.index+' / '+label);
    await tab.playwright.locator('li[data-treeindex="'+p.index+'"]').press('Enter',{timeoutMs:5000});
    const firstNumber=new RegExp('^\\s*'+p.numbers[0].split('').join('\\s*')+'\\s*$');
    await tab.playwright.locator('tr[kendogridlogicalrow] [aria-colindex="4"] a').filter({hasText:firstNumber}).first().waitFor({state:'attached',timeoutMs:8000});
  }
  async function captureChapters(tab){
    const known=chapters.filter(c=>c.path?.length).map(c=>c.index);
    const images=await tab.playwright.evaluate(known=>[...document.querySelectorAll('li[data-treeindex]')].filter(e=>!known.includes(e.getAttribute('data-treeindex'))).map(e=>{
      const image=e.querySelector(':scope > div img.treeIcon'),index=e.getAttribute('data-treeindex');if(!image||!image.naturalWidth)return null;
      const parts=index.split('_'),labels=[];for(let depth=2;depth<=parts.length;depth++){const label=document.querySelector('li[data-treeindex="'+parts.slice(0,depth).join('_')+'"] > div .k-treeview-leaf-text')?.innerText.trim().replace(/\s+/g,' ');if(label)labels.push(label);}
      return {index,path:labels,label:e.querySelector(':scope>div .k-treeview-leaf-text')?.innerText.trim().replace(/\s+/g,' '),image:{src:image.getAttribute('src'),width:image.naturalWidth,height:image.naturalHeight}};
    }).filter(Boolean),known);
    for(const chapter of images){const entry=await imageRecord(chapter.image,null,[],'Steiger-Portal, Katalogbaum '+chapter.label+', Katalog 2026',chapter.index,'chapter');if(entry){chapters=chapters.filter(c=>c.index!==chapter.index);chapters.push({...entry,index:chapter.index,path:chapter.path,label:chapter.label});}}
    return chapters.length;
  }
  async function capturePage(tab,p) {
    await selectPage(tab,p);
    const firstNumber=new RegExp('^\\s*'+p.numbers[0].split('').join('\\s*')+'\\s*$');
    await tab.playwright.locator('tr[kendogridlogicalrow] [aria-colindex="4"] a').filter({hasText:firstNumber}).first().waitFor({state:'attached',timeoutMs:8000});
    const read=()=>tab.playwright.evaluate(()=>({
      year:document.querySelector('[role="combobox"]')?.innerText.trim(),
      rows:[...document.querySelectorAll('tr[kendogridlogicalrow]')].map(r=>({
        number:r.querySelector('[aria-colindex="4"] a')?.innerText.replace(/\s/g,''),
        text:r.querySelector('[aria-colindex="2"]')?.innerText.trim(),
        vas:[...r.querySelectorAll('[aria-colindex="5"] a[title^="VA "]')].map(a=>a.title.slice(3)),
        images:[...r.querySelectorAll('img')].map(e=>({src:e.getAttribute('src'),width:e.naturalWidth,height:e.naturalHeight,alt:e.alt}))
      })).filter(r=>r.number)
    }));
    let data=await read();
    const expected=new Set(p.numbers);
    for(let attempt=0;attempt<3&&p.numbers.some(n=>!data.rows.some(r=>r.number===n));attempt++) {
      await tab.getAXState({emit:false});data=await read();
    }
    if(!data.year?.includes('2026'))throw Error('Katalogjahr ist nicht 2026');
    if(p.numbers.some(n=>!data.rows.some(r=>r.number===n)))throw Error('Artikelseite unvollständig: '+p.index);
    const records=[];
    for(const row of data.rows) {
      if(!expected.has(row.number))throw Error('Abweichender Artikel auf '+p.index+': '+row.number);
      const images=[];
      for(const image of row.images) {
        const entry=await imageRecord(image,row.number,row.vas,'Steiger-Portal, Katalogvorschau '+row.number+', Katalog 2026',p.index);
        if(entry)images.push(entry);
      }
      records.push({number:row.number,vas:row.vas,text:row.text,images});
    }
    await fs.writeFile(path.join(folder,'pages',p.index+'.json'),JSON.stringify({year:2026,page:p.index,label:p.label,source:status.source,captured_at:new Date().toISOString(),articles:records},null,2)+'\n');
    if(!status.completed.includes(p.index))status.completed.push(p.index);
    for(const error of status.errors)if(error.page===p.index)error.resolved_at=new Date().toISOString();
    await save();
    return {page:p.index,articles:records.length,images:records.reduce((n,r)=>n+r.images.length,0)};
  }
  return {status,inventory,get remaining(){return plan.filter(p=>!status.completed.includes(p.index));},
    async batch(tab,seconds=25) {
      const started=Date.now(),done=[];
      while(Date.now()-started<seconds*1000) {
        const next=plan.find(p=>!status.completed.includes(p.index));if(!next)break;
        try {done.push(await capturePage(tab,next));}
        catch(error){status.errors.push({page:next.index,error:String(error),at:new Date().toISOString()});await save();throw error;}
      }
      return {pages_done:status.completed.length,pages_total:plan.length,image_articles:status.image_articles,images:status.images,last:done.at(-1),seconds:Math.round((Date.now()-started)/1000)};
    },save,imageRecord,selectPage,captureChapters,
    async publish(){await fs.writeFile(inventoryPath,JSON.stringify(inventory,null,2)+'\n');await fs.writeFile(chaptersPath,JSON.stringify(chapters,null,2)+'\n');await fs.writeFile(path.join(folder,'status.json'),JSON.stringify(status,null,2)+'\n');}
  };
}
