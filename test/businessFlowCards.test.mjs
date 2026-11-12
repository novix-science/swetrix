import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { flowPath } from './fixtures/businessFlows.mjs'

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
let BusinessFlowFunnels
try {
  BusinessFlowFunnels = (await server.ssrLoadModule('/app/pages/Project/tabs/Funnels/BusinessFlowFunnels.tsx')).default
} finally {
  await server.close()
}
const labelsFor = async language => JSON.parse(await readFile(new URL(`../web/app/pages/Project/tabs/Business/${language}.json`, import.meta.url), 'utf8'))
const path = (id = 'task') => {
  const item = flowPath('deep_survey', id)
  item.availability = 'partial'
  item.pending = true
  item.coverage = { missingEvents: ['deep_checklist_ready'], excluded: 3 }
  item.steps[0] = { id: 'home', count: 20, fromPrevious: null, fromFirst: 1, availability: 'available' }
  item.steps[1] = { id: 'entry', count: 5, fromPrevious: .25, fromFirst: .25, availability: 'available' }
  item.steps[item.steps.length - 1] = { id: 'result', count: null, fromPrevious: null, fromFirst: null, availability: 'unavailable' }
  return item
}
const render = (paths, labels, language = 'en') => renderToStaticMarkup(React.createElement(BusinessFlowFunnels, { paths, labels, language }))

test('each research path has an independently expandable funnel with its own title and unit', async () => {
  const labels = await labelsFor('en')
  const html = render(['task', 'discuss', 'loop', 'auto_task', 'auto_discuss', 'auto_loop'].map(path), labels)
  assert.equal((html.match(/<details\b/g) || []).length, 6)
  assert.equal((html.match(/<summary\b/g) || []).length, 6)
  for (const text of ['Task', 'Discuss', 'Loop', 'Auto → Task', 'Auto → Discuss', 'Auto → Loop', 'Visits']) assert.ok(html.includes(text), text)
  assert.ok(html.includes(labels.flowWindow_7x24h))
})

test('step coverage keeps unknown counts and rates distinct from collected zero conversion', async () => {
  const labels = await labelsFor('en')
  const item = path()
  item.steps[2] = { id: 'submit', count: 0, fromPrevious: 0, fromFirst: 0, availability: 'available' }
  const html = render([item], labels)
  assert.match(html, /25%/)
  assert.match(html, /<td[^>]*>0<\/td>/)
  assert.match(html, /<td[^>]*>0%<\/td>/)
  assert.match(html, /<td[^>]*>Unknown<\/td>/)
  assert.ok(html.includes(labels.metric_unavailable))
  assert.ok(html.includes(labels.pending))
  assert.ok(html.includes('deep_checklist_ready'))
  assert.ok(html.includes(labels.flowExcluded))
})

test('pending funnels label positive ratios as observed conversions and explain unknown pending stages', async () => {
  const item = path()
  item.steps[item.steps.length - 1] = { id: 'result', count: 1, fromPrevious: .2, fromFirst: .05, availability: 'available' }
  for (const [language, fromFirst, fromPrevious, growth, unknown] of [
    ['en', 'Observed conversion from entry', 'Observed conversion from previous', 'may increase within the observation window', 'Pending stages with no observations remain unknown'],
    ['zh', '已观察转化（入口）', '已观察转化（相邻阶段）', '观察窗口内仍可增长', '尚无观测的待观察阶段显示未知'],
  ]) {
    const labels = await labelsFor(language)
    const html = render([item], labels, language)
    assert.ok(html.split('</summary>')[0].includes(fromFirst), fromFirst)
    assert.match(html, new RegExp(`${fromPrevious}</th>`))
    assert.ok(html.includes(growth), growth)
    assert.ok(html.includes(unknown), unknown)
    assert.match(html, /25%/)
    assert.match(html, /5%/)
    assert.ok(html.includes(labels.pending))
    assert.match(html, new RegExp(`<td[^>]*>${labels.unknown}</td>`))
  }
})

