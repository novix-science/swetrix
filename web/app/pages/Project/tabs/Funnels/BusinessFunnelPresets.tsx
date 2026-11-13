import { useQuery } from '@tanstack/react-query'
import { FunnelIcon } from '@phosphor-icons/react'
import dayjs, { type OpUnitType } from 'dayjs'
import timezonePlugin from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'

import BusinessFlowFunnels from './BusinessFlowFunnels'
import OperationalFlowFunnels from './OperationalFlowFunnels'
import { readFlowReport } from './report'
import en from '../Business/en.json'
import { ReportError } from '../Business/report'
import type { Labels } from '../Business/types'
import zh from '../Business/zh.json'
import { useViewProjectContext } from '../../View/ViewProject'
import Button from '~/ui/Button'
import Loader from '~/ui/Loader'
import Select from '~/ui/Select'
import { NOVIX_BUSINESS_TAB } from '~/utils/novixAnalytics'
import {
  BUSINESS_FUNNEL_PERIODS,
  NOVIX_FUNNEL_PRESETS,
  FUNNEL_FILTER_OPTIONS,
  businessFunnelQuery,
  getNovixFunnel,
  readFlowFunnels,
  readFunnelFilters,
  selectNovixFunnel,
  updateFunnelFilter,
} from '~/utils/novixFunnels'

dayjs.extend(utc)
dayjs.extend(timezonePlugin)

function customRangeDays(
  params: URLSearchParams,
  timezone: string,
  timeBucket: string,
) {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/
  if (
    dateOnly.test(params.get('from') || '') &&
    params.get('from') === params.get('to')
  )
    return 1
  const dates = ['from', 'to'].map((key) => {
    const value = params.get(key) || ''
    let date = dayjs.utc(value)
    if (!date.isValid()) return date
    // Date-only bounds include the full selected bucket in the date bridge.
    if (dateOnly.test(value)) {
      date =
        key === 'from'
          ? date.startOf(timeBucket as OpUnitType)
          : date.endOf(timeBucket as OpUnitType)
    }
    return dayjs.utc(date.tz(timezone).format('YYYY-MM-DD'))
  })
  return dates[1].diff(dates[0], 'day') + 1
}

