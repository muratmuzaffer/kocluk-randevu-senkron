export type PageKind = 'kapak' | 'hazir' | 'basla' | 'giris' | 'soru'

export type SlideMode = 'text' | 'page'

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
  bullets: string[]
  mode: SlideMode
}

export type Deck = {
  unit: Unit
  slides: DeckSlide[]
}

export const CANONICAL_TITLES: Record<number, string> = {
  4: 'SAYILAR VE NİCELİKLER (2): KESİRLER',
  5: 'İSTATİSTİKSEL ARAŞTIRMA SÜRECİ',
  6: 'İŞLEMLERLE CEBİRSEL DÜŞÜNME',
  7: 'VERİDEN OLASILIĞA',
}

const KIND_LABEL: Record<PageKind, string> = {
  kapak: 'Kapak',
  hazir: 'Hazır mıyız?',
  basla: 'Başlayalım',
  giris: 'Konuya giriş',
  soru: 'Sorular',
}

const TOPIC_NEEDLES: { needle: string; key: string; title: string }[] = [
  { needle: 'ESITLIGIN KORUNUMU', key: 'esitlik', title: 'EŞİTLİĞİN KORUNUMU VE İŞLEM ÖZELLİKLERİ' },
  { needle: 'ISLEM ONCELIGI', key: 'oncelik', title: 'İŞLEM ÖNCELİĞİ' },
  { needle: 'SAYI VE SEKIL', key: 'oruntu', title: 'SAYI VE ŞEKİL ÖRÜNTÜLERİ' },
  { needle: 'SEKIL ORUNTU', key: 'oruntu', title: 'SAYI VE ŞEKİL ÖRÜNTÜLERİ' },
  { needle: 'TEME ARITMETIK', key: 'algoritma', title: 'TEMEL ARİTMETİK İŞLEMLER VE ALGORİTMA' },
  { needle: 'ALGORITMA', key: 'algoritma', title: 'TEMEL ARİTMETİK İŞLEMLER VE ALGORİTMA' },
  { needle: 'OLASILIK SPEKTRUMU', key: 'spektrum', title: 'OLASILIK SPEKTRUMU' },
  { needle: 'KESIN OLAY', key: 'kesin', title: 'KESİN VE İMKANSIZ OLAYLAR' },
  { needle: 'IMKANSIZ OLAY', key: 'kesin', title: 'KESİN VE İMKANSIZ OLAYLAR' },
  { needle: 'OLASILIK', key: 'olasilik', title: 'OLASILIK' },
  { needle: 'VERI GORSELLESTIRME', key: 'gorsel', title: 'VERİ GÖRSELLEŞTİRME ARAÇLARI' },
  { needle: 'SUTUN GRAFIGI', key: 'sutun', title: 'SÜTUN GRAFİĞİ' },
  { needle: 'DAIRE GRAFIGI', key: 'daire', title: 'DAİRE GRAFİĞİ' },
  { needle: 'NOKTA GRAFIGI', key: 'nokta', title: 'NOKTA GRAFİĞİ' },
  { needle: 'ISTATISTIK OKURYAZAR', key: 'okuryazar', title: 'İSTATİSTİK OKURYAZARLIĞI' },
  { needle: 'DEGISEBILIR', key: 'degis', title: 'VERİLERİN DEĞİŞEBİLİRLİĞİ' },
  { needle: 'ISTATISTIKSEL ARASTIRMA', key: 'arastirma', title: 'İSTATİSTİKSEL ARAŞTIRMA SÜRECİ' },
  { needle: 'DENK KESIR', key: 'denk', title: 'DENK KESİRLER' },
  { needle: 'KESIRLERDE TOPLAMA', key: 'ktoplama', title: 'KESİRLERDE TOPLAMA' },
  { needle: 'KESIRLERDE CIKARMA', key: 'kcikarma', title: 'KESİRLERDE ÇIKARMA' },
  { needle: 'KESIRLERDE CARPMA', key: 'kcarpma', title: 'KESİRLERDE ÇARPMA' },
  { needle: 'PAYDA ESITLEME', key: 'payda', title: 'PAYDA EŞİTLEME' },
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

export function stripJunk(text: string) {
  return text
    .replace(/KAREKODU[\s\S]{0,90}?(ULAŞABİLİRSİNİZ|ULASABILIRSINIZ)\.?/gi, ' ')
    .replace(/KAREKODU OKUTARAK TEMA/gi, ' ')
    .replace(/BU TEMADA[\s\S]{0,240}?beklenmektedir\.?/gi, ' ')
    .replace(/ANAHTAR KAVRAM(LAR)?[\s\S]{0,120}?/gi, ' ')
    .replace(/\d+\s*\.\s*TEMA/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function usefulBit(raw: string) {
  const s = raw.replace(/\s+/g, ' ').trim()
  if (s.length < 18 || s.length > 220) return ''
  if (isJunkTitle(s)) return ''
  const t = fold(s)
  if (t.includes('KAREKODU') || t.includes('OZET ICERIGE')) return ''
  if (t.includes('BEKLENMEKTEDIR')) return ''
  const letters = (s.match(/[A-Za-zÇĞİÖŞÜçğıöşü]/g) || []).length
  if (letters < 12) return ''
  const digits = (s.match(/\d/g) || []).length
  if (digits > s.length * 0.35) return ''
  return s.replace(/^[a-zA-ZçğıöşüÇĞİÖŞÜ]\)\s*/, '').replace(/^\d+[.)]\s*/, '')
}

export function bulletsFrom(text: string, max = 5): string[] {
  const t = stripJunk(text)
  const seen = new Set<string>()
  const out: string[] = []
  const push = (raw: string) => {
    const bit = usefulBit(raw)
    if (!bit) return
    const key = fold(bit).slice(0, 48)
    if (seen.has(key)) return
    seen.add(key)
    out.push(bit)
  }

  for (const m of t.matchAll(/(?:^|[^\d])\d{1,2}[).]\s+(.{18,180}?)(?=(?:\s+\d{1,2}[).]\s+)|$)/g)) {
    push(m[1])
    if (out.length >= max) return out
  }
  if (out.length >= 2) return out.slice(0, max)

  for (const m of t.matchAll(/\b[a-dA-D]\)\s+(.{18,180}?)(?=(?:\s+[a-dA-D]\)\s+)|$)/g)) {
    push(m[1])
    if (out.length >= max) return out
  }
  if (out.length >= 2) return out.slice(0, max)

  for (const part of t.split(/(?<=[.!?])\s+/)) {
    push(part)
    if (out.length >= max) return out
  }
  if (out.length < 2) {
    const words = t.split(' ').filter(Boolean)
    let buf: string[] = []
    for (const w of words) {
      buf.push(w)
      const s = buf.join(' ')
      if (s.length >= 88) {
        push(s)
        buf = []
        if (out.length >= max) return out
      }
    }
    if (buf.length) push(buf.join(' '))
  }
  return out.slice(0, max)
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

