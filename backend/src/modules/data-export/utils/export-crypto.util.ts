import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const PBKDF2_ITERATIONS = 210_000;
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;

export type EncryptedPayloadMeta = {
  version: string;
  algorithm: typeof ALGORITHM;
  pbkdf2Iterations: number;
  salt: string;
  iv: string;
  authTag: string;
};

export function encryptExportJson(plaintext: string, password: string): {
  ciphertext: Buffer;
  meta: EncryptedPayloadMeta;
} {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: encrypted,
    meta: {
      version: '1',
      algorithm: ALGORITHM,
      pbkdf2Iterations: PBKDF2_ITERATIONS,
      salt: salt.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
    },
  };
}

/** For tests / future restore tooling. */
export function decryptExportJson(
  ciphertext: Buffer,
  meta: EncryptedPayloadMeta,
  password: string,
): string {
  const salt = Buffer.from(meta.salt, 'base64');
  const iv = Buffer.from(meta.iv, 'base64');
  const authTag = Buffer.from(meta.authTag, 'base64');
  const key = pbkdf2Sync(password, salt, meta.pbkdf2Iterations, KEY_LENGTH, 'sha256');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
