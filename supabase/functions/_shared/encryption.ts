/**
 * Envelope encryption for wallet private keys.
 *
 * - A fresh 256-bit Data Encryption Key (DEK) is generated per wallet and
 *   used to AES-256-GCM encrypt the private key.
 * - The DEK itself is AES-256-GCM encrypted with the Key Encryption Key
 *   (KEK), which is held only as the WALLET_KEK secret and never stored in
 *   Postgres.
 * - The result (ciphertext + nonces + encrypted DEK) is serialized to JSON
 *   and stored in user_wallets.encrypted_private_key.
 */

const CURRENT_KEY_ENCRYPTION_VERSION = 1;

export interface EncryptedPrivateKey {
  v: number;
  dekIv: string;
  encryptedDek: string;
  pkIv: string;
  encryptedPk: string;
}

async function importAesKey(rawKey: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function getKek(): Promise<CryptoKey> {
  const kekBase64 = Deno.env.get("WALLET_KEK");
  if (!kekBase64) {
    throw new Error("WALLET_KEK secret is not configured");
  }
  return importAesKey(base64ToBytes(kekBase64));
}

export async function encryptPrivateKey(privateKey: Uint8Array): Promise<EncryptedPrivateKey> {
  const kek = await getKek();

  const dek = crypto.getRandomValues(new Uint8Array(32));
  const dekKey = await importAesKey(dek);

  const pkIv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedPk = await crypto.subtle.encrypt({ name: "AES-GCM", iv: pkIv }, dekKey, privateKey);

  const dekIv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedDek = await crypto.subtle.encrypt({ name: "AES-GCM", iv: dekIv }, kek, dek);

  return {
    v: CURRENT_KEY_ENCRYPTION_VERSION,
    dekIv: bytesToBase64(dekIv),
    encryptedDek: bytesToBase64(new Uint8Array(encryptedDek)),
    pkIv: bytesToBase64(pkIv),
    encryptedPk: bytesToBase64(new Uint8Array(encryptedPk)),
  };
}

export async function decryptPrivateKey(payload: EncryptedPrivateKey): Promise<Uint8Array> {
  const kek = await getKek();

  const dekBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(payload.dekIv) },
    kek,
    base64ToBytes(payload.encryptedDek),
  );
  const dekKey = await importAesKey(new Uint8Array(dekBuffer));

  const pkBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(payload.pkIv) },
    dekKey,
    base64ToBytes(payload.encryptedPk),
  );

  return new Uint8Array(pkBuffer);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
