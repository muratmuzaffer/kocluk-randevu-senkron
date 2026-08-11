import * as XLSX from 'xlsx-js-style'
import type { WorkBook } from 'xlsx-js-style'

const KEY = 'kocsenkron-store-v1'

export type PersistedApp = {
  liveName: string
  koclukName: string
  liveB64: string | null
  koclukB64: string | null
  resultB64: string | null
  day: string
  view: 'takvim' | 'tablo'
  savedAt: string
}

function bytesToB64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function b64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function workbookToB64(workbook: WorkBook): string {
  const buffer = XLSX.write(workbook, {
    type: 'array',
    bookType: 'xlsx',
  }) as ArrayBuffer
  return bytesToB64(new Uint8Array(buffer))
}

export function b64ToWorkbook(b64: string): WorkBook {
  return XLSX.read(b64ToBytes(b64), {
    type: 'array',
    cellDates: true,
    raw: false,
  })
}

export function loadPersisted(): PersistedApp | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw) as PersistedApp
  } catch {
    return null
  }
}

export function savePersisted(data: PersistedApp) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // kota doluysa sessiz geç
  }
}
