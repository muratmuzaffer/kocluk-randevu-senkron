export type PageLine = {
  text: string
  x: number
  y: number
  h: number
}

export type PageModel = {
  text: string
  lines: PageLine[]
  width: number
  height: number
}

export type BookCard = {
  prompt: string
  choices: string[]
  bullets: string[]
  pill: string
  figureTop?: number
  figureBottom?: number
}

const MAX_BODY = 880
const CITIES =
  /şanlıurfa|manisa|istanbul|erzurum|denizli|ankara|adana|izmir|bursa|antalya|konya|gaziantep/i

function fold(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .toLocaleUpperCase('tr-TR')
    .replaceAll('İ', 'I')
    .replaceAll('Ş', 'S')
    .replaceAll('Ğ', 'G')
    .replaceAll('Ü', 'U')
    .replaceAll('Ö', 'O')
    .replaceAll('Ç', 'C')
}

export function tidyBook(text: string) {
  return text
    .replace(/([A-Za-zÇĞİÖŞÜçğıöşü]) - ([a-zçğıöşü])/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim()
}

export function stripBookChrome(text: string) {
  return text
    .replace(/KAREKODU[\s\S]{0,90}?(ULAŞABİLİRSİNİZ|ULASABILIRSINIZ)\.?/gi, ' ')
    .replace(/BU TEMADA[\s\S]{0,240}?beklenmektedir\.?/gi, ' ')
    .replace(/ANAHTAR KAVRAM(LAR)?/gi, ' ')
    .replace(/\d+\s*\.\s*TEMA/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function looksLikeQuestion(text: string) {
  const t = fold(text)
  return (
    /[?]/.test(text) ||
    t.includes('HANGISI') ||
    t.includes('BULUNUZ') ||
    t.includes('YAZINIZ') ||
    t.includes('ISARETLEYINIZ') ||
    t.includes('CEVAPLAYINIZ') ||
    t.includes('KACTIR') ||
    t.includes('NEDIR') ||
    /[A-D]\s*\)/.test(text)
  )
}

function isTableCellLine(line: string) {
  const s = line.trim()
  if (/^(kadın|erkek|toplam)\b/i.test(s) && (/\d/.test(s) || s.split(/\s+/).length <= 2)) return true
  if (/cinsiyet/i.test(s) && /nüfus/i.test(s) && s.length < 80) return true
  if (/yüzdesi\s*\(%\)/i.test(s) && s.length < 56) return true
  if (/^\d{1,3}(?:\s\d{3}){2,}(?:\s*%\s*\d+)?$/.test(s)) return true
  if (/^%\s*\d{1,3}$/.test(s)) return true
  return false
}

function isGarbageLine(line: string) {
  if (line.includes('\uFFFD')) return true
  if (/^[A-Da-d]\s*[)]/.test(line.trim())) return false
  if (/^\d{1,2}\s*[.)]\s+\S/.test(line.trim())) return false
  if (isTableCellLine(line)) return true
  const t = fold(line)
  if (/^GRAFIK\s*:/.test(t) && line.length < 80) return true
  const cityHits = line.match(
    /Şanlıurfa|Manisa|İstanbul|Erzurum|Denizli|Ankara|Adana|İzmir|Bursa|Antalya/gi,
  )
  if ((cityHits?.length || 0) >= 3 && !/[.?!]/.test(line)) return true
  if (CITIES.test(line) && line.split(/\s+/).length <= 8 && !/[.?!]/.test(line)) return true
  const letters = (line.match(/[A-Za-zÇĞİÖŞÜçğıöşü]/g) || []).length
  const digits = (line.match(/\d/g) || []).length
  if (letters > 0 && digits > letters * 0.8 && !/[.?!]/.test(line) && line.length > 12) return true
  if (/grafk|ktap|satılan kt/i.test(line)) return true
  return false
}

function wantsTable(text: string) {
  return fold(text).includes('TABLO')
}

function wantsChart(text: string) {
  const t = fold(text)
  return t.includes('GRAFIK') || t.includes('SEKIL') || t.includes('DIYAGRAM')
}

