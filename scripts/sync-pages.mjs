import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..');
const html=await readFile(resolve(root,'dist/index.html'),'utf8');
if(!html.includes('./assets/') || html.includes('main.tsx')) throw new Error('Build the production app before publishing.');
// Only this generated directory is managed by this script.
await rm(resolve(root,'assets'),{recursive:true,force:true});
await mkdir(resolve(root,'assets'),{recursive:true});
await cp(resolve(root,'dist/assets'),resolve(root,'assets'),{recursive:true});
await writeFile(resolve(root,'index.html'),html);
await writeFile(resolve(root,'.nojekyll'),'');
console.log('Compiled Pages snapshot updated: index.html, assets/, .nojekyll');
