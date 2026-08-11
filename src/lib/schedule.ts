import type { WorkBook } from 'xlsx'
import * as XLSX from 'xlsx'
import { cleanText } from './names'

export const DAY_ORDER = [
  'Pazartesi',
  'Salı',
  'Çarşamba',
  'Perşembe',
  'Cuma',
  'Cumartesi',
] as const

export type DayName = (typeof DAY_ORDER)[number]

export function dayRank(day: string): number {
  const idx = DAY_ORDER.indexOf(day as DayName)
  return idx === -1 ? 99 : idx
}

export type Appointment = {
  id: string
  rowNumber: number
  note: string
  sinif: string
  ad: string
  soyad: string
  veliAd: string
  veliSoyad: string
  telefon: string
  empty: boolean
  slots: {
    day: DayName
    raw: string
    time: string
    timeMinutes: number
    label: string
  }[]
}

const TIME_COLS: { col: number; day: DayName }[] = [
  { col: 10, day: 'Pazartesi' },
  { col: 13, day: 'Salı' },
  { col: 16, day: 'Çarşamba' },
  { col: 19, day: 'Perşembe' },
  { col: 22, day: 'Cuma' },
  { col: 7, day: 'Cumartesi' },
]

function sheetToMatrix(sheet: XLSX.WorkSheet): string[][] {
  const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(
    sheet,
    { header: 1, defval: '', raw: false, blankrows: false },
  )
  return matrix.map((row) =>
    row.map((cell) => (cell == null ? '' : String(cell))),
  )
}

function findScheduleMatrix(workbook: WorkBook): string[][] | null {
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name]
    if (!sheet) continue
    const matrix = sheetToMatrix(sheet)
    const row0 = (matrix[0] ?? []).map(cleanText).join('|').toLocaleLowerCase('tr-TR')
    const row1 = (matrix[1] ?? []).map(cleanText).join('|').toLocaleLowerCase('tr-TR')
    if (
      row0.includes('cumartesi') &&
      row1.includes('sınıfı') &&
      row1.includes('adı')
    ) {
      return matrix
    }
  }
  if (workbook.Sheets.Sayfa2) return sheetToMatrix(workbook.Sheets.Sayfa2)
  return null
}

export function parseTimeLabel(raw: string): {
  time: string
  timeMinutes: number
  label: string
} {
  const text = cleanText(raw)
  const match = text.match(/(\d{1,2})[.:](\d{2})/)
  if (!match) {
    return { time: '', timeMinutes: 9999, label: text }
  }
  const hour = Number(match[1])
  const minute = Number(match[2])
  const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  const label = text.replace(match[0], '').replace(/^[\s\-–—]+/, '').trim() || text
  return { time, timeMinutes: hour * 60 + minute, label }
}

export function parseAppointments(workbook: WorkBook): Appointment[] {
  const matrix = findScheduleMatrix(workbook)
  if (!matrix) return []

  const list: Appointment[] = []
  for (let i = 2; i < matrix.length; i++) {
    const row = matrix[i] ?? []
    const sinif = cleanText(row[1])
    const ad = cleanText(row[2])
    const soyad = cleanText(row[3])
    if (!sinif && !ad && !soyad && !TIME_COLS.some(({ col }) => cleanText(row[col]))) {
      continue
    }

    const slots = TIME_COLS.flatMap(({ col, day }) => {
      const raw = cleanText(row[col])
      if (!raw) return []
      const parsed = parseTimeLabel(raw)
      return [{ day, raw, ...parsed }]
    })

    list.push({
      id: `row-${i}`,
      rowNumber: i + 1,
      note: cleanText(row[0]),
      sinif,
      ad,
      soyad,
      veliAd: cleanText(row[4]),
      veliSoyad: cleanText(row[5]),
      telefon: cleanText(row[6]),
      empty: !ad && !soyad,
      slots,
    })
  }
  return list
}

export function fullName(ap: Pick<Appointment, 'ad' | 'soyad'>): string {
  return `${ap.ad} ${ap.soyad}`.replace(/\s+/g, ' ').trim()
}

export function appointmentsFromPreview(
  rows: {
    rowNumber: number
    sinif: string
    ad: string
    soyad: string
    telefon: string
    saatler: string
  }[],
  source: Appointment[],
): Appointment[] {
  const byRow = new Map(source.map((a) => [a.rowNumber, a]))
  return rows.map((row) => {
    const prev = byRow.get(row.rowNumber)
    return {
      id: `row-${row.rowNumber}`,
      rowNumber: row.rowNumber,
      note: prev?.note ?? '',
      sinif: row.sinif,
      ad: row.ad,
      soyad: row.soyad,
      veliAd: prev?.veliAd ?? '',
      veliSoyad: prev?.veliSoyad ?? '',
      telefon: row.telefon,
      empty: !row.ad && !row.soyad,
      slots: prev?.slots ?? [],
    }
  })
}
