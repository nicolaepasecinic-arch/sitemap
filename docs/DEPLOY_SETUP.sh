#!/bin/bash

# Sitemap Builder - Deploy Setup Script
# Acest script instalează dependențele și pregătește aplicația pentru deployment

echo "🚀 Sitemap Builder - Setup & Deploy"
echo "===================================="

# Verifică dacă Node.js e instalat
if ! command -v node &> /dev/null; then
    echo "❌ Node.js nu e instalat. Instalează-l de la https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js versiune: $(node --version)"
echo "✅ npm versiune: $(npm --version)"

# Instalează dependențele
echo ""
echo "📦 Instalez dependențele..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependențele au fost instalate cu succes!"
else
    echo "❌ Eroare la instalare"
    exit 1
fi

echo ""
echo "🏗️  Construiesc proiectul pentru producție..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build completed successfully!"
    echo ""
    echo "📁 Folderul 'build/' conține fișierele ready pentru deployment"
    echo ""
    echo "🚀 OPȚIUNI DE DEPLOYMENT:"
    echo "   1. Vercel: vercel deploy"
    echo "   2. Netlify: netlify deploy --prod"
    echo "   3. GitHub Pages: gh-pages -d build"
    echo "   4. Self-hosted: Copiază build/ pe server-ul tău"
    echo ""
    echo "📊 INFO BUILD:"
    ls -lh build/
else
    echo "❌ Eroare la build"
    exit 1
fi
