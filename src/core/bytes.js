import { AppError } from "./errors.js";

const encoder = new TextEncoder();

export function textToBytes(value) {
  return encoder.encode(value);
}

export function bytesToText(value) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(value);
  } catch {
    throw new AppError("The hidden data is not valid UTF-8 text.", "INVALID_TEXT");
  }
}

export function concatBytes(...parts) {
  const size = parts.reduce((total, part) => total + part.length, 0);
  const result = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

export function bytesEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

export function writeUint32(target, offset, value) {
  new DataView(target.buffer, target.byteOffset, target.byteLength).setUint32(offset, value, false);
}

export function readUint32(source, offset) {
  return new DataView(source.buffer, source.byteOffset, source.byteLength).getUint32(offset, false);
}
