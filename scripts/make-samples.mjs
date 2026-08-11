import * as XLSX from 'xlsx'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'ornekler')
mkdirSync(root, { recursive: true })

const school = [
  ['Öğrenci No', 'Ad Soyad', 'Sınıf', 'Telefon'],
  ['1001', 'Ayşe Yılmaz', '12/A', '5551112233'],
  ['1002', 'Mehmet Demir', '12/B', '5552223344'],
  ['1004', 'Zeynep Kara', '11/A', '5554445566'],
  ['1005', 'Can Öz', '12/C', '5555556677'],
]

const appointment = [
  ['Gün', 'Saat', 'Öğrenci No', 'Ad Soyad', 'Telefon'],
  ['Pazartesi', '10:00', '1001', 'Ayşe Yılmaz', '5551112233'],
  ['Pazartesi', '11:00', '1002', 'Mehmet Demir', '5550000000'],
  ['Salı', '14:00', '1003', 'Ali Vural', '5553334455'],
  ['Çarşamba', '16:00', '', '', ''],
]

function write(name, aoa) {
  const sheet = XLSX.utils.aoa_to_sheet(aoa)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet, 'Liste')
  XLSX.writeFile(wb, join(root, name))
}

write('dershane-ogrenci-listesi.xlsx', school)
write('koc-randevu-listesi.xlsx', appointment)
console.log('Örnekler yazıldı:', root)
