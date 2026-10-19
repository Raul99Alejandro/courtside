// Rewrites import sources at transform time, so the aliases hold under `react-native build-kepler`.
// The RN CLI merges its own resolver.resolveRequest (react-native -> kepler only) over the one in
// metro.config.js, which then never runs during the Vega build. Babel runs before resolution.
const path = require('path');
const ALIASES = require('./aliases');

const coreDir = path.resolve(__dirname, '../../../src/core');

function rewrite(source, filename) {
  // src/core is NodeNext TypeScript (imports './x.js' for x.ts): drop the .js so Metro finds x.ts.
  if (filename && filename.startsWith(coreDir) && source.startsWith('.') && source.endsWith('.js')) {
    return source.slice(0, -3);
  }
  // react-native itself is left to the CLI's platform resolver.
  for (const [from, to] of Object.entries(ALIASES)) {
    if (from === 'react-native') continue;
    if (source === from) return to;
    if (source.startsWith(from + '/')) return to + source.slice(from.length);
  }
  return source;
}

module.exports = function aliasesPlugin({ types: t }) {
  function fix(node, state) {
    if (!node || !t.isStringLiteral(node)) return;
    const next = rewrite(node.value, state.filename);
    if (next !== node.value) node.value = next;
  }
  return {
    name: 'courtside-vega-aliases',
    visitor: {
      ImportDeclaration(p, state) {
        fix(p.node.source, state);
      },
      ExportNamedDeclaration(p, state) {
        fix(p.node.source, state);
      },
      ExportAllDeclaration(p, state) {
        fix(p.node.source, state);
      },
      CallExpression(p, state) {
        const { callee, arguments: args } = p.node;
        if (t.isIdentifier(callee, { name: 'require' }) || t.isImport(callee)) fix(args[0], state);
      },
    },
  };
};
