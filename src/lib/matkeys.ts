import * as XLSX from 'xlsx-js-style'
import { compareClass, excelRgb, themeForClass } from './classes'
import {
  cleanText,
  fullNameFold,
  fullNameKey,
  normalizeClass,
} from './names'
import { dayRank, parseTimeLabel } from './schedule'

export type LiveStudent = {
  sinif: string
  ad: string
  soyad: string
  veliAd: string
  veliSoyad: string
  telefon: string
  sourceSheet: string
}

export type PersonSnapshot = {
  sinif: string
  ad: string
  soyad: string
  veli: string
  telefon: string
}

export type SyncChange = {
  type: 'kept' | 'updated' | 'removed' | 'added' | 'unplaced'
  label: string
  detail?: string
  sinif?: string
  rowNumber?: number
  before?: PersonSnapshot
  after?: PersonSnapshot
}

export type MatkeysSyncResult = {
  workbook: XLSX.WorkBook
  changes: SyncChange[]
  summary: {
    liveCount: number
    kept: number
    updated: number
    removed: number
    added: number
    unplaced: number
    emptySlots: number
  }
  previewRows: {
    rowNumber: number
    sinif: string
    ad: string
    soyad: string
    telefon: string
    saatler: string
    status: string
  }[]
}

const CLASS_SHEET = /^\d+[.\-]\w+$/i
const TIME_COLS: { col: number; day: string }[] = [
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

function isClassRosterSheet(name: string, matrix: string[][]): boolean {
  if (!CLASS_SHEET.test(name.trim())) return false
  // canlı sınıf listeleri noktalı (5.B); koçluk plan sayfaları tireli (5-B)
  if (name.includes('-')) return false
  const header = matrix[1] ?? []
  const joined = header.map(cleanText).join('|').toLocaleLowerCase('tr-TR')
  return joined.includes('adı') && joined.includes('soyadı') && joined.includes('şube')
}

function isKoclukScheduleSheet(matrix: string[][]): boolean {
  const row0 = (matrix[0] ?? []).map(cleanText).join('|').toLocaleLowerCase('tr-TR')
  const row1 = (matrix[1] ?? []).map(cleanText).join('|').toLocaleLowerCase('tr-TR')
  return (
    row0.includes('cumartesi') &&
    row1.includes('sınıfı') &&
    row1.includes('adı') &&
    row1.includes('saat')
  )
}

export function extractLiveStudents(workbook: XLSX.WorkBook): LiveStudent[] {
  const students: LiveStudent[] = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue
    const matrix = sheetToMatrix(sheet)
    if (!isClassRosterSheet(sheetName, matrix)) continue

    for (let i = 2; i < matrix.length; i++) {
      const row = matrix[i] ?? []
      const ad = cleanText(row[2])
      const soyad = cleanText(row[3])
      if (!ad && !soyad) continue
      students.push({
        sinif: cleanText(row[1]) || sheetName.replace('-', '.'),
        ad,
        soyad,
        veliAd: cleanText(row[6]),
        veliSoyad: cleanText(row[7]),
        telefon: cleanText(row[9]),
        sourceSheet: sheetName,
      })
    }
  }

  return students
}

function findKoclukSheet(workbook: XLSX.WorkBook): {
  name: string
  matrix: string[][]
} | null {
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name]
    if (!sheet) continue
    const matrix = sheetToMatrix(sheet)
    if (isKoclukScheduleSheet(matrix)) return { name, matrix }
  }
  // fallback: Sayfa2
  if (workbook.Sheets.Sayfa2) {
    return { name: 'Sayfa2', matrix: sheetToMatrix(workbook.Sheets.Sayfa2) }
  }
  return null
}

function rowTimes(row: string[]): string {
  return TIME_COLS.map(({ col, day }) => {
    const raw = cleanText(row[col])
    return raw ? `${day} ${raw}` : ''
  })
    .filter(Boolean)
    .join(' · ')
}

function ensureWidth(row: string[], width: number) {
  while (row.length < width) row.push('')
  return row
}

function studentLabel(s: Pick<LiveStudent, 'ad' | 'soyad' | 'sinif'>) {
  return `${s.sinif} ${s.ad} ${s.soyad}`.replace(/\s+/g, ' ').trim()
}

