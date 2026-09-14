import { bytesToText, concatBytes, readUint32, textToBytes, writeUint32 } from "../bytes.js";
import { compress, decompress } from "../compression/index.js";
import { crc32 } from "../crc32.js";
import { decrypt, encrypt } from "../crypto/index.js";
import { AppError, ensure } from "../errors.js";

export const MAGIC = new Uint8Array([0x49, 0x56, 0x42, 0x54]); // IVBT
export const VERSION = 1;
export const HEADER_SIZE = 20;
export const FLAG_COMPRESSED = 1;
export const FLAG_ENCRYPTED = 2;
const KNOWN_FLAGS = FLAG_COMPRESSED | FLAG_ENCRYPTED;
const MAX_CONTAINER_SIZE = 64 * 1024 * 1024;

function hasMagic(bytes) {
  return MAGIC.every((byte, index) => bytes[index] === byte);
}

export function readContainerHeader(bytes) {
  ensure(bytes.length >= HEADER_SIZE, "The file does not contain InvisiBits data.", "NO_PAYLOAD");
  ensure(hasMagic(bytes), "No InvisiBits message was found. The file may have been created by another tool.", "NO_PAYLOAD");
  ensure(bytes[4] === VERSION, "This hidden-message version is not supported.", "UNSUPPORTED_VERSION");
  ensure((bytes[5] & ~KNOWN_FLAGS) === 0, "The hidden-message header is corrupted.", "INVALID_HEADER");

  const payloadLength = readUint32(bytes, 6);
  const originalLength = readUint32(bytes, 10);
  const checksum = readUint32(bytes, 14);
  const saltLength = bytes[18];
  const ivLength = bytes[19];
  const totalLength = HEADER_SIZE + saltLength + ivLength + payloadLength;

  ensure(payloadLength > 0, "The hidden message is empty or corrupted.", "INVALID_HEADER");
  ensure(totalLength <= MAX_CONTAINER_SIZE, "The declared hidden-data size is invalid.", "INVALID_HEADER");
  ensure(originalLength <= MAX_CONTAINER_SIZE, "The declared message size is invalid.", "INVALID_HEADER");

  const encrypted = Boolean(bytes[5] & FLAG_ENCRYPTED);
  ensure(encrypted || (saltLength === 0 && ivLength === 0), "The hidden-message header is corrupted.", "INVALID_HEADER");
  ensure(!encrypted || (saltLength === 16 && ivLength === 12), "The encryption parameters are corrupted.", "INVALID_HEADER");

  return {
    flags: bytes[5],
    payloadLength,
    originalLength,
    checksum,
    saltLength,
    ivLength,
    totalLength,
    compressed: Boolean(bytes[5] & FLAG_COMPRESSED),
    encrypted,
  };
}

export async function createContainer(message, options = {}) {
  ensure(typeof message === "string" && message.length > 0, "Enter a message to hide.", "EMPTY_MESSAGE");
  const original = textToBytes(message);
  ensure(original.length <= MAX_CONTAINER_SIZE, "The message exceeds the safe 64 MB limit.", "MESSAGE_TOO_LARGE");
  let payload = original;
  let flags = 0;

  if (options.compress) {
    const candidate = await compress(original);
    if (candidate.length < original.length) {
      payload = candidate;
      flags |= FLAG_COMPRESSED;
    }
  }

  let salt = new Uint8Array(0);
  let iv = new Uint8Array(0);
  if (options.password) {
    const encrypted = await encrypt(payload, options.password);
    payload = encrypted.bytes;
    salt = encrypted.salt;
    iv = encrypted.iv;
    flags |= FLAG_ENCRYPTED;
  }

  const header = new Uint8Array(HEADER_SIZE);
  header.set(MAGIC, 0);
  header[4] = VERSION;
  header[5] = flags;
  writeUint32(header, 6, payload.length);
  writeUint32(header, 10, original.length);
  writeUint32(header, 14, crc32(original));
  header[18] = salt.length;
  header[19] = iv.length;

  return {
    bytes: concatBytes(header, salt, iv, payload),
    metadata: {
      originalBytes: original.length,
      storedBytes: payload.length,
      compressed: Boolean(flags & FLAG_COMPRESSED),
      encrypted: Boolean(flags & FLAG_ENCRYPTED),
    },
  };
}

export async function decodeContainer(container, password = "") {
  const header = readContainerHeader(container);
  ensure(container.length >= header.totalLength, "The hidden data is truncated or corrupted.", "TRUNCATED_PAYLOAD");

  let offset = HEADER_SIZE;
  const salt = container.slice(offset, offset + header.saltLength);
  offset += header.saltLength;
  const iv = container.slice(offset, offset + header.ivLength);
  offset += header.ivLength;
  let payload = container.slice(offset, offset + header.payloadLength);

  if (header.encrypted) {
    if (!password) {
      throw new AppError("This message is encrypted. Enter the password.", "PASSWORD_REQUIRED");
    }
    payload = await decrypt(payload, password, salt, iv);
  }

  if (header.compressed) {
    payload = await decompress(payload);
  }

  ensure(payload.length === header.originalLength, "The recovered message size does not match the expected size.", "INTEGRITY_FAILED");
  ensure(crc32(payload) === header.checksum, "The message failed its integrity check.", "INTEGRITY_FAILED");

  return {
    message: bytesToText(payload),
    metadata: header,
  };
}
