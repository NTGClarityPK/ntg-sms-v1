/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const LOCALES = ['en', 'en-GB', 'en-US', 'ar'];
const MESSAGES_DIR = path.join(__dirname, '..', 'messages');
const DEFAULT_IN_FILE = path.join(__dirname, '..', 'messages.xlsx');

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

    // Only leaf keys matter for validation. Arrays/other types are treated as leaf.
    out[nextKey] = true;
  }

  return out;
}

function setDeep(target, keyPath, value) {
  const parts = keyPath.split('.').filter(Boolean);
  if (parts.length === 0) return;

  let cur = target;
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    const isLeaf = i === parts.length - 1;

    if (isLeaf) {
      cur[part] = value;
      return;
    }

    const next = cur[part];
    if (!isPlainObject(next)) cur[part] = {};
    cur = cur[part];
  }
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function main() {
  const inFile = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_IN_FILE;

  if (!fs.existsSync(inFile)) {
    console.error(`Excel file not found: ${inFile}`);
    console.error(`Run: npm run i18n:export`);
    process.exit(1);
  }

  // Load existing JSON files as base so blank Excel cells don't wipe values.
  const baseByLocale = {};
  for (const locale of LOCALES) {
    const filePath = path.join(MESSAGES_DIR, `${locale}.json`);
    if (!fs.existsSync(filePath)) {
      console.error(`Missing messages file: ${filePath}`);
      process.exit(1);
    }
    baseByLocale[locale] = readJson(filePath);
  }

  // Build allowed key set from existing JSON so edits to the key column fail safely.
  const allowedKeys = new Set();
  for (const locale of LOCALES) {
    const flat = flattenObject(baseByLocale[locale]);
    for (const key of Object.keys(flat)) allowedKeys.add(key);
  }

  const workbook = XLSX.readFile(inFile, { cellDates: false });
  const sheetName = workbook.SheetNames.includes('translations')
    ? 'translations'
    : workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  // Validate keys before writing anything.
  const seenKeys = new Map();
  const unknownKeys = [];
  const duplicateKeys = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const key = String(row.key ?? '').trim();
    if (!key) continue;

    const rowNumber = i + 2; // header is row 1 in Excel

    if (seenKeys.has(key)) {
      duplicateKeys.push({ key, rowNumber, firstRowNumber: seenKeys.get(key) });
    } else {
      seenKeys.set(key, rowNumber);
    }

    if (!allowedKeys.has(key)) {
      unknownKeys.push({ key, rowNumber });
    }
  }

  if (duplicateKeys.length > 0 || unknownKeys.length > 0) {
    console.error('Import aborted: Excel validation failed.');

    if (duplicateKeys.length > 0) {
      console.error(`- Duplicate keys (${duplicateKeys.length}):`);
      for (const item of duplicateKeys.slice(0, 25)) {
        console.error(
          `  - ${item.key} (rows ${item.firstRowNumber} and ${item.rowNumber})`,
        );
      }
      if (duplicateKeys.length > 25) console.error('  - ... more duplicates ...');
    }

    if (unknownKeys.length > 0) {
      console.error(`- Unknown/edited keys (${unknownKeys.length}):`);
      for (const item of unknownKeys.slice(0, 25)) {
        console.error(`  - ${item.key} (row ${item.rowNumber})`);
      }
      if (unknownKeys.length > 25) console.error('  - ... more unknown keys ...');
    }

    console.error(
      "Fix by restoring the 'key' column from a fresh export, then re-apply the translation edits.",
    );
    process.exit(1);
  }

  let updatedCount = 0;
  for (const row of rows) {
    const key = String(row.key ?? '').trim();
    if (!key) continue;

    for (const locale of LOCALES) {
      const rawVal = row[locale];
      const val = typeof rawVal === 'string' ? rawVal : rawVal == null ? '' : String(rawVal);
      if (val === '') continue; // keep existing value
      setDeep(baseByLocale[locale], key, val);
      updatedCount += 1;
    }
  }

  for (const locale of LOCALES) {
    const outPath = path.join(MESSAGES_DIR, `${locale}.json`);
    fs.writeFileSync(outPath, JSON.stringify(baseByLocale[locale], null, 2) + '\n', 'utf8');
  }

  console.log(`Read Excel: ${inFile} (sheet: ${sheetName})`);
  console.log(`Updated cells: ${updatedCount}`);
  console.log(`Wrote JSON: ${LOCALES.map((l) => `${l}.json`).join(', ')}`);
  console.log(`Note: Empty cells do NOT overwrite existing JSON values.`);
}

main();

