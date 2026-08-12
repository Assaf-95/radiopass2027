#!/usr/bin/env node
/**
 * Dev server entry point that survives a broken inherited working directory.
 *
 * This checkout sits under a Desktop path containing colons. When the preview
 * launcher spawns a server with that cwd, Node can die before running a line of
 * user code:
 *
 *   Error: EPERM: process.cwd failed with error operation not permitted, uv_cwd
 *       at resolveMainPath (node:internal/modules/run_main:35:36)
 *
 * `path.resolve` only asks for the cwd when the path it is given is relative,
 * so a launch entry pointing at this file by its ABSOLUTE path is always
 * reachable. The first thing it does is chdir to the project root, repairing
 * the cwd for Vite, esbuild and the config loader, all of which call
 * process.cwd() during start-up.
 *
 * Mirrors radiopass-website/scripts/dev-server.mjs, which exists for the same
 * reason.
 */

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

process.chdir(projectRoot)

const { createServer } = await import('vite')

const port = Number(process.env.PORT) || 5183

const server = await createServer({
  root: projectRoot,
  configFile: resolve(projectRoot, 'vite.config.ts'),
  server: {
    port,
    strictPort: true,
    // Bind IPv4 loopback explicitly: left alone this binds [::1] only, and a
    // browser reaching for 127.0.0.1 gets a refused connection and an empty
    // body — indistinguishable from a crashed app.
    host: '127.0.0.1',
  },
})

await server.listen()
server.printUrls()
