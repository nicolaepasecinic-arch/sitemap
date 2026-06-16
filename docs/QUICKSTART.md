# 🚀 QUICKSTART - Sitemap Builder Local Setup

**⏱️ Timp: 3-5 minute | Dificultate: ⭐ Ușor**

---

## 📋 Prerequisites

- **Node.js** instalat (v14+)
  - Download: https://nodejs.org/
  - Verifică: `node --version` și `npm --version` în terminal

---

## ✅ EXACT Steps (Copy-Paste)

### **STEP 1: Creează folder și deschide terminal**

```bash
# Creează folder
mkdir sitemap-builder
cd sitemap-builder
```

Deschide folderul în VS Code (sau editor preferat):
```bash
code .
```

### **STEP 2: Copiază fișierele config**

Copiază aceste fișiere din outputuri în root folder (`sitemap-builder/`):

- ✅ `package.json`
- ✅ `tailwind.config.js`
- ✅ `postcss.config.js`
- ✅ `index.html`

### **STEP 3: Creează folders pentru src**

În VS Code, creează structura:

```
sitemap-builder/
├── public/
│   └── (fișierele vor merge aici, sări pentru acum)
├── src/
│   ├── components/
│   │   └── (va merge SitemapBuilder.jsx)
│   ├── (va merge App.jsx și altele)
│   └── (va merge index.js și index.css)
├── package.json ✅
├── tailwind.config.js ✅
└── postcss.config.js ✅
```

### **STEP 4: Copiază fișierele de cod**

Copiază în `src/`:
- ✅ `index.js`
- ✅ `index.css`
- ✅ `App.jsx`

Copiază `SitemapBuilder.jsx` în `src/components/` (creează folder dacă nu există)

### **STEP 5: Instalează dependențe**

În terminal, din folder `sitemap-builder`:

```bash
npm install
```

Asteaptă să termine (va dura 1-2 minute la prima oară)

### **STEP 6: Start Development Server**

```bash
npm start
```

**Gata! 🎉**

Browser-ul se deschide automat la `http://localhost:3000`

---

## ✨ Ar trebui să vezi:

```
✅ Pagină cu "Sitemap Builder" în top
✅ Butoane: "Add Root Page", "Export JSON", etc.
✅ Nod "Home" cu URL "/"
✅ Sidebar cu statistici
```

---

## 🧪 Test imediat

### Test 1: Add Page
```
1. Click "Add Root Page"
2. Trebuie să apară "New Page"
```

### Test 2: Edit
```
1. Click pe icoană Edit (ștapel)
2. Schimbă "New Page" → "About"
3. Schimbă "/new-page" → "/about"
4. Click Save (verde)
```

### Test 3: Export
```
1. Click "Export JSON"
2. Se descarcă sitemap.json
```

---

## ⚠️ Dacă nu merge...

### Eroare: "npm: command not found"
- Node.js nu e instalat
- Download: https://nodejs.org/
- Restart terminal după instalare

### Eroare: "Port 3000 already in use"
```bash
npm start -- --port 3001
```

### Eroare: "Module not found"
```bash
# Asigură-te că ești în folder sitemap-builder
cd sitemap-builder

# Reinstalează
rm -rf node_modules
npm install
npm start
```

### Tailwind CSS nu se vede (no colors)
```bash
# Oprește serverul (Ctrl+C)
npm start
```

### De ce nu merge ceva?
1. **Verifica terminal** - sunt erori?
2. **Refresh browser** - Ctrl+R
3. **DevTools** - F12, Console tab, sunt erori?
4. **Restart serverul** - Ctrl+C în terminal, apoi `npm start`

---

## 📁 Structura finală corectă

Ar trebui să arate EXACT așa:

```
sitemap-builder/
├── node_modules/           (creează npm)
├── public/                 (creează React)
│   └── index.html          ✅ copiază
├── src/
│   ├── components/
│   │   └── SitemapBuilder.jsx   ✅ copiază
│   ├── App.jsx                  ✅ copiază
│   ├── index.js                 ✅ copiază
│   └── index.css                ✅ copiază
├── package.json             ✅ copiază
├── tailwind.config.js       ✅ copiază
├── postcss.config.js        ✅ copiază
└── README.md               (opțional)
```

---

## 🎯 Următorii pași

Odată ce merge local:

1. **Joacă-te cu el** - adaugă pagini, editează, exportă
2. **Customizează design** - schimbă culori în SitemapBuilder.jsx
3. **Adaugă feature-uri** - citește ADVANCED.md
4. **Deploy** - citește secțiunea Deploy din SETUP.md

---

## 📞 Commands utile

| Comandă | Ce face |
|---------|---------|
| `npm start` | Deschide dev server (http://localhost:3000) |
| `npm run build` | Creează versiune de producție |
| `npm test` | Rulează teste |
| `Ctrl+C` în terminal | Oprește serverul |

---

## ✅ Checklist Final

- [ ] Node.js instalat
- [ ] Folder `sitemap-builder` creat
- [ ] Toate fișierele copiaze în locurile corecte
- [ ] `npm install` finalizat
- [ ] `npm start` ruleaza
- [ ] Browser deschis la http://localhost:3000
- [ ] Vad pagina Sitemap Builder
- [ ] Pot adauga pagini noi
- [ ] Pot exporta JSON

---

**🎉 Felicitări! Ești gata să folosești Sitemap Builder local!**

Spune-mi dacă ceva nu merge! 🚀