function topicOf(text: string) {
  const t = fold(text)
  if (t.includes('OLCME VE DEGERLENDIRME')) return { key: 'olcme', title: 'ÖLÇME VE DEĞERLENDİRME SORULARI' }
  if (t.includes('HAZIR MIYIZ')) return { key: 'hazir', title: 'HAZIR MIYIZ?' }
  if (t.includes('BASLAYALIM')) return { key: 'basla', title: 'BAŞLAYALIM' }
  for (const item of TOPIC_NEEDLES) {
    if (t.includes(item.needle)) return { key: item.key, title: item.title }
  }
  return { key: 'body', title: '' }
}

function makeSlide(
  kind: PageKind,
  page: number,
  heading: string,
  texts: string[],
): DeckSlide {
  const bullets = bulletsFrom(texts.join(' '), kind === 'soru' ? 4 : 5)
  return {
    kind,
    page,
    label: KIND_LABEL[kind],
    heading,
    bullets,
    mode: bullets.length >= 2 ? 'text' : 'page',
  }
}

function pickEvery<T>(items: T[], max: number) {
  if (items.length <= max) return items
  if (max === 1) return [items[0]]
  const out: T[] = []
  for (let i = 0; i < max; i++) {
    const idx = Math.round((i * (items.length - 1)) / (max - 1))
    const item = items[idx]
    if (!out.includes(item)) out.push(item)
  }
  return out
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

export function blendDeck(unit: Unit, pages: string[]): Deck {
  const nums: number[] = []
  for (let p = unit.start; p <= unit.end; p++) nums.push(p)

  const hazir: number[] = []
  const basla: number[] = []
  const topics = new Map<string, { title: string; pages: number[] }>()
  const soruPages: number[] = []
  let olcmeStarted = false

  for (const page of nums) {
    const text = pages[page - 1] || ''
    const kind = rawKind(text)
    if (kind === 'olcme') olcmeStarted = true
    if (olcmeStarted) {
      if (!isJunkPage(text)) soruPages.push(page)
      continue
    }
    if (isJunkPage(text)) continue
    if (kind === 'hazir') {
      if (hazir.length === 0) hazir.push(page)
      continue
    }
    if (kind === 'basla') {
      if (basla.length === 0) basla.push(page)
      continue
    }
    const topic = topicOf(text)
    if (topic.key === 'body') continue
    const prev = topics.get(topic.key)
    if (prev) {
      if (prev.pages.length < 3) prev.pages.push(page)
      continue
    }
    topics.set(topic.key, { title: topic.title, pages: [page] })
  }

  let topicEntries = [...topics.entries()]
  if (topicEntries.length === 0) {
    const extras = nums.filter((p) => {
      const text = pages[p - 1] || ''
      return !isJunkPage(text) && rawKind(text) === 'other' && !soruPages.includes(p)
    })
    const picked = extras.filter((_, i) => i === 0 || (i + 1) % 4 === 0).slice(0, 5)
    topicEntries = picked.map((page, i) => [
      `body-${i}`,
      {
        title: unit.title,
        pages: [page],
      },
    ])
  }

  const slides: DeckSlide[] = []
  const headingOf = (kind: PageKind, fallback: string) => {
    if (kind === 'hazir') return 'HAZIR MIYIZ?'
    if (kind === 'basla') return 'BAŞLAYALIM'
    if (kind === 'soru') return 'ÖLÇME VE DEĞERLENDİRME SORULARI'
    return fallback || unit.title
  }

  for (const page of hazir) {
    slides.push(
      makeSlide('hazir', page, headingOf('hazir', ''), [pages[page - 1] || '']),
    )
  }
  for (const page of basla) {
    slides.push(
      makeSlide('basla', page, headingOf('basla', ''), [pages[page - 1] || '']),
    )
  }

  for (const [, topic] of topicEntries.slice(0, 6)) {
    const texts = topic.pages.map((p) => pages[p - 1] || '')
    slides.push(makeSlide('giris', topic.pages[0], headingOf('giris', topic.title), texts))
  }

  const questionBits = bulletsFrom(
    soruPages.map((p) => pages[p - 1] || '').join(' '),
    8,
  )
  if (questionBits.length >= 2) {
    const chunks = [questionBits.slice(0, 4), questionBits.slice(4, 8)].filter(
      (c) => c.length > 0,
    )
    chunks.forEach((bits, i) => {
      slides.push({
        kind: 'soru',
        page: soruPages[Math.min(i, soruPages.length - 1)] || unit.start,
        label: KIND_LABEL.soru,
        heading: headingOf('soru', ''),
        bullets: bits,
        mode: 'text',
      })
    })
  } else {
    for (const page of pickEvery(soruPages, 3)) {
      slides.push(makeSlide('soru', page, headingOf('soru', ''), [pages[page - 1] || '']))
    }
  }

  if (slides.length === 0) {
    const fallback = nums.find((p) => !isJunkPage(pages[p - 1] || ''))
    if (fallback) {
      slides.push(
        makeSlide('giris', fallback, unit.title, [pages[fallback - 1] || '']),
      )
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
  for (const s of deck.slides) counts[s.kind]++
  return counts
}
