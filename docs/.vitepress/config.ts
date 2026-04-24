import { defineConfig } from 'vitepress';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  title: 'labelwriter',
  description: 'TypeScript driver for Dymo LabelWriter label printers — USB, TCP, WebUSB',
  base: '/labelwriter/',
  ignoreDeadLinks: [
    /^\.\/LICENSE$/,
    /^\.\/(core|node|web)\/dist\/README$/,
  ],
  themeConfig: {
    nav: [
      { text: 'Get started', link: '/getting-started' },
      { text: 'Node.js', link: '/node' },
      { text: 'Web', link: '/web' },
      { text: 'Hardware', link: '/hardware' },
      { text: 'Core', link: '/core' },
    ],
    sidebar: [
      { text: 'Getting Started', link: '/getting-started' },
      { text: 'Node.js', link: '/node' },
      { text: 'Web', link: '/web' },
      { text: 'Hardware', link: '/hardware' },
      { text: 'Core', link: '/core' },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/thermal-label/labelwriter' }],
    search: { provider: 'local' },
  },
  vite: {
    resolve: {
      alias: {
        '@thermal-label/labelwriter-web': fileURLToPath(
          new URL('../../packages/web/src/index.ts', import.meta.url),
        ),
        '@thermal-label/labelwriter-core': fileURLToPath(
          new URL('../../packages/core/src/index.ts', import.meta.url),
        ),
      },
    },
  },
});
