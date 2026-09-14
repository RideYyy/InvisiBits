import { ensure } from "../errors.js";
import { embedAtStride, extractAtStride } from "./lsb.js";

function ascii(bytes, offset, length) {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

export function parseWav(bytes) {
  ensure(bytes.length >= 44, "The WAV file is too short or corrupted.", "INVALID_WAV");
  ensure(ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WAVE", "Only RIFF/WAVE files are supported.", "INVALID_WAV");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  let format;
  let data;

  while (offset + 8 <= bytes.length) {
    const id = ascii(bytes, offset, 4);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    ensure(body + size <= bytes.length, "A WAV chunk is truncated.", "INVALID_WAV");

    if (id === "fmt " && size >= 16) {
      format = {
        audioFormat: view.getUint16(body, true),
        channels: view.getUint16(body + 2, true),
        sampleRate: view.getUint32(body + 4, true),
        blockAlign: view.getUint16(body + 12, true),
        bitsPerSample: view.getUint16(body + 14, true),
      };
    } else if (id === "data") {
      data = { offset: body, size };
    }
    offset = body + size + (size & 1);
  }

  ensure(format && data, "The WAV file does not contain the required fmt and data chunks.", "INVALID_WAV");
  ensure(format.audioFormat === 1, "Only uncompressed PCM WAV is supported.", "UNSUPPORTED_WAV");
  ensure([8, 16, 24, 32].includes(format.bitsPerSample), "Only 8, 16, 24, or 32-bit PCM is supported.", "UNSUPPORTED_WAV");

  const bytesPerSample = format.bitsPerSample / 8;
  const sampleCount = Math.floor(data.size / bytesPerSample);
  return {
    ...format,
    dataOffset: data.offset,
    dataSize: data.size,
    bytesPerSample,
    sampleCount,
    capacityBytes: Math.floor(sampleCount / 8),
  };
}

export function encodeWav(bytes, payload) {
  const info = parseWav(bytes);
  return { bytes: embedAtStride(bytes, payload, info.dataOffset, info.bytesPerSample, info.sampleCount), info };
}

export function decodeWav(bytes) {
  const info = parseWav(bytes);
  return { payload: extractAtStride(bytes, info.dataOffset, info.bytesPerSample, info.sampleCount), info };
}
