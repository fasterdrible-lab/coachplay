import { cpSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, 'dist', 'renderer');

mkdirSync(outDir, { recursive: true });
cpSync(join(root, 'src', 'renderer', 'index.html'), join(outDir, 'index.html'));
cpSync(join(root, 'src', 'renderer', 'styles.css'), join(outDir, 'styles.css'));

console.log('Static renderer assets copied to dist/renderer/');
