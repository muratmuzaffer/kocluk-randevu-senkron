import { blendDeck, bulletsFrom, findUnits } from '../src/lib/pdfOutline.ts'

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
  '1) Toplama ve çarpma işleminin sonucunu bulunuz. 2) Verilmeyen terimi yazınız. HAZIR MIYIZ A) Aşağıdaki işlemlerde verilmeyenleri bulunuz.'
pages[116] = 'BAŞLAYALIM 1) Aşağıdaki soruları cevaplayınız. 2) Sonucu kontrol ediniz.'
pages[117] =
  'İŞLEMLERLE CEBİRSEL DÜŞÜNME 118 EŞİTLİĞİN KORUNUMU VE İŞLEM ÖZELLİKLERİ Halat çekmede iki taraf da aynı kuvveti uygular. Eşitliğin iki yanına aynı işlem uygulanırsa eşitlik korunur.'
pages[130] = '6.TEMA 131 İŞLEM ÖNCELİĞİ Sezen kare şeklindeki kağıdı dört parçaya böler. Önce çarpma sonra toplama yapılır.'
pages[138] = '6.TEMA 139 SAYI VE ŞEKİL ÖRÜNTÜLERİ Ertuğrul örüntünün kuralını bulur. Her adımda iki kare artar.'
pages[149] = 'TEMEL ARİTMETİK İŞLEMLER VE ALGORİTMA Ayşe ayran tarifini adım adım yazar. Algoritma sıralı işlem basamaklarıdır.'
pages[159] =
  'İŞLEMLERLE CEBİRSEL DÜŞÜNME 160 ÖLÇME VE DEĞERLENDİRME SORULARI 1) Remzi eşitliği korumak için hangi işlemi yapmalıdır? 2) İşlem önceliğine göre sonucu bulunuz.'
pages[160] = '6.TEMA 161 a) Oğuz daireleri boyarken hangi kuralı kullanır? b) Örüntünün 5. adımını çiziniz.'
pages[161] = 'İŞLEMLERLE CEBİRSEL DÜŞÜNME 162 a) Mavi daire sayısı nedir? b) Algoritmanın 3. basamağını yazınız.'
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
assert(/olasılığa|OLASILIĞA/i.test(seven?.title || ''), `7 title ${seven?.title}`)
assert(/istatistik|İSTATİSTİK/i.test(five?.title || ''), `5 title ${five?.title}`)
assert(!/sayfa/i.test(five?.title || ''), `5 extra ${five?.title}`)
assert(/cebirsel|CEBİRSEL/i.test(six?.title || ''), `6 title ${six?.title}`)
assert(!/kazanç|sayısı 0/i.test(five?.title || ''), `5 junk ${five?.title}`)

const bits = bulletsFrom(
  'Karekodu okutarak özet içeriğe ulaşabilirsiniz. Eşitliğin iki yanına aynı işlem uygulanırsa eşitlik korunur. Halat çekmede kuvvetler dengededir.',
)
assert(bits.length >= 1, 'bullets')
assert(
  bits.every((b) => !/karekodu/i.test(b)),
  `junk bullet ${bits.join(' | ')}`,
)

const deck = blendDeck(six!, pages)
assert(
  deck.slides.some((s) => s.kind === 'hazir' && s.page === 116),
  'hazir 116',
)
assert(
  deck.slides.some((s) => s.kind === 'basla' && s.page === 117),
  'basla 117',
)
assert(
  !deck.slides.some((s) => s.page === 114),
  'skip opener junk',
)
assert(
  deck.slides.some((s) => s.kind === 'giris' && s.page === 118),
  'esitlik',
)
assert(
  deck.slides.filter((s) => s.kind === 'soru').length <= 3,
  `too many soru ${deck.slides.filter((s) => s.kind === 'soru').length}`,
)
assert(
  deck.slides.some((s) => s.kind === 'soru'),
  'need soru',
)
assert(
  deck.slides.every((s) => s.bullets.every((b) => !/karekodu/i.test(b))),
  'deck junk',
)
assert(deck.slides.length < 16, `too many ${deck.slides.length}`)
console.log('ok', units.map((u) => `${u.number}:${u.start}-${u.end}:${u.title}`).join(' | '))
console.log(deck.slides.map((s) => `${s.page}:${s.kind}:${s.mode}`).join(','))
