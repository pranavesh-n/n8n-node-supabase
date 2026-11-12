const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const uploadedPngPath = 'C:/Users/Pranavesh/.gemini/antigravity-cli/brain/1c3f1e3c-9bae-43d0-af81-ca4eb04a7467/.user_uploaded/uploaded_media_1794502192325.png';

if (!fs.existsSync(uploadedPngPath)) {
  console.error(`Uploaded PNG not found at: ${uploadedPngPath}`);
  process.exit(1);
}

const pngBuffer = fs.readFileSync(uploadedPngPath);
const base64Png = pngBuffer.toString('base64');
const dataUri = `data:image/png;base64,${base64Png}`;

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 256 256" width="256" height="256">
  <image width="256" height="256" href="${dataUri}" xlink:href="${dataUri}"/>
</svg>`;

const iconLocations = [
  'nodes/SupabaseChatMemory/supabase.svg',
  'nodes/SupabaseChatMemory/supabase.dark.svg',
  'credentials/supabase.svg',
  'credentials/supabase.dark.svg',
];

const pngLocations = [
  'nodes/SupabaseChatMemory/supabase.png',
  'nodes/SupabaseChatMemory/supabase.dark.png',
  'credentials/supabase.png',
  'credentials/supabase.dark.png',
];

// Write SVGs
for (const rel of iconLocations) {
  const dest = path.join(root, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, svgContent, 'utf8');

  const distDest = path.join(root, 'dist', rel);
  if (fs.existsSync(path.dirname(distDest))) {
    fs.writeFileSync(distDest, svgContent, 'utf8');
  }
}

// Write PNGs
for (const rel of pngLocations) {
  const dest = path.join(root, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(uploadedPngPath, dest);

  const distDest = path.join(root, 'dist', rel);
  if (fs.existsSync(path.dirname(distDest))) {
    fs.copyFileSync(uploadedPngPath, distDest);
  }
}

console.log('Successfully generated custom logo icons (SVG & PNG).');