function snapshotFromRow(row: string[]): PersonSnapshot {
  return {
    sinif: cleanText(row[1]),
    ad: cleanText(row[2]),
    soyad: cleanText(row[3]),
    veli: `${cleanText(row[4])} ${cleanText(row[5])}`.trim(),
    telefon: cleanText(row[6]),
  }
}

function snapshotFromStudent(student: LiveStudent): PersonSnapshot {
  return {
    sinif: student.sinif,
    ad: student.ad,
    soyad: student.soyad,
    veli: `${student.veliAd} ${student.veliSoyad}`.trim(),
    telefon: student.telefon,
  }
}

function findLiveMatch(
  ad: string,
  soyad: string,
  byKey: Map<string, LiveStudent>,
  byFold: Map<string, LiveStudent>,
): LiveStudent | undefined {
  return byKey.get(fullNameKey(ad, soyad)) ?? byFold.get(fullNameFold(ad, soyad))
}

function writeStudentFields(row: string[], student: LiveStudent) {
  row[1] = student.sinif
  row[2] = student.ad
  row[3] = student.soyad
  row[4] = student.veliAd
  row[5] = student.veliSoyad
  row[6] = student.telefon
}

function clearStudentFields(row: string[]) {
  // Sınıfı ve saatler kalsın; öğrenci/veli bilgisi temizlensin
  row[2] = ''
  row[3] = ''
  row[4] = ''
  row[5] = ''
  row[6] = ''
}

function sameStudentInfo(row: string[], student: LiveStudent): boolean {
  return (
    normalizeClass(row[1]) === normalizeClass(student.sinif) &&
    fullNameKey(row[2], row[3]) === fullNameKey(student.ad, student.soyad) &&
    cleanText(row[4]) === student.veliAd &&
    cleanText(row[5]) === student.veliSoyad &&
    cleanText(row[6]) === student.telefon
  )
}

