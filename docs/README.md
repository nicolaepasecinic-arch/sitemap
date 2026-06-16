# Sitemap Builder - React Component

Un builder de sitemap visual și interactiv pentru React, similar cu Octopus.do. Creează, editează și exportă structura website-ului tău ușor.

## 🎯 Caracteristici

✅ **Drag and Drop** - Reorganizează paginile prin simplu drag-and-drop
✅ **Editare în timp real** - Editează titluri și URL-uri direct în componentă
✅ **Export multiplu** - Exportă în XML, JSON sau CSV
✅ **Salvare automată** - LocalStorage integration pentru persistență
✅ **Backup și Restore** - Salvează și încarcă configurații
✅ **Statistici** - Afișează informații despre structura siteului
✅ **Interfață intuitivă** - Design modern cu Tailwind CSS

## 📦 Instalare

### Cerințe
- React 16.8+
- Tailwind CSS
- lucide-react (pentru icoane)

### Setup

1. **Instalează dependențe:**
```bash
npm install lucide-react
```

2. **Copiază componentele:**
- `SitemapBuilder.jsx` - Componenta principală
- `App.jsx` - Exemplu de utilizare (opțional)

3. **Configurează Tailwind CSS** (dacă nu ai deja):
```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

4. **Importă în aplicația ta:**
```jsx
import SitemapBuilder from './SitemapBuilder';

export default function App() {
  return <SitemapBuilder />;
}
```

## 🚀 Utilizare

### Interfață principală

```
┌─────────────────────────────────────────────────────────┐
│  TOOLBAR: Add | Export JSON | Export XML | Export CSV   │
├──────────────────────────────┬──────────────────────────┤
│                              │                          │
│  SITEMAP TREE                │  SIDEBAR                 │
│  (drag-and-drop)             │  - Statistics            │
│  - Home                       │  - Selected Node Info    │
│    ├─ About                   │  - Tips & Info           │
│    ├─ Services                │                          │
│    │  ├─ Service 1            │                          │
│    │  └─ Service 2            │                          │
│    └─ Contact                 │                          │
│                              │                          │
└──────────────────────────────┴──────────────────────────┘
```

### Acțiuni disponibile

#### 1. **Adaugă pagină nouă**
- Click **"Add Root Page"** pentru pagini principale
- Click **"+"** lângă o pagină pentru a adăuga sub-pagini

#### 2. **Editează pagină**
- Click pe icoană **Edit** din dreapta unui nod
- Sau click pe nod în sidebar și apasă "Edit Node"
- Editează label și URL, apoi salvează

#### 3. **Reorganizează cu Drag & Drop**
- Trage o pagină și plasează-o deasupra altei pagini
- Pentru a o face sub-pagină a acelei pagini
- Eliberează mouse-ul pentru a finaliza operația

#### 4. **Șterge pagină**
- Click pe icoană **Trash** din dreapta nodului
- (Nu poți șterge Home page)
- Copii vor fi șterși automat

#### 5. **Selectează pagină**
- Click pe orice nod
- Informațiile vor apărea în sidebar dreapta

### Export-uri

#### JSON
Exportă structura completă ca fișier JSON structurat:
```json
[
  {
    "label": "Home",
    "url": "/",
    "children": [
      {
        "label": "About",
        "url": "/about",
        "children": []
      }
    ]
  }
]
```

#### XML
Exportă ca XML pentru alte sisteme:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<sitemap>
  <page>
    <label>Home</label>
    <url>/</url>
    <children>
      <page>
        <label>About</label>
        <url>/about</url>
      </page>
    </children>
  </page>
</sitemap>
```

#### CSV
Exportă cu informații de adâncime pentru spreadsheets:
```csv
Label,URL,Depth
Home,/,0
About,/about,1
Services,/services,1
Service 1,/services/1,2
```

### Salvare și Restaurare

**Salvare automată**: LocalStorage salvează automat orice schimbare
**Backup**: Click "Backup" pentru a descărca un fișier JSON complet
**Restore**: Click "Load" și selectează un fișier JSON salvat anterior

## 💡 Exemple de utilizare

### Sitemap tip E-commerce
```
Home /
├── Products /products
│  ├── Electronics /products/electronics
│  ├── Clothing /products/clothing
│  └── Books /products/books
├── About /about
├── Contact /contact
└── Cart /cart
```

### Sitemap tip Blog
```
Home /
├── Blog /blog
│  ├── Post 1 /blog/post-1
│  ├── Post 2 /blog/post-2
│  └── Categories /blog/categories
├── About /about
└── Subscribe /subscribe
```

### Sitemap tip SaaS
```
Home /
├── Product /product
│  ├── Features /product/features
│  ├── Pricing /product/pricing
│  └── Roadmap /product/roadmap
├── Company /company
│  ├── About /company/about
│  ├── Team /company/team
│  ├── Careers /company/careers
│  └── Blog /company/blog
├── Docs /docs
│  ├── Getting Started /docs/getting-started
│  ├── API Reference /docs/api
│  └── FAQ /docs/faq
└── Contact /contact
```

## 🎨 Customizare

### Schimbă culori (Tailwind)
Editează clasele în `SitemapBuilder.jsx`:
- `bg-blue-500` → `bg-indigo-500`
- `bg-green-500` → `bg-emerald-500`
- etc.

### Schimbă layout
Modifică `grid-cols-3` din componență pentru alte proporții
- `grid-cols-2` - Split 50/50
- `grid-cols-4` - Sidebar mai larg

### Adaugă mai multe campuri
Extinde structura nodului în `addNode()`:
```javascript
const newNode = {
  id: newId.toString(),
  label: 'New Page',
  url: '/new-page',
  parentId,
  description: '',  // NEW FIELD
  icon: 'home',     // NEW FIELD
  children: []
};
```

## 🔧 Structura de date

```javascript
// Nod individual
{
  id: '1',              // Identificator unic
  label: 'Home',        // Titlu vizibil
  url: '/',             // URL path
  parentId: null,       // ID al nodului părinte (null pentru root)
  children: []          // (optional) pentru referință rapidă
}
```

## 📊 Funcții disponibile

| Funcție | Descriere |
|---------|-----------|
| `addNode(parentId)` | Adaugă nod nou |
| `deleteNode(nodeId)` | Șterge nod și copii |
| `startEditing(node)` | Deschide mod editare |
| `exportJSON()` | Exportă ca JSON |
| `exportXML()` | Exportă ca XML |
| `exportCSV()` | Exportă ca CSV |
| `saveSitemap()` | Backup în JSON |
| `loadSitemap(file)` | Restaurează din JSON |
| `handleDragStart()` | Inițiază drag |
| `handleDrop()` | Finalizează drop |

## 🐛 Troubleshooting

### Export nu funcționează
- Verifica dacă browser-ul permite descărcări
- Dezactivează ad-blockers

### Drag-and-drop nu funcționează
- Asigură-te că ai Tailwind CSS configurat corect
- Verifică console pentru erori

### Datele se pierd la refresh
- Verifica dacă LocalStorage e activat
- Backup-ul nu a fost restaurat corect

## 📝 Licență

Free to use for personal and commercial projects.

## 🤝 Contribuții

Ești liber să extinzi și să customizezi componenta după nevoile tale!

## ✨ Idei pentru îmbunătățiri

- [ ] Drag visual din canvas
- [ ] Undo/Redo functionality
- [ ] Tematica light/dark
- [ ] Analytics
- [ ] Colaborație real-time
- [ ] Import din Google Analytics
- [ ] Mobile responsive
- [ ] Keyboard shortcuts
