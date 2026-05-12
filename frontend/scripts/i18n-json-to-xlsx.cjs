/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const LOCALES = ['en', 'en-GB', 'en-US', 'ar'];
const MESSAGES_DIR = path.join(__dirname, '..', 'messages');
const DEFAULT_OUT_FILE = path.join(__dirname, '..', 'messages.xlsx');

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === '[object Object]'
  );
}

function flattenObject(obj, prefix = '') {
  const out = {};
  if (!isPlainObject(obj)) return out;

  for (const [key, value] of Object.entries(obj)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;

    if (isPlainObject(value)) {
      Object.assign(out, flattenObject(value, nextKey));
      continue;
    }

    if (Array.isArray(value)) {
      // Not expected in our i18n JSON, but keep it round-trippable.
      out[nextKey] = JSON.stringify(value);
      continue;
    }

    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null
    ) {
      out[nextKey] = value === null ? '' : String(value);
      continue;
    }

    // Unknown leaf type; keep it as JSON string to avoid data loss.
    out[nextKey] = JSON.stringify(value);
  }

  return out;
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

async function main() {
  const outFile = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_OUT_FILE;

  const flatByLocale = {};
  for (const locale of LOCALES) {
    const filePath = path.join(MESSAGES_DIR, `${locale}.json`);
    if (!fs.existsSync(filePath)) {
      console.error(`Missing messages file: ${filePath}`);
      process.exit(1);
    }
    const json = readJson(filePath);
    flatByLocale[locale] = flattenObject(json);
  }

  const allKeys = new Set();
  for (const locale of LOCALES) {
    for (const key of Object.keys(flatByLocale[locale])) allKeys.add(key);
  }

  const keysSorted = Array.from(allKeys).sort((a, b) => a.localeCompare(b));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SMS i18n tooling';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('translations', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  worksheet.columns = [
    { header: 'key', key: 'key', width: 60 },
    ...LOCALES.map((locale) => ({ header: locale, key: locale, width: 45 })),
  ];

  // Sheet protection: makes "locked" cells actually locked in Excel.
  // No password -> still prevents accidental edits in most clients, while easy to unlock if needed.
  await worksheet.protect('', {
    selectLockedCells: true,
    selectUnlockedCells: true,
  });

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle' };

  // Style and lock the key column (A).
  const keyFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFE5E5' }, // very light red/pink
  };

  const headerKeyCell = headerRow.getCell(1);
  headerKeyCell.protection = { locked: true };
  headerKeyCell.fill = keyFill;

  // Data rows: translation cells are unlocked so experts can edit.
  for (const key of keysSorted) {
    const row = { key };
    for (const locale of LOCALES) row[locale] = flatByLocale[locale][key] ?? '';

    const addedRow = worksheet.addRow(row);
    // Unlock translation cells (B..)
    for (let col = 2; col <= 1 + LOCALES.length; col += 1) {
      addedRow.getCell(col).protection = { locked: false };
    }
    // Keep key locked explicitly per-row too (some Excel clients behave better)
    const keyCell = addedRow.getCell(1);
    keyCell.protection = { locked: true };
    keyCell.fill = keyFill;
  }

  await workbook.xlsx.writeFile(outFile);

  console.log(`Wrote Excel: ${outFile}`);
  console.log(`Rows: ${keysSorted.length}`);
  console.log(`Locales: ${LOCALES.join(', ')}`);
  console.log(`Tip: Don't edit the 'key' column.`);
}

main().catch((err) => {
  console.error('Failed to export Excel.', err?.message ?? err);
  process.exit(1);
});

