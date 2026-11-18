import { useQuery } from '@tanstack/react-query'
import { useMemo, useRef, type ComponentRef } from 'react'
import { useSearchParams } from 'react-router'

import Button from '~/ui/Button'
import DatePicker from '~/ui/Datepicker'
import Loader from '~/ui/Loader'

import { calendarDate, calendarDay } from '../Traffic/unifiedRange'
import {
  CREDIT_PERIODS,
  CREDITS_TIMEZONE,
  creditsRange,
  readCredits,
  withCreditsRange,
  type CreditsReport,
  type CreditsStage,
  type CreditsUsageCounts,
} from './credits'

const tiers = new Map([
  ['free', 'Free'],
  ['lite', 'Lite'],
  ['pro', 'Pro'],
  ['lab', 'Ultra'],
])
const bands = ['0', '1–49', '50–199', '200–499', '500+']
const copy = {
  zh: {
    title: '额度与升档',
    range: '额度统计日期范围',
    days: (days: string) => `近 ${days} 天`,
    custom: '自定义日期',
    invalidRange: '日期范围无效，已显示最近 30 天。自定义最多 93 个自然日。',
    usage: '各套餐额度用量',
    unknownTier: '套餐未知',
    period: '月份',
    tier: '套餐',
    consumed: '实际消耗 (credits)',
    accounts: '额度账户数',
    consumingAccounts: '有消耗账户数',
    exhaustedAccounts: '余额归零账户数',
    usageBands: '每账户用量分布 (按 credits 分组)',
    usageHelp: '按额度周期和扣费时的套餐统计。同一账户当月换档后可出现在多个套餐。各月只统计选中日期。',
    gifted: '其中赠送',
    giftedHelp: '「其中赠送」是赠送或手动开通的套餐，多为内部账号，已计入上一行。',
    production: '正式环境 · 非内部账户',
    staging: '测试环境 · 所有账户',
    snapshot: '数据快照',
    todayThrough: '今日截至',
    upgrade: '付费用户升档漏斗',
    route: '升档路线',
    purchase: '原套餐购买方式',
    all: '全部',
    monthly: '月订阅',
    oneTime: '一次性购买',
    onlyExhausted: '仅看本期额度扣到零的账户',
    paidAccounts: '范围内有付费额度的账户',
    paidExhausted: '付费额度扣到零的账户',
    accountUnit: ' 个账户',
    coverage: {
      partial: '部分采集',
      untracked: '未完整采集',
      unobserved: '所选时段无可用记录',
      billing: '账单与权益记录',
      unavailable: '行为数据暂不可用',
      not_applicable: '一次性购买不适用',
    },
    stages: {
      pricing: '查看套餐页',
      click: '点击其他套餐',
      start: '发起升档',
      paid: '支付确认',
      effective: '新套餐生效',
    },
    firstObserved: '范围内最早记录',
    failed: '已观测到发起失败',
    upgradeHelp: '每个阶段按账号去重。漏斗只统计购买的套餐（月订阅、一次性购买），不含赠送和手动开通。支付与生效统计 Stripe 同订阅升档。跨阶段记录尚不完整，转化率暂不可计算。',
    loading: '正在查询额度与升档',
    error: '额度与升档数据暂不可用。',
    retry: '重试',
  },
  en: {
    title: 'Credits and upgrades',
    range: 'Credits date range',
    days: (days: string) => `Last ${days} days`,
    custom: 'Custom dates',
    invalidRange: 'Invalid dates. Showing the last 30 days. Custom ranges can span up to 93 calendar days.',
    usage: 'Credit usage by plan',
    unknownTier: 'Unknown plan',
    period: 'Month',
    tier: 'Plan',
    consumed: 'Consumed (credits)',
    accounts: 'Credit accounts',
    consumingAccounts: 'Used credits',
    exhaustedAccounts: 'Reached zero',
    usageBands: 'Account distribution by credits used',
    usageHelp: 'Usage follows the credit cycle and plan at the time of the debit. An account that switches plans can appear in multiple rows. Months include selected dates only.',
    gifted: 'Of which gifted',
    giftedHelp: '"Of which gifted" covers plans granted as gifts or manually, mostly internal accounts, and is included in the row above.',
    production: 'Production · External accounts',
    staging: 'Staging · All accounts',
    snapshot: 'Data snapshot',
    todayThrough: 'Today through',
    upgrade: 'Paid account upgrade funnel',
    route: 'Upgrade route',
    purchase: 'Original purchase type',
    all: 'All',
    monthly: 'Monthly subscription',
    oneTime: 'One-time purchase',
    onlyExhausted: 'Only accounts that reached zero in this range',
    paidAccounts: 'Accounts with paid credits in range',
    paidExhausted: 'Paid accounts that reached zero',
    accountUnit: ' accounts',
    coverage: {
      partial: 'Partial coverage',
      untracked: 'Incomplete tracking',
      unobserved: 'No usable records in range',
      billing: 'Billing and entitlement records',
      unavailable: 'Behavior data unavailable',
      not_applicable: 'Inapplicable to one-time purchases',
    },
    stages: {
      pricing: 'Viewed pricing',
      click: 'Clicked another plan',
      start: 'Started an upgrade',
      paid: 'Payment confirmed',
      effective: 'New plan active',
    },
    firstObserved: 'First observed in range',
    failed: 'Observed start failures',
    upgradeHelp: 'Account counts are deduplicated within each stage. The funnel only covers purchased plans (monthly or one-time), not gifted or manually granted ones. Payments and activations cover Stripe upgrades on the same subscription. Conversion rates require complete links across stages.',
    loading: 'Loading credit usage and upgrades',
    error: 'Credit and upgrade data is unavailable.',
    retry: 'Retry',
  },
}
type Language = keyof typeof copy
type Messages = (typeof copy)[Language]