export function isOcrJunkPage(text: string) {
  if ((text.match(/\uFFFD/g) || []).length >= 2) return true
  if (/grafk|satılan kt|ktapçıda|ktap tur/i.test(text)) return true
  const cities = text.match(
    /Şanlıurfa|Manisa|İstanbul|Erzurum|Denizli|Ankara|Adana|İzmir|Bursa|Antalya|Konya/gi,
  )
  const sentences = (text.match(/[.?!]/g) || []).length
  if ((cities?.length || 0) >= 4 && sentences < 2) return true
  const t = fold(text)
  if (t.includes('GRAFIK:') && (cities?.length || 0) >= 3) return true
  return false
}

function stripTableDump(text: string) {
  return tidyBook(
    text
      .replace(/Yaklaşık\s+Cinsiyet[\s\S]*?(?=(Tablo:|Tartışınız|$))/gi, ' ')
      .replace(/Cinsiyet\s+Nüfus\s+Yüzdesi[\s\S]*?(?=(Tablo:|Tartışınız|$))/gi, ' ')
      .replace(/\b(Kadın|Erkek|TOPLAM)\s+[\d\s.]{5,}\s*%\s*\d+/gi, ' '),
  )
}

function isProse(card: BookCard) {
  return (
    !card.choices.length &&
    !card.bullets.length &&
    !card.pill &&
    !looksLikeQuestion(card.prompt)
  )
}

function mergeProse(cards: BookCard[]) {
  const out: BookCard[] = []
  for (const card of cards) {
    const last = out[out.length - 1]
    const combined = last ? last.prompt.length + card.prompt.length + 1 : 0
    const orphan = last ? last.prompt.length < 220 || card.prompt.length < 220 : false
    if (
      last &&
      isProse(last) &&
      isProse(card) &&
      (combined <= MAX_BODY || (orphan && combined <= MAX_BODY + 320))
    ) {
      last.prompt = tidyBook(`${last.prompt} ${card.prompt}`)
      if (card.figureTop != null && last.figureTop == null) {
        last.figureTop = card.figureTop
        last.figureBottom = card.figureBottom
      }
      continue
    }
    out.push({ ...card })
  }
  return out
}

function tableBand(model: PageModel) {
  const cells = model.lines.filter((l) => isTableCellLine(tidyBook(l.text)))
  const captions = model.lines.filter((l) => /^tablo\s*:/i.test(tidyBook(l.text)))
  const bits = cells.length >= 2 ? [...cells, ...captions] : cells
  if (bits.length < 2) return null
  const h = model.height || 1
  const yMax = Math.max(...bits.map((c) => c.y + c.h))
  const yMin = Math.min(...bits.map((c) => c.y))
  const pad = h * 0.04
  return {
    top: Math.max(0.08, (h - yMax - pad) / h),
    bottom: Math.min(0.9, (h - yMin + pad) / h),
  }
}

function isHeaderNoise(text: string) {
  const t = fold(tidyBook(text)).replace(/ \d{2,3}$/, '').trim()
  if (/^(HAZIR MIYIZ|BASLAYALIM)\??$/.test(t)) return true
  if (/^OLCME VE DEGERLENDIRME( SORULARI)?$/.test(t)) return true
  const titles = [
    'ISLEMLERLE CEBIRSEL DUSUNME',
    'ISTATISTIKSEL ARASTIRMA SURECI',
    'ISTATISTIKSEL ARASTIRMA',
    'VERI GORSELLESTIRME ARACLARI',
    'VERI GORSELLESTIRME',
    'VERIDEN OLASILIGA',
    'SAYILAR VE NICELIKLER (2): KESIRLER',
    'KESIRLER',
  ]
  return titles.some((title) => t === title || t.startsWith(title + ' ') && t.length <= title.length + 8)
}

function isChromeLine(line: string) {
  const t = fold(line)
  if (t.length < 2) return true
  if (/^\d{1,3}$/.test(line.trim())) return true
  if (t.includes('KAREKODU')) return true
  if (t.includes('OZET ICERIGE')) return true
  if (/^\d+\s*\.\s*TEMA\b/.test(t) && t.length < 36) return true
  if (t.includes('OLCME VE DEGERLENDIRME') && !looksLikeQuestion(line)) return true
  if (isGarbageLine(line)) return true
  return isHeaderNoise(line)
}

