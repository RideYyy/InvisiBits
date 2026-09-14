import test from "node:test";
import assert from "node:assert/strict";
import { createContainer, decodeContainer } from "../src/core/steganography/container.js";
import { embedInRgba, extractFromRgba, rgbaCapacityBytes } from "../src/core/steganography/lsb.js";

test("image LSB round-trip changes only RGB least significant bits", async () => {
  const carrier = new Uint8ClampedArray(80 * 80 * 4).fill(128);
  for (let index = 3; index < carrier.length; index += 4) carrier[index] = 255;
  const packed = await createContainer("LSB works 👻");
  const encoded = embedInRgba(carrier, packed.bytes);

  for (let index = 0; index < carrier.length; index += 1) {
    if (index % 4 === 3) assert.equal(encoded[index], carrier[index]);
    else assert.ok(Math.abs(encoded[index] - carrier[index]) <= 1);
  }
  assert.equal((await decodeContainer(extractFromRgba(encoded))).message, "LSB works 👻");
});

test("10x10 image rejects a long message", async () => {
  const carrier = new Uint8ClampedArray(10 * 10 * 4).fill(200);
  for (let index = 3; index < carrier.length; index += 4) carrier[index] = 255;
  const packed = await createContainer("x".repeat(100));
  assert.equal(rgbaCapacityBytes(carrier), 37);
  assert.throws(() => embedInRgba(carrier, packed.bytes), { code: "CAPACITY_EXCEEDED" });
});

test("ordinary pixels are rejected as a non-InvisiBits image", () => {
  const carrier = new Uint8ClampedArray(100 * 100 * 4).fill(42);
  for (let index = 3; index < carrier.length; index += 4) carrier[index] = 255;
  assert.throws(() => extractFromRgba(carrier), { code: "NO_PAYLOAD" });
});

test("transparent pixels are skipped because PNG normalization can alter their RGB", async () => {
  const carrier = new Uint8ClampedArray(100 * 100 * 4).fill(77);
  for (let index = 3; index < carrier.length; index += 4) carrier[index] = index < carrier.length / 2 ? 0 : 255;
  const packed = await createContainer("opaque pixels only");
  const encoded = embedInRgba(carrier, packed.bytes);
  for (let pixel = 0; pixel < carrier.length / 2; pixel += 4) {
    assert.deepEqual(encoded.slice(pixel, pixel + 4), carrier.slice(pixel, pixel + 4));
  }
  assert.equal((await decodeContainer(extractFromRgba(encoded))).message, "opaque pixels only");
});
