import PptxGenJS from 'pptxgenjs'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { Deck, PageKind } from './pdfSlides'
import { renderPageDataUrl } from './pdfSlides'
import coverUrl from '../assets/matkeys/cover.jpg'
import titleUrl from '../assets/matkeys/title.png'
import contentUrl from '../assets/matkeys/content.jpg'

const W = 20
const H = 11.25

const HEADER: Record<PageKind, string> = {
  kapak: '',
  hazir: 'HAZIR MIYIZ?',
  basla: 'BAŞLAYALIM',
  giris: '',
  soru: 'ÖLÇME VE DEĞERLENDİRME SORULARI',
}

async function urlToData(url: string): Promise<string> {
  const res = await fetch(url)
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export { coverUrl, titleUrl, contentUrl }

export function unitTitle(deck: Deck) {
  return deck.unit.title.replace(/\s+/g, ' ').trim().toLocaleUpperCase('tr-TR')
}

export function headerTitle(deck: Deck, kind: PageKind) {
  return HEADER[kind] || unitTitle(deck)
}

function fileName(deck: Deck) {
  const title = unitTitle(deck)
    .replace(/[\\/:*?"<>|]+/g, '')
    .slice(0, 70)
  return `5.${deck.unit.number} ${title || 'TEMA'}.pptx`
}

function addBackground(slide: PptxGenJS.Slide, data: string) {
  slide.addImage({ data, x: 0, y: 0, w: W, h: H })
}

function addSectionTitle(slide: PptxGenJS.Slide, title: string) {
  const size = title.length > 42 ? 28 : title.length > 28 ? 36 : title.length > 16 ? 48 : 56
  slide.addText(title, {
    x: 8.2,
    y: 4.55,
    w: 11.4,
    h: 3.6,
    fontFace: 'Arial Black',
    fontSize: size,
    bold: true,
    color: '1A1A1A',
    align: 'center',
    valign: 'middle',
    margin: 0,
  })
}

function addHeaderLabel(slide: PptxGenJS.Slide, title: string) {
  const size = title.length > 42 ? 22 : title.length > 28 ? 28 : 32
  slide.addText(title, {
    x: 0,
    y: 0.12,
    w: 17.1,
    h: 0.72,
    fontFace: 'Arial Black',
    fontSize: size,
    bold: true,
    color: 'FFFFFF',
    align: 'center',
    valign: 'middle',
    margin: 0,
  })
}

export function previewLength(deck: Deck) {
  return deck.slides.length + 3
}

export function previewAt(deck: Deck, index: number) {
  const last = previewLength(deck) - 1
  if (index <= 0) return { role: 'cover' as const, label: 'MatKeys kapak' }
  if (index === 1) return { role: 'title' as const, label: 'Başlık' }
  if (index >= last) return { role: 'end' as const, label: 'Kapanış' }
  const slide = deck.slides[index - 2]
  if (!slide) return { role: 'end' as const, label: 'Kapanış' }
  return {
    role: 'content' as const,
    slide,
    label: slide.label,
  }
}

export async function downloadUnitPptx(
  pdf: PDFDocumentProxy,
  deck: Deck,
  onProgress?: (done: number, total: number) => void,
) {
  const [cover, titleBg, contentBg] = await Promise.all([
    urlToData(coverUrl),
    urlToData(titleUrl),
    urlToData(contentUrl),
  ])

  const pres = new PptxGenJS()
  pres.defineLayout({ name: 'MATKEYS', width: W, height: H })
  pres.layout = 'MATKEYS'
  pres.title = `5.${deck.unit.number} ${unitTitle(deck)}`
  pres.author = 'MatKeys'
  pres.subject = 'Tarık Can Erdoğan'

  const coverSlide = pres.addSlide()
  addBackground(coverSlide, cover)

  const titleSlide = pres.addSlide()
  addBackground(titleSlide, titleBg)
  addSectionTitle(titleSlide, unitTitle(deck))

  const total = deck.slides.length
  for (let i = 0; i < deck.slides.length; i++) {
    const item = deck.slides[i]
    const data = await renderPageDataUrl(pdf, item.page, 2.35, true)
    const slide = pres.addSlide()
    addBackground(slide, contentBg)
    addHeaderLabel(slide, headerTitle(deck, item.kind))
    slide.addImage({
      data,
      x: 0.32,
      y: 1.02,
      w: 19.36,
      h: 9.22,
      sizing: { type: 'contain', w: 19.36, h: 9.22 },
    })
    onProgress?.(i + 1, total)
  }

  const end = pres.addSlide()
  addBackground(end, titleBg)
  addSectionTitle(end, unitTitle(deck))

  await pres.writeFile({ fileName: fileName(deck) })
}
