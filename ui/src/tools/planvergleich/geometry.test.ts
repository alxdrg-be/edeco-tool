import assert from "node:assert/strict";
import test from "node:test";
import { alignPair, transform, unionFrame, colourDifference, groupTiles } from "./geometry.ts";

test("two-point alignment preserves an independent check point under translation, rotation, and scale", () => {
  const t = alignPair({x:50,y:2}, {x:50,y:42}, {x:5,y:5}, {x:25,y:5});
  assert.deepEqual(transform({x:15,y:15}, t), {x:30,y:22});
  assert.throws(() => alignPair({x:0,y:0},{x:0,y:0},{x:3,y:3},{x:33,y:13}));
});

test("offset changes outside the reference sheet remain in the comparison", () => {
  const frame = unionFrame({width:100,height:100}, {width:150,height:80}, {a:1,b:0,x:-30,y:70});
  assert.deepEqual(frame, { left:-30, top:0, scale:1, width:150, height:150 });
});

test("removed, added and shared strokes are red, blue and grey; untouched paper stays white", () => {
  const dark=[0,0,0,255], paper=[255,255,255,255];
  const original=new Uint8ClampedArray([...dark,...paper,...dark,...paper]);
  const newer=new Uint8ClampedArray([...paper,...dark,...dark,...paper]);
  const {pixels,regions}=colourDifference(original,newer,4,1);
  assert.ok(pixels[0]>pixels[2]); assert.ok(pixels[6]>pixels[4]); assert.equal(pixels[8],pixels[10]);
  assert.deepEqual([...pixels.slice(12)],paper); assert.equal(regions.length,1);
  assert.equal(colourDifference(original,original,4,1).regions.length,0);
});

test("difference groups stay local and edge tiles are clipped", () => {
  const hits = new Uint8Array([1,0,0,1,0,1,0,1]);
  assert.deepEqual(groupTiles(hits,100,55,32), [
    { left:0,top:0,right:.64,bottom:1 },{left:.96,top:0,right:1,bottom:1},
  ]);
});

test("one-pixel line shift is visible at zero tolerance; radius one ignores it, larger moves remain", () => {
  function strokeAt(index: number) {
    const row = new Uint8ClampedArray(8 * 4).fill(255);
    row.fill(0, index * 4, index * 4 + 3);
    return row;
  }
  assert.equal(colourDifference(strokeAt(2), strokeAt(3), 8, 1, 0).regions.length, 1);
  assert.equal(colourDifference(strokeAt(2), strokeAt(3), 8, 1, 1).regions.length, 0);
  assert.equal(colourDifference(strokeAt(2), strokeAt(5), 8, 1, 2).regions.length, 1);
});
