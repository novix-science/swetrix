import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { operationalReport } from './fixtures/operationalFlows.mjs'

const require = createRequire(new URL('../web/package.json', import.meta.url))
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { createServer } = await import(pathToFileURL(require.resolve('vite')).href)
const server = await createServer({
  configFile: false,
  root: fileURLToPath(new URL('../web', import.meta.url)),
  resolve: { alias: { '~': fileURLToPath(new URL('../web/app', import.meta.url)) } },
  server: { middlewareMode: true, watch: null, ws: false },
  logLevel: 'silent',
})
let OperationalFlowFunnels
try {
  OperationalFlowFunnels = (await server.ssrLoadModule('/app/pages/Project/tabs/Funnels/OperationalFlowFunnels.tsx')).default
} finally {
  await server.close()
}
const render = async (report, feature = 'deep_survey', language = 'en') => {
  assert.equal(typeof OperationalFlowFunnels, 'function')
  const labels = JSON.parse(await readFile(new URL(`../web/app/pages/Project/tabs/Business/${language}.json`, import.meta.url), 'utf8'))
  return renderToStaticMarkup(React.createElement(OperationalFlowFunnels, { report, feature, labels, language }))
}

test('operational cards render human definitions, units and missing-record explanations in both languages', async () => {
  const report = operationalReport()
  const path = report.operationalFunnels.paths[0]
  path.availability = 'partial'
  path.coverage.missingEvents = ['feature_interacted.input_started']
  for (const step of path.steps.slice(1)) Object.assign(step, { count: null, fromPrevious: null, fromFirst: null, availability: 'unavailable' })
  for (const [language, heading, input, missing, unit] of [
    ['en', 'Operational document funnels', 'Started typing', 'Historical counts cannot be reconstructed', 'Visits'],
    ['zh', '运营文档漏斗', '开始输入', '历史数量无法还原', '访问次数'],
  ]) {
    const html = await render(report, 'deep_survey', language)
    assert.equal((html.match(/<details\b/g) || []).length, 3)
    for (const text of [heading, input, missing, unit]) assert.ok(html.includes(text), text)
    assert.match(html, /<td[^>]*>—<\/td>/)
    assert.doesNotMatch(html, /flowStep_|op_draft|Outcome distribution|结果状态分布|Observed exit destinations|已观测离开去向/)
  }
})

test('Auto distribution divides by confirmed operations and keeps unresolved submissions separate', async () => {
  const html = await render(operationalReport())
  assert.match(html, /50%/)
  assert.match(html, /37\.5%/)
  assert.match(html, /12\.5%/)
  assert.match(html, /Share of Auto operations with a confirmed mode/)
  assert.match(html, /Unconfirmed or unlinked/)
  assert.match(html, /Attributable Auto operations/)
  assert.doesNotMatch(html, /40%|30%|10%/)
})

test('Auto summaries label excluded submission records separately from deduplicated operations', async () => {
  for (const [language, operations, records, explanation] of [
    ['en', '(Operations)', '(Records)', 'reliable deduplication'],
    ['zh', '(操作次数)', '(记录数)', '无法可靠去重'],
  ]) {
    const html = await render(operationalReport(), 'deep_survey', language)
    for (const text of [operations, records, explanation]) assert.ok(html.includes(text), text)
  }
})

test('Auto percentages remain undefined for zero, partial or unavailable collection', async () => {
  for (const availability of ['available', 'partial', 'unavailable']) {
    const report = operationalReport()
    report.autoRouting.availability = availability
    if (availability === 'available') Object.assign(report.autoRouting, { totalSubmitted: 0, accepted: 0, unresolved: 0, resolved: { task: 0, discuss: 0, deep: 0 } })
    if (availability === 'unavailable') Object.assign(report.autoRouting, { totalSubmitted: null, accepted: null, unresolved: null, resolved: { task: null, discuss: null, deep: null } })
    const html = await render(report)
    assert.doesNotMatch(html, /\d+(?:\.\d+)?%/)
    assert.match(html, /<td[^>]*>—<\/td>/)
  }
})

test('an older backend explicitly marks the new sections unavailable while leaving the current report usable', async () => {
  const html = await render({})
  assert.match(html, /Operational document funnels/)
  assert.match(html, /The data service has not supplied these operational paths/)
  assert.match(html, /Auto mode distribution/)
  assert.match(html, /Auto routing data is unavailable/)
  assert.doesNotMatch(html, /<details\b|\d+(?:\.\d+)?%/)
})

test('Auto-Discovery exposes fourteen independent operational paths without scientific routing metrics', async () => {
  for (const language of ['en', 'zh']) {
    const html = await render(operationalReport('auto_discovery'), 'auto_discovery', language)
    assert.equal((html.match(/<details\b/g) || []).length, 14)
    assert.doesNotMatch(html, /Auto mode distribution|Auto 模式分流|flowStep_|op_roam/)
  }
})
