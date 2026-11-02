import assert from "node:assert/strict";
import test from "node:test";
import { NETWORK_COORDINATE_LIMIT, arrangeNetwork, findAttachmentParent, nextNetworkPosition, networkHistory, networkHistoryReducer, networkOrientation, parseNetworkDocument } from "./networkEditor.ts";
import type { NetworkDocument } from "./networkTypes.ts";

const example = (): NetworkDocument => ({ version: 1, name: "Schulhaus", nodes: [
  { id: "source", kind: "source", label: "Netz", x: 0, y: 0, values: { voltage: "400" } },
  { id: "a", kind: "load", label: "Licht", x: 0, y: 0, values: { power: "" } },
  { id: "b", kind: "load", label: "Motor", x: 0, y: 0, values: { power: "11" } },
], edges: [{ id: "ea", from: "source", to: "a", values: { length: "25" } }, { id: "eb", from: "source", to: "b", values: { length: "30" } }] });

test("network import preserves editable blank inputs but rejects broken identities and geometry", () => {
  const imported = parseNetworkDocument(example()); assert.equal(imported.nodes[1].values.power, "");
  imported.nodes[0].label = "Geändert"; assert.equal(example().nodes[0].label, "Netz");
  assert.throws(() => parseNetworkDocument({ ...example(), version: 2 }));
  assert.throws(() => parseNetworkDocument({ ...example(), nodes: [...example().nodes, example().nodes[0]] }));
  assert.throws(() => parseNetworkDocument({ ...example(), edges: [{ id: "bad", from: "source", to: "missing", values: {} }] }));
  const corrupt = example(); corrupt.nodes[0].x = NaN; assert.throws(() => parseNetworkDocument(corrupt));
});

test("one dragged gesture is one undo step and editing after undo removes redo history", () => {
  let state = networkHistory(example());
  state = networkHistoryReducer(state, { type: "checkpoint" });
  for (const x of [10,20,30]) state = networkHistoryReducer(state, { type: "live", document: { ...state.present, nodes: state.present.nodes.map(node => node.id === "a" ? { ...node, x } : node) } });
  assert.equal(state.past.length, 1); state = networkHistoryReducer(state, { type: "undo" });
  assert.equal(state.present.nodes[1].x, 0); state = networkHistoryReducer(state, { type: "redo" });
  assert.equal(state.present.nodes[1].x, 30); state = networkHistoryReducer(state, { type: "undo" });
  state = networkHistoryReducer(state, { type: "commit", document: { ...state.present, name: "Neue Variante" } });
  assert.equal(state.future.length, 0);
});

test("horizontal arrangement puts children in the next column and stacks branches without overlap", () => {
  const result = arrangeNetwork(example()), source = result.nodes[0];
  assert.equal(result.orientation, "horizontal");
  assert.equal(result.nodes[1].x, source.x + 280); assert.equal(result.nodes[2].x, source.x + 280);
  assert.notEqual(result.nodes[1].y, result.nodes[2].y); assert.equal(source.y, (result.nodes[1].y + result.nodes[2].y) / 2);
  assert.ok(Math.abs(result.nodes[1].y - result.nodes[2].y) >= 230);
  const loop = example(); loop.edges.push({ id: "loop", from: "a", to: "source", values: {} });
  assert.ok(arrangeNetwork(loop).nodes.every(node => Number.isFinite(node.x) && Number.isFinite(node.y)));
});

test("vertical layout stays available and old saved positions imply their orientation without moving", () => {
  const vertical = arrangeNetwork(example(), "vertical"), source = vertical.nodes[0];
  assert.equal(vertical.nodes[1].y, source.y + 230); assert.equal(vertical.nodes[2].y, source.y + 230);
  assert.ok(Math.abs(vertical.nodes[1].x - vertical.nodes[2].x) >= 280);
  const legacy = { ...vertical, orientation: undefined };
  assert.equal(networkOrientation(legacy), "vertical");
  assert.deepEqual(parseNetworkDocument(legacy).nodes, legacy.nodes);
  assert.throws(() => parseNetworkDocument({ ...example(), orientation: "diagonal" }));
});


test("automatic attachments require a nearby upstream output and never rewire connected nodes",()=>{
 const doc=arrangeNetwork(example());
 assert.equal(findAttachmentParent(doc,{x:doc.nodes[0].x+280,y:doc.nodes[0].y},"load")?.id,"source");
 assert.equal(findAttachmentParent(doc,{x:doc.nodes[0].x+280,y:doc.nodes[0].y+230},"load")?.id,"source");
 assert.equal(findAttachmentParent(doc,{x:doc.nodes[0].x-280,y:doc.nodes[0].y},"load"),undefined);
 assert.equal(findAttachmentParent(doc,{x:doc.nodes[0].x+280,y:doc.nodes[0].y},"source"),undefined);
 assert.equal(findAttachmentParent(doc,{x:doc.nodes[0].x+280,y:doc.nodes[0].y},"load","a"),undefined);
 const vertical=arrangeNetwork(example(),"vertical");
 assert.equal(findAttachmentParent(vertical,{x:vertical.nodes[0].x,y:vertical.nodes[0].y+230},"load")?.id,"source");
});

test("a free distribution cannot auto-attach to its own downstream component",()=>{
 const doc=arrangeNetwork(example());doc.nodes[1].kind="distribution";
 assert.equal(findAttachmentParent(doc,{x:doc.nodes[1].x+280,y:doc.nodes[1].y},"source","source"),undefined);
 const root={...doc.nodes[0],kind:"distribution" as const};doc.nodes[0]=root;
 assert.equal(findAttachmentParent(doc,{x:doc.nodes[1].x+280,y:doc.nodes[1].y},"distribution","source"),undefined);
});

test("click placement uses the selected parent next column and leaves occupied branches separate",()=>{
 const doc=arrangeNetwork(example()),p=nextNetworkPosition(doc,doc.nodes[0]);
 assert.equal(p.x,doc.nodes[0].x+280);assert.ok(doc.nodes.every(n=>Math.abs(n.x-p.x)>=228||Math.abs(n.y-p.y)>=195));
});


test("150-node chains and parallel leaves remain editable and survive JSON round trips",()=>{
 for(const topology of ["chain","leaves"]){
  const nodes=Array.from({length:150},(_,index)=>({id:`node-${index}`,kind:index===0?"source" as const:"distribution" as const,label:`Bauteil ${index}`,x:0,y:0,values:{}}));
  const edges=nodes.slice(1).map((node,index)=>({id:`edge-${index}`,from:topology==="chain"?nodes[index].id:nodes[0].id,to:node.id,values:{}}));
  for(const orientation of ["horizontal","vertical"] as const){
   const arranged=arrangeNetwork({version:1,name:"Grosses Netz",nodes,edges},orientation);
   assert.ok(arranged.nodes.every(node=>Math.abs(node.x)<=NETWORK_COORDINATE_LIMIT&&Math.abs(node.y)<=NETWORK_COORDINATE_LIMIT));
   assert.deepEqual(parseNetworkDocument(JSON.parse(JSON.stringify(arranged))),arranged);
   if(topology==="chain")assert.ok(Math.max(...arranged.nodes.map(node=>orientation==="horizontal"?node.x:node.y))>10000);
  }
 }
 const outside=example();outside.nodes[0].x=NETWORK_COORDINATE_LIMIT+1;assert.throws(()=>parseNetworkDocument(outside));
});
