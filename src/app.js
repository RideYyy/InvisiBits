import { createContainer, decodeContainer, readContainerHeader } from "./core/steganography/container.js";
import { decodeImage, encodeImage, inspectImage } from "./core/steganography/image.js";
import { extractFromRgba } from "./core/steganography/lsb.js";
import { decodeWav, encodeWav } from "./core/steganography/wav.js";
import { analyzeLsb } from "./core/detection/index.js";
import { downloadBlob, humanSize, stegImageName, stegWavName, validateImageFile, validateWavFile } from "./utils/files.js";

const state = { imageMessage: "", audioMessage: "" };
const byId = (id) => document.getElementById(id);

function setStatus(id, message = "", kind = "") {
  const element = byId(id);
  element.textContent = message;
  if (kind) element.dataset.kind = kind;
  else delete element.dataset.kind;
}

function presentError(statusId, error) {
  console.error(error);
  const safeMessage = error?.message || "An unexpected error occurred.";
  setStatus(statusId, safeMessage, "error");
}

async function withBusy(form, action) {
  const buttons = form.querySelectorAll("button");
  buttons.forEach((button) => { button.disabled = true; });
  try { await action(); } finally { buttons.forEach((button) => { button.disabled = false; }); }
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((item) => {
      const active = item === tab;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll(".tab-panel").forEach((panel) => {
      const active = panel.id === tab.dataset.tab;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });
    history.replaceState(null, "", `#${tab.dataset.tab}`);
  });
});

const requestedTab = location.hash.slice(1);
document.querySelector(`.tab[data-tab="${CSS.escape(requestedTab)}"]`)?.click();

document.querySelectorAll('input[type="file"]').forEach((input) => {
  input.addEventListener("change", () => {
    const label = document.querySelector(`[data-file-label="${input.id}"]`);
    label.textContent = input.files?.[0] ? `${input.files[0].name} · ${humanSize(input.files[0].size)}` : "No file selected";
  });
});

byId("image-message").addEventListener("input", (event) => {
  byId("message-size").textContent = `${humanSize(new TextEncoder().encode(event.target.value).length)} in UTF-8`;
});

byId("image-encode-form").addEventListener("submit", (event) => {
  event.preventDefault();
  withBusy(event.currentTarget, async () => {
    setStatus("image-encode-status", "Preparing the message…");
    try {
      const file = await validateImageFile(byId("image-encode-file").files[0]);
      const packed = await createContainer(byId("image-message").value, {
        password: byId("image-encode-password").value,
        compress: byId("image-compress").checked,
      });
      setStatus("image-encode-status", "Writing data into RGB channels…");
      const result = await encodeImage(file, packed.bytes);
      downloadBlob(result.blob, stegImageName(file.name));
      const compression = packed.metadata.compressed ? "compressed" : "compression did not reduce the text";
      setStatus("image-encode-status", `Done: ${result.width}×${result.height}, ${humanSize(packed.bytes.length)} container (${compression}). PNG downloaded.`, "success");
    } catch (error) { presentError("image-encode-status", error); }
  });
});

byId("image-decode-form").addEventListener("submit", (event) => {
  event.preventDefault();
  withBusy(event.currentTarget, async () => {
    byId("image-result").hidden = true;
    setStatus("image-decode-status", "Looking for an InvisiBits container…");
    try {
      const file = await validateImageFile(byId("image-decode-file").files[0]);
      const payload = await decodeImage(file);
      const decoded = await decodeContainer(payload, byId("image-decode-password").value);
      state.imageMessage = decoded.message;
      byId("image-result-text").textContent = decoded.message;
      byId("image-result").hidden = false;
      setStatus("image-decode-status", `Message recovered: ${humanSize(new TextEncoder().encode(decoded.message).length)}.`, "success");
    } catch (error) { presentError("image-decode-status", error); }
  });
});

