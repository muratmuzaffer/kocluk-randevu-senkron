import { parseCards, stringModel, tidyBook } from '../src/lib/bookCards.ts'
import { cropBands, isLongQuestion } from '../src/lib/cropBands.ts'
import { blendDeck, findUnits } from '../src/lib/pdfOutline.ts'

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

const q = parseCards(
  '1) Remzi eşitliği korumak için hangi işlemi yapmalıdır? A) Toplama B) Çıkarma C) Çarpma D) Bölme',
)
assert(q.length === 1, `q len ${q.length}`)
assert(q[0].prompt.includes('Remzi eşitliği korumak'), q[0].prompt)
assert(q[0].choices.length === 4, `choices ${q[0].choices.join(' | ')}`)
assert(q[0].choices[0] === 'A) Toplama', q[0].choices[0])
assert(q[0].choices[3] === 'D) Bölme', q[0].choices[3])

const wall = `İSTATİSTİKSEL ARAŞTIRMA SÜRECİ
İstatistiksel araştırma süreci dört adımdan oluşur.
1. Adım Verilerin toplanması
2. Adım Verilerin düzenlenmesi
3. Adım Verilerin analizi
4. Adım Sonuçların yorumlanması
Örnek 1
İpek, sınıfındaki öğrencilerin en sevdikleri mevsimi merak etmektedir.`
const parts = parseCards(wall)
assert(
  parts.some((c) => c.bullets.length === 4),
  `steps ${JSON.stringify(parts)}`,
)
assert(
  parts.some((c) => /örnek 1/i.test(c.pill) && c.prompt.includes('İpek')),
  `ornek ${parts.map((c) => c.pill + ':' + c.prompt).join(' || ')}`,
)
assert(
  parts.every((c) => !(c.prompt.includes('İpek') && c.prompt.includes('1. Adım'))),
  'no wall',
)
assert(tidyBook('topla - ma işlemi') === 'toplama işlemi', 'hyphen')

const tuikLines = [
  'Bu istatistiki bilgiler; kurum ve kişilerin karar alma aşamalarında ulaşabilecekleri hazır veriler sunar.',
  'TÜİK, Adrese Dayalı Nüfus Sistemi Sonuçları isimli araştırmasını 2023 yılında paylaşmıştır.',
  "Bu araştırma sonucuna göre Türkiye'de yaşayan nüfus, 31 Aralık 2023 tarihi itibarıyla bir önceki yıla göre 92 bin 824 kişi artmıştır.",
  "Türkiye'nin nüfusu 85 milyon 372 bin 377 kişi olmuştur.",
  'Aşağıdaki tabloda ilgili yıla ait nüfus verisi görülmektedir.',
  'Tablo: 2023 Yılına Ait Nüfus Verisinin Cinsiyete Göre Dağılımı',
  'Yaklaşık Cinsiyet Nüfus Yüzdesi (%)',
  'Kadın 42 638 306 %50',
  'Erkek 42 734 071 %50',
]
const tuikModel = {
  text: tuikLines.join('\n'),
  width: 500,
  height: 800,
  lines: tuikLines.map((text, i) => ({ text, x: 40, y: 720 - i * 28, h: 14 })),
}
const tuikCards = parseCards(tuikModel.text, tuikModel)
assert(tuikCards.length === 1, `tuik slides ${tuikCards.length} ${tuikCards.map((c) => c.prompt).join(' || ')}`)
assert(tuikCards[0].prompt.includes('hazır veriler'), tuikCards[0].prompt)
assert(tuikCards[0].prompt.includes('TÜİK'), tuikCards[0].prompt)
assert(tuikCards[0].prompt.includes('tabloda'), tuikCards[0].prompt)
assert(!tuikCards[0].prompt.includes('42 638 306'), tuikCards[0].prompt)
assert(tuikCards[0].figureTop != null, 'tuik table figure')

const junk = parseCards(
  'Grafik: Bir Kitapçıda Satılan Kitap Türleri Şanlıurfa Manisa İstanbul Erzurum Denizli Ankara Adana',
)
assert(junk.length === 0, `junk ${junk.map((c) => c.prompt).join(' | ')}`)

const two = parseCards(
  '1) Birinci soru nedir? A) 1 B) 2 C) 3 D) 4 2) İkinci soru hangisidir? A) 5 B) 6 C) 7 D) 8',
)
assert(two.length === 2, `two ${two.length}`)
assert(two[0].prompt.includes('Birinci soru'), two[0].prompt)
assert(two[1].prompt.includes('İkinci soru'), two[1].prompt)

const openQ = parseCards(
  'Örnek 1 İpek araştırma yapar. a) Burada istatistiksel araştırma yapmayı gerektiren durum nedir? b) Sizce İpek niçin bu araştırmayı yapmak istemiştir?',
)
assert(openQ.some((c) => c.layout === 'open' && c.parts.length === 2), `open ${JSON.stringify(openQ)}`)
assert(openQ.every((c) => c.choices.length === 0), 'open not mcq')

