import { CryptoDigestAlgorithm, CryptoEncoding, digestStringAsync, randomUUID } from "expo-crypto";

export function sha256Hex(value: string): Promise<string> {
  return digestStringAsync(CryptoDigestAlgorithm.SHA256, value, { encoding: CryptoEncoding.HEX });
}

export { randomUUID };
