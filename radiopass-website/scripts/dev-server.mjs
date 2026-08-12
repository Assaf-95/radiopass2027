#!/usr/bin/env node
/**
 * Dev server entry point that survives a broken inherited working directory.
 *
 * The preview launcher spawns its server with a working directory inside this
 * checkout, whose path contains colons. When that cwd is not usable, Node dies
 * before running a single line of user code:
 *
 *   Error: EPERM: process.cwd failed with error operation not permitted, uv_cwd
 *       at resolveMainPath (node:internal/modules/run_main:35:36)
 *
 * The cause is visible in that frame. `resolveMainPath` calls `path.resolve` on
 * the main module path, and `path.resolve` only consults `process.cwd()` when
 * the path it was given is *relative*. A launch entry such as
 * `radiopass-website/node_modules/.bin/vite` is relative, so Node must ask for
 * the cwd, and the process dies at startup.
 *
 * Invoked by its absolute path, the same Node build starts happily even with an
 * unusable cwd — so this file is safe to reach. The first thing it does is
 * chdir to its own project root, which repairs the cwd for everything that
 * follows, and only then is Vite loaded.
 *
 * Both paths it depends on are derived from `import.meta.url`, which is always
 * absolute, so nothing here needs a working cwd to bootstrap.
 */

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// Repair the working directory before anything else observes it. Vite, esbuild
// and the config loader all call process.cwd() during start-up.
process.chdir(projectRoot)

const { createServer } = await import('vite')

// The launcher assigns a port and passes it in the environment. Falling back to
// a fixed port keeps `node scripts/dev-server.mjs` useful by hand.
const port = Number(process.env.PORT) || 5182

const server = await createServer({
  root: projectRoot,
  configFile: resolve(projectRoot, 'vite.config.ts'),
  server: {
    port,
    strictPort: true,
    // Bind the IPv4 loopback explicitly.
    //
    // Left to itself this server bound [::1] only. macOS resolves `localhost`
    // to both ::1 and 127.0.0.1, so a browser that reached for the IPv4 address
    // got a refused connection and rendered a blank page with an empty body —
    // which looks exactly like a crashed application but is not one.
    // 127.0.0.1 is reachable either way and, unlike `host: true`, does not
    // publish the dev server to the local network.
    host: '127.0.0.1',
  },
})

await server.listen()
server.printUrls()
