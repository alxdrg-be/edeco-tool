// Resume only through documented CUA tab handles. Every saved record is a checkpoint.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createCapture} from './portal_capture.mjs';
import {createDetailsCapture} from './portal_details_capture.mjs';

export async function resumeCapture(root,tabs,options={}){
  const read=async name=>JSON.parse(await fs.readFile(path.join(root,name),'utf8'));
  const pages=await read('data/portal_capture/details-plan.json');
  const previews=await read('data/portal_capture/plan.json');
  const inventory=await read('web/images/inventory.json');
  const key=image=>JSON.stringify([image.number,image.file,image.kind,image.ordinal,image.vas||[image.va]]);
  const known=new Set(inventory.map(key));
  // Recover associations written into completed source records if a prior batch was interrupted.
  const folder=path.join(root,'data/portal_capture/details');
  const names=(await fs.readdir(folder)).filter(name=>/^\d+-\d+\.json$/.test(name));
  for(let start=0;start<names.length;start+=50){
    const records=await Promise.all(names.slice(start,start+50).map(async name=>({name,record:JSON.parse(await fs.readFile(path.join(folder,name),'utf8'))})));
    for(const {name,record} of records){
      if(name!==record.number+'-'+record.va+'.json')throw Error('Ungültige Quellkennung: '+name);
      for(const image of record.images||[]){
        if(image.number!==record.number||!(image.vas||[image.va]).includes(record.va))throw Error('Ungültige Bildzuordnung: '+name);
        if(!known.has(key(image))){inventory.push(image);known.add(key(image));}
      }
    }
  }
  // A caller can move frequently rewritten diagnostics outside a synced folder.
  // Completed source records and published inventories remain inside the project.
  const stateFolder=options.stateFolder||path.join(root,'.work/portal-details-resume');
  const media=await createCapture(root,previews,{stateFolder,inventory,status:{completed:previews.map(p=>p.index)}});
  const details=await createDetailsCapture(root,pages,media,stateFolder);
  const targets=tabs.map((tab,index)=>({tab,assigned:pages.filter((p,i)=>i%tabs.length===index)}));
  return {media,details,targets,async batch(seconds=25){
    const result=await details.batch(targets,seconds,2);
    await media.publish();
    return {new_records:result.new_records,completed:result.completed,total:result.total,
      image_articles:new Set(media.inventory.map(i=>i.number)).size,seconds:result.seconds};
  }};
}
