import PptxGenJS from 'pptxgenjs'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import {
  CANONICAL_TITLES,
  renderBandDataUrl,
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

function addCard(slide: PptxGenJS.Slide, item: DeckSlide, figureData?: string) {
  const hasChoices = item.choices.length > 0
  const hasBullets = item.bullets.length > 0
  const hasFigure = Boolean(figureData)
  const textX = hasFigure ? 10.2 : 0.55
  const textW = hasFigure ? 9.25 : 18.9
  let y = 1.12
  if (item.pill) {
    slide.addShape('roundRect', {
      x: textX,
      y,
      w: Math.min(4.6, 0.28 * item.pill.length + 1.4),
      h: 0.42,
      fill: { color: '5170FF' },
      line: { color: '5170FF' },
      rectRadius: 0.08,
    })
    slide.addText(item.pill, {
      x: textX,
      y,
      w: Math.min(4.6, 0.28 * item.pill.length + 1.4),
      h: 0.42,
      fontFace: 'Calibri',
      fontSize: 14,
      bold: true,
      color: 'FFFFFF',
      align: 'center',
      valign: 'middle',
      margin: 0,
    })
    y += 0.55
  }
  if (hasFigure && figureData) {
    slide.addImage({
      data: figureData,
      x: 0.45,
      y: 1.15,
      w: 9.4,
      h: 8.7,
      sizing: { type: 'contain', w: 9.4, h: 8.7 },
    })
  }
  if (item.prompt) {
    const promptSize = item.prompt.length > 220 ? 16 : item.prompt.length > 140 ? 20 : 24
    slide.addText(item.prompt, {
      x: textX,
      y,
      w: textW,
      h: hasChoices || hasBullets ? 2.6 : 8.5 - (y - 1.12),
      fontFace: 'Calibri',
      fontSize: promptSize,
      bold: true,
      color: '1A1A1A',
      valign: 'top',
      margin: 0,
    })
    y += hasChoices || hasBullets ? 2.75 : 0
  }
  if (hasBullets) {
    slide.addText(
      item.bullets.map((bit) => ({
        text: bit,
        options: {
          bullet: true,
          breakLine: true,
          fontFace: 'Calibri',
          fontSize: 22,
          bold: true,
          color: '1A1A1A',
        },
      })),
      {
        x: textX,
        y,
        w: textW,
        h: 8.9 - y,
        valign: 'top',
        paraSpaceAfter: 10,
      },
    )
    return
  }
  if (!hasChoices) return
  const colors = ['5170FF', '54A03A', 'ED7D31', '2E75B6']
  const cols = item.choices.length <= 3 || hasFigure ? 1 : 2
  const rows = Math.ceil(item.choices.length / cols)
  const gap = 0.18
  const boxW = cols === 1 ? textW : (textW - gap) / 2
  const boxH = Math.min(1.7, (8.95 - y - gap * (rows - 1)) / rows)
  item.choices.forEach((choice, i) => {
    const col = cols === 1 ? 0 : i % 2
    const row = cols === 1 ? i : Math.floor(i / 2)
    const x = textX + col * (boxW + gap)
    const cy = y + row * (boxH + gap)
    slide.addShape('roundRect', {
      x,
      y: cy,
      w: boxW,
      h: boxH,
      fill: { color: 'F7F9FC' },
      line: { color: colors[i % colors.length], width: 2.5 },
      rectRadius: 0.12,
    })
    slide.addText(choice, {
      x: x + 0.16,
      y: cy + 0.08,
      w: boxW - 0.32,
      h: boxH - 0.16,
      fontFace: 'Calibri',
      fontSize: choice.length > 70 ? 14 : 18,
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
      let figureData = ''
      if (
        item.figureTop != null &&
        item.figureBottom != null &&
        item.figureBottom - item.figureTop > 0.08
      ) {
        try {
          figureData = await renderBandDataUrl(
            pdf,
            item.page,
            item.figureTop,
            item.figureBottom,
          )
        } catch {
          figureData = ''
        }
      }
      addCard(slide, item, figureData)
    }
    onProgress?.(i + 1, total)
  }

  const end = pres.addSlide()
  addBackground(end, titleBg)
  addSectionTitle(end, unitTitle(deck))

  await pres.writeFile({ fileName: fileName(deck) })
}
