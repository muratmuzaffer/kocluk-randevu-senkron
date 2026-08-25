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

const HEADER = 0.045
const FOOTER = 0.945
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

export function isDecorPage(text: string) {
  const t = tidyBook(text)
  const folded = fold(t)
  if (/ORNEK\s*\d+|ETKINLIK\s*\d+|\d+\s*[.)]\s*ADIM/.test(folded)) return false
  if (looksLikeQuestion(t)) return false
  if (/\d+\s*\)\s+\S/.test(t)) return false
  if (/\d\s*(?:\+|×|÷|=|-)\s*\d/.test(t)) return false
  const body = folded
    .replace(/KAREKODU[\s\S]{0,80}(ULASABILIRSINIZ|ULAŞABİLİRSİNİZ)/g, ' ')
    .replace(/\d+\s*\.\s*TEMA/g, ' ')
    .replace(/HAZIR MIYIZ|BASLAYALIM/g, ' ')
    .replace(/ISTATISTIKSEL ARASTIRMA( SURECI)?/g, ' ')
    .replace(/ISLEMLERLE CEBIRSEL DUSUNME/g, ' ')
    .replace(/SAYILAR VE NICELIKLER \(2\): KESIRLER/g, ' ')
    .replace(/\bKESIRLER\b/g, ' ')
    .replace(/VERIDEN OLASILIGA/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const letters = (body.match(/[A-Z]/g) || []).length
  if (letters < 40) return true
  if (body.length < 48) return true
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

export function pageCrop(model: PageModel): PageCrop | null {
  if (isDecorPage(model.text)) return null
  const lines = visualLines(model)
  const text = tidyBook((lines.length ? lines : model.lines).map((l) => l.text).join(' ') || model.text)
  if (isDecorPage(text)) return null
  if (!text || text.replace(/\s+/g, '').length < 8) return null
  return { text, left: { top: HEADER, bottom: FOOTER } }
}

export function cropBands(model: PageModel): CropBand[] {
  const crop = pageCrop(model)
  if (!crop) return []
  const out: CropBand[] = [{ ...crop.left, text: crop.text }]
  if (crop.right) out.push({ ...crop.right, text: crop.text })
  return out
}
