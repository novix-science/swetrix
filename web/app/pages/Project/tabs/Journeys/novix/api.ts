import type { JourneyBase } from './types'

export class JourneyError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code)
  }
}

export async function readJourney<T extends JourneyBase>(
  path: string,
  signal: AbortSignal,
): Promise<T> {
  const response = await fetch(path, { credentials: 'same-origin', signal })
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new JourneyError(response.status, error.error || 'request_failed')
  }
  const body = await response.json()
  if (
    body.schemaVersion !== 1 ||
    !body.resolvedRange ||
    body.identityScope !== 'observed_profile_only' ||
    !['paths', 'visits', 'steps', 'users'].some((key) =>
      Array.isArray(body[key]),
    )
  )
    throw new JourneyError(502, 'invalid_report')
  return body
}

export function journeyQuery(options: {
  searchParams: URLSearchParams
  period: string
  timeBucket: string
  timezone: string
}) {
  const query = new URLSearchParams({
    period: options.period,
    timeBucket: options.timeBucket,
    timezone: options.timezone,
  })
  for (const key of ['from', 'to']) {
    const value = options.searchParams.get(key)
    if (value) query.set(key, value)
  }
  const profile = options.searchParams.get('journeyProfile')
  if (profile) query.set('profile', profile)
  return query
}
