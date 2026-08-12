/**
 * Assembles the deployable folder.
 *
 *   npm run package
 *
 * produces  deploy/  containing the whole of RadioPass as one static tree:
 *
 *   deploy/
 *     index.html, assets/, .htaccess, 404.html, favicon.svg   ← physics site
 *     anatomy/                                                ← anatomy site
 *
 * Copy the CONTENTS of deploy/ into a host's public_html and the product is
 * live: the .htaccess gives deep links their fallback on Apache/LiteSpeed
 * (Hostinger, GoDaddy and the other shared hosts), and the anatomy app routes
 * by URL hash so it needs nothing from the server at all.
 *
 * Both builds are gated on their own typecheck: a package that would not
 * compile must not exist.
 *
 * Everything is spawned by absolute binary path, never through a shell PATH
 * lookup — this repo's own path contains a literal colon, which breaks PATH
 * resolution in ways that look like missing tools.
 */

import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PHYSICS = resolve(fileURLToPath(new URL('..', import.meta.url)))
const ANATOMY = resolve(PHYSICS, '..', 'ANATOMY CLAUDE', 'frcr-anatomy')
const DEPLOY = join(PHYSICS, 'deploy')

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

// ---- build both sites, typecheck first --------------------------------------

run(PHYSICS, 'tsc', ['--noEmit', '-p', 'tsconfig.app.json'], 'physics typecheck')
run(PHYSICS, 'vite', ['build'], 'physics build')
run(ANATOMY, 'tsc', ['--noEmit', '-p', 'tsconfig.app.json'], 'anatomy typecheck')
run(ANATOMY, 'vite', ['build'], 'anatomy build')

// ---- assemble ---------------------------------------------------------------

rmSync(DEPLOY, { recursive: true, force: true })
mkdirSync(DEPLOY)
cpSync(join(PHYSICS, 'dist'), DEPLOY, { recursive: true })
cpSync(join(ANATOMY, 'dist'), join(DEPLOY, 'anatomy'), { recursive: true })

// The anatomy build uses a relative base, but references to public/ files
// written as root-absolute in its index.html (favicon, the hero preload that
// build-hero-frames.mjs regenerates) would escape /anatomy/ on a shared
// domain. Relativise them — belt and braces even if the build already did.
const anatomyIndex = join(DEPLOY, 'anatomy', 'index.html')
const html = readFileSync(anatomyIndex, 'utf8')
const fixed = html.replace(/(href|src)="\/(?!\/)/g, '$1="./')
if (fixed !== html) {
  writeFileSync(anatomyIndex, fixed)
  console.log('• anatomy index.html: relativised root-absolute asset URLs')
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
