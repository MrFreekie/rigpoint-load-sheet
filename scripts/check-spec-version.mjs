// Fails if data/spec-library.json changed without spec_version moving forward.
//
// Compares against a base commit, chosen in this order:
//   1. the first argument, or SPEC_BASE_REF
//   2. origin/$GITHUB_BASE_REF on a pull request
//   3. $GITHUB_EVENT_BEFORE on a push
//   4. HEAD~1
// If no base can be found (e.g. the first commit) the check is skipped with a note.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const FILE = 'data/spec-library.json';
const ZERO_SHA = /^0+$/;

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function resolves(ref) {
  try {
    git('rev-parse', '--verify', '--quiet', `${ref}^{commit}`);
    return true;
  } catch {
    return false;
  }
}

function pickBase() {
  const candidates = [
    process.argv[2],
    process.env.SPEC_BASE_REF,
    process.env.GITHUB_BASE_REF && `origin/${process.env.GITHUB_BASE_REF}`,
    process.env.GITHUB_EVENT_BEFORE && !ZERO_SHA.test(process.env.GITHUB_EVENT_BEFORE) && process.env.GITHUB_EVENT_BEFORE,
    'HEAD~1',
  ].filter(Boolean);
  return candidates.find(resolves) ?? null;
}

const base = pickBase();
if (!base) {
  console.log(`spec_version check skipped: no base commit to compare ${FILE} against.`);
  process.exit(0);
}

let before;
try {
  before = git('show', `${base}:${FILE}`);
} catch {
  console.log(`spec_version check: ${FILE} is new since ${base}.`);
  process.exit(0);
}

const after = readFileSync(FILE, 'utf8');
if (before === after) {
  console.log(`spec_version check: ${FILE} unchanged since ${base}.`);
  process.exit(0);
}

const oldVersion = JSON.parse(before).spec_version;
const newVersion = JSON.parse(after).spec_version;
if (newVersion <= oldVersion) {
  console.error(
    `${FILE} changed since ${base} but spec_version did not move forward ` +
      `(was ${oldVersion}, now ${newVersion}). Set spec_version to the date of this change.`,
  );
  process.exit(1);
}
console.log(`spec_version check: ${oldVersion} → ${newVersion}.`);
