// Decides whether a POST to the share target may be accepted. Any website can POST a file
// to our share-target URL (a form on their page); without this check the app would open it
// as if the user had chosen it.
//
// What a service worker can see (measured in Chromium, not assumed): Sec-Fetch-Site is NOT
// exposed to service workers, so it cannot be used here. A cross-site form post arrives as
// a navigation with `Origin: <their site>` and `referrer: <their page>`. The OS share sheet
// is started by the browser, not by a web page, so it has no foreign origin or referrer.
// We therefore refuse any request that names a different site, and accept the rest.
//
// This is only a first filter, and it is easy to get round: a page can send `Origin: null`
// and no referrer (`<meta name="referrer" content="no-referrer">`). So only a named web
// origin (http or https) is refused; anything else, including the `android-app://` referrer
// Chrome may give the genuine share sheet, gets through. The real protection is in the app:
// it always asks before opening a shared file.
// Sec-Fetch-Site is still honoured if a browser ever exposes it.

type Req = { referrer: string; headers: { get(name: string): string | null } };

export function isShareFromOs(request: Req, ownOrigin: string): boolean {
  const site = request.headers.get('Sec-Fetch-Site');
  if (site !== null && site !== 'none' && site !== 'same-origin') return false;

  return !isOtherWebsite(request.headers.get('Origin'), ownOrigin) && !isOtherWebsite(request.referrer, ownOrigin);
}

/** True only for an http(s) URL or origin on another site. */
function isOtherWebsite(value: string | null, ownOrigin: string): boolean {
  if (!value) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false; // 'null', 'about:client' and other non-URLs name no website
  }
  return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin !== ownOrigin;
}
