import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { CaretRightIcon } from '@phosphor-icons/react'

import Button from '~/ui/Button'
import Loader from '~/ui/Loader'
import { BUSINESS_FUNNEL_PERIODS } from '~/utils/novixFunnels'
import { useViewProjectContext } from '../../View/ViewProject'
import { ReportError } from '../Business/report'
import {
  readTrafficFlowReport,
  trafficFlowQuery,
  lastDaysParams,
  type TrafficFlowNode,
} from './trafficFlow'

const names: Record<string, string> = {
  auto: 'Auto',
  task: 'Task',
  discuss: 'Discuss',
  deep: 'Loop',
  cpu: 'CPU',
  gpu: 'GPU',
  pilot: 'Pilot',
  roam: 'Roam',
}
const copy = {
  zh: {
    title: '从总访问到功能提交',
    root: '网站总访问访客',
    pv: '页面浏览量',
    intro: '从全部访客开始，按业务入口、功能和首次提交配置逐层展开。',
    parent: '占上层',
    total: '占总访问',
    source: '来源：Swetrix 原生采集 · 全部访客，包含匿名访问',
    identity:
      'UV 沿用 Swetrix 访客标识，并非跨日期、跨设备去重的自然人数。每个访客在同层只归入首次有记录的分支；后续切换不重复计数。',
    gaps: '没有后续记录保留为独立分支，可能是未操作或缺少采集记录，不直接判定为流失。默认曝光不算主动选择，CPU/GPU 使用提交时的配置。',
    missing:
      '完整表单配置和 tag 尚未全部采集，当前只展开已有字段，缺失项保留说明。',
    coverage: '只有页面访问、缺少本次行为事件的访客',
    snapshot: '数据快照',
    days: '天',
    recent: '最近',
    firstRecord: '本次范围内首条访问记录',
    loading: '正在查询总访问与后续路径…',
    retry: '重试',
    failed: '查询失败，请重试。',
    refreshFailed: '刷新失败，以下保留上次快照。',
    updating: '正在更新…',
    empty: '所选时间内没有 Swetrix 原生页面访问记录。',
    unsupported: '请选择不超过 93 个自然日的时间范围。',
    traffic: '网站总访问访客',
    mode: '提交模式',
    resolved_mode: 'Auto 实际模式',
    compute_type: '提交资源',
    discovery_mode: 'Discovery 模式',
    input_type: '输入方式',
    no_tab_recorded: '未记录到业务入口选择',
    no_feature_recorded: '未记录到功能选择',
    ambiguous_choice: '选择顺序无法判定',
    submitted: '已记录提交',
    not_recorded: '未记录到后续提交',
    configuration_not_collected: '其余配置尚未完整采集',
    unknown: '未记录／未确认',
    keyword: '关键词输入',
    file: '文件输入',
  },
  en: {
    title: 'From all visits to research submissions',
    root: 'All website visitors',
    pv: 'Page views',
    intro:
      'Start with all visitors and expand business entries, research features and the first submitted configuration.',
    parent: 'of parent',
    total: 'of all visitors',
    source:
      'Source: native Swetrix collection · All visitors, including anonymous visits',
    identity:
      'UV uses the Swetrix visitor key, not unique people across dates or devices. Each visitor belongs to their first recorded branch at each level; later switches are not counted again.',
    gaps: 'Missing follow-up records remain separate: an action may not have happened or may not have been collected. Passive exposure is not a choice. CPU/GPU uses the submitted setting.',
    missing:
      'Complete form configurations and tags are not yet collected. Only recorded dimensions are expanded.',
    coverage: 'Visitors with page views but no behavior events in this range',
    snapshot: 'Snapshot',
    days: 'days',
    recent: 'Last',
    firstRecord: 'First page view within this range',
    loading: 'Loading all visits and subsequent paths…',
    retry: 'Retry',
    failed: 'Unable to load this report. Please retry.',
    refreshFailed: 'Refresh failed; the previous snapshot remains below.',
    updating: 'Updating…',
    empty: 'No native Swetrix page views were recorded in this range.',
    unsupported: 'Choose a range of at most 93 calendar days.',
    traffic: 'All website visitors',
    mode: 'Submitted mode',
    resolved_mode: 'Resolved Auto mode',
    compute_type: 'Submitted compute',
    discovery_mode: 'Discovery mode',
    input_type: 'Input method',
    no_tab_recorded: 'No research entry choice recorded',
    no_feature_recorded: 'No research feature choice recorded',
    ambiguous_choice: 'Choice order unknown',
    submitted: 'Research submission recorded',
    not_recorded: 'No subsequent submission recorded',
    configuration_not_collected: 'Remaining configuration not fully collected',
    unknown: 'Not recorded / unconfirmed',
    keyword: 'Keyword input',
    file: 'File input',
  },
}

