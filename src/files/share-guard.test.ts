import { describe, expect, it } from 'vitest';
import { isShareFromOs } from './share-guard';

const OWN = 'https://mrfreekie.github.io';

const req = (headers: Record<string, string> = {}, referrer = '') => ({
  referrer,
  headers: { get: (n: string) => headers[Object.keys(headers).find((k) => k.toLowerCase() === n.toLowerCase()) ?? ''] ?? null },
});

describe('isShareFromOs', () => {
  it('accepts a request with no origin information (the OS share sheet)', () => {
    expect(isShareFromOs(req(), OWN)).toBe(true);
    expect(isShareFromOs(req({ 'Sec-Fetch-Site': 'none' }), OWN)).toBe(true);
  });
  it('accepts our own origin (the automated test posts from the page)', () => {
    expect(isShareFromOs(req({ Origin: OWN, 'Sec-Fetch-Site': 'same-origin' }, `${OWN}/rigpoint-load-sheet/`), OWN)).toBe(true);
    expect(isShareFromOs(req({}, 'about:client'), OWN)).toBe(true);
  });
  it('refuses a form posted from another site (what Chromium shows the service worker)', () => {
    expect(isShareFromOs(req({ Origin: 'http://evil.example' }, 'http://evil.example/'), OWN)).toBe(false);
    expect(isShareFromOs(req({ Origin: 'http://evil.example' }), OWN)).toBe(false);
    expect(isShareFromOs(req({}, 'http://evil.example/page'), OWN)).toBe(false);
  });
  it('refuses cross-site and same-site if the browser exposes Sec-Fetch-Site', () => {
    expect(isShareFromOs(req({ 'Sec-Fetch-Site': 'cross-site' }), OWN)).toBe(false);
    expect(isShareFromOs(req({ 'Sec-Fetch-Site': 'same-site' }), OWN)).toBe(false);
    expect(isShareFromOs(req({ 'Sec-Fetch-Site': 'something-new' }), OWN)).toBe(false);
  });
  it('accepts anything that names no website: the app asks before opening it (see share-guard.ts)', () => {
    expect(isShareFromOs(req({ Origin: 'null' }), OWN)).toBe(true);
    expect(isShareFromOs(req({}, 'android-app://com.google.android.gm/'), OWN)).toBe(true);
    expect(isShareFromOs(req({}, 'not a url'), OWN)).toBe(true);
  });
});
