/**
 * Assembles the deployable folder.
 *
 *   npm run package
 *
 * produces  deploy/  containing the whole of RadioPass as one static tree:
 *
 *   deploy/
 *     index.html, assets/, .htaccess, 404.html, favicon.svg
 *     anatomy/images, anatomy/ct, anatomy/cxr, anatomy/mri   ← anatomy media
 *
 * ONE BUILD. This script used to compile two applications and copy the second
 * into deploy/anatomy/, because anatomy was a separate Vite project routing by
 * URL hash. Since the merge there is one application: /anatomy is an ordinary
 * route of it, its media ships through public/anatomy/ like any other asset,
 * and the stitching step is gone.
 *
 * Copy the CONTENTS of deploy/ into a host's public_html and the product is
 * live. The .htaccess gives deep links their fallback on Apache/LiteSpeed
 * (Hostinger, GoDaddy and the other shared hosts) — and it matters MORE now
 * than it did, because /anatomy/atlas is a real path the server must hand back
 * to the SPA rather than a hash the browser resolved on its own.
 *
 * Gated on typecheck: a package that would not compile must not exist.
 *
 * Everything is spawned by absolute binary path, never through a shell PATH
 * lookup — this repo's own path contains a literal colon, which breaks PATH
 * resolution in ways that look like missing tools.
 */

import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = resolve(fileURLToPath(new URL('..', import.meta.url)))
const DEPLOY = join(APP, 'deploy')

function run(cwd, binary, args, label) {
  const bin = join(cwd, 'node_modules', '.bin', binary)
  if (!existsSync(bin)) {
    console.error(`✗ ${label}: ${bin} not found — run npm install in ${cwd}`)
    process.exit(1)
  }
  process.stdout.write(`• ${label}… `)
  const out = spawnSync(bin, args, { cwd, encoding: 'utf8' })
  if (out.status !== 0) {
    console.error(`FAILED\n${out.stdout}\n${out.stderr}`)
    process.exit(1)
  }
  console.log('ok')
}

function treeSize(dir) {
  let bytes = 0
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const s = statSync(p)
    bytes += s.isDirectory() ? treeSize(p) : s.size
  }
  return bytes
}

// ---- build, typecheck first -------------------------------------------------

run(APP, 'tsc', ['--noEmit', '-p', 'tsconfig.app.json'], 'typecheck')
run(APP, 'vite', ['build'], 'build')

// ---- assemble ---------------------------------------------------------------

rmSync(DEPLOY, { recursive: true, force: true })
mkdirSync(DEPLOY)
cpSync(join(APP, 'dist'), DEPLOY, { recursive: true })

// The anatomy media has to be there, or every film 404s on the live site.
// Cheap to assert, and the failure it catches is total.
if (!existsSync(join(DEPLOY, 'anatomy', 'images'))) {
  console.error('✗ deploy/anatomy/images missing — public/anatomy did not reach dist')
  process.exit(1)
}

// Hosts that use a 404 document instead of rewrites (and some static hosts)
// get the same fallback behaviour from a 404.html copy of the shell.
cpSync(join(DEPLOY, 'index.html'), join(DEPLOY, '404.html'))

// .htaccess ships via public/ → dist; fail loudly if that ever breaks,
// because without it every deep link 404s on the target host.
if (!existsSync(join(DEPLOY, '.htaccess'))) {
  console.error('✗ deploy/.htaccess missing — public/.htaccess did not reach dist')
  process.exit(1)
}

const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`
console.log(`\ndeploy/ ready — ${mb(treeSize(DEPLOY))} total (anatomy ${mb(treeSize(join(DEPLOY, 'anatomy')))})`)
console.log('Copy the CONTENTS of deploy/ into the host’s public_html. See DEPLOY.md.')