test('Not Now displays the proposal skip path and Chinese collection labels', async () => {
  const labels = await labelsFor('zh')
  const item = { ...path(), id: 'auto_discovery.proposal_skip', featureId: 'auto_discovery', labelKey: 'flow_proposal_skip', unit: 'proposals' }
  item.steps = [
    { id: 'proposal', count: 2, fromPrevious: null, fromFirst: 1, availability: 'available' },
    { id: 'not_now', count: 1, fromPrevious: .5, fromFirst: .5, availability: 'available' },
    { id: 'skipped', count: null, fromPrevious: null, fromFirst: null, availability: 'unavailable' },
  ]
  const html = render([item], labels, 'zh')
  for (const text of ['跳过提案卡片', '查看提案卡片', '点击 Not Now', '跳过成功', '提案数', '缺少采集的事件', '未知']) assert.ok(html.includes(text), text)
  assert.doesNotMatch(html, /再次批准|尚未开放|flowStep_|flowUnit_/)
})

test('unavailable steps never expose supplied stale counts or conversion rates', async () => {
  const labels = await labelsFor('en')
  const item = path()
  item.steps[item.steps.length - 1] = { id: 'result', count: 987654, fromPrevious: .987654, fromFirst: .987654, availability: 'unavailable' }
  const html = render([item], labels)
  assert.doesNotMatch(html, /987[,.]?654|98\.7654/)
})

test('Task acceptance and confirmed Loop execution use their actual lifecycle labels', async () => {
  const labels = await labelsFor('en')
  const task = path()
  const loop = path('auto_loop')
  assert.match(render([task], labels), /Execution accepted<\/th>/)
  assert.match(render([loop], labels), /Execution started<\/th>/)
})

test('feature arrival labels cover default and direct-route visits in both languages', async () => {
  for (const [language, expected] of [['en', 'Feature reached'], ['zh', '功能访问']]) {
    const labels = await labelsFor(language)
    assert.ok(render([path()], labels, language).includes(expected))
  }
})

test('funnel bars use actual counts and leave unknown or undefined proportions unplotted', async () => {
  const labels = await labelsFor('en')
  const item = path()
  item.steps[1].fromFirst = .9
  const html = render([item], labels)
  assert.equal((html.match(/<meter\b/g) || []).length, item.steps.length - 1)
  assert.match(html, /max="20" value="5"/)
  assert.match(html, /style="width:25%"/)
  assert.doesNotMatch(html, /<meter[^>]*aria-label="Result viewed"/)
  item.steps[0].count = null
  assert.doesNotMatch(render([item], labels), /<meter\b/)
  item.steps[0].count = 0
  assert.doesNotMatch(render([item], labels), /<meter\b/)
})

test('outcomes preserve overlapping counts and use each path counting unit', async () => {
  const item = path()
  item.outcomes = { failed: 2, cancelled: 3, timedOut: 4, blocked: 5, unconfirmed: 6, decisionFailed: 7 }
  for (const language of ['en', 'zh']) {
    const labels = await labelsFor(language)
    const html = render([item], labels, language)
    for (const [status, expected] of [['failed', 2], ['cancelled', 3], ['timedOut', 4], ['blocked', 5], ['unconfirmed', 6], ['decisionFailed', 7]]) {
      assert.match(html, new RegExp(`${labels[`flowOutcome_${status}`]}</th><td[^>]*>${expected}</td>`))
    }
    assert.ok(html.includes(labels.flowOutcomesOverlap))
    assert.ok(html.includes(`<caption class="sr-only">${labels.flowOutcomes} · ${labels.flowUnit_visits}</caption>`))
    const proposal = { ...item, ...flowPath('auto_discovery', 'proposal_skip'), outcomes: item.outcomes }
    assert.ok(render([proposal], labels, language).includes(`<caption class="sr-only">${labels.flowOutcomes} · ${labels.flowUnit_proposals}</caption>`))
  }
})

test('exit destinations remain escaped route text and empty observations remain explicit', async () => {
  const labels = await labelsFor('en')
  const item = path()
  item.exits = [{ route: '/search-v1/:sessionId?<script>alert(1)</script>', count: 2 }]
  const html = render([item], labels)
  assert.ok(html.includes(labels.flowExits))
  assert.ok(html.includes('/search-v1/:sessionId?&lt;script&gt;alert(1)&lt;/script&gt;'))
  assert.doesNotMatch(html, /<script|<a\b|href=/)
  assert.match(html, /<td[^>]*>2<\/td>/)
  const empty = render([path()], labels)
  assert.ok(empty.includes(labels.flowNoObservedExits))
})

