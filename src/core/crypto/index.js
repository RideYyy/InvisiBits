import { AppError } from "../errors.js";
import { textToBytes } from "../bytes.js";

export const SALT_LENGTH = 16;
export const IV_LENGTH = 12;
export const PBKDF2_ITERATIONS = 250_000;

function cryptoApi() {
  if (!globalThis.crypto?.subtle) {
    throw new AppError("The Web Crypto API is not available in this environment.", "CRYPTO_UNSUPPORTED");
  }
  return globalThis.crypto;
}

async function deriveKey(password, salt, usages) {
  const api = cryptoApi();
  const material = await api.subtle.importKey(
    "raw",
    textToBytes(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return api.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    usages,
  );
}

export async function encrypt(bytes, password) {
  const api = cryptoApi();
  const salt = api.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = api.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(password, salt, ["encrypt"]);
  const encrypted = await api.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes);
  return { bytes: new Uint8Array(encrypted), salt, iv };
}

export async function decrypt(bytes, password, salt, iv) {
  try {
    const key = await deriveKey(password, salt, ["decrypt"]);
    const decrypted = await cryptoApi().subtle.decrypt({ name: "AES-GCM", iv }, key, bytes);
    return new Uint8Array(decrypted);
  } catch {
    throw new AppError("The password is incorrect or the hidden data is corrupted.", "DECRYPTION_FAILED");
  }
}
