import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useSearchParams } from 'react-router'

import Button from '~/ui/Button'
import Loader from '~/ui/Loader'
import { NOVIX_FUNNEL_PRESETS } from '~/utils/novixFunnels'
import { ReportError } from '../report'
import type { FlowFunnel } from '../types'
import {
  PATH_NAMES,
  REPORT_TIMEZONE,
  ROUTE_NAMES,
  readDashboard,
  reportRange,
  reportSourceLink,
  reportSteps,
  stageDefinition,
  stageRate,
  type DashboardData,
  type ReportRange,
} from './model'
import './report.css'

const number = new Intl.NumberFormat('zh-CN')
const percent = new Intl.NumberFormat('zh-CN', {
  style: 'percent',
  maximumFractionDigits: 2,
})
const n = (value: number | null) =>
  value === null ? '—' : number.format(value)
const p = (value: number | null) =>
  value === null ? '—' : percent.format(value)
const dateTime = (value: string) =>
  new Intl.DateTimeFormat('zh-CN', {
    timeZone: REPORT_TIMEZONE,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(value))
const sourceName = { ga4: 'GA4', cloudflare: 'Cloudflare', swetrix: 'Swetrix' }
const dataState = {
  available: '可统计',
  partial: '部分记录',
  unavailable: '缺少记录',
}

function FlowReport({
  paths,
  range,
}: {
  paths: FlowFunnel[]
  range: ReportRange
}) {
  const [params, setParams] = useSearchParams()
  const feature =
    NOVIX_FUNNEL_PRESETS.find(
      (item) => item.id === params.get('report_feature'),
    )?.id || 'auto_pilot'
  const choices = paths.filter((path) => path.featureId === feature)
  const selectedPath = params.get('report_path') || 'auto_task'
  const path =
    choices.find((item) => item.id.endsWith(`.${selectedPath}`)) || choices[0]
  const [selectedStage, setSelectedStage] = useState('result')
  const [baselineId, setBaselineId] = useState('success')
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    next.set(key, value)
    if (key === 'report_feature') next.delete('report_path')
    setParams(next, { preventScrollReset: true })
  }
  if (!path) return <p role='alert'>当前业务路径缺少可读取的数据。</p>
  const steps = reportSteps(path)
  const active = steps.find((step) => step.id === selectedStage) || steps[0]
  const baseline = steps.find((step) => step.id === baselineId) || steps[0]
  const last = steps[steps.length - 1]
  const rate = stageRate(last, baseline)
  const definition = stageDefinition(path, active.id)
  const unit = path.unit === 'visits' ? '次访问' : '张提案'
  const max = steps[0].count || 1
  return (
    <>
      <div className='nv-flow-controls'>
        <label>
          科研功能
          <select
            value={feature}
            onChange={(event) => update('report_feature', event.target.value)}
          >
            {NOVIX_FUNNEL_PRESETS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          业务路径
          <select
            value={path.id.split('.')[1]}
            onChange={(event) => update('report_path', event.target.value)}
          >
            {choices.map((item) => (
              <option key={item.id} value={item.id.split('.')[1]}>
                {PATH_NAMES[item.id.split('.')[1]]}
              </option>
            ))}
          </select>
        </label>
        <p>
          统计单位 <strong>{unit}</strong>
        </p>
      </div>
      <p className='nv-flow-scope'>
        排除已识别的内部账号 · 全部算力 · 每条路径独立去重 · 后续最多观察 7×24
        小时
      </p>
      <div className='nv-flow-layout'>
        <div>
          <div className='nv-stage-head'>
            <span>业务阶段</span>
            <span>{unit}</span>
            <span>较上一步</span>
          </div>
          <div className='nv-stages'>
            {steps.map((step, index) => {
              const label = stageDefinition(path, step.id).label
              return (
                <button
                  type='button'
                  className='nv-stage'
                  key={step.id}
                  aria-pressed={step.id === active.id}
                  onClick={() => setSelectedStage(step.id)}
                >
                  <span
                    className='nv-stage-fill'
                    style={{
                      width: `${Math.min(100, ((step.count || 0) / max) * 100)}%`,
                    }}
                    aria-hidden
                  />
                  <span className='nv-stage-label'>
                    {label}
                    {step.availability !== 'available' ? (
                      <small>{dataState[step.availability]}</small>
                    ) : null}
                  </span>
                  <strong>{n(step.count)}</strong>
                  <span className='nv-stage-rate'>
                    {index ? p(stageRate(step, steps[index - 1])) : '起点'}
                  </span>
                </button>
              )
            })}
          </div>
          <p className='nv-flow-note'>
            {path.featureId === 'auto_discovery'
              ? 'Not Now 表示跳过任务卡片。审批尝试与服务端确认分别展示，提案数按身份与 proposal_id 去重。'
              : `同次访问多次提交在每个阶段最多计 1 次。${path.id.includes('.auto_') ? 'Auto 需求可路由到 Task、Discuss 或 Loop，提交到受理之间的差值包含其他模式。' : '进入功能后还可能选择其他模式，进入到提交之间的差值需要结合其他路径分析。'}`}
          </p>
        </div>
        <aside className='nv-stage-detail' aria-live='polite'>
          <p className='nv-kicker'>
            当前阶段 · {dataState[active.availability]}
          </p>
          <h3>{definition.label}</h3>
          <p className='nv-detail-number'>
            {n(active.count)}
            <small>{unit}</small>
          </p>
          <p>{definition.description}</p>
          <div className='nv-condition'>
            <strong>计数条件</strong>
            <p>{definition.condition}</p>
          </div>
          <details>
            <summary>对应埋点与业务字段</summary>
            <code>{definition.event}</code>
          </details>
        </aside>
      </div>
      <div className='nv-rate-panel'>
        <div>
          <p className='nv-kicker'>目标阶段到达比例</p>
          <label>
            选择计算起点
            <select
              value={baseline.id}
              onChange={(event) => setBaselineId(event.target.value)}
            >
              {steps.slice(0, -1).map((step) => (
                <option key={step.id} value={step.id}>
                  {stageDefinition(path, step.id).label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className='nv-rate-value'>
          <strong>{p(rate)}</strong>
          <p>
            {n(last.count)} ÷ {n(baseline.count)}
          </p>
        </div>
        <p>
          {rate === null
            ? '分子或分母记录不足，或计算起点为零，当前无法计算比例。'
            : `从“${stageDefinition(path, baseline.id).label}”到“${stageDefinition(path, last.id).label}”，目前观测到的到达比例为 ${p(rate)}。`}
        </p>
      </div>
      <p className='nv-flow-note'>
        {path.pending
          ? '观察仍在进行。最近进入的访问或提案尚未走满 7 天，完成和查看计数可能继续增加。'
          : '各路径以首阶段为起点，在最多 7 天的窗口内关联后续行为。'}{' '}
        结果查看可发生在回访时，持续等待时长需要另外统计。
      </p>
      <details className='nv-details'>
        <summary>原始阶段与数据覆盖说明</summary>
        <div className='nv-table-scroll'>
          <table>
            <thead>
              <tr>
                <th>后台原始阶段</th>
                <th>计数</th>
                <th>记录状态</th>
              </tr>
            </thead>
            <tbody>
              {path.steps.map((step) => (
                <tr key={step.id}>
                  <th>
                    {step.id} · {stageDefinition(path, step.id).label}
                  </th>
                  <td>{n(step.count)}</td>
                  <td>{dataState[step.availability]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Task / Discuss
          的“进入对应模式”和“执行已受理”采用同一受理依据，计数相同时在汇报图中合并。原始数据保留以上全部阶段。Loop
          继续区分清单和实际启动。
        </p>
        <p>
          “部分记录”表示当前数值只覆盖能够观测的记录，旧数据缺少部分字段或埋点。“缺少记录”表示无法给出计数。比例仅在分子、分母均可统计且分母大于
          0 时显示。
        </p>
        {path.coverage.missingEvents.length ? (
          <p>
            缺少的历史埋点字段{' '}
            <code>{path.coverage.missingEvents.join('、')}</code>
          </p>
        ) : null}
        <p>
          无法建立路径关联而被排除的记录 {n(path.coverage.excluded)}
          。不同路径间的计数可能重叠。
        </p>
      </details>
      <a
        className='nv-source-link'
        href={reportSourceLink(range, 'funnels', feature)}
      >
        在漏斗后台复查同一范围与功能 ↗
      </a>
    </>
  )
}

export function ReportContent({
  data,
  range,
  refreshing,
  onRefresh,
}: {
  data: DashboardData
  range: ReportRange
  refreshing: boolean
  onRefresh: () => void
}) {
  const [presentation, setPresentation] = useState(false)
  const [selectedDay, setSelectedDay] = useState(range.end)
  const { history, journeys, product } = data
  const rows = history.rows
  const pv = rows.reduce((total, row) => total + row.pageviews, 0)
  const sourceTotals = rows.reduce<
    Partial<Record<(typeof rows)[number]['source'], number>>
  >((totals, row) => {
    totals[row.source] = (totals[row.source] || 0) + row.pageviews
    return totals
  }, {})
  const maxPV = Math.max(1, ...rows.map((row) => row.pageviews))
  const day =
    rows.find((row) => row.date === selectedDay) || rows[rows.length - 1]
  const auto = product.flowFunnels!.paths.find(
    (path) => path.id === 'auto_pilot.auto_task',
  )!
  const success = auto.steps.find((step) => step.id === 'success')!
  const viewed = auto.steps.find((step) => step.id === 'result')!
  const detailPath = journeys.paths.find(
    (path) =>
      path.path.length === 1 && path.path[0] === '/search-v1/:sessionId',
  )
  const knownUses =
    product.usage.operations - product.coverage.unknownFeatureUses
  const ratio = (value: number, total: number) =>
    total > 0 ? p(value / total) : '—'
  const observedStart = new Date(
    Math.max(
      Date.parse(range.startInclusive),
      Date.parse('2026-11-09T10:35:12Z'),
    ),
  ).toISOString()
  const download = () => {
    const blob = new Blob([JSON.stringify({ range, ...data }, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `novix-production-report-${range.end}.json`
    link.click()
    URL.revokeObjectURL(url)
  }
  return (
    <div className='nv-report' data-presentation={presentation}>
      <header className='nv-report-nav'>
        <a href='#nv-overview' className='nv-wordmark'>
          NOVIX <span>产品使用汇报</span>
        </a>
        <nav aria-label='汇报章节'>
          <a href='#nv-journeys'>访问路径</a>
          <a href='#nv-research'>研究流程</a>
          <a href='#nv-methods'>数据说明</a>
        </nav>
        <button
          type='button'
          aria-pressed={presentation}
          onClick={() => setPresentation(!presentation)}
        >
          {presentation ? '退出演示' : '演示视图'} ↗
        </button>
      </header>
      <section id='nv-overview' className='nv-section nv-overview'>
        <div className='nv-hero-top'>
          <p className='nv-kicker'>
            <span className='nv-status-dot' />
            正式环境 · novix.science
          </p>
          <p className='nv-snapshot'>
            取数完成 {dateTime(data.fetchedAt)} · {REPORT_TIMEZONE}
          </p>
        </div>
        <div className='nv-hero-grid'>
          <div>
            <h1>
              最近 30 天<br />
              产品使用汇报<span>.</span>
            </h1>
            <p className='nv-date'>
              {range.start} — {range.end}
            </p>
            <p className='nv-intro'>
              从页面访问到研究结果查看，
              <br />
              沿业务路径理解用户行为。
            </p>
          </div>
          <div className='nv-primary-metric'>
            <p>近 30 天页面浏览量</p>
            <strong>{n(pv)}</strong>
            <p>PV · 历史与新增流量合并</p>
            <div className='nv-source-totals'>
              {Object.entries(sourceTotals).map(([source, total]) => (
                <span key={source}>
                  <i className={`nv-source-dot nv-${source}`} />
                  {sourceName[source as keyof typeof sourceName]}{' '}
                  <b>{n(total!)}</b>
                </span>
              ))}
            </div>
            <p className='nv-small'>每天使用一个来源 · 11.10 起采用 Swetrix</p>
          </div>
        </div>
        <div className='nv-trend-title'>
          <h2>每日页面浏览量</h2>
          <span>选择日期查看数值</span>
        </div>
        <div className='nv-chart' aria-label='近 30 天每日页面浏览量'>
          {rows.map((row) => (
            <button
              type='button'
              key={row.date}
              aria-label={`${row.date}，${sourceName[row.source]}，${n(row.pageviews)} PV`}
              aria-pressed={row.date === day.date}
              onClick={() => setSelectedDay(row.date)}
              title={`${row.date} · ${n(row.pageviews)} PV`}
            >
              <span
                className={`nv-${row.source}`}
                style={{ height: `${(row.pageviews / maxPV) * 100}%` }}
              />
            </button>
          ))}
        </div>
        <div className='nv-chart-axis'>
          {[0, 7, 14, 21, 29].map((index) => (
            <span key={index}>
              {rows[index].date.slice(5).replace('-', '.')}
            </span>
          ))}
        </div>
        <p className='nv-chart-readout' aria-live='polite'>
          {day.date} · {sourceName[day.source]} · {n(day.pageviews)} PV
          {day.date === range.end ? ' · 今日截至本次取数' : ''}
        </p>
        <div className='nv-scope-strip'>
          <span aria-hidden>i</span>
          <p>
            <strong>历史流量覆盖 30 天，行为明细覆盖实际采集期。</strong>{' '}
            路径与研究流程明细从 11 月 9
            日开始，历史聚合流量无法还原同样的逐步路径。今日数据仍会增加。
          </p>
          <a href={reportSourceLink(range, 'traffic')}>复查流量后台 ↗</a>
        </div>
      </section>

      <section id='nv-journeys' className='nv-section nv-paper'>
        <div className='nv-section-heading'>
          <div>
            <p className='nv-kicker'>访问路径</p>
            <h2>用户访问了哪些页面</h2>
          </div>
          <p>
            实际明细起点 {dateTime(observedStart)}
            <br />
            路径快照 {dateTime(journeys.snapshotAt)}
          </p>
        </div>
        <div className='nv-journey-metrics'>
          {[
            [journeys.totalSessions, '次访问'],
            [journeys.totalUsers, '个观测身份'],
            [journeys.totalPaths, '种页面路径'],
          ].map(([value, label]) => (
            <div key={label}>
              <strong>{n(value as number)}</strong>
              <span>{label}</span>
            </div>
          ))}
          <p>
            一次访问可浏览多个页面。
            <br />
            观测身份包含登录与匿名浏览器身份。
          </p>
        </div>
        <div className='nv-table-scroll'>
          <table className='nv-path-table'>
            <thead>
              <tr>
                <th>高频页面路径</th>
                <th>访问次数</th>
                <th>观测身份</th>
                <th>占全部访问</th>
              </tr>
            </thead>
            <tbody>
              {journeys.paths.slice(0, 7).map((path) => (
                <tr key={JSON.stringify(path.path)}>
                  <th>
                    <div className='nv-path-name'>
                      {path.path.map((route, index) => (
                        <span key={index}>
                          {index ? <i aria-hidden>→</i> : null}
                          {ROUTE_NAMES[route] || route}
                        </span>
                      ))}
                      {path.continued > 0 ? (
                        <small>部分访问还有后续页面</small>
                      ) : null}
                    </div>
                    <div
                      className='nv-path-bar'
                      style={{
                        width: `${journeys.totalSessions ? (path.sessions / journeys.totalSessions) * 100 : 0}%`,
                      }}
                    />
                  </th>
                  <td>{n(path.sessions)}</td>
                  <td>{n(path.users)}</td>
                  <td>{ratio(path.sessions, journeys.totalSessions)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className='nv-two-notes'>
          <p>
            <strong>按页面类型整理</strong>
            <br />
            相邻同类页面合并。多个具体任务的详情 URL
            会统一为“研究会话详情”。路径显示每次访问的前 5 个页面类型。
          </p>
          <p>
            <strong>按访问计数</strong>
            <br />
            身份数跨路径可重复。{n(journeys.coverage.ambiguousOrderVisits)}{' '}
            次访问存在同时间页面顺序歧义，计入访问总数，路径排名予以排除。
            {n(journeys.coverage.uncertainEnd)} 次访问的结束尚不确定。
          </p>
        </div>
        <a
          className='nv-source-link'
          href={reportSourceLink(range, 'journeys')}
        >
          在用户旅程后台复查同一范围 ↗
        </a>
      </section>

      <section id='nv-research' className='nv-section nv-research'>
        <div className='nv-section-heading'>
          <div>
            <p className='nv-kicker'>研究流程</p>
            <h2>
              从进入研究区
              <br />
              到结果被查看
            </h2>
          </div>
          <p>
            选择业务路径与阶段查看定义
            <br />
            业务快照 {dateTime(product.snapshotAt)}
          </p>
        </div>
        <FlowReport paths={product.flowFunnels!.paths} range={range} />
      </section>

      <section className='nv-section nv-paper'>
        <div className='nv-section-heading'>
          <div>
            <p className='nv-kicker'>业务观察</p>
            <h2>现有数据支持的结论</h2>
          </div>
        </div>
        <div className='nv-findings'>
          <article>
            <strong>
              {detailPath
                ? ratio(detailPath.sessions, journeys.totalSessions)
                : '—'}
            </strong>
            <h3>高频路径为研究会话详情类型</h3>
            <p>
              {n(detailPath?.sessions ?? null)}{' '}
              次访问在整理后的路径中仅呈现“研究会话详情”类型。同类型下可能包含多个任务。
            </p>
          </article>
          <article>
            <strong>{p(stageRate(viewed, success))}</strong>
            <h3>成功任务关联到结果查看</h3>
            <p>
              Auto Pilot 的 Auto → Task 路径中，{n(success.count)}{' '}
              次访问关联到成功任务，其中 {n(viewed.count)}{' '}
              次关联到后续结果查看，允许回访查看。
            </p>
          </article>
          <article>
            <strong>{ratio(knownUses, product.usage.operations)}</strong>
            <h3>功能使用有可识别的功能归属</h3>
            <p>
              {n(product.usage.operations)} 次已受理操作中，
              {n(product.coverage.unknownFeatureUses)}{' '}
              次缺少足够的功能归属字段。跨功能比较仅覆盖可归属部分。
            </p>
          </article>
        </div>
        <p className='nv-business-note'>
          结果查看比例只能说明后续查看行为。持续等待、对耗时的敏感程度、收藏详情链接及结果质量带来的回访，需要结合耗时、离开、回访和后续任务进一步验证。
        </p>
      </section>

      <section id='nv-methods' className='nv-section nv-methods'>
        <div className='nv-section-heading'>
          <div>
            <p className='nv-kicker'>数据说明</p>
            <h2>每个数字都有统计范围</h2>
          </div>
          <button type='button' disabled={refreshing} onClick={onRefresh}>
            {refreshing ? '正在重新取数…' : '刷新整份看板 ↻'}
          </button>
        </div>
        <div className='nv-table-scroll'>
          <table className='nv-method-table'>
            <thead>
              <tr>
                <th>指标</th>
                <th>计数与去重</th>
                <th>覆盖范围和必要说明</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>页面浏览量 PV</th>
                <td>
                  每天选一个来源，再对 30 天求和。不同来源的采集规则存在差异。
                </td>
                <td>
                  11.09 及以前采用导入聚合值，11.10 起使用 Swetrix 中
                  host=novix.science 的页面访问。历史来源无法统一排除内部流量。
                </td>
              </tr>
              <tr>
                <th>访问次数</th>
                <td>
                  优先按原生 sid 归组。缺失 sid 时，按身份与 30
                  分钟无活动间隔切分。
                </td>
                <td>
                  正式项目原生明细从 11.09 18:35 起覆盖。一次访问可包含多次
                  PV。历史 Cloudflare Visits
                  沿用其独立定义，本页保留原生访问路径的计数方式。
                </td>
              </tr>
              <tr>
                <th>观测身份</th>
                <td>登录身份或匿名浏览器身份去重，身份变化可拆分访问。</td>
                <td>
                  跨设备与标识变化可能形成多个身份，无法直接换算为注册账号人数。身份数跨日或跨路径求和会重复。
                </td>
              </tr>
              <tr>
                <th>研究流程</th>
                <td>
                  按身份、匿名浏览器与 session_id
                  组成的访问去重，各阶段沿同一操作和根任务关联。
                </td>
                <td>
                  入口位于所选范围，后续最多观察 7×24
                  小时。流程排除已识别内部账号，匿名或内部身份未知的流量仍可能保留。不同路径间可重复。
                </td>
              </tr>
              <tr>
                <th>提案流程</th>
                <td>
                  审批、跳过及 Running 项目承接按身份与 proposal_id
                  去重，输入路径按访问计数。
                </td>
                <td>
                  旧数据缺少部分新埋点。局部可观测计数保留“部分记录”说明，数据不足时比例显示
                  —。Not Now 表示跳过该任务卡片。
                </td>
              </tr>
              <tr>
                <th>功能使用</th>
                <td>后端已受理的用户主动操作去重计数，单位为操作次数。</td>
                <td>
                  业务事实覆盖时间早于前端行为明细。历史缺少功能字段时保留“功能未归属”，无法可靠补分到具体科研功能。
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <details className='nv-details'>
          <summary>数据核对方式与覆盖缺口</summary>
          <ul>
            <li>
              全部接口固定读取 Novix Production 项目，服务端业务响应须为
              production。固定采用上海时区最近 30 个自然日，含今天。
            </li>
            <li>
              流量校验 30
              个日期连续且每天唯一，再从同一接口的逐日值求和。图表、来源拆分与总
              PV 共用这份逐日数据。
            </li>
            <li>
              路径、流程和结论直接引用后台返回的聚合计数。整份看板在全部接口成功后一起更新，接口失败时保留可识别的错误状态。
            </li>
            <li>
              路径按正式项目归集，部分旧页面记录缺少 host。PV 的新增部分要求
              host=novix.science，二者的域名覆盖与内部流量筛选存在差异。
            </li>
            <li>
              研究流程从 11.09 开始有前端行为记录，Loop 实际启动从 11.12
              开始有记录，Auto-Discovery 提案展示与决定从 11.13 开始有记录。选择
              30 天只能覆盖这些实际可观测记录。
            </li>
            <li>
              每节标注独立接口快照时间，接口执行相差数秒。再次打开或刷新后台时，新增访问与延迟入库可能让今天的计数继续变化。
            </li>
          </ul>
          <p>
            页面取数接口为 history/unified、journeys/paths 和
            product/report。所有请求沿用看板登录会话与私有项目权限，下载数据中保留取数范围、筛选与快照。
          </p>
        </details>
        <footer>
          <span>NOVIX</span>
          <p>
            {range.start} — {range.end} · 正式环境 · {REPORT_TIMEZONE}
          </p>
          <button type='button' onClick={download}>
            下载本页数据 ↓
          </button>
        </footer>
      </section>
    </div>
  )
}

export default function ReportDashboard() {
  const [range, setRange] = useState(() => reportRange())
  const query = useQuery({
    queryKey: ['novix-report-dashboard', range.start, range.end],
    queryFn: ({ signal }) => readDashboard(range, signal),
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const refresh = () => {
    const next = reportRange()
    if (next.end === range.end) void query.refetch()
    else setRange(next)
  }
  return (
    <div>
      {query.isPending ? (
        <Loader label='正在读取正式环境最近 30 天数据' showLabel />
      ) : null}
      {query.error ? (
        <div
          role='alert'
          className='mb-4 rounded-lg border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100'
        >
          <p>
            {query.data
              ? '本次刷新失败，下方保留上次成功快照及其取数时间。'
              : '汇报数据读取失败，请重试。'}{' '}
            {query.error instanceof ReportError
              ? `HTTP ${query.error.status} · ${query.error.code}`
              : ''}
          </p>
          <Button variant='secondary' onClick={refresh}>
            重新取数
          </Button>
        </div>
      ) : null}
      {query.data ? (
        <ReportContent
          data={query.data}
          range={range}
          refreshing={query.isFetching}
          onRefresh={refresh}
        />
      ) : null}
    </div>
  )
}
