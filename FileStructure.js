import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const files = [
  // Root configuration files
  '.gitignore',
  'eslint.config.js',
  'index.html',
  'package.json',
  'package-lock.json',
  'README.md',
  'tsconfig.json',
  'tsconfig.app.json',
  'tsconfig.node.json',
  'vite.config.ts',

  // Assets
  'src/assets/hero.png',
  'src/assets/react.svg',
  'src/assets/vite.svg',

  // UI Components
  'src/components/ui/Dropdown.tsx',
  'src/components/ui/IconButton.tsx',

  // Components
  'src/components/ActionBar.tsx',
  'src/components/CanvasSearch.tsx',
  'src/components/ContainerNode.tsx',
  'src/components/DashboardShell.tsx',
  'src/components/DetailsPanel.tsx',
  'src/components/FlatNode.tsx',
  'src/components/FlowCanvas.tsx',
  'src/components/Icon.tsx',
  'src/components/NavigationTree.tsx',
  'src/components/NodeListView.tsx',
  'src/components/SidePanel.tsx',
  'src/components/StatusBar.tsx',
  'src/components/TopHeader.tsx',
  'src/components/ViewpointCatalog.tsx',
  'src/components/ViewpointTabs.tsx',

  // Config & Data
  'src/config/viewConfig.ts',
  'src/data/mockData.ts',

  // Hooks & Styles
  'src/hooks/useResizablePanel.ts',
  'src/styles/reactflow-flat.css',
  'src/styles/tokens.css',

  // Main src files
  'src/App.tsx',
  'src/fields.ts',
  'src/FlowCanvas.tsx',
  'src/graph.ts',
  'src/index.css',
  'src/layout.ts',
  'src/main.tsx',
  'src/types.ts'
];

// Ensure public folder exists
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
  console.log('📁 Created folder: public/');
}

// Check and create files
files.forEach((relativePath) => {
  const fullPath = path.join(__dirname, relativePath);
  const dirName = path.dirname(fullPath);

  // Ensure directory exists
  if (!fs.existsSync(dirName)) {
    fs.mkdirSync(dirName, { recursive: true });
  }

  // Check if file exists; if not, create an empty one
  if (!fs.existsSync(fullPath)) {
    fs.writeFileSync(fullPath, '', 'utf8');
    console.log(`✅ Created: ${relativePath}`);
  } else {
    console.log(`⏩ Skipped (already exists): ${relativePath}`);
  }
});
