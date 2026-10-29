// Fails if data/spec-library.json changed without spec_version moving forward.
//
// Compares against a base commit, chosen in this order:
//   1. the first argument, or SPEC_BASE_REF
//   2. origin/$GITHUB_BASE_REF on a pull request
//   3. $GITHUB_EVENT_BEFORE on a push
//   4. HEAD~1
// If no base can be found (e.g. the first commit) the check is skipped with a note.
//
// Every commit since the base that changed the file is also checked against its parent,
// so a push or pull request of several commits cannot hide one that forgot to move the
// version. Merge commits are skipped: their changes come from commits checked elsewhere,
// and the overall comparison still covers the result.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const FILE = 'data/spec-library.json';

// Same rule as parseSpecVersion in src/schema/spec-library.ts: yyyy-mm-dd, with .2, .3 … for a
// further change on the same day. Compared by date, then numerically by change number.
const VERSION = /^(\d{4}-\d{2}-\d{2})(?:\.([2-9]|[1-9]\d+))?$/;

function parseVersion(v) {
  const m = typeof v === 'string' ? VERSION.exec(v) : null;
  return m ? { date: m[1], change: m[2] ? Number(m[2]) : 1 } : null;
}

function isNewer(next, prev) {
  const a = parseVersion(next);
  const b = parseVersion(prev);
  if (!a || !b) return false;
  return a.date === b.date ? a.change > b.change : a.date > b.date;
}
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

const failures = [];
// Commits already on main were checked when they landed (one early commit predates this
// check), so only the commits this branch adds are looked at one by one.
const notOnMain = resolves('origin/main') ? ['--not', 'origin/main'] : [];
const commits = git('rev-list', '--reverse', '--no-merges', `${base}..HEAD`, ...notOnMain, '--', FILE)
  .split('\n')
  .filter(Boolean);
for (const commit of commits) {
  let parent;
  try {
    parent = git('show', `${commit}^:${FILE}`);
  } catch {
    continue; // the file is new in this commit
  }
  const own = git('show', `${commit}:${FILE}`);
  if (parent === own) continue;
  const was = JSON.parse(parent).spec_version;
  const now = JSON.parse(own).spec_version;
  if (!isNewer(now, was)) failures.push(`${commit.slice(0, 7)} (was ${was}, now ${now})`);
}
if (failures.length > 0) {
  console.error(
    `These commits changed ${FILE} without moving spec_version forward: ${failures.join('; ')}. ` +
      `Every commit that changes the library needs a newer spec_version.`,
  );
  process.exit(1);
}

const after = readFileSync(FILE, 'utf8');
if (before === after) {
  console.log(`spec_version check: ${FILE} unchanged since ${base}.`);
  process.exit(0);
}

const oldVersion = JSON.parse(before).spec_version;
const newVersion = JSON.parse(after).spec_version;
if (!isNewer(newVersion, oldVersion)) {
  console.error(
    `${FILE} changed since ${base} but spec_version did not move forward ` +
      `(was ${oldVersion}, now ${newVersion}). Set spec_version to the date of this change, ` +
      `adding .2, .3 … if the library already changed that day.`,
  );
  process.exit(1);
}
console.log(`spec_version check: ${oldVersion} → ${newVersion}.`);
