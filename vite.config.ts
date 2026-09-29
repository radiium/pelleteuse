import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import pkg from './package.json' with { type: 'json' };

function gitHash(): string {
    try {
        return execSync('git rev-parse --short HEAD').toString().trim();
    } catch {
        return process.env.GITHUB_SHA?.slice(0, 7) ?? 'dev';
    }
}

export default defineConfig({
    plugins: [viteSingleFile()],
    define: {
        __APP_VERSION__: JSON.stringify(pkg.version),
        __GIT_HASH__:    JSON.stringify(gitHash()),
    },
});
