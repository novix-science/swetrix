import type {
  FlowFunnel,
  ProductReport,
} from '../pages/Project/tabs/Business/types'

export const NOVIX_FUNNEL_PRESETS = [
  { id: 'auto_discovery', label: 'Auto-Discovery' },
  { id: 'auto_pilot', label: 'Auto Pilot' },
  { id: 'deep_survey', label: 'Deep Survey' },
  { id: 'idea_spark', label: 'Idea Spark' },
  { id: 'method_design', label: 'Method Design' },
  { id: 'auto_experiment', label: 'Auto Experiment' },
  { id: 'data_analysis', label: 'Data Analysis' },
  { id: 'reproduce_paper', label: 'Reproduce Paper' },
] as const

export const BUSINESS_FUNNEL_PERIODS = new Set([
  '1h',
  'today',
  'yesterday',
  '1d',
  '7d',
  '4w',
  '3M',
  'custom',
])

export const FUNNEL_FILTER_OPTIONS = {
  computeType: ['all', 'cpu', 'gpu'],
  internalTraffic: ['', 'all', 'external', 'internal'],
} as const

type FunnelFilter = keyof typeof FUNNEL_FILTER_OPTIONS

export function readFunnelFilters(params: URLSearchParams) {
  return Object.fromEntries(
    Object.entries(FUNNEL_FILTER_OPTIONS).map(([key, choices]) => {
      const value = params.get(`novix_${key}`) || choices[0]
      return [
        key,
        (choices as readonly string[]).includes(value) ? value : choices[0],
      ]
    }),
  ) as Record<FunnelFilter, string>
}

export function updateFunnelFilter(
  params: URLSearchParams,
  key: FunnelFilter,
  value: string,
) {
  if (!(FUNNEL_FILTER_OPTIONS[key] as readonly string[]).includes(value))
    throw new Error('Unknown funnel filter')
  const next = new URLSearchParams(params)
  if (value === FUNNEL_FILTER_OPTIONS[key][0]) next.delete(`novix_${key}`)
  else next.set(`novix_${key}`, value)
  return next
}

export const getNovixFunnel = (params: URLSearchParams) =>
  NOVIX_FUNNEL_PRESETS.find((preset) => preset.id === params.get('novixFunnel'))

export function selectNovixFunnel(
  params: URLSearchParams,
  feature: string,
  period: string,
) {
  if (!NOVIX_FUNNEL_PRESETS.some((preset) => preset.id === feature))
    throw new Error('Unknown business funnel')
  const next = new URLSearchParams(params)
  next.delete('funnelId')
  if (params.get('novixFunnel') === feature) next.delete('novixFunnel')
  else next.set('novixFunnel', feature)
  if (!BUSINESS_FUNNEL_PERIODS.has(period)) {
    next.set('period', '7d')
    next.delete('from')
    next.delete('to')
  }
  return next
}

export function businessFunnelQuery(options: {
  searchParams: URLSearchParams
  feature: string
  period: string
  timeBucket: string
  timezone: string
}) {
  if (!NOVIX_FUNNEL_PRESETS.some((preset) => preset.id === options.feature))
    throw new Error('Unknown business funnel')
  const dates = new URLSearchParams()
  for (const key of ['from', 'to']) {
    const value = options.searchParams.get(key)
    if (value) dates.set(key, value)
  }
  const query = dates
  query.set('period', options.period)
  query.set('timeBucket', options.timeBucket)
  query.set('timezone', options.timezone)
  query.set('feature', options.feature)
  for (const [key, value] of Object.entries(
    readFunnelFilters(options.searchParams),
  )) {
    if (value) query.set(key, value)
  }
  return query
}
const researchSteps = [
  'home',
  'entry',
  'submit',
  'route',
  'execution',
  'success',
  'result',
]
const loopSteps = [
  'home',
  'entry',
  'submit',
  'route',
  'checklist_ready',
  'checklist_viewed',
  'checklist_confirmed',
  'execution',
  'success',
  'result',
]
const researchPaths: Record<string, string[]> = {
  task: researchSteps,
  discuss: researchSteps,
  loop: loopSteps,
  auto_task: researchSteps,
  auto_discuss: researchSteps,
  auto_loop: loopSteps,
}
const discoveryInputSteps = [
  'home',
  'entry',
  'intent',
  'space',
  'proposal',
  'go_ahead',
  'running',
]
const discoveryPaths: Record<string, string[]> = {
  keyword_input: discoveryInputSteps,
  file_input: discoveryInputSteps,
  proposal_approval: ['proposal', 'go_ahead', 'approved'],
  proposal_skip: ['proposal', 'not_now', 'skipped'],
  running_handoff: ['go_ahead', 'execution', 'running'],
  return_visit: ['running', 'left', 'returned'],
}
export const FLOW_OUTCOME_IDS = [
  'failed',
  'cancelled',
  'timedOut',
  'blocked',
  'unconfirmed',
  'decisionFailed',
] as const
const availability = new Set(['available', 'partial', 'unavailable'])
const nonnegativeInteger = (value: unknown) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const countValid = (value: unknown) =>
  value === null || nonnegativeInteger(value)
const rateValid = (value: unknown) =>
  value === null ||
  (typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1)

export function readFlowFunnels(
  report: Pick<ProductReport, 'flowFunnels'>,
  feature: string,
): FlowFunnel[] {
  const paths = report.flowFunnels?.paths
  const expected = Object.entries(
    feature === 'auto_discovery' ? discoveryPaths : researchPaths,
  )
  if (
    report.flowFunnels?.version !== 1 ||
    !Array.isArray(paths) ||
    paths.length !== expected.length
  )
    throw new Error('Invalid flow funnel report')

  return expected.map(([id, steps]) => {
    const path = paths.find((item) => item?.id === `${feature}.${id}`)
    const unit =
      feature === 'auto_discovery' &&
      id !== 'keyword_input' &&
      id !== 'file_input'
        ? 'proposals'
        : 'visits'
    if (
      !path ||
      path.featureId !== feature ||
      path.labelKey !== `flow_${id}` ||
      path.unit !== unit ||
      path.window !== '7x24h' ||
      !availability.has(path.availability) ||
      typeof path.pending !== 'boolean' ||
      !Array.isArray(path.coverage?.missingEvents) ||
      !path.coverage.missingEvents.every(
        (event) => typeof event === 'string',
      ) ||
      !nonnegativeInteger(path.coverage.excluded) ||
      (path.coverage.limitations !== undefined &&
        (!Array.isArray(path.coverage.limitations) ||
          !path.coverage.limitations.every(
            (item) => typeof item === 'string',
          ))) ||
      !path.outcomes ||
      !FLOW_OUTCOME_IDS.every((key) =>
        nonnegativeInteger(path.outcomes[key]),
      ) ||
      !Array.isArray(path.exits) ||
      !path.exits.every(
        (exit) =>
          exit &&
          typeof exit.route === 'string' &&
          exit.route.trim().length > 0 &&
          nonnegativeInteger(exit.count),
      ) ||
      !Array.isArray(path.steps) ||
      path.steps.length !== steps.length ||
      !path.steps.every(
        (step, index) =>
          step &&
          step.id === steps[index] &&
          availability.has(step.availability) &&
          countValid(step.count) &&
          rateValid(step.fromPrevious) &&
          rateValid(step.fromFirst),
      )
    )
      throw new Error('Invalid flow funnel report')
    return path
  })
}
