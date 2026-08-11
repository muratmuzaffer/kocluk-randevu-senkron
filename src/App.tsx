import { useMemo, useState } from 'react'
import type { WorkBook } from 'xlsx'
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
  DAY_ORDER,
  fullName,
  parseAppointments,
  type Appointment,
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
  const [liveName, setLiveName] = useState('')
  const [koclukName, setKoclukName] = useState('')
  const [liveBook, setLiveBook] = useState<WorkBook | null>(null)
  const [koclukBook, setKoclukBook] = useState<WorkBook | null>(null)
  const [result, setResult] = useState<MatkeysSyncResult | null>(null)
  const [error, setError] = useState('')
  const [day, setDay] = useState<DayName>('Pazartesi')
  const [view, setView] = useState<'takvim' | 'tablo'>('takvim')

  const liveStudents = useMemo(
    () => (liveBook ? extractLiveStudents(liveBook) : []),
    [liveBook],
  )

  const appointments = useMemo(() => {
    if (result) return parseAppointments(result.workbook)
    if (koclukBook) return parseAppointments(koclukBook)
    return [] as Appointment[]
  }, [result, koclukBook])

  const dayItems = useMemo(() => {
    return appointments
      .flatMap((a) =>
        a.slots
          .filter((s) => s.day === day)
          .map((s) => ({ ...s, appointment: a })),
      )
      .sort((a, b) => a.timeMinutes - b.timeMinutes)
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Güncelleme yapılamadı.')
    }
  }

  function download() {
    if (!result) return
    const stamp = new Date().toISOString().slice(0, 10)
    downloadWorkbook(result.workbook, `kocluk-guncel-${stamp}.xlsx`)
  }

  return (
    <div className="sheet-app">
      <header className="sheet-top">
        <div>
          <p className="brand">KoçSenkron</p>
          <h1>Dosyaları seçin, güncelleyin, takvimden takip edin</h1>
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
            ? 'İki dosyayı seçince Güncelle aktif olur.'
            : result
              ? `${removed.length} çıkan · ${added.length} yeni · ${updated.length} güncellenen`
              : 'Hazır — Güncelle’ye basın.'}
        </p>
      </div>

      {error ? <p className="alert">{error}</p> : null}

      {(liveBook || koclukBook) && (
        <section className="previews">
          <ExcelTable
            title="Canlı liste önizleme"
            empty="Canlı Excel seçilmedi"
            headers={['Sınıf', 'Ad', 'Soyad', 'Veli', 'Telefon']}
            rows={liveStudents.slice(0, 40).map((s) => [
              s.sinif,
              s.ad,
              s.soyad,
              `${s.veliAd} ${s.veliSoyad}`.trim(),
              s.telefon,
            ])}
            footer={
              liveStudents.length > 40
                ? `İlk 40 / ${liveStudents.length} öğrenci`
                : liveStudents.length
                  ? `${liveStudents.length} öğrenci`
                  : undefined
            }
          />
          <ExcelTable
            title="Randevu listesi önizleme"
            empty="Randevu Excel seçilmedi"
            headers={['Sınıf', 'Ad', 'Soyad', 'Telefon', 'Saatler']}
            rows={appointments.slice(0, 40).map((a) => [
              a.sinif,
              a.empty ? '—' : a.ad,
              a.empty ? 'boş' : a.soyad,
              a.telefon || '—',
              a.slots.map((s) => `${s.day.slice(0, 3)} ${s.time || s.raw}`).join(', ') ||
                '—',
            ])}
            footer={
              appointments.length > 40
                ? `İlk 40 / ${appointments.length} satır`
                : appointments.length
                  ? `${appointments.length} satır`
                  : undefined
            }
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

          {view === 'takvim' ? (
            <DayTimeline items={dayItems} day={day} />
          ) : (
            <ExcelTable
              title={`${day} tablosu`}
              empty="Bu günde randevu yok"
              headers={['Saat', 'Sınıf', 'Öğrenci', 'Telefon', 'Not']}
              rows={dayItems.map((cell) => [
                cell.time || cell.raw,
                cell.appointment.sinif,
                cell.appointment.empty
                  ? 'Boş slot'
                  : fullName(cell.appointment),
                cell.appointment.telefon || '—',
                cell.label || '—',
              ])}
            />
          )}
        </section>
      )}

      {result && (
        <section className="result-strip">
          <ResultCol title="Çıkan" items={removed.map((c) => c.label)} />
          <ResultCol title="Yeni" items={added.map((c) => c.label)} />
          <ResultCol title="Güncellenen" items={updated.map((c) => c.label)} />
        </section>
      )}
    </div>
  )
}

function ExcelTable({
  title,
  headers,
  rows,
  empty,
  footer,
}: {
  title: string
  headers: string[]
  rows: string[][]
  empty: string
  footer?: string
}) {
  return (
    <div className="x-table">
      <div className="x-table-title">{title}</div>
      <div className="x-table-scroll">
        <table>
          <thead>
            <tr>
              <th className="row-num" />
              {headers.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="row-num">1</td>
                <td colSpan={headers.length}>{empty}</td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={`${title}-${i}`}>
                  <td className="row-num">{i + 1}</td>
                  {row.map((cell, j) => (
                    <td key={j}>{cell || ''}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {footer ? <div className="x-table-foot">{footer}</div> : null}
    </div>
  )
}

function DayTimeline({
  items,
  day,
}: {
  day: DayName
  items: {
    time: string
    raw: string
    label: string
    appointment: Appointment
  }[]
}) {
  if (items.length === 0) {
    return <p className="day-empty">{day} günü için randevu yok.</p>
  }

  return (
    <div className="timeline">
      {items.map((item, index) => (
        <article
          key={`${item.appointment.id}-${item.raw}-${index}`}
          className={item.appointment.empty ? 'tl empty' : 'tl'}
        >
          <time>{item.time || '—'}</time>
          <div>
            <strong>
              {item.appointment.empty
                ? 'Boş slot'
                : fullName(item.appointment)}
            </strong>
            <p>
              {item.appointment.sinif}
              {item.appointment.telefon
                ? ` · ${item.appointment.telefon}`
                : ''}
              {item.label ? ` · ${item.label}` : ''}
            </p>
          </div>
        </article>
      ))}
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
