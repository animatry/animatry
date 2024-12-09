import typescript from "rollup-plugin-typescript2";
import terser from '@rollup/plugin-terser';
import dts from 'rollup-plugin-dts';
import del from 'rollup-plugin-delete';

export default [
  
  // UMD animatry
  {
    input: 'src/animatry/index.ts',
    output: [
      {
        file: `dist/animatry.js`,
        format: "umd",
        name: 'animatry',
      },
      {
        file: `dist/animatry.min.js`,
        format: "umd",
        name: 'animatry',
        sourcemap: true,
        plugins: [terser()],
      },
    ],
    plugins: [typescript()],
  },
  
  // UMD split-text
  {
    input: 'src/split-text/index.ts',
    output: [
      {
        file: `dist/split-text.js`,
        format: "umd",
        name: 'splitText',
      },
      {
        file: `dist/split-text.min.js`,
        format: "umd",
        name: 'splitText',
        sourcemap: true,
        plugins: [terser()],
      },
    ],
    plugins: [typescript()],
  },

  // ESM bundle (everything)
  {
    input: 'src/index.ts',
    output: [
      {
        file: `dist/animatry.esm.js`,
        format: "esm",
      }
    ],
    plugins: [typescript()],
  },

  // type definitions
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.d.ts",
      format: "es"
    },
    plugins: [
      dts(),
      del({ targets: 'dist/**/*.d.ts', exclude: 'dist/index.d.ts' }),
      del({ targets: 'dist/*/', runOnce: true })
    ]
  }
];
