import { historyRange } from '../Traffic/unifiedRange'
import { ReportError } from './report'

export const CREDITS_TIMEZONE = 'Asia/Shanghai'
export const CREDIT_PERIODS = ['7d', '14d', '30d'] as const
const DAY = 86400000
type Period = (typeof CREDIT_PERIODS)[number] | 'custom'

export interface CreditsReport {
  schemaVersion: 1
  environment: 'production' | 'staging'
  snapshotAt: string
  resolvedRange: { startInclusive: string; endExclusive: string; timezone: string }
  monthlyUsage: {
    month: string
    tier: string
    accounts: number
    consumingAccounts: number
    exhaustedAccounts: number
    credits: number
    distribution: number[]
    // Included in the row above; plans granted as gift or manual grant (mostly internal accounts).
    gifted: CreditsUsageCounts | null
  }[]
  funnel: {
    paidAccounts: number
    exhaustedAccounts: number
    steps: (CreditsStage & { id: string })[]
    failed: CreditsStage
  }
}

export interface CreditsUsageCounts {
  accounts: number
  consumingAccounts: number
  exhaustedAccounts: number
  credits: number
  distribution: number[]
}

export interface CreditsStage {
  accounts: number | null
  coverage: 'partial' | 'untracked' | 'unobserved' | 'billing' | 'unavailable' | 'not_applicable'
  observedFrom?: string
}

const validDay = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value

export function creditsRange(params: URLSearchParams, now = new Date()) {
  const today = historyRange(new URLSearchParams('period=today'), now).end
  const requested = params.get('credits_period')
  const from = params.get('credits_from') || ''
  const to = params.get('credits_to') || ''
  if (
    requested === 'custom' &&
    validDay(from) &&
    validDay(to) &&
    from <= to &&
    to <= today &&
    Date.parse(to) - Date.parse(from) < 93 * DAY
  ) {
    return { period: 'custom' as const, start: from, end: to, today, invalid: false }
  }
  const period = CREDIT_PERIODS.find((value) => value === requested) || '30d'
  const start = new Date(Date.parse(today) - (Number.parseInt(period) - 1) * DAY)
    .toISOString()
    .slice(0, 10)
  return { period, start, end: today, today, invalid: requested !== null && requested !== period }
}

export function withCreditsRange(params: URLSearchParams, period: Period, start?: string, end?: string) {
  const next = new URLSearchParams(params)
  next.set('credits_period', period)
  next.delete('credits_from')
  next.delete('credits_to')
  if (period === 'custom' && start && end) {
    next.set('credits_from', start)
    next.set('credits_to', end)
  }
  return next
}

export async function readCredits(path: string, signal: AbortSignal): Promise<CreditsReport> {
  const response = await fetch(path, { credentials: 'same-origin', signal })
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new ReportError(response.status, error.error || 'request_failed')
  }
  const report = await response.json()
  if (report?.schemaVersion !== 1 || !report.resolvedRange || !report.snapshotAt ||
      !Array.isArray(report.monthlyUsage) || !Array.isArray(report.funnel?.steps)) {
    throw new ReportError(502, 'invalid_report')
  }
  return report
}
