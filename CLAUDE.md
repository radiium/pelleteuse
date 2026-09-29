# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev        # Start dev server with HMR
pnpm build      # Type-check then bundle for production (tsc && vite build)
pnpm preview    # Serve the production build locally
```

## Stack

- **Vite** — build tool and dev server
- **TypeScript** — strict mode enabled (`noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`)
- **Three.js** — sole runtime dependency; this project is a 3D graphics application
- **pnpm** — package manager

## Architecture

Early-stage project. `src/main.ts` is the entry point loaded by `index.html`; the renderer canvas is appended to `<body>`. Three.js scene setup, rendering loops, and any game/simulation logic will live under `src/`.

Module resolution is set to `bundler` (Vite handles all imports). Output targets ES2023 with no `tsc` emit — Vite handles transpilation and bundling.
