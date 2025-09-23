// Copies Leaflet icon images from node_modules into src/assets/leaflet
// Run automatically via postinstall
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'node_modules', 'leaflet', 'dist', 'images');
const destDir = path.join(__dirname, '..', 'src', 'assets', 'leaflet');

const files = ['marker-icon.png', 'marker-icon-2x.png', 'marker-shadow.png'];

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

files.forEach(f => {
  const from = path.join(srcDir, f);
  const to = path.join(destDir, f);
  try {
    if (fs.existsSync(from)) {
      fs.copyFileSync(from, to);
      console.log('[copy-leaflet-icons] Copied', f);
    } else {
      console.warn('[copy-leaflet-icons] Source missing:', from);
    }
  } catch (e) {
    console.error('[copy-leaflet-icons] Error copying', f, e);
  }
});
