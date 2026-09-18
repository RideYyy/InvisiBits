import test from "node:test";
import assert from "node:assert/strict";

import { analyzeLsb } from "../src/core/detection/index.js";

test("detector reports insufficient data for a tiny sample", () => {
  const result = analyzeLsb(new Uint8Array(255));

  assert.equal(result.score, 0);
  assert.equal(result.level, "Not enough data");
});

test("detector describes a uniform LSB distribution as similarity, not certainty", () => {
  const values = Uint8Array.from({ length: 512 }, (_, index) => index % 2);
  const result = analyzeLsb(values);

  assert.equal(result.score, 100);
  assert.equal(result.level, "Elevated LSB similarity");
  assert.match(result.details, /Distribution score only/);
});

test("detector labels a one-sided LSB distribution as limited similarity", () => {
  const result = analyzeLsb(new Uint8Array(512));

  assert.equal(result.score, 0);
  assert.equal(result.level, "Limited LSB similarity");
});
