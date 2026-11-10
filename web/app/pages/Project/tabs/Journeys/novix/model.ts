import en from './en.json'
import zh from './zh.json'
import type { JourneyLanguage, JourneyPath, JourneyView } from './types'

export const labelsFor = (language: JourneyLanguage) =>
  language === 'zh' ? zh : en
export type JourneyLabels = typeof en

export function readJourneyView(params: URLSearchParams): JourneyView {
  const view = params.get('journeyView')
  if (
    view === 'list' ||
    view === 'flow' ||
    view === 'conversion' ||
    view === 'original'
  ) {
    return view
  }
  const originalView = params.get('view')
  return originalView === 'chart' || originalView === 'table'
    ? 'original'
    : 'list'
}

export function routeColour(route: string): string {
  if (route.startsWith('__')) return '#64748b'
  const colours = [
    '#2563eb',
    '#0d9488',
    '#7c3aed',
    '#db2777',
    '#ea580c',
    '#65a30d',
    '#0891b2',
    '#c026d3',
    '#4f46e5',
    '#b45309',
  ]
  const hash = [...route].reduce(
    (value, character) => (value * 31 + character.charCodeAt(0)) | 0,
    0,
  )
  return colours[Math.abs(hash) % colours.length]
}

export function routeLabel(route: string, l: JourneyLabels): string {
  const routes: Record<string, string> = {
    '/': l.home,
    '/chat': l.workspace,
    '/search-v1/:sessionId': l.session,
    '/projects/:projectId': l.project,
    '/register': l.register,
    '/login': l.login,
    '/file-space': l.files,
    '/account/upgrade': l.upgrade,
    '/auto-discovery': l.discovery,
    '/deepsurvey': 'Deep Survey',
    '/ideaspark': 'Idea Spark',
    '/methoddesign': 'Method Design',
    '/notebook': 'Data Analysis',
    '/reproduce': 'Reproduce Paper',
    '/autoexperiment': 'Auto Experiment',
  }
  return routes[route] || route
}

export function readSelectedPath(value: string | null): string[] {
  try {
    const parsed: unknown = JSON.parse(value || 'null')
    return Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed.length <= 10 &&
      parsed.every(
        (x) => typeof x === 'string' && x.startsWith('/') && x.length <= 2048,
      )
      ? parsed
      : []
  } catch {
    return []
  }
}

export const percent = (value: number, total: number) =>
  total ? `${((value / total) * 100).toFixed(1)}%` : '—'

export function flowData(paths: JourneyPath[], l: JourneyLabels) {
  const nodes = new Map<string, { id: string; label: string }>()
  const links = new Map<
    string,
    { source: string; target: string; value: number }
  >()
  const addNode = (
    step: number,
    route: string,
    label = routeLabel(route, l),
  ) => {
    const id = `${step}:${route}`
    nodes.set(id, { id, label })
    return id
  }
  const addLink = (source: string, target: string, value: number) => {
    if (!value) return
    const key = JSON.stringify([source, target])
    links.set(key, {
      source,
      target,
      value: (links.get(key)?.value || 0) + value,
    })
  }
  for (const item of paths) {
    let previous = ''
    item.path.forEach((route, index) => {
      const node = addNode(index, route)
      if (previous) addLink(previous, node, item.sessions)
      previous = node
    })
    if (!previous) continue
    const step = item.path.length
    addLink(previous, addNode(step, '__more__', l.more), item.continued)
    addLink(
      previous,
      addNode(step, '__unknown__', l.unknown),
      item.uncertainEnd,
    )
    addLink(
      previous,
      addNode(step, '__end__', l.end),
      Math.max(0, item.sessions - item.continued - item.uncertainEnd),
    )
  }
  const used = new Set(
    [...links.values()].flatMap((link) => [link.source, link.target]),
  )
  return {
    nodes: [...nodes.values()].filter((node) => used.has(node.id)),
    links: [...links.values()],
  }
}
