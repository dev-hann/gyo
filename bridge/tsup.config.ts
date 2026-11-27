import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/testing/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: false,
  target: 'es2020',
  splitting: false,
  external: [],
  outDir: 'dist',
  shims: false,
})
