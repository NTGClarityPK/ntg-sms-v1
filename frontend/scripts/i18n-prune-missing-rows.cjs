/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const LOCALES = ['en', 'en-GB', 'en-US', 'ar'];
const MESSAGES_DIR = path.join(__dirname, '..', 'messages');

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === '[object Object]'
  );
}

function flattenLeaves(obj, prefix = '', out = {}) {
  if (!isPlainObject(obj)) return out;
  for (const [k, v] of Object.entries(obj)) {
    const nextKey = prefix ? `${prefix}.${k}` : k;
    if (isPlainObject(v)) flattenLeaves(v, nextKey, out);
    else out[nextKey] = v;
  }
  return out;
}

function deleteDeep(target, keyPath) {
  const parts = keyPath.split('.').filter(Boolean);
  if (parts.length === 0) return false;

  let cur = target;
  const stack = [];

  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    if (!isPlainObject(cur[part])) return false;
    stack.push({ obj: cur, key: part });
    cur = cur[part];
  }

  const leafKey = parts[parts.length - 1];
  if (!(leafKey in cur)) return false;
  delete cur[leafKey];

  // Cleanup empty parent objects.
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    const { obj, key } = stack[i];
    if (isPlainObject(obj[key]) && Object.keys(obj[key]).length === 0) {
      delete obj[key];
    } else {
      break;
    }
  }

  return true;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, obj) {
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function main() {
  const jsonByLocale = {};
  const flatByLocale = {};

  for (const locale of LOCALES) {
    const filePath = path.join(MESSAGES_DIR, `${locale}.json`);
    if (!fs.existsSync(filePath)) {
      console.error(`Missing messages file: ${filePath}`);
      process.exit(1);
    }
    jsonByLocale[locale] = readJson(filePath);
    flatByLocale[locale] = flattenLeaves(jsonByLocale[locale]);
  }

  const allKeys = new Set();
  for (const locale of LOCALES) {
    for (const key of Object.keys(flatByLocale[locale])) allKeys.add(key);
  }

  const missingKeys = [];
  for (const key of allKeys) {
    for (const locale of LOCALES) {
      const v = flatByLocale[locale][key];
      if (typeof v === 'string' && v.trim().startsWith('[MISSING]')) {
        missingKeys.push(key);
        break;
      }
    }
  }

  let deleted = 0;
  for (const key of missingKeys) {
    for (const locale of LOCALES) {
      if (deleteDeep(jsonByLocale[locale], key)) deleted += 1;
    }
  }

  for (const locale of LOCALES) {
    const outPath = path.join(MESSAGES_DIR, `${locale}.json`);
    writeJson(outPath, jsonByLocale[locale]);
  }

  console.log(`Pruned keys with [MISSING] placeholders: ${missingKeys.length} keys`);
  console.log(`Deleted leaf entries (all locales combined): ${deleted}`);
  if (missingKeys.length) {
    console.log('Sample pruned keys:', missingKeys.slice(0, 25));
  }
}

main();

