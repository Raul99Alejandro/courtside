import { readFileSync, readdirSync } from 'node:fs';
import { it, expect } from 'vitest';
it('src/core imports only from src/core', () => {
  const dir = new URL('../src/core/', import.meta.url);
  for (const f of readdirSync(dir).filter(f => f.endsWith('.ts'))) {
    const imports = [...readFileSync(new URL(f, dir), 'utf8').matchAll(/from\s+'([^']+)'/g)].map(m => m[1]);
    for (const i of imports) expect(i, `${f} imports ${i}`).toMatch(/^\.\/[\w-]+\.js$/);
  }
});
