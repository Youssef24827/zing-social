import { mkdir, readFile, writeFile } from 'node:fs/promises';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if(!url||!key)throw new Error('Supabase public environment variables are missing.');
await mkdir('dist',{recursive:true});let html=await readFile('index.html','utf8');
const tags=['<script>window.ZING_CONFIG={url:'+JSON.stringify(url)+',key:'+JSON.stringify(key)+'};</script>','<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>','<script src="/app.js" defer></script>'];
for(const tag of tags)if(!html.includes(tag.slice(0,35)))html=html.replace('</body>',tag+'</body>');
await writeFile('dist/index.html',html);await writeFile('dist/app.js',await readFile('app.js','utf8'));
