import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'

import DashboardHeader from '~/pages/Project/View/components/DashboardHeader'
import {
  useRefreshTriggers,
  useViewProjectContext,
} from '~/pages/Project/View/ViewProject'
import Button from '~/ui/Button'
import Loader from '~/ui/Loader'
import Select from '~/ui/Select'

import JourneysView from '../JourneysView'

import { JourneyError, journeyQuery, readJourney } from './api'
import JourneyVisits, { Pagination } from './JourneyVisits'
import {
  labelsFor,
  percent,
  readJourneyView,
  readSelectedPath,
  type JourneyLabels,
} from './model'
import {
  ConversionTable,
  JourneyFlow,
  PathLabel,
  PathsTable,
} from './PathViews'
import type {
  JourneyConversion,
  JourneyLanguage,
  JourneyPaths,
  JourneyView,
} from './types'
import UserScope from './UserScope'

const supportedPeriods = new Set([
  '1h',
  'today',
  'yesterday',
  '1d',
  '7d',
  '4w',
  '3M',
  '12M',
  '24M',
  'custom',
])

function JourneyViewTabs({
  view,
  labels: l,
  onChange,
}: {
  view: JourneyView
  labels: JourneyLabels
  onChange: (view: JourneyView) => void
}) {
  return (
    <fieldset
      className='inline-flex min-w-0 flex-wrap gap-1 rounded-lg bg-gray-100 p-1 dark:bg-slate-900'
      aria-label={l.title}
    >
      {(['list', 'flow', 'conversion', 'original'] as const).map((value) => (
        <Button
          key={value}
          size='sm'
          variant={view === value ? 'white' : 'ghost'}
          aria-pressed={view === value}
          onClick={() => onChange(value)}
        >
          {l[value]}
        </Button>
      ))}
    </fieldset>
  )
}

export default function NovixJourneysView({
  projectId,
  tnMapping,
}: {
  projectId: string
  tnMapping: Record<string, string>
}) {
  const { i18n } = useTranslation('common')
  const [searchParams, setSearchParams] = useSearchParams()
  const l = labelsFor(
    (i18n.resolvedLanguage || i18n.language).startsWith('zh') ? 'zh' : 'en',
  )
  if (readJourneyView(searchParams) !== 'original') {
    return <NovixJourneyReport projectId={projectId} />
  }
  return (
    <>
      <div className='mb-5'>
        <JourneyViewTabs
          view='original'
          labels={l}
          onChange={(view) => {
            const params = new URLSearchParams(searchParams)
            params.set('journeyView', view)
            setSearchParams(params, { preventScrollReset: true })
          }}
        />
        <p className='mt-3 text-sm leading-relaxed text-gray-500 dark:text-gray-400'>
          {l.originalHint}
        </p>
      </div>
      <JourneysView tnMapping={tnMapping} />
    </>
  )
}

