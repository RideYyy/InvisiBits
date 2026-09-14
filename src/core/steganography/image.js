import { AppError, ensure } from "../errors.js";
import { embedInRgba, extractFromRgba, rgbaCapacityBytes } from "./lsb.js";

const MAX_PIXELS = 40_000_000;

async function loadBitmap(file) {
  try {
    return await createImageBitmap(file);
  } catch {
    throw new AppError("The image could not be read. The file may be corrupted.", "INVALID_IMAGE");
  }
}

function canvasFor(bitmap) {
  ensure(bitmap.width * bitmap.height <= MAX_PIXELS, "The image resolution is too large.", "IMAGE_TOO_LARGE");
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  ensure(context, "The Canvas API is not available.", "CANVAS_UNSUPPORTED");
  context.drawImage(bitmap, 0, 0);
  return { canvas, context };
}

export async function readImage(file) {
  const bitmap = await loadBitmap(file);
  const { canvas, context } = canvasFor(bitmap);
  const imageData = context.getImageData(0, 0, bitmap.width, bitmap.height);
  const result = { canvas, context, imageData, width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return result;
}

export async function encodeImage(file, payload) {
  const image = await readImage(file);
  const encoded = embedInRgba(image.imageData.data, payload);
  image.imageData.data.set(encoded);
  image.context.putImageData(image.imageData, 0, 0);
  const blob = await new Promise((resolve) => image.canvas.toBlob(resolve, "image/png"));
  ensure(blob, "The output PNG image could not be created.", "IMAGE_EXPORT_FAILED");
  return { blob, capacity: rgbaCapacityBytes(encoded), width: image.width, height: image.height };
}

export async function decodeImage(file) {
  const image = await readImage(file);
  return extractFromRgba(image.imageData.data);
}

export async function inspectImage(file) {
  const image = await readImage(file);
  return { rgba: image.imageData.data, width: image.width, height: image.height };
}
