import { readJourney } from '../../Journeys/novix/api'
import type { JourneyPaths } from '../../Journeys/novix/types'
import { historyRange, UNIFIED_PROJECT } from '../../Traffic/unifiedRange'
import { readReport, ReportError } from '../report'
import type { FlowFunnel, ProductReport } from '../types'
import { NOVIX_FUNNEL_PRESETS, readFlowFunnels } from '~/utils/novixFunnels'

export const REPORT_TIMEZONE = 'Asia/Shanghai'
const DAY = 86400000

export function reportRange(now = new Date()) {
  const end = historyRange(new URLSearchParams('period=today'), now).end
  const start = new Date(Date.parse(end) - 29 * DAY).toISOString().slice(0, 10)
  return {
    start,
    end,
    startInclusive: new Date(`${start}T00:00:00+08:00`).toISOString(),
    endExclusive: new Date(
      Date.parse(`${end}T00:00:00+08:00`) + DAY,
    ).toISOString(),
  }
}
export type ReportRange = ReturnType<typeof reportRange>
export type HistoryRow = {
  date: string
  source: 'ga4' | 'cloudflare' | 'swetrix'
  pageviews: number
}
export interface ReportHistory {
  schemaVersion: 1
  projectId: string
  environment: string
  resolvedRange: { start: string; end: string; timezone: string }
  rows: HistoryRow[]
}
export interface DashboardData {
  history: ReportHistory
  journeys: JourneyPaths
  product: ProductReport
  fetchedAt: string
}
const invalid = () => new ReportError(502, 'invalid_report')
const count = (value: unknown) =>
  Number.isSafeInteger(value) && Number(value) >= 0

export function validateHistory(
  value: ReportHistory,
  range: ReportRange,
): ReportHistory {
  if (
    value?.schemaVersion !== 1 ||
    value.projectId !== UNIFIED_PROJECT ||
    value.environment !== 'production' ||
    value.resolvedRange?.start !== range.start ||
    value.resolvedRange?.end !== range.end ||
    value.resolvedRange?.timezone !== REPORT_TIMEZONE ||
    !Array.isArray(value.rows) ||
    value.rows.length !== 30
  )
    throw invalid()
  const rows = [...value.rows].sort((a, b) => a.date.localeCompare(b.date))
  for (const [index, row] of rows.entries()) {
    const date = new Date(Date.parse(range.start) + index * DAY)
      .toISOString()
      .slice(0, 10)
    if (
      row.date !== date ||
      !['ga4', 'cloudflare', 'swetrix'].includes(row.source) ||
      row.pageviews == null ||
      String(row.pageviews).trim() === '' ||
      !count(Number(row.pageviews))
    )
      throw invalid()
  }
  return {
    ...value,
    rows: rows.map((row) => ({ ...row, pageviews: Number(row.pageviews) })),
  }
}

export function reportDateQuery(range: ReportRange) {
  return new URLSearchParams({
    period: 'custom',
    startInclusive: range.startInclusive,
    endExclusive: range.endExclusive,
    timezone: REPORT_TIMEZONE,
    timeBucket: 'day',
  })
}

export function reportSourceLink(
  range: ReportRange,
  tab: string,
  feature?: string,
) {
  const query = new URLSearchParams({
    tab,
    period: 'custom',
    from: `${range.start}T00:00:00+08:00`,
    to: `${range.end}T23:59:59+08:00`,
    timezone: REPORT_TIMEZONE,
    timeBucket: 'day',
  })
  if (feature) {
    query.set('novixFunnel', feature)
    query.set('novix_internalTraffic', 'external')
    query.set('novix_computeType', 'all')
  }
  return `/projects/${UNIFIED_PROJECT}?${query}`
}

export async function readDashboard(
  range: ReportRange,
  signal: AbortSignal,
): Promise<DashboardData> {
  const root = `/novix/api/v1/projects/${UNIFIED_PROJECT}`
  const dates = reportDateQuery(range)
  const productQuery = new URLSearchParams(dates)
  productQuery.set('feature', 'all')
  productQuery.set('computeType', 'all')
  productQuery.set('internalTraffic', 'external')
  const journeyQuery = new URLSearchParams(dates)
  journeyQuery.set('depth', '5')
  journeyQuery.set('take', '10')
  const historyQuery = new URLSearchParams({
    start: range.start,
    end: range.end,
  })
  const [rawHistory, journeys, product] = await Promise.all([
    fetch(`${root}/history/unified?${historyQuery}`, {
      credentials: 'same-origin',
      signal,
    }).then(async (response) => {
      if (!response.ok) throw new ReportError(response.status, 'request_failed')
      return response.json()
    }),
    readJourney<JourneyPaths>(`${root}/journeys/paths?${journeyQuery}`, signal),
    readReport<ProductReport>(`${root}/product/report?${productQuery}`, signal),
  ])
  const history = validateHistory(rawHistory, range)
  for (const source of [journeys, product]) {
    if (
      Date.parse(source.resolvedRange.startInclusive) !==
      Date.parse(range.startInclusive)
    )
      throw invalid()
    if (
      Date.parse(source.resolvedRange.endExclusive) !==
        Date.parse(range.endExclusive) ||
      source.resolvedRange.timezone !== REPORT_TIMEZONE ||
      !Number.isFinite(Date.parse(source.snapshotAt))
    )
      throw invalid()
  }
  if (
    product.environment !== 'production' ||
    product.filters?.feature !== 'all' ||
    product.filters.computeType !== 'all' ||
    product.filters.internalTraffic !== 'external' ||
    product.flowFunnels?.version !== 1 ||
    product.coverage.unknownFeatureUses > product.usage.operations ||
    ![
      journeys.totalSessions,
      journeys.totalUsers,
      journeys.totalPaths,
      product.usage.operations,
      product.coverage.unknownFeatureUses,
    ].every(count) ||
    !Array.isArray(journeys.paths)
  )
    throw invalid()
  for (const preset of NOVIX_FUNNEL_PRESETS) {
    readFlowFunnels(
      {
        flowFunnels: {
          version: 1,
          paths: product.flowFunnels.paths.filter(
            (path) => path.featureId === preset.id,
          ),
        },
      },
      preset.id,
    )
  }
  return { history, journeys, product, fetchedAt: new Date().toISOString() }
}

