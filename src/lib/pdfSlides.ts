import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentProxy,
} from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
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

const BOOK_CROP = { x0: 24, y0: 30, x1: 572, y1: 738 }

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
      rows.map((row) => ({
        text: joinBits(row.bits),
        x: Math.min(...row.bits.map((b) => b.x)),
        y: row.y,
        h: row.h,
      })),
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

export async function renderPageDataUrl(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  scale = 1.35,
  cropBook = false,
): Promise<string> {
  const { page, viewport, full } = await renderFull(pdf, pageNumber, scale)
  if (!cropBook) return full.toDataURL('image/jpeg', 0.84)
  const [, , pw, ph] = page.view
  const x = Math.floor(viewport.width * (BOOK_CROP.x0 / pw))
  const y = Math.floor(viewport.height * (BOOK_CROP.y0 / ph))
  const w = Math.floor(viewport.width * ((BOOK_CROP.x1 - BOOK_CROP.x0) / pw))
  const h = Math.floor(viewport.height * ((BOOK_CROP.y1 - BOOK_CROP.y0) / ph))
  const cut = document.createElement('canvas')
  cut.width = Math.max(1, w)
  cut.height = Math.max(1, h)
  const cutCtx = cut.getContext('2d')
  if (!cutCtx) throw new Error('Canvas açılamadı.')
  cutCtx.drawImage(full, x, y, w, h, 0, 0, w, h)
  return cut.toDataURL('image/jpeg', 0.86)
}

export async function renderBandDataUrl(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  top: number,
  bottom: number,
  scale = 2.15,
): Promise<string> {
  const { page, viewport, full } = await renderFull(pdf, pageNumber, scale)
  const [, , , ph] = page.view
  const pad = 0.012
  const t = Math.max(0.02, top - pad)
  const b = Math.min(0.98, bottom + pad)
  const yPdfTop = ph * (1 - t)
  const yPdfBot = ph * (1 - b)
  const [x0] = viewport.convertToViewportPoint(BOOK_CROP.x0, yPdfTop)
  const [x1] = viewport.convertToViewportPoint(BOOK_CROP.x1, yPdfTop)
  const [, yA] = viewport.convertToViewportPoint(BOOK_CROP.x0, yPdfTop)
  const [, yB] = viewport.convertToViewportPoint(BOOK_CROP.x0, yPdfBot)
  const x = Math.max(0, Math.floor(Math.min(x0, x1)))
  const w = Math.max(8, Math.floor(Math.abs(x1 - x0)))
  const y = Math.max(0, Math.floor(Math.min(yA, yB)))
  const h = Math.max(8, Math.floor(Math.abs(yA - yB)))
  const cut = document.createElement('canvas')
  cut.width = w
  cut.height = h
  const cutCtx = cut.getContext('2d')
  if (!cutCtx) throw new Error('Canvas açılamadı.')
  cutCtx.drawImage(full, x, y, Math.min(w, full.width - x), Math.min(h, full.height - y), 0, 0, w, h)
  return cut.toDataURL('image/jpeg', 0.9)
}
