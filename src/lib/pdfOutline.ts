export type PageKind = 'kapak' | 'hazir' | 'basla' | 'giris' | 'soru'

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
}

export type Deck = {
  unit: Unit
  slides: DeckSlide[]
}

const KIND_LABEL: Record<PageKind, string> = {
  kapak: 'Kapak',
  hazir: 'Hazır mıyız?',
  basla: 'Başlayalım',
  giris: 'Konuya giriş',
  soru: 'Sorular',
}

function norm(text: string) {
  return text.replace(/\s+/g, ' ').toLocaleUpperCase('tr-TR')
}

function isToc(text: string) {
  const t = norm(text)
  return t.includes('İÇİNDEKİLER') || t.includes('ICINDEKILER')
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

function isTocLike(text: string) {
  if (isToc(text)) return true
  const t = fold(text)
  const nums = new Set<number>()
  for (const m of t.matchAll(/(\d+)\s*\.\s*TEMA/g)) {
    nums.add(Number(m[1]))
  }
  // İçindekiler devam sayfası: birden fazla tema adı yan yana.
  if (nums.size >= 2) return true
  if (t.includes('KITABIMIZI TANIYALIM')) return true
  return false
}

function rawKind(text: string): 'hazir' | 'basla' | 'olcme' | 'other' {
  if (isTocLike(text)) return 'other'
  const t = fold(text)
  if (t.includes('OLCME VE DEGERLENDIRME')) return 'olcme'
  // Başlık çoğu zaman görselde; metin sorulardan sonra gelir.
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
    .slice(0, 70)
}

function titleFrom(text: string, number: number) {
  const re = new RegExp(
    String(number) + String.raw`\s*\.\s*TEMA\s*[:.]?\s*([^\d•►]{4,80})`,
    'i',
  )
  const m = text.match(re)
  return cleanTitle(m?.[1] || '') || `${number}. tema`
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
      best.set(number, {
        page: i + 1,
        title: titleFrom(text, number),
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
  const kinds = nums.map((p) => rawKind(pages[p - 1] || ''))

  const olcmeAt = kinds.findIndex((k) => k === 'olcme')

  let i = 0
  const kapak: number[] = []
  while (i < nums.length && kinds[i] === 'other') {
    kapak.push(nums[i])
    i++
  }
  const hazir: number[] = []
  while (i < nums.length && kinds[i] === 'hazir') {
    hazir.push(nums[i])
    i++
  }
  const basla: number[] = []
  while (i < nums.length && kinds[i] === 'basla') {
    basla.push(nums[i])
    i++
  }

  const giris: number[] = []
  const soru: number[] = []
  for (let j = i; j < nums.length; j++) {
    // İzleme/alıştırma ünite ortasında kalır; sadece ölçme bloğu sona alınır.
    if (olcmeAt >= 0 && j >= olcmeAt) soru.push(nums[j])
    else giris.push(nums[j])
  }

  const slides: DeckSlide[] = []
  const push = (list: number[], kind: PageKind) => {
    for (const page of list) {
      slides.push({ kind, page, label: KIND_LABEL[kind] })
    }
  }
  push(kapak, 'kapak')
  push(hazir, 'hazir')
  push(basla, 'basla')
  push(giris, 'giris')
  push(soru, 'soru')

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
