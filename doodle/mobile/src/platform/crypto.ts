import { CryptoDigestAlgorithm, CryptoEncoding, digestStringAsync, getRandomBytesAsync, randomUUID } from "expo-crypto";

export function sha256Hex(value: string): Promise<string> {
  return digestStringAsync(CryptoDigestAlgorithm.SHA256, value, { encoding: CryptoEncoding.HEX });
}

export { randomUUID };

export async function randomNonce(): Promise<string> {
  const bytes = await getRandomBytesAsync(32);
  return Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
}
