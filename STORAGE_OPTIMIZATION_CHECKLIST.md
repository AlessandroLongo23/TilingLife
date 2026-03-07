# Storage Optimization Checklist

Summary of completed and remaining optimizations for vertex configurations, seeds, and tilings.

## Completed

### 1. Number rounding (4 decimals)
- **What:** Round all numbers to 4 decimal places when writing JSON.
- **Where:** `roundNumbersInJson` in `utils.ts`, applied in `run-pipeline.ts` for seed configs and tilings.
- **Impact:** Significant file size reduction.

### 2. Compact seed format (VC name + pos + rot)
- **What:** Store seeds as `{ vcs: [{ name, pos, rot }] }` instead of full polygon data.
- **Where:** `encodeCompact` / `decodeCompact` in `SeedConfiguration.svelte.ts`.
- **Impact:** Smaller files; polygons reconstructed from VC name via `VertexConfiguration.fromName()`.

### 3. Shared VC library (vcId instead of name)
- **What:** Store each unique VC once in `vcLibrary.json`; reference by index (`vcId`) instead of full name.
- **Where:** 
  - Pipeline: `seedConfigurations/{paramsFolder}/vcLibrary.json` (from `vcs.json`)
  - Compact format: `{ vcs: [{ vcId, pos, rot }] }` when `vcLibrary` present
  - Manifest: `{ format: 'compact', vcLibrary: true, ... }`
- **Impact:** Saves space for long VC names (star/generic polygons).
- **Backward compat:** `decodeCompact` still supports `name` when `vcLibrary` is absent.

### 4. Polygon deduplication
- **What:** Deduplicate shared polygons when loading and encoding.
- **Where:** `deduplicateEncodedPolygons` in `geometry.ts`; applied in `encode()` and page.server.
- **Impact:** Avoids duplicate polygons drawn (opacity issue).

### 5. Performance optimizations
- **Groupings:** `loadGroupingsOnly` / `loadGroupingsAndFilteredCount` use raw batches (no decode/encode).
- **Deduplication:** `deduplicateEncodedPolygons` uses centroid bucketing and 1e-3 tolerance.

---

## Remaining (from original brainstorm)

### 6. Shorter keys
- Use abbreviations: `vcsCenters` → `vc`, `vertices` → `v`, `polygons` → `p`, etc.

### 7. Arrays instead of objects for points
- `[0.5, 0.866]` instead of `{x: 0.5, y: 0.866}`.

### 8. Integer coordinates
- Scale coordinates to integers (e.g. × 10000).

### 9. Compression
- Store `.json.gz`; use streaming decompression.

### 10. Binary format
- MessagePack, CBOR, or custom binary.

### 11. Shared seed references (for tilings)
- Store seeds once; reference by ID when multiple tilings share a seed.

### 12. Streaming / lazy loading
- Avoid loading all JSON at once during build.

### 13. External storage
- CDN or external storage for large datasets.

### 14. On-demand generation
- Generate seeds/tilings on the server when requested.
