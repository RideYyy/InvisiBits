import test from "node:test";
import assert from "node:assert/strict";
import { stegImageName, stegWavName } from "../src/utils/files.js";

test("steg suffix is appended exactly once", () => {
  assert.equal(stegImageName("photo.jpg"), "photo_steg.png");
  assert.equal(stegImageName("photo_steg.jpg"), "photo_steg.png");
  assert.equal(stegImageName("archive.photo.PNG"), "archive.photo_steg.png");
  assert.equal(stegWavName("voice.wav"), "voice_steg.wav");
  assert.equal(stegWavName("voice_steg.wav"), "voice_steg.wav");
});
