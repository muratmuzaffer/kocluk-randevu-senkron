import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentProxy,
} from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = workerSrc

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

function rawKind(text: string): 'hazir' | 'basla' | 'soru' | 'other' {
  if (isToc(text)) return 'other'
  const t = norm(text)
  const head = t.slice(0, 520)
  if (
    t.includes('ÖLÇME VE DEĞERLENDİRME') ||
    t.includes('OLCME VE DEGERLENDIRME') ||
    t.includes('ALIŞTIRMA SORULARI') ||
    t.includes('ALISTIRMA SORULARI') ||
    t.includes('İZLEME TESTİ') ||
    t.includes('IZLEME TESTI')
  ) {
    return 'soru'
  }
  if (head.includes('HAZIR MIYIZ')) return 'hazir'
  if (head.includes('BAŞLAYALIM') || head.includes('BASLAYALIM')) return 'basla'
  return 'other'
}

function cleanTitle(raw: string) {
  return raw
    .replace(/^[.:\-–—\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90)
}

export async function loadPdf(file: File): Promise<PDFDocumentProxy> {
  const data = await file.arrayBuffer()
  return getDocument({ data, disableAutoFetch: false }).promise
}

export async function extractPageTexts(
  pdf: PDFDocumentProxy,
  onProgress?: (done: number, total: number) => void,
): Promise<string[]> {
  const total = pdf.numPages
  const texts: string[] = []
  for (let i = 1; i <= total; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    texts.push(text)
    onProgress?.(i, total)
  }
  return texts
}

export function findUnits(pages: string[]): Unit[] {
  const hits: { page: number; number: number; title: string }[] = []
  for (let i = 0; i < pages.length; i++) {
    const text = pages[i]
    if (isToc(text)) continue
    const m = text.match(/(\d+)\s*\.\s*TEMA\s*[:.]?\s*([^\n]{0,90})/i)
    if (!m) continue
    const number = Number(m[1])
    let title = cleanTitle(m[2] || '')
    if (title.length < 6) {
      const lines = text
        .split(/\n/)
        .map((l) => l.trim())
        .filter(Boolean)
      const idx = lines.findIndex((l) => /TEMA/i.test(l))
      title = cleanTitle(
        lines
          .slice(Math.max(0, idx), idx + 5)
          .join(' ')
          .replace(/\d+\s*\.\s*TEMA/gi, ''),
      )
    }
    if (hits.some((h) => h.number === number)) continue
    hits.push({
      page: i + 1,
      number,
      title: title || `${number}. tema`,
    })
  }
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
  const kinds = nums.map((p) => rawKind(pages[p - 1]))

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

  const rest = nums.slice(i)
  const restKinds = kinds.slice(i)
  const giris: number[] = []
  const soru: number[] = []
  rest.forEach((p, idx) => {
    if (restKinds[idx] === 'soru') soru.push(p)
    else giris.push(p)
  })

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

export async function renderPageDataUrl(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  scale = 1.35,
): Promise<string> {
  const page = await pdf.getPage(pageNumber)
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas açılamadı.')
  await page.render({ canvasContext: ctx, viewport, canvas }).promise
  return canvas.toDataURL('image/jpeg', 0.84)
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
