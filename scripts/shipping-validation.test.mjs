import test from "node:test";
import assert from "node:assert/strict";
import { validateShippingRate } from "../shipping-validation.js";

const valid = { country_name: " Pakistan ", country_code: "pk", region_name: " Sindh ", currency: "PKR", amount: 250, free_over: 5000 };

test("normalizes valid delivery rate details", () => {
  assert.deepEqual(validateShippingRate(valid), { country_name: "Pakistan", country_code: "PK", region_name: "Sindh", currency: "PKR", amount: 250, free_over: 5000 });
});

test("accepts zero delivery charges and an omitted free-delivery threshold", () => {
  assert.equal(validateShippingRate({ ...valid, amount: "0", free_over: "" }).free_over, null);
  assert.equal(validateShippingRate({ ...valid, amount: "0", free_over: "" }).amount, 0);
});

test("rejects malformed country codes, blank regions and unsupported currencies", () => {
  assert.throws(() => validateShippingRate({ ...valid, country_code: "Pakistan" }), /two-letter/);
  assert.throws(() => validateShippingRate({ ...valid, region_name: " " }), /province or region/);
  assert.throws(() => validateShippingRate({ ...valid, currency: "XYZ" }), /supported delivery currency/);
});

test("rejects negative, non-finite and invalid delivery amounts", () => {
  for (const amount of [-1, "not-a-number", Infinity]) {
    assert.throws(() => validateShippingRate({ ...valid, amount }));
  }
  for (const free_over of [-1, "bad", Infinity]) {
    assert.throws(() => validateShippingRate({ ...valid, free_over }));
  }
});
