import test from "node:test";
import assert from "node:assert/strict";
import { createContainer, decodeContainer } from "../src/core/steganography/container.js";
import { decodeWav, encodeWav, parseWav } from "../src/core/steganography/wav.js";

function pcmWav(sampleCount = 16_000) {
  const bytesPerSample = 2;
  const result = new Uint8Array(44 + sampleCount * bytesPerSample);
  const view = new DataView(result.buffer);
  const put = (offset, text) => [...text].forEach((character, index) => { result[offset + index] = character.charCodeAt(0); });
  put(0, "RIFF");
  view.setUint32(4, result.length - 8, true);
  put(8, "WAVE"); put(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8_000, true);
  view.setUint32(28, 16_000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  put(36, "data");
  view.setUint32(40, sampleCount * bytesPerSample, true);
  for (let offset = 44; offset < result.length; offset += 2) view.setInt16(offset, Math.sin(offset / 12) * 20_000, true);
  return result;
}

test("WAV parser reports PCM properties and capacity", () => {
  const wav = pcmWav(8_000);
  const info = parseWav(wav);
  assert.equal(info.audioFormat, 1);
  assert.equal(info.bitsPerSample, 16);
  assert.equal(info.capacityBytes, 1_000);
});

test("WAV LSB round-trip preserves header and high sample bytes", async () => {
  const wav = pcmWav();
  const packed = await createContainer("Audio secret 🎧", { compress: true });
  const encoded = encodeWav(wav, packed.bytes).bytes;
  assert.deepEqual(encoded.slice(0, 44), wav.slice(0, 44));
  for (let offset = 45; offset < encoded.length; offset += 2) assert.equal(encoded[offset], wav[offset]);
  const decoded = decodeWav(encoded);
  assert.equal((await decodeContainer(decoded.payload)).message, "Audio secret 🎧");
});

test("compressed/non-PCM WAV is rejected", () => {
  const wav = pcmWav();
  new DataView(wav.buffer).setUint16(20, 3, true);
  assert.throws(() => parseWav(wav), { code: "UNSUPPORTED_WAV" });
});
