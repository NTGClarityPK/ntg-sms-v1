import archiver from 'archiver';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ZipEncryptable = require('archiver-zip-encryptable');
import { EncryptedPayloadMeta } from './export-crypto.util';

archiver.registerFormat('zip-encryptable', ZipEncryptable);

export function buildEncryptedExportZip(input: {
  ciphertext: Buffer;
  meta: EncryptedPayloadMeta;
  readme: string;
  password: string;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = archiver.create('zip-encryptable', {
      zlib: { level: 9 },
      encryptionMethod: 'aes256',
      password: input.password,
    } as archiver.ArchiverOptions);

    const chunks: Buffer[] = [];
    archive.on('data', (chunk: Buffer) => chunks.push(chunk));
    archive.on('error', reject);
    archive.on('end', () => resolve(Buffer.concat(chunks)));

    archive.append(input.ciphertext, { name: 'school-data.json.enc' });
    archive.append(JSON.stringify(input.meta, null, 2), { name: 'school-data.json.enc.meta' });
    archive.append(input.readme, { name: 'README.txt' });
    archive.finalize();
  });
}

export function buildExportFilename(tenantSlug: string, scope: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const safeSlug = tenantSlug.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 40) || 'school';
  return `alma-backup-${safeSlug}-${scope}-${date}.zip`;
}
