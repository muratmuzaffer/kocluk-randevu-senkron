import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { WorkBook } from 'xlsx-js-style'
import {
  compareClass,
  sortByClassThenName,
  themeForClass,
} from './lib/classes'
import { go } from './lib/nav'
import {
  detectKoclukFile,
  detectLiveFile,
  downloadWorkbook,
  readWorkbook,
  syncMatkeys,
  type MatkeysSyncResult,
} from './lib/matkeys'
import {
  b64ToWorkbook,
  loadPersisted,
  savePersisted,
  workbookToB64,
} from './lib/persist'
import {
  DAY_ORDER,
  fullName,
  parseAppointments,
  type Appointment,
  type DayName,
} from './lib/schedule'
import './App.css'

type SlotItem = {
  time: string
  raw: string
  label: string
  timeMinutes: number
  appointment: Appointment
}

function App() {
  const [hydrated, setHydrated] = useState(false)
  const [showFiles, setShowFiles] = useState(false)
  const [liveName, setLiveName] = useState('')
  const [koclukName, setKoclukName] = useState('')
  const [liveBook, setLiveBook] = useState<WorkBook | null>(null)
  const [koclukBook, setKoclukBook] = useState<WorkBook | null>(null)
  const [result, setResult] = useState<MatkeysSyncResult | null>(null)
  const [error, setError] = useState('')
  const [day, setDay] = useState<DayName>('Pazartesi')
  const [query, setQuery] = useState('')
  const [classFilter, setClassFilter] = useState('all')
  const [savedAt, setSavedAt] = useState('')
  const [flash, setFlash] = useState('')

  useEffect(() => {
    const saved = loadPersisted()
    if (!saved) {
      setHydrated(true)
      setShowFiles(true)
      return
    }
    try {
      if (saved.liveB64) setLiveBook(b64ToWorkbook(saved.liveB64))
      if (saved.koclukB64) setKoclukBook(b64ToWorkbook(saved.koclukB64))
      if (saved.resultB64) {
        setResult({
          workbook: b64ToWorkbook(saved.resultB64),
          changes: [],
          summary: {
            liveCount: 0,
            kept: 0,
            updated: 0,
            removed: 0,
            added: 0,
            unplaced: 0,
            emptySlots: 0,
          },
          previewRows: [],
        })
      }
      setLiveName(saved.liveName || '')
      setKoclukName(saved.koclukName || '')
      if (DAY_ORDER.includes(saved.day as DayName)) setDay(saved.day as DayName)
      setSavedAt(saved.savedAt || '')
      setShowFiles(!(saved.koclukB64 || saved.resultB64))
    } catch {
      setShowFiles(true)
    } finally {
      setHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    const stamp = new Date().toISOString()
    savePersisted({
      liveName,
      koclukName,
      liveB64: liveBook ? workbookToB64(liveBook) : null,
      koclukB64: koclukBook ? workbookToB64(koclukBook) : null,
      resultB64: result ? workbookToB64(result.workbook) : null,
      day,
      view: 'takvim',
      savedAt: stamp,
    })
    if (liveBook || koclukBook || result) setSavedAt(stamp)
  }, [hydrated, liveName, koclukName, liveBook, koclukBook, result, day])

  const appointments = useMemo(() => {
    const list = result
      ? parseAppointments(result.workbook)
      : koclukBook
        ? parseAppointments(koclukBook)
        : []
    return sortByClassThenName(list)
  }, [result, koclukBook])

  const classes = useMemo(() => {
    const set = new Set(appointments.map((a) => a.sinif).filter(Boolean))
    return [...set].sort(compareClass)
  }, [appointments])

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR')
    return appointments.filter((a) => {
      if (classFilter !== 'all' && a.sinif !== classFilter) return false
      if (!q) return true
      const hay = [
        a.ad,
        a.soyad,
        a.sinif,
        a.telefon,
        ...a.slots.map((s) => s.raw),
      ]
        .join(' ')
        .toLocaleLowerCase('tr-TR')
      return hay.includes(q)
    })
  }, [appointments, query, classFilter])

  const week = useMemo(() => {
    return DAY_ORDER.map((d) => {
      const items: SlotItem[] = filtered
        .flatMap((a) =>
          a.slots
            .filter((s) => s.day === d)
            .map((s) => ({ ...s, appointment: a })),
        )
        .sort((a, b) => {
          if (a.timeMinutes !== b.timeMinutes) return a.timeMinutes - b.timeMinutes
          return compareClass(a.appointment.sinif, b.appointment.sinif)
        })
      return { day: d, items }
    })
  }, [filtered])

  const dayItems = week.find((w) => w.day === day)?.items ?? []

  const dayGroups = useMemo(() => {
    const map = new Map<string, SlotItem[]>()
    for (const item of dayItems) {
      const key = item.appointment.sinif || 'Sınıfsız'
      const list = map.get(key) ?? []
      list.push(item)
      map.set(key, list)
    }
    return [...map.entries()].sort(([a], [b]) => compareClass(a, b))
  }, [dayItems])

  const totalSlots = week.reduce((n, w) => n + w.items.length, 0)

  async function handleLive(file: File) {
    setError('')
    try {
      const book = await readWorkbook(file)
      if (!detectLiveFile(book)) {
        setError('Canlı listede 5.B / 6.C gibi sınıf sayfaları olmalı.')
        return
      }
      setLiveBook(book)
      setLiveName(file.name)
      setResult(null)
    } catch {
      setError('Canlı liste okunamadı.')
    }
  }

  async function handleKocluk(file: File) {
    setError('')
    try {
      const book = await readWorkbook(file)
      if (!detectKoclukFile(book)) {
        setError('Randevu Excel’inde gün/saat tablosu (Sayfa2) olmalı.')
        return
      }
      setKoclukBook(book)
      setKoclukName(file.name)
      setResult(null)
    } catch {
      setError('Randevu listesi okunamadı.')
    }
  }

  function runUpdate() {
    if (!liveBook || !koclukBook) {
      setError('Güncellemek için iki Excel’i de seçin.')
      setShowFiles(true)
      return
    }
    setError('')
    try {
      const next = syncMatkeys(liveBook, koclukBook, { fillEmptySlots: true })
      setResult(next)
      setShowFiles(false)
      setFlash(
        `${next.summary.removed} çıkan · ${next.summary.added} yeni · ${next.summary.updated} güncellenen`,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Güncelleme yapılamadı.')
    }
  }

  function download() {
    if (!result) return
    downloadWorkbook(
      result.workbook,
      `kocluk-guncel-${new Date().toISOString().slice(0, 10)}.xlsx`,
    )
  }

  const savedLabel = savedAt
    ? new Date(savedAt).toLocaleString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''

  return (
    <div className="home">
      <header className="home-bar">
        <div className="home-brand">
          <p className="brand">Tarık Can Erdoğan</p>
          <h1>Randevu tahtam</h1>
        </div>
        <div className="home-actions">
          {savedLabel ? <span className="pill">Kayıtlı · {savedLabel}</span> : null}
          <button
            type="button"
            className="btn ghost"
            onClick={() => go('/slayt')}
          >
            Ders slaytı
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => setShowFiles((v) => !v)}
          >
            {showFiles ? 'Dosyaları gizle' : 'Excel yükle / güncelle'}
          </button>
          {result ? (
            <button type="button" className="btn ghost" onClick={download}>
              Excel indir
            </button>
          ) : null}
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              window.location.href = '/__logout'
            }}
          >
            Çıkış yap
          </button>
        </div>
      </header>

      {showFiles && (
        <section className="files-panel">
          <label className={`file-chip ${liveName ? 'on' : ''}`}>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleLive(f)
                e.currentTarget.value = ''
              }}
            />
            <strong>Canlı liste</strong>
            <span>{liveName || 'Tarık Hoca Canlı.xlsx seç'}</span>
          </label>
          <label className={`file-chip ${koclukName ? 'on' : ''}`}>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleKocluk(f)
                e.currentTarget.value = ''
              }}
            />
            <strong>Randevu listesi</strong>
            <span>{koclukName || 'koçluk tüm liste.xlsx seç'}</span>
          </label>
          <button
            type="button"
            className="btn primary"
            onClick={runUpdate}
            disabled={!liveBook || !koclukBook}
          >
            Güncelle
          </button>
        </section>
      )}

      {error ? <p className="alert">{error}</p> : null}
      {flash ? (
        <p className="flash">
          Güncellendi: {flash}
          <button type="button" onClick={() => setFlash('')}>
            Tamam
          </button>
        </p>
      ) : null}

      {appointments.length === 0 ? (
        <section className="empty-home">
          <h2>Henüz randevu yok</h2>
          <p>
            Randevu Excel’inizi yükleyin. Liste bu sayfada kalır; her gün buradan
            takip edersiniz.
          </p>
          <button
            type="button"
            className="btn primary"
            onClick={() => setShowFiles(true)}
          >
            Excel yükle
          </button>
        </section>
      ) : (
        <>
          <section className="track-head">
            <div>
              <h2>{day}</h2>
              <p>
                {dayItems.length} randevu · bu hafta {totalSlots} dilim ·{' '}
                {classes.length} sınıf
              </p>
            </div>
            <div className="track-filters">
              <input
                type="search"
                placeholder="Öğrenci ara…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                aria-label="Sınıf"
              >
                <option value="all">Tüm sınıflar</option>
                {classes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <nav className="days" aria-label="Günler">
            {week.map(({ day: d, items }) => (
              <button
                key={d}
                type="button"
                className={day === d ? 'on' : ''}
                onClick={() => setDay(d)}
              >
                <strong>{d}</strong>
                <span>{items.length}</span>
              </button>
            ))}
          </nav>

          {/* Masaüstü: haftalık şerit özeti */}
          <section className="week-strip" aria-label="Haftalık özet">
            {week.map(({ day: d, items }) => (
              <button
                key={`strip-${d}`}
                type="button"
                className={`week-col ${day === d ? 'on' : ''}`}
                onClick={() => setDay(d)}
              >
                <header>
                  <span>{d.slice(0, 3)}</span>
                  <em>{items.length}</em>
                </header>
                <ul>
                  {items.slice(0, 6).map((item, i) => {
                    const theme = themeForClass(item.appointment.sinif)
                    return (
                      <li
                        key={`${d}-${item.appointment.id}-${i}`}
                        style={{ borderLeftColor: theme.head }}
                      >
                        <b>{item.time || '—'}</b>
                        <span>
                          {item.appointment.empty
                            ? 'Boş'
                            : fullName(item.appointment)}
                        </span>
                      </li>
                    )
                  })}
                  {items.length > 6 ? (
                    <li className="more">+{items.length - 6} daha</li>
                  ) : null}
                </ul>
              </button>
            ))}
          </section>

          {/* Seçili gün — ana takip alanı */}
          <section className="day-panel">
            <div className="day-panel-title">
              <h3>{day} programı</h3>
              <span>{dayItems.length} randevu</span>
            </div>

            {dayGroups.length === 0 ? (
              <p className="day-empty">Bu günde randevu yok.</p>
            ) : (
              <div className="class-grid">
                {dayGroups.map(([sinif, items]) => {
                  const theme = themeForClass(sinif)
                  return (
                    <article
                      key={sinif}
                      className="class-card"
                      style={
                        {
                          '--c-head': theme.head,
                          '--c-bg': theme.bg,
                          '--c-border': theme.border,
                          '--c-soft': theme.soft,
                        } as CSSProperties
                      }
                    >
                      <header>
                        <h4>{sinif}</h4>
                        <span>{items.length}</span>
                      </header>
                      <ol>
                        {items.map((item, index) => (
                          <li
                            key={`${sinif}-${item.appointment.id}-${index}`}
                            className={item.appointment.empty ? 'empty' : ''}
                          >
                            <time>{item.time || '—'}</time>
                            <div>
                              <strong>
                                {item.appointment.empty
                                  ? 'Boş slot'
                                  : fullName(item.appointment)}
                              </strong>
                              <p>
                                {item.appointment.telefon || 'Telefon yok'}
                                {item.label ? ` · ${item.label}` : ''}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

export default App
