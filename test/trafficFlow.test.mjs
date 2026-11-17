import assert from 'node:assert/strict'
import { test } from 'node:test'
import { trafficFlowReport } from './fixtures/trafficFlow.mjs'
import { renderCase, validateTrafficFlow, trafficFlowQuery, lastDaysParams } from './trafficFlowHarness.mjs'

test('total flow starts at native UV, shows PV separately and reconciles 50/80 as 62.5%', async () => {
  const html = await renderCase(trafficFlowReport())
  assert.match(html, /100/)
  assert.match(html, /255/)
  assert.match(html, /\(UV\)/)
  assert.match(html, /\(PV\)/)
  assert.match(html, /62\.5%/)
  assert.match(html, /Focused Research/)
  assert.match(html, /Auto Pilot/)
  const buttons = [...html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').trim())
  assert.deepEqual(buttons, ['最近 7 天', '最近 14 天', '最近 30 天'])
  assert.match(html, /未记录到后续提交/)
  assert.match(html, /默认曝光不算主动选择/)
  assert.match(html, /psid 访客标识去重/)
  assert.match(html, /不能直接与本图 UV 比较/)
  assert.match(html, /其余配置尚未完整采集/)
  assert.doesNotMatch(html, /缺少本次行为事件的访客 · 其余配置/)
})

test('feature labels are supplied by project data rather than a hardcoded frontend list', async () => {
  const report = trafficFlowReport()
  report.labels.auto_pilot = 'Custom project feature'
  assert.match(await renderCase(report), /Custom project feature/)
})

test('invalid or overlapping tree counts are rejected instead of showing plausible totals', () => {
  for (const mutate of [
    r => {r.root.children[0].count++}, r => {r.root.count=-1}, r => {r.pv=50},
    r => {r.root.children[0].id=r.root.children[1].id}, r => {r.identity='user_id'},
    r => {delete r.collection}, r => {r.collection.firstPageviewAt='bad-date'},
  ]) {
    const r=trafficFlowReport();mutate(r);assert.throws(() => validateTrafficFlow(r))
  }
  assert.equal(validateTrafficFlow(trafficFlowReport()).root.count, 100)
})

test('a date change cannot show a previous range and errors do not become zero-valued reports', async () => {
  const loading = await renderCase(trafficFlowReport(), {}, '?tab=funnels&period=custom&from=2026-11-01&to=2026-11-05', '?tab=funnels&period=7d')
  assert.match(loading, /正在查询/)
  assert.doesNotMatch(loading, /Auto Pilot|62\.5%/)
  const error = await renderCase(undefined, {status:'error', error:true})
  assert.match(error, /查询失败/)
  assert.doesNotMatch(error, /\(UV\)/)
  assert.match(await renderCase(trafficFlowReport(), {status:'error',error:true}), /刷新失败/)
})

test('native date context is preserved while unrelated feature filters cannot alter the root', () => {
  const query = new URLSearchParams(trafficFlowQuery(new URLSearchParams('from=2026-11-01&to=2026-11-05&novixFunnel=deep_survey&novix_computeType=gpu&filters=country'), 'custom', 'day', 'Asia/Shanghai'))
  assert.deepEqual(Object.fromEntries(query), {period:'custom',timeBucket:'day',timezone:'Asia/Shanghai',from:'2026-11-01',to:'2026-11-05'})
})

test('7/14/30 day shortcuts use natural calendar days including DST transitions', () => {
  for (const days of [7,14,30]) {
    const range=lastDaysParams(new URLSearchParams('tab=funnels'),days,'Asia/Shanghai',Date.parse('2026-11-16T10:00:00Z'))
    assert.equal(range.get('to'),'2026-11-16T15:59:59.000Z')
    assert.equal((Date.parse(range.get('to'))+1000-Date.parse(range.get('from')))/86400000,days)
  }
  const dst=lastDaysParams(new URLSearchParams(),7,'America/New_York',Date.parse('2026-11-02T12:00:00Z'))
  assert.equal(dst.get('from'),'2026-10-27T04:00:00.000Z')
  assert.equal(dst.get('to'),'2026-11-03T04:59:59.000Z')
})
