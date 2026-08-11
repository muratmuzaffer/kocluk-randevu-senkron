import { cleanText, normalizeClass } from './names'

export type ClassTheme = {
  key: string
  label: string
  head: string
  bg: string
  border: string
  soft: string
}

const PALETTE: Omit<ClassTheme, 'key' | 'label'>[] = [
  { head: '#1d4ed8', bg: '#eff6ff', border: '#93c5fd', soft: '#dbeafe' },
  { head: '#0f766e', bg: '#f0fdfa', border: '#5eead4', soft: '#ccfbf1' },
  { head: '#b45309', bg: '#fffbeb', border: '#fcd34d', soft: '#fef3c7' },
  { head: '#7c3aed', bg: '#f5f3ff', border: '#c4b5fd', soft: '#ede9fe' },
  { head: '#be123c', bg: '#fff1f2', border: '#fda4af', soft: '#ffe4e6' },
  { head: '#0369a1', bg: '#f0f9ff', border: '#7dd3fc', soft: '#e0f2fe' },
  { head: '#4d7c0f', bg: '#f7fee7', border: '#bef264', soft: '#ecfccb' },
  { head: '#9f1239', bg: '#fff1f2', border: '#fb7185', soft: '#ffe4e6' },
  { head: '#6d28d9', bg: '#faf5ff', border: '#d8b4fe', soft: '#f3e8ff' },
  { head: '#0e7490', bg: '#ecfeff', border: '#67e8f9', soft: '#cffafe' },
]

export function classSortKey(sinif: string): [number, string] {
  const raw = cleanText(sinif)
  const match = raw.match(/(\d+)\s*[.\-]?\s*([A-Za-zÇĞİÖŞÜçğıöşü]+)/)
  if (!match) return [999, raw.toLocaleUpperCase('tr-TR')]
  return [Number(match[1]), match[2].toLocaleUpperCase('tr-TR')]
}

export function compareClass(a: string, b: string): number {
  const [ga, la] = classSortKey(a)
  const [gb, lb] = classSortKey(b)
  if (ga !== gb) return ga - gb
  return la.localeCompare(lb, 'tr')
}

export function themeForClass(sinif: string): ClassTheme {
  const label = cleanText(sinif) || 'Sınıfsız'
  const key = normalizeClass(label) || 'none'
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  }
  const tone = PALETTE[hash % PALETTE.length]
  return { key, label, ...tone }
}

export function sortByClassThenName<T extends { sinif: string; ad?: string; soyad?: string }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    const byClass = compareClass(a.sinif, b.sinif)
    if (byClass !== 0) return byClass
    const an = `${a.ad ?? ''} ${a.soyad ?? ''}`.trim()
    const bn = `${b.ad ?? ''} ${b.soyad ?? ''}`.trim()
    return an.localeCompare(bn, 'tr')
  })
}

/** Excel ARGB (AARRGGBB) */
export function excelRgb(hex: string): string {
  return `FF${hex.replace('#', '').toUpperCase()}`
}
