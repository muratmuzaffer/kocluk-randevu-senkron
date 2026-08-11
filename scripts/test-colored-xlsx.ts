import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import JSZip from 'jszip'
import XLSX from 'xlsx-js-style'

function excelRgb(hex: string) {
  return `FF${hex.replace('#', '').toUpperCase()}`
}

const wb = XLSX.utils.book_new()
const aoa = [
  ['5.B · 2 randevu', '', ''],
  ['Sınıf', 'Ad', 'Saat'],
  ['5.B', 'Ali', '17:00'],
]
const sheet = XLSX.utils.aoa_to_sheet(aoa)
sheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }]

for (const addr of ['A1', 'B1', 'C1']) {
  if (!sheet[addr]) sheet[addr] = { t: 's', v: '' }
  sheet[addr].s = {
    fill: { patternType: 'solid', fgColor: { rgb: excelRgb('#1d4ed8') } },
    font: { bold: true, color: { rgb: 'FFFFFFFF' } },
  }
}
for (const addr of ['A2', 'B2', 'C2']) {
  sheet[addr].s = {
    fill: { patternType: 'solid', fgColor: { rgb: excelRgb('#dbeafe') } },
    font: { bold: true, color: { rgb: excelRgb('#1d4ed8') } },
  }
}
for (const addr of ['A3', 'B3', 'C3']) {
  sheet[addr].s = {
    fill: { patternType: 'solid', fgColor: { rgb: excelRgb('#eff6ff') } },
  }
}

XLSX.utils.book_append_sheet(wb, sheet, 'Randevular')
const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellStyles: true })
mkdirSync('ornekler', { recursive: true })
const path = join('ornekler', 'renk-test.xlsx')
writeFileSync(path, buf)

const zip = await JSZip.loadAsync(buf)
const styles = await zip.file('xl/styles.xml')?.async('string')
console.log('has styles.xml', Boolean(styles))
console.log('fill count', (styles?.match(/fgColor/g) || []).length)
console.log('sample', styles?.slice(0, 400))
console.log('wrote', path)