export default function BusinessFunnelPresets({
  projectId,
}: {
  projectId: string
}) {
  const { i18n } = useTranslation('common')
  const language = (i18n.resolvedLanguage || i18n.language).startsWith('zh')
    ? 'zh'
    : 'en'
  const labels: Labels = language === 'zh' ? zh : en
  const l = (key: string) => labels[key] || key
  const [searchParams, setSearchParams] = useSearchParams()
  const { period, timeBucket, timezone } = useViewProjectContext()
  const preset = getNovixFunnel(searchParams)
  const filters = readFunnelFilters(searchParams)
  const retentionParams = new URLSearchParams(searchParams)
  for (const key of [...retentionParams.keys()]) {
    if (key.startsWith('novix_')) retentionParams.delete(key)
  }
  retentionParams.delete('novixFunnel')
  retentionParams.delete('funnelId')
  retentionParams.set('tab', NOVIX_BUSINESS_TAB)
  retentionParams.set('novix_feature', 'all')
  if (
    !BUSINESS_FUNNEL_PERIODS.has(period) ||
    (period === 'custom' &&
      customRangeDays(searchParams, timezone, timeBucket) > 93)
  ) {
    retentionParams.set('period', '4w')
    retentionParams.delete('from')
    retentionParams.delete('to')
  }
  for (const [key, value] of Object.entries(filters)) {
    if (value) retentionParams.set(`novix_${key}`, value)
  }
  const query = preset
    ? businessFunnelQuery({
        searchParams,
        feature: preset.id,
        period,
        timeBucket,
        timezone,
      }).toString()
    : ''
  const report = useQuery({
    queryKey: ['v2', projectId, 'funnel', 'novix-flow-v1', query],
    enabled: Boolean(preset) && BUSINESS_FUNNEL_PERIODS.has(period),
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => {
      if (!preset) throw new ReportError(502, 'invalid_report')
      return readFlowReport(
        `/novix/api/v1/projects/${encodeURIComponent(projectId)}/product/flows?${query}`,
        preset.id,
        signal,
      )
    },
  })
  const error =
    report.error instanceof ReportError
      ? labels[`error_${report.error.code}`] ||
        labels[`error_${report.error.status}`] ||
        l('error_generic')
      : l('error_generic')

  return (
    <section className='mb-6' aria-label={l('presetFunnels')}>
      <div className='mb-2 flex flex-wrap items-start justify-between gap-3'>
        <h3 className='text-base font-semibold text-gray-900 dark:text-gray-50'>
          {l('presetFunnels')}
        </h3>
        <div className='text-right'>
          <Button
            variant='secondary'
            size='sm'
            to={`?${retentionParams}#novix-product-retention`}
          >
            {l('overallRetention')}
          </Button>
          <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
            {l('retentionFiltersHint')}
          </p>
        </div>
      </div>
      <p className='mb-4 text-sm leading-relaxed text-gray-500 dark:text-gray-400'>
        {l('presetFunnelsHint')}
      </p>
      <div className='grid gap-2 sm:grid-cols-2 xl:grid-cols-4'>
        {NOVIX_FUNNEL_PRESETS.map((item) => (
          <button
            key={item.id}
            type='button'
            aria-expanded={preset?.id === item.id}
            aria-controls={
              preset?.id === item.id
                ? 'novix-business-funnel-details'
                : undefined
            }
            onClick={() =>
              setSearchParams(selectNovixFunnel(searchParams, item.id, period))
            }
            className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:outline-hidden dark:hover:bg-slate-900 ${preset?.id === item.id ? 'border-teal-500 bg-teal-50 text-teal-800 dark:bg-teal-500/10 dark:text-teal-200' : 'border-gray-200 bg-white text-gray-800 dark:border-slate-800 dark:bg-slate-950 dark:text-gray-100'}`}
          >
            <FunnelIcon className='size-4 shrink-0 text-teal-500' aria-hidden />
            {item.label}
          </button>
        ))}
      </div>
      {preset ? (
        <div id='novix-business-funnel-details' className='mt-4'>
          <h3 className='mb-2 text-base font-semibold text-gray-900 dark:text-gray-50'>
            {preset.label}
          </h3>
          <div className='mb-4 grid gap-3 sm:grid-cols-2 lg:max-w-xl'>
            {(
              Object.keys(
                FUNNEL_FILTER_OPTIONS,
              ) as (keyof typeof FUNNEL_FILTER_OPTIONS)[]
            ).map((key) => {
              const choices = FUNNEL_FILTER_OPTIONS[key].map((value) => ({
                value,
                label:
                  value === ''
                    ? l('environmentDefault')
                    : value === 'cpu' || value === 'gpu'
                      ? value.toUpperCase()
                      : l(value),
              }))
              const selected = choices.find(
                (item) => item.value === filters[key],
              )
              return (
                <Select
                  key={key}
                  label={l(key)}
                  title={selected?.label}
                  items={choices}
                  selectedItem={selected}
                  keyExtractor={(item) => item.value}
                  labelExtractor={(item) => item.label}
                  onSelect={(item) =>
                    setSearchParams(
                      updateFunnelFilter(searchParams, key, item.value),
                    )
                  }
                />
              )
            })}
          </div>
          {report.isLoading ? (
            <Loader className='py-5' label={l('loading')} showLabel />
          ) : null}
          {report.error ? (
            <div
              role='alert'
              className='mb-3 rounded-lg bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200'
            >
              <p className='mb-2'>
                {report.data ? `${l('refreshFailed')} ` : ''}
                {error}
              </p>
              <Button variant='secondary' onClick={() => void report.refetch()}>
                {l('retry')}
              </Button>
            </div>
          ) : null}
          {report.data ? (
            <>
              <p className='mb-3 text-xs text-gray-500 dark:text-gray-400'>
                {l(report.data.environment)} · {l('snapshot')}{' '}
                {new Intl.DateTimeFormat(language, {
                  timeZone: timezone,
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(report.data.snapshotAt))}
                {report.isFetching ? (
                  <output className='ml-2'>{l('updating')}</output>
                ) : null}
              </p>
              <p className='mb-3 text-xs leading-relaxed text-gray-500 dark:text-gray-400'>
                {l('presetCoverageHint')}
              </p>
              <BusinessFlowFunnels
                key={query}
                paths={readFlowFunnels(report.data, preset.id)}
                labels={labels}
                language={language}
              />
              <OperationalFlowFunnels
                key={`operational-${query}`}
                report={report.data}
                feature={preset.id}
                labels={labels}
                language={language}
              />
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