export function syncMatkeys(
  liveWorkbook: XLSX.WorkBook,
  koclukWorkbook: XLSX.WorkBook,
  options: { fillEmptySlots: boolean } = { fillEmptySlots: true },
): MatkeysSyncResult {
  const liveStudents = extractLiveStudents(liveWorkbook)
  const target = findKoclukSheet(koclukWorkbook)
  if (!target) {
    throw new Error(
      'koçluk dosyasında randevu sayfası bulunamadı (Sayfa2 / gün kolonlu tablo).',
    )
  }
  if (liveStudents.length === 0) {
    throw new Error(
      'Canlı dosyada sınıf listesi bulunamadı (5.B, 6.C gibi sayfalar).',
    )
  }

  const byKey = new Map<string, LiveStudent>()
  const byFold = new Map<string, LiveStudent>()
  for (const student of liveStudents) {
    byKey.set(fullNameKey(student.ad, student.soyad), student)
    byFold.set(fullNameFold(student.ad, student.soyad), student)
  }

  const matrix = target.matrix.map((row) => [...row])
  const width = Math.max(25, ...matrix.map((r) => r.length))
  for (const row of matrix) ensureWidth(row, width)

  const changes: SyncChange[] = []
  const seen = new Set<string>()
  const statuses = new Map<number, string>()

  // 1) Mevcut dolu satırları güncelle / çıkar
  for (let i = 2; i < matrix.length; i++) {
    const row = matrix[i]
    const ad = cleanText(row[2])
    const soyad = cleanText(row[3])
    if (!ad && !soyad) continue

    const match = findLiveMatch(ad, soyad, byKey, byFold)
    const label = `${cleanText(row[1])} ${ad} ${soyad}`.trim()
    const rowNumber = i + 1

    if (!match) {
      const before = snapshotFromRow(row)
      clearStudentFields(row)
      changes.push({
        type: 'removed',
        label,
        rowNumber,
        sinif: before.sinif,
        before,
        detail: 'Canlı listede yok — öğrenci bilgisi silindi, saatler duruyor',
      })
      statuses.set(i, 'çıktı')
      continue
    }

    const key = fullNameKey(match.ad, match.soyad)
    seen.add(key)
    if (sameStudentInfo(row, match)) {
      changes.push({
        type: 'kept',
        label: studentLabel(match),
        rowNumber,
        sinif: match.sinif,
        after: snapshotFromStudent(match),
        detail: 'Değişiklik yok',
      })
      statuses.set(i, 'aynı')
    } else {
      const before = snapshotFromRow(row)
      writeStudentFields(row, match)
      changes.push({
        type: 'updated',
        label: studentLabel(match),
        rowNumber,
        sinif: match.sinif,
        before,
        after: snapshotFromStudent(match),
        detail: 'Ad / veli / telefon canlı listeden güncellendi',
      })
      statuses.set(i, 'güncellendi')
    }
  }

  // 2) Yeni öğrencileri boş slotlara yerleştir (önce aynı sınıf)
  const newcomers = liveStudents.filter(
    (s) => !seen.has(fullNameKey(s.ad, s.soyad)),
  )

  if (options.fillEmptySlots) {
    const emptyIndexes = matrix
      .map((row, i) => ({ row, i }))
      .filter(({ row, i }) => i >= 2 && !cleanText(row[2]) && !cleanText(row[3]))
      .map(({ i }) => i)

    const remaining = [...newcomers]

    // Aynı sınıf önceliği
    for (const i of emptyIndexes) {
      if (remaining.length === 0) break
      const slotClass = normalizeClass(matrix[i][1])
      if (!slotClass) continue
      const idx = remaining.findIndex(
        (s) => normalizeClass(s.sinif) === slotClass,
      )
      if (idx < 0) continue
      const [student] = remaining.splice(idx, 1)
      writeStudentFields(matrix[i], student)
      seen.add(fullNameKey(student.ad, student.soyad))
      changes.push({
        type: 'added',
        label: studentLabel(student),
        rowNumber: i + 1,
        sinif: student.sinif,
        after: snapshotFromStudent(student),
        detail: `Boş ${student.sinif} slotuna yerleştirildi`,
      })
      statuses.set(i, 'yerleşti')
    }

    // Kalanlar herhangi bir boş slota
    for (const i of emptyIndexes) {
      if (remaining.length === 0) break
      if (cleanText(matrix[i][2]) || cleanText(matrix[i][3])) continue
      const student = remaining.shift()!
      const slotClass = cleanText(matrix[i][1])
      writeStudentFields(matrix[i], student)
      seen.add(fullNameKey(student.ad, student.soyad))
      changes.push({
        type: 'added',
        label: studentLabel(student),
        rowNumber: i + 1,
        sinif: student.sinif,
        after: snapshotFromStudent(student),
        detail: slotClass
          ? `Boş slota yerleştirildi (slot sınıfı: ${slotClass})`
          : 'Boş slota yerleştirildi',
      })
      statuses.set(i, 'yerleşti')
    }

    for (const student of remaining) {
      changes.push({
        type: 'unplaced',
        label: studentLabel(student),
        sinif: student.sinif,
        detail: 'Uygun boş slot kalmadı',
      })
    }
  } else {
    for (const student of newcomers) {
      changes.push({
        type: 'unplaced',
        label: studentLabel(student),
        sinif: student.sinif,
        detail: 'Otomatik yerleştirme kapalı',
      })
    }
  }

  // Mevcut sayfa düzenini bozmadan sadece öğrenci hücrelerini yaz
  const out = cloneWorkbook(koclukWorkbook)
  const outSheet = out.Sheets[target.name]
  if (!outSheet) {
    throw new Error('Koçluk sayfası kopyalanamadı.')
  }
  patchStudentRows(outSheet, matrix)

  // Okunaklı özet: sınıf → gün (Pzt–Cmt) → saat sırası
  const cleanRows: CleanRow[] = []
  for (let i = 2; i < matrix.length; i++) {
    const row = matrix[i]
    const ad = cleanText(row[2])
    const soyad = cleanText(row[3])
    if (!ad && !soyad) continue
    const base = {
      sinif: cleanText(row[1]),
      ad,
      soyad,
      veliAd: cleanText(row[4]),
      veliSoyad: cleanText(row[5]),
      telefon: cleanText(row[6]),
    }
    const slots = TIME_COLS.map(({ col, day }) => {
      const raw = cleanText(row[col])
      if (!raw) return null
      const parsed = parseTimeLabel(raw)
      return {
        day,
        raw,
        minutes: parsed.timeMinutes,
      }
    }).filter(Boolean) as { day: string; raw: string; minutes: number }[]

    if (slots.length === 0) {
      cleanRows.push({ ...base, day: '', raw: '', minutes: 9999 })
    } else {
      for (const slot of slots) {
        cleanRows.push({ ...base, ...slot })
      }
    }
  }

  cleanRows.sort((a, b) => {
    const byClass = compareClass(a.sinif, b.sinif)
    if (byClass !== 0) return byClass
    const byDay = dayRank(a.day) - dayRank(b.day)
    if (byDay !== 0) return byDay
    if (a.minutes !== b.minutes) return a.minutes - b.minutes
    return `${a.ad} ${a.soyad}`.localeCompare(`${b.ad} ${b.soyad}`, 'tr')
  })

  const cleanSheet = buildColoredScheduleSheet(cleanRows)
  if (out.Sheets['Guncel Randevu']) {
    delete out.Sheets['Guncel Randevu']
    out.SheetNames = out.SheetNames.filter((n) => n !== 'Guncel Randevu')
  }
  XLSX.utils.book_append_sheet(out, cleanSheet, 'Guncel Randevu')
  // İndirince temiz sayfa açılsın
  out.SheetNames = [
    'Guncel Randevu',
    ...out.SheetNames.filter((n) => n !== 'Guncel Randevu'),
  ]

  const emptySlots = matrix
    .slice(2)
    .filter((row) => !cleanText(row[2]) && !cleanText(row[3])).length

  const previewRows = matrix.slice(2).map((row, idx) => ({
    rowNumber: idx + 3,
    sinif: cleanText(row[1]),
    ad: cleanText(row[2]),
    soyad: cleanText(row[3]),
    telefon: cleanText(row[6]),
    saatler: rowTimes(row),
    status: statuses.get(idx + 2) ?? (cleanText(row[2]) ? '—' : 'boş'),
  }))

  return {
    workbook: out,
    changes,
    summary: {
      liveCount: liveStudents.length,
      kept: changes.filter((c) => c.type === 'kept').length,
      updated: changes.filter((c) => c.type === 'updated').length,
      removed: changes.filter((c) => c.type === 'removed').length,
      added: changes.filter((c) => c.type === 'added').length,
      unplaced: changes.filter((c) => c.type === 'unplaced').length,
      emptySlots,
    },
    previewRows,
  }
}

