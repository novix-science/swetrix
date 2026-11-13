import BusinessFlowFunnels from './BusinessFlowFunnels'
import {
  OPERATIONAL_SCIENCE_FEATURES,
  readAutoRouting,
  readOperationalFlowFunnels,
} from './operational'
import en from './operational.en.json'
import zh from './operational.zh.json'
import type { FlowFunnelReport, Labels, Metric } from '../Business/types'
import { Badge } from '~/ui/Badge'

export default function OperationalFlowFunnels({
  report,
  feature,
  labels,
  language,
}: {
  report: Pick<FlowFunnelReport, 'operationalFunnels' | 'autoRouting'>
  feature: string
  labels: Labels
  language: string
}) {
  const operationalLabels: Labels = {
    ...labels,
    ...(language === 'zh' ? zh : en),
  }
  const l = (key: string) => operationalLabels[key] || key
  const paths = readOperationalFlowFunnels(report, feature)
  const routing = readAutoRouting(report, feature)
  const number = new Intl.NumberFormat(language)
  const percent = new Intl.NumberFormat(language, {
    style: 'percent',
    maximumFractionDigits: 2,
  })
  const count = (value: Metric | undefined) =>
    value === null || value === undefined ? l('unknown') : number.format(value)
  const denominator =
    routing?.availability === 'available' &&
    routing.accepted !== null &&
    routing.accepted > 0
      ? routing.accepted
      : null
  const routingCounts: {
    label: string
    value: Metric | undefined
    unit: string
  }[] = [
    {
      label: 'autoRoutingTotal',
      value: routing?.totalSubmitted,
      unit: 'autoRoutingUnit',
    },
    {
      label: 'autoRoutingAccepted',
      value: routing?.accepted,
      unit: 'autoRoutingUnit',
    },
    {
      label: 'autoRoutingUnresolved',
      value: routing?.unresolved,
      unit: 'autoRoutingUnit',
    },
    {
      label: 'autoRoutingExcluded',
      value: routing?.excluded,
      unit: 'autoRoutingRecordsUnit',
    },
  ]

  return (
    <section
      className='mt-8 border-t border-gray-200 pt-6 dark:border-slate-800'
      aria-label={l('operationalFunnels')}
    >
      <h3 className='text-base font-semibold text-gray-900 dark:text-gray-50'>
        {l('operationalFunnels')}
      </h3>
      <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
        {l('operationalSource')}
      </p>
      <p className='mt-3 text-sm leading-relaxed text-gray-500 dark:text-gray-400'>
        {l('operationalDefinition')}
      </p>
      <p className='my-3 rounded-lg bg-amber-50 p-3 text-sm leading-relaxed text-amber-800 dark:bg-amber-500/10 dark:text-amber-200'>
        {l('operationalMissingExplanation')}
      </p>
      {paths ? (
        <BusinessFlowFunnels
          paths={paths}
          labels={operationalLabels}
          language={language}
          showOutcomes={false}
        />
      ) : (
        <output className='block rounded-lg border border-gray-200 p-4 text-sm text-gray-500 dark:border-slate-800 dark:text-gray-400'>
          {l('operationalUnavailable')}
        </output>
      )}
      {OPERATIONAL_SCIENCE_FEATURES.includes(feature) ? (
        <section
          className='mt-6 rounded-lg border border-gray-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950'
          aria-label={l('autoRouting')}
        >
          <div className='flex flex-wrap items-center gap-2'>
            <h4 className='font-semibold text-gray-900 dark:text-gray-50'>
              {l('autoRouting')}
            </h4>
            <Badge
              colour={
                routing?.availability === 'available' ? 'green' : 'yellow'
              }
              label={l(`metric_${routing?.availability || 'unavailable'}`)}
            />
          </div>
          <p className='mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400'>
            {l('autoRoutingDefinition')}
          </p>
          {!routing || routing.availability === 'unavailable' ? (
            <output className='mt-3 block text-sm text-amber-800 dark:text-amber-200'>
              {l('autoRoutingUnavailable')}
            </output>
          ) : null}
          {routing?.availability === 'partial' ? (
            <p className='mt-3 text-sm text-amber-800 dark:text-amber-200'>
              {l('autoRoutingPartial')}
            </p>
          ) : null}
          {routing?.coverage.missingEvents.length ? (
            <p className='mt-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400'>
              {l('flowMissingEvents')}{' '}
              {routing.coverage.missingEvents.map((event, index) => (
                <span key={event} title={event}>
                  {index ? ', ' : ''}
                  {operationalLabels[`flowMissingEvent_${event}`] || event}
                </span>
              ))}
            </p>
          ) : null}
          <dl className='mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
            {routingCounts.map(({ label, value, unit }) => (
              <div key={label}>
                <dt className='text-xs text-gray-500 dark:text-gray-400'>
                  {l(label)}
                </dt>
                <dd className='mt-1 text-lg font-semibold text-gray-900 tabular-nums dark:text-gray-50'>
                  {count(value)}
                  <span className='ml-1 text-xs font-normal text-gray-500 dark:text-gray-400'>
                    ({l(unit)})
                  </span>
                </dd>
              </div>
            ))}
          </dl>
          <p className='mt-3 text-xs leading-relaxed text-gray-500 dark:text-gray-400'>
            {l('autoRoutingExcludedDefinition')}
          </p>
          <div className='mt-4 overflow-x-auto'>
            <table className='w-full text-left text-sm'>
              <caption className='sr-only'>{l('autoRouting')}</caption>
              <thead className='border-b border-gray-200 text-xs text-gray-500 dark:border-slate-800 dark:text-gray-400'>
                <tr>
                  {[l('mode'), l('autoRoutingUnit'), l('autoRoutingRatio')].map(
                    (label) => (
                      <th
                        key={label}
                        scope='col'
                        className='px-3 py-3 font-medium'
                      >
                        {label}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className='divide-y divide-gray-100 text-gray-800 dark:divide-slate-800/60 dark:text-gray-200'>
                {(['task', 'discuss', 'deep'] as const).map((mode) => {
                  const value = routing?.resolved[mode]
                  return (
                    <tr key={mode}>
                      <th scope='row' className='px-3 py-3 font-normal'>
                        {mode === 'deep'
                          ? 'Loop'
                          : mode === 'task'
                            ? 'Task'
                            : 'Discuss'}
                      </th>
                      <td className='px-3 py-3 tabular-nums'>
                        {count(value)}
                        <span className='ml-1 text-xs text-gray-500 dark:text-gray-400'>
                          ({l('autoRoutingUnit')})
                        </span>
                      </td>
                      <td className='px-3 py-3 tabular-nums'>
                        {denominator !== null &&
                        value !== null &&
                        value !== undefined
                          ? percent.format(value / denominator)
                          : l('unknown')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </section>
  )
}
