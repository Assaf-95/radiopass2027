// A private study copy, not a public one.
//
// This site's imagery is de-identified radiology scans, but the underlying
// case material is sourced from copyrighted textbooks (Weir & Abrahams,
// Ryan/McNicholas/Eustace, Butler) — see DEPLOY.md. Open to the public that
// is republishing those books; behind a login it is a private study copy.
// A simple HTTP Basic Auth challenge, running at the edge before any file
// is served, is the free-tier way to keep that boundary without needing a
// paid plan or a second account.

const USERNAME = 'frcr'
const PASSWORD = 'frcr-anatomy-2026'

export default async (request: Request) => {
  const auth = request.headers.get('authorization')
  const expected = 'Basic ' + btoa(`${USERNAME}:${PASSWORD}`)

  if (auth === expected) return

  return new Response('Authentication required', {
    status: 401,
    // HTTP header values must be ASCII — an em dash here throws at runtime.
    headers: { 'WWW-Authenticate': 'Basic realm="RadioPass Anatomy - private study copy"' },
  })
}

export const config = { path: '/*' }
