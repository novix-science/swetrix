import React from 'react'
import { FeatureCoverage } from './FeatureCoverage'
import { MetricCard } from '~/pages/Project/tabs/Traffic/MetricCards'
import type {
  Labels,
  Metric,
  ProductReport,
  Rate,
  ResourceOverview,
} from './types'

const panel =
  'rounded-lg border border-gray-200 bg-white p-4 sm:p-5 dark:border-slate-800/60 dark:bg-slate-900/25'
const muted = 'text-sm text-gray-500 dark:text-gray-400'

function Table({
  title,
  columns,
  rows,
}: {
  title: string
  columns: string[]
  rows: React.ReactNode[][]
}) {
  return (
    <div className='overflow-x-auto'>
      <table className='w-full text-left text-sm'>
        <caption className='sr-only'>{title}</caption>
        <thead className='border-b border-gray-200 text-xs text-gray-500 dark:border-slate-800 dark:text-gray-400'>
          <tr>
            {columns.map((column, i) => (
              <th
                key={i}
                scope='col'
                className='px-3 py-3 font-medium whitespace-nowrap'
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className='divide-y divide-gray-100 text-gray-800 dark:divide-slate-800/60 dark:text-gray-200'>
          {rows.length ? (
            rows.map((row, i) => (
              <tr
                key={i}
                className='hover:bg-gray-50 dark:hover:bg-slate-900/50'
              >
                {row.map((value, j) => (
                  <td key={j} className='px-3 py-3 tabular-nums'>
                    {value}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={columns.length}
                className='px-3 py-6 text-center text-gray-500'
              >
                —
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function Panel({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className={panel}>
      <h3 className='mb-3 text-base font-semibold text-gray-900 dark:text-gray-50'>
        {title}
      </h3>
      {description ? (
        <p className={`${muted} mb-4 leading-relaxed`}>{description}</p>
      ) : null}
      {children}
    </section>
  )
}

function Cards({
  items,
}: {
  items: { label: string; value: React.ReactNode; detail?: string }[]
}) {
  return (
    <div className={`${panel} grid grid-cols-2 gap-x-6 gap-y-5 xl:grid-cols-4`}>
      {items.map((item, i) => (
        <fieldset key={i} className='min-w-0' aria-label={item.label}>
          <MetricCard
            label={item.label}
            value={item.value}
            classes={{
              label: 'whitespace-normal! items-start',
              value: 'whitespace-normal! break-words',
            }}
          />
          {item.detail ? (
            <p className='mt-2 text-xs text-gray-500 dark:text-gray-400'>
              {item.detail}
            </p>
          ) : null}
        </fieldset>
      ))}
    </div>
  )
}

export function FunnelSection({
  report,
  labels,
  language,
}: {
  report: Pick<ProductReport, 'funnel'>
  labels: Labels
  language: string
}) {
  const l = (key: string) => labels[key] || key
  const n = (value?: Metric) =>
    value == null || !Number.isFinite(value)
      ? '—'
      : new Intl.NumberFormat(language, { maximumFractionDigits: 4 }).format(
          value,
        )
  const rate = (value: Rate) =>
    `${value.value == null ? l(`metric_${value.availability}`) : `${n(value.value * 100)}%`} (${n(value.numerator)}/${n(value.denominator)})${value.maturity === 'pending' ? ` · ${l('pending')}` : ''}`
  return (
    <Panel title={l('funnel')} description={l('funnelDefinition')}>
      <p className={`${muted} mb-3`}>
        {l(`metric_${report.funnel.availability}`)} · {l('pendingUsers')}{' '}
        {n(report.funnel.pendingUsers)}
      </p>
      <Table
        title={l('funnel')}
        columns={[
          'stage',
          'actors',
          'previousConversion',
          'overallConversion',
        ].map(l)}
        rows={report.funnel.steps.map((row) => [
          l(`funnel_${row.id}`),
          n(report.funnel.availability === 'unavailable' ? null : row.users),
          rate(row.fromPrevious),
          rate(row.fromFirst),
        ])}
      />
    </Panel>
  )
}

export function ProductSections({
  report,
  labels,
  language,
}: {
  report: ProductReport
  labels: Labels
  language: string
}) {
  const l = (key: string) => labels[key] || key
  const n = (value?: Metric) =>
    value == null || !Number.isFinite(value)
      ? '—'
      : new Intl.NumberFormat(language, { maximumFractionDigits: 4 }).format(
          value,
        )
  const rate = (value: Rate) =>
    `${value.value == null ? l(`metric_${value.availability}`) : `${n(value.value * 100)}%`} (${n(value.numerator)}/${n(value.denominator)})${value.maturity === 'pending' ? ` · ${l('pending')}` : ''}`
  const { traffic, usage, delivery, coverage } = report
  const trafficKnown = traffic.availability !== 'unavailable'
  const missingAssociations = Object.values(coverage.filterGaps || {}).reduce(
    (total, count) => total + count,
    0,
  )
  const stats = [
    ['PV', trafficKnown ? traffic.pv : null],
    ['UV', trafficKnown ? traffic.uv : null],
    [l('visitingUsers'), trafficKnown ? traffic.users : null],
    [l('activeUsers'), usage.users],
    [l('uses'), usage.operations],
    [l('newUseUsers'), usage.newUsers],
    [l('returningUseUsers'), usage.returningUsers],
    [l('registrations'), report.registrations.total],
    [l('engagedSeconds'), traffic.engagedSeconds],
    [l('averageEngaged'), traffic.averageEngagedSeconds],
  ] as [string, Metric][]

  return (
    <div className='space-y-4'>
      {missingAssociations > 0 ? (
        <p
          role='note'
          className='rounded-lg bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-800 dark:bg-amber-500/10 dark:text-amber-200'
        >
          {l('filterPartial')}
        </p>
      ) : null}
      <section aria-label={l('productOverview')}>
        <h3 className='mb-3 text-base font-semibold text-gray-900 dark:text-gray-50'>
          {l('productOverview')}
        </h3>
        <Cards
          items={stats.map(([label, value]) => ({ label, value: n(value) }))}
        />
        <p className={`${muted} mt-3`}>
          {l('trafficScope')} {l('registrationScope')}
        </p>
      </section>
      <Panel title={l('featureUsage')}>
        <FeatureCoverage report={report} labels={l} />
        <Table
          title={l('featureUsage')}
          columns={[
            'feature',
            'availability',
            'exposures',
            'exposedActors',
            'clicks',
            'clickedActors',
            'uses',
            'activeUsers',
            'averageUses',
            'viewedActors',
            'interactedActors',
            'featureSourceOrder',
          ].map(l)}
          rows={report.features.map((row) => [
            row.label,
            <span
              key='availability'
              className={`rounded-md px-2 py-1 text-xs ${row.availability === 'coming_soon' ? 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-gray-400' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'}`}
            >
              {l(row.availability)}
            </span>,
            ...[
              row.exposures,
              row.exposedActors,
              row.clicks,
              row.clickedActors,
              row.uses,
              row.users,
              row.averageUses,
            ].map(n),
            n(row.viewedActors ?? null),
            n(row.interactedActors ?? null),
            row.featureSources
              ? `${row.featureSources.recorded} / ${row.featureSources.recovered} / ${row.featureSources.legacy} / ${row.featureSources.unknown}`
              : '—',
          ])}
        />
      </Panel>
      <div className='grid gap-4 xl:grid-cols-2'>
        <Panel title={l('auxiliaryUsage')}>
          <Table
            title={l('auxiliaryUsage')}
            columns={['feature', 'exposures', 'clicks'].map(l)}
            rows={report.auxiliary.map((row) => [
              row.label,
              n(row.exposures),
              n(row.clicks),
            ])}
          />
        </Panel>
        <Panel title={l('dataCoverage')} description={l('identityCoverage')}>
          <dl className='divide-y divide-gray-100 dark:divide-slate-800'>
            {[
              ['missingCompletionTimes', coverage.missingCompletionTimes],
              ['excludedOrigins', coverage.excludedOrigins],
              ['unknownFeatureUses', coverage.unknownFeatureUses],
              [
                'legacyAnonymousEvents',
                coverage.identity.legacyAnonymousEvents,
              ],
              ['missingAssociations', missingAssociations],
            ].map(([key, value]) => (
              <div
                key={key}
                className='flex items-start justify-between gap-4 py-3 text-sm'
              >
                <dt className='text-gray-500 dark:text-gray-400'>
                  {l(String(key))}
                </dt>
                <dd className='font-medium text-gray-900 tabular-nums dark:text-gray-50'>
                  {n(Number(value))}
                </dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>
      <Panel title={l('frequency')}>
        <Table
          title={l('frequency')}
          columns={[
            'days',
            'activeUsers',
            'uses',
            'averageUses',
            'averageActiveDays',
            'medianInterval',
            'frequencyDistribution',
          ].map(l)}
          rows={report.frequency.map((row) => [
            n(row.days),
            n(row.users),
            n(row.uses),
            n(row.averageUses),
            n(row.averageActiveDays),
            n(row.medianIntervalSeconds),
            ['one', 'two', 'threeToFive', 'sixToTen', 'elevenPlus']
              .map((key) => n(row.distribution[key]))
              .join(' / '),
          ])}
        />
      </Panel>
      <Panel title={l('retention')} description={l('retentionDefinition')}>
        <Table
          title={l('retention')}
          columns={[
            'day',
            'exactRetention',
            'cumulativeRetention',
            'pendingUsers',
            'unknownFirstUsers',
          ].map(l)}
          rows={report.retention.points.map((row) => [
            `D${row.day}`,
            rate(row.exact),
            rate(row.cumulative),
            n(row.pendingUsers),
            n(row.unknownFirstUsers),
          ])}
        />
        <details className='mt-4 border-t border-gray-200 pt-4 dark:border-slate-800'>
          <summary className='cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-200'>
            {l('cohortDetail')}
          </summary>
          <div className='mt-3'>
            <Table
              title={l('cohortDetail')}
              columns={[
                'cohortGranularity',
                'cohort',
                'day',
                'exactRetention',
                'cumulativeRetention',
              ].map(l)}
              rows={[
                ...report.retention.daily.map((row) => [
                  l('dailyCohort'),
                  row.date,
                  `D${row.day}`,
                  rate(row.exact),
                  rate(row.cumulative),
                ]),
                ...report.retention.weekly.map((row) => [
                  l('weeklyCohort'),
                  row.week,
                  `D${row.day}`,
                  rate(row.exact),
                  rate(row.cumulative),
                ]),
              ]}
            />
          </div>
        </details>
      </Panel>
      <Panel title={l('delivery')} description={l('successDefinition')}>
        <h4 className={`${muted} mb-3 font-medium`}>
          {l('acceptedCohortStatuses')}
        </h4>
        <Cards
          items={Object.entries(delivery.statuses).map(([key, value]) => ({
            label: l(`task_${key}`),
            value: n(value),
          }))}
        />
        <p className={`${muted} my-4`}>
          {l('successWithin7Days')} {rate(delivery.successWithin7Days)} ·{' '}
          {l('pendingOperations')} {n(delivery.pendingOperations)}
        </p>
        <h4 className={`${muted} mb-3 font-medium`}>{l('eventsInRange')}</h4>
        <Cards
          items={Object.entries(delivery.eventsInRange).map(([key, value]) => ({
            label: l(`task_${key}`),
            value: n(value),
          }))}
        />
        <h4 className={`${muted} mt-5 mb-3 font-medium`}>
          {l('durationAndInFlight')}
        </h4>
        <Cards
          items={[
            ['durationP50', delivery.duration.p50Seconds],
            ['durationP90', delivery.duration.p90Seconds],
            ['currentInFlight', delivery.inFlight.count],
            ['inFlightAgeP90', delivery.inFlight.ageP90Seconds],
          ].map(([label, value]) => ({
            label: l(String(label)),
            value: n(value as Metric),
          }))}
        />
        <p className={`${muted} mt-3`}>
          {l('durationReported')} {n(delivery.duration.reported)} ·{' '}
          {l('durationMissing')} {n(delivery.duration.missing)}
        </p>
      </Panel>
      <FunnelSection report={report} labels={labels} language={language} />
      <Panel title={l('channels')}>
        <Table
          title={l('channels')}
          columns={[
            'source',
            'medium',
            'campaign',
            'PV',
            'UV',
            'uses',
            'activeUsers',
          ].map(l)}
          rows={report.channels.map((row) => [
            row.source || l('unknown'),
            row.medium || l('unknown'),
            row.campaign || '—',
            ...[row.pv, row.visitors, row.uses, row.users].map(n),
          ])}
        />
      </Panel>
    </div>
  )
}

export function ResourceSections({
  report,
  labels,
  language,
}: {
  report: ResourceOverview
  labels: Labels
  language: string
}) {
  const l = (key: string) => labels[key] || key
  const n = (value?: Metric) =>
    value == null || !Number.isFinite(value)
      ? '—'
      : new Intl.NumberFormat(language, { maximumFractionDigits: 4 }).format(
          value,
        )
  const states = report.taskSummary.byStatus
  const credits = new Map(report.creditTrend.map((row) => [row.date, row]))
  const tasks = new Map(report.taskTrend.map((row) => [row.date, row]))
  const dates = [...new Set([...tasks.keys(), ...credits.keys()])].sort()
  return (
    <div className='space-y-4'>
      <section aria-label={l('resourceOverview')}>
        <h3 className='mb-2 text-base font-semibold text-gray-900 dark:text-gray-50'>
          {l('resourceOverview')}
        </h3>
        <p className={`${muted} mb-4`}>{l('resourceScope')}</p>
        <Cards
          items={[
            ['tasks', report.taskSummary.total],
            ['init', states.init || 0],
            ['processing', states.processing || 0],
            ['finish', states.finish || 0],
            ['error', states.error || 0],
            ['credits', report.creditSummary.creditsConsumed],
            ['consumptions', report.creditSummary.consumeCount],
            ['average', report.creditSummary.averageCredits],
          ].map(([label, value]) => ({
            label: l(String(label)),
            value: n(value as Metric),
          }))}
        />
      </section>
      <Panel title={l('trend')}>
        <Table
          title={l('trend')}
          columns={[
            'date',
            'tasks',
            'init',
            'processing',
            'finish',
            'error',
            'other',
            'credits',
            'consumptions',
          ].map(l)}
          rows={dates.map((date) => {
            const row = tasks.get(date) || {
              total: 0,
              byStatus: {} as Record<string, number>,
            }
            return [
              date,
              n(row.total),
              ...['init', 'processing', 'finish', 'error'].map((key) =>
                n(row.byStatus[key] || 0),
              ),
              n(
                row.total -
                  ['init', 'processing', 'finish', 'error'].reduce(
                    (sum, key) => sum + (row.byStatus[key] || 0),
                    0,
                  ),
              ),
              n(credits.get(date)?.creditsConsumed ?? 0),
              n(credits.get(date)?.consumeCount ?? 0),
            ]
          })}
        />
      </Panel>
      <Panel
        title={l('tokens')}
        description={l(`token_${report.tokenUsage.availability}`)}
      >
        <Cards
          items={[
            'inputTokens',
            'outputTokens',
            'cacheCreationInputTokens',
            'cacheReadInputTokens',
          ].map((key) => {
            const metric = report.tokenUsage.metrics[key]
            return {
              label: l(key),
              value: n(metric?.total),
              detail: `${l('coverage')} ${n(metric?.reportedRecordCount)} / ${n(report.tokenUsage.totalConsumeCount)}`,
            }
          })}
        />
      </Panel>
      <details className={panel}>
        <summary className='cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-200'>
          {l('definitions')}
        </summary>
        <p className={`${muted} mt-3 leading-relaxed`}>{l('taskDefinition')}</p>
        <p className={`${muted} mt-2 leading-relaxed`}>
          {l('creditDefinition')}
        </p>
      </details>
    </div>
  )
}
