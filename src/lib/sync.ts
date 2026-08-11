import { isBlank, normalizeKey } from './excel'

export type ColumnMap = {
  schoolColumn: string
  appointmentColumn: string
}

export type SyncOptions = {
  schoolKeyColumn: string
  appointmentKeyColumn: string
  columnMaps: ColumnMap[]
  fillEmptySlots: boolean
}

export type SyncChange = {
  type: 'kept' | 'updated' | 'removed' | 'added' | 'unplaced'
  key: string
  label: string
  slotIndex?: number
  detail?: string
}

export type SyncResult = {
  rows: Record<string, unknown>[]
  changes: SyncChange[]
  summary: {
    kept: number
    updated: number
    removed: number
    added: number
    unplaced: number
    emptySlots: number
  }
}

function rowLabel(row: Record<string, unknown>, keyColumn: string): string {
  const key = String(row[keyColumn] ?? '').trim()
  const nameKeys = Object.keys(row).filter((k) =>
    /ad|soyad|isim|name/i.test(k),
  )
  const name = nameKeys
    .map((k) => String(row[k] ?? '').trim())
    .filter(Boolean)
    .join(' ')
  if (name && key && name.toLocaleLowerCase('tr-TR') !== key.toLocaleLowerCase('tr-TR')) {
    return `${name} (${key})`
  }
  return name || key || 'Adsız'
}

function applyMappedFields(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
  maps: ColumnMap[],
) {
  for (const map of maps) {
    target[map.appointmentColumn] = source[map.schoolColumn] ?? ''
  }
}

function clearMappedFields(target: Record<string, unknown>, maps: ColumnMap[]) {
  for (const map of maps) {
    target[map.appointmentColumn] = ''
  }
}

export function syncAppointments(
  schoolRows: Record<string, unknown>[],
  appointmentRows: Record<string, unknown>[],
  options: SyncOptions,
): SyncResult {
  const { schoolKeyColumn, appointmentKeyColumn, columnMaps, fillEmptySlots } =
    options

  const schoolByKey = new Map<string, Record<string, unknown>>()
  for (const row of schoolRows) {
    const key = normalizeKey(row[schoolKeyColumn])
    if (!key) continue
    schoolByKey.set(key, row)
  }

  const seenInAppointments = new Set<string>()
  const changes: SyncChange[] = []
  const nextRows = appointmentRows.map((row) => ({ ...row }))

  nextRows.forEach((row, index) => {
    const rawKey = row[appointmentKeyColumn]
    const key = normalizeKey(rawKey)

    if (!key) return

    const schoolRow = schoolByKey.get(key)
    if (!schoolRow) {
      clearMappedFields(row, columnMaps)
      row[appointmentKeyColumn] = ''
      changes.push({
        type: 'removed',
        key,
        label: rowLabel({ ...row, [appointmentKeyColumn]: rawKey }, appointmentKeyColumn),
        slotIndex: index + 1,
        detail: 'Dershane listesinde yok — slot boşaltıldı',
      })
      return
    }

    seenInAppointments.add(key)
    const before = columnMaps.map((m) => String(row[m.appointmentColumn] ?? ''))
    applyMappedFields(row, schoolRow, columnMaps)
    row[appointmentKeyColumn] = schoolRow[schoolKeyColumn] ?? row[appointmentKeyColumn]
    const after = columnMaps.map((m) => String(row[m.appointmentColumn] ?? ''))
    const changed = before.some((value, i) => value !== after[i])

    changes.push({
      type: changed ? 'updated' : 'kept',
      key,
      label: rowLabel(schoolRow, schoolKeyColumn),
      slotIndex: index + 1,
      detail: changed ? 'Bilgiler güncellendi' : 'Değişiklik yok',
    })
  })

  const newcomers = [...schoolByKey.entries()]
    .filter(([key]) => !seenInAppointments.has(key))
    .map(([, row]) => row)

  let added = 0
  if (fillEmptySlots) {
    let newcomerIndex = 0
    for (let i = 0; i < nextRows.length && newcomerIndex < newcomers.length; i++) {
      const row = nextRows[i]
      if (!isBlank(row[appointmentKeyColumn])) continue

      const schoolRow = newcomers[newcomerIndex]
      const key = normalizeKey(schoolRow[schoolKeyColumn])
      applyMappedFields(row, schoolRow, columnMaps)
      row[appointmentKeyColumn] = schoolRow[schoolKeyColumn] ?? ''
      changes.push({
        type: 'added',
        key,
        label: rowLabel(schoolRow, schoolKeyColumn),
        slotIndex: i + 1,
        detail: 'Boş slota yerleştirildi',
      })
      added += 1
      newcomerIndex += 1
    }

    for (; newcomerIndex < newcomers.length; newcomerIndex++) {
      const schoolRow = newcomers[newcomerIndex]
      const key = normalizeKey(schoolRow[schoolKeyColumn])
      changes.push({
        type: 'unplaced',
        key,
        label: rowLabel(schoolRow, schoolKeyColumn),
        detail: 'Boş slot kalmadı',
      })
    }
  } else {
    for (const schoolRow of newcomers) {
      const key = normalizeKey(schoolRow[schoolKeyColumn])
      changes.push({
        type: 'unplaced',
        key,
        label: rowLabel(schoolRow, schoolKeyColumn),
        detail: 'Otomatik yerleştirme kapalı',
      })
    }
  }

  const emptySlots = nextRows.filter((row) =>
    isBlank(row[appointmentKeyColumn]),
  ).length

  return {
    rows: nextRows,
    changes,
    summary: {
      kept: changes.filter((c) => c.type === 'kept').length,
      updated: changes.filter((c) => c.type === 'updated').length,
      removed: changes.filter((c) => c.type === 'removed').length,
      added,
      unplaced: changes.filter((c) => c.type === 'unplaced').length,
      emptySlots,
    },
  }
}

export function guessKeyColumn(headers: string[]): string {
  const patterns = [
    /öğrenci\s*no/i,
    /ogrenci\s*no/i,
    /okul\s*no/i,
    /numara/i,
    /tc/i,
    /id/i,
    /ad\s*soyad/i,
    /öğrenci/i,
    /isim/i,
    /ad/i,
  ]
  for (const pattern of patterns) {
    const hit = headers.find((h) => pattern.test(h))
    if (hit) return hit
  }
  return headers[0] ?? ''
}

export function guessColumnMaps(
  schoolHeaders: string[],
  appointmentHeaders: string[],
  schoolKey: string,
  appointmentKey: string,
): ColumnMap[] {
  const maps: ColumnMap[] = []
  for (const schoolColumn of schoolHeaders) {
    if (schoolColumn === schoolKey) continue
    const exact = appointmentHeaders.find(
      (h) =>
        h !== appointmentKey &&
        normalizeKey(h) === normalizeKey(schoolColumn),
    )
    if (exact) {
      maps.push({ schoolColumn, appointmentColumn: exact })
    }
  }
  return maps
}
