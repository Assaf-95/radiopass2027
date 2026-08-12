import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

/**
 * Note on `setupFiles`.
 *
 * This checkout currently sits under a directory whose name contains colons.
 * Vitest cannot resolve a `setupFiles` entry through such a path — it drops the
 * prefix and looks for `/src/...` at the filesystem root. Component tests
 * therefore import `src/mri/test/setup.ts` directly as a side-effecting module,
 * which resolves correctly. If this project is ever moved to a path without
 * colons, `setupFiles: ['./src/mri/test/setup.ts']` can be restored and the
 * imports removed.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
  },
})
