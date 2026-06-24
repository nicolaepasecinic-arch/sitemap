#!/usr/bin/env bash
# Pornește un tunel HTTPS public către backend-ul local (port 4000) ca să poți
# conecta MCP-ul "Qoders Map" la Claude Desktop.
#
# Folosire:  ./connect-claude.sh
# Apoi: ia URL-ul afișat, adaugă /mcp?token=TOKENUL_TAU și pune-l în
#       Claude Desktop → Settings → Connectors → Add custom connector.

set -e

PORT="${PORT:-4000}"

# 1) Verifică backend-ul
if ! curl -sf "http://localhost:${PORT}/api/health" >/dev/null 2>&1; then
  echo "⚠️  Backend-ul nu răspunde pe http://localhost:${PORT}"
  echo "    Pornește-l întâi:  cd backend && npm run dev"
  echo ""
fi

# 2) Instalează cloudflared dacă lipsește (fără Homebrew — binar direct)
if ! command -v cloudflared >/dev/null 2>&1; then
  echo "📦 cloudflared lipsește. Îl descarc (o singură dată)..."
  if command -v brew >/dev/null 2>&1; then
    brew install cloudflared
  else
    ARCH="$(uname -m)"
    if [ "$ARCH" = "arm64" ]; then
      ASSET="cloudflared-darwin-arm64.tgz"
    else
      ASSET="cloudflared-darwin-amd64.tgz"
    fi
    TMP="$(mktemp -d)"
    echo "   Descarc ${ASSET}..."
    curl -L --fail --output "${TMP}/cf.tgz" \
      "https://github.com/cloudflare/cloudflared/releases/latest/download/${ASSET}"
    tar -xzf "${TMP}/cf.tgz" -C "${TMP}"
    mkdir -p "${HOME}/.local/bin"
    mv "${TMP}/cloudflared" "${HOME}/.local/bin/cloudflared"
    chmod +x "${HOME}/.local/bin/cloudflared"
    export PATH="${HOME}/.local/bin:${PATH}"
    rm -rf "${TMP}"
    echo "   ✅ Instalat în ~/.local/bin/cloudflared"
  fi
fi

echo ""
echo "🚀 Pornesc tunelul HTTPS către localhost:${PORT}"
echo "   Caută linia  https://....trycloudflare.com  mai jos."
echo "   URL-ul pt. Claude =  <acel-url>/mcp?token=TOKENUL_TAU"
echo "   (Tokenul îl iei din aplicație → butonul «Connect to AI».)"
echo ""

# 3) Tunel quick (fără cont, certificat public valid)
cloudflared tunnel --url "http://localhost:${PORT}"
