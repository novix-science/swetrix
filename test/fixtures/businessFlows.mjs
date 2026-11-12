const researchSteps = ['home', 'entry', 'submit', 'route', 'execution', 'success', 'result']
const loopSteps = ['home', 'entry', 'submit', 'route', 'checklist_ready', 'checklist_viewed', 'checklist_confirmed', 'execution', 'success', 'result']
const research = {
  task: researchSteps,
  discuss: researchSteps,
  loop: loopSteps,
  auto_task: researchSteps,
  auto_discuss: researchSteps,
  auto_loop: loopSteps,
}
const discovery = {
  keyword_input: ['home', 'entry', 'intent', 'space', 'proposal', 'go_ahead', 'running'],
  file_input: ['home', 'entry', 'intent', 'space', 'proposal', 'go_ahead', 'running'],
  proposal_approval: ['proposal', 'go_ahead', 'approved'],
  proposal_skip: ['proposal', 'not_now', 'skipped'],
  running_handoff: ['go_ahead', 'execution', 'running'],
  return_visit: ['running', 'left', 'returned'],
}

export function flowPath(feature, id) {
  const steps = (feature === 'auto_discovery' ? discovery : research)[id]
  return {
    id: `${feature}.${id}`, featureId: feature, labelKey: `flow_${id}`,
    unit: feature === 'auto_discovery' && !['keyword_input', 'file_input'].includes(id) ? 'proposals' : 'visits',
    window: '7x24h', availability: 'available', pending: false,
    coverage: { missingEvents: [], excluded: 0 },
    outcomes: { failed: 0, cancelled: 0, timedOut: 0, blocked: 0, unconfirmed: 0, decisionFailed: 0 },
    exits: [],
    steps: steps.map(id => ({ id, count: 0, fromPrevious: null, fromFirst: null, availability: 'available' })),
  }
}

export function flowReport(feature = 'deep_survey') {
  return {
    schemaVersion: 1, filters: { feature }, environment: 'production', snapshotAt: '2026-11-12T00:00:00Z',
    resolvedRange: { startInclusive: '2026-11-01T00:00:00Z', endExclusive: '2026-11-08T00:00:00Z', timezone: 'UTC' },
    coverage: {},
    flowFunnels: { version: 1, paths: Object.keys(feature === 'auto_discovery' ? discovery : research).map(id => flowPath(feature, id)) },
  }
}