type CleanRow = {
  sinif: string
  ad: string
  soyad: string
  veliAd: string
  veliSoyad: string
  telefon: string
  day: string
  raw: string
  minutes: number
}

function solidFill(hex: string) {
  return {
    patternType: 'solid' as const,
    fgColor: { rgb: excelRgb(hex) },
  }
}

function buildColoredScheduleSheet(cleanRows: CleanRow[]): XLSX.WorkSheet {
  const headers = [
    'Sınıf',
    'Ad',
    'Soyad',
    'Veli Ad',
    'Veli Soyad',
    'Telefon',
    'Gün',
    'Saat',
    'Not',
  ]
  const aoa: (string | number)[][] = []
  const merges: XLSX.Range[] = []
  const bannerRows = new Map<number, string>()
  const headerRows = new Set<number>()
  const rowClass = new Map<number, string>()

  const groups = new Map<string, CleanRow[]>()
  for (const row of cleanRows) {
    const key = row.sinif || 'Sınıfsız'
    const list = groups.get(key) ?? []
    list.push(row)
    groups.set(key, list)
  }
  const ordered = [...groups.entries()].sort(([a], [b]) => compareClass(a, b))

  for (const [sinif, rows] of ordered) {
    const bannerIndex = aoa.length
    aoa.push([`${sinif}  ·  ${rows.length} randevu`, '', '', '', '', '', '', '', ''])
    merges.push({
      s: { r: bannerIndex, c: 0 },
      e: { r: bannerIndex, c: headers.length - 1 },
    })
    bannerRows.set(bannerIndex, sinif)

    const headerIndex = aoa.length
    aoa.push([...headers])
    headerRows.add(headerIndex)
    rowClass.set(headerIndex, sinif)

    for (const row of rows) {
      const idx = aoa.length
      aoa.push([
        row.sinif,
        row.ad,
        row.soyad,
        row.veliAd,
        row.veliSoyad,
        row.telefon,
        row.day,
        row.raw,
        '',
      ])
      rowClass.set(idx, sinif)
    }

    // sınıflar arası boşluk
    aoa.push(['', '', '', '', '', '', '', '', ''])
  }

  const sheet = XLSX.utils.aoa_to_sheet(aoa)
  sheet['!merges'] = merges
  sheet['!cols'] = [
    { wch: 10 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 28 },
    { wch: 12 },
  ]
  sheet['!rows'] = aoa.map((_, i) =>
    bannerRows.has(i) ? { hpt: 22 } : { hpt: 18 },
  )

  for (let r = 0; r < aoa.length; r++) {
    for (let c = 0; c < headers.length; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      const cell = sheet[addr] ?? { t: 's', v: '' }
      sheet[addr] = cell
      cell.t = 's'
      cell.z = '@'
      if (cell.v == null) cell.v = ''

      if (bannerRows.has(r)) {
        const theme = themeForClass(bannerRows.get(r) ?? '')
        cell.s = {
          fill: solidFill(theme.head),
          font: { bold: true, color: { rgb: 'FFFFFFFF' }, sz: 12 },
          alignment: { horizontal: 'left', vertical: 'center' },
        }
        continue
      }

      const sinif = rowClass.get(r)
      if (!sinif) continue
      const theme = themeForClass(sinif)

      if (headerRows.has(r)) {
        cell.s = {
          fill: solidFill(theme.soft),
          font: { bold: true, color: { rgb: excelRgb(theme.head) }, sz: 10 },
          alignment: { horizontal: 'left', vertical: 'center' },
          border: {
            bottom: { style: 'thin', color: { rgb: excelRgb(theme.border) } },
          },
        }
      } else {
        cell.s = {
          fill: solidFill(theme.bg),
          font: { color: { rgb: 'FF1F2328' }, sz: 10 },
          alignment: { vertical: 'center' },
          border: {
            bottom: { style: 'hair', color: { rgb: excelRgb(theme.border) } },
          },
        }
      }
    }
  }

  return sheet
}

