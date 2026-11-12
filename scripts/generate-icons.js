const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const tempIconPath = path.join(root, 'temp_icon_256.png');

const targets = [
  'credentials/supabase.svg',
  'credentials/supabase.dark.svg',
  'nodes/SupabaseChatMemory/supabase.svg',
  'nodes/SupabaseChatMemory/supabase.dark.svg',
];

let pngBytes = null;
let svgContent = null;

for (const relPath of targets) {
  const fullPath = path.join(root, relPath);
  const pngPath = fullPath.replace(/\.svg$/, '.png');

  // Preserve verified icons if they already exist
  if (fs.existsSync(fullPath) && fs.existsSync(pngPath)) {
    console.log(`Preserving verified icon: ${relPath}`);
  } else {
    if (!pngBytes && fs.existsSync(tempIconPath)) {
      pngBytes = fs.readFileSync(tempIconPath);
      const base64Data = pngBytes.toString('base64');
      svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <title>Supabase</title>
  <image href="data:image/png;base64,${base64Data}" width="256" height="256" />
</svg>
`;
    }

    if (svgContent && pngBytes) {
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, svgContent, 'utf8');
      fs.writeFileSync(pngPath, pngBytes);
      console.log(`Generated icon: ${relPath}`);
    }
  }

  // Ensure copied to dist/ if dist destination folder exists
  const distSvg = path.join(root, 'dist', relPath);
  const distPng = distSvg.replace(/\.svg$/, '.png');
  const distDir = path.dirname(distSvg);

  if (fs.existsSync(distDir)) {
    if (fs.existsSync(fullPath)) {
      fs.copyFileSync(fullPath, distSvg);
    }
    if (fs.existsSync(pngPath)) {
      fs.copyFileSync(pngPath, distPng);
    }
  }
}

console.log('Icon preservation and verification check complete.');
