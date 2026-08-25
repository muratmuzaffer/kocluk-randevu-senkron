import { skipBookLine, tidyBook, type PageLine, type PageModel } from './bookCards'

export type CropBand = {
  top: number
  bottom: number
  text: string
}

const MAX_H = 0.4
const MIN_H = 0.08
const LONG_Q = 480

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

function isSplitLine(line: string) {
  const s = line.trim()
  if (/^örnek\s*\d+\b/i.test(s)) return true
  if (/^etkinlik\s*\d+\b/i.test(s)) return true
  if (/^\d{1,2}\s*[.)]\s+\S/.test(s) && looksLikeQuestion(s)) return true
  if (
    s.length > 8 &&
    s.length < 52 &&
    s === s.toLocaleUpperCase('tr-TR') &&
    /[A-ZÇĞİÖŞÜ]/.test(s) &&
    s.split(/\s+/).length >= 2 &&
    !/[.?!]/.test(s)
  ) {
    return true
  }
  return false
}

export function isLongQuestion(text: string) {
  const t = tidyBook(text)
  if (!looksLikeQuestion(t)) return false
  if (t.length > LONG_Q) return true
  const open = (t.match(/\b[a-d]\s*[)]/gi) || []).length
  if (open >= 2 && t.length > 260) return true
  return false
}

function bandOf(model: PageModel, lines: PageLine[], pad = 0.02) {
  if (!lines.length) return null
  const h = model.height || 1
  const yMax = Math.max(...lines.map((l) => l.y + l.h))
  const yMin = Math.min(...lines.map((l) => l.y))
  let top = Math.max(0.075, (h - yMax - h * pad) / h)
  let bottom = Math.min(0.93, (h - yMin + h * pad) / h)
  if (bottom - top < 0.12) {
    const extra = (0.12 - (bottom - top)) / 2
    top = Math.max(0.075, top - extra)
    bottom = Math.min(0.93, bottom + extra)
  }
  if (bottom - top < 0.05) return null
  return { top, bottom }
}

function heightOf(model: PageModel, lines: PageLine[]) {
  const b = bandOf(model, lines, 0)
  return b ? b.bottom - b.top : 0
}

function contentLines(model: PageModel): PageLine[] {
  return model.lines
    .slice()
    .sort((a, b) => b.y - a.y)
    .map((l) => ({ ...l, text: tidyBook(l.text) }))
    .filter((l) => l.text && !skipBookLine(l.text))
}

function expandToGap(model: PageModel, band: { top: number; bottom: number }, next?: PageLine) {
  if (!next) {
    return { ...band, bottom: Math.min(0.93, band.bottom + 0.02) }
  }
  const h = model.height || 1
  const nextTop = (h - next.y - next.h) / h
  if (nextTop - band.bottom > 0.1 && nextTop - band.bottom < 0.38) {
    return { ...band, bottom: nextTop - 0.012 }
  }
  return band
}

export function cropBands(model: PageModel): CropBand[] {
  const lines = contentLines(model)
  if (!lines.length) return []

  const groups: PageLine[][] = []
  let cur: PageLine[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (cur.length && isSplitLine(line.text) && heightOf(model, cur) >= MIN_H) {
      groups.push(cur)
      cur = [line]
      continue
    }
    const next = [...cur, line]
    if (cur.length && heightOf(model, next) > MAX_H) {
      groups.push(cur)
      cur = [line]
      continue
    }
    cur = next
  }
  if (cur.length) groups.push(cur)

  const merged: PageLine[][] = []
  for (const group of groups) {
    const last = merged[merged.length - 1]
    if (last && !isSplitLine(group[0].text) && !isSplitLine(last[0].text) && heightOf(model, last) + heightOf(model, group) < MAX_H) {
      const combo = [...last, ...group]
      if (heightOf(model, combo) <= MAX_H && !isLongQuestion(combo.map((l) => l.text).join(' '))) {
        merged[merged.length - 1] = combo
        continue
      }
    }
    merged.push(group)
  }

  const out: CropBand[] = []
  for (let i = 0; i < merged.length; i++) {
    const group = merged[i]
    const text = tidyBook(group.map((l) => l.text).join(' '))
    if (!text || text.length < 12) continue
    if (isLongQuestion(text)) continue
    const raw = bandOf(model, group)
    if (!raw) continue
    const next = merged[i + 1]?.[0]
    const box = expandToGap(model, raw, next)
    out.push({ top: box.top, bottom: box.bottom, text })
  }
  return out
}
