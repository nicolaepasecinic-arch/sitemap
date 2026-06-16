# Setup Sitemap Builder

Instrucțiuni pas cu pas pentru a configura Sitemap Builder în proiectul tău React.

## 🚀 Setup Rapid (5 minute)

### Opțiunea 1: Create React App

```bash
# Creează proiect nou
npx create-react-app sitemap-builder
cd sitemap-builder

# Instalează dependențe
npm install lucide-react
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Copiază fișierele din outputs:
# - SitemapBuilder.jsx → src/components/
# - App.jsx → src/
# - README.md → (root)
# - example-sitemap.json → public/

# Start
npm start
```

### Opțiunea 2: Vite + React

```bash
# Creează proiect
npm create vite@latest sitemap-builder -- --template react
cd sitemap-builder

# Instalează dependențe
npm install
npm install lucide-react
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Copiază fișierele (vezi mai jos)

# Start
npm run dev
```

---

## ⚙️ Configurare detaliată

### 1. Instalează Tailwind CSS

#### Step 1: Instalează packete
```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

#### Step 2: Configurează `tailwind.config.js`
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

#### Step 3: Adaugă Tailwind directives în `src/index.css`
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

#### Step 4: Importă CSS în `src/main.jsx`
```javascript
import './index.css'
import App from './App.jsx'
import React from 'react'
import ReactDOM from 'react-dom/client'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

### 2. Instalează icoane

```bash
npm install lucide-react
```

### 3. Structura folderelor

```
project-root/
├── src/
│   ├── components/
│   │   └── SitemapBuilder.jsx
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── public/
│   └── example-sitemap.json
├── tailwind.config.js
├── postcss.config.js
├── package.json
└── vite.config.js (sau similar)
```

### 4. Verifica instalare

```bash
npm run dev
```

Deschide browser-ul la `http://localhost:5173` (Vite) sau `http://localhost:3000` (CRA)

---

## 📦 package.json Exemplu

```json
{
  "name": "sitemap-builder",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "lucide-react": "^0.288.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.37",
    "@types/react-dom": "^18.2.15",
    "@vitejs/plugin-react": "^4.1.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.31",
    "tailwindcss": "^3.3.5",
    "vite": "^5.0.2"
  }
}
```

---

## 🎯 Integrare în proiect existent

Dacă ai deja un proiect React cu Tailwind CSS:

### 1. Copiază SitemapBuilder.jsx
```bash
cp outputs/SitemapBuilder.jsx src/components/
```

### 2. Importă în aplicația ta
```javascript
// src/App.jsx
import SitemapBuilder from './components/SitemapBuilder';

export default function App() {
  return (
    <div className="app">
      <SitemapBuilder />
    </div>
  );
}
```

### 3. Gata! 🎉
Componenta e funcțională și gata de folosit.

---

## 🔧 Troubleshooting

### "Module not found: lucide-react"
```bash
npm install lucide-react
```

### "Tailwind CSS not working"
- Verifica că `tailwind.config.js` e configurat corect
- Verifica că `index.css` are directivele `@tailwind`
- Restart dev server: `npm run dev`

### "Port 5173 already in use"
```bash
npm run dev -- --port 3001
```

### "Dată din localStorage se pierde"
- LocalStorage se salvează automat
- Curăță cache browser: Ctrl+Shift+Delete
- Verifica Privacy Settings

### Drag-and-drop nu merge
- Asigură-te că ai versiunea latest a Tailwind
- Verifica browser console pentru erori
- Încearcă cu alt browser

---

## 📱 Build pentru producție

```bash
# Build
npm run build

# Preview build
npm run preview

# Deploy
# Copiază folder-ul dist la hosting-ul tău
```

---

## 🌐 Deploy Online

### Vercel (Recomand)
```bash
npm install -g vercel
vercel
```

### Netlify
```bash
npm install -g netlify-cli
netlify deploy
```

### GitHub Pages
```bash
npm run build
# Copiază dist/ pe gh-pages branch
```

---

## 📚 Resurse utile

- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Lucide React Icons](https://lucide.dev/)
- [React Docs](https://react.dev/)
- [Vite Docs](https://vitejs.dev/)

---

## ✨ Ai nevoie de ajutor?

Dacă ceva nu merge:
1. Verifică consola browser (F12)
2. Verifica NPM errors
3. Încearcă `npm install` din nou
4. Clear node_modules: `rm -rf node_modules && npm install`

Gata! 🚀
