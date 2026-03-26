import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'es2020',
  outDir: 'dist',
  clean: true,
  shims: true,
  splitting: false,
  sourcemap: false,
  dts: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
  external: [
    'commander',
    'chalk',
    'inquirer',
    'fs-extra',
    'ora',
    'open',
  ],
});
