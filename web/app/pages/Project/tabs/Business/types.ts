export type Metric = number | null
export type Labels = Record<string, string>

export interface Rate {
  value: Metric
  numerator: number
  denominator: number
  availability: string
  maturity: string
}

export interface BusinessRange {
  startInclusive: string
  endExclusive: string
  timezone: string
}

export interface BusinessFeature {
  id: string
  label: string
  availability: string
  exposures: number
  exposedActors: number
  clicks: number
  clickedActors: number
  uses: number
  users: number
  averageUses: Metric
  viewedActors?: Metric
  interactedActors?: Metric
  featureSources?: {
    recorded: number
    recovered: number
    legacy: number
    unknown: number
  }
}

interface Cohort {
  date?: string
  week?: string
  day: number
  exact: Rate
  cumulative: Rate
}

export interface ProductReport {
  schemaVersion: 1
  filters?: { feature?: string }
  environment: string
  snapshotAt: string
  resolvedRange: BusinessRange
  traffic: {
    availability: string
    pv: Metric
    uv: Metric
    users: Metric
    engagedSeconds: Metric
    averageEngagedSeconds: Metric
  }
  usage: {
    operations: number
    users: number
    newUsers: number
    returningUsers: number
  }
  features: BusinessFeature[]
  auxiliary: BusinessFeature[]
  frequency: {
    days: number
    users: number
    uses: number
    averageUses: Metric
    averageActiveDays: Metric
    medianIntervalSeconds: Metric
    distribution: Record<string, number>
  }[]
  retention: {
    points: {
      day: number
      exact: Rate
      cumulative: Rate
      pendingUsers: number
      unknownFirstUsers: number
    }[]
    daily: Cohort[]
    weekly: Cohort[]
  }
  delivery: {
    statuses: Record<string, number>
    eventsInRange: Record<string, number>
    successWithin7Days: Rate
    pendingOperations: number
    duration: {
      p50Seconds: Metric
      p90Seconds: Metric
      reported: number
      missing: number
    }
    inFlight: { count: number; ageP90Seconds: Metric }
  }
  funnel: {
    availability: string
    pendingUsers: number
    steps: { id: string; users: number; fromPrevious: Rate; fromFirst: Rate }[]
  }
  channels: {
    source: string
    medium: string
    campaign: string
    pv: number
    visitors: number
    uses: number
    users: number
  }[]
  registrations: { total: number }
  coverage: {
    missingCompletionTimes: number
    excludedOrigins: number
    unknownFeatureUses: number
    featureAttribution?: {
      total: number
      recorded: number
      recovered: number
      legacy: number
      unknown: number
      firstRecordedAt: string | null
    }
    identity: { legacyAnonymousEvents: number }
    filterGaps: Record<string, number>
  }
}

export interface ResourceOverview {
  schemaVersion: 1
  environment: string
  snapshotAt: string
  resolvedRange: BusinessRange
  taskSummary: { total: number; byStatus: Record<string, number> }
  creditSummary: {
    creditsConsumed: number
    consumeCount: number
    averageCredits: Metric
  }
  taskTrend: { date: string; total: number; byStatus: Record<string, number> }[]
  creditTrend: { date: string; creditsConsumed: number; consumeCount: number }[]
  tokenUsage: {
    availability: string
    totalConsumeCount: number
    metrics: Record<
      string,
      { total: Metric; reportedRecordCount: number } | null
    >
  }
}
