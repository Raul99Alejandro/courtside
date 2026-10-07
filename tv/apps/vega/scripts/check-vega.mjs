// Static check for apps/vega, runnable on any OS (the Vega SDK itself is macOS/Ubuntu only).
//  1. Type-checks the entry (index.js -> src/App.tsx -> shared screens) with Vega's RN 0.72 types,
//     the @amazon-devices/* ports in place of the community packages, and *.kepler.ts preferred.
//  2. Resolves every import reachable from the entry; any unresolved import is an error.
//  3. Checks every bare package imported by shared/core is aliased or declared in apps/vega/package.json.
// Usage: yarn workspace @courtside/vega typecheck
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const vegaDir = path.resolve(here, '..');
const require = createRequire(path.join(vegaDir, 'package.json'));
const ts = require('typescript');
const aliases = require('./aliases.js');
const pkg = JSON.parse(fs.readFileSync(path.join(vegaDir, 'package.json'), 'utf8'));

const cfgPath = path.join(vegaDir, 'tsconfig.typecheck.json');
const cfg = ts.readConfigFile(cfgPath, ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, vegaDir);
const program = ts.createProgram({ rootNames: parsed.fileNames, options: { ...parsed.options, allowJs: true, checkJs: false } });

let failures = 0;
const diags = ts.getPreEmitDiagnostics(program);
for (const d of diags) {
  failures++;
  const { line, character } = d.file ? d.file.getLineAndCharacterOfPosition(d.start) : { line: 0, character: 0 };
  console.error(`${d.file ? path.relative(vegaDir, d.file.fileName) : ''}(${line + 1},${character + 1}): TS${d.code} ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`);
}

// 3. bare imports in our own sources
const own = program.getSourceFiles().filter((f) => !f.fileName.includes('node_modules') && !f.isDeclarationFile);
const declared = new Set([...Object.keys(pkg.dependencies), ...Object.keys(pkg.devDependencies)]);
const internal = new Set(['react-native', 'react', '@courtside/core', '@courtside/shared']);
const bare = new Map();
for (const f of own) {
  for (const imp of f.imports ?? []) {
    const spec = imp.text;
    if (spec.startsWith('.') || spec.startsWith('node:')) continue;
    const name = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
    if (!bare.has(name)) bare.set(name, path.relative(vegaDir, f.fileName));
  }
}
for (const [name, where] of bare) {
  if (internal.has(name) || aliases[name] || declared.has(name)) continue;
  failures++;
  console.error(`unmapped import "${name}" (first seen in ${where}): add it to apps/vega/package.json or aliases.js`);
}
for (const to of Object.values(aliases)) {
  if (!declared.has(to) && !fs.existsSync(path.join(vegaDir, 'node_modules', to))) {
    failures++;
    console.error(`alias target ${to} is not installed`);
  }
}

// 4. nothing may resolve outside apps/vega/node_modules (a stray hoisted or expo copy would hide a wrong alias)
const nm = path.join(vegaDir, 'node_modules') + path.sep;
const allowed = (name) => name.startsWith('@types/') || name.startsWith('@amazon-devices/') || declared.has(name);
for (const f of program.getSourceFiles()) {
  if (!f.fileName.includes('node_modules')) continue;
  const norm = path.normalize(f.fileName);
  if (!norm.startsWith(nm)) {
    failures++;
    console.error(`resolved outside apps/vega/node_modules: ${path.relative(vegaDir, norm)}`);
    continue;
  }
  const rest = norm.slice(nm.length).split(path.sep);
  const name = rest[0].startsWith('@') ? rest[0] + '/' + rest[1] : rest[0];
  if (!allowed(name) && !f.isDeclarationFile) { failures++; console.error(`unexpected package ${name}`); }
  else if (!allowed(name) && !/^(@types|typescript|csstype|metro|@react-native|react-native|@babel|@jest)/.test(name)) {
    // declaration files of transitive deps (e.g. csstype) are fine; log anything else
    console.warn(`note: transitive declaration from ${name}`);
  }
}

console.log(`vega check: ${own.length} own files, ${bare.size} bare packages, ${failures} problem(s)`);
process.exit(failures ? 1 : 0);
