# Qoders — Documentație tehnică

Qoders este o platformă web pentru planificarea și revizuirea site-urilor, cu trei module care folosesc același cont și aceeași echipă:

- **Sitemap** — construiești harta unui site (pagini ierarhice + secțiuni/„content map"), cu AI, note, comentarii, arrows și export.
- **Markup** — încarci un site (URL live sau ZIP static) și lași comentarii „pin" peste pagină, cu versiuni, desene, atașamente, mențiuni și share public.
- **Design** — editor vizual de HTML peste versiunile ZIP din Markup (schimbi text, stiluri, drag & drop, layere). Disponibil doar pentru rolurile PM și Production.

Peste tot există integrare **Active Collab** (sincronizare pagini/comentarii ca task-uri/subtask-uri) și un **server MCP** prin care un AI (ex. Claude) poate conduce complet proiectele.

> Proiect intern: `https://www.wix.com/app-market/developer/purplebear` (PurpleBear). Cod: `/sitemap-builder`.

---

## 1. Arhitectură

```
sitemap-builder/
├── src/                      # Frontend React (Create React App)
│   ├── App.jsx               # Router pe hash (#/, #/p/<id>, #/markup, #/design, #/view, #/reset)
│   ├── Dashboard.jsx         # Lista proiecte Sitemap
│   ├── SitemapBuilder.jsx    # Editorul de sitemap (canvas)
│   ├── Login.jsx / ResetPassword.jsx / Account.jsx / Team.jsx
│   ├── ConnectAI.jsx         # „Connect to AI" (token MCP)
│   ├── ActiveCollabField.jsx # Câmp + iconiță AC, refolosit peste tot
│   ├── api.js                # Client REST (Sitemap, auth, team)
│   ├── auth.js               # token JWT în localStorage + helpers
│   ├── setupProxy.js         # Dev: proxy /api și /markup-files către :4000
│   └── markup/
│       ├── ProductTabs.jsx   # Bara de sus + comutator Sitemap/Markup/Design
│       ├── MarkupDashboard.jsx
│       ├── MarkupEditor.jsx  # Editorul de markup (iframe + pin-uri)
│       ├── DesignEditor.jsx  # Editorul vizual Design (inspector stil Framer)
│       └── markupApi.js      # Client REST (Markup/Design)
└── backend/                  # Node + Express + TypeScript + Postgres
    └── src/
        ├── index.ts          # Bootstrap Express, montare rute, AI endpoints, import/crawl
        ├── db.ts             # Pool pg + migrare schemă (idempotentă)
        ├── auth.ts           # Register/login/JWT, reset parolă, token MCP, teamRoleOf
        ├── teams.ts          # Echipe (o echipă/cont), roluri, invitații
        ├── projects.ts       # CRUD sitemap + share + Active Collab + acces pe roluri
        ├── markup.ts         # Markup + Design (versiuni, comentarii, fișiere, proxy, upload)
        ├── activecollab.ts   # Client Active Collab (fetch/create proiect, sync task/subtask)
        ├── ai.ts             # OpenAI Responses API (generare sitemap) — sursă unică
        ├── mailer.ts         # Email prin Resend (sau SMTP, sau log în consolă)
        └── mcp.ts            # Server MCP (JSON-RPC 2.0 peste HTTP la /mcp)
```

### Stack
- **Frontend:** React 18 (react-scripts), Tailwind (doar utilitare core), `lucide-react`, hash routing. `html2canvas` încărcat din CDN în iframe (pentru screenshot-uri de comentarii).
- **Backend:** Express 4 + TypeScript (`tsx watch` în dev), Postgres (`pg`), `bcryptjs`, `jsonwebtoken`, `adm-zip`, `nodemailer`, `firecrawl`.
- **Integrări:** OpenAI Responses API, Active Collab API, Resend (email), Firecrawl (screenshot URL).

### Flux de date
Frontend → REST (`/api/...`) → Postgres. În dev, CRA proxy (`setupProxy.js`) trimite `/api` și `/markup-files` către backend pe `:4000`, ca iframe-urile Markup/Design să fie **same-origin** (esențial pentru citirea DOM-ului din iframe).

---

## 2. Setup & rulare

### Cerințe
Node 18+, Postgres.

### Variabile de mediu (backend `.env`)
| Variabilă | Rol |
|---|---|
| `DATABASE_URL` | Conexiune Postgres (obligatoriu) |
| `PGSSL` | `true` dacă Postgres cere SSL |
| `PORT` | Port backend (default 4000) |
| `JWT_SECRET` | Semnare token-uri JWT |
| `CORS_ORIGIN` | Origini permise (virgulă), sau `*` |
| `APP_URL` | URL-ul aplicației (pentru link-uri în email/share) |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Generare sitemap cu AI |
| `ACTIVECOLLAB_URL`, `ACTIVECOLLAB_TOKEN` | Fallback AC (tokenul real e per-utilizator în cont) |
| `RESEND_API_KEY`, `MAIL_FROM` | Trimitere email (reset parolă, share, invitații) |
| `SMTP_HOST/PORT/USER/PASS/SMTP_FROM` | Alternativă SMTP la Resend |
| `FIRECRAWL_API_KEY` | Screenshot pentru versiunile URL din Markup |
| `MARKUP_DIR` | Director pe disc pentru fișierele Markup (default `uploads/markup`) |

> Secretele rămân DOAR în `backend/.env` (gitignored). Nu se pun în frontend și nu se comit.

### Frontend `.env`
`REACT_APP_API_URL=http://localhost:4000` (în dev).

### Comenzi
```bash
# Backend
cd backend
npm install
npm run dev        # tsx watch src/index.ts (reîncarcă la modificări)
npm run build      # tsc -> dist/
npm start          # node dist/index.js (producție)

# Frontend
cd ..
npm install
npm start          # http://localhost:3000
npm run build      # build de producție
```

> **Important:** dacă serverul rulează din `dist/` (`npm start`), modificările în cod NU apar până nu faci `npm run build`. În dev folosește `npm run dev` (preia automat).

---

## 3. Model de date (Postgres)

Schema se creează/migrează idempotent la pornire în `db.ts`.

- **users** — cont (email, parolă bcrypt, `profile` jsonb cu `acToken` etc.), `mcp_token`, `reset_token/expires`.
- **projects** — sitemap-uri: `name`, `nodes` (jsonb: pagini), `items` (jsonb: note/pin-uri/fișiere), `settings` (jsonb: temă, frame, paletă, **`files`** = atașamente la nivel de proiect), `ac_project_id/name`, `archived/completed`.
- **project_members / project_invites** — share pe email (rol `editor`/`viewer`); invites = pending pentru cine n-are cont.
- **teams / team_members / team_invites** — o echipă per cont; rol `pm` / `production` / `client`.
- **markup_projects** — proiecte Markup: `type` (`url`/`zip`), `url`, `pages`, `ac_project_id/name`, `archived/completed`.
- **markup_versions** — versiuni (`v1`, `v2`…): `type`, `url`, `pages` (jsonb `[{path,title}]` pentru zip), `screenshot`.
- **markup_comments** — pin-uri: `page`, `x`, `y` (fracții 0..1), `text`, `author`, `resolved`, `priority`, `drawing`, `replies`, `attachments`, `device`, `mentions`, `ac_subtask_id/number`, **`anchor`** (jsonb), **`type`**, **`scope`**, **`desired_value`**, **`screenshot`**.
- **markup_members / markup_invites** — share pe Markup.

### Forma comentariului (Markup) — pentru AI
Fiecare comentariu poartă context bogat ca AI-ul să știe exact ce să repare:
```jsonc
{
  "id","versionId","page","x","y","text","author","resolved","priority",
  "drawing":[], "replies":[], "attachments":[], "device","mentions":[],
  "type":   "spacing|color|copy|typography|layout|remove|add|animation|bug|other",
  "scope":  "element|all-similar|section|global",
  "desiredValue": "ex. padding-top: 120px / #6D28D9",
  "screenshot": "URL crop al regiunii (html2canvas)",
  "anchor": {
    "mkId": "data-mk-id stabil (localizator primar)",
    "selector": "cale CSS", "tag","id","classes",
    "text": "text din apropiere", "html": "outerHTML (≤4000)",
    "parents": ["...3 strămoși..."], "sectionId","sectionHeading",
    "computedStyles": { "padding-top":"...", "color":"...", ... }
  }
}
```
`anchor`, `mkId`, `computedStyles`, `screenshot` se capturează automat. `type`/`scope`/`desiredValue` se setează manual din composer doar când e pornit toggle-ul **Advanced** (ascuns implicit, deci clientul nu le vede; datele rămân pentru AI). `data-mk-id` se „ștampilează" o singură dată în HTML-ul versiunilor ZIP, ca să fie stabil între reîncărcări.

---

## 4. Roluri & permisiuni

Rolul de **echipă** (pe `users`/`team_members`): `pm`, `production`, `client`. Utilizatorii independenți (fără echipă) sunt tratați ca `pm` (dețin tot ce e al lor). Rolul de **proiect** (la share): `owner`, `editor`, `viewer` (+ rolul de echipă moștenit la co-membri).

Reguli cheie:
- **Client** — poate folosi aproape tot, DAR fără: sincronizare/asignare Active Collab, setarea token-ului AC, administrarea echipei, modulul Design, „Connect to AI". Nu vede toate proiectele echipei (doar cele partajate explicit).
- **Production** — tot, mai puțin administrarea echipei. Are acces la Design.
- **PM** — tot, inclusiv administrarea echipei și **asignarea proiectului Active Collab** (vezi mai jos).
- **Acces la nivel de echipă** la proiecte: doar **PM** vede proiectele întregii echipe; ceilalți văd doar ce li s-a partajat.

Gating implementat pe 3 niveluri (UI + rută + backend):
- **Design** — vizibil/permis doar `pm`/`production`. Backend: `POST /api/markup/versions/:vid/page` cere PM/Production.
- **Assign AC Project** — doar `pm`, peste tot: meniuri carduri (Sitemap+Markup), tab-ul din setări (Sitemap editor), gear-ul din Markup editor, endpoint-urile `POST .../activecollab` și tool-urile MCP `set_active_collab` / `markup_set_active_collab`.
- **Comentariile „pentru AI"** (chips type/scope/target) — ascunse până pornești Advanced; clientul nu le vede.

---

## 5. Modulul Sitemap

Canvas cu pagini ierarhice; fiecare pagină are **secțiuni** (blocuri) cu `frame` (tip wireframe), culoare, descriere, comentarii și atașamente. Pe canvas mai există **note** (sticky), **pin-uri de comentariu** și **carduri de fișier**.

Funcții: AI (generează sitemap / content-map, culori, SEO, traducere), Octopus Assistant (chat), clonare proiect, export (JSON/XML/CSV/backup), comutator scop **All / Mine / Shared**, atașamente de proiect (buton 📎 → modal cu taburi Upload / See files, badge cu număr + puls la salvare), și **Synchronize** cu Active Collab (fiecare pagină → un task; body = pagină + secțiuni + comentarii; re-sync actualizează; dacă taskul a fost șters în AC, se recreează; „Synchronize all").

---

## 6. Modulul Markup

Încarci un site din **URL** (afișat prin proxy same-origin) sau **ZIP** static (despachetat pe disc, servit din `/markup-files`). Lași **comentarii pin** peste pagină (poziție stocată ca fracții 0..1, lipite la scroll). 

Funcții: versiuni (v1, v2…; la adăugare poți alege **New version** sau **Current version** = înlocuiește ultima versiune păstrând comentariile), prioritate, emoji, **desen** pe comentariu, **atașamente**, **device** (desktop/tablet/mobile) cu contoare, **mențiuni** `@` + filtru „mențiuni pe mine", **reply** cu aceleași unelte ca la comentariu, **share** prin email sau link public read-only (`#/markup/view/<id>`, comentarii anonime cu nume), Escape închide draft-ul fără salvare, și sincronizare AC (pagină → task, comentariu → subtask; comentarii rezolvate → subtask completat).

Toggle **Advanced** (📊 lângă agrafă) arată câmpurile de intenție pentru AI (type/scope/desired value) și chips-urile pe comentarii. Implicit ascuns.

---

## 7. Modulul Design (PM / Production)

Editor vizual de HTML peste **versiunile ZIP** din Markup (aceleași proiecte ca Markup, aceeași listare). Pagina se încarcă într-un iframe same-origin; modificările se serializează și se salvează înapoi în fișierul versiunii (`POST /api/markup/versions/:vid/page`).

- **Selectare** prin click (outline), **dublu-click** = editare text inline.
- **Layers** (stânga): arbore DOM cu taburi Pages / Layers / Assets, „Home", search, drag & drop pentru reordonare (before/after/inside).
- **Inspector** (dreapta): secțiuni acordeon cu titlu negru, fiecare cu pattern **add/remove**: arată doar câmpurile setate, „+" în header adaugă (meniu cu căutare), cerc „−" scoate. Secțiuni: Typography, Position, Size, Layout, Spacing (cutie T/R/B/L), Border, Effects, Overlays, Cursor, Selection, Styles. Câmpuri în stil Framer (input gri, dropdown cu chevron, pills, color swatch, slider), comit pe blur/Enter, **săgeți ↑/↓** modifică valoarea (Shift = pas 10).
- **Editor:** preview Desktop/Tablet/Mobile, **Undo/Redo** (inclusiv `Cmd/Ctrl+Z`, `Cmd/Ctrl+Shift+Z`, și în iframe), page/version switcher, **Save**.

---

## 8. Active Collab

Client în `activecollab.ts` (header `X-Angie-AuthApiToken`, forțează HTTPS — http→https redirect transformă POST în GET). Tokenul AC e per-utilizator (în `profile.acToken`, setat din Account; ascuns pentru client). Operații: verifică/creează proiect, `syncAcTask` (creează/actualizează task, întoarce `taskId` global + `taskNumber` afișabil „Task #N"), `syncAcSubtask` (comentariu → subtask, completat dacă e rezolvat). Asignarea proiectului AC se face **doar de PM**.

---

## 9. Email

`mailer.ts` alege în ordine: **Resend** (`RESEND_API_KEY`) → **SMTP** → log în consolă (dev). `MAIL_FROM` trebuie să fie pe un domeniu verificat. Folosit la: reset parolă, share proiect prin email, invitații în echipă/proiect.

---

## 10. Server MCP (`/mcp`)

JSON-RPC 2.0 peste HTTP, autentificare prin token per-cont (`?token=...` sau `Authorization: Bearer <token>` — tokenul din „Connect to AI"). Limită body 64MB. Metode: `initialize`, `tools/list`, `tools/call`.

Toate tool-urile (numele exacte):

**Sitemap — proiecte & structură**
`list_projects`, `get_project`, `export_project`, `create_project`, `create_sitemap` (AI-ul construiește pagini + secțiuni într-un singur apel — preferat), `add_page_with_sections`, `generate_sitemap` (fallback AI Qoders), `rename_project`, `set_project_status`, `duplicate_project`, `delete_project`, `leave_project`, `add_page`, `update_page`, `delete_page`, `add_section`, `update_section`, `delete_section`, `move_section`, `add_arrow`, `remove_arrow`.

**Sitemap — comentarii / fișiere / note / membri / share / AC**
`list_comments`, `add_section_comment`, `add_section_file` (atașează fișier la o secțiune, base64), `add_comment` (pin pe canvas), `delete_comment`, `list_notes`, `add_note`, `delete_note`, `list_members`, `invite_member`, `remove_member`, `share_project` (share prin EMAIL și/sau link public URL), `find_active_collab_project`, `set_active_collab` (PM), `sync_active_collab` (sincronizează toate paginile).

**Markup — proiecte / versiuni / upload**
`markup_list_projects`, `markup_get_project`, `markup_rename_project`, `markup_set_project_status`, `markup_duplicate_project`, `markup_delete_project`, `markup_leave_project`, `markup_list_versions`, `markup_add_url_version`, `markup_add_zip_version` (mode `new`/`current`), `markup_export_version` (descarcă o versiune ca ZIP base64; fără versiune → ultima).

Upload ZIP (de la cel mai rapid la cel mai lent):
- `markup_create_zip_from_path` / `markup_add_zip_version_from_path` — **same machine**: serverul citește ZIP-ul de pe disc după cale absolută (instant, fără base64).
- `markup_create_zip_from_url` / `markup_add_zip_version_from_url` — serverul descarcă ZIP-ul de la un URL.
- `markup_upload_begin` → `markup_upload_chunk` (bucăți mari ~4MB base64) → `markup_upload_finish` — pentru bytes fără cale/URL.
- `markup_create_zip_project` / one-shot base64 — DOAR fișiere mici.

> De ce upload-ul base64 e lent: bytes-ii trec prin model (Claude „tastează" base64-ul token cu token). De aceea preferă path/URL.

**Markup — comentarii / fișiere / share / AC**
`markup_list_comments`, `markup_add_comment` (cu `files`), `markup_add_comment_file`, `markup_update_comment`, `markup_delete_comment`, `markup_share_project` (email/URL), `markup_set_active_collab` (PM).

> Comentariile returnate de `markup_list_comments` / `markup_get_project` includ `anchor` (mkId/selector/text/computedStyles…), `type`, `scope`, `desiredValue`, `screenshot` — descrierile tool-urilor îi spun AI-ului să localizeze prin mkId/selector și să aplice fix-ul pe baza computedStyles + desiredValue + type/scope.

### Pornire MCP local (Claude Desktop are nevoie de HTTPS)
Pentru testare locală, expune `:4000` printr-un tunel (ex. cloudflared) și folosește URL-ul HTTPS în Claude Desktop cu `?token=<MCP_TOKEN>`. După orice modificare de cod, **repornește backend-ul** și **reconectează conectorul** (lista de tool-uri e citită o singură dată, la conectare).

---

## 11. API REST (rezumat)

Toate sub-rutele necesită JWT (`Authorization: Bearer`) cu excepția celor publice.

**Auth** (`/api/auth`): `POST /register`, `POST /login`, `POST /forgot`, `POST /reset`, `GET/PATCH /me`, `POST /me/password`, `DELETE /me`, `GET /me/mcp`, `POST /me/mcp/regenerate`.

**Team** (`/api/team`): `GET /`, `POST /` (creează — doar registrantul independent), `DELETE /leave`, `POST /members`, `PATCH/DELETE /members/:userId`, `DELETE /invites/:email`.

**Projects** (`/api/projects`): `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id`, `POST /:id/duplicate`, `POST /:id/activecollab` (PM), `POST /:id/activecollab/task`, membri: `GET /:id/members`, `POST /:id/members`, `DELETE /:id/members/:userId`, `DELETE /:id/invites/:email`. Public: `GET /api/public/projects/:id`.

**Markup** (`/api/markup`): proiecte (`GET/POST /projects`, `POST /projects/upload`, `GET/PATCH/DELETE /projects/:id`, `/duplicate`), versiuni (`GET/POST /projects/:id/versions`, `POST /projects/:id/versions/upload`, `POST /versions/:vid/screenshot`), **Design** (`POST /versions/:vid/page`), comentarii (`GET/POST /versions/:vid/comments`, `PATCH/DELETE /comments/:cid`, replies, `GET /projects/:id/comments`), atașamente (`POST /attachments`), membri (`/projects/:id/members…`, `/people`), AC (`POST /projects/:id/activecollab` (PM), `/ac/page`, `/comments/:cid/ac`). Proxy: `GET /api/markup/proxy`. Public (fără auth): `/api/markup/public/...`. Fișiere statice: `/markup-files/...`.

**AI** (`/api/ai`): `POST /contentmap`, `POST /sitemap`, `POST /assistant`. Import: `GET /api/import/sitemap`, `GET /api/import/crawl`.

---

## 12. Verificare (build gate)

Înainte de orice livrare:
```bash
# Backend
cd backend && npx tsc --noEmit && npm run build

# Frontend
cd .. && CI=true npx eslint src/<fișier>.jsx
CI=true npx react-scripts build      # CI=true => warnings = erori
```
Note frecvente eslint care pică build-ul CI: import nefolosit, variabilă nefolosită, `react-hooks/exhaustive-deps` (în `DesignEditor.jsx` e dezactivat la nivel de fișier intenționat), `no-loop-func`.

---

## 13. Capcane cunoscute (rezolvate)

- **jsonb `cleanDrawing`/`cleanAttachments`/`cleanMentions`** trebuie să întoarcă **array** (nu string) — altfel `length` numără caractere și apar „1770 annotations".
- **Active Collab `http://`** face redirect 301 → POST devine GET → forțează `https://`.
- **„Task #4171" = Project ID, nu Task ID** — afișează `task_number`, păstrează `id` global pentru API.
- **Resend „testing emails"** — `MAIL_FROM` pe domeniu verificat.
- **Inspector Design se închidea la editare** — era `key={selTick}` care remonta; acum se remontează doar la schimbarea elementului (`selSeq`).
- **Câmp numeric „15" devenea „1px"** — input-urile comit pe blur/Enter (stare locală), nu transformă la fiecare tastă.
- **dist vechi** fără `mcp.js` → tool-uri MCP lipsă; rulează `npm run build` sau `npm run dev`.
