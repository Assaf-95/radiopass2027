/* Resolves an asset path that is written root-absolute in the data.

   Question images, the chest radiographs and the CT/MRI slice patterns are
   all stored as "/images/...", "/cxr/..." and so on. Written that way they
   only resolve when the site sits at a domain root: uploaded into a
   subfolder (example.com/anatomy/) the browser asks for
   example.com/images/... and every film comes back 404, so the pages render
   with blank viewers and no error.

   Vite's `base` already handles the JS and CSS bundle, but it cannot rewrite
   strings inside JSON data. This applies the same base to those paths, so
   one build works at a domain root, on a subdomain, and in a subfolder.

   Anything that is not root-absolute — a blob: URL, an idb:// custom-case
   reference, a data: URI, an http(s) URL — is returned untouched. */
export function assetUrl(path: string): string {
  if (!path || !path.startsWith('/')) return path;
  const base = import.meta.env.BASE_URL || '/';
  return base.replace(/\/$/, '') + path;
}
