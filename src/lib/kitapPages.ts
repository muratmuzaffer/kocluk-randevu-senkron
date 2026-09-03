import PptxGenJS from 'pptxgenjs'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import {
  blendDeck,
  renderPageCrop,
  type Deck,
  type Unit,
} from './pdfSlides'
import { unitTitle } from './pptxFromPages'
import konuUrl from '../assets/matkeys/kitap-konu.png'
import uniteUrl from '../assets/matkeys/kitap-unite.png'

export { konuUrl, uniteUrl }

const W = 13.333
const H = 7.5
const NAVY = '1A428A'
const GREEN = '92D050'
const PAPER = 'FCFFFF'

export type KitapView =
  | { role: 'cover'; kicker: string; title: string }
  | { role: 'title'; title: string }
  | { role: 'page'; title: string; page: number }
  | { role: 'close'; title: string }

export function buildKitapDeck(unit: Unit, pages: Parameters<typeof blendDeck>[1]): Deck {
  return blendDeck(unit, pages)
}

export function kitapViews(deck: Deck): KitapView[] {
  const title = unitTitle(deck)
  const views: KitapView[] = [
    { role: 'cover', kicker: `${deck.unit.number}. TEMA`, title },
  ]
  for (const slide of deck.slides) {
    if (slide.face === 'title' || !slide.page) {
      views.push({ role: 'title', title: slide.heading })
    } else {
      views.push({ role: 'page', title: slide.heading, page: slide.page })
    }
  }
  views.push({ role: 'close', title })
  return views
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

function fileName(deck: Deck) {
  const title = unitTitle(deck)
    .replace(/[\\/:*?"<>|]+/g, '')
    .slice(0, 70)
  return `${deck.unit.number}.TEMA ${title || 'TEMA'}.pptx`
}

function addLogo(
  slide: PptxGenJS.Slide,
  x: number,
  y: number,
  w: number,
  keysColor: string,
) {
  slide.addText(
    [
      { text: 'Mat', options: { color: GREEN, bold: true } },
      { text: 'Keys', options: { color: keysColor, bold: true } },
    ],
    {
      x,
      y,
      w,
      h: 0.42,
      fontFace: 'Calibri',
      fontSize: 20,
      margin: 0,
      valign: 'middle',
    },
  )
}

function addChrome(slide: PptxGenJS.Slide, title: string) {
  slide.addShape('rect', {
    x: 0,
    y: 0,
    w: W,
    h: H,
    fill: { color: 'F7F8FB' },
    line: { color: 'F7F8FB' },
  })
  slide.addShape('rect', {
    x: 0,
    y: 0,
    w: W,
    h: 0.72,
    fill: { color: NAVY },
    line: { color: NAVY },
  })
  slide.addShape('rect', {
    x: 0,
    y: H - 0.48,
    w: W,
    h: 0.48,
    fill: { color: NAVY },
    line: { color: NAVY },
  })
  addLogo(slide, 0.28, 0.15, 2.4, 'FFFFFF')
  slide.addText(title.toLocaleUpperCase('tr-TR'), {
    x: 3.0,
    y: 0.12,
    w: 7.4,
    h: 0.48,
    fontFace: 'Calibri',
    fontSize: 20,
    bold: true,
    color: 'FFFFFF',
    align: 'center',
    valign: 'middle',
    margin: 0,
  })
  addLogo(slide, 10.6, H - 0.43, 2.4, 'FFFFFF')
}

export async function downloadKitapPptx(
  pdf: PDFDocumentProxy,
  deck: Deck,
  onProgress?: (done: number, total: number) => void,
) {
  const [unite, konu] = await Promise.all([urlToData(uniteUrl), urlToData(konuUrl)])
  const views = kitapViews(deck)
  const pres = new PptxGenJS()
  pres.defineLayout({ name: 'KITAP', width: W, height: H })
  pres.layout = 'KITAP'
  pres.title = `${deck.unit.number}. TEMA ${unitTitle(deck)}`
  pres.author = 'MatKeys'
  pres.subject = 'Tarık Can Erdoğan'

  for (let i = 0; i < views.length; i++) {
    const view = views[i]
    const slide = pres.addSlide()
    if (view.role === 'cover') {
      slide.addImage({ data: unite, x: 0, y: 0, w: W, h: H })
      slide.addText(view.kicker, {
        x: 2.6,
        y: 5.72,
        w: 8.1,
        h: 0.38,
        fontFace: 'Calibri',
        fontSize: 16,
        bold: true,
        color: NAVY,
        align: 'center',
        margin: 0,
      })
      slide.addText(view.title.toLocaleUpperCase('tr-TR'), {
        x: 2.2,
        y: 6.05,
        w: 8.9,
        h: 1.15,
        fontFace: 'Calibri',
        fontSize: view.title.length > 36 ? 16 : 22,
        bold: true,
        color: NAVY,
        align: 'center',
        valign: 'top',
        margin: 0,
      })
    } else if (view.role === 'title') {
      slide.addImage({ data: konu, x: 0, y: 0, w: W, h: H })
      slide.addShape('rect', {
        x: 7.15,
        y: 3.72,
        w: 4.55,
        h: 1.85,
        fill: { color: PAPER },
        line: { color: PAPER },
      })
      slide.addText(view.title.toLocaleUpperCase('tr-TR'), {
        x: 7.15,
        y: 3.72,
        w: 4.55,
        h: 1.85,
        fontFace: 'Calibri',
        fontSize: view.title.length > 22 ? 20 : 28,
        bold: true,
        color: '1F1F1F',
        align: 'center',
        valign: 'middle',
        margin: 0,
      })
    } else if (view.role === 'page') {
      addChrome(slide, view.title)
      const image = await renderPageCrop(pdf, view.page, 1.6, true)
      const box = { x: 0.28, y: 0.84, w: 12.77, h: 6.08 }
      const aspect = image.width / Math.max(image.height, 1)
      const boxAspect = box.w / box.h
      const w = aspect > boxAspect ? box.w : box.h * aspect
      const h = aspect > boxAspect ? box.w / aspect : box.h
      slide.addImage({
        data: image.data,
        x: box.x + (box.w - w) / 2,
        y: box.y + (box.h - h) / 2,
        w,
        h,
      })
    } else {
      addChrome(slide, 'KAPANIS')
      slide.addText(view.title.toLocaleUpperCase('tr-TR'), {
        x: 0.8,
        y: 2.6,
        w: 11.7,
        h: 2.0,
        fontFace: 'Calibri',
        fontSize: 28,
        bold: true,
        color: NAVY,
        align: 'center',
        valign: 'middle',
        margin: 0,
      })
    }
    onProgress?.(i + 1, views.length)
  }

  await pres.writeFile({ fileName: fileName(deck) })
}
