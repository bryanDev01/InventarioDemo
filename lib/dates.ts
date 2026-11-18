import { APP_TIMEZONE } from '@/lib/constants'

interface ZonedParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

const zonedFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

const getZonedParts = (date: Date): ZonedParts => {
  const parts = zonedFormatter.formatToParts(date)
  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? 0)
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  }
}

const getZoneOffsetMs = (date: Date): number => {
  const parts = getZonedParts(date)
  const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return localAsUtc - Math.floor(date.getTime() / 1000) * 1000
}

export const zonedDateTimeToUtc = (year: number, month: number, day: number, hour: number = 0, minute: number = 0): Date => {
  const guess = Date.UTC(year, month - 1, day, hour, minute)
  const firstPass = guess - getZoneOffsetMs(new Date(guess))
  return new Date(guess - getZoneOffsetMs(new Date(firstPass)))
}

const pad = (value: number): string => String(value).padStart(2, '0')

export const formatDate = (date: Date): string => {
  const parts = getZonedParts(date)
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`
}

export const formatDateTime = (date: Date): string => {
  const parts = getZonedParts(date)
  return `${formatDate(date)} ${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`
}

export const getTodayDate = (): string => formatDate(new Date())

export const getDayRangeUtc = (fromDate: string, toDate: string): { start: Date; end: Date } => {
  const [fromYear, fromMonth, fromDay] = fromDate.split('-').map(Number)
  const [toYear, toMonth, toDay] = toDate.split('-').map(Number)
  const start = zonedDateTimeToUtc(fromYear, fromMonth, fromDay)
  const nextDayStart = zonedDateTimeToUtc(toYear, toMonth, toDay + 1)
  return { start, end: nextDayStart }
}
