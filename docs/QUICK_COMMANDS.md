# ⚡ QUICK COMMANDS - Sitemap Builder

## Development
```bash
npm install          # Instalează dependențele
npm start            # Ruleaza local pe http://localhost:3000
npm test             # Ruleaza testele
```

## Build & Deploy
```bash
npm run build        # Construiește pentru producție
```

---

## 🚀 DEPLOY INSTANT

### Vercel (Fastest)
```bash
npm install -g vercel
vercel login
vercel
```
✅ **DONE in 2 minute!**

### Netlify
```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod --dir=build
```

### GitHub Pages
```bash
npm install --save-dev gh-pages
# Editează package.json - adaugă: "homepage": "https://USERNAME.github.io/sitemap-builder"
# Adaugă în scripts: "deploy": "npm run build && gh-pages -d build"
npm run deploy
```

---

## 🔍 Verificări
```bash
node --version       # Verifică Node.js
npm --version        # Verifică npm
du -sh build/        # Dimensiune build
```

---

## 🆘 Troubleshooting
```bash
# Dacă ceva nu merge:
rm -rf node_modules package-lock.json
npm install
npm run build
```

---

**Alege orice opțiune și rulează comenzile!** 🎉
