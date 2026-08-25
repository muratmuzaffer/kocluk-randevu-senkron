import { blendDeck, findUnits } from '../src/lib/pdfOutline.ts'

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

const pages = Array.from({ length: 170 }, (_, i) => `sayfa ${i + 1}`)
pages[6] = 'İÇİNDEKİLER 4.TEMA:SAYILAR 5.TEMA:İSTATİSTİK'
pages[7] =
  '6.TEMA:İŞLEMLERLE CEBİRSEL DÜŞÜNME   7.TEMA:VERİDEN OLASILIĞA 114 164'
pages[11] =
  'SAYILAR VE NİCELİKLER (2): KESİRLER 4. TEMA Karekodu okutarak özet içeriğe ulaşabilirsiniz.'
pages[55] =
  'Sayısı 0 5 10 15 20 25 30 Grafik: Toplam Kazanç 5. TEMA Bu temada kategorik veri ile çalışabilme. İSTATİSTİKSEL ARAŞTIRMA SÜRECİ'
pages[113] =
  '1. Adım 2. Adım 6.TEMA İŞLEMLERLE CEBİRSEL DÜŞÜNME • Eşitliğin Korunumu Bu temada çıkarım yapabilmeniz beklenmektedir.'
pages[115] =
  '1) Toplama ve çarpma işleminin sonucunu bulunuz. HAZIR MIYIZ A) Aşağıdaki işlemlerde verilmeyenleri bulunuz.'
pages[116] = 'BAŞLAYALIM 1) Aşağıdaki soruları cevaplayınız.'
pages[117] =
  'İŞLEMLERLE CEBİRSEL DÜŞÜNME 118 EŞİTLİĞİN KORUNUMU VE İŞLEM ÖZELLİKLERİ Halat çekmede iki taraf da aynı kuvveti uygular.'
pages[118] = 'EŞİTLİĞİN KORUNUMU terazinin kefeleri eşit kalır.'
pages[130] = '6.TEMA 131 İŞLEM ÖNCELİĞİ Sezen kare şeklindeki kağıdı dört parçaya böler.'
pages[138] = '6.TEMA 139 SAYI VE ŞEKİL ÖRÜNTÜLERİ Ertuğrul örüntünün kuralını bulur.'
pages[149] = 'TEMEL ARİTMETİK İŞLEMLER VE ALGORİTMA Ayşe ayran tarifini adım adım yazar.'
pages[159] =
  'İŞLEMLERLE CEBİRSEL DÜŞÜNME 160 ÖLÇME VE DEĞERLENDİRME SORULARI 1) Remzi eşitliği korumak için hangi işlemi yapmalıdır?'
pages[160] = '6.TEMA 161 a) Oğuz daireleri boyarken hangi kuralı kullanır?'
pages[163] =
  'Çok 2 1 asla mümkün büyük VERİDEN OLASILIĞA 7. TEMA Karekodu okutarak özet içeriğe ulaşabilirsiniz.'

const units = findUnits(pages)
const six = units.find((u) => u.number === 6)
const five = units.find((u) => u.number === 5)
const four = units.find((u) => u.number === 4)
const seven = units.find((u) => u.number === 7)
assert(six?.start === 114, `6 start ${six?.start}`)
assert(six?.end === 163, `6 end ${six?.end}`)
assert(five?.start === 56, `5 start ${five?.start}`)
assert(seven?.start === 164, `7 start ${seven?.start}`)
assert(!/karekodu/i.test(four?.title || ''), `4 title ${four?.title}`)
assert(!/karekodu/i.test(seven?.title || ''), `7 title ${seven?.title}`)
assert(four?.title === 'KESİRLER', `4 short ${four?.title}`)
assert(five?.title === 'İSTATİSTİKSEL ARAŞTIRMA', `5 short ${five?.title}`)
assert(six?.title === 'CEBİRSEL DÜŞÜNME', `6 short ${six?.title}`)
assert(seven?.title === 'OLASILIK', `7 short ${seven?.title}`)

const deck = blendDeck(six!, pages)
const pagesIn = deck.slides.filter((s) => s.face === 'page').map((s) => s.page)
assert(pagesIn.includes(116), 'hazir 116')
assert(pagesIn.includes(117), 'basla 117')
assert(pagesIn.includes(118), 'esitlik 118')
assert(pagesIn.includes(119), 'esitlik continues 119')
assert(pagesIn.includes(131), 'oncelik 131')
assert(pagesIn.includes(160), 'soru 160')
assert(pagesIn.includes(161), 'soru 161')
assert(!pagesIn.includes(114), 'skip opener junk')
assert(
  deck.slides.some((s) => s.face === 'title' && s.heading === 'HAZIR MIYIZ?'),
  'short hazir title',
)
assert(
  deck.slides.some((s) => s.face === 'title' && s.heading === 'EŞİTLİĞİN KORUNUMU'),
  'short esitlik title',
)
assert(
  deck.slides.every((s) => !/karekodu/i.test(s.heading)),
  'no junk heading',
)
assert(
  deck.slides.filter((s) => s.face === 'page').length >= 8,
  `too few pages ${pagesIn.join(',')}`,
)
console.log('ok', units.map((u) => `${u.number}:${u.start}-${u.end}:${u.title}`).join(' | '))
console.log(
  deck.slides
    .filter((s) => s.face === 'title' || [116, 117, 118, 131, 139, 150, 160].includes(s.page))
    .map((s) => (s.face === 'title' ? `T:${s.heading}` : `${s.page}:${s.kind}`))
    .join(' | '),
)