function markerOf(line: string): 'example' | 'activity' | 'step' | 'question' | 'choice' | 'heading' | 'body' {
  const s = line.trim()
  if (/^örnek\s*\d+\b/i.test(s)) return 'example'
  if (/^etkinlik\s*\d+\b/i.test(s)) return 'activity'
  if (/^\d{1,2}\s*[.)]\s*adım\b/i.test(s)) return 'step'
  if (/^[A-Da-d]\s*[)]\s+\S/.test(s)) return 'choice'
  if (/^\d{1,2}\s*[.)]\s+\S/.test(s) && looksLikeQuestion(s)) return 'question'
  if (/^tablo\s*:/i.test(s) || /^grafik\s*:/i.test(s)) return 'body'
  if (
    s.length > 8 &&
    s.length < 52 &&
    s === s.toLocaleUpperCase('tr-TR') &&
    /[A-ZÇĞİÖŞÜ]/.test(s) &&
    s.split(/\s+/).length >= 2 &&
    !/[.?!]/.test(s)
  ) {
    return 'heading'
  }
  return 'body'
}

function sentencesOf(text: string) {
  const t = tidyBook(text)
  if (!t) return []
  const parts = t.split(/(?<=[.!?])\s+(?=[A-ZÇĞİÖŞÜ0-9“"«])/).map((p) => p.trim()).filter(Boolean)
  return parts.length ? parts : [t]
}

function packSentences(parts: string[], max = MAX_BODY) {
  const out: string[] = []
  let buf = ''
  for (const part of parts) {
    if (!buf) buf = part
    else if (buf.length + part.length + 1 <= max) buf += ' ' + part
    else {
      out.push(buf)
      buf = part
    }
  }
  if (buf) out.push(buf)
  while (out.length >= 2 && out[out.length - 1].length < 200) {
    const tail = out.pop()!
    const prev = out[out.length - 1]
    if (prev.length + tail.length + 1 <= max + 320) {
      out[out.length - 1] = `${prev} ${tail}`
    } else {
      out.push(tail)
      break
    }
  }
  return out
}

function letteredChoices(text: string) {
  const re = /(?:^|\s)([A-Da-d])\s*[)]\s+/g
  const hits: { index: number; letter: string }[] = []
  for (const m of text.matchAll(re)) {
    hits.push({ index: m.index!, letter: m[1].toUpperCase() })
  }
  if (hits.length < 2) return { prompt: tidyBook(text), choices: [] as string[] }
  const letters = hits.map((h) => h.letter).join('')
  if (!/^(ABCD|ABC|AB)/.test(letters)) return { prompt: tidyBook(text), choices: [] as string[] }
  const prompt = tidyBook(text.slice(0, hits[0].index))
  const choices: string[] = []
  for (let i = 0; i < hits.length; i++) {
    const start = hits[i].index
    const end = i + 1 < hits.length ? hits[i + 1].index : text.length
    const bit = tidyBook(text.slice(start, end))
    if (bit) choices.push(bit)
  }
  return { prompt, choices }
}

function toLines(raw: string) {
  const prepared = raw
    .replace(/\r/g, '')
    .replace(/(?=Örnek\s*\d+)/gi, '\n')
    .replace(/(?=Etkinlik\s*\d+)/gi, '\n')
    .replace(/(?=\d{1,2}\s*[.)]\s*Adım\b)/gi, '\n')
    .replace(/(?=\s+\d{1,2}\s*[.)]\s+)/g, '\n')
    .replace(/(?=\s+[A-Da-d]\s*[)]\s+)/g, '\n')
  return prepared
    .split('\n')
    .map((l) => tidyBook(l))
    .filter((l) => l && !isChromeLine(l))
}

function figuresOn(model: PageModel) {
  const lines = [...model.lines].sort((a, b) => b.y - a.y)
  const out: { top: number; bottom: number }[] = []
  const h = model.height || 1
  for (let i = 0; i < lines.length - 1; i++) {
    const gap = lines[i].y - lines[i].h - lines[i + 1].y
    if (gap < h * 0.14) continue
    const top = (h - lines[i].y + lines[i].h) / h
    const bottom = (h - lines[i + 1].y - lines[i + 1].h) / h
    if (bottom - top > 0.1 && top > 0.04 && bottom < 0.96) {
      out.push({
        top: Math.max(0.06, top),
        bottom: Math.min(0.92, bottom),
      })
    }
  }
  return out
}

