import assert from "node:assert/strict";
import test from "node:test";
import { responsibility } from "./responsibility.ts";
import type { Placement } from "./types.ts";

const placement = (metadata: Record<string, string>) => ({ id: "p", rackId: "r", profileId: "x", label: "", startUnit: 1, side: "front", status: "planned", delivery: "open", montage: "open", notes: "", supportedById: null, zeroStartMm: null, zeroHeightMm: null, zeroInwardOffsetMm: null, metadata }) as Placement;

test("plan text follows the edeco rack template", () => {
  assert.equal(responsibility(placement({ supplyBy: "ICT Bauherr", installBy: "ICT Bauherr" })).plan, "L+M ICT Bauherr");
  assert.equal(responsibility(placement({ supplyBy: "swisspro", installBy: "ICT Bauherr" })).plan, "L durch swisspro, M durch ICT Bauherr");
  assert.equal(responsibility(placement({ supplyBy: "swisspro" })).plan, "L durch swisspro");
  assert.equal(responsibility(placement({})).plan, "");
});

test("only parts supplied by the client are highlighted", () => {
  assert.equal(responsibility(placement({ supplyBy: "ICT Bauherr", installBy: "ICT Bauherr" })).owner, true);
  assert.equal(responsibility(placement({ supplyBy: "swisspro", installBy: "ICT Bauherr" })).owner, false);
  assert.equal(responsibility(placement({ supplyBy: "swisspro", installBy: "swisspro" })).owner, false);
});
