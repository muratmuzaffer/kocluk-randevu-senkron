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

export type CardLayout = 'prose' | 'steps' | 'example' | 'mcq' | 'open' | 'math'

export type BookCard = {
  prompt: string
  choices: string[]
  bullets: string[]
  parts: string[]
  pill: string
  layout: CardLayout
  figureRole?: 'side' | 'hero'
  figureTop?: number
  figureBottom?: number
}

const MAX_BODY = 640
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

export function isMathLine(line: string) {
  const s = tidyBook(line)
  if (!s || s.length > 110) return false
  if (/^(örnek|etkinlik|adım)\b/i.test(s)) return false
  if (/[?]/.test(s) && s.length > 42) return false
  if (/[□■◯○◼◻]|_{2,}|\.{3}/.test(s)) return true
  const ops = (s.match(/[+=×÷:−]/g) || []).length
  if (s.includes('=') && ops >= 1 && s.length < 72) return true
  if (/^\d+(\s*[+\-×÷:]\s*\d+){1,}\s*=/.test(s)) return true
  if (/\(\s*\d+\s*[+\-×÷]\s*\d+\s*\)/.test(s) && s.length < 80) return true
  if (/^[a-z]\s*[+\-×÷=]\s*[a-z]/i.test(s) && s.length < 48) return true
  return false
}

