export function cleanText(value: unknown): string {
  if (value == null) return ''
  return String(value).replace(/\s+/g, ' ').trim()
}

export function normalizeName(value: unknown): string {
  return cleanText(value).toLocaleLowerCase('tr-TR')
}

/** Diyakritiksiz karşılaştırma: ARMUTÇU ≈ ARMUTCU */
export function foldName(value: unknown): string {
  return normalizeName(value)
    .replaceAll('ğ', 'g')
    .replaceAll('ü', 'u')
    .replaceAll('ş', 's')
    .replaceAll('ı', 'i')
    .replaceAll('ö', 'o')
    .replaceAll('ç', 'c')
}

export function fullNameKey(ad: unknown, soyad: unknown): string {
  return normalizeName(`${cleanText(ad)} ${cleanText(soyad)}`)
}

export function fullNameFold(ad: unknown, soyad: unknown): string {
  return foldName(`${cleanText(ad)} ${cleanText(soyad)}`)
}

export function normalizeClass(value: unknown): string {
  return cleanText(value)
    .toLocaleUpperCase('tr-TR')
    .replaceAll('-', '.')
    .replaceAll(' ', '')
}