test('unavailable paths keep outcome distributions and exit destinations unknown', async () => {
  const labels = await labelsFor('en')
  const item = path()
  item.availability = 'unavailable'
  item.outcomes.failed = 987654
  item.exits = [{ route: '/account', count: 987654 }]
  const html = render([item], labels)
  const outcomeHtml = html.split(`<section aria-label="${labels.flowOutcomes}">`)[1].split('</section>')[0]
  const exitHtml = html.split(`<section aria-label="${labels.flowExits}">`)[1].split('</section>')[0]
  assert.equal((outcomeHtml.match(/<td[^>]*>Unknown<\/td>/g) || []).length, 6)
  assert.doesNotMatch(outcomeHtml, /987[,.]?654|<td[^>]*>0<\/td>/)
  assert.ok(exitHtml.includes(labels.unknown))
  assert.ok(!exitHtml.includes(labels.flowNoObservedExits))
  assert.doesNotMatch(exitHtml, /\/account|987[,.]?654/)
})

test('proposal approval and running handoff show distinct outcomes in both languages', async () => {
  const discoveryPath = (id, steps) => ({
    ...path(), id: `auto_discovery.${id}`, featureId: 'auto_discovery', labelKey: `flow_${id}`, unit: 'proposals',
    steps: steps.map(id => ({ id, count: 1, fromPrevious: 1, fromFirst: 1, availability: 'available' })),
  })
  const approval = discoveryPath('proposal_approval', ['proposal', 'go_ahead', 'approved'])
  const handoff = discoveryPath('running_handoff', ['go_ahead', 'execution', 'running'])
  for (const [language, approved, clicked, accepted, running] of [
    ['en', 'Approval successful', 'Go Ahead clicked', 'Task accepted', 'Running project opened'],
    ['zh', '批准成功', '点击 Go Ahead', '任务受理', '打开 Running 项目'],
  ]) {
    const labels = await labelsFor(language)
    const approvalHtml = render([approval], labels, language)
    const handoffHtml = render([handoff], labels, language)
    assert.ok(approvalHtml.includes(approved), approved)
    assert.ok(approvalHtml.includes(clicked), clicked)
    assert.ok(handoffHtml.includes(clicked), clicked)
    assert.ok(handoffHtml.includes(accepted), accepted)
    assert.ok(handoffHtml.includes(running), running)
    assert.ok(!handoffHtml.includes(approved))
    assert.ok(!approvalHtml.includes(running))
  }
})

test('a compute-inapplicable skip path explains its unavailable counts in both languages', async () => {
  const item = {
    ...path(), id: 'auto_discovery.proposal_skip', featureId: 'auto_discovery', labelKey: 'flow_proposal_skip', unit: 'proposals', availability: 'unavailable',
    coverage: { missingEvents: [], excluded: 0, limitations: ['compute_not_applicable'] },
    steps: ['proposal', 'not_now', 'skipped'].map(id => ({ id, count: null, fromPrevious: null, fromFirst: null, availability: 'unavailable' })),
  }
  for (const [language, explanation] of [
    ['en', 'Skipping a card uses no execution resources. CPU/GPU filters do not apply to this path.'],
    ['zh', '跳过卡片不涉及执行资源，此路径不适用 CPU/GPU 筛选'],
  ]) {
    const labels = await labelsFor(language)
    const html = render([item], labels, language)
    assert.ok(html.includes(explanation), explanation)
    assert.ok(html.includes(labels.unknown))
    const stepsHtml = html.slice(0, html.indexOf('</table>') + '</table>'.length)
    assert.doesNotMatch(stepsHtml, /<td[^>]*>0%?<\/td>/)
    assert.doesNotMatch(html, /再次批准|尚未开放/)
  }
})

test('missing resource associations receive a localized coverage explanation', async () => {
  const item = flowPath('auto_discovery', 'return_visit')
  item.availability = 'partial'
  item.coverage.limitations = ['resource_association_missing']
  for (const [language, explanation] of [
    ['en', 'Some projects lack associated execution resource records.'],
    ['zh', '部分项目缺少可关联的执行资源记录'],
  ]) {
    assert.ok(render([item], await labelsFor(language), language).includes(explanation))
  }
})
