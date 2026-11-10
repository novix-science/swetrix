import { useQuery } from '@tanstack/react-query'
import { FunnelIcon } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'

import { FunnelSection } from '../Business/BusinessSections'
import en from '../Business/en.json'
import { readReport, ReportError } from '../Business/report'
import type { Labels, ProductReport } from '../Business/types'
import zh from '../Business/zh.json'
import { useViewProjectContext } from '../../View/ViewProject'
import Button from '~/ui/Button'
import Loader from '~/ui/Loader'
import {
  BUSINESS_FUNNEL_PERIODS,
  NOVIX_FUNNEL_PRESETS,
  businessFunnelQuery,
  getNovixFunnel,
  selectNovixFunnel,
} from '~/utils/novixFunnels'

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
    queryKey: ['v2', projectId, 'funnel', 'novix', query],
    enabled: Boolean(preset) && BUSINESS_FUNNEL_PERIODS.has(period),
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => {
      const result = await readReport<ProductReport>(
        `/novix/api/v1/projects/${encodeURIComponent(projectId)}/product/report?${query}`,
        signal,
      )
      if (
        result.filters?.feature !== preset?.id ||
        result.funnel?.steps?.map((step) => step.id).join(',') !==
          'workspace,submit,accepted,success,viewed'
      ) {
        throw new ReportError(502, 'invalid_report')
      }
      return result
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
      <h3 className='mb-2 text-base font-semibold text-gray-900 dark:text-gray-50'>
        {l('presetFunnels')}
      </h3>
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
          {report.isFetching ? (
            <Loader className='py-5' label={l('loading')} showLabel />
          ) : null}
          {report.error ? (
            <div
              role='alert'
              className='mb-3 rounded-lg bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200'
            >
              <p className='mb-2'>{error}</p>
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
              </p>
              <FunnelSection
                report={report.data}
                labels={labels}
                language={language}
              />
              <p className='mt-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400'>
                {l('presetCoverageHint')}
              </p>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
