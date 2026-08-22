/* ===========================================================================
   Talking to the content API.

   The base path is derived from BASE_URL for the same reason every image path
   goes through assetUrl(): one build has to work at a domain root, on a
   subdomain and inside a subfolder.

   It used to be the relative string "api", which was correct while anatomy was
   a separate build routing by URL hash — the document's own directory was
   always the site root, so the browser resolved it there whatever the route.
   Since the merge, anatomy is ordinary BrowserRouter paths, and a relative
   base resolves against the CURRENT route instead: on
   /anatomy/section/thorax/q/thorax-p0072 the call went to
   /anatomy/section/thorax/q/api/content and 404'd. The overlay — every online
   edit reaching the Question Bank and the Structure Atlas — therefore never
   loaded on any route deeper than one segment. Root-absolute is the fix, and
   BASE_URL keeps the subfolder deployment that assetUrl already honours: the
   API is mounted at <base>/api by every adapter in server/.

   VITE_CONTENT_API overrides it, for the case where the site is served as
   static files from one place and the API runs somewhere else.
   =========================================================================== */

import type { AuditEntry, ContentOverlay } from './types';

/** Trailing slash off, so `${BASE}${path}` never doubles it. */
const deployBase = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
const BASE = (
  (import.meta.env.VITE_CONTENT_API as string | undefined) ?? `${deployBase}/api`
).replace(/\/+$/, '');

const TOKEN_KEY = 'radiopass-editor-session-v1';

export function sessionToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setSessionToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* Private browsing. The session then lasts as long as the page does. */
  }
}

function url(path: string): string {
  return `${BASE}${path}`;
}

async function readError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body?.error ?? `Request failed (${res.status}).`;
  } catch {
    return `Request failed (${res.status}).`;
  }
}

/** The overlay plus whether this deployment can be edited at all. Never
 *  throws: a static host with no API is a normal, supported deployment, and
 *  the caller distinguishes it by `online: false`. */
export async function fetchContent(signal?: AbortSignal): Promise<{
  overlay: ContentOverlay | null;
  editingConfigured: boolean;
  online: boolean;
  error: string | null;
}> {
  try {
    const res = await fetch(url('/content'), { signal, headers: { accept: 'application/json' } });
    if (!res.ok) {
      return { overlay: null, editingConfigured: false, online: false, error: await readError(res) };
    }
    const body = await res.json();
    return {
      overlay: body.overlay ?? null,
      editingConfigured: Boolean(body.editingConfigured),
      online: true,
      error: null,
    };
  } catch (error) {
    return {
      overlay: null,
      editingConfigured: false,
      online: false,
      error: error instanceof Error ? error.message : 'The content service did not answer.',
    };
  }
}

export async function signIn(password: string): Promise<{ token: string; expiresAt: string }> {
  const res = await fetch(url('/session'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

/** Uploads the bytes and returns the id of the new asset record. A fresh id
 *  every time is what makes the immutable cache headers on the served asset
 *  safe, and it is why a replacement is never masked by a cached URL. */
export async function uploadAsset(file: File): Promise<{ assetId: string; bytes: number }> {
  const res = await fetch(url('/asset'), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${sessionToken()}`,
      'content-type': file.type || 'application/octet-stream',
      'x-filename': encodeURIComponent(file.name).slice(0, 200),
    },
    body: file,
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export interface QuestionPatch {
  /** The annotation editor's own document: markers, arrow geometry, crop,
   *  orientation, answers. Sent whole, because the editor always knows the
   *  complete state and a partial merge could resurrect a deleted label. */
  edit?: import('../questionEdits').QuestionEdit;
  image?: import('./types').OverlayImage | null;
  labels?: Record<string, import('./types').OverlayLabel | null>;
  answers?: Record<string, { officialAnswer?: string } | null>;
  atlas?: Partial<import('./types').OverlayAtlas>;
  relationships?: import('./types').OverlayRelationship[];
  /** The rev the editor was looking at. The server refuses the write if the
   *  content has moved on, so a stale tab cannot quietly undo a newer edit. */
  ifRev?: number;
  action?: string;
}

export async function patchQuestion(
  questionId: string,
  patch: QuestionPatch
): Promise<ContentOverlay> {
  const res = await fetch(url(`/question/${encodeURIComponent(questionId)}`), {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${sessionToken()}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(await readError(res));
  const body = await res.json();
  return body.overlay;
}

export async function fetchAudit(): Promise<AuditEntry[]> {
  const res = await fetch(url('/audit'), {
    headers: { authorization: `Bearer ${sessionToken()}` },
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()).audit ?? [];
}

/** Where an uploaded asset is served from. The version rides along so that a
 *  browser or CDN holding the old bytes under an old URL cannot win. */
export function assetSrc(assetId: string, version?: number): string {
  return `${BASE}/asset/${encodeURIComponent(assetId)}${version ? `?v=${version}` : ''}`;
}
