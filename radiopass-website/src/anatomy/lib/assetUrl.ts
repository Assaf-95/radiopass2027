/* Resolves an asset path that is written root-absolute in the anatomy data.

   Question images, the chest radiographs and the CT/MRI slice patterns are all
   stored as "/images/...", "/cxr/...", "/ct/..." and "/mri/...". Those strings
   live inside 510 question records and several data modules, and they are
   PROTECTED CONTENT — the merge must not rewrite a single one of them.

   So the paths stay exactly as they are and this function moves instead. When
   anatomy was its own build the files sat at the site root; in the merged
   application they live under public/anatomy/, and this is the one place that
   knows it. That is the whole reason assetUrl existed before the merge — it
   already absorbed the difference between a domain root, a subdomain and a
   subfolder deployment, so absorbing one more prefix costs nothing and touches
   no data.

   Vite's `base` handles the JS and CSS bundle but cannot rewrite strings
   inside JSON, which is why this exists at all.

   Anything not root-absolute — a blob: URL, an idb:// custom-case reference, a
   data: URI, an http(s) URL — is returned untouched. */

/** Where the anatomy media lives inside the merged application's public dir. */
const ANATOMY_MEDIA_BASE = '/anatomy';

export function assetUrl(path: string): string {
  if (!path || !path.startsWith('/')) return path;
  /* Already resolved once — belt and braces for anywhere a resolved URL is
     fed back through, which would otherwise yield /anatomy/anatomy/images. */
  if (path.startsWith(`${ANATOMY_MEDIA_BASE}/`)) return path;
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  return `${base}${ANATOMY_MEDIA_BASE}${path}`;
}