function NovixJourneyReport({ projectId }: { projectId: string }) {
  const { i18n } = useTranslation('common')
  const language: JourneyLanguage = (
    i18n.resolvedLanguage || i18n.language
  ).startsWith('zh')
    ? 'zh'
    : 'en'
  const l = labelsFor(language)
  const [searchParams, setSearchParams] = useSearchParams()
  const { period, timeBucket, timezone, periodPairs } = useViewProjectContext()
  const { journeysRefreshTrigger } = useRefreshTriggers()
  const base = journeyQuery({ searchParams, period, timeBucket, timezone })
  const profile = base.get('profile') || ''
  const depthValue = Number(searchParams.get('journeyDepth'))
  const depth = depthValue >= 1 && depthValue <= 10 ? Math.floor(depthValue) : 5
  base.set('depth', String(depth))
  const baseQuery = base.toString()
  const selectedPath = readSelectedPath(searchParams.get('journeyPath'))
  const selectedKey = JSON.stringify(selectedPath)
  const view = readJourneyView(searchParams)
  const [pagination, setPagination] = useState({ query: '', skip: 0 })
  const skip = pagination.query === baseQuery ? pagination.skip : 0
  const setSkip = (value: number) =>
    setPagination({ query: baseQuery, skip: value })
  const root = `/novix/api/v1/projects/${encodeURIComponent(projectId)}/journeys`
  const listParams = new URLSearchParams(base)
  listParams.set('take', view === 'flow' ? '100' : '20')
  listParams.set('skip', view === 'flow' ? '0' : String(skip))
  const path = `${root}/paths?${listParams}`
  const common = {
    staleTime: 30_000,
    retry: false as const,
    refetchOnWindowFocus: false,
  }
  const paths = useQuery({
    ...common,
    queryKey: ['novix-journey-paths', path, journeysRefreshTrigger],
    queryFn: ({ signal }) => readJourney<JourneyPaths>(path, signal),
  })
  const detailParams = new URLSearchParams(base)
  if (selectedPath.length) {
    detailParams.set('path', selectedKey)
    detailParams.set('depth', String(selectedPath.length))
  }
  const detailQuery = detailParams.toString()
  const conversion = useQuery({
    ...common,
    queryKey: [
      'novix-journey-conversion',
      projectId,
      detailQuery,
      journeysRefreshTrigger,
    ],
    queryFn: ({ signal }) =>
      readJourney<JourneyConversion>(
        `${root}/conversion?${detailQuery}`,
        signal,
      ),
    enabled: view === 'conversion' && selectedPath.length > 0,
  })
  const update = (values: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(values)) {
      if (value === null) params.delete(key)
      else params.set(key, value)
    }
    setSearchParams(params, { preventScrollReset: true })
  }
  const inspect = (selected: string[]) =>
    update({ journeyPath: JSON.stringify(selected), journeyView: 'conversion' })
  const shownSessions =
    paths.data?.paths.reduce((sum, item) => sum + item.sessions, 0) || 0
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(language, {
      timeZone: timezone,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))

  return (
    <div className='text-gray-900 dark:text-gray-50'>
      <DashboardHeader
        showLiveVisitors={false}
        showSearchButton={false}
        hideTimeBucket
        showComparison={false}
        timeBucketSelectorItems={periodPairs.filter((pair) =>
          supportedPeriods.has(pair.period),
        )}
        leftContent={<h2 className='text-lg font-semibold'>{l.title}</h2>}
      />
      <UserScope
        key={`${projectId}:${profile}`}
        root={root}
        query={baseQuery}
        profile={profile}
        labels={l}
        onSelect={(user) => {
          setSkip(0)
          update({
            journeyProfile: user?.profileId || null,
            journeyPath:
              view === 'conversion' && selectedPath.length ? selectedKey : null,
          })
        }}
      />
      <div className='mb-5 flex flex-wrap items-end justify-between gap-3'>
        <JourneyViewTabs
          view={view}
          labels={l}
          onChange={(value) => update({ journeyView: value })}
        />
        <Select
          className='min-w-24'
          labelClassName='whitespace-nowrap'
          title={String(depth)}
          label={l.depth}
          items={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
          selectedItem={depth}
          keyExtractor={(item) => String(item)}
          labelExtractor={(item) => String(item)}
          onSelect={(value) => {
            setSkip(0)
            update({ journeyDepth: String(value), journeyPath: null })
          }}
        />
      </div>
      <p className='mb-4 text-sm leading-relaxed text-gray-500 dark:text-gray-400'>
        {l.definition}
      </p>
      {paths.data ? (
        <>
          <p className='mb-4 text-xs text-gray-500 dark:text-gray-400'>
            {l.range}: {formatDate(paths.data.resolvedRange.startInclusive)} –{' '}
            {formatDate(paths.data.resolvedRange.endExclusive)} · {timezone}
          </p>
          <div className='mb-5 grid grid-cols-3 gap-3'>
            {[
              [l.sessions, paths.data.totalSessions],
              [l.users, paths.data.totalUsers],
              [l.paths, paths.data.totalPaths],
            ].map(([label, count]) => (
              <div
                key={label}
                className='rounded-lg border border-gray-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950'
              >
                <div className='text-2xl font-semibold tabular-nums'>
                  {Number(count).toLocaleString()}
                </div>
                <div className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
                  {label}
                </div>
              </div>
            ))}
          </div>
          {paths.data.coverage.startsBeforeRange ||
          paths.data.coverage.uncertainEnd ? (
            <p className='mb-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200'>
              {l.boundary}
            </p>
          ) : null}
          {paths.data.coverage.pageLimitVisits ? (
            <p className='mb-4 text-xs text-amber-800 dark:text-amber-200'>
              {l.pageLimit}
            </p>
          ) : null}
          {paths.data.coverage.ambiguousOrderVisits ? (
            <p className='mb-4 text-xs text-amber-800 dark:text-amber-200'>
              {l.ambiguousOrder} {paths.data.coverage.ambiguousOrderVisits}
            </p>
          ) : null}
        </>
      ) : null}
      {paths.isFetching ? (
        <Loader className='py-6' label={l.loading} showLabel />
      ) : null}
      {paths.error ? (
        <div
          role='alert'
          className='mb-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200'
        >
          {paths.error instanceof JourneyError &&
          paths.error.code === 'invalid_analytics_range'
            ? l.rangeError
            : l.error}{' '}
          <Button size='sm' variant='ghost' onClick={() => paths.refetch()}>
            {l.retry}
          </Button>
        </div>
      ) : null}
      {paths.data?.totalSessions === 0 ? (
        <p className='py-12 text-center text-gray-500 dark:text-gray-400'>
          {l.empty}
        </p>
      ) : null}
      {paths.data && paths.data.totalSessions > 0 && view !== 'conversion' ? (
        <>
          <p className='mb-3 text-xs text-gray-500 dark:text-gray-400'>
            {l.ranking}: {shownSessions} / {paths.data.totalSessions} (
            {percent(shownSessions, paths.data.totalSessions)})
          </p>
          {view === 'list' ? (
            <>
              <PathsTable
                report={paths.data}
                labels={l}
                selected={selectedPath}
                onSelect={inspect}
              />
              <Pagination
                skip={skip}
                total={paths.data.totalPaths}
                take={20}
                onChange={setSkip}
                labels={l}
              />
            </>
          ) : (
            <>
              <JourneyFlow paths={paths.data.paths} labels={l} />
              <div className='mt-4'>
                <PathsTable
                  report={paths.data}
                  labels={l}
                  selected={selectedPath}
                  onSelect={inspect}
                />
              </div>
            </>
          )}
        </>
      ) : null}
      {view === 'conversion' ? (
        selectedPath.length ? (
          <section>
            <h3 className='mb-3 text-base font-semibold'>{l.selectedPath}</h3>
            <div className='mb-3 rounded-lg bg-blue-50 p-4 text-sm text-blue-900 dark:bg-blue-500/10 dark:text-blue-100'>
              <PathLabel path={selectedPath} labels={l} />
            </div>
            <p className='mb-4 text-sm text-gray-500 dark:text-gray-400'>
              {l.conversionHint}
            </p>
            {conversion.isFetching ? <Loader className='py-4' /> : null}
            {conversion.error ? (
              <p
                role='alert'
                className='mb-3 text-sm text-amber-800 dark:text-amber-200'
              >
                {l.error}{' '}
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => conversion.refetch()}
                >
                  {l.retry}
                </Button>
              </p>
            ) : null}
            {conversion.data ? (
              <ConversionTable report={conversion.data} labels={l} />
            ) : null}
          </section>
        ) : (
          <div className='rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500 dark:border-slate-700 dark:text-gray-400'>
            {l.choosePath}{' '}
            <Button
              className='ml-3'
              variant='secondary'
              size='sm'
              onClick={() => update({ journeyView: 'list' })}
            >
              {l.list}
            </Button>
          </div>
        )
      ) : null}
      {(profile || (view === 'conversion' && selectedPath.length > 0)) &&
      !paths.isFetching ? (
        <JourneyVisits
          key={detailQuery}
          root={root}
          query={view === 'conversion' ? detailQuery : baseQuery}
          labels={l}
          timezone={timezone}
          language={language}
          refresh={journeysRefreshTrigger}
        />
      ) : null}
    </div>
  )
}
