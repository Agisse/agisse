// `npm run build:local`: local/server.ts and the Worker code it imports as one file for `npx agisse`.
// Packages stay external and install as the package's dependencies.
export default {
  input: 'local/server.ts',
  platform: 'node',
  external: /^[^./]/,
  output: { file: 'dist/agisse.mjs', format: 'esm', banner: '#!/usr/bin/env node' },
}
