/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const MESSAGES_DIR = path.join(__dirname, '..', 'messages');
const AR_PATH = path.join(MESSAGES_DIR, 'ar.json');
const EN_PATH = path.join(MESSAGES_DIR, 'en.json');

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

function main() {
  if (!fs.existsSync(AR_PATH) || !fs.existsSync(EN_PATH)) {
    console.error('Missing messages files. Expected:', AR_PATH, EN_PATH);
    process.exit(1);
  }

  const arJson = readJson(AR_PATH);
  const enJson = readJson(EN_PATH);

  const arFlat = flattenLeaves(arJson);
  const enFlat = flattenLeaves(enJson);

  let cleared = 0;
  const clearedKeys = [];

  for (const [key, arValRaw] of Object.entries(arFlat)) {
    const arVal = String(arValRaw ?? '').trim();
    if (!arVal) continue;

    const enVal = String(enFlat[key] ?? '').trim();
    if (!enVal) continue;

    // Conservative: only clear Arabic when it exactly matches English (typical placeholder/fallback).
    if (arVal === enVal) {
      setDeep(arJson, key, '');
      cleared += 1;
      if (clearedKeys.length < 50) clearedKeys.push(key);
    }
  }

  writeJson(AR_PATH, arJson);

  console.log(`Cleaned Arabic placeholders: cleared ${cleared} values in ar.json`);
  if (clearedKeys.length > 0) {
    console.log('Sample cleared keys:', clearedKeys.slice(0, 25));
  }
}

main();

