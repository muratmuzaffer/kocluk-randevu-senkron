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
export { blendDeck, findUnits, kindCounts } from './pdfOutline'

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
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    texts.push(text)
    onProgress?.(i, total)
  }
  return texts
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
