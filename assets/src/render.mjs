// Renders each profile image (HTML) to assets/<name>.webp using headless Chrome.
// Usage: node assets/src/render.mjs
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SRC = dirname(fileURLToPath(import.meta.url));
const OUT = join(SRC, '..');
const IMAGES = { header: 390 };

const tmp = mkdtempSync(join(tmpdir(), 'profile-render-'));
const chrome = (...args) =>
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', ...args], {
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  }).toString();

for (const [name, height] of Object.entries(IMAGES)) {
  const png = join(tmp, `${name}.png`);
  chrome(
    `--screenshot=${png}`,
    `--window-size=1200,${height}`,
    '--force-device-scale-factor=2',
    '--default-background-color=00000000',
    `file://${join(SRC, `${name}.html`)}`,
  );

  // Chrome can't write WebP screenshots, so re-encode the PNG through a canvas.
  const converter = join(tmp, `${name}-convert.html`);
  writeFileSync(converter, `<img id="i" src="data:image/png;base64,${readFileSync(png).toString('base64')}">
<script>
  i.onload = () => {
    const c = Object.assign(document.createElement('canvas'), { width: i.naturalWidth, height: i.naturalHeight });
    c.getContext('2d').drawImage(i, 0, 0);
    document.body.innerHTML = '<pre id="out">' + c.toDataURL('image/webp', 0.92) + '</pre>';
  };
</script>`);
  const dom = chrome('--virtual-time-budget=5000', '--dump-dom', `file://${converter}`);
  const match = dom.match(/data:image\/webp;base64,([A-Za-z0-9+/=]+)/);
  if (!match) throw new Error(`WebP conversion failed for ${name}`);
  writeFileSync(join(OUT, `${name}.webp`), Buffer.from(match[1], 'base64'));
  console.log(`assets/${name}.webp`);
}
