import React from 'react'
import type { ProductReport } from './types'

export function FeatureCoverage({
  report,
  labels,
}: {
  report: ProductReport
  labels: (key: string) => string
}) {
  const coverage = report.coverage.featureAttribution
  const unknown = coverage?.unknown ?? report.coverage.unknownFeatureUses
  return (
    <div className='mb-4 space-y-2 text-sm text-gray-600 dark:text-gray-300'>
      <p>{labels('featureUsageDefinition')}</p>
      {coverage ? (
        <p>
          {labels('featureSourceOrder')}: {coverage.recorded} /{' '}
          {coverage.recovered} / {coverage.legacy} / {coverage.unknown}
        </p>
      ) : null}
      {unknown > 0 || (coverage?.legacy ?? 0) > 0 ? (
        <p
          role='note'
          className='rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200'
        >
          {labels('featureCoverageWarning')}
        </p>
      ) : null}
    </div>
  )
}
