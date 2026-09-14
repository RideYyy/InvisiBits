import test from "node:test";
import assert from "node:assert/strict";
import { createContainer, decodeContainer, FLAG_COMPRESSED, FLAG_ENCRYPTED, readContainerHeader } from "../src/core/steganography/container.js";

test("container preserves Unicode and XSS-like text as plain text", async () => {
  const message = "Hello 👻 日本語 <script>alert('XSS')</script>";
  const packed = await createContainer(message);
  const decoded = await decodeContainer(packed.bytes);
  assert.equal(decoded.message, message);
  assert.equal(readContainerHeader(packed.bytes).flags, 0);
});

test("password encrypts content and incorrect password fails", async () => {
  const packed = await createContainer("top secret", { password: "correct horse" });
  assert.ok(readContainerHeader(packed.bytes).flags & FLAG_ENCRYPTED);
  await assert.rejects(() => decodeContainer(packed.bytes), { code: "PASSWORD_REQUIRED" });
  await assert.rejects(() => decodeContainer(packed.bytes, "wrong"), { code: "DECRYPTION_FAILED" });
  assert.equal((await decodeContainer(packed.bytes, "correct horse")).message, "top secret");
});

test("compression is used only when it reduces size", async () => {
  const message = "InvisiBits ".repeat(500);
  const packed = await createContainer(message, { compress: true });
  assert.ok(readContainerHeader(packed.bytes).flags & FLAG_COMPRESSED);
  assert.ok(packed.metadata.storedBytes < packed.metadata.originalBytes);
  assert.equal((await decodeContainer(packed.bytes)).message, message);
});

test("integrity check rejects modified unencrypted payload", async () => {
  const packed = await createContainer("detect corruption");
  const corrupted = new Uint8Array(packed.bytes);
  corrupted[corrupted.length - 1] ^= 1;
  await assert.rejects(() => decodeContainer(corrupted), { code: "INTEGRITY_FAILED" });
});
