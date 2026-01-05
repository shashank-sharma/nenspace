import { format, parse } from 'date-fns'

export function formatDate(date: Date, formatString: string): string {
  try {
    return format(date, formatString)
  } catch {
    return format(date, 'yyyy-MM-dd')
  }
}

export function parseDate(dateString: string, formatString: string): Date | null {
  try {
    return parse(dateString, formatString, new Date())
  } catch {
    return null
  }
}

export function getDailyNotePath(date: Date, formatString: string, folder: string): string {
  const filename = formatDate(date, formatString)
  return folder ? `${folder}/${filename}.md` : `${filename}.md`
}

