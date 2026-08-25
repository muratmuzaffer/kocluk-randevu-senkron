import { parseCards, stringModel, type PageModel } from './bookCards'

export type PageKind = 'kapak' | 'hazir' | 'basla' | 'giris' | 'soru'

export type SlideFace = 'title' | 'card'

export type Unit = {
  id: string
  number: number
  title: string
  start: number
  end: number
}

export type DeckSlide = {
  kind: PageKind
  page: number
  label: string
  heading: string
  face: SlideFace
  prompt: string
  choices: string[]
  bullets: string[]
  pill: string
  figureTop?: number
  figureBottom?: number
}

export type Deck = {
  unit: Unit
  slides: DeckSlide[]
}

export const CANONICAL_TITLES: Record<number, string> = {
  4: 'KESİRLER',
  5: 'İSTATİSTİKSEL ARAŞTIRMA',
  6: 'CEBİRSEL DÜŞÜNME',
  7: 'OLASILIK',
}

const KIND_LABEL: Record<PageKind, string> = {
  kapak: 'Kapak',
  hazir: 'Hazır mıyız?',
  basla: 'Başlayalım',
  giris: 'Konu',
  soru: 'Sorular',
}

const TOPICS: { needle: string; title: string }[] = [
  { needle: 'ESITLIGIN KORUNUMU', title: 'EŞİTLİĞİN KORUNUMU' },
  { needle: 'ISLEM ONCELIGI', title: 'İŞLEM ÖNCELİĞİ' },
  { needle: 'SAYI VE SEKIL', title: 'SAYI VE ŞEKİL ÖRÜNTÜLERİ' },
  { needle: 'SEKIL ORUNTU', title: 'SAYI VE ŞEKİL ÖRÜNTÜLERİ' },
  { needle: 'TEME ARITMETIK', title: 'ALGORİTMA' },
  { needle: 'ALGORITMA', title: 'ALGORİTMA' },
  { needle: 'OLASILIK SPEKTRUMU', title: 'OLASILIK SPEKTRUMU' },
  { needle: 'KESIN OLAY', title: 'KESİN OLAY' },
  { needle: 'IMKANSIZ OLAY', title: 'İMKANSIZ OLAY' },
  { needle: 'VERI GORSELLESTIRME', title: 'VERİ GÖRSELLEŞTİRME' },
  { needle: 'SUTUN GRAFIGI', title: 'SÜTUN GRAFİĞİ' },
  { needle: 'DAIRE GRAFIGI', title: 'DAİRE GRAFİĞİ' },
  { needle: 'NOKTA GRAFIGI', title: 'NOKTA GRAFİĞİ' },
  { needle: 'ISTATISTIK OKURYAZAR', title: 'İSTATİSTİK OKURYAZARLIĞI' },
  { needle: 'DEGISEBILIR', title: 'VERİLERİN DEĞİŞEBİLİRLİĞİ' },
  { needle: 'ISTATISTIKSEL ARASTIRMA', title: 'İSTATİSTİKSEL ARAŞTIRMA' },
  { needle: 'ALISTIRMA SORULARI', title: 'ALIŞTIRMA SORULARI' },
  { needle: 'DENK KESIR', title: 'DENK KESİRLER' },
  { needle: 'KESIRLERDE TOPLAMA', title: 'KESİRLERDE TOPLAMA' },
  { needle: 'KESIRLERDE CIKARMA', title: 'KESİRLERDE ÇIKARMA' },
  { needle: 'KESIRLERDE CARPMA', title: 'KESİRLERDE ÇARPMA' },
  { needle: 'PAYDA ESITLEME', title: 'PAYDA EŞİTLEME' },
]

function norm(text: string) {
  return text.replace(/\s+/g, ' ').toLocaleUpperCase('tr-TR')
}

function fold(text: string) {
  return norm(text)
    .replaceAll('İ', 'I')
    .replaceAll('Ş', 'S')
    .replaceAll('Ğ', 'G')
    .replaceAll('Ü', 'U')
    .replaceAll('Ö', 'O')
    .replaceAll('Ç', 'C')
}

function isToc(text: string) {
  const t = norm(text)
  return t.includes('İÇİNDEKİLER') || t.includes('ICINDEKILER')
}

