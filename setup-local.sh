#!/bin/bash

###############################################################################
# SITEMAP BUILDER - LOCAL SETUP SCRIPT
# Rulează asta pe computerul tău ca să instalezi și să faci build
###############################################################################

set -e  # Exit pe orice eroare

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         SITEMAP BUILDER - LOCAL SETUP & BUILD                  ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Colors pentru output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# STEP 1: Verifică Node.js
echo -e "${YELLOW}📋 STEP 1: Verificare Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js nu e instalat!${NC}"
    echo "   Descarcă de la: https://nodejs.org/ (LTS version)"
    exit 1
fi

NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)

echo -e "${GREEN}✅ Node.js: $NODE_VERSION${NC}"
echo -e "${GREEN}✅ npm: $NPM_VERSION${NC}"
echo ""

# STEP 2: Navigare în director
echo -e "${YELLOW}📂 STEP 2: Pregătesc directorul...${NC}"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"
echo -e "${GREEN}✅ Working directory: $(pwd)${NC}"
echo ""

# STEP 3: Verifică package.json
echo -e "${YELLOW}📦 STEP 3: Verificare package.json...${NC}"
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ package.json nu găsit!${NC}"
    exit 1
fi
echo -e "${GREEN}✅ package.json găsit${NC}"
echo ""

# STEP 4: Clean install
echo -e "${YELLOW}🧹 STEP 4: Clean install (șterge cache-ul)...${NC}"
rm -rf node_modules package-lock.json
echo -e "${GREEN}✅ Curățire completă${NC}"
echo ""

# STEP 5: Instalează dependențe
echo -e "${YELLOW}⏳ STEP 5: Instalez dependențele (aceasta ia 2-5 minute)...${NC}"
echo "   React, Tailwind, lucide-react..."
npm install --legacy-peer-deps

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Eroare la instalare${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Dependențele instalate cu succes${NC}"
echo ""

# STEP 6: Verifică fișierele
echo -e "${YELLOW}🔍 STEP 6: Verificare fișiere...${NC}"
REQUIRED_FILES=("SitemapBuilder.jsx" "App.jsx" "index.js" "index.html" "package.json")
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $file${NC}"
    else
        echo -e "${RED}❌ $file MISSING!${NC}"
    fi
done
echo ""

# STEP 7: Build
echo -e "${YELLOW}🏗️  STEP 7: Building pentru producție...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Eroare la build${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Build completat cu succes${NC}"
echo ""

# STEP 8: Info final
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    ✅ SETUP COMPLET!                           ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}📁 Folderul 'build/' conține fișierele gata pentru deploy:${NC}"
du -sh build/
echo ""
ls -lh build/ | head -10
echo ""
echo -e "${YELLOW}🚀 OPȚIUNI DE DEPLOYMENT:${NC}"
echo ""
echo "1️⃣  VERCEL (Recomandată):"
echo "   npm install -g vercel"
echo "   vercel deploy"
echo ""
echo "2️⃣  NETLIFY:"
echo "   npm install -g netlify-cli"
echo "   netlify deploy --prod --dir=build"
echo ""
echo "3️⃣  GITHUB PAGES:"
echo "   npm run deploy"
echo ""
echo "4️⃣  SELF-HOSTED:"
echo "   Copiază folderul 'build/' pe server-ul tău"
echo ""
echo "5️⃣  TEST LOCAL:"
echo "   npm start"
echo "   (mergi pe http://localhost:3000)"
echo ""
echo -e "${YELLOW}📂 Structură:${NC}"
echo "   build/              - Fișiere gata pentru upload"
echo "   node_modules/       - Dependențe (nu trebuie pe server)"
echo "   src/ (opțional)     - Source files"
echo ""
echo -e "${GREEN}✨ Gata! Deploy-ul e ușor acum!${NC}"
echo ""