function attachFigure(card: BookCard, figs: { top: number; bottom: number }[]) {
  if (!figs.length) return card
  const fig = figs[0]
  return { ...card, figureTop: fig.top, figureBottom: fig.bottom }
}

function emitBody(text: string, pill: string, cards: BookCard[]) {
  if (isHeaderNoise(text) || isGarbageLine(text)) return
  const cleaned = stripTableDump(text)
  if (cleaned.length < 18) return
  const packed = packSentences(sentencesOf(cleaned))
  for (const prompt of packed) {
    if (prompt.length < 24) continue
    if (isGarbageLine(prompt)) continue
    cards.push({ prompt, choices: [], bullets: [], pill })
  }
}

export function parseCards(raw: string, model?: PageModel): BookCard[] {
  const lines = model?.lines.length
    ? model.lines
        .slice()
        .sort((a, b) => b.y - a.y)
        .map((l) => tidyBook(l.text))
        .filter((l) => l && !isChromeLine(l))
    : toLines(raw)

  const cards: BookCard[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const kind = markerOf(line)

    if (kind === 'heading') {
      i += 1
      continue
    }

    if (kind === 'example' || kind === 'activity') {
      const pill = line
      const body: string[] = []
      i += 1
      while (i < lines.length) {
        const next = markerOf(lines[i])
        if (next === 'example' || next === 'activity' || next === 'question' || next === 'step') break
        if (next !== 'heading') body.push(lines[i])
        i += 1
      }
      const joined = body.join(' ')
      const { prompt, choices } = letteredChoices(joined)
      if (choices.length >= 2) {
        cards.push({ prompt: prompt || pill, choices, bullets: [], pill })
      } else {
        emitBody(joined || line, pill, cards)
      }
      continue
    }

    if (kind === 'step') {
      const bullets: string[] = []
      while (i < lines.length && markerOf(lines[i]) === 'step') {
        bullets.push(lines[i])
        i += 1
      }
      cards.push({ prompt: '', choices: [], bullets, pill: '' })
      continue
    }

    if (kind === 'question') {
      const parts: string[] = [line]
      i += 1
      while (i < lines.length) {
        const next = markerOf(lines[i])
        if (next === 'question' || next === 'example' || next === 'activity' || next === 'step') break
        parts.push(lines[i])
        i += 1
      }
      const { prompt, choices } = letteredChoices(parts.join(' '))
      cards.push({
        prompt: prompt || tidyBook(parts[0]),
        choices,
        bullets: [],
        pill: '',
      })
      continue
    }

    const body: string[] = [line]
    i += 1
    while (i < lines.length) {
      const next = markerOf(lines[i])
      if (next !== 'body' && next !== 'choice') break
      body.push(lines[i])
      i += 1
    }
    const joined = body.join(' ')
    const { prompt, choices } = letteredChoices(joined)
    if (choices.length >= 2) {
      cards.push({ prompt, choices, bullets: [], pill: '' })
    } else {
      emitBody(joined, '', cards)
    }
  }

  const tableFig = model ? tableBand(model) : null
  const gapFigs = model ? figuresOn(model) : []
  return mergeProse(
    cards.filter(
      (c) =>
        !isGarbageLine(c.prompt) &&
        !isOcrJunkPage(c.prompt) &&
        (c.prompt.length >= 24 || c.choices.length >= 2 || c.bullets.length >= 2),
    ),
  ).map((c) => {
    const prompt = stripTableDump(c.prompt)
    const table = wantsTable(prompt) || wantsTable(c.pill)
    const chart = wantsChart(prompt) || wantsChart(c.pill)
    if (table && tableFig) return attachFigure({ ...c, prompt }, [tableFig])
    if ((table || chart) && gapFigs.length) return attachFigure({ ...c, prompt }, gapFigs)
    return { ...c, prompt }
  })
}

export function stringModel(text: string): PageModel {
  const lines = toLines(text)
  return {
    text,
    width: 500,
    height: Math.max(800, lines.length * 18 + 80),
    lines: lines.map((line, i) => ({
      text: line,
      x: 40,
      y: 760 - i * 18,
      h: 12,
    })),
  }
}

export function isQuestionCard(card: BookCard) {
  return card.choices.length >= 2 || looksLikeQuestion(card.prompt)
}
