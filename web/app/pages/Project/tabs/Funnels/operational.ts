import type {
  AutoRouting,
  FlowFunnel,
  FlowFunnelReport,
} from '../Business/types'

export const OPERATIONAL_SCIENCE_FEATURES = [
  'auto_pilot',
  'deep_survey',
  'idea_spark',
  'method_design',
  'auto_experiment',
  'data_analysis',
  'reproduce_paper',
]

const scientificPaths: Record<string, string[]> = {
  draft_submission: ['entry', 'input_started', 'submit'],
  draft_abandonment: ['entry', 'input_started', 'left_without_submit'],
  checklist_interaction: [
    'checklist_viewed',
    'item_interacted',
    'confirmed',
    'execution',
    'result',
  ],
}
const proposalSteps = ['space', 'mode', 'proposal', 'decision', 'accepted']
const acknowledgementSteps = [
  'workspace',
  'tool_exposed',
  'tool_clicked',
  'acknowledged',
]
const discoveryPaths: Record<string, string[]> = {
  roam_go_ahead: proposalSteps,
  roam_not_now: proposalSteps,
  pilot_go_ahead: proposalSteps,
  pilot_not_now: proposalSteps,
  file_upload: ['workspace', 'upload_clicked', 'files_selected'],
  mind_mining_ack: acknowledgementSteps,
  omni_ai_history_ack: acknowledgementSteps,
  quick_collection_ack: acknowledgementSteps,
  files_download: ['workspace', 'category_clicked', 'file_opened', 'download'],
  files_exit: ['workspace', 'category_clicked', 'file_opened', 'exit'],
  projects_download: [
    'workspace',
    'category_clicked',
    'file_opened',
    'download',
  ],
  projects_exit: ['workspace', 'category_clicked', 'file_opened', 'exit'],
  running_open: ['workspace', 'project_clicked', 'conversation'],
  done_open: ['workspace', 'project_clicked', 'conversation'],
}
const availability = new Set(['available', 'partial', 'unavailable'])
const nonnegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const stringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')
const rateValid = (value: unknown) =>
  value === null ||
  (typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1)

function expectedPaths(feature: string): Record<string, string[]> {
  if (feature === 'auto_discovery') return discoveryPaths
  if (!OPERATIONAL_SCIENCE_FEATURES.includes(feature))
    throw new Error('Unknown operational feature')
  return {
    ...scientificPaths,
    ...(feature === 'auto_pilot'
      ? { landing_workspace: ['landing', 'cta', 'workspace'] }
      : {}),
  }
}

function validSteps(path: FlowFunnel, expected: string[]) {
  if (!Array.isArray(path.steps) || path.steps.length !== expected.length)
    return false
  let missingStage = false
  return path.steps.every((step, index) => {
    if (
      !step ||
      step.id !== expected[index] ||
      !availability.has(step.availability) ||
      !rateValid(step.fromPrevious) ||
      !rateValid(step.fromFirst)
    )
      return false
    if (step.availability === 'unavailable') {
      missingStage = true
      return (
        step.count === null &&
        step.fromPrevious === null &&
        step.fromFirst === null
      )
    }
    if (missingStage || !nonnegativeInteger(step.count)) return false
    const first = path.steps[0]
    const previous = path.steps[Math.max(0, index - 1)]
    if (
      step.fromFirst !== null &&
      (step.availability !== 'available' ||
        first.availability !== 'available' ||
        first.count === null ||
        first.count <= 0 ||
        Math.abs(step.fromFirst - step.count / first.count) > 1e-9)
    )
      return false
    if (
      step.fromPrevious !== null &&
      (step.availability !== 'available' ||
        previous.availability !== 'available' ||
        previous.count === null ||
        previous.count <= 0 ||
        Math.abs(step.fromPrevious - step.count / previous.count) > 1e-9)
    )
      return false
    return !(
      step.availability === 'available' &&
      ((previous.availability === 'available' &&
        previous.count !== null &&
        step.count > previous.count) ||
        (first.availability === 'available' &&
          first.count !== null &&
          step.count > first.count))
    )
  })
}

export function readOperationalFlowFunnels(
  report: Pick<FlowFunnelReport, 'operationalFunnels'>,
  feature: string,
): FlowFunnel[] | undefined {
  if (report.operationalFunnels === undefined) return undefined
  const paths = report.operationalFunnels?.paths
  const expected = Object.entries(expectedPaths(feature))
  if (
    report.operationalFunnels?.version !== 1 ||
    !Array.isArray(paths) ||
    paths.length !== expected.length
  )
    throw new Error('Invalid operational funnel report')
  return expected.map(([id, steps]) => {
    const path = paths.find((item) => item?.id === `${feature}.${id}`)
    if (
      !path ||
      path.featureId !== feature ||
      path.labelKey !== `op_${id}` ||
      path.unit !== 'visits' ||
      path.window !== '7x24h' ||
      !availability.has(path.availability) ||
      typeof path.pending !== 'boolean' ||
      !stringArray(path.coverage?.missingEvents) ||
      !nonnegativeInteger(path.coverage.excluded) ||
      (path.coverage.limitations !== undefined &&
        !stringArray(path.coverage.limitations)) ||
      !path.outcomes ||
      ![
        'failed',
        'cancelled',
        'timedOut',
        'blocked',
        'unconfirmed',
        'decisionFailed',
      ].every((key) => {
        const value = path.outcomes[key as keyof FlowFunnel['outcomes']]
        return value === null || nonnegativeInteger(value)
      }) ||
      !Array.isArray(path.exits) ||
      !path.exits.every(
        (exit) =>
          exit &&
          typeof exit.route === 'string' &&
          exit.route.trim().length > 0 &&
          nonnegativeInteger(exit.count),
      ) ||
      !validSteps(path, steps)
    )
      throw new Error('Invalid operational funnel report')
    return path
  })
}

export function readAutoRouting(
  report: Pick<FlowFunnelReport, 'autoRouting'>,
  feature: string,
): AutoRouting | undefined {
  const routing = report.autoRouting
  if (routing === undefined) return undefined
  if (
    !routing ||
    routing.version !== 1 ||
    routing.featureId !== feature ||
    !OPERATIONAL_SCIENCE_FEATURES.includes(feature) ||
    routing.unit !== 'operations' ||
    routing.requestedMode !== 'auto' ||
    !availability.has(routing.availability) ||
    !nonnegativeInteger(routing.excluded) ||
    !stringArray(routing.coverage?.missingEvents) ||
    !routing.resolved
  )
    throw new Error('Invalid Auto routing report')
  const metrics = [
    routing.totalSubmitted,
    routing.accepted,
    routing.unresolved,
    routing.resolved.task,
    routing.resolved.discuss,
    routing.resolved.deep,
  ]
  if (routing.availability === 'unavailable') {
    if (!metrics.every((value) => value === null))
      throw new Error('Invalid Auto routing report')
  } else if (
    !metrics.every(nonnegativeInteger) ||
    routing.accepted !==
      routing.resolved.task! +
        routing.resolved.discuss! +
        routing.resolved.deep! ||
    routing.totalSubmitted !== routing.accepted! + routing.unresolved!
  )
    throw new Error('Invalid Auto routing report')
  return routing
}