export default function TrafficFlowOverview({
  projectId,
}: {
  projectId: string
}) {
  const { i18n } = useTranslation('common')
  const language = (i18n.resolvedLanguage || i18n.language).startsWith('zh')
    ? 'zh'
    : 'en'
  const l = copy[language] as Record<string, string>
  const [params, setParams] = useSearchParams()
  const { period, timeBucket, timezone } = useViewProjectContext()
  const query = trafficFlowQuery(params, period, timeBucket, timezone)
  const report = useQuery({
    queryKey: ['v2', projectId, 'traffic-flow-v1', query],
    enabled: BUSINESS_FUNNEL_PERIODS.has(period),
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: ({ signal }) =>
      readTrafficFlowReport(
        `/novix/api/v1/projects/${encodeURIComponent(projectId)}/product/traffic-flow?${query}`,
        signal,
      ),
  })
  const number = new Intl.NumberFormat(language)
  const percent = (value: number, total: number) =>
    total
      ? new Intl.NumberFormat(language, {
          style: 'percent',
          maximumFractionDigits: 1,
        }).format(value / total)
      : '—'
  const label = (node: TrafficFlowNode) => {
    const value =
      report.data?.labels[node.value] ||
      names[node.value] ||
      l[node.value] ||
      node.value
    return [
      'mode',
      'resolved_mode',
      'compute_type',
      'discovery_mode',
      'input_type',
    ].includes(node.dimension)
      ? `${l[node.dimension]} · ${value}`
      : node.dimension === 'traffic'
        ? l.root
        : value
  }
  function renderNode(
    node: TrafficFlowNode,
    parent: TrafficFlowNode | null,
    depth = 0,
  ) {
    const details = (
      <>
        <span className='min-w-0 flex-1 font-medium text-gray-900 dark:text-gray-100'>
          {label(node)}
        </span>
        <span className='shrink-0 text-lg font-semibold text-gray-900 tabular-nums dark:text-gray-50'>
          {number.format(node.count)}{' '}
          <span className='text-xs font-normal text-gray-500'>(UV)</span>
        </span>
        {parent ? (
          <span className='w-28 shrink-0 text-right text-xs leading-5 text-gray-500 dark:text-gray-400'>
            {l.parent} {percent(node.count, parent.count)}
            <br />
            {l.total} {percent(node.count, report.data?.root.count || 0)}
          </span>
        ) : null}
      </>
    )
    const className = `flex min-h-14 flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border px-4 py-3 ${depth === 0 ? 'border-teal-300 bg-teal-50 dark:border-teal-800 dark:bg-teal-950/30' : 'border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-950'}`
    return node.children.length ? (
      <details
        key={node.id}
        open={depth < 2}
        className='my-2 [&[open]>summary>svg]:rotate-90'
      >
        <summary
          className={`${className} cursor-pointer focus-visible:ring-2 focus-visible:ring-teal-500`}
        >
          <CaretRightIcon
            className='size-4 shrink-0 transition-transform'
            aria-hidden
          />
          {details}
        </summary>
        <div className='ml-4 border-l-2 border-gray-100 pl-4 dark:border-slate-800'>
          {node.children.map((row) => renderNode(row, node, depth + 1))}
        </div>
      </details>
    ) : (
      <div key={node.id} className={`my-2 ${className}`}>
        {details}
      </div>
    )
  }
  const error =
    report.error instanceof ReportError && report.error.status === 422
      ? l.unsupported
      : l.failed
  return (
    <section className='mb-8' aria-label={l.title}>
      <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-50'>
        {l.title}
      </h3>
      <p className='mt-2 text-sm text-gray-500 dark:text-gray-400'>{l.intro}</p>
      <div className='mt-3 flex gap-2'>
        {([7, 14, 30] as const).map((days) => (
          <Button
            key={days}
            size='sm'
            variant='secondary'
            onClick={() => setParams(lastDaysParams(params, days, timezone))}
          >
            {l.recent} {days} {l.days}
          </Button>
        ))}
      </div>
      {!BUSINESS_FUNNEL_PERIODS.has(period) ? (
        <p role='alert' className='mt-4 text-sm text-amber-700'>
          {l.unsupported}
        </p>
      ) : null}
      {report.isLoading ? (
        <Loader className='py-8' label={l.loading} showLabel />
      ) : null}
      {report.error ? (
        <div
          role='alert'
          className='my-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200'
        >
          <p className='mb-2'>
            {report.data ? `${l.refreshFailed} ` : ''}
            {error}
          </p>
          <Button variant='secondary' onClick={() => void report.refetch()}>
            {l.retry}
          </Button>
        </div>
      ) : null}
      {report.data ? (
        <>
          <div className='my-4 flex flex-wrap justify-between gap-3 text-xs text-gray-500 dark:text-gray-400'>
            <p>
              {l.source}
              <br />
              {l.snapshot}{' '}
              {new Intl.DateTimeFormat(language, {
                timeZone: timezone,
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(report.data.snapshotAt))}
              {report.isFetching ? ` · ${l.updating}` : ''}
            </p>
            <p>
              {l.pv}{' '}
              <strong className='ml-2 text-lg text-gray-900 dark:text-gray-50'>
                {number.format(report.data.pv)}{' '}
                <span className='text-xs font-normal'>(PV)</span>
              </strong>
            </p>
          </div>
          <p className='mb-3 text-xs text-gray-500 dark:text-gray-400'>
            {new Intl.DateTimeFormat(language, {
              timeZone: timezone,
              dateStyle: 'medium',
              timeStyle: 'short',
            }).format(new Date(report.data.resolvedRange.startInclusive))}{' '}
            —{' '}
            {new Intl.DateTimeFormat(language, {
              timeZone: timezone,
              dateStyle: 'medium',
              timeStyle: 'short',
            }).format(
              new Date(
                Math.min(
                  Date.parse(report.data.snapshotAt),
                  Date.parse(report.data.resolvedRange.endExclusive),
                ) - 1,
              ),
            )}{' '}
            · {timezone}
          </p>
          {renderNode(report.data.root, null)}
          {report.data.root.count === 0 ? (
            <p className='my-4 text-sm text-gray-500'>{l.empty}</p>
          ) : null}
          <div className='mt-5 space-y-2 rounded-lg bg-gray-50 p-4 text-xs leading-6 text-gray-500 dark:bg-slate-900 dark:text-gray-400'>
            <p>{l.identity}</p>
            <p>{l.gaps}</p>
            <p>{l.missing}</p>
            <p>
              {l.coverage}:{' '}
              {number.format(report.data.coverage.missingBehaviorVisitors)} (UV)
            </p>
            {report.data.collection.firstPageviewAt ? (
              <p>
                {l.firstRecord}:{' '}
                {new Intl.DateTimeFormat(language, {
                  timeZone: timezone,
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(report.data.collection.firstPageviewAt))}
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  )
}
