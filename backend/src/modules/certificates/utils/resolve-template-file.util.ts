import * as fs from 'fs';
import * as path from 'path';

/** Nest copies certificate HTML assets beside compiled JS under dist/src; fall back to src in dev. */
export function resolveCertificateTemplateFile(
  moduleDir: string,
  fileName: string,
): string {
  const rel = path.join('templates', fileName);
  const candidates = [
    path.join(process.cwd(), 'src', 'modules', 'certificates', rel),
    path.join(moduleDir, rel),
    path.join(moduleDir, '..', '..', '..', 'modules', 'certificates', rel),
    path.join(process.cwd(), 'dist', 'src', 'modules', 'certificates', rel),
    path.join(process.cwd(), 'dist', 'modules', 'certificates', rel),
  ];

  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) return filePath;
  }

  return candidates[0]!;
}
