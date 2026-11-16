const leaf = (id, dimension, value, count, children = []) => ({ id, dimension, value, count, children })
export function trafficFlowReport() {
  return {
    schemaVersion: 1, version: 1, environment: 'production', snapshotAt: '2026-11-16T10:00:00Z',
    source: 'swetrix_native', unit: 'visitors', identity: 'psid', attribution: 'first_recorded_choice', filters: { internalTraffic: 'all' },
    labels: { auto_discovery: 'Auto-Discovery', focused_research: 'Focused Research', paper_prep: 'Paper Preparation', auto_pilot: 'Auto Pilot' },
    pv: 255, resolvedRange: { startInclusive: '2026-11-10T00:00:00Z', endExclusive: '2026-11-17T00:00:00Z', timezone: 'Asia/Shanghai' },
    coverage: { missingVisitorPages: 0, missingBehaviorVisitors: 0, ambiguousChoices: 0, eventsWithoutPageview: 0, duplicateEvents: 0 },
    collection: { firstPageviewAt: '2026-11-10T00:00:00Z' },
    root: leaf('traffic', 'traffic', 'all', 100, [
      leaf('discovery', 'tab', 'auto_discovery', 10),
      leaf('focus', 'tab', 'focused_research', 80, [
        leaf('pilot', 'feature', 'auto_pilot', 50, [
          leaf('submit', 'submission', 'submitted', 30, [
            leaf('mode-auto', 'mode', 'auto', 20, [leaf('cpu', 'compute_type', 'cpu', 12, [leaf('config','coverage','configuration_not_collected',12)]), leaf('gpu', 'compute_type', 'gpu', 8)]),
            leaf('mode-task', 'mode', 'task', 10),
          ]),
          leaf('no-submit', 'submission', 'not_recorded', 20),
        ]),
        leaf('no-feature', 'status', 'no_feature_recorded', 30),
      ]),
      leaf('paper', 'tab', 'paper_prep', 10),
    ]),
  }
}
