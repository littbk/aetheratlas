import { mkdir, copyFile, cp } from 'node:fs/promises';
import { build } from 'esbuild';
await mkdir('public', { recursive: true });
for (const name of ['index.html', 'style.css', 'viewer.css', 'ads.js', 'ads-config.js']) await copyFile(name, `public/${name}`);
await cp('renderer', 'public/renderer', { recursive: true });
await build({ entryPoints: ['app.js'], bundle: true, outfile: 'public/app.js', format: 'esm', target: ['es2022'], minify: true });
console.log('Visualizador 3D compilado em public/.');
