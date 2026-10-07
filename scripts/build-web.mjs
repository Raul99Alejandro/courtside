// Builds the whole site into dist-web/: the landing and phone pages (vite), then the TV app (Expo web export) under /tv/.
// The Expo app.json sets experiments.baseUrl to /tv, so the export is served from that path.
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const run = (cmd, cwd = root) => execSync(cmd, { cwd, stdio: 'inherit', env: process.env });

run('npx vite build web --outDir ../dist-web --emptyOutDir');
run('npx expo export --platform web --output-dir ../../../dist-web/tv', fileURLToPath(new URL('../tv/apps/expo/', import.meta.url)));