function isTocLike(text: string) {
  if (isToc(text)) return true
  const t = fold(text)
  const nums = new Set<number>()
  for (const m of t.matchAll(/(\d+)\s*\.\s*TEMA/g)) {
    nums.add(Number(m[1]))
  }
  if (nums.size >= 2) return true
  if (t.includes('KITABIMIZI TANIYALIM')) return true
  return false
}

function isJunkTitle(text: string) {
  const t = fold(text)
  if (t.length < 8) return true
  if (t.includes('KAREKODU')) return true
  if (t.includes('OZET ICERIGE')) return true
  if (t.includes('BU TEMADA')) return true
  if (t.includes('ANAHTAR KAVRAM')) return true
  if (t.includes('BEKLENMEKTEDIR')) return true
  if (/^\d*\s*TEMA\b/.test(t)) return true
  if (t.includes('ASLA') && t.includes('MUMKUN')) return true
  if (/\b0\s+5\s+10\b/.test(t)) return true
  const digits = (text.match(/\d/g) || []).length
  if (digits > Math.max(4, text.length * 0.22)) return true
  return false
}

function isJunkPage(text: string) {
  if (isTocLike(text)) return true
  const t = fold(text)
  if (t.includes('KAREKODU OKUTARAK')) return true
  if (t.includes('BU TEMADA') && t.includes('BEKLENMEKTEDIR')) return true
  return false
}

function rawKind(text: string): 'hazir' | 'basla' | 'olcme' | 'other' {
  if (isTocLike(text)) return 'other'
  const t = fold(text)
  if (t.includes('OLCME VE DEGERLENDIRME')) return 'olcme'
  if (t.includes('HAZIR MIYIZ')) return 'hazir'
  if (t.includes('BASLAYALIM')) return 'basla'
  return 'other'
}

function isUnitOpener(text: string, number: number) {
  const re = new RegExp(
    String(number) + String.raw`\s*\.\s*TEMA\s*[:.]?\s*(\S[\s\S]{0,80})`,
    'i',
  )
  const m = text.match(re)
  if (!m) return false
  const rest = m[1].trim()
  if (/^\d{2,3}\b/.test(rest)) return false
  return /[A-ZÇĞİÖŞÜa-zçğıöşüIı]/.test(rest)
}

