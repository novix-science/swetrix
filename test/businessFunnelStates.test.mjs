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
      if (id === context) return `
        import { useSearchParams } from 'react-router';
        export const useViewProjectContext = () => {
          const [params] = useSearchParams();
          return { period: params.get('period') || '7d', timeBucket: params.get('timeBucket') || 'day', timezone: params.get('timezone') || 'UTC' };
        };
      `
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
          const client = new QueryClient({ defaultOptions: { queries: { retryOnMount: false } } });
          const params = new URLSearchParams(cachedSearch);
          const query = businessFunnelQuery({ searchParams: params, feature: params.get('novixFunnel') || 'deep_survey', period: params.get('period') || '7d', timeBucket: params.get('timeBucket') || 'day', timezone: params.get('timezone') || 'UTC' }).toString();
          const key = ['v2', 'project12345', 'funnel', 'novix-flow-v1', query];
          const cached = client.getQueryCache().build(client, { queryKey: key });
          if (data) client.setQueryData(key, data);
          cached.setState({ ...state, ...(state.error ? { error: new ReportError(503, 'request_failed') } : {}) });
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
const retentionTarget = html => {
  const href = html.match(/<a[^>]*href="([^"]*#novix-product-retention)"/)?.[1]
  assert.ok(href, 'overall retention links to its business panel')
  return new URL(href.replaceAll('&amp;', '&'), 'https://analytics.example/project/project12345')
}

test('the initial report load displays a loader before any funnel metrics exist', async () => {
  const html = await renderCase(undefined)
  assert.match(html, /Loading…/)
  assert.doesNotMatch(html, /987[,.]?654|<details\b/)
})

test('background refresh retains the current report and its expandable paths', async () => {
  const html = await renderCase(fixture(), { fetchStatus: 'fetching' })
  assert.match(html, /Updating…/)
  assert.match(html, /987,654/)
  assert.equal((html.match(/<details\b/g) || []).length, 6)
  assert.match(html, /Snapshot/)
  assert.doesNotMatch(html, /Loading…/)
})

test('a background error retains the current report and offers a retry', async () => {
  const html = await renderCase(fixture(), { status: 'error', error: true })
  assert.match(html, /role="alert"/)
  assert.match(html, /Refresh failed/)
  assert.match(html, /Retry/)
  assert.match(html, /987,654/)
  assert.equal((html.match(/<details\b/g) || []).length, 6)
  assert.match(html, /Snapshot/)
})

test('a failed initial load offers a retry without displaying metrics', async () => {
  const html = await renderCase(undefined, { status: 'error', error: true })
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

test('changing feature or dates cannot display metrics cached under the prior query', async () => {
  for (const search of [
    '?novixFunnel=idea_spark',
    '?novixFunnel=deep_survey&from=2026-11-01&to=2026-11-03',
  ]) {
    const html = await renderCase(fixture(), {}, search, '?novixFunnel=deep_survey')
    assert.match(html, /Loading…/)
    assert.doesNotMatch(html, /987[,.]?654|<details\b/)
  }
})

test('the overall retention entry keeps the date and visible funnel filters across features', async () => {
  const html = await renderCase(undefined, {}, '?tab=funnels&novixFunnel=deep_survey&period=custom&from=2026-11-01&to=2026-11-03&novix_computeType=gpu&novix_internalTraffic=external&novix_feature=idea_spark&novix_mode=deep&novix_version=v2&novix_source=old')
  const target = retentionTarget(html)
  assert.equal(target.searchParams.get('tab'), 'novixBusiness')
  assert.equal(target.searchParams.get('novix_feature'), 'all')
  assert.equal(target.searchParams.get('period'), 'custom')
  assert.equal(target.searchParams.get('from'), '2026-11-01')
  assert.equal(target.searchParams.get('to'), '2026-11-03')
  assert.equal(target.searchParams.get('novix_computeType'), 'gpu')
  assert.equal(target.searchParams.get('novix_internalTraffic'), 'external')
  for (const key of ['novix_mode', 'novix_version', 'novix_source', 'novixFunnel']) assert.equal(target.searchParams.has(key), false)
  assert.match(html, /Overall first-use retention/)
  assert.match(html, /Compute and account filters apply/)
})

test('overall retention resets unsupported native periods to four weeks before leaving Funnels', async () => {
  for (const period of ['12M', '24M']) {
    const html = await renderCase(undefined, {}, `?tab=funnels&period=${period}&from=2024-01-01&to=2026-11-01&novix_computeType=gpu&novix_internalTraffic=external`)
    const target = retentionTarget(html)
    assert.equal(target.searchParams.get('period'), '4w')
    assert.equal(target.searchParams.has('from'), false)
    assert.equal(target.searchParams.has('to'), false)
    assert.equal(target.searchParams.get('novix_computeType'), 'gpu')
    assert.equal(target.searchParams.get('novix_internalTraffic'), 'external')
  }
})

test('overall retention preserves custom ranges through 93 calendar days and resets longer ranges', async () => {
  for (const [from, to, timezone, expected, timeBucket = 'day'] of [
    ['2026-01-01', '2026-04-03', 'UTC', 'custom'],
    ['2026-01-01T00:00:00.000Z', '2026-04-03T23:59:59.999Z', 'UTC', 'custom'],
    ['2026-08-01T04:00:00.000Z', '2026-11-02T04:59:59.999Z', 'America/New_York', 'custom'],
    ['2026-01-01', '2026-04-04', 'UTC', '4w'],
    ['2026-01-01T23:30:00.000Z', '2026-04-04T00:30:00.000Z', 'UTC', '4w'],
    ['2026-01-01T00:00:00.000Z', '2026-04-04T23:59:59.999Z', 'UTC', '4w'],
    ['2026-01-01', '2026-04-03', 'Asia/Shanghai', '4w'],
    ['2026-01-15', '2026-04-01', 'UTC', '4w', 'month'],
    ['2026-01-01', '2026-03-31', 'UTC', 'custom', 'month'],
    ['2026-01-15', '2026-01-15', 'Asia/Shanghai', 'custom', 'month'],
  ]) {
    const search = new URLSearchParams({ tab: 'funnels', period: 'custom', from, to, timezone, timeBucket, novix_computeType: 'cpu', novix_internalTraffic: 'all' })
    const target = retentionTarget(await renderCase(undefined, {}, `?${search}`))
    assert.equal(target.searchParams.get('period'), expected, `${from} – ${to} in ${timezone}`)
    assert.equal(target.searchParams.get('from'), expected === 'custom' ? from : null)
    assert.equal(target.searchParams.get('to'), expected === 'custom' ? to : null)
    assert.equal(target.searchParams.get('novix_computeType'), 'cpu')
    assert.equal(target.searchParams.get('novix_internalTraffic'), 'all')
    assert.equal(target.searchParams.get('timezone'), timezone)
  }
})

test('a successful current report exposes six paths and a snapshot', async () => {
  const html = await renderCase(fixture())
  assert.equal((html.match(/<details\b/g) || []).length, 6)
  assert.match(html, /987,654/)
  assert.match(html, /Snapshot/)
  assert.doesNotMatch(html, /Loading…|role="alert"/)
})
