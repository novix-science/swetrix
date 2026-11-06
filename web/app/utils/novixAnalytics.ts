interface AnalyticsLinkOptions {
  projectId: string
  enabledProjectIds?: string
  selfhosted: boolean
  embedded?: boolean
  searchParams: URLSearchParams
  language?: string
  theme?: string
  timezone?: string
}

export function getNovixAnalyticsHref(
  options: AnalyticsLinkOptions,
): string | undefined {
  if (
    !options.selfhosted ||
    options.embedded ||
    !/^[A-Za-z0-9_-]{12}$/.test(options.projectId)
  )
    return
  const projects = (options.enabledProjectIds || '')
    .split(',')
    .map((id) => id.trim())
  if (!projects.includes(options.projectId)) return
  const query = new URLSearchParams()
  for (const key of [
    'period',
    'from',
    'to',
    'timeBucket',
    'tb',
    'timezone',
    'startInclusive',
    'endExclusive',
    'startDate',
    'endDate',
    'preset',
    'compare',
    'compareFrom',
    'compareTo',
  ]) {
    const value = options.searchParams.get(key)
    if (value) query.set(key, value)
  }
  if (options.timezone) query.set('timezone', options.timezone)
  query.set(
    'lang',
    options.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en',
  )
  if (options.theme === 'light' || options.theme === 'dark')
    query.set('theme', options.theme)
  return `/novix/projects/${options.projectId}/business?${query}`
}
