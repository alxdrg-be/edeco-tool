import test from "node:test";
import assert from "node:assert/strict";
import { routeNetworkEdge, segmentHitsRectangle, NETWORK_NODE_WIDTH, NETWORK_NODE_HEIGHT } from "./networkRouting.ts";
import type { NetworkNode, NetworkEdge } from "./networkTypes.ts";
const node = (id: string, x: number, y: number): NetworkNode => ({ id, x, y, kind: "distribution", label: id, values: {} });
const edge = (from: string, to: string): NetworkEdge => ({ id: "line", from, to, values: {} });

test("horizontal branches use right/left ports and captions below their target", () => {
  const nodes = new Map([node("a",70,195),node("b",350,80),node("c",350,310)].map(n => [n.id,n]));
  const result = routeNetworkEdge(edge("a","b"),nodes,"horizontal")!;
  assert.equal(result.blocked,false);
  assert.deepEqual(result.points[0],{x:70+NETWORK_NODE_WIDTH,y:195+NETWORK_NODE_HEIGHT/2});
  assert.deepEqual(result.points.at(-1),{x:350,y:80+NETWORK_NODE_HEIGHT/2});
  assert.ok(result.labelY>80+NETWORK_NODE_HEIGHT);
  for(let i=1;i<result.points.length;i++)assert.ok(result.points[i].x===result.points[i-1].x||result.points[i].y===result.points[i-1].y);
});

test("a skip-level branch is routed around intervening component and annotation boxes", () => {
  const middle = node("middle",350,80), nodes = new Map([node("a",70,80),middle,node("b",910,80)].map(n=>[n.id,n]));
  const result=routeNetworkEdge(edge("a","b"),nodes,"horizontal",0,new Set(["middle","b"]))!;
  assert.equal(result.blocked,false);assert.ok(result.points.some(p=>p.y<80||p.y>80+NETWORK_NODE_HEIGHT));
  const box={left:middle.x,right:middle.x+NETWORK_NODE_WIDTH,top:middle.y,bottom:middle.y+NETWORK_NODE_HEIGHT+62};
  for(let i=1;i<result.points.length;i++)assert.equal(segmentHitsRectangle(result.points[i-1],result.points[i],box),false);
});

test("overlapping obstructed exits do not produce a misleading line through a component", () => {
  const nodes=new Map([node("a",70,80),node("block",70+NETWORK_NODE_WIDTH+2,60),node("b",910,80)].map(n=>[n.id,n]));
  const result=routeNetworkEdge(edge("a","b"),nodes,"horizontal")!;
  assert.equal(result.blocked,true);assert.equal(result.path,"");
});

test("vertical legacy orientation retains top/bottom ports",()=>{
  const nodes=new Map([node("a",80,70),node("b",80,300)].map(n=>[n.id,n]));
  const result=routeNetworkEdge(edge("a","b"),nodes,"vertical")!;
  assert.deepEqual(result.points[0],{x:80+NETWORK_NODE_WIDTH/2,y:70+NETWORK_NODE_HEIGHT});
  assert.deepEqual(result.points.at(-1),{x:80+NETWORK_NODE_WIDTH/2,y:300});
  assert.equal(result.blocked,false);
});
