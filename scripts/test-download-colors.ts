import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import JSZip from 'jszip'
import XLSX from 'xlsx-js-style'
import { downloadColoredSchedule } from '../src/lib/matkeys.ts'

// Fake koçluk-like sheet so parseAppointments works
const aoa = [
  ['', 'Öğrenci', '', '', 'Veli', '', '', 'CUMARTESİ', '', '', 'PAZARTESİ', '', '', 'Salı', '', '', 'Çarşamba', '', '', 'Perşembe', '', '', 'Cuma', '', ''],
  ['', 'Sınıfı', 'Adı', 'Soyadı', 'Adı', 'Soyadı', 'Telefon No', 'SAAT-LİNK', '', '', 'SAAT-LİNK', '', '', 'SAAT-LİNK', '', '', 'SAAT-LİNK', '', '', 'SAAT-LİNK', '', '', 'SAAT-LİNK', '', ''],
  ['', '5.B', 'Ali', 'Yılmaz', 'Ayşe', 'Yılmaz', '5551112233', '', '', '', '17.00-TARIK HOCA 1', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
  ['', '6.C', 'Ece', 'Demir', 'Can', 'Demir', '5552223344', '', '', '', '', '', '', '18.00-TARIK HOCA 2', '', '', '', '', '', '', '', '', '', '', ''],
]
const sheet = XLSX.utils.aoa_to_sheet(aoa)
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, sheet, 'Sayfa2')

// Hijack writeFile to capture buffer
const original = XLSX.writeFile
let captured: Uint8Array | null = null
;(XLSX as unknown as { writeFile: typeof XLSX.writeFile }).writeFile = ((
  book,
  _name,
  opts,
) => {
  const buf = XLSX.write(book, {
    type: 'array',
    bookType: 'xlsx',
    cellStyles: true,
    ...opts,
  })
  captured = new Uint8Array(buf as ArrayBuffer)
}) as typeof XLSX.writeFile

downloadColoredSchedule(wb, 'test.xlsx')
XLSX.writeFile = original

if (!captured) throw new Error('no file written')
mkdirSync('ornekler', { recursive: true })
const path = join('ornekler', 'indir-renk-test.xlsx')
writeFileSync(path, captured)

const zip = await JSZip.loadAsync(captured)
const styles = await zip.file('xl/styles.xml')?.async('string')
const sheet1 = await zip.file('xl/worksheets/sheet1.xml')?.async('string')
console.log('fills', (styles?.match(/fgColor/g) || []).length)
console.log('cell xf', (sheet1?.match(/s="/g) || []).length)
console.log('wrote', path)
console.log('ok', (styles?.match(/fgColor/g) || []).length > 0)