byId("audio-encode-form").addEventListener("submit", (event) => {
  event.preventDefault();
  withBusy(event.currentTarget, async () => {
    setStatus("audio-encode-status", "Preparing the WAV file…");
    try {
      const file = await validateWavFile(byId("audio-encode-file").files[0]);
      const source = new Uint8Array(await file.arrayBuffer());
      const packed = await createContainer(byId("audio-message").value, {
        password: byId("audio-encode-password").value,
        compress: byId("audio-compress").checked,
      });
      const result = encodeWav(source, packed.bytes);
      downloadBlob(new Blob([result.bytes], { type: "audio/wav" }), stegWavName(file.name));
      const compression = packed.metadata.compressed ? "compressed" : "compression did not reduce the text";
      setStatus("audio-encode-status", `Done: ${result.info.sampleRate} Hz, ${result.info.bitsPerSample}-bit PCM, ${humanSize(packed.bytes.length)} container (${compression}). WAV downloaded.`, "success");
    } catch (error) { presentError("audio-encode-status", error); }
  });
});

byId("audio-decode-form").addEventListener("submit", (event) => {
  event.preventDefault();
  withBusy(event.currentTarget, async () => {
    byId("audio-result").hidden = true;
    setStatus("audio-decode-status", "Reading PCM samples…");
    try {
      const file = await validateWavFile(byId("audio-decode-file").files[0]);
      const source = new Uint8Array(await file.arrayBuffer());
      const decodedWav = decodeWav(source);
      const decoded = await decodeContainer(decodedWav.payload, byId("audio-decode-password").value);
      state.audioMessage = decoded.message;
      byId("audio-result-text").textContent = decoded.message;
      byId("audio-result").hidden = false;
      setStatus("audio-decode-status", "The message was recovered successfully.", "success");
    } catch (error) { presentError("audio-decode-status", error); }
  });
});

function downloadMessage(message, filename) {
  downloadBlob(new Blob([message], { type: "text/plain;charset=utf-8" }), filename);
}

byId("download-image-message").addEventListener("click", () => downloadMessage(state.imageMessage, "decoded_message.txt"));
byId("download-audio-message").addEventListener("click", () => downloadMessage(state.audioMessage, "decoded_audio_message.txt"));

function sampledRgb(rgba, limit = 1_500_000) {
  const pixelCount = Math.floor(rgba.length / 4);
  const step = Math.max(1, Math.ceil((pixelCount * 3) / limit));
  const output = [];
  for (let pixel = 0; pixel < pixelCount; pixel += step) {
    const offset = pixel * 4;
    output.push(rgba[offset], rgba[offset + 1], rgba[offset + 2]);
  }
  return Uint8Array.from(output);
}

byId("detection-form").addEventListener("submit", (event) => {
  event.preventDefault();
  withBusy(event.currentTarget, async () => {
    byId("detection-result").hidden = true;
    setStatus("detection-status", "Analyzing least significant bits…");
    try {
      const file = await validateImageFile(byId("detection-file").files[0]);
      const image = await inspectImage(file);
      let ownHeader = null;
      try { ownHeader = readContainerHeader(extractFromRgba(image.rgba)); } catch { /* Not an InvisiBits container. */ }

      const result = ownHeader
        ? { score: 100, level: "InvisiBits container found", details: `Version 1 · ${ownHeader.encrypted ? "encrypted" : "no password"} · ${ownHeader.compressed ? "compressed" : "not compressed"} · ${humanSize(ownHeader.totalLength)}` }
        : analyzeLsb(sampledRgb(image.rgba));

      byId("detection-score").textContent = ownHeader ? "Exact" : `${result.score}/100`;
      byId("detection-label").textContent = result.level;
      byId("detection-details").textContent = result.details;
      byId("detection-result").hidden = false;
      setStatus("detection-status", ownHeader
        ? "The exact format signature was detected."
        : "No InvisiBits signature was found. This score describes LSB distribution similarity, not the probability of hidden data.", "success");
    } catch (error) { presentError("detection-status", error); }
  });
});
