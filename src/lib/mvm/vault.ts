import type { StoredVault, VaultData } from "./types.ts";

const memory: { key: CryptoKey | null } = { key: null };

function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function b64ToBytes(value: string): Uint8Array {
  const bin = atob(value);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function derive(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 80_000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function seal(key: CryptoKey, text: string): Promise<{ iv: string; data: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(text));
  return { iv: bytesToB64(iv), data: bytesToB64(new Uint8Array(cipher)) };
}

export function emptyVault(): VaultData {
  return { logins: [], addresses: [], cards: [] };
}

export async function createVault(pin: string, data: VaultData = emptyVault()): Promise<StoredVault> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await derive(pin, salt);
  const body = await seal(key, JSON.stringify(data));
  const verifier = await seal(key, "mvm-ok");
  memory.key = key;
  return { salt: bytesToB64(salt), iv: body.iv, data: body.data, verifier: `${verifier.iv}.${verifier.data}` };
}

export async function unlockVault(pin: string, stored: StoredVault): Promise<VaultData> {
  const key = await derive(pin, b64ToBytes(stored.salt));
  const [viv, vdata] = stored.verifier.split(".");
  const check = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64ToBytes(viv || "") },
    key,
    b64ToBytes(vdata || ""),
  );
  if (new TextDecoder().decode(check) !== "mvm-ok") throw new Error("PIN");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64ToBytes(stored.iv) },
    key,
    b64ToBytes(stored.data),
  );
  memory.key = key;
  return JSON.parse(new TextDecoder().decode(plain)) as VaultData;
}

export async function writeVault(data: VaultData, stored: StoredVault): Promise<StoredVault> {
  if (!memory.key) throw new Error("LOCKED");
  const body = await seal(memory.key, JSON.stringify(data));
  return { ...stored, iv: body.iv, data: body.data };
}

export function lockMemory(): void {
  memory.key = null;
}

export function vaultIsOpen(): boolean {
  return memory.key !== null;
}

export async function registerUnlock(): Promise<string | null> {
  if (!window.PublicKeyCredential) return null;
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "MVM Browser" },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: "mvm", displayName: "MVM" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
      authenticatorSelection: { userVerification: "required", residentKey: "preferred" },
      timeout: 60_000,
    },
  });
  if (!cred || cred.type !== "public-key") return null;
  const id = new Uint8Array((cred as PublicKeyCredential).rawId);
  return bytesToB64(id);
}

export async function verifyUnlock(idB64: string): Promise<boolean> {
  if (!window.PublicKeyCredential) return false;
  const cred = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ type: "public-key", id: b64ToBytes(idB64) }],
      userVerification: "required",
      timeout: 60_000,
    },
  });
  return !!cred;
}
