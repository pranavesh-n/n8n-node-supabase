const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');

// 0. Generate icons from source image
require('./generate-icons.js');

// 1. Ensure dist target directories exist
const distCredDir = path.join(root, 'dist', 'credentials');
const distNodeDir = path.join(root, 'dist', 'nodes', 'SupabaseChatMemory');
fs.mkdirSync(distCredDir, { recursive: true });
fs.mkdirSync(distNodeDir, { recursive: true });

// 2. Copy verified icons to dist/credentials/ and dist/nodes/SupabaseChatMemory/
const iconFiles = [
  'supabase-chat-memory.svg',
  'supabase-chat-memory.dark.svg',
  'supabase-chat-memory.png',
  'supabase-chat-memory.dark.png',
  'supabase.svg',
  'supabase.dark.svg',
  'supabase.png',
  'supabase.dark.png',
];

for (const icon of iconFiles) {
  const credSrc = path.join(root, 'credentials', icon);
  const credDest = path.join(distCredDir, icon);
  if (fs.existsSync(credSrc)) {
    fs.copyFileSync(credSrc, credDest);
    console.log(`Copied icon: credentials/${icon} -> dist/credentials/${icon}`);
  }

  const nodeSrc = path.join(root, 'nodes', 'SupabaseChatMemory', icon);
  const nodeDest = path.join(distNodeDir, icon);
  if (fs.existsSync(nodeSrc)) {
    fs.copyFileSync(nodeSrc, nodeDest);
    console.log(`Copied icon: nodes/SupabaseChatMemory/${icon} -> dist/nodes/SupabaseChatMemory/${icon}`);
  }
}

// 3. Copy SupabaseChatMemory.node.json
const nodeJsonSrc = path.join(root, 'nodes', 'SupabaseChatMemory', 'SupabaseChatMemory.node.json');
const nodeJsonDest = path.join(distNodeDir, 'SupabaseChatMemory.node.json');
if (fs.existsSync(nodeJsonSrc)) {
  fs.copyFileSync(nodeJsonSrc, nodeJsonDest);
  console.log('Copied SupabaseChatMemory.node.json to dist');
}

// 4. Run metadata generation if n8n-core generate-metadata is present
const n8nCoreMetadataBin = 'C:/Users/Pranavesh/AppData/Roaming/npm/node_modules/n8n/node_modules/n8n-core/bin/generate-metadata';
if (fs.existsSync(n8nCoreMetadataBin)) {
  try {
    console.log('Generating n8n metadata...');
    execSync(`node "${n8nCoreMetadataBin}"`, { cwd: root, stdio: 'inherit' });
  } catch (err) {
    console.warn('Metadata generation warning:', err.message);
  }
}

// 5. Fix icon URLs in dist/types/nodes.json and dist/types/credentials.json
// n8n editor evaluates: p = e => /^(https?:)?\/\//.test(e) ? e : baseUrl + e
// When iconUrl starts with leading slash ('/icons/...'), baseUrl ('/') + e results in '//icons/...'
// which the browser interprets as a protocol-relative domain request (http://icons/...), causing failure.
// Removing the leading slash ('icons/...') results in '/icons/...' which properly resolves on localhost:5678.
const stripLeadingSlash = (p) => {
  if (typeof p !== 'string') return p;
  return p.replace(/^\/+/, '');
};

const fixIconsInJson = (filePath) => {
  if (!fs.existsSync(filePath)) return;
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const fixObj = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      if (obj.iconUrl) {
        if (typeof obj.iconUrl === 'string') {
          obj.iconUrl = stripLeadingSlash(obj.iconUrl);
        } else if (typeof obj.iconUrl === 'object') {
          if (typeof obj.iconUrl.light === 'string') {
            obj.iconUrl.light = stripLeadingSlash(obj.iconUrl.light);
          }
          if (typeof obj.iconUrl.dark === 'string') {
            obj.iconUrl.dark = stripLeadingSlash(obj.iconUrl.dark);
          }
        }
      }
    };

    if (Array.isArray(data)) {
      data.forEach(fixObj);
    } else {
      fixObj(data);
    }

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`Normalized icon URLs in ${path.relative(root, filePath)}`);
  } catch (err) {
    console.warn(`Could not update ${filePath}:`, err.message);
  }
};

fixIconsInJson(path.join(root, 'dist/types/nodes.json'));
fixIconsInJson(path.join(root, 'dist/types/credentials.json'));

console.log('Postbuild completed successfully.');
