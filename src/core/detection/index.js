import { MAGIC } from "../steganography/container.js";

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function analyzeLsb(values) {
  if (values.length < 256) {
    return { score: 0, level: "Not enough data", details: "The file is too small for statistical analysis." };
  }

  const histogram = new Uint32Array(256);
  let ones = 0;
  for (const value of values) {
    histogram[value] += 1;
    ones += value & 1;
  }

  const oneRatio = ones / values.length;
  const balanceScore = clamp(1 - Math.abs(oneRatio - 0.5) * 8, 0, 1);
  let pairDifference = 0;
  let pairTotal = 0;
  for (let value = 0; value < 256; value += 2) {
    pairDifference += Math.abs(histogram[value] - histogram[value + 1]);
    pairTotal += histogram[value] + histogram[value + 1];
  }
  const pairScore = clamp(1 - (pairDifference / Math.max(1, pairTotal)) * 5, 0, 1);
  const score = Math.round((balanceScore * 0.4 + pairScore * 0.6) * 100);
  const level = score >= 75
    ? "Elevated LSB similarity"
    : score >= 45
      ? "Moderate LSB similarity"
      : "Limited LSB similarity";

  return {
    score,
    level,
    details: `Distribution score only · LSB one ratio: ${(oneRatio * 100).toFixed(2)}%; pair imbalance: ${((pairDifference / pairTotal) * 100).toFixed(2)}%.`,
  };
}

export function hasInvisiBitsMagic(extractedHeader) {
  return extractedHeader?.length >= MAGIC.length && MAGIC.every((byte, index) => extractedHeader[index] === byte);
}
