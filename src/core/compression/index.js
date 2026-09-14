import { AppError } from "../errors.js";

async function transform(bytes, StreamType, format) {
  if (typeof StreamType !== "function") {
    throw new AppError("This browser does not support built-in compression.", "COMPRESSION_UNSUPPORTED");
  }

  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new StreamType(format));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    throw new AppError("The compressed data could not be processed.", "COMPRESSION_FAILED");
  }
}

export function compress(bytes) {
  return transform(bytes, globalThis.CompressionStream, "deflate");
}

export function decompress(bytes) {
  return transform(bytes, globalThis.DecompressionStream, "deflate");
}
