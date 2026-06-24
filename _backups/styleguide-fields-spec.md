# Style Guide — Inventar complet de câmpuri (din fișierul tău)

Sursa: `Style Guide Configuration (4).html`. Acestea sunt TOATE câmpurile care trebuie să existe în sistem.

## 01 · Typography

**Body** (6): font-family, font-size, font-weight, line-height, letter-spacing, color

**H1–H6** — câte un card per heading (9 fiecare): font-family, font-size, font-weight, line-height, letter-spacing, color, margin-top, margin-bottom, text-transform

**Paragraph `<p>`** (7): font-family, font-size, font-weight, line-height, color, margin-bottom, max-width

**Links `<a>`** (7): font-family, color, text-decoration, font-weight, color (hover), text-decoration (hover), transition

**Unordered List `<ul>`** (6): font-family, list-style-type, padding-left, margin-bottom, li: line-height, li: margin-bottom

**Ordered List `<ol>`** (6): font-family, list-style-type, padding-left, margin-bottom, li: line-height, li: margin-bottom

**Blockquote** (10): font-family, font-size, font-style, font-weight, line-height, color, border-left-width, border-left-color, padding-left, margin

## 02 · Buttons

**Button** (12): background-color, color, border, border-radius, padding, font-size, font-weight, letter-spacing, text-transform, background-color (hover), color (hover), transition

## 03 · Inputs

**Input** (11): background-color, color, border, border-radius, padding, font-size, line-height, color (placeholder), border (focus), outline (focus), box-shadow (focus)

**Textarea** (12): background-color, color, border, border-radius, padding, font-size, line-height, min-height, resize, color (placeholder), border (focus), outline (focus)

**Select / Dropdown** (13): background-color, color, border, border-radius, padding, font-size, appearance, background-image, background-position, background-size, background-repeat, border (focus), outline (focus)

**Checkbox / Radio** (9): width, height, accent-color, border, border-radius (checkbox), border-radius (radio), background-color, background-color (checked), cursor

## 04 · Section Spacing
padding-top, padding-bottom

## 05 · Container
max-width, padding-left, padding-right

## 06 · Colors (listă, add/remove)
Câmpuri per culoare: **role · hex value · description**
Roluri implicite: Primary (Main brand color), Secondary (Supporting color), Accent (Highlights & CTA), Text (Primary text), Background (Page background), Border (Borders & dividers)

## 07 · Border Radius (8 tokenuri)
Câmpuri per rând: **name · token · value · used for**
None `--radius-none` 0, XS `--radius-xs` 2px, SM `--radius-sm` 4px, MD `--radius-md` 8px, LG `--radius-lg` 12px, XL `--radius-xl` 16px, 2XL `--radius-2xl` 24px, Full `--radius-full` 9999px

## 08 · Responsive Breakpoints (listă, add/remove)
Câmpuri per rând: **label · min (px) · max (px)**
Mobile 320–767, Tablet 768–991, Small Desktop 992–1279, Desktop 1280–1439, Large Desktop 1440–1919, Wide 1920–∞
