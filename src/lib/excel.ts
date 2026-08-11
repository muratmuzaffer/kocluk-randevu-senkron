import XLSX from 'xlsx-js-style'

export type SheetTable = {
  fileName: string
  sheetName: string
  sheetNames: string[]
  headers: string[]
  rows: Record<string, unknown>[]
  workbook: XLSX.WorkBook
}

function cellToString(value: unknown): string {
  if (value == null) return ''
  if (value instanceof Date) return value.toISOString()
  return String(value).trim()
}

export function normalizeKey(value: unknown): string {
  return cellToString(value).replace(/\s+/g, ' ').toLocaleLowerCase('tr-TR')
}

export function isBlank(value: unknown): boolean {
  return normalizeKey(value) === ''
}

export async function readExcelFile(file: File): Promise<SheetTable> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheetName = workbook.SheetNames[0] ?? ''
  return buildSheetTable(file.name, workbook, sheetName)
}

export function switchSheet(table: SheetTable, sheetName: string): SheetTable {
  return buildSheetTable(table.fileName, table.workbook, sheetName)
}

function buildSheetTable(
  fileName: string,
  workbook: XLSX.WorkBook,
  sheetName: string,
): SheetTable {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) {
    return {
      fileName,
      sheetName,
      sheetNames: workbook.SheetNames,
      headers: [],
      rows: [],
      workbook,
    }
  }

  const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | Date | null)[]>(
    sheet,
    {
      header: 1,
      defval: '',
      raw: false,
      blankrows: false,
    },
  )

  const headerRow = (matrix[0] ?? []).map((cell, index) => {
    const label = cellToString(cell)
    return label || `Sütun ${index + 1}`
  })

  const rows = matrix.slice(1).map((line) => {
    const row: Record<string, unknown> = {}
    headerRow.forEach((header, index) => {
      row[header] = line[index] ?? ''
    })
    return row
  })

  return {
    fileName,
    sheetName,
    sheetNames: workbook.SheetNames,
    headers: headerRow,
    rows,
    workbook,
  }
}

export function downloadRowsAsExcel(
  rows: Record<string, unknown>[],
  headers: string[],
  fileName: string,
  sheetName = 'Randevu',
) {
  const aoa = [
    headers,
    ...rows.map((row) => headers.map((header) => row[header] ?? '')),
  ]
  const sheet = XLSX.utils.aoa_to_sheet(aoa)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName.slice(0, 31) || 'Randevu')
  XLSX.writeFile(workbook, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`)
}
