import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'

import DashboardHeader from '~/pages/Project/View/components/DashboardHeader'
import { useViewProjectContext } from '~/pages/Project/View/ViewProject'
import Button from '~/ui/Button'
import Input from '~/ui/Input'
import Loader from '~/ui/Loader'
import Select from '~/ui/Select'
import {
  BUSINESS_FILTER_DEFAULTS,
  businessQueryParams,
  readBusinessFilters,
  updateBusinessFilters,
  type BusinessFilters,
} from '~/utils/novixAnalytics'

import { ProductSections, ResourceSections } from './BusinessSections'
import en from './en.json'
import type {
  BusinessFeature,
  Labels,
  ProductReport,
  ResourceOverview,
} from './types'
import zh from './zh.json'

const supportedPeriods = new Set([
  '1h',
  'today',
  'yesterday',
  '1d',
  '7d',
  '4w',
  '3M',
  'custom',
])
const basicFilters = new Set(['feature', 'internalTraffic', 'mode'])

class ReportError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code)
  }
}

async function readReport<T extends ProductReport | ResourceOverview>(
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
  ) {
    throw new ReportError(502, 'invalid_report')
  }
  return report
}

function FiltersForm({
  initial,
  features,
  labels,
  onApply,
}: {
  initial: BusinessFilters
  features: BusinessFeature[]
  labels: Labels
  onApply: (filters: BusinessFilters) => void
}) {
  const [draft, setDraft] = useState(initial)
  const [expanded, setExpanded] = useState(() =>
    Object.entries(initial).some(
      ([key, value]) =>
        !basicFilters.has(key) &&
        value !== BUSINESS_FILTER_DEFAULTS[key as keyof BusinessFilters],
    ),
  )
  const l = (key: string) => labels[key] || key
  const set = (key: keyof BusinessFilters, value: string) =>
    setDraft((current) => ({
      ...current,
      [key]: value,
      ...(key === 'feature' && value === 'all' ? { version: '' } : {}),
    }))
  const select = (key: keyof BusinessFilters, choices: [string, string][]) => {
    const items = choices.map(([value, label]) => ({ value, label }))
    const selected = items.find((item) => item.value === draft[key]) || {
      value: draft[key],
      label: draft[key],
    }
    return (
      <Select
        key={key}
        label={l(key)}
        title={selected.label}
        items={items}
        selectedItem={selected}
        keyExtractor={(item) => item.value}
        labelExtractor={(item) => item.label}
        onSelect={(item) => set(key, item.value)}
      />
    )
  }
  const all: [string, string] = ['all', l('all')]
  return (
    <form
      className='mb-5 rounded-lg border border-gray-200 bg-gray-50/60 p-4 dark:border-slate-800/60 dark:bg-slate-900/25'
      onSubmit={(event) => {
        event.preventDefault()
        onApply(draft)
      }}
    >
      <div className='grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-5'>
        {select('feature', [
          all,
          ...features.map(
            (feature) => [feature.id, feature.label] as [string, string],
          ),
        ])}
        {select('internalTraffic', [
          ['', l('environmentDefault')],
          all,
          ['external', l('external')],
          ['internal', l('internal')],
        ])}
        {select('mode', [
          all,
          ['task', 'Task'],
          ['discuss', 'Discuss'],
          ['deep', 'Deep'],
        ])}
        <Button
          variant='secondary'
          aria-expanded={expanded}
          aria-controls='novix-business-more-filters'
          onClick={() => setExpanded(!expanded)}
        >
          {l('moreFilters')}
        </Button>
        <Button type='submit'>{l('apply')}</Button>
      </div>
      {expanded ? (
        <div
          id='novix-business-more-filters'
          className='mt-4 grid items-start gap-3 border-t border-gray-200 pt-4 sm:grid-cols-2 xl:grid-cols-4 dark:border-slate-800'
        >
          {select('computeType', [
            all,
            ['cpu', 'CPU'],
            ['gpu', 'GPU'],
            ['unknown', l('unknown')],
          ])}
          {select('device', [
            all,
            ...['desktop', 'mobile', 'tablet', 'unknown'].map(
              (value) => [value, l(value)] as [string, string],
            ),
          ])}
          {select('userType', [
            all,
            ['new', l('newAccount')],
            ['returning', l('existingAccount')],
          ])}
          {select('attribution', [
            ['session', l('sessionAttribution')],
            ['first', l('firstAttribution')],
          ])}
          <Input
            label={l('version')}
            value={draft.version}
            maxLength={100}
            disabled={draft.feature === 'all'}
            hint={draft.feature === 'all' ? l('versionHint') : undefined}
            onChange={(event) => set('version', event.target.value)}
          />
          {(['source', 'medium', 'campaign'] as const).map((key) => (
            <Input
              key={key}
              label={l(key)}
              value={draft[key]}
              maxLength={100}
              onChange={(event) => set(key, event.target.value)}
            />
          ))}
        </div>
      ) : null}
    </form>
  )
}

