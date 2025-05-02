import path from 'path';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import alias from '@rollup/plugin-alias';
import terser from '@rollup/plugin-terser';
import typescript from 'rollup-plugin-typescript2';
import dts from 'rollup-plugin-dts';
import del from 'rollup-plugin-delete';

const modules = [
  'animatry',
  'core',
  'easing',
  'metrics',
  'path',
  'match-media',
  'scroll-observer',
  'scroll-smooth',
  'scroll-to',
  'split-text',
  'scale-text',
  'morph-path',
  'magnetic',
];
const barrel = 'index';
const allEntries = [...modules, barrel];

const kebabToCamel = str =>
  str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

const getInputPath = name =>
  path.join('src', name === barrel ? '' : name, 'index.ts');

const globalsMap = Object.fromEntries(
  modules.map(m => {
    const camel = kebabToCamel(m);
    return [`@${m}`, m === 'animatry' ? 'animatry' : camel];
  })
);

const isExternal = id =>
  ['react', 'react-dom'].includes(id) ||
  allEntries.some(name => id === `@${name}` || id.startsWith(`@${name}/`));

// Create aliases so @animatry → ./src/animatry
const aliasEntries = modules.map(name => ({
  find: `@${name}`,
  replacement: path.resolve(`./src/${name}`),
}));

const noDecl = {
  tsconfigOverride: {
    compilerOptions: {
      declaration: false,
      declarationMap: false
    }
  },
  clean: true
};

const rewriteFlatImports = {
  name: 'rewrite-flat-imports',
  generateBundle(_opts, bundle) {
    const pattern = new RegExp(`@(${modules.join('|')})`, 'g');
    for (const file of Object.values(bundle)) {
      if (file.type !== 'chunk') continue;
      file.code = file.code
        // @mod → ./mod.js
        .replace(pattern, (_, mod) => `./${kebabToCamel(mod)}.js`)
        // ./mod/mod.js → ./mod.js
        .replace(/\.\/([a-z0-9-]+)\/\1\.js/g, './$1.js')
        // ./mod/index.js → ./mod.js
        .replace(/\.\/([a-z0-9-]+)\/index\.js/g, './$1.js');
    }
  }
};

// ESM build: standard, without any rewrite plugin
const esmPlugins = [
  resolve(),
  alias({ entries: aliasEntries }),
  typescript({
    tsconfig: './tsconfig.json',
    ...noDecl
  }),
  rewriteFlatImports
];
const createEsmConfig = name => ({
  input: getInputPath(name),
  output: {
    file: `dist/esm/${kebabToCamel(name)}.js`,
    format: 'esm',
  },
  external: isExternal,
  plugins: esmPlugins,
});
const esmConfigs = allEntries.map(createEsmConfig);

// Virtual UMD entry to flatten exports for certain modules
const virtualUmdEntry = name => ({
  name: 'virtual-umd-entry',
  resolveId(source) {
    return source === '\0virtual-umd-entry' ? source : null;
  },
  load(id) {
    if (id !== '\0virtual-umd-entry') return null;
    const importPath = `./${getInputPath(name).replace(/\\/g, '/')}`;
    const exportName = kebabToCamel(name);
    return `
      import * as __mod from '${importPath}';
      // dynamically pick named export if it exists
      const __k = '${exportName}'.split('').reverse().reverse().join('');
      const __inst = __mod[__k] !== undefined
        ? __mod[__k]
        : __mod;
      if (typeof exports === 'object' && exports !== null) {
        Object.assign(exports, __inst);
      }
      export default __inst;
    `;
  },
});

// Base plugins for UMD bundles (excluding core/metrics)
const umdPluginsBase = [
  resolve(),
  alias({ entries: aliasEntries }),
  commonjs({ requireReturnsDefault: 'auto' }),
  typescript({
    tsconfig: './tsconfig.json',
    ...noDecl
  }),
  {
    name: 'rewrite-flat-imports',
    generateBundle(_opts, bundle) {
      const pattern = new RegExp(`@(${modules.join('|')})`, 'g');
      for (const file of Object.values(bundle)) {
        if (file.type !== 'chunk') continue;
        file.code = file.code
          // convert @mod → ./mod.js
          .replace(pattern, (_, mod) => `./${kebabToCamel(mod)}.js`)
          // collapse ./mod/mod.js → ./mod.js
          .replace(/\.\/([a-z0-9-]+)\/\1\.js/g, './$1.js')
          // collapse ./mod/index.js → ./mod.js
          .replace(/\.\/([a-z0-9-]+)\/index\.js/g, './$1.js')
          // collapse _mod.mod → _mod
          .replace(/\b_([A-Za-z_$][\w$]*)\.\1\b/g, '_$1');
      }
    },
  },
];

// Modules that get the virtual UMD wrapper
const wrapperModules = [
  'animatry',
  'easing',
  'scroll-observer',
  'scroll-smooth',
  'scroll-to',
  'split-text',
  'scale-text',
  'morph-path',
  'magnetic',
];

function createUmdConfig(name, minify = false) {
  if (!modules.includes(name)) return null;
  const camel = kebabToCamel(name);
  const filename = `dist/umd/${camel}${minify ? '.min' : ''}.js`;

  // Wrapper modules with default instances flattened
  if (wrapperModules.includes(name)) {
    return {
      input: '\0virtual-umd-entry',
      external: isExternal,
      plugins: [
        virtualUmdEntry(name),
        ...umdPluginsBase,
        ...(minify ? [terser()] : []),
      ],
      output: {
        file: filename,
        format: 'umd',
        name: name === 'animatry' ? 'animatry' : camel,
        globals: globalsMap,
        exports: 'default',
        sourcemap: minify || undefined,
      },
    };
  }

  // Core/metrics-like modules with only named exports
  return {
    input: getInputPath(name),
    external: [],
    plugins: [
      resolve(),
      alias({ entries: aliasEntries }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        ...noDecl
      }),
      ...(minify ? [terser()] : []),
    ],
    output: {
      file: filename,
      format: 'umd',
      name: camel,
      globals: globalsMap,
      exports: 'named',
      sourcemap: minify || undefined,
    },
  };
}

const umdConfigs = modules
  .flatMap(name => [createUmdConfig(name), createUmdConfig(name, true)])
  .filter(Boolean);

// Type declaration bundles
const createDtsConfig = name => ({
  input: getInputPath(name),
  output: {
    file: `dist/types/${kebabToCamel(name)}.d.ts`,
    format: 'es',
  },
  plugins: [
    alias({ entries: aliasEntries }),
    dts(),
    name === barrel && del({
      targets: [
        'dist/esm/*/',
        'dist/umd/*/'
      ],
      runOnce: true
    }),
    name === barrel && del({
      targets: [
        'dist/esm/index.d.ts',
        'dist/umd/index.d.ts'
      ]
    })
  ].filter(Boolean)
});
const dtsConfigs = allEntries.map(createDtsConfig);

export default [
  ...esmConfigs,
  ...umdConfigs,
  ...dtsConfigs,
];
