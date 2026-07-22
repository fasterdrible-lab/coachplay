import { cpSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, 'dist');

mkdirSync(dist, { recursive: true });
cpSync(join(root, 'manifest.json'), join(dist, 'manifest.json'));
cpSync(join(root, 'src', 'popup', 'popup.html'), join(dist, 'popup.html'));
cpSync(join(root, 'src', 'popup', 'popup.css'), join(dist, 'popup.css'));

console.log('manifest.json e assets do popup copiados para dist/');
