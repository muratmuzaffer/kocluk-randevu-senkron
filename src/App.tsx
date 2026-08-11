import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { WorkBook } from 'xlsx'
import {
  compareClass,
  sortByClassThenName,
  themeForClass,
} from './lib/classes'
import {
  detectKoclukFile,
  detectLiveFile,
  downloadWorkbook,
  extractLiveStudents,
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
  type DayName,
} from './lib/schedule'
import './App.css'

function UploadBox({
  title,
  hint,
  fileName,
  onFile,
}: {
  title: string
  hint: string
  fileName?: string
  onFile: (file: File) => void
}) {
  return (
    <label className={`x-upload ${fileName ? 'on' : ''}`}>
      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
          e.currentTarget.value = ''
        }}
      />
      <strong>{title}</strong>
      <span>{hint}</span>
      <em>{fileName ?? 'Dosya seç…'}</em>
    </label>
  )
}

function App() {
  const [hydrated, setHydrated] = useState(false)
  const [liveName, setLiveName] = useState('')
  const [koclukName, setKoclukName] = useState('')
  const [liveBook, setLiveBook] = useState<WorkBook | null>(null)
  const [koclukBook, setKoclukBook] = useState<WorkBook | null>(null)
  const [result, setResult] = useState<MatkeysSyncResult | null>(null)
  const [error, setError] = useState('')
  const [day, setDay] = useState<DayName>('Pazartesi')
  const [view, setView] = useState<'takvim' | 'tablo'>('takvim')
  const [savedAt, setSavedAt] = useState('')

  useEffect(() => {
    const saved = loadPersisted()
    if (!saved) {
      setHydrated(true)
      return
    }
    try {
      if (saved.liveB64) setLiveBook(b64ToWorkbook(saved.liveB64))
      if (saved.koclukB64) setKoclukBook(b64ToWorkbook(saved.koclukB64))
      if (saved.resultB64) {
        const wb = b64ToWorkbook(saved.resultB64)
        setResult({
          workbook: wb,
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
      if (DAY_ORDER.includes(saved.day as DayName)) {
        setDay(saved.day as DayName)
      }
      if (saved.view === 'tablo' || saved.view === 'takvim') {
        setView(saved.view)
      }
      setSavedAt(saved.savedAt || '')
    } catch {
      // bozuk kayıt
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
      view,
      savedAt: stamp,
    })
    if (liveBook || koclukBook || result) setSavedAt(stamp)
  }, [hydrated, liveName, koclukName, liveBook, koclukBook, result, day, view])

  const liveStudents = useMemo(
    () => (liveBook ? sortByClassThenName(extractLiveStudents(liveBook)) : []),
    [liveBook],
  )

  const appointments = useMemo(() => {
    const list = result
      ? parseAppointments(result.workbook)
      : koclukBook
        ? parseAppointments(koclukBook)
        : []
    return sortByClassThenName(list)
  }, [result, koclukBook])

  const dayGroups = useMemo(() => {
    const items = appointments
      .flatMap((a) =>
        a.slots
          .filter((s) => s.day === day)
          .map((s) => ({ ...s, appointment: a })),
      )
      .sort((a, b) => {
        const byClass = compareClass(a.appointment.sinif, b.appointment.sinif)
        if (byClass !== 0) return byClass
        return a.timeMinutes - b.timeMinutes
      })

    const map = new Map<string, typeof items>()
    for (const item of items) {
      const key = item.appointment.sinif || 'Sınıfsız'
      const list = map.get(key) ?? []
      list.push(item)
      map.set(key, list)
    }
    return [...map.entries()].sort(([a], [b]) => compareClass(a, b))
  }, [appointments, day])

  const added = result?.changes.filter((c) => c.type === 'added') ?? []
  const removed = result?.changes.filter((c) => c.type === 'removed') ?? []
  const updated = result?.changes.filter((c) => c.type === 'updated') ?? []

  async function handleLive(file: File) {
    setError('')
    setResult(null)
    try {
      const book = await readWorkbook(file)
      if (!detectLiveFile(book)) {
        setError('Canlı listede 5.B / 6.C gibi sınıf sayfaları olmalı.')
        setLiveBook(null)
        setLiveName('')
        return
      }
      setLiveBook(book)
      setLiveName(file.name)
    } catch {
      setError('Canlı liste okunamadı.')
    }
  }

  async function handleKocluk(file: File) {
    setError('')
    setResult(null)
    try {
      const book = await readWorkbook(file)
      if (!detectKoclukFile(book)) {
        setError('Randevu Excel’inde gün/saat tablosu (Sayfa2) olmalı.')
        setKoclukBook(null)
        setKoclukName('')
        return
      }
      setKoclukBook(book)
      setKoclukName(file.name)
    } catch {
      setError('Randevu listesi okunamadı.')
    }
  }

  function runUpdate() {
    if (!liveBook || !koclukBook) {
      setError('Güncellemek için iki Excel’i de seçin.')
      return
    }
    setError('')
    try {
      setResult(syncMatkeys(liveBook, koclukBook, { fillEmptySlots: true }))
      setView('takvim')
      setDay('Pazartesi')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Güncelleme yapılamadı.')
    }
  }

  function download() {
    if (!result) return
    const stamp = new Date().toISOString().slice(0, 10)
    downloadWorkbook(result.workbook, `kocluk-guncel-${stamp}.xlsx`)
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
    <div className="sheet-app">
      <header className="sheet-top">
        <div>
          <p className="brand">KoçSenkron</p>
          <h1>Dosyaları seçin, güncelleyin, sınıflara göre takip edin</h1>
          {savedLabel ? (
            <p className="saved-note">Son kayıt bu cihazda: {savedLabel}</p>
          ) : null}
        </div>
      </header>

      <section className="pickers">
        <UploadBox
          title="1 · Canlı sınıf listesi"
          hint="Örn. Tarık Hoca Canlı.xlsx"
          fileName={liveName || undefined}
          onFile={handleLive}
        />
        <UploadBox
          title="2 · Randevu listeniz"
          hint="Örn. koçluk tüm liste.xlsx"
          fileName={koclukName || undefined}
          onFile={handleKocluk}
        />
      </section>

      <div className="update-bar">
        <button
          type="button"
          className="btn-update"
          onClick={runUpdate}
          disabled={!liveBook || !koclukBook}
        >
          Güncelle
        </button>
        {result ? (
          <button type="button" className="btn-down" onClick={download}>
            Excel indir
          </button>
        ) : null}
        <p>
          {!liveBook || !koclukBook
            ? 'İki dosyayı seçince Güncelle aktif olur. Veriler bu tarayıcıda saklanır.'
            : result && result.changes.length
              ? `${removed.length} çıkan · ${added.length} yeni · ${updated.length} güncellenen`
              : 'Hazır — Güncelle’ye basın veya kayıtlı listenizi aşağıdan takip edin.'}
        </p>
      </div>

      {error ? <p className="alert">{error}</p> : null}

      {(liveBook || koclukBook) && (
        <section className="previews">
          <ClassExcelTable
            title="Canlı liste"
            empty="Canlı Excel seçilmedi"
            headers={['Ad', 'Soyad', 'Veli', 'Telefon']}
            rows={liveStudents.map((s) => ({
              sinif: s.sinif,
              cells: [
                s.ad,
                s.soyad,
                `${s.veliAd} ${s.veliSoyad}`.trim(),
                s.telefon,
              ],
            }))}
          />
          <ClassExcelTable
            title="Randevu listesi"
            empty="Randevu Excel seçilmedi"
            headers={['Ad', 'Soyad', 'Telefon', 'Saatler']}
            rows={appointments.map((a) => ({
              sinif: a.sinif,
              cells: [
                a.empty ? '—' : a.ad,
                a.empty ? 'boş' : a.soyad,
                a.telefon || '—',
                a.slots
                  .map((s) => `${s.day.slice(0, 3)} ${s.time || s.raw}`)
                  .join(', ') || '—',
              ],
            }))}
          />
        </section>
      )}

      {appointments.length > 0 && (
        <section className="board-wrap">
          <div className="board-head">
            <h2>Günlük randevular</h2>
            <div className="view-switch">
              <button
                type="button"
                className={view === 'takvim' ? 'on' : ''}
                onClick={() => setView('takvim')}
              >
                Takvim
              </button>
              <button
                type="button"
                className={view === 'tablo' ? 'on' : ''}
                onClick={() => setView('tablo')}
              >
                Tablo
              </button>
            </div>
          </div>

          <div className="day-tabs">
            {DAY_ORDER.map((d) => {
              const count = appointments.reduce(
                (n, a) => n + a.slots.filter((s) => s.day === d).length,
                0,
              )
              return (
                <button
                  key={d}
                  type="button"
                  className={day === d ? 'on' : ''}
                  onClick={() => setDay(d)}
                >
                  {d}
                  <small>{count}</small>
                </button>
              )
            })}
          </div>

          {dayGroups.length === 0 ? (
            <p className="day-empty">{day} günü için randevu yok.</p>
          ) : view === 'takvim' ? (
            <div className="class-boards">
              {dayGroups.map(([sinif, items]) => {
                const theme = themeForClass(sinif)
                return (
                  <section
                    key={sinif}
                    className="class-board"
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
                      <h3>{sinif}</h3>
                      <span>{items.length} randevu</span>
                    </header>
                    <div className="timeline">
                      {items.map((item, index) => (
                        <article
                          key={`${item.appointment.id}-${item.raw}-${index}`}
                          className={
                            item.appointment.empty ? 'tl empty' : 'tl'
                          }
                        >
                          <time>{item.time || '—'}</time>
                          <div>
                            <strong>
                              {item.appointment.empty
                                ? 'Boş slot'
                                : fullName(item.appointment)}
                            </strong>
                            <p>
                              {item.appointment.telefon
                                ? item.appointment.telefon
                                : 'Telefon yok'}
                              {item.label ? ` · ${item.label}` : ''}
                            </p>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                )
              })}
            </div>
          ) : (
            <ClassExcelTable
              title={`${day} tablosu`}
              empty="Bu günde randevu yok"
              headers={['Saat', 'Öğrenci', 'Telefon', 'Not']}
              rows={dayGroups.flatMap(([, items]) =>
                items.map((cell) => ({
                  sinif: cell.appointment.sinif,
                  cells: [
                    cell.time || cell.raw,
                    cell.appointment.empty
                      ? 'Boş slot'
                      : fullName(cell.appointment),
                    cell.appointment.telefon || '—',
                    cell.label || '—',
                  ],
                })),
              )}
            />
          )}
        </section>
      )}

      {result && result.changes.length > 0 && (
        <section className="result-strip">
          <ResultCol title="Çıkan" items={removed.map((c) => c.label)} />
          <ResultCol title="Yeni" items={added.map((c) => c.label)} />
          <ResultCol title="Güncellenen" items={updated.map((c) => c.label)} />
        </section>
      )}
    </div>
  )
}

function ClassExcelTable({
  title,
  headers,
  rows,
  empty,
}: {
  title: string
  headers: string[]
  rows: { sinif: string; cells: string[] }[]
  empty: string
}) {
  const groups = useMemo(() => {
    const map = new Map<string, { sinif: string; cells: string[] }[]>()
    for (const row of rows) {
      const key = row.sinif || 'Sınıfsız'
      const list = map.get(key) ?? []
      list.push(row)
      map.set(key, list)
    }
    return [...map.entries()].sort(([a], [b]) => compareClass(a, b))
  }, [rows])

  return (
    <div className="x-table">
      <div className="x-table-title">{title}</div>
      <div className="x-table-scroll">
        {groups.length === 0 ? (
          <table>
            <tbody>
              <tr>
                <td className="row-num">1</td>
                <td>{empty}</td>
              </tr>
            </tbody>
          </table>
        ) : (
          groups.map(([sinif, list]) => {
            const theme = themeForClass(sinif)
            return (
              <table key={sinif} className="class-sheet">
                <thead>
                  <tr>
                    <th
                      className="class-banner"
                      colSpan={headers.length + 1}
                      style={{ background: theme.head }}
                    >
                      {sinif}
                      <span>{list.length}</span>
                    </th>
                  </tr>
                  <tr>
                    <th className="row-num" style={{ background: theme.soft }} />
                    {headers.map((h) => (
                      <th key={h} style={{ background: theme.soft, color: theme.head }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.map((row, i) => (
                    <tr key={`${sinif}-${i}`}>
                      <td className="row-num">{i + 1}</td>
                      {row.cells.map((cell, j) => (
                        <td key={j}>{cell || ''}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          })
        )}
      </div>
    </div>
  )
}

function ResultCol({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="result-col">
      <h3>
        {title} <span>{items.length}</span>
      </h3>
      {items.length === 0 ? (
        <p>—</p>
      ) : (
        <ul>
          {items.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default App
