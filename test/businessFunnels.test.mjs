import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as funnels from '../web/app/utils/novixFunnels.ts'
import { flowReport } from './fixtures/businessFlows.mjs'
const { NOVIX_FUNNEL_PRESETS, businessFunnelQuery, getNovixFunnel, selectNovixFunnel } = funnels

test('presets cover the eight available primary features, with no coming-soon or deep-mode variant', () => {
  assert.deepEqual(NOVIX_FUNNEL_PRESETS.map(x => x.id), [
    'auto_discovery', 'auto_pilot', 'deep_survey', 'idea_spark', 'method_design', 'auto_experiment', 'data_analysis', 'reproduce_paper',
  ])
  assert.equal(getNovixFunnel(new URLSearchParams('novixFunnel=auto_pilot')).label, 'Auto Pilot')
  assert.equal(getNovixFunnel(new URLSearchParams('novixFunnel=draw_plot')), undefined)
})

test('selecting and collapsing a business funnel preserve the native date and separate it from saved funnels', () => {
  const input = new URLSearchParams('tab=funnels&period=custom&from=2026-11-01&to=2026-11-07&funnelId=saved&filters=country')
  const selected = selectNovixFunnel(input, 'deep_survey', 'custom')
  assert.equal(selected.get('funnelId'), null)
  assert.equal(selected.get('novixFunnel'), 'deep_survey')
  for (const key of ['period', 'from', 'to', 'filters']) assert.equal(selected.get(key), input.get(key))
  assert.equal(selectNovixFunnel(selected, 'deep_survey', 'custom').get('novixFunnel'), null)
  assert.equal(input.get('funnelId'), 'saved')
})

test('feature queries preserve compute and account filters with native dates while excluding unrelated filters', () => {
  const params = new URLSearchParams('tab=funnels&period=12M&funnelId=old&filters=private&novix_feature=idea_spark&novix_mode=deep&novix_computeType=gpu&novix_internalTraffic=all')
  params.set('from', '2026-11-01T00:00:00.000Z')
  params.set('to', '2026-11-07T23:59:59.999Z')
  const query = businessFunnelQuery({ searchParams: params, feature: 'auto_pilot', period: 'custom', timeBucket: 'hour', timezone: 'Asia/Shanghai' })
  assert.deepEqual(Object.fromEntries(query), {
    from: params.get('from'), to: params.get('to'), period: 'custom', timeBucket: 'hour', timezone: 'Asia/Shanghai', feature: 'auto_pilot', computeType: 'gpu', internalTraffic: 'all',
  })
})

test('funnel filter changes preserve dates, selected feature and native traffic state', () => {
  assert.equal(typeof funnels.updateFunnelFilter, 'function')
  const input = new URLSearchParams('novixFunnel=deep_survey&period=custom&from=2026-11-01&to=2026-11-07&filters=country&novix_internalTraffic=external')
  const filtered = funnels.updateFunnelFilter(input, 'computeType', 'cpu')
  assert.equal(filtered.get('novix_computeType'), 'cpu')
  for (const key of ['novixFunnel', 'period', 'from', 'to', 'filters', 'novix_internalTraffic']) assert.equal(filtered.get(key), input.get(key))
  assert.equal(funnels.updateFunnelFilter(filtered, 'computeType', 'all').has('novix_computeType'), false)
  assert.throws(() => funnels.updateFunnelFilter(input, 'computeType', 'unknown'))
  assert.throws(() => funnels.updateFunnelFilter(input, 'internalTraffic', 'private'))
})

