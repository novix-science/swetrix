import { ReportError } from '../Business/report'
import type { FlowFunnelReport } from '../Business/types'
import { readFlowFunnels } from '~/utils/novixFunnels'

export async function readFlowReport(
  path: string,
  feature: string,
  signal: AbortSignal,
): Promise<FlowFunnelReport> {
  const response = await fetch(path, { credentials: 'same-origin', signal })
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new ReportError(
      response.status,
      typeof error?.error === 'string' ? error.error : 'request_failed',
    )
  }
  const report = await response.json().catch(() => null)
  if (
    report?.schemaVersion !== 1 ||
    report.filters?.feature !== feature ||
    typeof report.environment !== 'string' ||
    !report.environment ||
    typeof report.snapshotAt !== 'string' ||
    !Number.isFinite(Date.parse(report.snapshotAt)) ||
    typeof report.resolvedRange?.timezone !== 'string' ||
    !report.resolvedRange?.timezone ||
    typeof report.resolvedRange.startInclusive !== 'string' ||
    typeof report.resolvedRange.endExclusive !== 'string' ||
    !Number.isFinite(Date.parse(report.resolvedRange.startInclusive)) ||
    !Number.isFinite(Date.parse(report.resolvedRange.endExclusive)) ||
    Date.parse(report.resolvedRange.endExclusive) <=
      Date.parse(report.resolvedRange.startInclusive)
  )
    throw new ReportError(502, 'invalid_report')
  try {
    readFlowFunnels(report, feature)
  } catch {
    throw new ReportError(502, 'invalid_report')
  }
  return report
}
