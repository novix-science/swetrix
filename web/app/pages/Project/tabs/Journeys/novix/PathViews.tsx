import { ResponsiveSankey } from '@nivo/sankey'
import { useMemo } from 'react'

import { useTheme } from '~/providers/ThemeProvider'
import Button from '~/ui/Button'

import {
  flowData,
  percent,
  routeColour,
  routeLabel,
  type JourneyLabels,
} from './model'
import type { JourneyConversion, JourneyPath, JourneyPaths } from './types'

export function PathLabel({
  path,
  labels,
  continued = false,
}: {
  path: string[]
  labels: JourneyLabels
  continued?: boolean
}) {
  return (
    <span className='flex flex-wrap items-center gap-x-2 gap-y-1'>
      {path.map((route, index) => (
        <span
          className='inline-flex items-center gap-2'
          key={`${index}:${route}`}
        >
          {index > 0 ? (
            <span className='text-gray-400' aria-hidden>
              →
            </span>
          ) : null}
          <span title={route}>{routeLabel(route, labels)}</span>
        </span>
      ))}
      {continued ? (
        <span title={labels.continued} className='text-gray-400'>
          → …
        </span>
      ) : null}
    </span>
  )
}

export function PathsTable({
  report,
  labels: l,
  onSelect,
  selected,
}: {
  report: JourneyPaths
  labels: JourneyLabels
  onSelect: (path: string[]) => void
  selected: string[]
}) {
  return (
    <div className='overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-800'>
      <table className='w-full text-left text-sm'>
        <thead className='bg-gray-50 text-gray-600 dark:bg-slate-900 dark:text-gray-300'>
          <tr>
            {[l.path, l.sessions, l.users, l.share, ''].map((label, index) => (
              <th key={index} scope='col' className='px-4 py-3 font-medium'>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className='divide-y divide-gray-100 dark:divide-slate-800'>
          {report.paths.map((item) => (
            <tr
              key={JSON.stringify(item.path)}
              className={
                JSON.stringify(item.path) === JSON.stringify(selected)
                  ? 'bg-blue-50 dark:bg-blue-500/10'
                  : 'bg-white dark:bg-slate-950'
              }
            >
              <td className='min-w-64 px-4 py-4'>
                <PathLabel
                  path={item.path}
                  labels={l}
                  continued={item.continued > 0}
                />
              </td>
              <td className='px-4 py-4 tabular-nums'>
                {item.sessions.toLocaleString()}
              </td>
              <td className='px-4 py-4 tabular-nums'>
                {item.users.toLocaleString()}
              </td>
              <td className='px-4 py-4 tabular-nums'>
                {percent(item.sessions, report.totalSessions)}
              </td>
              <td className='px-4 py-4'>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => onSelect(item.path)}
                >
                  {l.inspect}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function JourneyFlow({
  paths,
  labels: l,
}: {
  paths: JourneyPath[]
  labels: JourneyLabels
}) {
  const { theme } = useTheme()
  const data = useMemo(() => flowData(paths, l), [paths, l])
  if (!data.links.length) return null
  return (
    <div className='h-[580px] overflow-x-auto rounded-lg border border-gray-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950'>
      <div className='h-full min-w-[720px]'>
        <ResponsiveSankey
          data={data}
          margin={{ top: 24, right: 155, bottom: 24, left: 155 }}
          label={(node) =>
            data.nodes.find((item) => item.id === node.id)?.label || node.id
          }
          colors={(node) =>
            routeColour(node.id.slice(node.id.indexOf(':') + 1))
          }
          nodeThickness={12}
          nodeSpacing={18}
          nodeOpacity={1}
          linkOpacity={0.2}
          labelPadding={12}
          labelTextColor={theme === 'dark' ? '#e2e8f0' : '#334155'}
          theme={{
            text: { fill: theme === 'dark' ? '#e2e8f0' : '#334155' },
            tooltip: {
              container: {
                background: theme === 'dark' ? '#0f172a' : '#fff',
                color: theme === 'dark' ? '#fff' : '#0f172a',
              },
            },
          }}
          animate={false}
        />
      </div>
    </div>
  )
}

export function ConversionTable({
  report,
  labels: l,
}: {
  report: JourneyConversion
  labels: JourneyLabels
}) {
  return (
    <div className='overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-950'>
      <table className='w-full text-left text-sm'>
        <thead className='bg-gray-50 text-gray-600 dark:bg-slate-900 dark:text-gray-300'>
          <tr>
            {[
              l.step,
              l.arrivals,
              l.users,
              l.stepRate,
              l.nextMatched,
              l.otherNext,
              l.ended,
              l.unknown,
            ].map((label) => (
              <th key={label} scope='col' className='px-4 py-3 font-medium'>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className='divide-y divide-gray-100 dark:divide-slate-800'>
          {report.steps.map((step, index) => (
            <tr key={step.step}>
              <th
                scope='row'
                className='min-w-48 px-4 py-4 font-medium'
                title={step.route}
              >
                {step.step}. {routeLabel(step.route, l)}
              </th>
              <td className='px-4 py-4 tabular-nums'>{step.sessions}</td>
              <td className='px-4 py-4 tabular-nums'>{step.users}</td>
              <td className='px-4 py-4 tabular-nums'>
                {index
                  ? percent(step.sessions, report.steps[index - 1].sessions)
                  : '—'}
              </td>
              <td className='px-4 py-4 tabular-nums'>
                {index < report.steps.length - 1 ? step.matchedNext : '—'}
              </td>
              <td className='px-4 py-4 tabular-nums'>
                {Math.max(
                  0,
                  step.continued -
                    (index < report.steps.length - 1 ? step.matchedNext : 0),
                )}
              </td>
              <td className='px-4 py-4 tabular-nums'>{step.ended}</td>
              <td className='px-4 py-4 tabular-nums'>{step.unknown}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
