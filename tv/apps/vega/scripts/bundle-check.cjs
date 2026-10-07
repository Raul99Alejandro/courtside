// Builds the JS bundle with Metro for platform "kepler" (no device, no Vega SDK needed). Proves that every
// import, alias and *.kepler.ts file resolves the way metro will on the Mac. Usage: node scripts/bundle-check.cjs
const Metro = require('metro');
const path = require('path');
const fs = require('fs');
(async () => {
  const cfg = await Metro.loadConfig({ config: path.join(__dirname, '../metro.config.js') });
  const out = path.join(require('os').tmpdir(), 'courtside-vega.bundle');
  const { code } = await Metro.runBuild(cfg, { entry: 'index.js', platform: 'kepler', dev: true, minify: false, out });
  const size = code ? code.length : fs.statSync(out).size;
  console.log(`vega bundle ok: ${(size / 1024).toFixed(0)} KB`);
  const has = (s) => (code || fs.readFileSync(out, 'utf8')).includes(s);
  for (const probe of ['RemoteControlManager.kepler', '@amazon-devices/react-navigation__native', '@amazon-devices/react-native-svg']) {
    console.log(`  contains ${probe}: ${has(probe)}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
