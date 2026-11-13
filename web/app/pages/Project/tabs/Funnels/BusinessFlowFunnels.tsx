import { CaretDownIcon } from '@phosphor-icons/react'

import BusinessFlowOutcomes from './BusinessFlowOutcomes'
import type { FlowFunnel, Labels, Metric } from '../Business/types'
import { Badge } from '~/ui/Badge'

export default function BusinessFlowFunnels({
  paths,
  labels,
  language,
  showOutcomes = true,
}: {
  paths: FlowFunnel[]
  labels: Labels
  language: string
  showOutcomes?: boolean
}) {
  const l = (key: string) => labels[key] || key
  const number = new Intl.NumberFormat(language, { maximumFractionDigits: 2 })
  const percent = new Intl.NumberFormat(language, {
    style: 'percent',
    maximumFractionDigits: 2,
  })
  const count = (value: Metric) =>
    value === null ? l('unknown') : number.format(value)
  const rate = (value: Metric) =>
    value === null ? l('unknown') : percent.format(value)

  return (
    <div className='space-y-3'>
      {paths.map((path) => {
        const first = path.steps[0]
        const last = path.steps[path.steps.length - 1]
        const baseline = first.availability === 'available' ? first.count : null
        const unit = l(`flowUnit_${path.unit}`)
        const unavailableLabel = l(
          path.coverage.limitations?.includes('compute_not_applicable')
            ? 'flowComputeNotApplicable'
            : 'flowStageRecordsInsufficient',
        )
        const executionLabelKey =
          path.featureId === 'auto_discovery'
            ? 'flowStep_execution_discovery'
            : path.id.endsWith('loop')
              ? 'flowStep_execution_loop'
              : 'flowStep_execution'
        return (
          <details
            key={path.id}
            className='group rounded-lg border border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-950'
          >
            <summary className='flex cursor-pointer list-none flex-wrap items-center gap-x-6 gap-y-3 rounded-lg p-4 focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:outline-hidden [&::-webkit-details-marker]:hidden'>
              <div className='min-w-40 flex-1'>
                <h4 className='font-semibold text-gray-900 dark:text-gray-50'>
                  {l(path.labelKey)}
                </h4>
                <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                  {l(`flowWindow_${path.window}`)} · {unit}
                </p>
              </div>
              <div className='text-sm text-gray-800 tabular-nums dark:text-gray-200'>
                {count(
                  first.availability === 'unavailable' ? null : first.count,
                )}{' '}
                →{' '}
                {count(last.availability === 'unavailable' ? null : last.count)}
                <span className='mt-1 block text-xs text-gray-500 dark:text-gray-400'>
                  {l('flowObservedFromFirst')}{' '}
                  {rate(
                    last.availability === 'available' &&
                      first.availability === 'available'
                      ? last.fromFirst
                      : null,
                  )}
                </span>
              </div>
              <div className='flex flex-wrap items-center gap-2'>
                <Badge
                  colour={
                    path.availability === 'available' ? 'green' : 'yellow'
                  }
                  label={
                    path.availability === 'unavailable'
                      ? unavailableLabel
                      : l(`metric_${path.availability}`)
                  }
                />
                {path.pending ? (
                  <Badge colour='slate' label={l('flowPending')} />
                ) : null}
              </div>
              <CaretDownIcon
                aria-hidden
                className='size-4 shrink-0 text-gray-500 transition-transform group-open:rotate-180'
              />
            </summary>
            <div className='border-t border-gray-100 p-4 dark:border-slate-800'>
              {labels[`${path.labelKey}_definition`] ? (
                <p className='mb-4 text-sm leading-relaxed text-gray-500 dark:text-gray-400'>
                  {labels[`${path.labelKey}_definition`]}
                </p>
              ) : null}
              <div className='overflow-x-auto'>
                <table className='w-full text-left text-sm'>
                  <caption className='sr-only'>{l(path.labelKey)}</caption>
                  <thead className='border-b border-gray-200 text-xs text-gray-500 dark:border-slate-800 dark:text-gray-400'>
                    <tr>
                      {[
                        l('stage'),
                        unit,
                        l('flowRelativeVolume'),
                        l('flowObservedFromPrevious'),
                        l('flowObservedFromFirst'),
                        l('flowCollection'),
                      ].map((label) => (
                        <th
                          key={label}
                          scope='col'
                          className='px-3 py-3 font-medium whitespace-nowrap'
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-gray-100 text-gray-800 dark:divide-slate-800/60 dark:text-gray-200'>
                    {path.steps.map((step, index) => {
                      const known = step.availability !== 'unavailable'
                      const complete = step.availability === 'available'
                      const previous = path.steps[Math.max(0, index - 1)]
                      const value = known ? step.count : null
                      const label =
                        labels[`${path.labelKey}_step_${step.id}`] ||
                        l(
                          step.id === 'execution'
                            ? executionLabelKey
                            : `flowStep_${step.id}`,
                        )
                      return (
                        <tr key={step.id}>
                          <th
                            scope='row'
                            className='px-3 py-3 font-normal whitespace-nowrap'
                          >
                            {label}
                          </th>
                          <td className='px-3 py-3 tabular-nums'>
                            {count(value)}
                          </td>
                          <td className='min-w-32 px-3 py-3'>
                            {baseline !== null &&
                            baseline > 0 &&
                            value !== null &&
                            complete ? (
                              <>
                                <meter
                                  min={0}
                                  max={baseline}
                                  value={value}
                                  aria-label={label}
                                  aria-valuetext={percent.format(
                                    value / baseline,
                                  )}
                                  className='sr-only'
                                />
                                <div
                                  aria-hidden
                                  className='h-2.5 w-full rounded-full bg-teal-50 dark:bg-teal-500/10'
                                >
                                  <div
                                    className='h-full rounded-full bg-teal-500'
                                    style={{
                                      width: `${(value / baseline) * 100}%`,
                                    }}
                                  />
                                </div>
                              </>
                            ) : null}
                          </td>
                          <td className='px-3 py-3 tabular-nums'>
                            {rate(
                              complete && previous.availability === 'available'
                                ? step.fromPrevious
                                : null,
                            )}
                          </td>
                          <td className='px-3 py-3 tabular-nums'>
                            {rate(
                              complete && first.availability === 'available'
                                ? step.fromFirst
                                : null,
                            )}
                          </td>
                          <td className='px-3 py-3 whitespace-nowrap'>
                            {step.availability === 'unavailable'
                              ? unavailableLabel
                              : l(`metric_${step.availability}`)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {showOutcomes ? (
                <BusinessFlowOutcomes
                  path={path}
                  labels={labels}
                  language={language}
                />
              ) : null}
              <div className='mt-4 space-y-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400'>
                {path.coverage.limitations?.map((limitation) => (
                  <p
                    key={limitation}
                    className='rounded-md bg-amber-50 p-3 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200'
                  >
                    {labels[`flowLimitation_${limitation}`] || limitation}
                  </p>
                ))}
                {path.coverage.missingEvents.length ? (
                  <p>
                    {l('flowMissingEvents')}{' '}
                    {path.coverage.missingEvents.map((event, index) => (
                      <span key={event}>
                        {index ? ', ' : ''}
                        {labels[`flowMissingEvent_${event}`] ? (
                          <span title={event}>
                            {labels[`flowMissingEvent_${event}`]}
                          </span>
                        ) : (
                          <code>{event}</code>
                        )}
                      </span>
                    ))}
                  </p>
                ) : null}
                <p>
                  {l('flowExcluded')} {count(path.coverage.excluded)}
                </p>
                {path.pending ? <p>{l('flowPendingHint')}</p> : null}
              </div>
            </div>
          </details>
        )
      })}
    </div>
  )
}
