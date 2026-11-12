import type { FlowFunnel, Labels } from '../Business/types'
import { FLOW_OUTCOME_IDS } from '~/utils/novixFunnels'

export default function BusinessFlowOutcomes({
  path,
  labels,
  language,
}: {
  path: FlowFunnel
  labels: Labels
  language: string
}) {
  const l = (key: string) => labels[key] || key
  const number = new Intl.NumberFormat(language)
  const unit = l(`flowUnit_${path.unit}`)
  const known = path.availability !== 'unavailable'
  return (
    <div className='mt-5 grid gap-5 lg:grid-cols-2'>
      <section aria-label={l('flowOutcomes')}>
        <h5 className='font-medium text-gray-900 dark:text-gray-50'>
          {l('flowOutcomes')} · {unit}
        </h5>
        <p className='mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400'>
          {l('flowOutcomesOverlap')}
        </p>
        <table className='mt-2 w-full text-left text-sm text-gray-800 dark:text-gray-200'>
          <caption className='sr-only'>
            {l('flowOutcomes')} · {unit}
          </caption>
          <tbody className='divide-y divide-gray-100 dark:divide-slate-800/60'>
            {FLOW_OUTCOME_IDS.map((status) => (
              <tr key={status}>
                <th scope='row' className='px-3 py-2 font-normal'>
                  {l(`flowOutcome_${status}`)}
                </th>
                <td className='px-3 py-2 text-right tabular-nums'>
                  {known ? number.format(path.outcomes[status]) : l('unknown')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section aria-label={l('flowExits')}>
        <h5 className='font-medium text-gray-900 dark:text-gray-50'>
          {l('flowExits')} · {unit}
        </h5>
        {known && path.exits.length ? (
          <table className='mt-2 w-full text-left text-sm text-gray-800 dark:text-gray-200'>
            <caption className='sr-only'>
              {l('flowExits')} · {unit}
            </caption>
            <tbody className='divide-y divide-gray-100 dark:divide-slate-800/60'>
              {path.exits.map((exit) => (
                <tr key={exit.route}>
                  <th scope='row' className='px-3 py-2 font-normal'>
                    <code className='break-all'>{exit.route}</code>
                  </th>
                  <td className='px-3 py-2 text-right tabular-nums'>
                    {number.format(exit.count)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className='mt-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400'>
            {l(known ? 'flowNoObservedExits' : 'unknown')}
          </p>
        )}
      </section>
    </div>
  )
}
