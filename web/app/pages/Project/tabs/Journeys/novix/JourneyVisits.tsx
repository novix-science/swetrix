import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import Button from '~/ui/Button'
import Loader from '~/ui/Loader'

import { readJourney } from './api'
import { routeLabel, type JourneyLabels } from './model'
import type { JourneyVisits as VisitsReport } from './types'

export function Pagination({
  skip,
  total,
  take,
  onChange,
  labels: l,
}: {
  skip: number
  total: number
  take: number
  onChange: (value: number) => void
  labels: JourneyLabels
}) {
  return (
    <div className='my-4 flex flex-wrap items-center justify-end gap-3 text-sm text-gray-500 dark:text-gray-400'>
      <span>
        {Math.min(skip + 1, total)}–{Math.min(skip + take, total)} /{' '}
        {total.toLocaleString()}
      </span>
      <Button
        variant='secondary'
        size='sm'
        disabled={!skip}
        onClick={() => onChange(Math.max(0, skip - take))}
      >
        {l.previous}
      </Button>
      <Button
        variant='secondary'
        size='sm'
        disabled={skip + take >= total || skip + take > 10000}
        onClick={() => onChange(skip + take)}
      >
        {l.next}
      </Button>
    </div>
  )
}

export default function JourneyVisits({
  root,
  query,
  labels: l,
  timezone,
  language,
  refresh,
}: {
  root: string
  query: string
  labels: JourneyLabels
  timezone: string
  language: string
  refresh: number
}) {
  const [skip, setSkip] = useState(0)
  const params = new URLSearchParams(query)
  params.set('take', '20')
  params.set('skip', String(skip))
  const path = `${root}/visits?${params}`
  const visits = useQuery({
    queryKey: ['novix-journeys-visits', path, refresh],
    queryFn: ({ signal }) => readJourney<VisitsReport>(path, signal),
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const format = (value: string) =>
    new Intl.DateTimeFormat(language, {
      timeZone: timezone,
      dateStyle: 'medium',
      timeStyle: 'medium',
    }).format(new Date(value))
  return (
    <section className='mt-7'>
      <h3 className='text-lg font-semibold'>{l.visitsTitle}</h3>
      <p className='mt-1 mb-4 text-sm text-gray-500 dark:text-gray-400'>
        {l.visitsHint}
      </p>
      {visits.isFetching ? (
        <Loader className='py-4' label={l.loading} showLabel />
      ) : null}
      {visits.error ? (
        <div
          role='alert'
          className='rounded-lg bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200'
        >
          {l.error}{' '}
          <Button size='sm' variant='ghost' onClick={() => visits.refetch()}>
            {l.retry}
          </Button>
        </div>
      ) : null}
      {visits.data?.visits.map((visit) => (
        <details
          key={`${visit.visitId}:${visit.profileId}`}
          className='mb-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950'
        >
          <summary className='cursor-pointer text-sm'>
            <span className='font-medium'>{format(visit.startedAt)}</span>
            <span className='mx-3 text-gray-500 dark:text-gray-400'>
              {visit.profileId.replace(/^usr_/, '')} · {visit.pageviews}{' '}
              {l.page}
            </span>
            {visit.startsBeforeRange ? (
              <span className='mr-3 text-amber-700 dark:text-amber-300'>
                {l.rangeStart}
              </span>
            ) : null}
            {visit.uncertainEnd ? (
              <span className='text-amber-700 dark:text-amber-300'>
                {l.rangeEnd}
              </span>
            ) : null}
            {visit.ambiguousOrder ? (
              <span className='ml-3 text-amber-700 dark:text-amber-300'>
                {l.ambiguousVisit}
              </span>
            ) : null}
          </summary>
          <ol className='mt-4 space-y-3 border-l border-gray-200 pl-4 dark:border-slate-700'>
            {visit.pages.slice(0, 500).map((page, index) => (
              <li key={index} className='text-sm'>
                <div className='flex flex-wrap gap-x-3'>
                  <span className='font-medium'>
                    {index + 1}. {routeLabel(page.route, l)}
                  </span>
                  <time
                    className='text-xs text-gray-500 dark:text-gray-400'
                    dateTime={page.at}
                  >
                    {format(page.at)}
                  </time>
                </div>
                <div className='mt-1 font-mono text-xs break-all text-gray-500 dark:text-gray-400'>
                  {page.rawPath}
                </div>
              </li>
            ))}
          </ol>
          {visit.pageviews > 500 ? (
            <p className='mt-3 text-xs text-amber-700 dark:text-amber-300'>
              {l.pageLimit}
            </p>
          ) : null}
        </details>
      ))}
      {visits.data ? (
        <Pagination
          skip={skip}
          take={20}
          total={visits.data.totalSessions}
          onChange={setSkip}
          labels={l}
        />
      ) : null}
    </section>
  )
}
