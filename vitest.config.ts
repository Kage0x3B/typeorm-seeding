import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    plugins: [swc.vite({ tsconfigFile: './tsconfig-test.json' })],
    test: {
        globals: true,
        setupFiles: ['./test/util/setup.ts'],
        coverage: {
            provider: 'v8',
            exclude: [
                'src/index.ts',
                'src/*/index.ts',
                'test/**'
            ]
        }
    }
});
