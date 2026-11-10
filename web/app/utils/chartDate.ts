import { timeFormatLocale, type TimeLocaleDefinition } from 'd3'

const locales = new Map<string, ReturnType<typeof timeFormatLocale>>()

const chineseFormats: Record<string, string> = {
  '%I %p': '%p%I时',
  '%I:%M %p': '%p%I:%M',
  '%d %b': '%-m月%-d日',
  '%b %d': '%-m月%-d日',
  '%d %b %I %p': '%-m月%-d日 %p%I时',
  '%d %b %H:%M': '%-m月%-d日 %H:%M',
  '%b %d %H:%M': '%-m月%-d日 %H:%M',
  '%a, %d %b': '%-m月%-d日 %a',
  '%b %Y': '%Y年%-m月',
  '%B %Y': '%Y年%-m月',
  '%b %d, %Y': '%Y年%-m月%-d日',
  '%b %d, %Y %H:%M': '%Y年%-m月%-d日 %H:%M',
  '%A, %b %d, %Y': '%Y年%-m月%-d日 %A',
  '%I:00 - %I:59 %p': '%p%I:00 - %I:59',
}

export function chartTimeFormatter(language = 'en', utc = false) {
  let locale = locales.get(language)
  if (!locale) {
    let tag = language
    try {
      new Intl.DateTimeFormat(tag)
    } catch {
      tag = 'en'
    }
    const names = (options: Intl.DateTimeFormatOptions, dates: Date[]) => {
      const formatter = new Intl.DateTimeFormat(tag, {
        ...options,
        timeZone: 'UTC',
      })
      return dates.map((date) => formatter.format(date))
    }
    const months = Array.from(
      { length: 12 },
      (_, i) => new Date(Date.UTC(2000, i, 1)),
    )
    const days = Array.from(
      { length: 7 },
      (_, i) => new Date(Date.UTC(2000, 0, 2 + i)),
    )
    const period = new Intl.DateTimeFormat(tag, {
      hour: 'numeric',
      hour12: true,
      timeZone: 'UTC',
    })
    locale = timeFormatLocale({
      dateTime: '%x %X',
      date: '%Y-%m-%d',
      time: '%H:%M:%S',
      periods: [0, 12].map(
        (hour) =>
          period
            .formatToParts(new Date(Date.UTC(2000, 0, 1, hour)))
            .find((part) => part.type === 'dayPeriod')?.value || '',
      ) as TimeLocaleDefinition['periods'],
      days: names({ weekday: 'long' }, days) as TimeLocaleDefinition['days'],
      shortDays: names(
        { weekday: 'short' },
        days,
      ) as TimeLocaleDefinition['shortDays'],
      months: names(
        { month: 'long' },
        months,
      ) as TimeLocaleDefinition['months'],
      shortMonths: names(
        { month: 'short' },
        months,
      ) as TimeLocaleDefinition['shortMonths'],
    })
    locales.set(language, locale)
  }
  const chinese = language.toLowerCase().startsWith('zh')
  const formatDate = utc ? locale.utcFormat : locale.format
  return (format: string) =>
    formatDate(chinese ? chineseFormats[format] || format : format)
}
