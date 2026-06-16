# 🚀 Sitemap Builder - Ghid Complet Deployment

## Pasii Rapizi (Quick Start)

```bash
# 1. Instalează dependențele
npm install

# 2. Construiește pentru producție
npm run build

# 3. Deploy-ul depinde de platformă (vezi mai jos)
```

---

## 📋 CERINȚE

- **Node.js** 14+ (https://nodejs.org/)
- **npm** 6+ (vine cu Node.js)
- ~500MB spațiu liber pe disk

**Verifică instalarea:**
```bash
node --version
npm --version
```

---

## 🎯 OPȚIUNI DE DEPLOYMENT

### ✅ Opțiunea 1: Vercel (RECOMANDATĂ - Cea mai ușoară)

**Pro:**
- Gratuit cu limite generoase
- Deploy automat din Git
- Custom domain gratuit
- HTTPS automatic
- Performance excelent

**Pași:**

```bash
# 1. Instalează Vercel CLI
npm install -g vercel

# 2. Login în Vercel (se deschide browser)
vercel login

# 3. Deploy
vercel

# 4. DONE! URL-ul tău este gata
```

**Output exemplu:**
```
> vercel
? Set up and deploy "~/sitemap-builder"? [Y/n] Y
? Which scope? Nicolae Pasecin
? Link to existing project? [y/N] N
? Project name: sitemap-builder
? In which directory is your code? ./
> Creating project
> Uploading files...
✅ Production: https://sitemap-builder-n1c.vercel.app
```

---

### ✅ Opțiunea 2: Netlify (Alternativă foarte bună)

**Pro:**
- Interfață web user-friendly
- Deploy din Git automat
- Formulare contact built-in
- Redirects și rewrite rules

**Pași:**

```bash
# 1. Instalează Netlify CLI
npm install -g netlify-cli

# 2. Login
netlify login

# 3. Deploy
netlify deploy --prod --dir=build

# 4. Check status
netlify status
```

---

### ✅ Opțiunea 3: GitHub Pages (Gratuit, conectat la GitHub)

**Pro:**
- Gratuit pentru întotdeauna
- Integrat cu Git
- Custom domain suportă

**Pași:**

```bash
# 1. Instalează gh-pages
npm install --save-dev gh-pages

# 2. Adaugă la package.json (MAI JOS - dacă nu e deja)
# "homepage": "https://USERNAME.github.io/sitemap-builder"

# 3. Adaugă scripts în package.json:
# "deploy": "npm run build && gh-pages -d build"

# 4. Push pe GitHub (trebuie repo deja creat)
git add .
git commit -m "Initial commit"
git push

# 5. Deploy
npm run deploy
```

**Configurare package.json pentru GitHub Pages:**
```json
{
  "name": "sitemap-builder",
  "version": "0.1.0",
  "homepage": "https://nicolae.github.io/sitemap-builder",
  "private": true,
  ...
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "deploy": "npm run build && gh-pages -d build"
  }
}
```

---

### ✅ Opțiunea 4: Self-Hosted (Pe propriul server)

**Pro:**
- Control complet
- Fără dependență de alte platforme
- Potrivit pentru producție enterprise

**Server Linux/Ubuntu:**

```bash
# 1. Pe computerul tău:
npm run build

# 2. Copiază folderul 'build/' pe server:
scp -r build/* user@server.com:/var/www/sitemap-builder/

# 3. Pe server, configurează web server (Nginx):
cat > /etc/nginx/sites-available/sitemap-builder << 'EOF'
server {
    listen 80;
    server_name sitemap.example.com;
    root /var/www/sitemap-builder;
    
    location / {
        try_files $uri /index.html;
    }
}
EOF

# 4. Enable site
sudo ln -s /etc/nginx/sites-available/sitemap-builder /etc/nginx/sites-enabled/
sudo systemctl restart nginx

# 5. HTTPS (recomandă Let's Encrypt)
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d sitemap.example.com
```

**Docker (dacă ai Docker):**

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

```bash
# Build și run
docker build -t sitemap-builder .
docker run -p 80:80 sitemap-builder
```

---

### ✅ Opțiunea 5: Localhost (Development - Para teste)

```bash
# Ruleaza pe http://localhost:3000
npm start
```

---

## 🔧 CONFIGURĂRI IMPORTANTE

### Environment Variables (dacă sunt necesare)

Creează `.env.production`:
```
REACT_APP_API_URL=https://api.example.com
```

### Optimizare Performance

```bash
# Analizeaza bundle size
npm install --save-dev source-map-explorer
npm run build
npx source-map-explorer 'build/static/js/*.js'
```

---

## 📊 VERIFICĂRI ÎNAINTE DE DEPLOYMENT

```bash
# 1. Build SUCCESS
npm run build

# 2. Dimensiune folder
du -sh build/

# 3. Typescript/Lint check (opțional)
npm test -- --coverage
```

---

## 🐛 TROUBLESHOOTING

### Problema: "npm command not found"
```bash
# Reinstalează Node.js de la https://nodejs.org/
```

### Problema: "Build failed"
```bash
# Curăță node_modules
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Problema: "Port 3000 already in use" (la npm start)
```bash
# Foloseț alt port
PORT=3001 npm start
```

### Problema: "Module not found"
```bash
# Asigură-te că toate dependențele sunt instalate
npm install
# Verifică dacă sunt importuri greșite
npm test
```

---

## 📱 CUSTOM DOMAIN

După deploy pe orice platformă, poți lega propriul domeniu:

### Vercel
1. Settings → Domains
2. Adaugă domeniu
3. Actualizează DNS records (instrucțiuni din Vercel)

### Netlify
1. Domain settings → Custom domain
2. Adaugă domeniu
3. Setează nameservers

### GitHub Pages
1. Settings → Pages
2. Custom domain
3. Configurează DNS

---

## 🚀 DEPLOYMENT CHECKLIST

- [ ] Dependencies instalate (`npm install`)
- [ ] Build creează fișiere (`npm run build`)
- [ ] Folder `build/` contine `index.html`
- [ ] Nu sunt erori în console
- [ ] LocalStorage functionează (salvează sitemap-ul)
- [ ] Export-uri (JSON, XML, CSV) functionează
- [ ] Drag-and-drop functionează
- [ ] Responsive pe mobile
- [ ] HTTPS activat (dacă e necesar)

---

## 📞 SUPORT RAPID

| Problema | Soluție |
|----------|---------|
| Build lent | Normal! Prima data ia 2-5 min |
| npm error | `npm cache clean --force` |
| React nu se incarc | Check console (F12 → Console tab) |
| Drag-drop nu merge | Reincarca pagina (Ctrl+Shift+R) |
| Datele dispar | Check localStorage (F12 → Application) |

---

## 📚 RESURSE UTILE

- [React Docs](https://react.dev)
- [Vercel Docs](https://vercel.com/docs)
- [Netlify Docs](https://docs.netlify.com)
- [GitHub Pages](https://pages.github.com)

---

**Ales alege opțiunea care se potriveste cel mai bine! 🎉**

Dacă ai întrebări, sunt aici să te ajut! 👍
