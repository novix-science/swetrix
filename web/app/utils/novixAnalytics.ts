export const NOVIX_BUSINESS_TAB = 'novixBusiness' as const

interface AnalyticsProjectOptions {
  projectId: string
  enabledProjectIds?: string
  selfhosted: boolean
  embedded?: boolean
}

export function isNovixAnalyticsEnabled(
  options: AnalyticsProjectOptions,
): boolean {
  return (
    options.selfhosted &&
    !options.embedded &&
    /^[A-Za-z0-9_-]{12}$/.test(options.projectId) &&
    (options.enabledProjectIds || '')
      .split(',')
      .map((id) => id.trim())
      .includes(options.projectId)
  )
}

export const BUSINESS_FILTER_DEFAULTS = {
  feature: 'all',
  internalTraffic: '',
  mode: 'all',
  computeType: 'all',
  device: 'all',
  userType: 'all',
  version: '',
  attribution: 'session',
  source: '',
  medium: '',
  campaign: '',
} as const

export type BusinessFilters = Record<
  keyof typeof BUSINESS_FILTER_DEFAULTS,
  string
>

export function readBusinessFilters(params: URLSearchParams): BusinessFilters {
  return Object.fromEntries(
    Object.entries(BUSINESS_FILTER_DEFAULTS).map(([key, fallback]) => [
      key,
      params.get(`novix_${key}`) ?? fallback,
    ]),
  ) as BusinessFilters
}

export function updateBusinessFilters(
  params: URLSearchParams,
  filters: BusinessFilters,
): URLSearchParams {
  const next = new URLSearchParams(params)
  for (const key of Object.keys(
    BUSINESS_FILTER_DEFAULTS,
  ) as (keyof BusinessFilters)[]) {
    if (filters[key] === BUSINESS_FILTER_DEFAULTS[key])
      next.delete(`novix_${key}`)
    else next.set(`novix_${key}`, filters[key])
  }
  return next
}

export function businessQueryParams(options: {
  searchParams: URLSearchParams
  period: string
  timeBucket: string
  timezone: string
}): URLSearchParams {
  const query = new URLSearchParams()
  for (const key of ['from', 'to']) {
    const value = options.searchParams.get(key)
    if (value) query.set(key, value)
  }
  query.set('period', options.period)
  query.set('timeBucket', options.timeBucket)
  query.set('timezone', options.timezone)
  for (const [key, value] of Object.entries(
    readBusinessFilters(options.searchParams),
  )) {
    if (value) query.set(key, value)
  }
  return query
}
