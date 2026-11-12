import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { flowReport } from './fixtures/businessFlows.mjs'

const require = createRequire(new URL('../web/package.json', import.meta.url))
const { createServer } = await import(pathToFileURL(require.resolve('vite')).href)
const harness = '\0business-funnel-states'
const context = '\0business-funnel-test-context'
const server = await createServer({
  configFile: false,
  root: fileURLToPath(new URL('../web', import.meta.url)),
  resolve: { alias: { '~': fileURLToPath(new URL('../web/app', import.meta.url)) } },
  server: { middlewareMode: true, watch: null, ws: false },
  logLevel: 'silent',
  plugins: [{
    name: 'business-funnel-state-harness',
    enforce: 'pre',
    resolveId(id) {
      if (id === 'virtual:business-funnel-states') return harness
      if (/\/View\/ViewProject(?:\.tsx)?$/.test(id)) return context
    },
    load(id) {
      if (id === context) return `export const useViewProjectContext = () => ({ period: '7d', timeBucket: 'day', timezone: 'UTC' });`
      if (id !== harness) return
      return `
        import React from 'react';
        import { renderToStaticMarkup } from 'react-dom/server';
        import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
        import { createInstance } from 'i18next';
        import { I18nextProvider } from 'react-i18next';
        import { MemoryRouter } from 'react-router';
        import Presets from '~/pages/Project/tabs/Funnels/BusinessFunnelPresets';
        import { ReportError } from '~/pages/Project/tabs/Business/report';
        import { businessFunnelQuery } from '~/utils/novixFunnels';
        export async function renderCase(data, state = {}, search = '?novixFunnel=deep_survey', cachedSearch = search) {
          const client = new QueryClient();
          const params = new URLSearchParams(cachedSearch);
          const query = businessFunnelQuery({ searchParams: params, feature: params.get('novixFunnel') || 'deep_survey', period: '7d', timeBucket: 'day', timezone: 'UTC' }).toString();
          const key = ['v2', 'project12345', 'funnel', 'novix-flow-v1', query];
          if (data) {
            client.setQueryData(key, data);
            client.getQueryCache().find({ queryKey: key }).setState({ ...state, ...(state.error ? { error: new ReportError(503, 'request_failed') } : {}) });
          }
          const i18n = createInstance();
          await i18n.init({ lng: 'en', resources: { en: { common: {} } } });
          const html = renderToStaticMarkup(React.createElement(I18nextProvider, { i18n },
            React.createElement(QueryClientProvider, { client },
              React.createElement(MemoryRouter, { initialEntries: [search] }, React.createElement(Presets, { projectId: 'project12345' })))));
          client.clear();
          return html;
        }
      `
    },
  }],
})
let renderCase
try {
  renderCase = (await server.ssrLoadModule('virtual:business-funnel-states')).renderCase
} finally {
  await server.close()
}
const fixture = () => {
  const report = flowReport()
  for (const path of report.flowFunnels.paths) {
    path.steps[0].count = 987654
    path.steps[path.steps.length - 1] = { id: 'result', count: 2468, fromPrevious: .25, fromFirst: .25, availability: 'available' }
  }
  return report
}

test('loading and background refresh show loading without cached funnel metrics', async () => {
  for (const [data, state] of [[undefined, {}], [fixture(), { fetchStatus: 'fetching' }]]) {
    const html = await renderCase(data, state)
    assert.match(html, /Loading…/)
    assert.doesNotMatch(html, /987[,.]?654|<details\b/)
  }
})

test('report errors hide old metrics and offer a retry', async () => {
  const html = await renderCase(fixture(), { status: 'error', error: true })
  assert.match(html, /role="alert"/)
  assert.match(html, /Retry/)
  assert.doesNotMatch(html, /987[,.]?654|<details\b/)
})

test('changing compute filters cannot display metrics cached under the prior filter', async () => {
  const html = await renderCase(fixture(), {}, '?novixFunnel=deep_survey&novix_computeType=gpu&novix_internalTraffic=external', '?novixFunnel=deep_survey')
  assert.match(html, /GPU/)
  assert.match(html, /External/)
  assert.match(html, /Loading…/)
  assert.doesNotMatch(html, /<details\b/)
})

test('a successful current report exposes six paths and a snapshot', async () => {
  const html = await renderCase(fixture())
  assert.equal((html.match(/<details\b/g) || []).length, 6)
  assert.match(html, /987,654/)
  assert.match(html, /Snapshot/)
  assert.doesNotMatch(html, /Loading…|role="alert"/)
})
