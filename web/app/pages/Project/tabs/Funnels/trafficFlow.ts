import { ReportError } from '../Business/report'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezonePlugin from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezonePlugin)

export interface TrafficFlowNode {
  id: string
  dimension: string
  value: string
  count: number
  children: TrafficFlowNode[]
}

export interface TrafficFlowReport {
  schemaVersion: 1
  version: 1
  environment: string
  snapshotAt: string
  source: 'swetrix_native'
  unit: 'visitors'
  identity: 'psid'
  attribution: 'first_recorded_choice'
  filters: { internalTraffic: 'all' }
  labels: Record<string, string>
  resolvedRange: {
    startInclusive: string
    endExclusive: string
    timezone: string
  }
  pv: number
  root: TrafficFlowNode
  coverage: {
    missingVisitorPages: number
    missingBehaviorVisitors: number
    ambiguousChoices: number
    eventsWithoutPageview: number
    duplicateEvents: number
  }
  collection: { firstPageviewAt: string | null }
}

const count = (n: unknown): n is number =>
  typeof n === 'number' && Number.isSafeInteger(n) && n >= 0

export function validateTrafficFlow(value: unknown): TrafficFlowReport {
  const report = value as TrafficFlowReport | null
  let nodes = 0
  const ids = new Set<string>()
  const validNode = (node: TrafficFlowNode, depth = 0): boolean => {
    if (
      !node ||
      ++nodes > 10000 ||
      depth > 16 ||
      typeof node.id !== 'string' ||
      !node.id ||
      ids.has(node.id) ||
      typeof node.dimension !== 'string' ||
      typeof node.value !== 'string' ||
      !count(node.count) ||
      !Array.isArray(node.children)
    )
      return false
    ids.add(node.id)
    return (
      node.children.every((row) => validNode(row, depth + 1)) &&
      (!node.children.length ||
        node.children.reduce((sum, row) => sum + row.count, 0) === node.count)
    )
  }
  if (
    report?.schemaVersion !== 1 ||
    report.version !== 1 ||
    report.source !== 'swetrix_native' ||
    report.unit !== 'visitors' ||
    report.identity !== 'psid' ||
    report.attribution !== 'first_recorded_choice' ||
    report.filters?.internalTraffic !== 'all' ||
    !['production', 'staging'].includes(report.environment) ||
    !Number.isFinite(Date.parse(report.snapshotAt)) ||
    !report.resolvedRange ||
    typeof report.resolvedRange.timezone !== 'string' ||
    !Number.isFinite(Date.parse(report.resolvedRange.startInclusive)) ||
    !Number.isFinite(Date.parse(report.resolvedRange.endExclusive)) ||
    Date.parse(report.resolvedRange.endExclusive) <=
      Date.parse(report.resolvedRange.startInclusive) ||
    !count(report.pv) ||
    !validNode(report.root) ||
    report.root.count > report.pv ||
    !report.coverage ||
    !report.collection ||
    (report.collection.firstPageviewAt !== null &&
      !Number.isFinite(Date.parse(report.collection.firstPageviewAt))) ||
    !report.labels ||
    typeof report.labels !== 'object' ||
    Array.isArray(report.labels) ||
    !Object.values(report.labels).every(
      (label) => typeof label === 'string' && label.length < 200,
    ) ||
    ![
      'missingVisitorPages',
      'missingBehaviorVisitors',
      'ambiguousChoices',
      'eventsWithoutPageview',
      'duplicateEvents',
    ].every((key) =>
      count(report.coverage[key as keyof TrafficFlowReport['coverage']]),
    )
  )
    throw new ReportError(502, 'invalid_report')
  return report
}

export function trafficFlowQuery(
  params: URLSearchParams,
  period: string,
  timeBucket: string,
  timezone: string,
) {
  const query = new URLSearchParams({ period, timeBucket, timezone })
  for (const key of ['from', 'to']) {
    const value = params.get(key)
    if (value) query.set(key, value)
  }
  return query.toString()
}

export function lastDaysParams(
  params: URLSearchParams,
  days: 7 | 14 | 30,
  timezone: string,
  now = Date.now(),
) {
  const today = dayjs(now).tz(timezone).format('YYYY-MM-DD')
  const start = dayjs
    .utc(today)
    .subtract(days - 1, 'day')
    .format('YYYY-MM-DD')
  const tomorrow = dayjs.utc(today).add(1, 'day').format('YYYY-MM-DD')
  const next = new URLSearchParams(params)
  next.set('period', 'custom')
  next.set('timeBucket', 'day')
  next.set('from', dayjs.tz(start, timezone).toISOString())
  next.set(
    'to',
    dayjs.tz(tomorrow, timezone).subtract(1, 'second').toISOString(),
  )
  return next
}

export async function readTrafficFlowReport(path: string, signal: AbortSignal) {
  const response = await fetch(path, { credentials: 'same-origin', signal })
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new ReportError(
      response.status,
      typeof error.error === 'string' ? error.error : 'request_failed',
    )
  }
  return validateTrafficFlow(await response.json().catch(() => null))
}
