import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateQuote, discountFor } from "../src/tools.js";

const tiers = [{ min_kg: 20, percent: 8 }, { min_kg: 10, percent: 5 }, { min_kg: 5, percent: 3 }];

test("discount tiers", () => {
  assert.equal(discountFor(4, tiers), 0);
  assert.equal(discountFor(5, tiers), 3);
  assert.equal(discountFor(12, tiers), 5);
  assert.equal(discountFor(20, tiers), 8);
});

test("quote math: 12kg RAW-A at 5% off", () => {
  const r = calculateQuote([{ sku: "RAW-A", kg: 12 }]);
  assert.ok(r.ok);
  assert.equal((r.data as any).total, 24_000_000 * 12 * 0.95);
});

test("rejects insufficient stock", () => {
  const r = calculateQuote([{ sku: "RAW-C", kg: 50 }]);
  assert.equal(r.ok, false);
});

test("rejects unknown SKU and bad quantity", () => {
  assert.equal(calculateQuote([{ sku: "NOPE", kg: 1 }]).ok, false);
  assert.equal(calculateQuote([{ sku: "RAW-A", kg: -2 }]).ok, false);
});
