import type { ProductReport, ResourceOverview } from './types'

export class ReportError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code)
  }
}

export async function readReport<T extends ProductReport | ResourceOverview>(
  path: string,
  signal: AbortSignal,
): Promise<T> {
  const response = await fetch(path, { credentials: 'same-origin', signal })
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new ReportError(response.status, error.error || 'request_failed')
  }
  const report = await response.json()
  if (
    report.schemaVersion !== 1 ||
    !report.resolvedRange ||
    !report.environment ||
    (!Array.isArray(report.features) && !report.taskSummary)
  )
    throw new ReportError(502, 'invalid_report')
  return report
}