const cell = 'px-3 py-3 whitespace-nowrap'
// Gifted sub-rows sit tight under their plan row, in smaller muted type.
const giftedCell = 'px-3 pb-3 text-xs whitespace-nowrap'
const muted = 'text-xs leading-relaxed text-gray-500 dark:text-gray-400'
const selectClass = 'rounded-md border border-gray-300 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900'

function StageValue({ stage, language }: { stage: CreditsStage; language: Language }) {
  const l = copy[language]
  const number = new Intl.NumberFormat(language)
  return (
    <>
      {stage.accounts === null ? null : (
        <p className='text-lg font-semibold tabular-nums'>
          {number.format(stage.accounts)}<span className='text-xs font-normal'>{l.accountUnit}</span>
        </p>
      )}
      <p className={muted}>{l.coverage[stage.coverage]}</p>
      {stage.observedFrom ? (
        <p className={muted}>
          {l.firstObserved} {formatTimestamp(stage.observedFrom, language)}
        </p>
      ) : null}
    </>
  )
}

function formatTimestamp(value: string, language: Language) {
  return new Intl.DateTimeFormat(language, {
    timeZone: CREDITS_TIMEZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function monthKeys(start: string, end: string) {
  const months: string[] = []
  const date = new Date(`${start.slice(0, 7)}-01T00:00:00Z`)
  while (date.toISOString().slice(0, 7) <= end.slice(0, 7)) {
    months.push(date.toISOString().slice(0, 7))
    date.setUTCMonth(date.getUTCMonth() + 1)
  }
  return months
}

export function CreditsUsage({ report, start, end, language }: {
  report: CreditsReport
  start: string
  end: string
  language: Language
}) {
  const l = copy[language]
  const number = new Intl.NumberFormat(language)
  const values = new Map(report.monthlyUsage.map((row) => [`${row.month}/${row.tier}`, row]))
  return (
    <>
      <h3 className='mt-5 mb-2 text-base font-semibold'>{l.usage}</h3>
      <p className={muted}>{l.usageHelp}</p>
      {report.monthlyUsage.some((row) => row.gifted) ? <p className={muted}>{l.giftedHelp}</p> : null}
      <div className='mt-3 overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-700'>
        <table className='w-full text-left text-sm' aria-label={l.usage}>
          <thead className='bg-gray-50 dark:bg-slate-900/70'>
            <tr>
              {[l.period, l.tier, l.accounts, l.consumingAccounts, l.consumed, l.exhaustedAccounts].map((header) => (
                <th key={header} rowSpan={2} scope='col' className={cell}>{header}</th>
              ))}
              <th colSpan={bands.length} scope='colgroup' className={cell}>{l.usageBands}</th>
            </tr>
            <tr>{bands.map((band) => <th key={band} scope='col' className='px-3 pb-2 whitespace-nowrap'>{band}</th>)}</tr>
          </thead>
          <tbody>
            {monthKeys(start, end).flatMap((month) => {
              const planKeys = values.has(`${month}/unknown`) ? [...tiers.keys(), 'unknown'] : [...tiers.keys()]
              const lines = planKeys.flatMap((tier) => {
                const data = values.get(`${month}/${tier}`)
                return data?.gifted ? [{ tier, data, gifted: false }, { tier, data, gifted: true }] : [{ tier, data, gifted: false }]
              })
              return lines.map(({ tier, data, gifted }, index) => {
                const counts: CreditsUsageCounts | undefined = gifted ? data?.gifted ?? undefined : data
                return (
                  <tr
                    key={`${month}/${tier}${gifted ? '/gifted' : ''}`}
                    className={gifted ? 'text-gray-500 dark:text-gray-400' : 'border-t border-gray-100 dark:border-slate-800'}
                  >
                    {index === 0 ? <th scope='rowgroup' rowSpan={lines.length} className={cell}>{month}</th> : null}
                    <th scope='row' className={gifted ? `${giftedCell} font-normal` : cell}>
                      {gifted ? `└ ${l.gifted}` : tiers.get(tier) || l.unknownTier}
                    </th>
                    {[
                      counts?.accounts ?? 0,
                      counts?.consumingAccounts ?? 0,
                      counts?.credits ?? 0,
                      counts?.exhaustedAccounts ?? 0,
                      ...(counts?.distribution ?? Array(bands.length).fill(0)),
                    ].map((value, column) => (
                      <td key={column} className={`${gifted ? giftedCell : cell} tabular-nums`}>{number.format(value)}</td>
                    ))}
                  </tr>
                )
              })
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

function CreditsFunnel({ report, language, exhausted }: {
  report: CreditsReport
  language: Language
  exhausted: boolean
}) {
  const l: Messages = copy[language]
  const number = new Intl.NumberFormat(language)
  const { funnel } = report
  return (
    <>
      <p className='mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm'>
        {exhausted ? null : <span>{l.paidAccounts} <strong>{number.format(funnel.paidAccounts)}</strong></span>}
        <span>{l.paidExhausted} <strong>{number.format(funnel.exhaustedAccounts)}</strong></span>
      </p>
      <ol className='mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5' aria-label={l.upgrade}>
        {funnel.steps.map((stage) => (
          <li key={stage.id} className='rounded-lg border border-gray-200 px-3 py-3 dark:border-slate-700'>
            <h4 className='mb-1 text-sm font-medium'>{l.stages[stage.id as keyof Messages['stages']]}</h4>
            <StageValue stage={stage} language={language} />
          </li>
        ))}
      </ol>
      {funnel.failed.accounts === null ? null : (
        <p className='mt-2 text-sm'>{l.failed} {number.format(funnel.failed.accounts)}{l.accountUnit}</p>
      )}
      <p className={`mt-2 ${muted}`}>{l.upgradeHelp}</p>
    </>
  )
}

export default function CreditsSection({ projectId, language }: { projectId: string; language: Language }) {
  const l = copy[language]
  const [params, setParams] = useSearchParams()
  const range = creditsRange(params)
  const calendar = useRef<ComponentRef<typeof DatePicker>>(null)
  const calendarValue = useMemo(
    () => [calendarDate(range.start), calendarDate(range.end)],
    [range.start, range.end],
  )
  const maxDate = useMemo(() => calendarDate(range.today), [range.today])
  const route = ['lite-pro', 'lite-lab', 'pro-lab'].find((value) => value === params.get('credits_route')) || 'all'
  const purchase = ['monthly', 'one_time'].find((value) => value === params.get('credits_purchase')) || 'all'
  const exhausted = params.get('credits_exhausted') === 'true'
  const selectFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value === 'all' || value === 'false') next.delete(key)
    else next.set(key, value)
    setParams(next, { preventScrollReset: true })
  }
  const search = new URLSearchParams({
    startDate: range.start,
    endDate: range.end,
    timezone: CREDITS_TIMEZONE,
    route,
    purchase,
    exhausted: String(exhausted),
  }).toString()
  const report = useQuery({
    queryKey: ['novix-business', projectId, 'credits', search],
    queryFn: ({ signal }) =>
      readCredits(`/novix/api/v1/projects/${encodeURIComponent(projectId)}/business/credits?${search}`, signal),
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  })
  return (
    <section id='novix-credits' aria-labelledby='novix-credits-title' className='mt-8 scroll-mt-4 rounded-lg border border-gray-200 p-4 text-gray-900 sm:p-5 dark:border-slate-700 dark:text-gray-50'>
      <h2 id='novix-credits-title' className='text-lg font-semibold'>{l.title}</h2>
      <div className='mt-3 flex flex-wrap items-center gap-2' role='group' aria-label={l.range}>
        {CREDIT_PERIODS.map((period) => (
          <Button
            key={period}
            variant={range.period === period ? 'secondary' : 'ghost'}
            aria-pressed={range.period === period}
            onClick={() => setParams(withCreditsRange(params, period), { preventScrollReset: true })}
          >
            {l.days(period.slice(0, -1))}
          </Button>
        ))}
        <div className='relative'>
          <Button
            variant={range.period === 'custom' ? 'secondary' : 'ghost'}
            aria-pressed={range.period === 'custom'}
            aria-haspopup='dialog'
            onClick={() => calendar.current?.openCalendar()}
          >
            {l.custom}
          </Button>
          <DatePicker
            ref={calendar}
            align='left'
            className='absolute top-4 left-0'
            value={calendarValue}
            maxDate={maxDate}
            maxRange={92}
            onChange={([start, end]) => {
              if (start && end) setParams(withCreditsRange(params, 'custom', calendarDay(start), calendarDay(end)), {
                preventScrollReset: true,
              })
            }}
          />
        </div>
      </div>
      <p className={`mt-2 ${muted}`}>
        {range.start === range.end ? range.start : `${range.start} – ${range.end}`} · {CREDITS_TIMEZONE}
        {report.data ? ` · ${l[report.data.environment]} · ${range.end === range.today
          ? `${l.todayThrough} ${formatTimestamp(report.data.resolvedRange.endExclusive, language)}`
          : `${l.snapshot} ${formatTimestamp(report.data.snapshotAt, language)}`}` : ''}
      </p>
      {range.invalid ? <p role='alert' className={`mt-1 ${muted}`}>{l.invalidRange}</p> : null}
      {report.data ? <CreditsUsage report={report.data} start={range.start} end={range.end} language={language} /> : null}
      <h3 className='mt-5 mb-2 text-base font-semibold'>{l.upgrade}</h3>
      <div className='flex flex-wrap items-end gap-3'>
        <label className='grid gap-1 text-xs'>
          {l.route}
          <select className={selectClass} value={route} onChange={(event) => selectFilter('credits_route', event.target.value)}>
            <option value='all'>{l.all}</option>
            <option value='lite-pro'>Lite → Pro</option>
            <option value='lite-lab'>Lite → Ultra</option>
            <option value='pro-lab'>Pro → Ultra</option>
          </select>
        </label>
        <label className='grid gap-1 text-xs'>
          {l.purchase}
          <select className={selectClass} value={purchase} onChange={(event) => selectFilter('credits_purchase', event.target.value)}>
            <option value='all'>{l.all}</option>
            <option value='monthly'>{l.monthly}</option>
            <option value='one_time'>{l.oneTime}</option>
          </select>
        </label>
        <label className='flex items-center gap-2 py-2 text-sm'>
          <input type='checkbox' checked={exhausted} onChange={(event) => selectFilter('credits_exhausted', String(event.target.checked))} />
          {l.onlyExhausted}
        </label>
      </div>
      {report.isPending ? <Loader className='py-3!' label={l.loading} showLabel /> : null}
      {report.error ? (
        <div role='alert' className='mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200'>
          {l.error}
          <Button size='sm' variant='secondary' onClick={() => report.refetch()}>{l.retry}</Button>
        </div>
      ) : null}
      {report.data ? <CreditsFunnel report={report.data} language={language} exhausted={exhausted} /> : null}
    </section>
  )
}
