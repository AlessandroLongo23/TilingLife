# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Start dev server
npm run build        # Build for production
npm run preview      # Preview production build

# Code quality
npm run lint         # ESLint check
npm run format       # Prettier format
npm run check        # svelte-check (TypeScript)

# Testing
npm run test         # Run Vitest tests
npm run test -- --reporter=verbose  # Single test with verbose output

# Pipeline (runs the tiling generation pipeline to local filesystem)
npm run pipeline     # Execute run-pipeline.ts via vite-node
```

## Architecture Overview

This is a SvelteKit app for exploring and visualizing **uniform tilings** of the plane. The core is a mathematical pipeline that generates tilings from polygon parameters.

### Path Aliases

```
$lib        → src/lib
$components → src/lib/components
$classes    → src/lib/classes
$stores     → src/lib/stores
$services   → src/lib/services
$utils      → src/lib/utils
```

### Pipeline Architecture

The tiling generation pipeline has three execution modes that share the same core logic:

1. **CLI** (`npm run pipeline`) → `src/lib/algorithm/run-pipeline.ts` — writes to local `pipeline-output/`
2. **API routes** (`src/routes/api/pipeline/`) — server-side endpoints that upload to Supabase Storage
3. **Browser UI** (`/algorithm/` pages) — fetches pre-generated data from Supabase via `src/lib/services/`

The pure logic lives in `src/lib/algorithm/pipeline-core.ts` (no filesystem/fetch dependencies), which is consumed by both CLI and API routes.

**Pipeline sequence:**
```
GeneratorParameters
  → PolygonsGenerator   → polygons.json
  → VCGenerator         → vcs.json
  → CompatibilityGraph  → compatibilityGraph.json
  → SeedSetExtractor    → seedSets/k={k}/m={m}.json
  → SeedBuilder         → seedConfigurations/k={k}/m={m}/seedConfigurations_*.json.gz
  → SeedExpander        → expandedSeeds/k={k}/m={m}/expandedSeeds_*.json.gz
  → TranslationalCellExtractor → translationalCells/k={k}/m={m}/translationalCells_*.json.gz
```

Large datasets are batched (default 1000 items/file) and gzip-compressed. Each batch group has a `manifest.json` describing format, total count, and whether a `vcLibrary.json` index is used.

### Classes (`src/lib/classes/`)

**Algorithm classes** (`algorithm/`) are the mathematical core:
- `PolygonSignature` — polygon metadata (type, n, angles, sides)
- `VertexConfiguration` — arrangement of polygons around a vertex (e.g., `"3.3.4.3.4"`)
- `CompatibilityGraph` — which VCs can be adjacent
- `SeedBuilder` — constructs seeds (minimal valid VC arrangements) via BFS
- `SeedExpander` — expands seeds via Wave Function Collapse with orbit constraints
- `TranslationalCellExtractor` — finds the fundamental translation domain

**Polygon classes** (`polygons/`) represent different polygon types:
- `RegularPolygon`, `StarRegularPolygon`, `StarParametricPolygon`, `EquilateralPolygon`, `GenericPolygon`

**Core classes**: `Vector`, `Transform`, `Tiling`, `TilingChecker`

### Data Flow: Client Side

Client pages load data in `+page.server.ts` via Supabase public URLs (constructed in `src/lib/services/pipelineStorage.ts`). Gzip decompression is handled in `src/lib/services/pipelineFetch.ts`. Data flows into Svelte stores (`src/lib/stores/`) and is rendered by components.

### Supabase Storage

Bucket: `pipeline-data` (public read). Uploads require `SUPABASE_SERVICE_ROLE_KEY`. The folder structure within the bucket mirrors the local `pipeline-output/` layout, keyed by a `paramsFolder` string (e.g., `reg_3-12`).

Environment variables needed:
- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only, for pipeline API uploads)

### Svelte 5 Conventions

This project uses **Svelte 5 runes** throughout:
- Use `$state`, `$derived`, `$derived.by`, `$effect`, `$props`, `$bindable`
- Event attributes without colon: `onclick`, `onchange`, `oninput` (not `on:click`)
- State machine files use `.svelte.ts` extension
- Component files use kebab-case names; PascalCase in imports/usage
- Styling: Tailwind CSS utility classes; shadcn-inspired design (clean, minimalist) without using the library directly
- JavaScript (not TypeScript) in `.svelte` files per `.cursorrules`; TypeScript in `.ts` files

### Route Structure

```
src/routes/
  (app)/
    algorithm/          # Algorithm exploration pages (polygons, VCs, seeds, tilings)
    play/               # Game of Life on tiling patterns
  api/
    pipeline/           # Server endpoints for pipeline steps (upload to Supabase)
```

Each `/algorithm/` page has a `+page.server.ts` that fetches from Supabase and a `+page.svelte` for rendering. The `+layout.server.ts` provides the list of available dataset folders.
