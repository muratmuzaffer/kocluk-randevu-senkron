import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentProxy,
} from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

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

GlobalWorkerOptions.workerSrc = workerSrc

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
    const lines: { y: number; bits: { x: number; str: string }[] }[] = []
    for (const item of content.items) {
      if (!('str' in item) || !item.str) continue
      const x = item.transform[4]
      const y = Math.round(item.transform[5])
      const last = lines[lines.length - 1]
      if (last && Math.abs(last.y - y) <= 3) last.bits.push({ x, str: item.str })
      else lines.push({ y, bits: [{ x, str: item.str }] })
    }
    lines.sort((a, b) => b.y - a.y)
    const text = lines
      .map((line) =>
        line.bits
          .sort((a, b) => a.x - b.x)
          .map((b) => b.str)
          .join(' '),
      )
      .join('\n')
    texts.push(text)
    onProgress?.(i, total)
  }
  return texts
}

export async function renderPageDataUrl(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  scale = 1.35,
  cropBook = false,
): Promise<string> {
  const page = await pdf.getPage(pageNumber)
  const viewport = page.getViewport({ scale })
  const full = document.createElement('canvas')
  full.width = Math.floor(viewport.width)
  full.height = Math.floor(viewport.height)
  const ctx = full.getContext('2d')
  if (!ctx) throw new Error('Canvas açılamadı.')
  await page.render({ canvasContext: ctx, viewport, canvas: full }).promise
  if (!cropBook) return full.toDataURL('image/jpeg', 0.84)

  const [, , pw, ph] = page.view
  const x = Math.floor(viewport.width * (30 / pw))
  const y = Math.floor(viewport.height * (36 / ph))
  const w = Math.floor(viewport.width * ((524 - 30) / pw))
  const h = Math.floor(viewport.height * ((722 - 36) / ph))
  const cut = document.createElement('canvas')
  cut.width = Math.max(1, w)
  cut.height = Math.max(1, h)
  const cutCtx = cut.getContext('2d')
  if (!cutCtx) throw new Error('Canvas açılamadı.')
  cutCtx.drawImage(full, x, y, w, h, 0, 0, w, h)
  return cut.toDataURL('image/jpeg', 0.86)
}
