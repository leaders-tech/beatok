import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, 'src');
const css = readFileSync(join(src, 'style.css'), 'utf8');
const js = readdirSync(src).filter(f => /^\d\d-.*\.js$/.test(f)).sort()
  .map(f => `// ---- ${f} ----\n` + readFileSync(join(src, f), 'utf8')).join('\n');
const tpl = readFileSync(join(src, 'index.html'), 'utf8');
const html = tpl.replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => '{\n' + js + '\n}');
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist', 'index.html'), html);
console.log('dist/index.html', (html.length / 1024).toFixed(1) + ' KB');
