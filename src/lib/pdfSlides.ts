import './mathSumPrecise'
import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentProxy,
} from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerSrc from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import { tidyBook, type PageLine, type PageModel } from './bookCards'

export type {
  Deck,
  DeckSlide,
  PageKind,
  Unit,
} from './pdfOutline'
export {
  blendDeck,
  CANONICAL_TITLES,
  findUnits,
  kindCounts,
} from './pdfOutline'
export type { PageModel, PageLine } from './bookCards'

GlobalWorkerOptions.workerSrc = workerSrc

const VIEW_PAD_X = 0.04
const VIEW_PAD_TOP = 0.045
const VIEW_PAD_BOT = 0.055

function joinBits(bits: { x: number; str: string; width: number }[]) {
  const ordered = [...bits].sort((a, b) => a.x - b.x)
  let s = ''
  let end = 0
  for (const b of ordered) {
    const t = b.str
    if (!s) {
      s = t
      end = b.x + b.width
      continue
    }
    const gap = b.x - end
    if ((s.endsWith('-') || s.endsWith('‐')) && /^[a-zçğıöşüı]/i.test(t)) {
      s = s.replace(/[-‐]$/, '') + t
    } else if (t === '-' || t === '‐') {
      s += '-'
    } else if (gap < 1.5) {
      s += t
    } else {
      s += ' ' + t
    }
    end = b.x + b.width
  }
  return tidyBook(s)
}

function mergeHyphen(lines: PageLine[]) {
  const out: PageLine[] = []
  for (const line of lines) {
    const prev = out[out.length - 1]
    if (
      prev &&
      /[A-Za-zÇĞİÖŞÜçğıöşüıI]-$/.test(prev.text) &&
      /^[a-zçğıöşüı]/.test(line.text)
    ) {
      prev.text = prev.text.replace(/-$/, '') + line.text
      continue
    }
    out.push({ ...line })
  }
  return out
}

export async function loadPdf(file: File): Promise<PDFDocumentProxy> {
  const data = await file.arrayBuffer()
  return getDocument({ data, disableAutoFetch: false }).promise
}

export async function extractPageModels(
  pdf: PDFDocumentProxy,
  onProgress?: (done: number, total: number) => void,
): Promise<PageModel[]> {
  const total = pdf.numPages
  const models: PageModel[] = []
  for (let i = 1; i <= total; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 1 })
    const [, , width, height] = page.view
    const content = await page.getTextContent()
    const rows: { y: number; h: number; bits: { x: number; str: string; width: number }[] }[] = []
    for (const item of content.items) {
      if (!('str' in item) || !item.str) continue
      const x = item.transform[4]
      const y = item.transform[5]
      const h = Math.abs(item.height || item.transform[3] || 10)
      const w = item.width || 0
      const last = rows[rows.length - 1]
      if (last && Math.abs(last.y - y) <= Math.max(3, h * 0.35)) {
        last.bits.push({ x, str: item.str, width: w })
        last.h = Math.max(last.h, h)
      } else {
        rows.push({ y, h, bits: [{ x, str: item.str, width: w }] })
      }
    }
    rows.sort((a, b) => b.y - a.y)
    const lines = mergeHyphen(
      rows.map((row) => {
        const x = Math.min(...row.bits.map((b) => b.x))
        const [, y0] = viewport.convertToViewportPoint(x, row.y)
        const [, y1] = viewport.convertToViewportPoint(x, row.y + row.h)
        const topPx = Math.min(y0, y1)
        const botPx = Math.max(y0, y1)
        return {
          text: joinBits(row.bits),
          x,
          y: row.y,
          h: row.h,
          top: topPx / viewport.height,
          bot: botPx / viewport.height,
        }
      }),
    ).filter((l) => l.text)
    models.push({
      text: lines.map((l) => l.text).join('\n'),
      lines,
      width,
      height,
    })
    onProgress?.(i, total)
  }
  return models
}

export async function extractPageTexts(
  pdf: PDFDocumentProxy,
  onProgress?: (done: number, total: number) => void,
): Promise<string[]> {
  const models = await extractPageModels(pdf, onProgress)
  return models.map((m) => m.text)
}

async function renderFull(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  scale: number,
) {
  const page = await pdf.getPage(pageNumber)
  const viewport = page.getViewport({ scale })
  const full = document.createElement('canvas')
  full.width = Math.floor(viewport.width)
  full.height = Math.floor(viewport.height)
  const ctx = full.getContext('2d')
  if (!ctx) throw new Error('Canvas açılamadı.')
  await page.render({ canvasContext: ctx, viewport, canvas: full }).promise
  return { page, viewport, full }
}

export type CropImage = {
  data: string
  width: number
  height: number
}

function copyPixels(
  full: HTMLCanvasElement,
  x: number,
  y: number,
  w: number,
  h: number,
  quality: number,
): CropImage {
  const sx = Math.max(0, Math.floor(x))
  const sy = Math.max(0, Math.floor(y))
  const sw = Math.max(1, Math.min(Math.floor(w), full.width - sx))
  const sh = Math.max(1, Math.min(Math.floor(h), full.height - sy))
  const cut = document.createElement('canvas')
  cut.width = sw
  cut.height = sh
  const cutCtx = cut.getContext('2d')
  if (!cutCtx) throw new Error('Canvas açılamadı.')
  cutCtx.drawImage(full, sx, sy, sw, sh, 0, 0, sw, sh)
  return { data: cut.toDataURL('image/jpeg', quality), width: sw, height: sh }
}

export async function renderPageCrop(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  scale = 1.35,
  cropBook = false,
): Promise<CropImage> {
  const { viewport, full } = await renderFull(pdf, pageNumber, scale)
  if (!cropBook) {
    return {
      data: full.toDataURL('image/jpeg', 0.84),
      width: full.width,
      height: full.height,
    }
  }
  return copyPixels(
    full,
    viewport.width * VIEW_PAD_X,
    viewport.height * VIEW_PAD_TOP,
    viewport.width * (1 - VIEW_PAD_X * 2),
    viewport.height * (1 - VIEW_PAD_TOP - VIEW_PAD_BOT),
    0.88,
  )
}

export async function renderPageDataUrl(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  scale = 1.35,
  cropBook = false,
): Promise<string> {
  return (await renderPageCrop(pdf, pageNumber, scale, cropBook)).data
}

export async function renderBandCrop(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  top: number,
  bottom: number,
  scale = 1.7,
): Promise<CropImage> {
  const { viewport, full } = await renderFull(pdf, pageNumber, scale)
  let t = Number.isFinite(top) ? top : VIEW_PAD_TOP
  let b = Number.isFinite(bottom) ? bottom : 1 - VIEW_PAD_BOT
  t = Math.max(VIEW_PAD_TOP, Math.min(0.88, t))
  b = Math.min(1 - VIEW_PAD_BOT, Math.max(t + 0.08, b))
  return copyPixels(
    full,
    viewport.width * VIEW_PAD_X,
    viewport.height * t,
    viewport.width * (1 - VIEW_PAD_X * 2),
    viewport.height * (b - t),
    0.88,
  )
}

export async function renderBandDataUrl(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  top: number,
  bottom: number,
  scale = 1.7,
): Promise<string> {
  return (await renderBandCrop(pdf, pageNumber, top, bottom, scale)).data
}
