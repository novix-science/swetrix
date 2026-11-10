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
  // Only the native date selection applies here. Saved traffic filters and
  // previous business-view mode/compute filters must not change this preset.
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
  return query
}
