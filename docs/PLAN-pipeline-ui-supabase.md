# Implementation Plan: Pipeline UI with Supabase Storage

## Overview

Enable users to run the tiling pipeline directly from the Polygon Collection page, with results saved to Supabase Storage instead of local filesystem. The flow starts on the polygon page: users generate polygons, then select which polygons to use for vertex configuration generation.

---

## 1. Architecture Summary

### Current State
- **Pipeline**: Runs via `npm run pipeline` (Node.js script), writes to `src/lib/data/{paramsFolder}/`
- **Polygon page**: Loads polygon names from static `polygons.json` via Vite glob imports
- **Supabase**: Used for tiling images (bucket `tilings`), not for pipeline data

### Target State
- **API routes**: Server-side endpoints run pipeline steps (polygon gen, VC gen)
- **Supabase Storage**: New bucket `pipeline-data` (public read) for user-generated results — no user identification
- **Storage structure**: `{paramsFolder}/polygons.json` and `{paramsFolder}/vcs.json` (flat, no user prefix)
- **Polygon page**: After polygon generation, new set is added to the polygon set dropdown; page loads from Supabase
- **VC page**: After VC generation, new VCs are added (same paramsFolder); page loads from Supabase; same compact list view as polygon page

---

## 2. Feature Breakdown

### 2.1 Generate Polygons

| Item | Description |
|------|-------------|
| **Button** | Green "Generate Polygons" button in top-right of main body (polygon page) |
| **Dialog** | Modal with options matching run-pipeline parameters |
| **Options** | • **Polygon types** (Category): Regular, Star Regular, Star Parametric, Equilateral, Generic — checkboxes to enable each |
| | • **Max sides (n_max)**: Number input per type (e.g. "Maximum polygon sides: 12") |
| | • **Angle step (degrees)**: For Star Regular & Equilateral — "Angle increment: 30°" |
| **Flow** | User configures → Clicks Run → API POST → Server runs PolygonsGenerator → Uploads `polygons.json` to Supabase → Returns paramsFolder → **New set added to polygon page dropdown** |
| **Storage** | Single file: `{paramsFolder}/polygons.json` (array of polygon names) |

**Expressive names for options:**
- `n_max` → "Maximum polygon sides" or "Max sides"
- `angle` → "Angle increment (degrees)" or "Angle step"

### 2.2 Generate Vertex Configurations

| Item | Description |
|------|-------------|
| **Button** | "Generate Vertex Configurations" button (next to or below Generate Polygons) |
| **Selection** | Each polygon in the list is selectable (checkbox) |
| **Quick actions** | "Select all" and "Deselect all" buttons |
| **Info text** | "X of Y polygons selected" above the list |
| **Flow** | User selects polygons → Clicks Run → API POST with `polygonNames[]` → Server runs VCGenerator → Uploads `vcs.json` to Supabase → **New VCs added to VC page** (same paramsFolder in dropdown) |
| **Storage** | Single file: `{paramsFolder}/vcs.json` (array of VC names) |

### 2.3 Compact List View (Polygon & VC pages)

| Item | Description |
|------|-------------|
| **View toggle** | Toggle on top: Grid view | List view (Windows Explorer style) |
| **Polygon list item** | ID, small thumbnail, name, category tag |
| **VC list item** | ID, small thumbnail, VC name (comma-separated polygons), vertex count |
| **Components** | `PolygonListItem.svelte`, `VCListItem.svelte` |
| **Layout** | Single column, rows with: `[checkbox?] [thumb] [id] [name] [tag/metadata]` |

---

## 3. Technical Tasks Checklist

### Phase A: Supabase & API Infrastructure

- [ ] **A1** Create Supabase bucket `pipeline-data` with **public read** (no user identification)
- [ ] **A2** Add `pipelineStorage.ts` service: `uploadPolygons(paramsFolder, names)`, `uploadVCs(paramsFolder, names)`, `getPolygonsUrl(paramsFolder)`
- [ ] **A3** Create shared pipeline logic module (extract from run-pipeline): `generatePolygons(parameters)`, `generateVCs(polygonNames)` — pure, no fs
- [ ] **A4** Create API route `POST /api/pipeline/generate-polygons` — accepts `GeneratorParameters`, runs generation, uploads to Supabase, returns `{ paramsFolder, polygonCount }`
- [ ] **A5** Create API route `POST /api/pipeline/generate-vcs` — accepts `{ paramsFolder, polygonNames }`, runs VC generation, uploads to Supabase, returns `{ vcCount }`

### Phase B: Polygon Page UI – Generate Polygons

- [ ] **B1** Add "Generate Polygons" green button in top-right of main content area
- [ ] **B2** Create `GeneratePolygonsDialog.svelte`: Modal with polygon type checkboxes, n_max inputs, angle input (conditional), Run/Cancel
- [ ] **B3** Wire dialog to API: call `/api/pipeline/generate-polygons`, show loading state, on success **add new paramsFolder to polygon page dropdown** and switch to it
- [ ] **B4** Use expressive labels: "Polygon types", "Max sides", "Angle increment (°)"

### Phase C: Polygon Selection & Generate VCs