const mathLines = [
  'Eşitlikte her iki tarafa aynı sayı eklenir.',
  '3 + 5 = 8',
  '8 = 8',
]
const mathModel = {
  text: mathLines.join('\n'),
  width: 500,
  height: 800,
  lines: mathLines.map((text, i) => ({ text, x: 40, y: 640 - i * 40, h: 16 })),
}
const mathCards = parseCards(mathModel.text, mathModel)
assert(mathCards.some((c) => c.layout === 'math'), `math ${mathCards.map((c) => c.layout + ':' + c.prompt).join(' | ')}`)
assert(mathCards.some((c) => c.layout === 'math' && c.figureTop != null), 'math crop')
assert(
  mathCards.some((c) => c.layout === 'math' && c.prompt.includes('Eşitlikte') && !c.prompt.includes('3 + 5 = 8')),
  'math keeps book crop not OCR',
)

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
  '1) Toplama ve çarpma işleminin sonucunu bulunuz. HAZIR MIYIZ A) Aşağıdaki işlemlerde verilmeyenleri bulunuz. B) Toplama C) Çarpma D) Bölme'
pages[116] = 'BAŞLAYALIM 1) Aşağıdaki soruları cevaplayınız. A) 3 B) 5 C) 7 D) 9'
pages[117] =
  'İŞLEMLERLE CEBİRSEL DÜŞÜNME 118 EŞİTLİĞİN KORUNUMU VE İŞLEM ÖZELLİKLERİ Halat çekmede iki taraf da aynı kuvveti uygular.'
pages[118] = 'EŞİTLİĞİN KORUNUMU terazinin kefeleri eşit kalır.'
pages[130] = '6.TEMA 131 İŞLEM ÖNCELİĞİ Sezen kare şeklindeki kağıdı dört parçaya böler.'
pages[138] = '6.TEMA 139 SAYI VE ŞEKİL ÖRÜNTÜLERİ Ertuğrul örüntünün kuralını bulur.'
pages[149] = 'TEMEL ARİTMETİK İŞLEMLER VE ALGORİTMA Ayşe ayran tarifini adım adım yazar.'
pages[159] =
  'İŞLEMLERLE CEBİRSEL DÜŞÜNME 160 ÖLÇME VE DEĞERLENDİRME SORULARI 1) Remzi eşitliği korumak için hangi işlemi yapmalıdır? A) Toplama B) Çıkarma C) Çarpma D) Bölme 2) İşlem önceliğine göre sonuç nedir? A) 8 B) 12 C) 16 D) 20'
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
assert(four?.title === 'KESİRLER', `4 short ${four?.title}`)
assert(five?.title === 'İSTATİSTİKSEL ARAŞTIRMA', `5 short ${five?.title}`)
assert(six?.title === 'CEBİRSEL DÜŞÜNME', `6 short ${six?.title}`)
assert(seven?.title === 'OLASILIK', `7 short ${seven?.title}`)

const deck = blendDeck(six!, pages)
const cards = deck.slides.filter((s) => s.face === 'card')
assert(
  cards.some((s) => s.page === 116 && s.layout === 'crop' && s.figureTop != null),
  'basla crop',
)
assert(
  cards.filter((s) => s.page === 160).length >= 1,
  `olcme on 160: ${cards.filter((s) => s.page === 160).length}`,
)
assert(
  cards.every((s) => s.kind !== 'soru' || s.page >= 160),
  'unit questions last',
)
const lastCard = cards[cards.length - 1]
assert(lastCard?.kind === 'soru', `last ${lastCard?.kind}`)
assert(
  !deck.slides.some((s) => s.page === 114),
  'skip opener junk',
)
assert(
  deck.slides.some((s) => s.face === 'title' && s.heading === 'HAZIR MIYIZ?'),
  'short hazir title',
)
assert(
  deck.slides.every((s) => !/karekodu/i.test(s.heading + s.prompt)),
  'no junk heading',
)
assert(
  isLongQuestion(
    `1) ${'neden '.repeat(80)}hangisidir? a) Birinci uzun açıklama burada durur b) İkinci uzun açıklama da burada durur`,
  ),
  'long q',
)
assert(!isLongQuestion('1) Sonuç nedir? A) 8 B) 12 C) 16 D) 20'), 'short q')
assert(
  cropBands(
    stringModel(
      `1) ${'kelime '.repeat(90)}nedir? a) birinci uzun seçenek cümlesi b) ikinci uzun seçenek cümlesi`,
    ),
  ).length === 0,
  'skip long crop',
)
console.log('ok', units.map((u) => `${u.number}:${u.start}-${u.end}:${u.title}`).join(' | '))
console.log(
  cards
    .filter((s) => [116, 117, 118, 131, 139, 150, 160].includes(s.page))
    .map((s) => `${s.page}:${s.kind}`)
    .join(','),
)