type StageValue = Pick<FlowFunnel['steps'][number], 'count' | 'availability'>
export function stageRate(numerator: StageValue, denominator: StageValue) {
  return numerator.availability === 'available' &&
    denominator.availability === 'available' &&
    numerator.count !== null &&
    denominator.count !== null &&
    denominator.count > 0
    ? numerator.count / denominator.count
    : null
}

export function reportSteps(path: FlowFunnel) {
  const route = path.steps.find((step) => step.id === 'route')
  const execution = path.steps.find((step) => step.id === 'execution')
  const merge =
    path.featureId !== 'auto_discovery' &&
    !path.id.endsWith('loop') &&
    route &&
    execution &&
    route.count === execution.count &&
    route.availability === execution.availability
  return path.steps.filter((step) => !merge || step.id !== 'execution')
}

export const PATH_NAMES: Record<string, string> = {
  task: '选择 Task',
  discuss: '选择 Discuss',
  loop: '选择 Loop',
  auto_task: 'Auto 路由到 Task',
  auto_discuss: 'Auto 路由到 Discuss',
  auto_loop: 'Auto 路由到 Loop',
  keyword_input: '输入关键词',
  file_input: '上传文件',
  proposal_approval: '批准提案',
  proposal_skip: '跳过任务卡片',
  running_handoff: '进入 Running 项目',
  return_visit: '离开后回访项目',
}
export const ROUTE_NAMES: Record<string, string> = {
  '/': '首页',
  '/chat': '研究工作台',
  '/search-v1/:sessionId': '研究会话详情',
  '/deepsurvey': 'Deep Survey',
  '/ideaspark': 'Idea Spark',
  '/methoddesign': 'Method Design',
  '/autoexperiment': 'Auto Experiment',
  '/notebook': 'Data Analysis',
  '/reproduce': 'Reproduce Paper',
  '/auto-discovery': 'Auto-Discovery',
}
type Definition = {
  label: string
  description: string
  condition: string
  event: string
}
export function stageDefinition(
  path: Pick<FlowFunnel, 'id' | 'featureId'>,
  id: string,
): Definition {
  const feature =
    NOVIX_FUNNEL_PRESETS.find((item) => item.id === path.featureId)?.label ||
    path.featureId
  const mode = path.id.endsWith('loop')
    ? 'Loop'
    : path.id.endsWith('discuss')
      ? 'Discuss'
      : 'Task'
  const requested = path.id.includes('.auto_') ? 'Auto' : mode
  const definitions: Record<string, Definition> = {
    home: {
      label: '访问研究区',
      description:
        '这次访问出现过研究区页面，包括直接打开工作台、科研功能页或已有研究会话。',
      condition: '以访问为单位去重，研究会话详情页也属于入口覆盖范围。',
      event: 'workspace_viewed',
    },
    entry: {
      label: `进入 ${feature}`,
      description: `这次访问进入了 ${feature} 对应页面或显示了对应输入区。`,
      condition:
        '页面到达、功能查看与功能点击均可识别进入行为，直接打开页面也会计入。',
      event: 'feature_viewed / feature_clicked / 对应路由的 workspace_viewed',
    },
    submit: {
      label: `提交过 ${requested} 研究需求`,
      description: `这次访问至少提交过一次 ${feature} 的 ${requested} 需求。`,
      condition:
        '按访问去重，同次访问多次提交只计 1 次。后续受理和结果沿同一提交任务链关联。',
      event: `feature_submit_attempted · feature_id=${path.featureId} · requested_mode=${requested === 'Loop' ? 'deep' : requested.toLowerCase()}`,
    },
    route: {
      label: `有 ${mode} 请求被受理`,
      description: `同一提交关联的任务已被服务端受理，最终模式为 ${mode}。`,
      condition:
        '受理记录与后端任务事实关联。Task / Discuss 原来的两项受理阶段在计数相同时合并。',
      event: `feature_use_accepted / 后端任务受理事实 · resolved_mode=${mode === 'Loop' ? 'deep' : mode.toLowerCase()}`,
    },
    execution: {
      label: '研究请求已受理',
      description: '关联研究请求已被后端受理。',
      condition: '使用可关联的受理事实。Loop 路径会单独要求实际启动事件。',
      event: '后端 acceptedAt / feature_use_accepted',
    },
    success: {
      label: '关联任务成功完成',
      description: '同一任务链中的任务在观察窗内达到成功状态。',
      condition:
        '必须存在有效完成时间，完成时间在受理或实际启动之后，且不超过观察截止时点。',
      event: '后端 task.status=success · finishedAt',
    },
    result: {
      label: '关联结果被查看',
      description:
        '成功完成后，同一根任务的结果被查看，允许在观察窗内回访查看。',
      condition:
        '结果查看发生在完成之后。各阶段仍按入口访问计数，后续回访查看归到这条任务链。',
      event: 'feature_result_viewed · 相同 root_task_id',
    },
    checklist_ready: {
      label: '任务清单已生成',
      description: 'Loop 路径的同一根任务已生成执行清单。',
      condition: '需要受理之后关联到任务的清单生成事件。',
      event: 'deep_checklist_ready',
    },
    checklist_viewed: {
      label: '任务清单被查看',
      description: '用户查看了同一 Loop 根任务的执行清单。',
      condition: '清单查看事件发生在生成之后。',
      event: 'deep_checklist_viewed',
    },
    checklist_confirmed: {
      label: '任务清单已确认',
      description: '用户确认同一 Loop 根任务的执行清单。',
      condition: '清单确认事件发生在查看之后。',
      event: 'deep_checklist_confirmed',
    },
    intent: {
      label: '已提交研究输入',
      description: '这次访问提交了关键词或文件形式的研究输入。',
      condition:
        '根据 input_type 区分输入方式，并关联同一 discovery_intent_id。',
      event: 'discovery_intent_submitted',
    },
    space: {
      label: '已进入提案空间',
      description: '提交研究输入后，进入对应的提案空间。',
      condition: '空间到达需与同一研究输入关联。',
      event: 'discovery_space_viewed',
    },
    proposal: {
      label: '提案卡片被展示',
      description: '研究提案卡片已展示给用户。',
      condition: '同一身份与 proposal_id 去重。输入路径仍按入口访问计数。',
      event: 'discovery_proposal_viewed',
    },
    go_ahead: {
      label: '点击 Go ahead',
      description: '用户尝试批准这张提案卡片并开始研究。',
      condition: '同一 proposal_id 下出现批准尝试，尝试和服务端确认分别统计。',
      event: 'discovery_proposal_decided · go_ahead · attempted',
    },
    approved: {
      label: '提案批准已确认',
      description: '服务端已确认该提案的批准操作。',
      condition: '同一提案存在 decision_status=accepted 的批准记录。',
      event: 'discovery_proposal_decided · go_ahead · accepted',
    },
    not_now: {
      label: '点击 Not Now 跳过卡片',
      description: '用户选择跳过这张任务卡片。',
      condition: '同一提案出现 not_now 尝试，成功跳过需再获得服务端确认。',
      event: 'discovery_proposal_decided · not_now · attempted',
    },
    skipped: {
      label: '卡片跳过已确认',
      description: '服务端已确认跳过该任务卡片。',
      condition: '同一提案出现 not_now 且 decision_status=accepted。',
      event: 'discovery_proposal_decided · not_now · accepted',
    },
    running: {
      label: '已打开 Running 项目',
      description: '对应的研究项目页面已成功打开。',
      condition:
        '要求 research_session_id 关联一致，observation_source 为 route_ready。',
      event: 'discovery_project_opened · route_ready',
    },
    left: {
      label: '离开研究项目',
      description: '打开项目后，观测到离开该项目页面。',
      condition: '同一研究项目、同一次访问的离开记录。',
      event: 'discovery_space_left',
    },
    returned: {
      label: '回访同一项目',
      description: '离开后，在后续访问中重新打开同一研究项目。',
      condition: '研究项目一致，访问标识发生变化，且处于 7 天观察窗内。',
      event: 'discovery_project_opened · 后续访问',
    },
  }
  if (id === 'execution' && path.id.endsWith('loop'))
    return {
      label: 'Loop 执行已启动',
      description: '确认清单之后，同一根任务产生了实际启动记录。',
      condition: '需要独立启动事件，按清单确认后的时间顺序关联。',
      event: 'deep_execution_started',
    }
  if (id === 'go_ahead' && /\.(keyword_input|file_input)$/.test(path.id))
    return definitions.approved
  return (
    definitions[id] || {
      label: id,
      description: '原始业务阶段。',
      condition: '沿当前业务路径关联。',
      event: id,
    }
  )
}
