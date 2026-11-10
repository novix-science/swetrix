export interface JourneyUser {
  profileId: string
  userId: string
  email: string
}

export interface JourneyPath {
  path: string[]
  sessions: number
  users: number
  continued: number
  startsBeforeRange: number
  uncertainEnd: number
}

export interface JourneyBase {
  schemaVersion: 1
  resolvedRange: {
    startInclusive: string
    endExclusive: string
    timezone: string
  }
  snapshotAt: string
  identityScope: 'observed_profile_only'
  filters: { depth: number; profile: string; take: number; skip: number }
}

export interface JourneyPaths extends JourneyBase {
  totalSessions: number
  totalUsers: number
  totalPaths: number
  paths: JourneyPath[]
  coverage: {
    startsBeforeRange: number
    uncertainEnd: number
    pageLimitVisits: number
    ambiguousOrderVisits: number
  }
}

export interface JourneyVisit {
  visitId: string
  profileId: string
  startedAt: string
  lastSeen: string
  pageviews: number
  startsBeforeRange: boolean
  uncertainEnd: boolean
  continued: boolean
  ambiguousOrder: boolean
  pages: { at: string; route: string; rawPath: string }[]
}

export interface JourneyVisits extends JourneyBase {
  totalSessions: number
  visits: JourneyVisit[]
}

export interface JourneyConversion extends JourneyBase {
  steps: {
    step: number
    route: string
    sessions: number
    users: number
    continued: number
    ended: number
    unknown: number
    matchedNext: number
  }[]
}

export interface JourneyUsers extends JourneyBase {
  users: JourneyUser[]
  hasMore: boolean
}

export type JourneyView = 'list' | 'flow' | 'conversion' | 'original'
export type JourneyLanguage = 'en' | 'zh'
