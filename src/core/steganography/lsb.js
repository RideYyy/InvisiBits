import { HEADER_SIZE, readContainerHeader } from "./container.js";
import { ensure } from "../errors.js";

function embedAt(bytes, payload, positionCount, indexAt) {
  ensure(payload.length * 8 <= positionCount, "The message is too long for the selected file.", "CAPACITY_EXCEEDED");
  const result = new Uint8Array(bytes);

  for (let bitIndex = 0; bitIndex < payload.length * 8; bitIndex += 1) {
    const sourceByte = payload[bitIndex >>> 3];
    const bit = (sourceByte >>> (7 - (bitIndex & 7))) & 1;
    const carrierIndex = indexAt(bitIndex);
    result[carrierIndex] = (result[carrierIndex] & 0xfe) | bit;
  }
  return result;
}

function extractAt(bytes, byteCount, positionCount, indexAt) {
  ensure(byteCount * 8 <= positionCount, "The hidden data does not fit in the available file area.", "TRUNCATED_PAYLOAD");
  const result = new Uint8Array(byteCount);

  for (let bitIndex = 0; bitIndex < byteCount * 8; bitIndex += 1) {
    result[bitIndex >>> 3] |= (bytes[indexAt(bitIndex)] & 1) << (7 - (bitIndex & 7));
  }
  return result;
}

export function rgbaCapacityBytes(rgba) {
  let opaquePixels = 0;
  for (let alpha = 3; alpha < rgba.length; alpha += 4) {
    if (rgba[alpha] === 255) opaquePixels += 1;
  }
  return Math.floor((opaquePixels * 3) / 8);
}

export function embedInRgba(rgba, payload) {
  ensure(payload.length <= rgbaCapacityBytes(rgba), "The message is too long for the selected file.", "CAPACITY_EXCEEDED");
  const result = new Uint8ClampedArray(rgba);
  let bitIndex = 0;

  for (let pixel = 0; pixel < result.length && bitIndex < payload.length * 8; pixel += 4) {
    if (result[pixel + 3] !== 255) continue;
    for (let channel = 0; channel < 3 && bitIndex < payload.length * 8; channel += 1) {
      const bit = (payload[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1;
      result[pixel + channel] = (result[pixel + channel] & 0xfe) | bit;
      bitIndex += 1;
    }
  }
  return result;
}

function extractRgbaBytes(rgba, byteCount) {
  ensure(byteCount <= rgbaCapacityBytes(rgba), "The hidden data does not fit in the available image area.", "TRUNCATED_PAYLOAD");
  const result = new Uint8Array(byteCount);
  let bitIndex = 0;

  for (let pixel = 0; pixel < rgba.length && bitIndex < byteCount * 8; pixel += 4) {
    if (rgba[pixel + 3] !== 255) continue;
    for (let channel = 0; channel < 3 && bitIndex < byteCount * 8; channel += 1) {
      result[bitIndex >>> 3] |= (rgba[pixel + channel] & 1) << (7 - (bitIndex & 7));
      bitIndex += 1;
    }
  }
  return result;
}

export function extractFromRgba(rgba) {
  const headerBytes = extractRgbaBytes(rgba, HEADER_SIZE);
  const header = readContainerHeader(headerBytes);
  return extractRgbaBytes(rgba, header.totalLength);
}

export function embedAtStride(bytes, payload, start, step, positionCount) {
  return embedAt(bytes, payload, positionCount, (position) => start + position * step);
}

export function extractAtStride(bytes, start, step, positionCount) {
  const indexAt = (position) => start + position * step;
  const headerBytes = extractAt(bytes, HEADER_SIZE, positionCount, indexAt);
  const header = readContainerHeader(headerBytes);
  return extractAt(bytes, header.totalLength, positionCount, indexAt);
}

export function extractRawAtStride(bytes, byteCount, start, step, positionCount) {
  return extractAt(bytes, byteCount, positionCount, (position) => start + position * step);
}
