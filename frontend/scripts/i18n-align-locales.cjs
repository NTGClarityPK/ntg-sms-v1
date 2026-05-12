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
    if (!isPlainObject(cur[part])) cur[part] = {};
    cur = cur[part];
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, obj) {
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function pickFallbackValue(key, flatByLocale, locale) {
  const v = (l) => flatByLocale[l]?.[key];

  if (locale === 'ar') {
    // Arabic missing: fall back to English (better than blank).
    return v('ar') ?? v('en') ?? v('en-GB') ?? v('en-US') ?? `[MISSING] ${key}`;
  }

  // English variants missing: prefer their own, then en, then other English variant, last resort key marker.
  if (locale === 'en') {
    return v('en') ?? v('en-GB') ?? v('en-US') ?? `[MISSING] ${key}`;
  }
  if (locale === 'en-GB') {
    return v('en-GB') ?? v('en') ?? v('en-US') ?? `[MISSING] ${key}`;
  }
  if (locale === 'en-US') {
    return v('en-US') ?? v('en') ?? v('en-GB') ?? `[MISSING] ${key}`;
  }

  return `[MISSING] ${key}`;
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

  const outputByLocale = {};
  const fillStats = {};

  for (const locale of LOCALES) {
    outputByLocale[locale] = JSON.parse(JSON.stringify(jsonByLocale[locale]));
    fillStats[locale] = { added: 0 };
  }

  for (const key of allKeys) {
    for (const locale of LOCALES) {
      if (flatByLocale[locale][key] !== undefined) continue;
      const fallback = pickFallbackValue(key, flatByLocale, locale);
      setDeep(outputByLocale[locale], key, typeof fallback === 'string' ? fallback : String(fallback));
      fillStats[locale].added += 1;
    }
  }

  for (const locale of LOCALES) {
    const outPath = path.join(MESSAGES_DIR, `${locale}.json`);
    writeJson(outPath, outputByLocale[locale]);
  }

  console.log('Locale alignment complete.');
  console.log(fillStats);
  console.log("Note: Missing English values are filled with '[MISSING] <key>' so there are no blank cells in Excel.");
}

main();

