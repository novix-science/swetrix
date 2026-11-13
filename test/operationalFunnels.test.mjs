import assert from 'node:assert/strict'
import { test } from 'node:test'
import { operationalReport } from './fixtures/operationalFlows.mjs'

const operational = await import('../web/app/pages/Project/tabs/Funnels/operational.ts')

test('older flow responses keep existing paths usable when operational fields are absent', () => {
  assert.equal(typeof operational.readOperationalFlowFunnels, 'function')
  assert.equal(operational.readOperationalFlowFunnels({}, 'deep_survey'), undefined)
  assert.equal(operational.readAutoRouting({}, 'deep_survey'), undefined)
})

test('operational definitions cover all 36 paths with their ordered stages and visit unit', () => {
  let total = 0
  for (const [feature, expected] of [['auto_discovery', 14], ['auto_pilot', 4], ['deep_survey', 3], ['idea_spark', 3], ['method_design', 3], ['auto_experiment', 3], ['data_analysis', 3], ['reproduce_paper', 3]]) {
    const paths = operational.readOperationalFlowFunnels(operationalReport(feature), feature)
    assert.equal(paths.length, expected, feature)
    assert.ok(paths.every(path => path.unit === 'visits'))
    total += paths.length
  }
  assert.equal(total, 36)
})

test('operational paths reject incorrect IDs, duplicate paths, units and stage ordering', () => {
  for (const mutate of [
    report => { report.operationalFunnels.version = 2 },
    report => { report.operationalFunnels.paths.pop() },
    report => { report.operationalFunnels.paths[0].id = 'deep_survey.unknown' },
    report => { report.operationalFunnels.paths[1] = report.operationalFunnels.paths[0] },
    report => { report.operationalFunnels.paths[0].labelKey = 'flow_task' },
    report => { report.operationalFunnels.paths[0].unit = 'operations' },
    report => { report.operationalFunnels.paths[0].steps.reverse() },
    report => { report.operationalFunnels.paths[0].outcomes.failed = -1 },
  ]) {
    const report = operationalReport()
    mutate(report)
    assert.throws(() => operational.readOperationalFlowFunnels(report, 'deep_survey'))
  }
})

test('event-only paths preserve unavailable task outcomes as null', () => {
  const paths = operational.readOperationalFlowFunnels(operationalReport(), 'deep_survey')
  assert.ok(Object.values(paths[0].outcomes).every(value => value === null))
})

test('a missing operational stage stays unknown through every downstream stage', () => {
  const report = operationalReport()
  const path = report.operationalFunnels.paths[0]
  path.availability = 'partial'
  path.coverage.missingEvents = ['feature_input_started']
  for (const step of path.steps.slice(1)) Object.assign(step, { count: null, fromPrevious: null, fromFirst: null, availability: 'unavailable' })
  assert.equal(operational.readOperationalFlowFunnels(report, 'deep_survey')[0].steps[2].count, null)
  for (const mutate of [
    path => { path.steps[1].count = 0 },
    path => { path.steps[1].fromFirst = 0 },
    path => { path.steps[2] = { id: 'submit', count: 0, fromPrevious: 0, fromFirst: 0, availability: 'available' } },
  ]) {
    const invalid = structuredClone(report)
    mutate(invalid.operationalFunnels.paths[0])
    assert.throws(() => operational.readOperationalFlowFunnels(invalid, 'deep_survey'))
  }
})

test('partial stages and partial denominators cannot expose complete-coverage conversion rates', () => {
  const report = operationalReport()
  const path = report.operationalFunnels.paths[0]
  path.steps = [
    { id: 'entry', count: 20, availability: 'available', fromPrevious: 1, fromFirst: 1 },
    { id: 'input_started', count: 10, availability: 'available', fromPrevious: .5, fromFirst: .5 },
    { id: 'submit', count: 5, availability: 'available', fromPrevious: .5, fromFirst: .25 },
  ]
  operational.readOperationalFlowFunnels(report, 'deep_survey')
  for (const mutate of [
    path => { path.steps[0].availability = 'partial' },
    path => { path.steps[1].availability = 'partial' },
    path => { path.steps[1].availability = 'partial'; path.steps[1].fromPrevious = null; path.steps[1].fromFirst = null },
    path => { path.steps[2].count = 30 },
    path => { path.steps[2].fromFirst = .9 },
    path => { path.steps[2].fromPrevious = .9 },
    path => {
      path.steps[1].availability = 'partial'
      path.steps[1].fromFirst = null
      path.steps[1].fromPrevious = null
      path.steps[2].count = 30
      path.steps[2].fromFirst = null
      path.steps[2].fromPrevious = null
    },
  ]) {
    const invalid = structuredClone(report)
    mutate(invalid.operationalFunnels.paths[0])
    assert.throws(() => operational.readOperationalFlowFunnels(invalid, 'deep_survey'))
  }
  path.steps[0].availability = 'partial'
  for (const step of path.steps) { step.fromFirst = null; step.fromPrevious = null }
  operational.readOperationalFlowFunnels(report, 'deep_survey')
})

test('Auto distribution validates its confirmed-operation denominator and unresolved remainder', () => {
  const report = operationalReport()
  assert.deepEqual(operational.readAutoRouting(report, 'deep_survey').resolved, { task: 4, discuss: 3, deep: 1 })
  for (const mutate of [
    routing => { routing.accepted = 9 },
    routing => { routing.totalSubmitted = 11 },
    routing => { routing.featureId = 'idea_spark' },
    routing => { routing.unit = 'visits' },
    routing => { routing.resolved.deep = -1 },
    routing => { routing.accepted = null },
  ]) {
    const invalid = structuredClone(report)
    mutate(invalid.autoRouting)
    assert.throws(() => operational.readAutoRouting(invalid, 'deep_survey'))
  }
})

test('unavailable Auto collection preserves null metrics and separately counted exclusions', () => {
  const report = operationalReport()
  Object.assign(report.autoRouting, { availability: 'unavailable', totalSubmitted: null, accepted: null, unresolved: null, resolved: { task: null, discuss: null, deep: null } })
  assert.equal(operational.readAutoRouting(report, 'deep_survey').accepted, null)
  report.autoRouting.accepted = 0
  assert.throws(() => operational.readAutoRouting(report, 'deep_survey'))
})