function cleanTitle(raw: string) {
  return raw
    .replace(/[•►●].*$/u, '')
    .replace(/^[.:\-–—\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 55)
}

function capsTitles(text: string) {
  const out: string[] = []
  const re =
    /([A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜİıĞÜŞÖÇa-zçğıöşü0-9:() \n]{11,70})/g
  for (const m of text.matchAll(re)) {
    const title = cleanTitle(m[1].replace(/\n/g, ' '))
    if (title && !isJunkTitle(title) && !/\d+\s*\.\s*TEMA/i.test(title)) {
      out.push(title)
    }
  }
  return out
}

function scoreTitle(title: string) {
  const t = fold(title)
  if (t.includes('KAZANC') || t.includes('GRAFIK:') || t.includes(' PARA ')) return -20
  if (t.includes('SAYISI') && /\d/.test(title)) return -20
  const words = title.trim().split(/\s+/).length
  if (words < 2) return -5
  const upper = title === title.toLocaleUpperCase('tr-TR') ? 4 : 0
  return words + upper + (title.length > 18 ? 3 : 0)
}

export function titleFrom(text: string, number: number) {
  const candidates: string[] = []
  const afterRe = new RegExp(
    String(number) + String.raw`\s*\.\s*TEMA\s*[:.]?\s*([^\d•►]{4,80})`,
    'i',
  )
  const after = cleanTitle(text.match(afterRe)?.[1] || '')
  if (after && !isJunkTitle(after)) candidates.push(after)

  const before = text.split(new RegExp(String(number) + String.raw`\s*\.\s*TEMA`, 'i'))[0]
  candidates.push(...capsTitles(before), ...capsTitles(text))

  const best = candidates
    .filter((t) => t.split(/\s+/).length >= 2 && !isJunkTitle(t))
    .sort((a, b) => scoreTitle(b) - scoreTitle(a))[0]

  return polishTitle(number, best || '')
}

export function polishTitle(number: number, extracted: string) {
  const canon = CANONICAL_TITLES[number]
  if (canon) return canon
  const clean = extracted.replace(/\s+/g, ' ').trim()
  if (!clean || isJunkTitle(clean) || scoreTitle(clean) < 6) {
    return `${number}. tema`
  }
  return clean
}

function topicTitle(text: string): string {
  const t = fold(text)
  for (const item of TOPICS) {
    if (t.includes(item.needle)) return item.title
  }
  return ''
}

function classify(text: string, fallback: string): { kind: PageKind; heading: string } {
  const kind = rawKind(text)
  if (kind === 'olcme') {
    return { kind: 'soru', heading: 'ÖLÇME VE DEĞERLENDİRME' }
  }
  if (kind === 'hazir') return { kind: 'hazir', heading: 'HAZIR MIYIZ?' }
  if (kind === 'basla') return { kind: 'basla', heading: 'BAŞLAYALIM' }
  const heading = topicTitle(text)
  if (heading) return { kind: 'giris', heading }
  return { kind: 'giris', heading: fallback }
}

export function findUnits(pages: string[]): Unit[] {
  const best = new Map<number, { page: number; title: string }>()
  for (let i = 0; i < pages.length; i++) {
    const text = pages[i]
    if (isTocLike(text)) continue
    const t = fold(text)
    for (const m of t.matchAll(/(\d+)\s*\.\s*TEMA/g)) {
      const number = Number(m[1])
      if (!isUnitOpener(text, number)) continue
      if (best.has(number)) continue
      const window = pages.slice(i, i + 3).join('\n')
      best.set(number, {
        page: i + 1,
        title: titleFrom(window, number),
      })
    }
  }

  const hits = [...best.entries()]
    .map(([number, h]) => ({ number, ...h }))
    .sort((a, b) => a.page - b.page || a.number - b.number)

  return hits.map((h, i) => ({
    id: `u-${h.number}-${h.page}`,
    number: h.number,
    title: h.title,
    start: h.page,
    end: i + 1 < hits.length ? hits[i + 1].page - 1 : pages.length,
  }))
}

export function blendDeck(unit: Unit, pages: string[] | PageModel[]): Deck {
  const models: PageModel[] = pages.map((p) =>
    typeof p === 'string' ? stringModel(p) : p,
  )
  const texts = models.map((m) => m.text)
  const slides: DeckSlide[] = []
  let heading = unit.title
  let kind: PageKind = 'giris'
  let olcmeStarted = false

  const pushTitle = (nextKind: PageKind, nextHeading: string) => {
    slides.push({
      kind: nextKind,
      page: 0,
      label: nextHeading,
      heading: nextHeading,
      face: 'title',
      prompt: '',
      choices: [],
      bullets: [],
      pill: '',
    })
  }

  for (let page = unit.start; page <= unit.end; page++) {
    const text = texts[page - 1] || ''
    if (isJunkPage(text)) continue
    const raw = rawKind(text)
    if (raw === 'olcme') olcmeStarted = true
    const next = olcmeStarted
      ? { kind: 'soru' as const, heading: 'ÖLÇME VE DEĞERLENDİRME' }
      : classify(text, heading)
    if (next.heading !== heading || slides.length === 0) {
      heading = next.heading
      kind = next.kind
      if (heading !== unit.title) pushTitle(kind, heading)
    }
    const cards = parseCards(text, models[page - 1])
    if (cards.length === 0) continue
    for (const card of cards) {
      slides.push({
        kind,
        page,
        label: KIND_LABEL[kind],
        heading,
        face: 'card',
        prompt: card.prompt,
        choices: card.choices,
        bullets: card.bullets,
        pill: card.pill,
        figureTop: card.figureTop,
        figureBottom: card.figureBottom,
      })
    }
  }

  if (slides.length === 0) {
    const fallback = [...Array(unit.end - unit.start + 1)].map((_, i) => unit.start + i)
      .find((p) => !isJunkPage(texts[p - 1] || ''))
    if (fallback) {
      const card = parseCards(texts[fallback - 1] || '', models[fallback - 1])[0]
      pushTitle('giris', unit.title)
      slides.push({
        kind: 'giris',
        page: fallback,
        label: KIND_LABEL.giris,
        heading: unit.title,
        face: 'card',
        prompt: card?.prompt || unit.title,
        choices: card?.choices || [],
        bullets: card?.bullets || [],
        pill: card?.pill || '',
      })
    }
  }

  return { unit, slides }
}

export function kindCounts(deck: Deck) {
  const counts: Record<PageKind, number> = {
    kapak: 0,
    hazir: 0,
    basla: 0,
    giris: 0,
    soru: 0,
  }
  for (const s of deck.slides) {
    if (s.face === 'card') counts[s.kind]++
  }
  return counts
}
