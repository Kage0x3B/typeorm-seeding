import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  platform: 'node',
  publint: true,
  attw: {
    profile: 'esm-only',
  },
  exports: true,
})
