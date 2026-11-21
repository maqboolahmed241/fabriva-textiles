import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeCart } from "../cart-validation.js";

const products = [
  { id: "available", stock_qty: 5 },
  { id: "one-left", stock_qty: 1 },
  { id: "zero-stock", stock_qty: 0 },
];

test("keeps valid whole-number quantities within current stock", () => {
  assert.deepEqual(sanitizeCart({ available: 3, "one-left": "1" }, products), {
    available: 3,
    "one-left": 1,
  });
});

test("removes unknown product IDs and products with zero stock", () => {
  assert.deepEqual(sanitizeCart({ missing: 1, "zero-stock": 1 }, products), {});
});

test("removes quantities above current stock", () => {
  assert.deepEqual(sanitizeCart({ available: 6, "one-left": 2 }, products), {});
});

test("removes zero, negative, fractional and unsafe quantities", () => {
  assert.deepEqual(sanitizeCart({
    available: 0,
    "one-left": -1,
    fractional: 1.5,
    unsafe: Number.MAX_SAFE_INTEGER + 1,
  }, products), {});
});

test("rejects malformed cart containers", () => {
  assert.deepEqual(sanitizeCart(null, products), {});
  assert.deepEqual(sanitizeCart([], products), {});
  assert.deepEqual(sanitizeCart("not a cart", products), {});
});
