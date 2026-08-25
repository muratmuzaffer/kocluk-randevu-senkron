import { tidyBook, type PageLine, type PageModel } from './bookCards'

export type CropBand = {
  top: number
  bottom: number
  text: string
}

export type PageCrop = {
  text: string
  left: { top: number; bottom: number }
  right?: { top: number; bottom: number }
}

const LONG_Q = 480
const SPLIT_AT = 0.42

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

export function isLongQuestion(text: string) {
  const t = tidyBook(text)
  if (!looksLikeQuestion(t)) return false
  if (t.length > LONG_Q) return true
  const open = (t.match(/\b[a-d]\s*[)]/gi) || []).length
  if (open >= 2 && t.length > 260) return true
  return false
}

function isEdgeChrome(line: string) {
  const t = fold(tidyBook(line)).replace(/ \d{2,3}$/, '').trim()
  if (t.length < 2) return true
  if (/^\d{1,3}$/.test(line.trim())) return true
  if (t.includes('KAREKODU') || t.includes('OZET ICERIGE')) return true
  if (/^\d+\s*\.\s*TEMA\b/.test(t) && t.length < 36) return true
  if (t.includes('OLCME VE DEGERLENDIRME') && !looksLikeQuestion(line)) return true
  if (/^(HAZIR MIYIZ|BASLAYALIM)\??$/.test(t)) return true
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

function visualLines(model: PageModel): PageLine[] {
  return model.lines
    .slice()
    .sort((a, b) => b.y - a.y)
    .map((l) => ({ ...l, text: tidyBook(l.text) }))
    .filter((l) => l.text && !isEdgeChrome(l.text))
}

function bandOf(model: PageModel, lines: PageLine[], pad = 0.028) {
  if (!lines.length) return null
  const h = model.height || 1
  const yMax = Math.max(...lines.map((l) => l.y + l.h))
  const yMin = Math.min(...lines.map((l) => l.y))
  let top = Math.max(0.06, (h - yMax - h * pad) / h)
  let bottom = Math.min(0.94, (h - yMin + h * pad * 1.35) / h)
  if (bottom - top < 0.16) {
    const extra = (0.16 - (bottom - top)) / 2
    top = Math.max(0.06, top - extra)
    bottom = Math.min(0.94, bottom + extra)
  }
  if (bottom - top < 0.05) return null
  return { top, bottom }
}

function bestSplit(
  model: PageModel,
  lines: PageLine[],
  box: { top: number; bottom: number },
) {
  const h = model.height || 1
  const mid = box.top + (box.bottom - box.top) * 0.5
  let best = mid
  let bestGap = 0
  for (let i = 0; i < lines.length - 1; i++) {
    const upper = lines[i]
    const lower = lines[i + 1]
    const gap = upper.y - upper.h - lower.y
    const split = (h - lower.y - lower.h / 2) / h
    const lo = box.top + (box.bottom - box.top) * 0.32
    const hi = box.top + (box.bottom - box.top) * 0.68
    if (split < lo || split > hi) continue
    if (gap > bestGap) {
      bestGap = gap
      best = (h - (lower.y + (upper.y - upper.h - lower.y) / 2)) / h
    }
  }
  return Math.min(box.bottom - 0.08, Math.max(box.top + 0.08, best))
}

export function pageCrop(model: PageModel): PageCrop | null {
  const lines = visualLines(model)
  if (!lines.length) return null
  const text = tidyBook(lines.map((l) => l.text).join(' '))
  if (!text || text.length < 8) return null
  if (isLongQuestion(text) && text.length > 420) return null
  const box = bandOf(model, lines)
  if (!box) return null
  if (box.bottom - box.top <= SPLIT_AT) return { text, left: box }
  const split = bestSplit(model, lines, box)
  return {
    text,
    left: { top: box.top, bottom: split },
    right: { top: split, bottom: box.bottom },
  }
}

export function cropBands(model: PageModel): CropBand[] {
  const crop = pageCrop(model)
  if (!crop) return []
  const out: CropBand[] = [{ ...crop.left, text: crop.text }]
  if (crop.right) out.push({ ...crop.right, text: crop.text })
  return out
}
