# Implementation Plan: Full Pipeline UI with Supabase (All Steps)

## Overview

Extend the pipeline UI pattern to all algorithm pages: grid/list views, selectable items, and "next step" buttons. All data loads from and saves to Supabase. Remove the polygon-set (type) filter from sidebars and delete the local `src/lib/data` folder.

**Key principles:**
- Each page loads the **whole** dataset; sidebar filters achieve the same filtering as before.
- From Vertex Configurations onward: filtering is by polygon composition. Example: "Regular polygons up to 12 sides" → only items consisting **only** of regular polygons with n ≤ 12.
- Compatibility graph is computed **automatically** with VC generation (for all VCs found); no separate step.

---

## Pipeline Flow & Data Files

| Step | Page | Input | Output File | Next Step |
|------|------|-------|-------------|-----------|
| 1 | Polygons | User config (types, n_max, angle) | `{paramsFolder}/polygons.json` | Generate VCs from selected polygons |
| 2 | Vertex Configurations | Selected polygons | `{paramsFolder}/vcs.json` + `{paramsFolder}/compatibilityGraph.json` | Generate Seed Configurations |
| 3 | Compatibility Graph | (display only) | — | — |
| 4 | Seed Configurations | Full compat graph + VCs | `{paramsFolder}/seedConfigurations/k=X/m=Y/` | Expand selected seed configs |
| 5 | Expanded Seeds | Selected seed configs | `{paramsFolder}/expandedSeeds/k=X/m=Y/` | Extract translational cells from selected |
| 6 | Tilings | Selected expanded seeds | `{paramsFolder}/translationalCells/k=X/m=Y/` | (Final output; no next step) |

**Compatibility graph:** Generated automatically when running "Generate Vertex Configurations". Uses **all** VCs produced in that step. Saved to `compatibilityGraph.json` in the same API call. The Compatibility Graph page is display-only (no "next step" button).

---

## Filtering Model (Sidebar Filters)

Each page loads the **full** data. Sidebar filters restrict what is shown:

| Page | Filter logic |
|------|--------------|
| Polygons | Category, vertex type, unique only, angle modulo — as today |
| Vertex Configurations | Only VCs where **every** polygon matches: selected categories + (n_max, angle) constraints. E.g. "Regular n≤12" → VCs with only regular polygons, each with n ≤ 12 |
| Compatibility Graph | Same as VCs: show only nodes (VCs) that pass the polygon filter; edges only between filtered nodes |
| Seed Configurations | Only seeds whose VCs all pass the polygon filter |
| Expanded Seeds | Only expanded seeds whose source seed passes the filter |
| Tilings | Only tilings whose source expanded seed passes the filter |

**Filter parameters:** Category (Regular, Star Regular, etc.), max sides (n_max), angle increment — applied consistently from VC onward. A VC "passes" if every polygon in it matches the filter.

**Sidebar structure:** Remove the polygon-set selector (reg_4, reg_12, etc.). Keep category, angle, n_max, and other filters. Use paramsFolder from URL or a dropdown of Supabase folders.

---

## Checklist (One Change at a Time)

### Phase 0: Preparation & Cleanup

- [x] **0.1** Create API route `GET /api/pipeline/list-folders` (already exists) — verify it returns Supabase folders
- [x] **0.2** Add pipelineStorage helpers for all file types: `getCompatibilityGraphUrl`, `getSeedConfigurationsUrl`, `getExpandedSeedsUrl`, `getTranslationalCellsUrl`
- [x] **0.3** Remove **polygon-set selector** (reg_4, reg_12, etc. buttons) from all sidebars. Keep **category, angle, n_max** filters for filtering by polygon composition.
- [x] **0.4** Delete `src/lib/data` folder (after all pages load from Supabase)

### Phase 1: Data Source Migration (Load from Supabase Only)

- [x] **1.1** Polygon page: Remove local glob; load only from Supabase. Use single `paramsFolder` from URL or default.
- [x] **1.2** VC page: Same — load only from Supabase.
- [x] **1.3** Compatibility Graph page: Load VCs + compatibilityGraph from Supabase. Remove type filter.
- [x] **1.4** Seed Configurations page: Load from Supabase. Discover k/m from Supabase folder structure. Remove type filter.
- [x] **1.5** Expanded Seeds page: Load from Supabase. Remove type filter.
- [x] **1.6** Tilings page: Load translational cells from Supabase. Remove type filter.

### Phase 2: API Routes for Remaining Steps

- [x] **2.1** Update `POST /api/pipeline/generate-vcs` — also compute and save `compatibilityGraph.json` for all generated VCs (no separate compat graph API)
- [x] **2.2** `POST /api/pipeline/generate-seed-configurations` — input: `{ paramsFolder }` (uses compat graph + VCs); output: seed configs; save to `seedConfigurations/k=X/m=Y/`
- [x] **2.3** `POST /api/pipeline/expand-seeds` — input: `{ paramsFolder, k, m, seedConfigIds[] }`; output: expanded seeds; save to `expandedSeeds/k=X/m=Y/`
- [x] **2.4** `POST /api/pipeline/extract-translational-cells` — input: `{ paramsFolder, k, m, expandedSeedIds[] }`; output: translational cells; save to `translationalCells/k=X/m=Y/`

