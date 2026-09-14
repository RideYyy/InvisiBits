import { AppError, ensure } from "../core/errors.js";

export const MAX_FILE_SIZE = 5 * 1024 * 1024;

const IMAGE_SIGNATURES = {
  png: (bytes) => bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte),
  jpeg: (bytes) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
};

export async function validateImageFile(file) {
  ensure(file, "Choose an image.", "FILE_REQUIRED");
  ensure(file.size <= MAX_FILE_SIZE, "The image exceeds the 5 MB limit.", "FILE_TOO_LARGE");
  const signature = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  ensure(IMAGE_SIGNATURES.png(signature) || IMAGE_SIGNATURES.jpeg(signature), "Only valid PNG and JPG/JPEG images are supported.", "UNSUPPORTED_FILE");
  return file;
}

export async function validateWavFile(file) {
  ensure(file, "Choose a WAV file.", "FILE_REQUIRED");
  ensure(file.size <= MAX_FILE_SIZE, "The WAV file exceeds the 5 MB limit.", "FILE_TOO_LARGE");
  const signature = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const riff = String.fromCharCode(...signature.slice(0, 4));
  const wave = String.fromCharCode(...signature.slice(8, 12));
  if (riff !== "RIFF" || wave !== "WAVE") {
    throw new AppError("The selected file is not a RIFF/WAVE file.", "UNSUPPORTED_FILE");
  }
  return file;
}

export function stegImageName(originalName) {
  const stem = originalName.replace(/\.[^.]+$/, "");
  return `${/_steg$/i.test(stem) ? stem : `${stem}_steg`}.png`;
}

export function stegWavName(originalName) {
  const stem = originalName.replace(/\.[^.]+$/, "");
  return `${/_steg$/i.test(stem) ? stem : `${stem}_steg`}.wav`;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