function cloneWorkbook(workbook: XLSX.WorkBook): XLSX.WorkBook {
  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  return XLSX.read(buffer, { type: 'array', cellDates: true, raw: false })
}

function setTextCell(
  sheet: XLSX.WorkSheet,
  row: number,
  col: number,
  value: string,
) {
  const addr = XLSX.utils.encode_cell({ r: row, c: col })
  sheet[addr] = { t: 's', v: value, w: value, z: '@' }
}

function patchStudentRows(sheet: XLSX.WorkSheet, matrix: string[][]) {
  for (let r = 2; r < matrix.length; r++) {
    const row = matrix[r]
    // Sınıf + öğrenci/veli/telefon (saat kolonlarına dokunma)
    for (const c of [1, 2, 3, 4, 5, 6]) {
      setTextCell(sheet, r, c, cleanText(row[c]))
    }
  }
  if (!sheet['!ref']) {
    sheet['!ref'] = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: Math.max(matrix.length - 1, 0), c: 24 },
    })
  }
}

export async function readWorkbook(file: File): Promise<XLSX.WorkBook> {
  const buffer = await file.arrayBuffer()
  return XLSX.read(buffer, { type: 'array', cellDates: true, raw: false })
}

export function downloadWorkbook(workbook: XLSX.WorkBook, fileName: string) {
  XLSX.writeFile(
    workbook,
    fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`,
  )
}

export function detectLiveFile(workbook: XLSX.WorkBook): boolean {
  return extractLiveStudents(workbook).length > 0
}

export function detectKoclukFile(workbook: XLSX.WorkBook): boolean {
  return findKoclukSheet(workbook) != null
}
