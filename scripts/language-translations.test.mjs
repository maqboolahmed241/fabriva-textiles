import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../store.js", import.meta.url), "utf8");

function extractObjectLiteral(text, declaration) {
  const start = text.indexOf(declaration);
  assert.notEqual(start, -1, `Missing declaration: ${declaration}`);
  const open = text.indexOf("{", start + declaration.length);
  assert.notEqual(open, -1, "Translation object has no opening brace");

  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = open; i < text.length; i += 1) {
    const char = text[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(open, i + 1);
    }
  }
  assert.fail("Translation object has unbalanced braces");
}

const literal = extractObjectLiteral(source, "const translations=");
const translations = vm.runInNewContext("(" + literal + ")");
const expectedLocales = ["en", "ur", "ar", "fr", "de", "es"];

test("all six supported storefront languages are present", () => {
  assert.deepEqual(Object.keys(translations).sort(), [...expectedLocales].sort());
});

test("every language has exactly the same translation keys", () => {
  const referenceKeys = Object.keys(translations.en).sort();
  for (const locale of expectedLocales) {
    assert.deepEqual(
      Object.keys(translations[locale]).sort(),
      referenceKeys,
      `Translation keys differ for locale ${locale}`
    );
  }
});

test("all translation values are non-empty strings", () => {
  for (const [locale, dictionary] of Object.entries(translations)) {
    for (const [key, value] of Object.entries(dictionary)) {
      assert.equal(typeof value, "string", `${locale}.${key} must be a string`);
      assert.ok(value.trim().length > 0, `${locale}.${key} must not be empty`);
    }
  }
});

test("language selector offers exactly the six implemented locales", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const start = html.indexOf('<select id="language-select"');
  assert.notEqual(start, -1, "Missing language selector");
  const end = html.indexOf("</select>", start);
  assert.notEqual(end, -1, "Language selector is not closed");
  const select = html.slice(start, end + "</select>".length);
  const options = [...select.matchAll(/<option value="([^"]+)"/g)]
    .map((match) => match[1])
    .sort();
  assert.deepEqual(options, [...expectedLocales].sort());
});
