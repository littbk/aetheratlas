import { mkdir, copyFile, cp, rm } from 'node:fs/promises';
import { build } from 'esbuild';
await mkdir('public', { recursive: true });
await rm('public/style.css', { force: true });
for (const name of ['index.html', 'viewer.css', 'ui.js', 'ads.js', 'ads-config.js']) await copyFile(name, `public/${name}`);
await cp('renderer', 'public/renderer', { recursive: true });
await build({ entryPoints: ['app.js'], bundle: true, outfile: 'public/app.js', format: 'esm', target: ['es2022'], minify: true });
console.log('Visualizador 3D compilado em public/.');