### Phase 3: Filtering Model (Sidebar Filters)

- [x] **3.1** Define shared filter schema: `{ categories, n_max, angle }` — applied from VC onward
- [x] **3.2** VC page: Filter VCs by polygon composition (every polygon in VC must match filter)
- [x] **3.3** Compatibility Graph page: Filter nodes by same logic; show only VCs that pass; edges only between filtered nodes
- [x] **3.4** Seed Configurations page: Filter seeds by VC composition (all VCs in seed must pass)
- [x] **3.5** Expanded Seeds page: Filter by source seed's VC composition
- [x] **3.6** Tilings page: Filter by source expanded seed's VC composition

### Phase 4: UI Updates — Compatibility Graph Page

- [x] **4.1** Add grid/list view toggle (graph view vs list of nodes)
- [x] **4.2** Add selectable nodes in list view; in graph view, clicking selects node
- [x] **4.3** Add "Select all" / "Deselect all", selection count
- [x] **4.4** Generate Seed Configurations button moved to VC page (compat graph computed when that button is clicked)
- [x] **4.5** Reuse VCListItem for list view

### Phase 5: UI Updates — Seed Configurations Page

- [x] **5.1** Add grid/list view toggle
- [x] **5.2** Add selectable items (checkboxes)
- [x] **5.3** Add "Select all" / "Deselect all", selection count
- [x] **5.4** Add "Expand Seeds" button (top-right); calls API with current k,m
- [ ] **5.5** Create `SeedConfigListItem.svelte` (optional; grid cards work)

### Phase 6: UI Updates — Expanded Seeds Page

- [x] **6.1** Add grid/list view toggle
- [x] **6.2** Add selectable items
- [x] **6.3** Add "Select all" / "Deselect all", selection count
- [x] **6.4** Add "Extract Translational Cells" button (top-right)
- [ ] **6.5** Create `ExpandedSeedListItem.svelte` (optional)

### Phase 7: UI Updates — Tilings Page

- [x] **7.1** Add grid/list view toggle
- [x] **7.2** Add selectable items (optional; no next step)
- [x] **7.3** Create `TilingListItem.svelte` (for list view)
- [x] **7.4** No "next step" button (final output)

### Phase 8: Simplify Polygon & VC Pages

- [x] **8.1** Polygon page: Polygon-set selector already removed; keep category, angle, unique-only, etc.
- [x] **8.2** VC page: Polygon-set selector already removed; keep category, angle, n_max filters
- [x] **8.3** Use paramsFolder from URL; optional dropdown of Supabase folders to switch dataset

### Phase 9: Delete Local Data

- [x] **9.1** Remove all `import.meta.glob` for `$lib/data/**` from page servers
- [x] **9.2** Update run-pipeline.ts to write to Supabase (or keep as CLI-only with different output path)
- [x] **9.3** Delete `src/lib/data` folder

---

## Storage Structure (Supabase `pipeline-data` bucket)

```
{paramsFolder}/
  polygons.json
  vcs.json
  compatibilityGraph.json
  seedSets/
    k=1/m=1.json
    k=2/m=2.json
    ...
  seedConfigurations/
    vcLibrary.json
    k=1/m=1/
      manifest.json
      seedConfigurations_0000.json.gz
      ...
    k=2/m=2/
      ...
  expandedSeeds/
    k=1/m=1/
      manifest.json
      expandedSeeds_0000.json.gz
      ...
  translationalCells/
    k=1/m=1/
      manifest.json
      translationalCells_0000.json.gz
      ...
```

---

## Open Questions / Decisions

1. **paramsFolder source:** Without local data, how does the user pick paramsFolder? Options: (a) URL param only, type manually; (b) List folders from Supabase, show dropdown; (c) After generating polygons, we have one — use that until they generate another.
2. **Seed configs / expanded seeds k,m:** These have k and m dimensions. The UI currently has k/m selectors. We keep those; they filter which batch to show. Generation may need k,m as inputs.
3. **Compatibility graph:** Generated automatically with VCs. No separate API or step.

---

## Implementation Order

1. **Phase 0** — Helpers, remove polygon-set filter, prep for migration
2. **Phase 1** — Migrate all pages to load from Supabase (keep local as fallback initially)
3. **Phase 2** — Update generate-vcs to also save compat graph; add API routes for seed configs, expansion, translational cells
4. **Phase 3** — Implement filtering model (sidebar filters by polygon composition)
5. **Phases 4–7** — UI updates per page (views, selection, buttons)
6. **Phase 8** — Clean up polygon/VC pages
7. **Phase 9** — Delete local data, final cleanup
