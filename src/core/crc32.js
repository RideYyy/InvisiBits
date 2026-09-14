const table = new Uint32Array(256);

for (let value = 0; value < 256; value += 1) {
  let entry = value;
  for (let bit = 0; bit < 8; bit += 1) {
    entry = (entry & 1) ? (0xedb88320 ^ (entry >>> 1)) : (entry >>> 1);
  }
  table[value] = entry >>> 0;
}

export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