test('flow path selection keeps every research and discovery branch independent', () => {
  assert.equal(typeof funnels.readFlowFunnels, 'function')
  assert.deepEqual(funnels.readFlowFunnels(flowReport(), 'deep_survey').map(item => item.id), [
    'deep_survey.task', 'deep_survey.discuss', 'deep_survey.loop', 'deep_survey.auto_task', 'deep_survey.auto_discuss', 'deep_survey.auto_loop',
  ])
  const report = flowReport('auto_discovery')
  report.flowFunnels.paths[3].coverage.limitations = ['compute_not_applicable']
  const discovery = funnels.readFlowFunnels(report, 'auto_discovery')
  assert.equal(discovery.length, 6)
  assert.deepEqual(discovery[2].steps.map(step => step.id), ['proposal', 'go_ahead', 'approved'])
  assert.deepEqual(discovery[4].steps.map(step => step.id), ['go_ahead', 'execution', 'running'])
  assert.deepEqual(discovery[3].coverage.limitations, ['compute_not_applicable'])
})

test('every business path rejects truncated or reordered steps and an incorrect counting unit', () => {
  for (const feature of ['auto_pilot', 'deep_survey', 'idea_spark', 'method_design', 'auto_experiment', 'data_analysis', 'reproduce_paper', 'auto_discovery']) {
    const report = flowReport(feature)
    assert.equal(funnels.readFlowFunnels(report, feature).length, 6)
    for (let index = 0; index < 6; index++) {
      for (const mutate of [
        path => { path.steps.splice(1, 1) },
        path => { path.steps.reverse() },
        path => { path.unit = path.unit === 'visits' ? 'proposals' : 'visits' },
      ]) {
        const invalid = structuredClone(report)
        mutate(invalid.flowFunnels.paths[index])
        assert.throws(() => funnels.readFlowFunnels(invalid, feature), invalid.flowFunnels.paths[index].id)
      }
    }
  }
})

test('outcome counts and observed exit destinations require a complete valid contract', () => {
  for (const mutate of [
    path => { delete path.outcomes },
    path => { delete path.outcomes.timedOut },
    path => { path.outcomes.failed = -1 },
    path => { path.outcomes.cancelled = .5 },
    path => { path.outcomes.blocked = null },
    path => { path.outcomes.decisionFailed = '1' },
    path => { delete path.exits },
    path => { path.exits = [{ route: '/chat', count: -1 }] },
    path => { path.exits = [{ route: null, count: 1 }] },
    path => { path.exits = [{ route: '', count: 1 }] },
  ]) {
    const report = flowReport()
    mutate(report.flowFunnels.paths[0])
    assert.throws(() => funnels.readFlowFunnels(report, 'deep_survey'))
  }
})

test('malformed, stale-feature, duplicate and incomplete flow reports are rejected', () => {
  assert.equal(typeof funnels.readFlowFunnels, 'function')
  for (const mutate of [
    report => { delete report.flowFunnels },
    report => { report.flowFunnels.version = 2 },
    report => { report.flowFunnels.paths.pop() },
    report => { report.flowFunnels.paths[0].featureId = 'idea_spark' },
    report => { report.flowFunnels.paths[1] = report.flowFunnels.paths[0] },
    report => { report.flowFunnels.paths[0].steps[0].fromFirst = 2 },
    report => { report.flowFunnels.paths[0].steps[0].count = -1 },
    report => { report.flowFunnels.paths[0].steps[0].availability = 'coming_soon' },
    report => { report.flowFunnels.paths[0].coverage.limitations = 'compute_not_applicable' },
    report => { report.flowFunnels.paths[0].coverage.limitations = [123] },
  ]) {
    const report = flowReport()
    mutate(report)
    assert.throws(() => funnels.readFlowFunnels(report, 'deep_survey'))
  }
})

test('unsupported yearly ranges reset to seven days and arbitrary features are rejected', () => {
  const input = new URLSearchParams('period=12M&from=2025-01-01&to=2026-01-01')
  const next = selectNovixFunnel(input, 'data_analysis', '12M')
  assert.equal(next.get('period'), '7d')
  assert.equal(next.has('from') || next.has('to'), false)
  assert.throws(() => selectNovixFunnel(input, '../other', '7d'))
  assert.throws(() => businessFunnelQuery({ searchParams: input, feature: 'draw_plot', period: '7d', timeBucket: 'hour', timezone: 'UTC' }))
})
