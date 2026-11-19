export interface Env {
  DB: D1Database;
  /** base64 encoded 32-byte AES key (Worker Secret) */
  ENCRYPTION_KEY?: string;
  /** pbkdf2-sha256$<iterations>$<salt b64>$<hash b64> (Worker Secret) */
  ADMIN_PASSWORD_HASH?: string;
  ALLOWED_ORIGINS?: string;
  COOKIE_SAMESITE?: string;
}
