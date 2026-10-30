// Read-only CUA capture, with one explicit UI step per worker at a time.
// Dialog and VA identities are checked before any source data are saved.
import fs from 'node:fs/promises';
import path from 'node:path';

export async function createDetailsCapture(root,pages,media,stateFolder){
  const folder=path.join(root,'data','portal_capture','details');
  await fs.mkdir(folder,{recursive:true});
  const completed=new Set((await fs.readdir(folder)).filter(n=>/^\d+-\d+\.json$/.test(n)).map(n=>n.slice(0,-5)));
  const status={source:'https://digital.asteigerag.ch/dashboard',year:2026,total:pages.reduce((n,p)=>n+p.targets.length,0),completed:completed.size,errors:[],started_at:new Date().toISOString()};
  const workers=new Map();
  async function writeRecord(key,record){const target=path.join(folder,key+'.json');await fs.writeFile(target+'.capture-next',JSON.stringify(record,null,2)+'\n');await fs.rename(target+'.capture-next',target);}
  async function view(tab,stage){return tab.playwright.evaluate(stage=>{
    const d=document.querySelector('kendo-dialog'),table=stage==='calculation'?document.querySelector('kendo-treelist table.k-grid-table'):null;
    const fields=stage==='basic'?[...document.querySelectorAll('#k-tabstrip-tabpanel-0 tr')].map(r=>({label:r.children[0]?.innerText.trim(),value:r.children[1]?.innerText.trim()??'',checkbox:r.querySelector('input[type="checkbox"]')?.checked??null})):[];
    return {year:document.querySelector('[role="combobox"]')?.innerText.trim(),dialog:d?.innerText.slice(0,130)||null,active:document.querySelector('[role="tab"][aria-selected="true"]')?.id,
      rows:table?[...table.querySelectorAll('tr[data-treelist-view-index]')].map(r=>({index:Number(r.getAttribute('data-treelist-view-index')),level:r.children[0].querySelectorAll('span.k-icon').length-1,expanded:r.children[0].getAttribute('aria-expanded'),cells:[...r.children].slice(0,10).map(c=>c.innerText.trim())})):[],
      tree_attributes:table?[...table.closest('[role="treegrid"]').attributes].map(a=>[a.name,a.value]):[],
      calculation:stage==='calculation'?[...document.querySelectorAll('table.calculationResult tr')].map(r=>[...r.children].map(c=>({text:c.innerText.trim(),value:c.querySelector('input')?.value??null}))):[],
      basic_data:fields,images:stage==='basic'?[...document.querySelectorAll('#k-tabstrip-tabpanel-0 img')].map(e=>({src:e.getAttribute('src'),width:e.naturalWidth,height:e.naturalHeight})):[],
      article_text:stage==='text'?(document.querySelector('#k-tabstrip-tabpanel-1')?.innerText??''):'',
      catalogue:['row','closed'].includes(stage)||(stage==='calculation'&&!d)?[...document.querySelectorAll('tr[kendogridlogicalrow]')].map(r=>({row:r.getAttribute('aria-rowindex'),number:r.querySelector('[aria-colindex="4"] a')?.innerText.replace(/\s/g,''),vas:[...r.querySelectorAll('[aria-colindex="5"] a[title^="VA "]')].filter(a=>a.getClientRects().length&&getComputedStyle(a).visibility!=='hidden'&&getComputedStyle(a).display!=='none').map(a=>a.title.slice(3)),text:r.querySelector('[aria-colindex="2"]')?.innerText.trim()})).filter(r=>r.number):[]
    };
  },stage);}
  async function save(){status.completed=completed.size;status.updated_at=new Date().toISOString();status.complete=status.completed===status.total;await fs.writeFile(path.join(stateFolder,'details-status.json'),JSON.stringify(status,null,2)+'\n');await media.save();}
  async function step(worker){
    const {tab,assigned}=worker;
    if(!worker.page){
      worker.page=assigned.find(p=>p.targets.some(t=>!completed.has(t.number+'-'+t.va)));
      if(!worker.page){worker.done=true;return false;}
      const current=await view(tab);
      if(current.dialog){if(!current.dialog.startsWith('Artikel:'))throw Error('Unerwarteter Dialog; keine Datenänderung bestätigt.');await tab.playwright.getByRole('button',{name:'OK',exact:true}).click({timeoutMs:5000});worker.stage='close';return true;}
      await media.selectPage(tab,worker.page);worker.stage='row';return true;
    }
    const v=await view(tab,worker.stage),page=worker.page;
    if(!v.year?.includes('2026'))throw Error('Portaljahr ist nicht 2026. Erfassung angehalten.');
    if(worker.stage==='close'){
      if(v.dialog)return false;
      worker.page=null;worker.stage=null;return true;
    }
    if(worker.stage==='closed'){
      if(v.dialog)return false;worker.stage='row';
    }
    if(worker.stage==='row'){
      const target=page.targets.find(t=>!completed.has(t.number+'-'+t.va));
      if(!target){worker.page=null;return true;}
      const row=v.catalogue.find(r=>r.number===target.number);if(!row)return false;
      worker.target=target;worker.key=target.number+'-'+target.va;
      if(!row.vas.includes(target.va)){
        const record={number:target.number,va:target.va,year:2026,source:status.source,portal_page:page.index,captured_at:new Date().toISOString(),capture_kind:'catalogue_text_no_calculation',article_text:row.text,basic_data:[],images:[]};
        await writeRecord(worker.key,record);completed.add(worker.key);worker.count++;return true;
      }
      await tab.playwright.locator('tr[kendogridlogicalrow][aria-rowindex="'+row.row+'"] a[title="VA '+target.va+'"]').click({timeoutMs:5000});worker.stage='calculation';return true;
    }
    const target=worker.target;
    if(worker.stage==='calculation'){
      if(!v.dialog){
        const row=v.catalogue.find(r=>r.number===target.number);
        if(row&&(!worker.openRetry||Date.now()-worker.openRetry>1500)){
          worker.openRetry=Date.now();
          await tab.playwright.locator('tr[kendogridlogicalrow][aria-rowindex="'+row.row+'"] a[title="VA '+target.va+'"]').click({timeoutMs:5000});return true;
        }
      }
      if(!v.dialog?.startsWith('Artikel: '+target.number+' '))return false;
      if(v.active!=='k-tabstrip-tab-2'){await tab.playwright.locator('#k-tabstrip-tab-2').click({timeoutMs:5000});return true;}
      if(v.rows[0]?.cells[1]!==target.number||v.rows[0]?.cells[2]!==target.va){
        return false;
      }
      worker.calculation={rows:v.rows,tree_attributes:v.tree_attributes,calculation:v.calculation};
      await tab.playwright.locator('#k-tabstrip-tab-0').click({timeoutMs:5000});worker.stage='basic';return true;
    }
    if(worker.stage==='basic'){
      if(!v.dialog?.startsWith('Artikel: '+target.number+' '))return false;
      if(v.active!=='k-tabstrip-tab-0'){await tab.playwright.locator('#k-tabstrip-tab-0').click({timeoutMs:5000});return true;}
      if(v.basic_data.find(f=>f.label==='Artikelnummer')?.value!==target.number)return false;
      if(v.images.some(i=>i.src?.startsWith('data:image')&&(!i.width||!i.height)))return false;
      worker.basic_data=v.basic_data;worker.images=[];
      for(let index=0;index<v.images.length;index++){
        const image=await media.imageRecord(v.images[index],target.number,[target.va],'Steiger-Portal, Grunddaten '+target.number+' / VA '+target.va+', Katalog 2026',page.index,'basic',index);
        if(image)worker.images.push(image);
      }
      await tab.playwright.locator('#k-tabstrip-tab-1').click({timeoutMs:5000});worker.stage='text';return true;
    }
    if(worker.stage==='text'){
      if(!v.dialog?.startsWith('Artikel: '+target.number+' '))return false;
      if(v.active!=='k-tabstrip-tab-1'){await tab.playwright.locator('#k-tabstrip-tab-1').click({timeoutMs:5000});return true;}
      const calc=worker.calculation,attrs=Object.fromEntries(calc.tree_attributes),completeTree=calc.rows.length>0&&Number(attrs['aria-rowcount'])===calc.rows.length+1&&calc.rows.every((r,i)=>r.index===i&&r.expanded!=='false');
      const record={number:target.number,va:target.va,year:2026,source:status.source,portal_page:page.index,captured_at:new Date().toISOString(),capture_kind:'article_dialog',basic_data:worker.basic_data,article_text:v.article_text,images:worker.images,...calc,complete_tree:completeTree};
      await writeRecord(worker.key,record);completed.add(worker.key);worker.count++;worker.last=worker.key;
      await tab.playwright.getByRole('button',{name:'OK',exact:true}).click({timeoutMs:5000});worker.stage='closed';return true;
    }
    return false;
  }
  return {status,completed,folder,workers,save,
    async batch(targets,seconds=25,concurrency=1){
      if(!Number.isInteger(concurrency)||concurrency<1||concurrency>2)throw Error('Nur ein oder zwei gleichzeitige Browser-Schritte sind unterstützt.');
      for(const {tab,assigned} of targets)if(!workers.has(tab.id))workers.set(tab.id,{tab,assigned,page:null,stage:null,count:0,done:false});
      const start=Date.now(),before=completed.size;let idle=0;
      while(Date.now()-start<seconds*1000){
        await fs.writeFile(path.join(stateFolder,'active-steps.json'),JSON.stringify([...workers.values()].map(w=>({tab:w.tab.id,stage:w.stage,page:w.page?.index,key:w.key,at:new Date().toISOString()})),null,2));
        let progress=false;
        const active=[...workers.values()].filter(w=>!w.done);
        for(let offset=0;offset<active.length;offset+=concurrency){
          const results=await Promise.allSettled(active.slice(offset,offset+concurrency).map(async worker=>{
            try{return await step(worker);}
            catch(error){status.errors.push({article:worker.key||null,page:worker.page?.index,error:String(error),at:new Date().toISOString()});throw error;}
          }));
          const failed=results.find(result=>result.status==='rejected');
          if(failed){await save();throw failed.reason;}
          progress=results.some(result=>result.value)||progress;
        }
        if([...workers.values()].every(w=>w.done))break;
        if(progress)idle=0;
        else { if(++idle>=80)break; await new Promise(r=>setTimeout(r,250)); }
      }
      await save();return {new_records:completed.size-before,completed:completed.size,total:status.total,workers:[...workers.values()].map(w=>({tab:w.tab.id,count:w.count,last:w.last,stage:w.stage,pending:w.key,page:w.page?.index})),seconds:Math.round((Date.now()-start)/1000)};
    }
  };
}
