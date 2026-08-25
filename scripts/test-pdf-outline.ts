import { blendDeck, findUnits } from '../src/lib/pdfOutline.ts'

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

const pages = Array.from({ length: 170 }, (_, i) => `sayfa ${i + 1}`)
pages[6] = 'İÇİNDEKİLER 4.TEMA:SAYILAR 5.TEMA:İSTATİSTİK'
pages[7] =
  '6.TEMA:İŞLEMLERLE CEBİRSEL DÜŞÜNME   7.TEMA:VERİDEN OLASILIĞA 114 164'
pages[11] = '12 4. TEMA Karekodu okutarak özet içeriğe ulaşabilirsiniz.'
pages[55] =
  '5. TEMA Bu temada kategorik veri ile çalışabilme. İSTATİSTİKSEL ARAŞTIRMA SÜRECİ'
pages[113] =
  '1. Adım 2. Adım 6.TEMA İŞLEMLERLE CEBİRSEL DÜŞÜNME • Eşitliğin Korunumu'
pages[115] =
  '1) Toplama ve çarpma HAZIR MIYIZ A) Aşağıdaki işlemlerde verilmeyenleri bulunuz.'
pages[116] = 'BAŞLAYALIM 1) Aşağıdaki soruları cevaplayınız.'
pages[118] = '6.TEMA 119 Aşağıda kefeli teraziler'
pages[159] =
  'İŞLEMLERLE CEBİRSEL DÜŞÜNME 160 ÖLÇME VE DEĞERLENDİRME SORULARI Remzi'
pages[160] = '6.TEMA 161 a) Oğuz daireleri boyarken'
pages[161] = 'İŞLEMLERLE CEBİRSEL DÜŞÜNME 162 a) Mavi daire'
pages[163] = 'dir. 7. TEMA Karekodu okutarak özet içeriğe ulaşabilirsiniz.'

const units = findUnits(pages)
const six = units.find((u) => u.number === 6)
const five = units.find((u) => u.number === 5)
const seven = units.find((u) => u.number === 7)
assert(six?.start === 114, `6 start ${six?.start}`)
assert(six?.end === 163, `6 end ${six?.end}`)
assert(five?.start === 56, `5 start ${five?.start}`)
assert(five?.end === 113, `5 end ${five?.end}`)
assert(seven?.start === 164, `7 start ${seven?.start}`)
assert(!units.some((u) => u.start < 12 && u.number === 6), 'toc 6')

const deck = blendDeck(six!, pages)
const kinds = deck.slides.map((s) => `${s.page}:${s.kind}`).join(',')
assert(deck.slides[0]?.page === 114, 'first page')
assert(
  deck.slides.some((s) => s.kind === 'hazir' && s.page === 116),
  'hazir 116',
)
assert(
  deck.slides.some((s) => s.kind === 'basla' && s.page === 117),
  'basla 117',
)
assert(
  deck.slides.filter((s) => s.kind === 'soru').map((s) => s.page).join(',') ===
    '160,161,162,163',
  `soru ${deck.slides
    .filter((s) => s.kind === 'soru')
    .map((s) => s.page)}`,
)
assert(
  deck.slides.find((s) => s.page === 147)?.kind === 'giris',
  'izleme mid-unit stays',
)
console.log('ok', units.map((u) => `${u.number}:${u.start}-${u.end}`).join(' '))
console.log(kinds.slice(0, 180))
