import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import * as XLSX from 'xlsx'
import { extractLiveStudents, syncMatkeys } from '../src/lib/matkeys.ts'

const live = XLSX.read(
  readFileSync('C:/Users/ma727/OneDrive/Masaüstü/Tarık Hoca Canlı.xlsx'),
  { type: 'buffer', raw: false },
)
const kocluk = XLSX.read(
  readFileSync('C:/Users/ma727/OneDrive/Masaüstü/koçluk tüm liste.xlsx'),
  { type: 'buffer', raw: false },
)

console.log('live students', extractLiveStudents(live).length)
const result = syncMatkeys(live, kocluk, { fillEmptySlots: true })
console.log(result.summary)
console.log(
  'removed',
  result.changes.filter((c) => c.type === 'removed').map((c) => c.label),
)
console.log(
  'added',
  result.changes.filter((c) => c.type === 'added').map((c) => c.label),
)
console.log(
  'unplaced',
  result.changes.filter((c) => c.type === 'unplaced').map((c) => c.label),
)

mkdirSync('ornekler', { recursive: true })
writeFileSync(
  join('ornekler', 'kocluk-test-cikti.xlsx'),
  XLSX.write(result.workbook, { type: 'buffer', bookType: 'xlsx' }),
)
console.log('wrote ornekler/kocluk-test-cikti.xlsx')
