import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const output = resolve(root, "dist");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error("Vercel must provide NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
}

const html = await readFile(resolve(root, "index.html"), "utf8");
const sdkTag = '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>';
const configTag = `<script>window.ZING_CONFIG={url:${JSON.stringify(url)},key:${JSON.stringify(key)}};</script>`;
const appTag = '<script src="/app.js" defer></script>';
const additions = [];
if (!html.includes("window.ZING_CONFIG")) additions.push(configTag);
if (!html.includes(sdkTag)) additions.push(sdkTag);
if (!html.includes(appTag)) additions.push(appTag);
if (additions.length && !html.includes("</body>")) throw new Error("The closing body tag is missing from index.html.");
await mkdir(output, { recursive: true });
const builtHtml = additions.length
  ? html.replace("</body>", `${additions.map((tag) => `  ${tag}`).join("\n")}\n</body>`)
  : html;
await writeFile(resolve(output, "index.html"), builtHtml);
await writeFile(resolve(output, "app.js"), await readFile(resolve(root, "app.js"), "utf8"));