export default function BusinessView({ projectId }: { projectId: string }) {
  const { i18n } = useTranslation('common')
  const language = (i18n.resolvedLanguage || i18n.language).startsWith('zh')
    ? 'zh'
    : 'en'
  const labels: Labels = language === 'zh' ? zh : en
  const l = (key: string) => labels[key] || key
  const [searchParams, setSearchParams] = useSearchParams()
  const { period, timeBucket, timezone, periodPairs } = useViewProjectContext()
  const query = businessQueryParams({
    searchParams,
    period,
    timeBucket,
    timezone,
  })
  const productSearch = query.toString()
  const resources = new URLSearchParams(query)
  for (const key of Object.keys(BUSINESS_FILTER_DEFAULTS)) resources.delete(key)
  const resourceSearch = resources.toString()
  const root = `/novix/api/v1/projects/${encodeURIComponent(projectId)}`
  const options = {
    staleTime: 30_000,
    retry: false as const,
    refetchOnWindowFocus: false,
  }
  const product = useQuery({
    ...options,
    queryKey: ['novix-business', projectId, 'product', productSearch],
    queryFn: ({ signal }) =>
      readReport<ProductReport>(
        `${root}/product/report?${productSearch}`,
        signal,
      ),
  })
  const overview = useQuery({
    ...options,
    queryKey: ['novix-business', projectId, 'resources', resourceSearch],
    queryFn: ({ signal }) =>
      readReport<ResourceOverview>(
        `${root}/business/overview?${resourceSearch}`,
        signal,
      ),
  })
  const report = product.data || overview.data
  const errorMessage = (error: Error) => {
    if (!(error instanceof ReportError)) return l('error_generic')
    return (
      labels[`error_${error.code}`] ||
      labels[`error_${error.status}`] ||
      l('error_generic')
    )
  }
  const filters = readBusinessFilters(searchParams)
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(language, {
      timeZone: timezone,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))

  return (
    <div>
      <DashboardHeader
        showLiveVisitors={false}
        showSearchButton={false}
        hideTimeBucket
        showComparison={false}
        timeBucketSelectorItems={periodPairs.filter((pair) =>
          supportedPeriods.has(pair.period),
        )}
        leftContent={
          <div className='flex flex-wrap items-center gap-2'>
            <h2 className='text-lg font-semibold text-gray-900 dark:text-gray-50'>
              {l('title')}
            </h2>
            {report ? (
              <span className='rounded-md bg-teal-50 px-2 py-1 text-xs font-medium text-teal-800 dark:bg-teal-500/10 dark:text-teal-200'>
                {l(report.environment)}
              </span>
            ) : null}
          </div>
        }
      />
      <FiltersForm
        key={JSON.stringify(filters)}
        initial={filters}
        features={product.data?.features || []}
        labels={labels}
        onApply={(next) =>
          setSearchParams(updateBusinessFilters(searchParams, next))
        }
      />
      {report ? (
        <p className='mb-4 text-xs leading-relaxed text-gray-500 dark:text-gray-400'>
          {formatDate(report.resolvedRange.startInclusive)} –{' '}
          {formatDate(report.resolvedRange.endExclusive)} · {timezone}
          <span className='mx-2'>·</span>
          {l('snapshot')} {formatDate(report.snapshotAt)}
        </p>
      ) : null}
      {product.isFetching || overview.isFetching ? (
        <Loader className='pt-2! pb-5' label={l('loading')} showLabel />
      ) : null}
      {product.error ? (
        <div
          role='alert'
          className='mb-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200'
        >
          <p className='mb-3'>{errorMessage(product.error)}</p>
          {product.error instanceof ReportError &&
          product.error.status === 401 ? (
            <Button to='/login'>{l('login')}</Button>
          ) : (
            <Button variant='secondary' onClick={() => product.refetch()}>
              {l('retry')}
            </Button>
          )}
        </div>
      ) : null}
      {product.data ? (
        <ProductSections
          report={product.data}
          labels={labels}
          language={language}
        />
      ) : null}
      <div className='mt-6'>
        {overview.error ? (
          <div
            role='alert'
            className='mb-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200'
          >
            <p className='mb-3'>
              {l('partialResources')} {errorMessage(overview.error)}
            </p>
            <Button variant='secondary' onClick={() => overview.refetch()}>
              {l('retry')}
            </Button>
          </div>
        ) : null}
        {overview.data ? (
          <ResourceSections
            report={overview.data}
            labels={labels}
            language={language}
          />
        ) : null}
      </div>
    </div>
  )
}
