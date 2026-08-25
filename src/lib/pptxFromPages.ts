import PptxGenJS from 'pptxgenjs'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { choiceBits, stepBits } from './bookCards'
import {
  CANONICAL_TITLES,
  renderBandCrop,
  renderPageCrop,
  type CropImage,
  type Deck,
  type DeckSlide,
} from './pdfSlides'
import coverUrl from '../assets/matkeys/cover.jpg'
import titleUrl from '../assets/matkeys/title.png'
import contentUrl from '../assets/matkeys/content.jpg'

const W = 20
const H = 11.25

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
  const raw = deck.unit.title.replace(/\s+/g, ' ').trim().toLocaleUpperCase('tr-TR')
  if (/KAREKODU|ÖZET İÇERİĞE|OZET ICERIGE|BU TEMADA/i.test(raw) || raw.length < 8) {
    return CANONICAL_TITLES[deck.unit.number] || `${deck.unit.number}. TEMA`
  }
  return raw
}

export function headerTitle(_deck: Deck, slide: DeckSlide) {
  return slide.heading
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
  const size = title.length > 28 ? 36 : title.length > 16 ? 48 : 56
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

function fitContain(
  box: { x: number; y: number; w: number; h: number },
  image: CropImage,
) {
  if (!image.width || !image.height) return box
  const aspect = image.width / image.height
  const boxAspect = box.w / box.h
  const w = aspect > boxAspect ? box.w : box.h * aspect
  const h = aspect > boxAspect ? box.w / aspect : box.h
  return {
    x: box.x + (box.w - w) / 2,
    y: box.y + (box.h - h) / 2,
    w,
    h,
  }
}

function addFittedImage(slide: PptxGenJS.Slide, image: CropImage, box: { x: number; y: number; w: number; h: number }) {
  const fit = fitContain(box, image)
  slide.addImage({
    data: image.data,
    x: fit.x,
    y: fit.y,
    w: fit.w,
    h: fit.h,
  })
}

const WELL = { x: 0.39, y: 0.99, w: 19.22, h: 9.55 }

function addCard(slide: PptxGenJS.Slide, item: DeckSlide, figure?: CropImage, figure2?: CropImage) {
  const pair = Boolean(figure && figure2)
  if ((item.layout === 'crop' || (!item.prompt && !item.choices.length)) && figure) {
    if (pair && figure2) {
      addFittedImage(slide, figure, { x: 0.39, y: 0.99, w: 9.5, h: 9.55 })
      addFittedImage(slide, figure2, { x: 10.11, y: 0.99, w: 9.5, h: 9.55 })
      return
    }
    addFittedImage(slide, figure, WELL)
    return
  }
  const figureData = figure?.data
  const hasFigure = Boolean(figureData)
  const hero = item.figureRole === 'hero' || item.layout === 'math'
  const layout = item.layout || (item.choices.length ? 'mcq' : item.parts.length ? 'open' : item.bullets.length ? 'steps' : item.pill ? 'example' : 'prose')

  if (hero && hasFigure && figureData) {
    if (item.prompt) {
      slide.addText(item.prompt, {
        x: 0.55,
        y: 1.12,
        w: 18.9,
        h: 1.45,
        fontFace: 'Calibri',
        fontSize: item.prompt.length > 160 ? 16 : 20,
        bold: true,
        color: '1A1A1A',
        valign: 'top',
        margin: 0,
      })
    }
    if (figure) {
      addFittedImage(slide, figure, {
        x: 2.4,
        y: item.prompt ? 2.7 : 1.35,
        w: 15.2,
        h: item.prompt ? 7.15 : 8.5,
      })
    }
    return
  }

  if (layout === 'math' && !hasFigure && item.prompt) {
    slide.addText(item.prompt, {
      x: 0.8,
      y: 2.8,
      w: 18.4,
      h: 5.6,
      fontFace: 'Cambria Math',
      fontSize: item.prompt.length > 60 ? 28 : 40,
      bold: true,
      color: '1A1A1A',
      align: 'center',
      valign: 'middle',
      margin: 0,
    })
    return
  }

  const textX = hasFigure ? 10.2 : 0.55
  const textW = hasFigure ? 9.25 : 18.9
  let y = 1.12

  if (figure) {
    addFittedImage(slide, figure, { x: 0.45, y: 1.15, w: 9.4, h: 8.7 })
  }

  if (item.pill) {
    const green = /etkinlik/i.test(item.pill)
    slide.addShape('roundRect', {
      x: textX,
      y,
      w: Math.min(5.2, 0.28 * item.pill.length + 1.5),
      h: 0.44,
      fill: { color: green ? '54A03A' : '5170FF' },
      line: { color: green ? '54A03A' : '5170FF' },
      rectRadius: 0.08,
    })
    slide.addText(item.pill, {
      x: textX,
      y,
      w: Math.min(5.2, 0.28 * item.pill.length + 1.5),
      h: 0.44,
      fontFace: 'Calibri',
      fontSize: 14,
      bold: true,
      color: 'FFFFFF',
      align: 'center',
      valign: 'middle',
      margin: 0,
    })
    y += 0.58
  }

  if (layout === 'steps' && item.bullets.length) {
    const cols = item.bullets.length > 2 ? 2 : 1
    const rows = Math.ceil(item.bullets.length / cols)
    const gap = 0.2
    const boxW = cols === 1 ? textW : (textW - gap) / 2
    const boxH = Math.min(3.4, (8.95 - y - gap * (rows - 1)) / rows)
    item.bullets.forEach((bit, i) => {
      const col = cols === 1 ? 0 : i % 2
      const row = cols === 1 ? i : Math.floor(i / 2)
      const x = textX + col * (boxW + gap)
      const cy = y + row * (boxH + gap)
      const { head, body } = stepBits(bit)
      slide.addShape('roundRect', {
        x,
        y: cy,
        w: boxW,
        h: boxH,
        fill: { color: 'F3F7F1' },
        line: { color: '54A03A', width: 2 },
        rectRadius: 0.12,
      })
      slide.addText(head || `${i + 1}. Adım`, {
        x: x + 0.22,
        y: cy + 0.18,
        w: boxW - 0.44,
        h: 0.45,
        fontFace: 'Calibri',
        fontSize: 16,
        bold: true,
        color: '54A03A',
        margin: 0,
      })
      slide.addText(body, {
        x: x + 0.22,
        y: cy + 0.68,
        w: boxW - 0.44,
        h: boxH - 0.9,
        fontFace: 'Calibri',
        fontSize: body.length > 80 ? 16 : 20,
        bold: true,
        color: '1A1A1A',
        valign: 'top',
        margin: 0,
      })
    })
    return
  }

  if (item.prompt) {
    const promptSize = item.prompt.length > 220 ? 16 : item.prompt.length > 140 ? 20 : 24
    const rest = layout === 'mcq' || layout === 'open' || item.bullets.length
    slide.addText(item.prompt, {
      x: textX,
      y,
      w: textW,
      h: rest ? 2.35 : 8.5 - (y - 1.12),
      fontFace: 'Calibri',
      fontSize: promptSize,
      bold: true,
      color: '1A1A1A',
      valign: 'top',
      margin: 0,
    })
    y += rest ? 2.5 : 0
  }

  if (layout === 'open' && item.parts.length) {
    const boxH = Math.min(1.85, (8.95 - y) / item.parts.length)
    item.parts.forEach((part, i) => {
      const { letter, text } = choiceBits(part)
      const cy = y + i * (boxH + 0.12)
      slide.addShape('ellipse', {
        x: textX,
        y: cy + 0.12,
        w: 0.55,
        h: 0.55,
        fill: { color: '1B3A6B' },
        line: { color: '1B3A6B' },
      })
      slide.addText(letter || String.fromCharCode(97 + i), {
        x: textX,
        y: cy + 0.12,
        w: 0.55,
        h: 0.55,
        fontFace: 'Calibri',
        fontSize: 16,
        bold: true,
        color: 'FFFFFF',
        align: 'center',
        valign: 'middle',
        margin: 0,
      })
      slide.addText(text || part, {
        x: textX + 0.72,
        y: cy,
        w: textW - 0.72,
        h: boxH,
        fontFace: 'Calibri',
        fontSize: (text || part).length > 90 ? 15 : 18,
        bold: true,
        color: '1A1A1A',
        valign: 'middle',
        margin: 0,
      })
    })
    return
  }

  if (layout !== 'mcq' || !item.choices.length) return

  const colors = ['5170FF', '54A03A', 'ED7D31', '2E75B6']
  const long = item.choices.some((c) => c.length > 42)
  const cols = long || item.choices.length <= 3 || hasFigure ? 1 : 2
  const rows = Math.ceil(item.choices.length / cols)
  const gap = 0.18
  const boxW = cols === 1 ? textW : (textW - gap) / 2
  const boxH = Math.min(1.7, (8.95 - y - gap * (rows - 1)) / rows)
  item.choices.forEach((choice, i) => {
    const col = cols === 1 ? 0 : i % 2
    const row = cols === 1 ? i : Math.floor(i / 2)
    const x = textX + col * (boxW + gap)
    const cy = y + row * (boxH + gap)
    const { letter, text } = choiceBits(choice)
    slide.addShape('roundRect', {
      x,
      y: cy,
      w: boxW,
      h: boxH,
      fill: { color: 'F7F9FC' },
      line: { color: colors[i % colors.length], width: 2.5 },
      rectRadius: 0.12,
    })
    if (letter) {
      slide.addShape('ellipse', {
        x: x + 0.16,
        y: cy + (boxH - 0.5) / 2,
        w: 0.5,
        h: 0.5,
        fill: { color: colors[i % colors.length] },
        line: { color: colors[i % colors.length] },
      })
      slide.addText(letter, {
        x: x + 0.16,
        y: cy + (boxH - 0.5) / 2,
        w: 0.5,
        h: 0.5,
        fontFace: 'Calibri',
        fontSize: 16,
        bold: true,
        color: 'FFFFFF',
        align: 'center',
        valign: 'middle',
        margin: 0,
      })
    }
    slide.addText(text || choice, {
      x: x + (letter ? 0.78 : 0.18),
      y: cy + 0.08,
      w: boxW - (letter ? 0.96 : 0.36),
      h: boxH - 0.16,
      fontFace: 'Calibri',
      fontSize: (text || choice).length > 70 ? 14 : 18,
      bold: true,
      color: '1A1A1A',
      valign: 'middle',
      margin: 0,
    })
  })
}

function addHeaderLabel(slide: PptxGenJS.Slide, title: string) {
  const size = title.length > 28 ? 26 : 32
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
  if (index === 1) return { role: 'title' as const, label: 'Başlık', heading: unitTitle(deck) }
  if (index >= last) return { role: 'end' as const, label: 'Kapanış', heading: unitTitle(deck) }
  const slide = deck.slides[index - 2]
  if (!slide) return { role: 'end' as const, label: 'Kapanış', heading: unitTitle(deck) }
  if (slide.face === 'title') {
    return {
      role: 'section' as const,
      slide,
      label: slide.heading,
      heading: slide.heading,
    }
  }
  return {
    role: 'content' as const,
    slide,
    label: slide.label,
    heading: slide.heading,
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
    const slide = pres.addSlide()
    if (item.face === 'title') {
      addBackground(slide, titleBg)
      addSectionTitle(slide, item.heading)
    } else {
      addBackground(slide, contentBg)
      addHeaderLabel(slide, headerTitle(deck, item))
      let figure: CropImage | undefined
      let figure2: CropImage | undefined
      if (item.figureTop != null && item.figureBottom != null) {
        try {
          figure = await renderBandCrop(
            pdf,
            item.page,
            item.figureTop,
            item.figureBottom,
            1.9,
          )
        } catch {
          figure = await renderPageCrop(pdf, item.page, 1.35, true)
        }
      }
      if (item.figureTop2 != null && item.figureBottom2 != null) {
        try {
          figure2 = await renderBandCrop(
            pdf,
            item.page2 || item.page,
            item.figureTop2,
            item.figureBottom2,
            1.9,
          )
        } catch {
          figure2 = await renderPageCrop(pdf, item.page2 || item.page, 1.35, true)
        }
      }
      addCard(slide, item, figure, figure2)
    }
    onProgress?.(i + 1, total)
  }

  const end = pres.addSlide()
  addBackground(end, titleBg)
  addSectionTitle(end, unitTitle(deck))

  await pres.writeFile({ fileName: fileName(deck) })
}
