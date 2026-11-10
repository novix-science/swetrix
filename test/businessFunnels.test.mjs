import assert from 'node:assert/strict'
import { test } from 'node:test'
import { NOVIX_FUNNEL_PRESETS, businessFunnelQuery, getNovixFunnel, selectNovixFunnel } from '../web/app/utils/novixFunnels.ts'

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

test('feature queries carry only that feature and native dates, not unrelated mode, CPU or traffic filters', () => {
  const params = new URLSearchParams('tab=funnels&period=12M&funnelId=old&filters=private&novix_feature=idea_spark&novix_mode=deep&novix_computeType=gpu&novix_internalTraffic=all')
  params.set('from', '2026-11-01T00:00:00.000Z')
  params.set('to', '2026-11-07T23:59:59.999Z')
  const query = businessFunnelQuery({ searchParams: params, feature: 'auto_pilot', period: 'custom', timeBucket: 'hour', timezone: 'Asia/Shanghai' })
  assert.deepEqual(Object.fromEntries(query), {
    from: params.get('from'), to: params.get('to'), period: 'custom', timeBucket: 'hour', timezone: 'Asia/Shanghai', feature: 'auto_pilot',
  })
})

test('unsupported yearly ranges reset to seven days and arbitrary features are rejected', () => {
  const input = new URLSearchParams('period=12M&from=2025-01-01&to=2026-01-01')
  const next = selectNovixFunnel(input, 'data_analysis', '12M')
  assert.equal(next.get('period'), '7d')
  assert.equal(next.has('from') || next.has('to'), false)
  assert.throws(() => selectNovixFunnel(input, '../other', '7d'))
  assert.throws(() => businessFunnelQuery({ searchParams: input, feature: 'draw_plot', period: '7d', timeBucket: 'hour', timezone: 'UTC' }))
})
