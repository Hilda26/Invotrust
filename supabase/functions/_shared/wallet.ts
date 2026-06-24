import * as secp256k1 from "npm:@noble/secp256k1@2.1.0";
import { keccak_256 } from "npm:@noble/hashes@1.5.0/sha3";

export interface GeneratedWallet {
  address: string;
  privateKey: Uint8Array;
}

/**
 * Generates a new secp256k1 keypair and derives its EVM-style address
 * (keccak256 of the uncompressed public key, last 20 bytes), which is
 * the account format used by GenLayer's EVM-compatible chains.
 */
export function generateWallet(): GeneratedWallet {
  const privateKey = secp256k1.utils.randomPrivateKey();
  const publicKey = secp256k1.getPublicKey(privateKey, false); // uncompressed, 65 bytes (0x04 prefix)
  const hash = keccak_256(publicKey.slice(1)); // drop the 0x04 prefix before hashing
  const addressBytes = hash.slice(-20);
  const address = `0x${toHex(addressBytes)}`;
  return { address, privateKey };
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
