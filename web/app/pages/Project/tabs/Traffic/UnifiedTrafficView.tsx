import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'

import DashboardHeader from '~/pages/Project/View/components/DashboardHeader'
import Button from '~/ui/Button'
import Input from '~/ui/Input'
import Loader from '~/ui/Loader'

import {
  FIRST_HISTORY_DAY,
  historyRange,
  withHistoryRange,
} from './unifiedRange'

type Row = {
  date: string
  source: 'ga4' | 'cloudflare' | 'swetrix'
  pageviews: string | number
  visits: string | number | null
  active_users: string | number | null
  visitors: string | number | null
  sessions: string | number | null
}
type Report = { schemaVersion: number; rows: Row[]; cutoverDate: string }
const sourceName = { ga4: 'GA4', cloudflare: 'Cloudflare', swetrix: 'Swetrix' }

export default function UnifiedTrafficView({
  projectId,
}: {
  projectId: string
}) {
  const { i18n } = useTranslation('common')
  const zh = (i18n.resolvedLanguage || i18n.language).startsWith('zh')
  const [params, setParams] = useSearchParams()
  const range = historyRange(params)
  const [draft, setDraft] = useState(range)
  const [page, setPage] = useState(0)
  const query = useQuery({
    queryKey: ['v2', projectId, 'unified-traffic', range],
    queryFn: async ({ signal }) => {
      const q = new URLSearchParams(range)
      const response = await fetch(
        `/novix/api/v1/projects/${encodeURIComponent(projectId)}/history/unified?${q}`,
        { credentials: 'same-origin', signal },
      )
      if (!response.ok) throw new Error(String(response.status))
      const report: Report = await response.json()
      if (report.schemaVersion !== 1 || !Array.isArray(report.rows))
        throw new Error('invalid_report')
      return report
    },
    retry: false,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })
  const rows = query.data?.rows || []
  const format = (value: string | number | null) =>
    value === null
      ? '—'
      : new Intl.NumberFormat(zh ? 'zh-CN' : 'en-US').format(Number(value))
  const select = (start: string, end: string) => {
    setPage(0)
    setDraft({ start, end })
    setParams(withHistoryRange(params, start, end))
  }
  const latest = historyRange(new URLSearchParams('period=today')).end
  const total = rows.reduce((n, r) => n + Number(r.pageviews), 0)
  const max = Math.max(1, ...rows.map((r) => Number(r.pageviews)))
  const firstDay = rows.length ? Date.parse(rows[0].date) : 0
  const span = rows.length
    ? Math.max(Date.parse(rows[rows.length - 1].date) - firstDay, 86400000)
    : 86400000
  const x = (i: number) =>
    65 + ((Date.parse(rows[i].date) - firstDay) * 900) / span
  const y = (v: number) => 230 - (v / max) * 200
  const segments: string[][] = []
  rows.forEach((r, i) => {
    if (!i || Date.parse(r.date) - Date.parse(rows[i - 1].date) > 86400000)
      segments.push([])
    segments[segments.length - 1].push(`${x(i)},${y(Number(r.pageviews))}`)
  })
  const pageRows = rows
    .slice()
    .reverse()
    .slice(page * 30, (page + 1) * 30)
  const native = () => {
    const next = new URLSearchParams(params)
    next.set('novix_live', '1')
    next.set('period', 'today')
    next.delete('from')
    next.delete('to')
    setParams(next)
  }
  return (
    <>
      <DashboardHeader
        showPeriodSelector={false}
        showComparison={false}
        showSearchButton={false}
        rightContent={
          <Button variant='secondary' onClick={native}>
            {zh ? '今天的事件明细' : "Today's event details"}
          </Button>
        }
      />
      <div className='space-y-5'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div>
            <h2 className='text-xl font-semibold text-gray-900 dark:text-gray-50'>
              {zh ? '流量趋势' : 'Traffic overview'}
            </h2>
            <p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
              {zh
                ? '历史与新增数据统一展示 · novix.science · GMT+8 自然日'
                : 'Historical and live data together · novix.science · GMT+8 calendar days'}
            </p>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button
              variant='secondary'
              onClick={() => select(FIRST_HISTORY_DAY, latest)}
            >
              {zh ? '全部历史' : 'All history'}
            </Button>
            {[7, 30].map((days) => (
              <Button
                key={days}
                variant='secondary'
                onClick={() =>
                  select(
                    new Date(Date.parse(latest) - (days - 1) * 86400000)
                      .toISOString()
                      .slice(0, 10),
                    latest,
                  )
                }
              >
                {zh ? `近 ${days} 天` : `Last ${days} days`}
              </Button>
            ))}
          </div>
        </div>
        <form
          className='flex flex-wrap items-end gap-3'
          onSubmit={(e) => {
            e.preventDefault()
            select(draft.start, draft.end)
          }}
        >
          <Input
            type='date'
            label={zh ? '开始日期' : 'Start date'}
            value={draft.start}
            min={FIRST_HISTORY_DAY}
            max={draft.end}
            required
            onChange={(e) => setDraft({ ...draft, start: e.target.value })}
          />
          <Input
            type='date'
            label={zh ? '结束日期' : 'End date'}
            value={draft.end}
            min={draft.start}
            max={latest}
            required
            onChange={(e) => setDraft({ ...draft, end: e.target.value })}
          />
          <Button type='submit'>{zh ? '应用' : 'Apply'}</Button>
          <span className='pb-2 text-sm text-gray-500'>
            {range.start} — {range.end}
          </span>
        </form>
        <p className='rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600 dark:border-slate-800 dark:bg-slate-900/30 dark:text-gray-300'>
          {zh
            ? '同一天只采用一个流量来源：早期 GA4 → Cloudflare 完整日报 → 2026-11-10 起 Swetrix。来源切换可能影响计数。访客、活跃用户、Visits 与会话保留各自口径，缺失项显示 —，不跨日求和。'
            : 'One traffic source per day: earlier GA4 → complete Cloudflare days → Swetrix from 2026-11-10. Source changes may affect counts. Visitors, active users, visits and sessions retain their original definitions; missing values are — and are never summed across days.'}
        </p>
        {query.isPending ? (
          <Loader />
        ) : query.isError ? (
          <div
            role='alert'
            className='rounded-lg border border-red-200 p-5 text-sm'
          >
            {zh
              ? '流量数据暂时无法读取，请刷新重试。'
              : 'Traffic data is temporarily unavailable. Please retry.'}
            <Button variant='secondary' onClick={() => query.refetch()}>
              {zh ? '重试' : 'Retry'}
            </Button>
          </div>
        ) : (
          <>
            <div className='grid gap-4 sm:grid-cols-3'>
              {[
                [zh ? '页面浏览量（PV）' : 'Pageviews (PV)', format(total)],
                [zh ? '有数据的日期' : 'Days with data', format(rows.length)],
                [
                  zh ? '实际数据范围' : 'Available range',
                  rows.length
                    ? `${rows[0].date} — ${rows[rows.length - 1].date}`
                    : '—',
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className='rounded-lg border border-gray-200 bg-white p-4 dark:border-slate-800/60 dark:bg-slate-900/25'
                >
                  <p className='text-sm text-gray-500 dark:text-gray-400'>
                    {label}
                  </p>
                  <p className='mt-2 text-xl font-semibold text-gray-900 dark:text-gray-50'>
                    {value}
                  </p>
                </div>
              ))}
            </div>
            {rows.length ? (
              <div className='rounded-lg border border-gray-200 bg-white p-4 dark:border-slate-800/60 dark:bg-slate-900/25'>
                <svg
                  viewBox='0 0 1000 275'
                  className='w-full text-gray-500 dark:text-gray-400'
                  aria-label={
                    zh
                      ? '历史与实时页面浏览量趋势'
                      : 'Historical and live pageviews trend'
                  }
                >
                  {[0, 1, 2, 3, 4].map((i) => (
                    <g key={i}>
                      <line
                        x1='65'
                        x2='965'
                        y1={y((max * i) / 4)}
                        y2={y((max * i) / 4)}
                        stroke='currentColor'
                        opacity='.12'
                      />
                      <text
                        x='55'
                        y={y((max * i) / 4) + 4}
                        textAnchor='end'
                        fontSize='12'
                        fill='currentColor'
                      >
                        {format(Math.round((max * i) / 4))}
                      </text>
                    </g>
                  ))}
                  {segments.map((points, i) => (
                    <polyline
                      key={i}
                      points={points.join(' ')}
                      fill='none'
                      stroke='#3b82f6'
                      strokeWidth='2'
                    />
                  ))}
                  {rows.map((r, i) => (
                    <circle
                      key={r.date}
                      cx={x(i)}
                      cy={y(Number(r.pageviews))}
                      r='3'
                      fill={
                        r.source === 'swetrix'
                          ? '#14b8a6'
                          : r.source === 'cloudflare'
                            ? '#f59e0b'
                            : '#3b82f6'
                      }
                    >
                      <title>
                        {r.date} · {sourceName[r.source]} · PV{' '}
                        {format(r.pageviews)}
                      </title>
                    </circle>
                  ))}
                  {[0, Math.floor((rows.length - 1) / 2), rows.length - 1].map(
                    (i, n) => (
                      <text
                        key={n}
                        x={x(i)}
                        y='260'
                        textAnchor={
                          n === 0 ? 'start' : n === 2 ? 'end' : 'middle'
                        }
                        fontSize='12'
                        fill='currentColor'
                      >
                        {rows[i].date}
                      </text>
                    ),
                  )}
                </svg>
                <p className='mt-2 text-center text-xs text-gray-500'>
                  GA4 · Cloudflare · Swetrix
                </p>
              </div>
            ) : (
              <p>
                {zh
                  ? '此范围没有可展示的数据。'
                  : 'No data is available in this range.'}
              </p>
            )}
            <div className='overflow-hidden rounded-lg border border-gray-200 dark:border-slate-800/60'>
              <div className='overflow-x-auto'>
                <table className='w-full text-left text-sm whitespace-nowrap'>
                  <thead className='bg-gray-50 text-gray-600 dark:bg-slate-900 dark:text-gray-300'>
                    <tr>
                      {[
                        zh ? '日期' : 'Date',
                        'PV',
                        zh ? '流量来源' : 'Traffic source',
                        'Cloudflare Visits',
                        zh ? 'GA4 活跃用户' : 'GA4 active users',
                        zh ? 'Swetrix 当日访客' : 'Swetrix daily visitors',
                        zh ? 'Swetrix 会话' : 'Swetrix sessions',
                      ].map((label) => (
                        <th key={label} className='px-4 py-3 font-medium'>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-gray-100 text-gray-800 dark:divide-slate-800 dark:text-gray-200'>
                    {pageRows.map((r) => (
                      <tr key={r.date}>
                        {[
                          r.date,
                          format(r.pageviews),
                          sourceName[r.source],
                          format(r.visits),
                          format(r.active_users),
                          format(r.visitors),
                          format(r.sessions),
                        ].map((value, i) => (
                          <td key={i} className='px-4 py-3'>
                            {value}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className='flex items-center justify-between border-t border-gray-200 px-4 py-3 dark:border-slate-800'>
                <span className='text-xs text-gray-500'>
                  {rows.length
                    ? `${page * 30 + 1}–${Math.min((page + 1) * 30, rows.length)} / ${rows.length}`
                    : '0'}
                </span>
                <div className='flex gap-2'>
                  <Button
                    variant='secondary'
                    disabled={page === 0}
                    onClick={() => setPage(page - 1)}
                  >
                    {zh ? '上一页' : 'Previous'}
                  </Button>
                  <Button
                    variant='secondary'
                    disabled={(page + 1) * 30 >= rows.length}
                    onClick={() => setPage(page + 1)}
                  >
                    {zh ? '下一页' : 'Next'}
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
