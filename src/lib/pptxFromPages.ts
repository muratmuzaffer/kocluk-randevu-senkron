import PptxGenJS from 'pptxgenjs'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { Deck } from './pdfSlides'
import { renderPageDataUrl } from './pdfSlides'

function slug(text: string) {
  return text
    .toLocaleLowerCase('tr-TR')
    .replace(/[^a-z0-9çğıöşü\s-]+/gi, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60)
}

export async function downloadUnitPptx(
  pdf: PDFDocumentProxy,
  deck: Deck,
  onProgress?: (done: number, total: number) => void,
) {
  const pres = new PptxGenJS()
  pres.defineLayout({ name: 'WIDE', width: 13.333, height: 7.5 })
  pres.layout = 'WIDE'
  pres.title = `${deck.unit.number}. tema · ${deck.unit.title}`
  pres.author = 'Tarık Can Erdoğan'

  const box = { x: 0.28, y: 0.72, w: 12.77, h: 6.48 }
  const total = deck.slides.length

  for (let i = 0; i < deck.slides.length; i++) {
    const item = deck.slides[i]
    const data = await renderPageDataUrl(pdf, item.page, 1.55)
    const slide = pres.addSlide()
    slide.addShape('rect', {
      x: 0,
      y: 0,
      w: 13.333,
      h: 0.58,
      fill: { color: '217346' },
    })
    slide.addText(item.label.toLocaleUpperCase('tr-TR'), {
      x: 0.28,
      y: 0.08,
      w: 9.2,
      h: 0.42,
      fontFace: 'Calibri',
      fontSize: 16,
      bold: true,
      color: 'FFFFFF',
      margin: 0,
    })
    slide.addText(`s. ${item.page}`, {
      x: 10.4,
      y: 0.08,
      w: 2.6,
      h: 0.42,
      fontFace: 'Calibri',
      fontSize: 14,
      align: 'right',
      color: 'D7E8DC',
      margin: 0,
    })
    slide.addImage({
      data,
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      sizing: { type: 'contain', w: box.w, h: box.h },
    })
    onProgress?.(i + 1, total)
  }

  const name = `${deck.unit.number}-tema-${slug(deck.unit.title) || 'unite'}.pptx`
  await pres.writeFile({ fileName: name })
}
