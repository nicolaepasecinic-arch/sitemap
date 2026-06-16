# Qoders — project context (read me first)

A visual **sitemap / website-structure planner** (Octopus.do-style), built with **Create React App + React 18 + Tailwind (core utility classes) + lucide-react**. Everything is client-side; data persists in `localStorage`. Build is verified with `react-scripts build` (CI=true treats warnings as errors).

## Run / verify
- Dev: `npm start`
- Lint: `CI=true npx eslint src/*.jsx src/*.js`
- Prod build: `CI=true npx react-scripts build`
- Quirks: the project folder is mounted read-only for **deletes** (can't `rm`); `node_modules` may contain macOS duplicate dirs like `ajv 2` (if `ajv` breaks, copy `"ajv 2"/.` into `ajv/`). Stale `src/SitemapBuilder 2.jsx` is a dup, not imported.

## Brand
- Name: **Qoders**. Logo: red 6-point asterisk star (`src/Brand.jsx`, `<BrandStar/>`, color `#EF3B2D`, soft circle bg `#FDE7E4`). Favicon: `public/favicon.svg`.
- Primary accent color: **`#473AE0`** (indigo). Hover darker `#3a2fc0`. Use Tailwind `indigo-*` for tints. Success/active borders use `#10B981`.

## Files (src/)
- `App.jsx` — auth gate + hash router. No auth → `Login`. Route `#/p/<id>` opens a project in `SitemapBuilder`, else `Dashboard`.
- `auth.js` — local mock auth (`getAuth/setAuth/clearAuth/initials`). User = `{name,email}`.
- `Login.jsx` — two-column login in brand colors (email + Google button, both mock-login). Right panel = testimonial.
- `Dashboard.jsx` — top bar (My projects / account+Logout). Project grid with thumbnail; per-card gear menu (Rename/Duplicate/Archive/Delete). Search by name, Active/Archived toggle, sort (Alphabetically/Date created/Last updated, saved in localStorage). Action cards: New blank, Choose a template (Templates modal), Import website (visual `ImportModal`). 
- `projectStore.js` — localStorage CRUD. project = `{id,name,createdAt,updatedAt,archived,nodes,items,settings}`. `seedNodes()` default tree. Exports list/get/create/createFromTemplate/save/rename/duplicate/archive/delete.
- `templates.js` — 18 complete templates; `build(rootTree, sections)` auto-wraps every page with Header+Footer blocks. Each `TEMPLATES[i].nodes()` returns fresh nodes.
- `SitemapBuilder.jsx` — the canvas editor (the big file). See data model below.

## Data model
- **node (page)**: `{id,label,parentId,group:'main'|'section',color,link,pageFrame,frameCustom,edge,blocks:[]}`.
  - `group`: MAIN tree vs standalone SECTION pages (Cookies/404…). Drag a page onto empty canvas above/below the section divider to switch zones.
  - `pageFrame`: per-page outer style `window|brackets|pill|stacked|phone|plain`. Only used if `frameCustom` true; otherwise the project default frame applies.
  - `edge`: `{style:'solid'|'dashed'|'dotted', color}` — styling of the parent→child connector (click a line to edit; delete detaches child to root).
- **block (section)**: `{id,name,color,frame,done,arrowTargets:[pageId],arrowStyles:{[pageId]:{color,style}},description(HTML),comments:[]}`.
  - `frame` = wireframe glyph key (see `FRAME_KEYS`, rendered by `<FrameGlyph>`, full-width via `preserveAspectRatio="none"`).
  - `arrowTargets` = section→page link arrows (enter link mode via the arrow toolbar button, click target pages). Arrows are editable (click → 3 styles + color + delete).
- **item (canvas object)**: notes / links / comments. `{id,type,x,y,...}`. Pointer-drag (`startItemDrag`). Persisted in `project.items`.
- **settings** (project): `{theme:'light'|'dark'|'blueprint'|'bold', frame:'web'|'mobile'|'neutral', colorList:[colorKey|hex]}`. Theme changes canvas bg/dots; frame sets default page shape (web=window, mobile=phone-with-notch, neutral=plain); colorList drives the color pickers (add/remove colors; removing reverts nodes using it to `blue`).

## Editor UI conventions
- Two contextual toolbars float above the selected element: **PageToolbar** (page selected: Add section, Frame submenu, Color, Link, AI box, Delete-with-confirm) and **SectionToolbar** (block selected, positioned above that block: Mark-done toggle, Add-below, Color, Wireframe picker, Arrows/link mode, Duplicate, Delete-with-confirm). Both counter-scale by zoom via `ToolbarShell`.
- Colors: `COLORS` map (12 keys) + `resolveColor(keyOrHex)`. `ColorPalette` popover (presets + native custom picker; closes on preset pick, stays open for custom). Note colors are 4 classic pastels (`NOTE_COLORS`).
- Top bar: Back, brand menu (Go to Dashboard + Export), project name, Share popup (link only), Search (pages & sections → focus), Settings panel (Theme/Frames/Colors).
- Bottom bar: Add page, AI (no-op), Notes, Files (toast "coming soon"), Links, Comments, Import/Export. Undo/redo bottom-left (`Ctrl/Cmd+Z`), zoom control bottom-right.
- Section detail modal (block "=" on hover): rich-text description (Bold/Italic/Underline/List) + comments + compact page preview with active block highlighted.
- Persistence: `onChange({nodes,items,settings})` from editor → `saveProject`. History (undo) tracked on `nodes` only.

## Gotchas / decisions
- Pan handler must capture values before `setView` (don't read `panRef` inside the updater) — fixed a null-read crash.
- Wheel zoom is gentle/clamped; ignores wheel over `[data-ui]` so popovers scroll.
- Interactive UI elements carry `data-ui` (so background pan/deselect ignores them); page cards carry `data-node`.
- Drag-and-drop is HTML5-based; cards have CSS transitions for smoother reflow. Blocks can reorder within a page and move across pages.
