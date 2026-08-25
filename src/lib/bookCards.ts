export type BookCard = {
  prompt: string
  choices: string[]
}

function fold(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .toLocaleUpperCase('tr-TR')
    .replaceAll('İ', 'I')
    .replaceAll('Ş', 'S')
    .replaceAll('Ğ', 'G')
    .replaceAll('Ü', 'U')
    .replaceAll('Ö', 'O')
    .replaceAll('Ç', 'C')
}

export function tidyBook(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

export function stripBookChrome(text: string) {
  return text
    .replace(/KAREKODU[\s\S]{0,90}?(ULAŞABİLİRSİNİZ|ULASABILIRSINIZ)\.?/gi, ' ')
    .replace(/BU TEMADA[\s\S]{0,240}?beklenmektedir\.?/gi, ' ')
    .replace(/ANAHTAR KAVRAM(LAR)?/gi, ' ')
    .replace(/\d+\s*\.\s*TEMA/gi, ' ')
    .replace(/\bHAZIR MIYIZ\??/gi, ' ')
    .replace(/\bBAŞLAYALIM\b/gi, ' ')
    .replace(/ÖLÇME VE DEĞERLENDİRME SORULARI/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function looksLikeQuestion(text: string) {
  const t = fold(text)
  return (
    /[?]/.test(text) ||
    t.includes('HANGISI') ||
    t.includes('BULUNUZ') ||
    t.includes('YAZINIZ') ||
    t.includes('ISARETLEYINIZ') ||
    t.includes('CEVAPLAYINIZ') ||
    t.includes('KACTIR') ||
    t.includes('NEDIR') ||
    /[A-D]\s*\)/.test(text)
  )
}

function splitNumbered(text: string) {
  const re = /(?:^|\s)(\d{1,2})\s*([.)])\s+/g
  const hits: { index: number; num: string }[] = []
  for (const m of text.matchAll(re)) {
    const after = text.slice(m.index! + m[0].length, m.index! + m[0].length + 12)
    if (/^(adım|tema)\b/i.test(after)) continue
    hits.push({ index: m.index!, num: m[1] })
  }
  if (hits.length === 0) return [text]
  const chunks: string[] = []
  if (hits[0].index > 0) {
    const lead = text.slice(0, hits[0].index).trim()
    if (lead.length > 24 && looksLikeQuestion(lead)) chunks.push(lead)
  }
  for (let i = 0; i < hits.length; i++) {
    const start = hits[i].index
    const end = i + 1 < hits.length ? hits[i + 1].index : text.length
    chunks.push(text.slice(start, end).trim())
  }
  return chunks.filter(Boolean)
}

function splitExamples(text: string) {
  const re = /(?=(?:Örnek|Etkinlik)\s*\d+)/gi
  const parts = text.split(re).map((p) => p.trim()).filter((p) => p.length > 18)
  return parts.length > 1 ? parts : [text]
}

function letteredChoices(text: string) {
  const re = /(?:^|\s)([A-Da-d])\s*[)]\s+/g
  const hits: { index: number; letter: string }[] = []
  for (const m of text.matchAll(re)) {
    hits.push({ index: m.index!, letter: m[1].toUpperCase() })
  }
  if (hits.length < 2) return { prompt: tidyBook(text), choices: [] as string[] }
  const letters = hits.map((h) => h.letter).join('')
  const sequential = /^(ABCD|ABC|AB|abcd|abc|ab)/i.test(letters)
  if (!sequential) return { prompt: tidyBook(text), choices: [] as string[] }

  const prompt = tidyBook(text.slice(0, hits[0].index))
  const choices: string[] = []
  for (let i = 0; i < hits.length; i++) {
    const start = hits[i].index
    const end = i + 1 < hits.length ? hits[i + 1].index : text.length
    const bit = tidyBook(text.slice(start, end))
    if (bit) choices.push(bit)
  }
  return { prompt, choices }
}

export function parseCards(raw: string): BookCard[] {
  const text = stripBookChrome(raw)
  if (text.length < 18) return []

  const cards: BookCard[] = []
  const numbered = splitNumbered(text)
  const blocks = numbered.length > 1 ? numbered : splitExamples(text)

  for (const block of blocks) {
    const { prompt, choices } = letteredChoices(block)
    const stem = prompt || tidyBook(block)
    if (stem.length < 12 && choices.length === 0) continue
    cards.push({
      prompt: stem,
      choices,
    })
  }

  if (cards.length === 0 && text.length >= 24) {
    cards.push({ prompt: tidyBook(text), choices: [] })
  }

  return cards.filter((c) => c.prompt.length >= 12 || c.choices.length >= 2)
}

export function isQuestionCard(card: BookCard) {
  return card.choices.length >= 2 || looksLikeQuestion(card.prompt)
}
