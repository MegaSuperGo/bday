const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64encode(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s);
}

export function b64decode(str: string): Uint8Array {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function randomToken(bytes = 32): string {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  return b64encode(arr).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time comparison of equal-length byte arrays. */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// ---------- Password hashing (PBKDF2-SHA256) ----------

export async function pbkdf2(password: string, salt: Uint8Array, iterations: number, length = 32): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, length * 8);
  return new Uint8Array(bits);
}

/** Verifies against "pbkdf2-sha256$<iter>$<salt b64>$<hash b64>". */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.trim().split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2-sha256') return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 10000 || iterations > 100000) return false;
  const salt = b64decode(parts[2]);
  const expected = b64decode(parts[3]);
  const actual = await pbkdf2(password, salt, iterations, expected.length);
  return timingSafeEqual(actual, expected);
}

// ---------- AES-GCM secret encryption ----------

async function aesKey(keyB64: string): Promise<CryptoKey> {
  const raw = b64decode(keyB64);
  if (raw.length !== 32) throw new Error('ENCRYPTION_KEY must be 32 bytes (base64).');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptSecret(plaintext: string, keyB64: string, aad: string): Promise<{ iv: string; ciphertext: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await aesKey(keyB64);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(aad) }, key, enc.encode(plaintext));
  return { iv: b64encode(iv), ciphertext: b64encode(ct) };
}

export async function decryptSecret(ivB64: string, ctB64: string, keyB64: string, aad: string): Promise<string> {
  const key = await aesKey(keyB64);
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64decode(ivB64), additionalData: enc.encode(aad) },
    key,
    b64decode(ctB64),
  );
  return dec.decode(pt);
}
