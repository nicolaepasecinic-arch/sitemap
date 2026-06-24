# 🎨 Qoders — Sitemap & Style-Guide Builder

> **Installing the app?** Start with **[INSTALL.md](./INSTALL.md)** — full setup for local
> development and production (Coolify), with every step explained.
> Deploying to Coolify specifically? See **[DEPLOY-COOLIFY.md](./DEPLOY-COOLIFY.md)**.
>
> Quick start (local, everything in Docker):
> ```bash
> docker compose up --build      # frontend → http://localhost:8080
> ```

---

## 📊 Structura Proiectului

```
sitemap-builder/
├── 📁 docs/                          ← 📖 DOCUMENTAȚIE (Citești de aici)
│   ├── 00_START_HERE.md             ← 👈 START AQUI!
│   ├── NEXT_STEPS.txt               ← Quick overview
│   ├── QUICK_COMMANDS.md            ← Comenzi rapide
│   ├── DEPLOYMENT_GUIDE.md          ← 5 opțiuni deploy
│   ├── FILES_I_CAN_ACCESS.txt       ← Cum lucrez pe erori
│   └── ...alte ghiduri
│
├── 🔧 SETUP SCRIPTS
│   ├── setup-local.sh               ← Rulează pe macOS/Linux
│   └── setup-local.bat              ← Rulează pe Windows
│
├── 🎯 SOURCE CODE
│   ├── SitemapBuilder.jsx           ← Componenta principală (15KB)
│   ├── App.jsx                      ← App wrapper
│   ├── index.js                     ← React entry point
│   ├── index.html                   ← HTML template
│   └── index.css                    ← Global styles
│
├── ⚙️ CONFIG FILES
│   ├── package.json                 ← Dependențe + scripts
│   ├── tailwind.config.js           ← Tailwind setup
│   └── postcss.config.js            ← PostCSS config
│
├── 📦 BUILD OUTPUT (generat după `npm run build`)
│   └── build/                       ← 👈 ASTA UPLOADEZI!
│       ├── index.html
│       ├── static/
│       └── favicon.ico
│
└── 📝 DATA
    └── example-sitemap.json         ← Example sitemap
```

---

## 🚀 QUICK START (3 pasuri)

### 1️⃣ Instalare
```bash
cd sitemap-builder
chmod +x setup-local.sh              # (macOS/Linux only)
./setup-local.sh                     # sau setup-local.bat pe Windows
```

### 2️⃣ Build
Script-urile fac asta automat! Asteapta 3-5 minute.

### 3️⃣ Deploy
Copiază folderul `build/` pe:
- **Vercel**: `vercel deploy`
- **Netlify**: `netlify deploy --prod --dir=build`
- **Server**: `scp -r build/* user@server:/path/`

---

## 📖 DOCUMENTAȚIE

| Fișier | Descriere |
|--------|-----------|
| **docs/00_START_HERE.md** | 👈 Citește asta PRIMA |
| **docs/NEXT_STEPS.txt** | Overview rapid |
| **docs/QUICK_COMMANDS.md** | Doar comenzile |
| **docs/DEPLOYMENT_GUIDE.md** | Detalii complete |
| **docs/FILES_I_CAN_ACCESS.txt** | Cum lucrez pe erori |
| **docs/README.md** | Documentația originală |

---

## 🎨 CARACTERISTICI

✅ **Drag & Drop** - Reorganizează paginile ușor  
✅ **Edit Real-Time** - Modifica titluri și URLs  
✅ **Export** - JSON, XML, CSV  
✅ **Auto-Save** - LocalStorage integration  
✅ **Responsive** - Works on mobile & desktop  
✅ **Statistics** - Site structure info  

---

## 🔧 COMENZI

```bash
# Instalare dependențe
npm install --legacy-peer-deps

# Development (local test)
npm start
# → http://localhost:3000

# Production build
npm run build
# → creează folder 'build/'

# Test
npm test

# Cleanup
rm -rf node_modules package-lock.json
```

---

## 📁 WHAT GOES WHERE

| Folder | Purpose | Upload? |
|--------|---------|---------|
| **docs/** | Documentație | ❌ No |
| **build/** | Production files | ✅ **YES!** |
| **node_modules/** | Dependencies | ❌ No |
| **src/** (if exists) | Source code | ❌ No |

---

## 🚀 DEPLOYMENT

### ⭐ Vercel (Easiest)
```bash
npm install -g vercel
vercel login
vercel
# Done! URL instant
```

### 🚀 Netlify
```bash
npm install -g netlify-cli
netlify deploy --prod --dir=build
```

### 📦 Self-Hosted
```bash
scp -r build/* user@server.com:/var/www/sitemap/
```

---

## 🐛 TROUBLESHOOTING

**Error: "npm: command not found"**
→ Instalează Node.js: https://nodejs.org/

**Build failed**
→ `rm -rf node_modules && npm install`

**Port 3000 in use**
→ `PORT=3001 npm start`

**Data disappears**
→ Check localStorage (F12 → Application tab)

---

## 📞 SUPPORT

Ceva nu merge?
1. Copie full error message
2. Trimite-mi error-ul
3. Eu editez fișierele direct (am acces)
4. Tu rulezi din nou

---

## 📚 DOCS

```
📖 docs/00_START_HERE.md        ← START AQUI!
📖 docs/NEXT_STEPS.txt
📖 docs/QUICK_COMMANDS.md
📖 docs/DEPLOYMENT_GUIDE.md
📖 docs/FILES_I_CAN_ACCESS.txt
```

---

**Ready to deploy? 🚀**

→ Deschide **docs/00_START_HERE.md** acum!

---

*Built with React 18, Tailwind CSS, and lucide-react* ✨
