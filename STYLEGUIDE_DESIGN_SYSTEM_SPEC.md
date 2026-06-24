# Style Guide → Design System — Spec

> Scop: transformăm Style Guide-ul dintr-un editor liber într-un **sistem de design token-driven**.
> Editezi un token (ex. Brand Color, section padding) → se propagă automat, live, peste tot unde e folosit.

---

## 1. Cele două moduri de editare (switcher)

Un **switcher segmentat** sus în editor — vizibil **doar în editare**, NU în view-ul share/public.

| Mod | Ce face |
|---|---|
| **Properties** (design-system) | Click pe orice element → vezi **doar token-urile** care îl controlează. Editezi token-ul → se schimbă **global**, peste tot unde e folosit. |
| **Everything** (free) | Comportamentul de acum: editezi orice element individual. Devine **override local** (nu atinge token-ul global). |

Switcher-ul nu apare în versiunea publică — acolo se vede doar rezultatul final.

---

## 2. Mecanismul de bază — token-driven

Documentul folosește variabile CSS (`var(--color-brand)`, `var(--section-padding-y)`, …) în tot conținutul.
Modul **Properties** editează aceste variabile în `:root` și le salvează. Pentru că tot conținutul le referă prin `var(...)`, o modificare se propagă instant.

> Asta repară bug-ul actual: acum, când schimbi un swatch, se schimbă doar pătratul, nu și titlurile/butoanele. În Properties, editarea Brand Color scrie `--color-brand`, deci tot ce folosește `var(--color-brand)` se actualizează.

---

## 3. Editare in-place (cum lucrezi efectiv)

În **Properties**, dai click pe un element → editorul detectează ce token(uri) îl controlează și arată doar acele controale.

- Click pe un titlu → controalele de **Typography** pentru nivelul lui (H1…) + culoarea de text (token).
- Click pe o secțiune → **Spacing** (section padding, pe desktop/tablet/mobile).
- Click pe un buton → tokenii de **Forms / Button**.
- Click pe un swatch → culoarea (token).

Fiecare token arată și un mic **„Used by"** (ex. *Brand Color → titluri, nav, butoane*) și poate **evidenția în preview** elementele afectate.

---

## 4. Grupele de token-uri

### Colors
`--color-brand` (Primary) · `--color-accent` (Action) · `--color-accent-dark` (hover) ·
`--color-surface-page` · `--color-surface-alt` · `--color-surface-card` ·
`--color-text` · `--color-muted` · `--color-border`

### Typography (responsive)
Două fonturi de bază: `--font-heading`, `--font-body`.
Roluri: **H1–H6, Body, Lead, Eyebrow, Small/Caption**.
Fiecare rol: font, weight, și — pe **Desktop / Tablet / Mobile** — `size`, `line-height`, `letter-spacing`.
Ex.: `--text-h1` (desktop) cu override în media-query la tablet/mobile.

### Links
`--link-color` · `--link-color-hover` · `--link-decoration` · `--link-decoration-hover` · weight

### Lists
marker (disc / decimal / none) · `--list-marker-color` · `--list-gap` (între iteme) · `--list-indent`

### Blockquote
`--bq-border-color` + width · `--bq-text-color` · italic/font · `--bq-padding` · background (opțional)

### Spacing  *(critic)*
**Scară** (bază 4px): `0 · 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 80 · 96 · 128` → `--space-*`
**Secțiuni** (responsive, global + override pe secțiune):
- `--section-padding-y` — sus/jos (D 96 / T 64 / M 48)
- `--container-padding-x` — stânga/dreapta (D 24 / T 24 / M 16)
- `--container-max-width` — 1200
**Gap** între elemente: din aceeași scară.

### Border Radii
`--radius-none` · `--radius-sm` · `--radius-md` · `--radius-lg` · `--radius-pill` → folosite de carduri, butoane, inputuri, imagini

### Responsive Breakpoints
`--bp-tablet` (ex. 1024) · `--bp-mobile` (ex. 640) — editabile; definesc unde se schimbă typography & spacing.
> Notă tehnică: media-query CSS nu acceptă `var()` în condiție, deci la schimbarea breakpoint-urilor **regenerăm** blocul `<style>` cu valorile numerice.

### Forms
Input: `--input-bg` · `--input-border` · `--input-radius` · `--input-padding` · `--input-text` · `--input-placeholder` · `--input-focus-border` (= accent)
Label: typography. Button (primary): `--btn-bg` (accent) · `--btn-text` · `--btn-radius` · `--btn-padding` · hover.

### Components (compozite — folosesc tokenii de mai sus + au câțiva proprii)
- **Content Card**: `--card-bg` (surface-card) · `--card-radius` · `--card-padding` · `--card-border` · `--card-shadow` · titlu/text = roluri typography
- **Navigation Bar**: `--nav-bg` · `--nav-text` · `--nav-link-hover` · înălțime/padding · dimensiune logo
- **Footer**: `--footer-bg` (dark/brand) · `--footer-text` · padding · stil link-uri

---

## 5. Override (regula de cascadă)

`stiluri implicite` **<** `token global (Properties)` **<** `editare locală pe element (Everything)`

- Properties = sursa de adevăr, cascadează peste tot.
- Everything = override doar pe elementul ales (inline), câștigă în fața token-ului.

---

## 6. Note tehnice (de care țin cont la build)

1. **Conținutul trebuie să folosească `var(...)`** ca propagarea să meargă. Template-ul nou va fi 100% token-based; ghidurile vechi pot necesita o mică migrare.
2. **Breakpoints editabile** → regenerăm CSS-ul la schimbare (media-query nu ia `var()`).
3. Editarea token-urilor scrie în `:root` (nu pe swatch), și se salvează în conținut.

---

## 7. Plan pe faze (propunere)

- **Faza 1** — Switcher (Properties/Everything) + propagare reală pentru **Colors + Typography (responsive) + Spacing**, cu editare in-place și „Used by".
- **Faza 2** — Links · Lists · Blockquote · Border Radii · Forms.
- **Faza 3** — Breakpoints editabile + Components (Card / Nav / Footer).

Fiecare fază: build → verificare în browser → confirmare.

---

## 8. De confirmat înainte de build

1. Lista de token-uri de mai sus e ok / mai adaugi / scoți?
2. Mergem pe planul în 3 faze (începem cu Faza 1)?
3. Componentele (Card/Nav/Footer) le vrei și ca **blocuri vizibile** în styleguide (demo live care se updatează când schimbi tokenii), corect?
