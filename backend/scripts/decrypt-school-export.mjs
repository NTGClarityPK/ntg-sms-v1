/**
 * Decrypt an Alma school data export (school-data.json.enc + .meta).
 *
 * Usage:
 *   node decrypt-school-export.mjs
 *   node decrypt-school-export.mjs <ciphertext> <meta.json> <output.json>
 *
 * Prompts for the backup password (same as used when creating the export).
 */
import { createDecipheriv, pbkdf2Sync } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { createInterface } from 'readline';

const encPath = process.argv[2] ?? 'school-data.json.enc';
const metaPath = process.argv[3] ?? 'school-data.json.enc.meta';
const outPath = process.argv[4] ?? 'school-data.json';

function promptPassword() {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question('Backup password: ', (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  const password = await promptPassword();
  const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
  const ciphertext = readFileSync(encPath);
  const salt = Buffer.from(meta.salt, 'base64');
  const iv = Buffer.from(meta.iv, 'base64');
  const authTag = Buffer.from(meta.authTag, 'base64');
  const key = pbkdf2Sync(password, salt, meta.pbkdf2Iterations, 32, 'sha256');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  writeFileSync(outPath, plain);
  console.log(`Decrypted to ${outPath}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