- [ ] **C1** Add `selectedPolygonNames` state (Set or array) to polygon page
- [ ] **C2** Add checkbox to each polygon card/list item, bound to selection
- [ ] **C3** Add "Select all" and "Deselect all" buttons
- [ ] **C4** Add info text: "X of Y polygons selected" (or "Select polygons to generate vertex configurations")
- [ ] **C5** Add "Generate Vertex Configurations" button (enabled when ≥1 selected)
- [ ] **C6** Create `GenerateVCsDialog.svelte` or inline: confirm selection, show paramsFolder, Run
- [ ] **C7** Wire to API `POST /api/pipeline/generate-vcs`; on success **add new VCs to VC page** (paramsFolder already in dropdown; refresh/invalidate to load from Supabase)

### Phase D: Compact List View (Polygon & VC pages)

- [ ] **D1** Create `PolygonListItem.svelte`: id, small thumbnail (e.g. 48×48), name, category tag, optional checkbox slot
- [ ] **D2** Create `VCListItem.svelte`: id, small thumbnail, VC name, vertex count (or polygon count)
- [ ] **D3** Polygon page: Add view mode state `'grid' | 'list'`, view toggle, render list view with `PolygonListItem`
- [ ] **D4** VC page: Add same view mode, toggle, and list view with `VCListItem`
- [ ] **D5** Ensure selection (checkbox) works in both grid and list views on polygon page

### Phase E: Data Loading from Supabase & Post-Generation Flow

- [ ] **E1** Extend polygon `+page.server.ts`: merge local types with Supabase bucket folders; for Supabase paramsFolders, fetch `polygons.json` from public URL
- [ ] **E2** Extend VC `+page.server.ts`: same merge; for Supabase paramsFolders, fetch `vcs.json` from public URL
- [ ] **E3** After polygon generation: add paramsFolder to dropdown (via store or invalidate with new data), switch to new set
- [ ] **E4** After VC generation: paramsFolder already exists; invalidate so VC page reloads and shows new VCs from Supabase

### Phase F: Polish & Consistency

- [ ] **F1** Match existing UI: `km-btn`, `km-btn-active`, Modal, green accent (`rgba(74, 222, 128, ...)`)
- [ ] **F2** Loading states, error toasts/messages for API failures
- [ ] **F3** Ensure responsive layout for new buttons and list view

---

## 4. File Changes Summary

| File | Action |
|------|--------|
| `src/lib/services/pipelineStorage.ts` | **Create** – Supabase upload helpers (public bucket) |
| `src/lib/algorithm/pipeline-core.ts` | **Create** – Extracted pure pipeline logic (no fs) |
| `src/routes/api/pipeline/generate-polygons/+server.ts` | **Create** – API route |
| `src/routes/api/pipeline/generate-vcs/+server.ts` | **Create** – API route |
| `src/lib/components/GeneratePolygonsDialog.svelte` | **Create** – Dialog UI |
| `src/lib/components/PolygonListItem.svelte` | **Create** – Compact list item (polygon page) |
| `src/lib/components/VCListItem.svelte` | **Create** – Compact list item (VC page) |
| `src/routes/(app)/algorithm/polygons-collection/+page.svelte` | **Modify** – Buttons, selection, list view, dialogs |
| `src/routes/(app)/algorithm/polygons-collection/+page.server.ts` | **Modify** – Merge Supabase paramsFolders, load polygons from Supabase |
| `src/routes/(app)/algorithm/vertex-configurations/+page.svelte` | **Modify** – Compact list view, view toggle |
| `src/routes/(app)/algorithm/vertex-configurations/+page.server.ts` | **Modify** – Merge Supabase paramsFolders, load VCs from Supabase |

---

## 5. Style Guidelines

- **Buttons**: Use `km-btn` / `km-btn-active` for secondary, green (`bg-green-500/15 text-green-400 border-green-500/30`) for primary actions
- **Modal**: Use existing `Modal.svelte` with `maxWidth`, `title`, `showHeader`
- **List item**: Compact row, `h-12` or similar, thumbnail 40–48px, monospace font for name
- **Toggle**: Same pattern as "Per Row" or sort keys — small pill buttons

---

## 6. Implementation Order

1. **Phase A** (infrastructure) – required for everything
2. **Phase D** (list view + `PolygonListItem`, `VCListItem`) – polygon and VC pages
3. **Phase B** (Generate Polygons) – core flow
4. **Phase C** (selection + Generate VCs) – depends on B
5. **Phase E** (load from Supabase, add to dropdowns after generation) – completes the loop
6. **Phase F** (polish) – throughout

**Decisions (fixed):**
- No user identification; storage path is `{paramsFolder}/polygons.json` and `{paramsFolder}/vcs.json`
- Bucket `pipeline-data` is public
- After polygon generation → add to polygon page dropdown and switch to new set
- After VC generation → add to VC page (same paramsFolder; invalidate to load new VCs)

---

## 7. Setup (What You Need to Do)

1. **Create Supabase bucket `pipeline-data`**
   - In Supabase Dashboard → Storage → New bucket
   - Name: `pipeline-data`
   - Set to **public** (for reads)

2. **Add `SUPABASE_SERVICE_ROLE_KEY` to `.env`**
   - Supabase Dashboard → Settings → API → copy "service_role" key
   - Add to your `.env` file:
   ```
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```
   - This key is required for the API routes to upload polygons and VCs to the bucket.
