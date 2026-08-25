import { readFile } from 'node:fs/promises'
import { defineConfig } from 'tsdown'
import packageJSON from './package.json' with { type: 'json' }

export default defineConfig({
  entry: {
    index: './src/index.ts',
  },

  format: 'es',
  outDir: './dist',
  tsconfig: './tsconfig.json',

  target: 'ES2020',
  minify: 'dce-only',

  plugins: [
    {
      name: 'raw-text-loader',
      async resolveId(source, importer) {
        if (!source.endsWith('?raw')) {
          return null
        }

        const resolved = await this.resolve(source.slice(0, -4), importer, {
          skipSelf: true,
        })

        return resolved ? `${resolved.id}?raw` : null
      },
      async load(id) {
        if (!id.endsWith('.txt?raw') && !id.endsWith('.md?raw')) {
          return null
        }

        const content = await readFile(id.slice(0, -4), 'utf8')
        return `export default ${JSON.stringify(content)}`
      },
    },
  ],

  treeshake: false,
  external: [/node:/gim, ...getExternal((packageJSON as any).dependencies)],
})

function getExternal(dependencies: unknown) {
  return Object.keys((dependencies ?? {}) as Record<string, string>).map(
    (dep) => new RegExp(`(^${dep}$)|(^${dep}/)`)
  )
}
