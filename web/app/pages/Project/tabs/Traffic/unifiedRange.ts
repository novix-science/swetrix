export const UNIFIED_PROJECT = 'JFfioEKRd0Sy'
export const FIRST_HISTORY_DAY = '2025-08-14'
export const NATIVE_FIRST_FULL_DAY = '2026-11-10'

// Calendar components use the browser's local Date fields. Carry the chosen
// calendar day into our fixed GMT+8 range without converting it through UTC.
export const calendarDate = (day: string) => new Date(`${day}T00:00:00`)
export const calendarDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export function historyRange(params: URLSearchParams, now = new Date()) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  const localDay = (value: string) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(value))
  const period = params.get('period') || '7d'
  if (period === 'custom' && params.get('from') && params.get('to')) {
    try {
      return {
        start: localDay(params.get('from')!),
        end: localDay(params.get('to')!),
      }
    } catch {
      return { start: today, end: today }
    }
  }
  const days =
    (
      {
        '1h': 1,
        today: 1,
        yesterday: 1,
        '1d': 2,
        '7d': 7,
        '4w': 28,
        '3M': 90,
      } as Record<string, number>
    )[period] || 7
  const end =
    period === 'yesterday'
      ? new Date(Date.parse(today) - 86400000).toISOString().slice(0, 10)
      : today
  return {
    start: new Date(Date.parse(end) - (days - 1) * 86400000)
      .toISOString()
      .slice(0, 10),
    end,
  }
}

export function withHistoryRange(
  params: URLSearchParams,
  start: string,
  end: string,
) {
  // Historical exports describe the whole production host, not saved segments.
  const next = new URLSearchParams()
  if (params.has('tab')) next.set('tab', params.get('tab')!)
  next.set('period', 'custom')
  next.set('from', `${start}T00:00:00+08:00`)
  next.set('to', `${end}T23:59:59+08:00`)
  next.set('timezone', 'Asia/Shanghai')
  next.set('timeBucket', 'day')
  next.delete('novix_live')
  for (const key of ['compareFrom', 'compareTo', 'compare', 'comparePeriod'])
    next.delete(key)
  return next
}
