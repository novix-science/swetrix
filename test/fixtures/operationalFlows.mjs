const research = {
  draft_submission: ['entry', 'input_started', 'submit'],
  draft_abandonment: ['entry', 'input_started', 'left_without_submit'],
  checklist_interaction: ['checklist_viewed', 'item_interacted', 'confirmed', 'execution', 'result'],
}
const discovery = {
  roam_go_ahead: ['space', 'mode', 'proposal', 'decision', 'accepted'],
  roam_not_now: ['space', 'mode', 'proposal', 'decision', 'accepted'],
  pilot_go_ahead: ['space', 'mode', 'proposal', 'decision', 'accepted'],
  pilot_not_now: ['space', 'mode', 'proposal', 'decision', 'accepted'],
  file_upload: ['workspace', 'upload_clicked', 'files_selected'],
  mind_mining_ack: ['workspace', 'tool_exposed', 'tool_clicked', 'acknowledged'],
  omni_ai_history_ack: ['workspace', 'tool_exposed', 'tool_clicked', 'acknowledged'],
  quick_collection_ack: ['workspace', 'tool_exposed', 'tool_clicked', 'acknowledged'],
  files_download: ['workspace', 'category_clicked', 'file_opened', 'download'],
  files_exit: ['workspace', 'category_clicked', 'file_opened', 'exit'],
  projects_download: ['workspace', 'category_clicked', 'file_opened', 'download'],
  projects_exit: ['workspace', 'category_clicked', 'file_opened', 'exit'],
  running_open: ['workspace', 'project_clicked', 'conversation'],
  done_open: ['workspace', 'project_clicked', 'conversation'],
}

export function operationalReport(feature = 'deep_survey') {
  const definitions = feature === 'auto_discovery' ? discovery : {
    ...research,
    ...(feature === 'auto_pilot' ? { landing_workspace: ['landing', 'cta', 'workspace'] } : {}),
  }
  return {
    operationalFunnels: { version: 1, paths: Object.entries(definitions).map(([id, steps]) => ({
      id: `${feature}.${id}`, featureId: feature, labelKey: `op_${id}`, unit: 'visits', window: '7x24h',
      availability: 'available', pending: false, coverage: { missingEvents: [], excluded: 0 },
      outcomes: { failed: null, cancelled: null, timedOut: null, blocked: null, unconfirmed: null, decisionFailed: null }, exits: [],
      steps: steps.map(id => ({ id, count: 0, fromPrevious: null, fromFirst: null, availability: 'available' })),
    })) },
    ...(feature === 'auto_discovery' ? {} : { autoRouting: {
      version: 1, featureId: feature, unit: 'operations', requestedMode: 'auto',
      totalSubmitted: 10, accepted: 8, resolved: { task: 4, discuss: 3, deep: 1 }, unresolved: 2, excluded: 1,
      availability: 'available', coverage: { missingEvents: [] },
    } }),
  }
}
