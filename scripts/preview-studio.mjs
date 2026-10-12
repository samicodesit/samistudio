import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, join } from 'node:path';
import { studioFiles } from './build-studio.mjs';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const allowed = new Set(studioFiles);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain' };
const port = Number(process.argv[2] || 8090);
// Optional QA mode: an aggregate 1.6 Mbps link with 150 ms response latency.
// These flags affect only this localhost server, never the published site.
const slow = process.argv.includes('--slow');
const logging = process.argv.includes('--log');
const transfers = new Set();
if (slow) setInterval(() => {
  const active = [...transfers];
  const budget = Math.max(1, Math.floor(10000 / Math.max(1, active.length)));
  for (const transfer of active) {
    if (transfer.response.destroyed) { transfers.delete(transfer); continue; }
    const end = Math.min(transfer.offset + budget, transfer.bytes.length);
    transfer.response.write(transfer.bytes.subarray(transfer.offset, end));
    transfer.offset = end;
    if (end === transfer.bytes.length) { transfers.delete(transfer); transfer.response.end(); }
  }
}, 50).unref();
createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const name = pathname === '/' ? 'index.html' : pathname.slice(1);
    if (!allowed.has(name)) { response.writeHead(404).end('Not found'); return; }
    const bytes = await readFile(join(root, name));
    const started = Date.now();
    if (logging) response.on('finish', () => console.log(JSON.stringify({ file: name, bytes: bytes.length, ms: Date.now() - started })));
    response.writeHead(200, { 'Content-Type': types[extname(name)] || 'application/octet-stream',
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    if (slow) setTimeout(() => { if (!response.destroyed) transfers.add({ response, bytes, offset: 0 }); }, 150);
    else response.end(bytes);
  } catch { response.writeHead(404).end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Studio preview: http://localhost:${port}`));