function isTableCellLine(line: string) {
  const s = line.trim()
  if (isMathLine(s)) return false
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
  if (isMathLine(line)) return false
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

function wantsShape(text: string) {
  const t = fold(text)
  return (
    t.includes('YANDAKI') ||
    t.includes('ASAGIDAKI SEKIL') ||
    t.includes('SEKILDE') ||
    t.includes('GORSELDE')
  )
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

function emptyCard(): BookCard {
  return {
    prompt: '',
    choices: [],
    bullets: [],
    parts: [],
    pill: '',
    layout: 'prose',
  }
}

function isProse(card: BookCard) {
  return (
    card.layout === 'prose' &&
    !card.choices.length &&
    !card.bullets.length &&
    !card.parts.length &&
    !card.pill &&
    !looksLikeQuestion(card.prompt)
  )
}

function mergeProse(cards: BookCard[]) {
  const out: BookCard[] = []
  for (const card of cards) {
    const last = out[out.length - 1]
    const combined = last ? last.prompt.length + card.prompt.length + 1 : 0
    const orphan = last ? last.prompt.length < 200 || card.prompt.length < 200 : false
    if (
      last &&
      isProse(last) &&
      isProse(card) &&
      last.figureTop == null &&
      card.figureTop == null &&
      (combined <= MAX_BODY || (orphan && combined <= MAX_BODY + 240))
    ) {
      last.prompt = tidyBook(`${last.prompt} ${card.prompt}`)
      continue
    }
    out.push({ ...card })
  }
  return out
}

function bandFrom(model: PageModel, lines: PageLine[], padRatio = 0.04) {
  if (!lines.length) return null
  const h = model.height || 1
  const yMax = Math.max(...lines.map((c) => c.y + c.h))
  const yMin = Math.min(...lines.map((c) => c.y))
  const pad = h * padRatio
  const top = Math.max(0.07, (h - yMax - pad) / h)
  const bottom = Math.min(0.93, (h - yMin + pad) / h)
  if (bottom - top < 0.05) return null
  return { top, bottom }
}

function tableBand(model: PageModel) {
  const cells = model.lines.filter((l) => isTableCellLine(tidyBook(l.text)))
  const captions = model.lines.filter((l) => /^tablo\s*:/i.test(tidyBook(l.text)))
  const bits = cells.length >= 2 ? [...cells, ...captions] : cells
  return bits.length >= 2 ? bandFrom(model, bits, 0.04) : null
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
  return titles.some((title) => t === title || (t.startsWith(title + ' ') && t.length <= title.length + 8))
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

function markerOf(
  line: string,
): 'example' | 'activity' | 'step' | 'question' | 'choice' | 'heading' | 'body' {
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
  while (out.length >= 2 && out[out.length - 1].length < 180) {
    const tail = out.pop()!
    const prev = out[out.length - 1]
    if (prev.length + tail.length + 1 <= max + 260) {
      out[out.length - 1] = `${prev} ${tail}`
    } else {
      out.push(tail)
      break
    }
  }
  return out
}

function splitLettered(text: string): { kind: 'mcq' | 'open' | 'none'; prompt: string; items: string[] } {
  const re = /(?:^|\s)([A-Da-d])\s*[)]\s+/g
  const hits: { index: number; letter: string }[] = []
  for (const m of text.matchAll(re)) {
    hits.push({ index: m.index!, letter: m[1] })
  }
  if (hits.length < 2) return { kind: 'none', prompt: tidyBook(text), items: [] }
  const letters = hits.map((h) => h.letter.toUpperCase()).join('')
  if (!/^(ABCD|ABC|AB)/.test(letters)) return { kind: 'none', prompt: tidyBook(text), items: [] }
  const prompt = tidyBook(text.slice(0, hits[0].index))
  const items: string[] = []
  for (let i = 0; i < hits.length; i++) {
    const start = hits[i].index
    const end = i + 1 < hits.length ? hits[i + 1].index : text.length
    const bit = tidyBook(text.slice(start, end))
    if (bit) items.push(bit)
  }
  const lowerSource = hits.every((h) => h.letter >= 'a' && h.letter <= 'd')
  const longish = items.filter((it) => it.length > 48 || /[?]/.test(it)).length
  if (lowerSource && longish >= 1) return { kind: 'open', prompt, items }
  return { kind: 'mcq', prompt, items }
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

function richLines(raw: string, model?: PageModel): PageLine[] {
  if (model?.lines.length) {
    return model.lines
      .slice()
      .sort((a, b) => b.y - a.y)
      .map((l) => ({ ...l, text: tidyBook(l.text) }))
      .filter((l) => l.text && !isChromeLine(l.text))
  }
  return toLines(raw).map((text, i) => ({ text, x: 40, y: 800 - i * 18, h: 12 }))
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

function attachFigure(card: BookCard, figs: { top: number; bottom: number }[], role: 'side' | 'hero' = 'side') {
  if (!figs.length || card.figureTop != null) return card
  const fig = figs[0]
  return { ...card, figureTop: fig.top, figureBottom: fig.bottom, figureRole: role }
}

function pushSplit(
  cards: BookCard[],
  joined: string,
  pill: string,
  source: PageLine[],
  model?: PageModel,
) {
  const split = splitLettered(joined)
  if (split.kind === 'mcq') {
    cards.push({
      ...emptyCard(),
      prompt: split.prompt || pill,
      choices: split.items,
      pill,
      layout: 'mcq',
    })
    return
  }
  if (split.kind === 'open') {
    cards.push({
      ...emptyCard(),
      prompt: split.prompt || pill,
      parts: split.items,
      pill,
      layout: 'open',
    })
    return
  }
  emitFromLines(source, pill, cards, model)
}

function emitFromLines(lines: PageLine[], pill: string, cards: BookCard[], model?: PageModel) {
  const usable = lines.filter((l) => l.text && !isHeaderNoise(l.text) && !isGarbageLine(l.text))
  if (!usable.length) {
    if (pill) emitBody(pill, pill, cards)
    return
  }

  type Chunk = { kind: 'math' | 'prose'; lines: PageLine[] }
  const chunks: Chunk[] = []
  for (const line of usable) {
    const kind = isMathLine(line.text) ? 'math' : 'prose'
    const last = chunks[chunks.length - 1]
    if (last && last.kind === kind) last.lines.push(line)
    else chunks.push({ kind, lines: [line] })
  }

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const next = chunks[i + 1]
    if (chunk.kind === 'prose' && next?.kind === 'math') {
      const joined = stripTableDump(chunk.lines.map((l) => l.text).join(' '))
      if (joined.length < 280 && !looksLikeQuestion(joined)) continue
    }
    if (chunk.kind === 'math') {
      const mathText = chunk.lines.map((l) => l.text).join(' ')
      const prev = chunks[i - 1]
      const prevText =
        prev?.kind === 'prose' ? stripTableDump(prev.lines.map((l) => l.text).join(' ')) : ''
      const instruction =
        prevText && prevText.length < 280 && !looksLikeQuestion(prevText) ? prevText : ''
      const band = model ? bandFrom(model, chunk.lines, 0.05) : null
      cards.push({
        ...emptyCard(),
        prompt: instruction || (band ? '' : mathText),
        pill,
        layout: 'math',
        figureRole: 'hero',
        figureTop: band?.top,
        figureBottom: band?.bottom,
      })
      continue
    }
    const joined = stripTableDump(chunk.lines.map((l) => l.text).join(' '))
    if (joined.length < 18) continue
    emitBody(joined, pill, cards)
  }
}

function emitBody(text: string, pill: string, cards: BookCard[]) {
  if (isHeaderNoise(text) || isGarbageLine(text)) return
  const cleaned = stripTableDump(text)
  if (cleaned.length < 18) return
  const packed = packSentences(sentencesOf(cleaned).filter((p) => !isMathLine(p)))
  const layout: CardLayout = pill ? 'example' : 'prose'
  for (const prompt of packed) {
    if (prompt.length < 24) continue
    if (isGarbageLine(prompt)) continue
    cards.push({
      ...emptyCard(),
      prompt,
      pill,
      layout: looksLikeQuestion(prompt) && !pill ? 'open' : layout,
    })
  }
}

export function parseCards(raw: string, model?: PageModel): BookCard[] {
  const lines = richLines(raw, model)
  const cards: BookCard[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const kind = markerOf(line.text)

    if (kind === 'heading') {
      i += 1
      continue
    }

    if (kind === 'example' || kind === 'activity') {
      const pill = line.text
      const body: PageLine[] = []
      i += 1
      while (i < lines.length) {
        const next = markerOf(lines[i].text)
        if (next === 'example' || next === 'activity' || next === 'question' || next === 'step') break
        if (next !== 'heading') body.push(lines[i])
        i += 1
      }
      pushSplit(cards, body.map((l) => l.text).join(' ') || pill, pill, body, model)
      continue
    }

    if (kind === 'step') {
      const bullets: string[] = []
      while (i < lines.length && markerOf(lines[i].text) === 'step') {
        bullets.push(lines[i].text)
        i += 1
      }
      cards.push({ ...emptyCard(), bullets, layout: 'steps' })
      continue
    }

    if (kind === 'question') {
      const parts: PageLine[] = [line]
      i += 1
      while (i < lines.length) {
        const next = markerOf(lines[i].text)
        if (next === 'question' || next === 'example' || next === 'activity' || next === 'step') break
        parts.push(lines[i])
        i += 1
      }
      pushSplit(cards, parts.map((l) => l.text).join(' '), '', parts, model)
      continue
    }

    const body: PageLine[] = [line]
    i += 1
    while (i < lines.length) {
      const next = markerOf(lines[i].text)
      if (next !== 'body' && next !== 'choice') break
      body.push(lines[i])
      i += 1
    }
    pushSplit(cards, body.map((l) => l.text).join(' '), '', body, model)
  }

  const tableFig = model ? tableBand(model) : null
  const gapFigs = model ? figuresOn(model) : []
  return mergeProse(
    cards.filter(
      (c) =>
        !isGarbageLine(c.prompt) &&
        !isOcrJunkPage(c.prompt) &&
        (c.prompt.length >= 24 ||
          c.choices.length >= 2 ||
          c.bullets.length >= 2 ||
          c.parts.length >= 2 ||
          c.layout === 'math'),
    ),
  ).map((c) => {
    const prompt = stripTableDump(c.prompt)
    const card = { ...c, prompt }
    if (card.figureTop != null) return card
    const table = wantsTable(prompt) || wantsTable(card.pill)
    const chart = wantsChart(prompt) || wantsChart(card.pill)
    const shape = wantsShape(prompt)
    if (table && tableFig) return attachFigure(card, [tableFig], 'side')
    if ((table || chart || shape) && gapFigs.length) {
      return attachFigure(card, gapFigs, card.layout === 'math' ? 'hero' : 'side')
    }
    return card
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
  return card.choices.length >= 2 || card.parts.length >= 1 || looksLikeQuestion(card.prompt)
}

export function choiceBits(choice: string) {
  const m = choice.match(/^([A-Da-d])\s*[)]\s*(.*)$/)
  if (!m) return { letter: '', text: choice }
  return { letter: m[1].toUpperCase(), text: m[2] }
}

export function stepBits(bit: string) {
  const m = bit.match(/^(\d{1,2}\s*[.)]\s*Adım)\s*(.*)$/i)
  if (!m) return { head: '', body: bit }
  return { head: m[1], body: m[2] || bit }
}
