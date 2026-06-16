# Octopus.do — analiză funcțională (referință pentru Sitemap Builder)

Analiză a comportamentului UI/UX din proiectul de referință, folosită ca specificație
pentru editorul nostru. Sursă: editorul Octopus.do (proiect propriu, observat live).

## 1. Canvas

- Pagini ca **carduri-fereastră de browser** (••• în colț), legate prin **linii de conexiune** într-un arbore.
- Două grupuri: **MAIN** (arborele principal) și **SECTION** (pagini utilitare standalone: Cookies, 404).
- **Pan** prin tragerea fundalului, **zoom** din scroll + control −/%/+ jos-dreapta.
- **Layout** comutabil: *Default* (arbore orizontal, top-down) vs *Vertical* (listă indentată).

## 2. Card pagină

Fiecare card are:
- **•••** colț stânga-sus (decor fereastră).
- **„=" buton** (colț dreapta-sus) → deschide **modal de detaliu**: zonă „Add block…", listă de blocuri și „Add a comment…".
- **„+" jos-centru** → adaugă **sub-pagină** (copil).
- **„^"** → collapse/expand subarbore.
- **„✦"** (mov) → asistent AI.
- Zonă internă „+" → **adaugă o secțiune (bloc)** în pagină.

### Blocuri (secțiuni interne)
- Rânduri colorate în pagină (Header, Introduction, Services, Latest News, Footer…).
- Cod de culoare: **Blue / Topaz / Purple**.
- „Image mode" (toggle în Project settings) afișează/ascunde wireframe-ul vizual din blocuri — opțional, nu esențial.

## 3. Toolbar contextual (deasupra cardului selectat)

Iconițe observate: **Add block**, Page/template, **Color**, Tag, chart/SEO, **Link**, **AI**, **More (⋮)**.

- **Link** → tooltip „External link", input **„Enter link URL"** → salvează un URL extern pe pagină.
- **Color** → selector Blue / Topaz / Purple.

> Pentru editorul nostru păstrăm doar ce e relevant: **Add block, Color, Link, Duplicate, Delete**.
> Eliminăm iconițele **Image** și **Blocks (grid)** — irelevante pentru flux.

## 4. Drag and drop

- Pagini: se trage cardul peste alt card → devine **copilul** acestuia; tras între frați → **reordonare**; layout-ul reflowează automat.
- Blocuri: se trag în interiorul paginii pentru **reordonare**.

## 5. Export / Import

Meniu de proiect → **File → Export**, cu formate: Figma, AI prompt, WordPress,
**Sitemap.xml, XML, PDF, PNG, CSV, Excel, TXT, Word**.

> Pentru editorul nostru implementăm: **Export** JSON / Sitemap XML / CSV / TXT și **Import** JSON.

## 6. Project settings (panou dreapta)

- **Theme**: Light / Dark / Blueprint / Bold.
- **Frames**: Web / Mobile / Neutral.
- **Layout**: Default / Vertical.
- **Image mode**: on/off.
- Contor pagini (ex. „11 pages").

---

## Mapare pe cerințele tale (cele 5 bug-uri)

1. **Drag-and-drop** → reparent pagini + reordonare blocuri. ✅
2. **Secțiunea Image irelevantă** → scoasă din toolbar. ✅
3. **Link = link la pagină** → input URL extern salvat pe pagină. ✅
4. **Iconița „blocks" (grid) irelevantă** → scoasă din toolbar. ✅
5. **Import / Export** → meniu dedicat (export JSON/XML/CSV/TXT, import JSON). ✅
