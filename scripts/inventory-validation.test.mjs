import test from "node:test";
import assert from "node:assert/strict";
import { validateInventoryPayload } from "../inventory-validation.js";

test("accepts each supported inventory unit and whole quantities", () => {
  for (const unit of ["piece", "suit", "roll", "pack"]) {
    assert.doesNotThrow(() => validateInventoryPayload({ unit, stock_qty: 12, low_stock_threshold: 2 }));
  }
});

test("rejects legacy meter unit", () => {
  assert.throws(() => validateInventoryPayload({ unit: "meter" }), /supported stock unit/);
});

test("rejects fractional or negative stock and thresholds", () => {
  for (const value of [1.5, -1, NaN, Infinity]) {
    assert.throws(() => validateInventoryPayload({ stock_qty: value }));
    assert.throws(() => validateInventoryPayload({ low_stock_threshold: value }));
  }
});

test("rejects negative prices and sale price above regular price", () => {
  assert.throws(() => validateInventoryPayload({ price: -1 }), /Price must be/);
  assert.throws(() => validateInventoryPayload({ price: 100, sale_price: 101 }), /Sale price must/);
  assert.doesNotThrow(() => validateInventoryPayload({ price: 100, sale_price: 80 }));
});
