// Copy non-TypeScript runtime assets from src/ into dist/ after `tsc`.
// tsc only emits .js, so loose assets (e.g. styleguide-template.html) would otherwise
// be missing in the compiled output — and the Docker image ships ONLY dist/, so the
// style-guide template must live there or generation renders a blank page.
// Run automatically by `npm run build`.
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');
const distDir = path.join(__dirname, '..', 'dist');

// File extensions that tsc does NOT copy but the server reads at runtime.
const ASSET_EXTS = ['.html'];

function copyAssets(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const from = path.join(dir, entry.name);
    if (entry.isDirectory()) { copyAssets(from); continue; }
    if (!ASSET_EXTS.includes(path.extname(entry.name).toLowerCase())) continue;
    const rel = path.relative(srcDir, from);
    const to = path.join(distDir, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
    console.log('copied asset →', path.relative(process.cwd(), to));
  }
}

if (!fs.existsSync(srcDir)) { console.error('copy-assets: src/ not found'); process.exit(0); }
fs.mkdirSync(distDir, { recursive: true });
copyAssets(srcDir);
