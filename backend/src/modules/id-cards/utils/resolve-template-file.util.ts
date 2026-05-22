import * as fs from 'fs';
import * as path from 'path';

/** Nest copies id-cards HTML assets beside compiled JS under dist/src; older builds used dist/modules. */
export function resolveIdCardsTemplateFile(
  moduleDir: string,
  ...segments: string[]
): string {
  const rel = path.join('templates', ...segments);
  const candidates = [
    path.join(process.cwd(), 'src', 'modules', 'id-cards', rel),
    path.join(moduleDir, rel),
    path.join(moduleDir, '..', '..', '..', 'modules', 'id-cards', rel),
    path.join(process.cwd(), 'dist', 'src', 'modules', 'id-cards', rel),
    path.join(process.cwd(), 'dist', 'modules', 'id-cards', rel),
  ];

  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) return filePath;
  }

  return candidates[0]!;
}
