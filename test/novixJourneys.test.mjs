import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

const require = createRequire(new URL('../web/package.json', import.meta.url))
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { createServer } = await import(pathToFileURL(require.resolve('vite')).href)
const server = await createServer({ configFile: false,
  root: fileURLToPath(new URL('../web', import.meta.url)),
  resolve: { alias: { '~': fileURLToPath(new URL('../web/app', import.meta.url)) } },
  server: { middlewareMode: true, watch: null, ws: false }, logLevel: 'silent' })
let model, views, api, chartDates, chartPoint
try {
  model = await server.ssrLoadModule('/app/pages/Project/tabs/Journeys/novix/model.ts')
  views = await server.ssrLoadModule('/app/pages/Project/tabs/Journeys/novix/PathViews.tsx')
  api = await server.ssrLoadModule('/app/pages/Project/tabs/Journeys/novix/api.ts')
  chartDates = await server.ssrLoadModule('/app/utils/chartDate.ts')
  chartPoint = await server.ssrLoadModule('/app/pages/Project/View/utils/chartPoint.ts')
} finally { await server.close() }
const l = model.labelsFor('zh')

test('human-readable route labels preserve the canonical path for tooltips', () => {
  const html = renderToStaticMarkup(React.createElement(views.PathLabel, { path: ['/chat', '/search-v1/:sessionId'], labels: l }))
  assert.match(html, /研究工作台/)
  assert.match(html, /研究会话详情/)
  assert.match(html, /title="\/search-v1\/:sessionId"/)
  assert.equal(model.routeLabel('/search-v1/:sessionId', model.labelsFor('en')), 'Research session details')
})

test('path ranking uses the entire population denominator rather than the top paths', () => {
  const report = { totalSessions: 10, paths: [{ path: ['/chat'], sessions: 2, users: 1, continued: 0, uncertainEnd: 0 }] }
  const html = renderToStaticMarkup(React.createElement(views.PathsTable, { report, labels: l, onSelect() {}, selected: [] }))
  assert.match(html, /20\.0%/)
  assert.ok(!html.includes('100.0%'))
})

test('per-user conversion remains visit based when one user returns several times', () => {
  const report = { steps: [
    { step: 1, route: '/chat', sessions: 6, users: 1, continued: 4, matchedNext: 4, ended: 1, unknown: 1 },
    { step: 2, route: '/deepsurvey', sessions: 4, users: 1, continued: 0, matchedNext: 0, ended: 4, unknown: 0 },
  ] }
  const html = renderToStaticMarkup(React.createElement(views.ConversionTable, { report, labels: l }))
  assert.match(html, /66\.7%/)
  assert.ok(!html.includes('100.0%'))
})

test('flow diagrams keep backtracks, single-page visits and unknown endings without cycles', () => {
  const graph = model.flowData([
    { path: ['/chat', '/deepsurvey', '/chat'], sessions: 4, continued: 1, uncertainEnd: 1 },
    { path: ['/chat'], sessions: 2, continued: 0, uncertainEnd: 0 },
  ], l)
  assert.equal(graph.links.find(x => x.source === '1:/deepsurvey' && x.target === '2:/chat').value, 4)
  assert.equal(graph.links.find(x => x.source === '0:/chat' && x.target === '1:__end__').value, 2)
  assert.equal(graph.links.filter(x => x.source === '2:/chat').reduce((sum, x) => sum + x.value, 0), 4)
  assert.ok(graph.links.every(x => Number(x.target.split(':')[0]) > Number(x.source.split(':')[0])))
})

test('selected paths reject corrupt links and preserve valid canonical sequences', () => {
  for (const value of ['null', '{}', '[]', '[42]', '["not/a/path"]', 'broken']) assert.deepEqual(model.readSelectedPath(value), [])
  assert.deepEqual(model.readSelectedPath('["/chat","/deepsurvey","/chat"]'), ['/chat', '/deepsurvey', '/chat'])
})

test('view switching retains original chart/table links and explicit new-view choices', () => {
  const params = new URLSearchParams({ view: 'table', journeyProfile: 'usr_novix-user-42' })
  assert.equal(model.readJourneyView(params), 'original')
  params.set('view', 'chart')
  assert.equal(model.readJourneyView(params), 'original')
  for (const view of ['list', 'flow', 'conversion', 'original']) {
    params.set('journeyView', view)
    assert.equal(model.readJourneyView(params), view)
  }
  assert.equal(model.readJourneyView(new URLSearchParams()), 'list')
  assert.equal(model.readJourneyView(new URLSearchParams({ journeyView: 'unknown' })), 'list')
})

test('journeys use effective native date filters, exact custom bounds and an independent user scope', () => {
  const searchParams = new URLSearchParams({ period: '12M', timezone: 'UTC', filters: 'ignored', journeyProfile: 'usr_novix-user-42', from: '2026-11-01T00:00:00Z', to: '2026-11-02T23:59:59Z' })
  const query = api.journeyQuery({ searchParams, period: 'custom', timeBucket: 'hour', timezone: 'Asia/Shanghai' })
  assert.equal(query.get('period'), 'custom')
  assert.equal(query.get('timezone'), 'Asia/Shanghai')
  assert.equal(query.get('from'), searchParams.get('from'))
  assert.equal(query.get('to'), searchParams.get('to'))
  assert.equal(query.get('profile'), 'usr_novix-user-42')
  assert.equal(query.has('filters'), false)
})

test('long journey date filters preserve the requested 24 months without silently shortening them', () => {
  const query = api.journeyQuery({ searchParams: new URLSearchParams(), period: '24M', timeBucket: 'month', timezone: 'Asia/Shanghai' })
  assert.equal(query.get('period'), '24M')
  assert.equal(query.get('timeBucket'), 'month')
  assert.equal(query.get('timezone'), 'Asia/Shanghai')
})

test('chart dates localize months, weekdays and 12-hour periods without changing date values or other locales', () => {
  const date = new Date(2026, 10, 3, 22, 0)
  const stamp = date.getTime()
  const en = chartDates.chartTimeFormatter('en')
  const zh = chartDates.chartTimeFormatter('zh')
  assert.equal(zh('%d %b %H:%M')(date), '11月3日 22:00')
  assert.equal(zh('%d %b %I %p')(date), '11月3日 下午10时')
  assert.equal(zh('%a, %d %b')(date), '11月3日 周二')
  assert.equal(zh('%b %Y')(date), '2026年11月')
  assert.equal(en('%d %b %H:%M')(date), '03 Nov 22:00')
  assert.match(chartDates.chartTimeFormatter('fr')('%d %b')(date), /nov/)
  assert.equal(chartDates.chartTimeFormatter('en')('%a, %d %b')(date), 'Tue, 03 Nov')
  assert.equal(date.getTime(), stamp)
})

test('localized drilldown dates preserve timezone and DST query bounds', () => {
  const options = { x: new Date(2026, 10, 1, 12), xValue: '2026-11-01 12:00:00', timeBucket: 'day', timezone: 'America/New_York', timeFormat: '24-hour' }
  const en = chartPoint.getChartPointWindow({ ...options, language: 'en' })
  const zh = chartPoint.getChartPointWindow({ ...options, language: 'zh' })
  assert.equal(en.from, zh.from)
  assert.equal(en.to, zh.to)
  assert.equal(zh.from, '2026-11-01T04:00:00.000Z')
  assert.equal(zh.to, '2026-11-02T04:59:59.999Z')
  assert.match(zh.label, /2026年11月1日/)
  assert.match(en.label, /Nov/)
})
