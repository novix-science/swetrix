import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

const require = createRequire(new URL('../web/package.json', import.meta.url))
const { createServer } = await import(pathToFileURL(require.resolve('vite')).href)
const harness = '\0novix-funnel-access-harness'
const server = await createServer({
  configFile: false,
  root: fileURLToPath(new URL('../web', import.meta.url)),
  resolve: { alias: { '~': fileURLToPath(new URL('../web/app', import.meta.url)) } },
  server: { middlewareMode: true, watch: null, ws: false },
  logLevel: 'silent',
  plugins: [{
    name: 'funnel-access-render-harness',
    resolveId(id) { if (id === 'virtual:funnel-access-render') return harness },
    load(id) {
      if (id !== harness) return
      return `
        import React from 'react';
        import { renderToStaticMarkup } from 'react-dom/server';
        import { createInstance } from 'i18next';
        import { I18nextProvider } from 'react-i18next';
        import { MemoryRouter } from 'react-router';
        import Action from '~/pages/Project/tabs/Funnels/FunnelEmptyStateAction';
        export async function renderCase(language, messages, props) {
          const i18n = createInstance();
          await i18n.init({ lng: language, fallbackLng: 'en', resources: { [language]: { common: messages } } });
          return renderToStaticMarkup(React.createElement(I18nextProvider, { i18n },
            React.createElement(MemoryRouter, null, React.createElement(Action, { onCreate() {}, ...props }))));
        }
      `
    },
  }],
})
let renderCase
try {
  renderCase = (await server.ssrLoadModule('virtual:funnel-access-render')).renderCase
} finally {
  await server.close()
}

async function render(language, props) {
  const messages = JSON.parse(await readFile(new URL(`../web/public/locales/${language}.json`, import.meta.url), 'utf8'))
  const markup = await renderCase(language, messages, props)
  return { markup, messages }
}

test('a signed-in viewer receives the actual read-only explanation, not registration or creation', async () => {
  for (const language of ['en', 'zh']) {
    const { markup, messages } = await render(language, { isAuthenticated: true, allowedToManage: false, selfHosted: true })
    assert.ok(markup.includes(messages.dashboard.funnelsReadOnly))
    assert.doesNotMatch(markup, /href=|<button/)
  }
})

test('self-hosted owners and managers can create a funnel without a cloud signup link', async () => {
  const { markup, messages } = await render('zh', { isAuthenticated: true, allowedToManage: true, selfHosted: true })
  assert.ok(markup.includes(messages.dashboard.newFunnel))
  assert.match(markup, /<button/)
  assert.doesNotMatch(markup, /href=/)
})

test('anonymous self-hosted viewers sign in locally in their selected language', async () => {
  for (const language of ['en', 'zh']) {
    const { markup } = await render(language, { isAuthenticated: false, allowedToManage: false, selfHosted: true })
    assert.match(markup, new RegExp(`href="${language === 'zh' ? '/zh' : ''}/login"`))
    assert.doesNotMatch(markup, /\/signup/)
  }
})

test('the anonymous cloud signup entry is preserved', async () => {
  const { markup } = await render('en', { isAuthenticated: false, allowedToManage: false, selfHosted: false })
  assert.match(markup, /href="\/signup"/)
})
