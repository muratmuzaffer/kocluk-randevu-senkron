import { useMemo, useState } from 'react'
import type { WorkBook } from 'xlsx'
import {
  detectKoclukFile,
  detectLiveFile,
  downloadWorkbook,
  readWorkbook,
  syncMatkeys,
  type MatkeysSyncResult,
  type SyncChange,
} from './lib/matkeys'
import {
  DAY_ORDER,
  fullName,
  parseAppointments,
  type Appointment,
  type DayName,
} from './lib/schedule'
import './App.css'

type Tab = 'liste' | 'takvim' | 'senkron'

function UploadZone({
  step,
  title,
  description,
  example,
  loaded,
  onFile,
}: {
  step: string
  title: string
  description: string
  example: string
  loaded?: string
  onFile: (file: File) => void
}) {
  return (
    <label className={`upload ${loaded ? 'ready' : ''}`}>
      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
          e.currentTarget.value = ''
        }}
      />
      <span className="upload-step">{step}</span>
      <div className="upload-copy">
        <strong>{title}</strong>
        <p>{description}</p>
        <span className="upload-example">{example}</span>
        <span className="upload-status">
          {loaded ? loaded : 'Dosya seçin'}
        </span>
      </div>
    </label>
  )
}

function App() {
  const [tab, setTab] = useState<Tab>('liste')
  const [liveName, setLiveName] = useState('')
  const [koclukName, setKoclukName] = useState('')
  const [liveBook, setLiveBook] = useState<WorkBook | null>(null)
  const [koclukBook, setKoclukBook] = useState<WorkBook | null>(null)
  const [fillEmptySlots, setFillEmptySlots] = useState(true)
  const [result, setResult] = useState<MatkeysSyncResult | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [classFilter, setClassFilter] = useState('all')
  const [dayFilter, setDayFilter] = useState<'all' | DayName>('all')
  const [showEmpty, setShowEmpty] = useState(true)

  const appointments = useMemo(() => {
    if (result) return parseAppointments(result.workbook)
    if (koclukBook) return parseAppointments(koclukBook)
    return [] as Appointment[]
  }, [result, koclukBook])

  const classes = useMemo(() => {
    const set = new Set(appointments.map((a) => a.sinif).filter(Boolean))
    return [...set].sort((a, b) => a.localeCompare(b, 'tr'))
  }, [appointments])

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR')
    return appointments.filter((a) => {
      if (!showEmpty && a.empty) return false
      if (classFilter !== 'all' && a.sinif !== classFilter) return false
      if (dayFilter !== 'all' && !a.slots.some((s) => s.day === dayFilter)) {
        return false
      }
      if (!q) return true
      const hay = [
        a.ad,
        a.soyad,
        a.sinif,
        a.telefon,
        a.veliAd,
        a.veliSoyad,
        ...a.slots.map((s) => s.raw),
      ]
        .join(' ')
        .toLocaleLowerCase('tr-TR')
      return hay.includes(q)
    })
  }, [appointments, query, classFilter, dayFilter, showEmpty])

  const updated = result?.changes.filter((c) => c.type === 'updated') ?? []
  const added = result?.changes.filter((c) => c.type === 'added') ?? []
  const removed = result?.changes.filter((c) => c.type === 'removed') ?? []
  const unplaced = result?.changes.filter((c) => c.type === 'unplaced') ?? []
  const delta = updated.length + added.length + removed.length

  async function handleLive(file: File) {
    setError('')
    setResult(null)
    try {
      const book = await readWorkbook(file)
      if (!detectLiveFile(book)) {
        setError(
          'Canlı liste için 5.B, 6.C gibi sınıf sayfaları olan Excel gerekli.',
        )
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
        setError(
          'Randevu listeniz için gün ve saat kolonları olan koçluk Excel’i gerekli.',
        )
        setKoclukBook(null)
        setKoclukName('')
        return
      }
      setKoclukBook(book)
      setKoclukName(file.name)
      setTab('liste')
    } catch {
      setError('Randevu listesi okunamadı.')
    }
  }

  function runSync() {
    if (!liveBook || !koclukBook) {
      setError('Senkron için iki dosyayı da yükleyin.')
      return
    }
    setError('')
    try {
      const next = syncMatkeys(liveBook, koclukBook, { fillEmptySlots })
      setResult(next)
      setTab('senkron')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Senkron yapılamadı.')
    }
  }

  function download() {
    if (!result) return
    const stamp = new Date().toISOString().slice(0, 10)
    downloadWorkbook(result.workbook, `kocluk-guncel-${stamp}.xlsx`)
  }

  return (
    <div className="app">
      <header className="top">
        <p className="brand">KoçSenkron</p>
        <h1>Randevu listenizi görün, canlı listeyle güncelleyin</h1>
        <p className="lede">
          Önce kendi koçluk Excel’inizi yükleyin. İsterseniz canlı sınıf
          listesiyle kimlerin değiştiğini karşılaştırın.
        </p>
      </header>

      <section className="uploads" aria-label="Dosya yükleme">
        <UploadZone
          step="1"
          title="Canlı sınıf listesi"
          description="Dershanenin güncel öğrenci listesi. Sınıf sayfaları buraya gelir."
          example="Örn. Tarık Hoca Canlı.xlsx"
          loaded={liveName || undefined}
          onFile={handleLive}
        />
        <UploadZone
          step="2"
          title="Randevu listeniz"
          description="Saatleri olan koçluk dosyanız. Liste ve takvim bundan oluşur."
          example="Örn. koçluk tüm liste.xlsx"
          loaded={koclukName || undefined}
          onFile={handleKocluk}
        />
      </section>

      {error ? <p className="alert">{error}</p> : null}

      {!koclukBook ? (
        <section className="start">
          <h2>Başlamak için randevu listenizi yükleyin</h2>
          <p>
            Sağdaki alandan koçluk Excel’inizi seçin. Öğrencilerinizi liste ve
            takvim olarak göreceksiniz. Canlı listeyi daha sonra ekleyebilirsiniz.
          </p>
        </section>
      ) : (
        <main className="workspace">
          <div className="controls">
            <nav className="tabs" aria-label="Görünümler">
              <button
                type="button"
                className={tab === 'liste' ? 'active' : ''}
                onClick={() => setTab('liste')}
              >
                Liste
              </button>
              <button
                type="button"
                className={tab === 'takvim' ? 'active' : ''}
                onClick={() => setTab('takvim')}
              >
                Takvim
              </button>
              <button
                type="button"
                className={tab === 'senkron' ? 'active' : ''}
                onClick={() => setTab('senkron')}
              >
                Senkron{delta ? ` (${delta})` : ''}
              </button>
            </nav>

            <div className="filters">
              <input
                type="search"
                placeholder="Öğrenci, veli veya saat ara"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                aria-label="Sınıf filtresi"
              >
                <option value="all">Tüm sınıflar</option>
                {classes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={dayFilter}
                onChange={(e) =>
                  setDayFilter(e.target.value as 'all' | DayName)
                }
                aria-label="Gün filtresi"
              >
                <option value="all">Tüm günler</option>
                {DAY_ORDER.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <label className="check">
                <input
                  type="checkbox"
                  checked={showEmpty}
                  onChange={(e) => setShowEmpty(e.target.checked)}
                />
                Boş slotlar
              </label>
            </div>
          </div>

          {tab === 'liste' ? <ListView items={filtered} /> : null}
          {tab === 'takvim' ? <CalendarView items={filtered} /> : null}
          {tab === 'senkron' ? (
            <SyncView
              liveReady={Boolean(liveBook)}
              koclukReady={Boolean(koclukBook)}
              fillEmptySlots={fillEmptySlots}
              setFillEmptySlots={(v) => {
                setFillEmptySlots(v)
                setResult(null)
              }}
              onSync={runSync}
              onDownload={download}
              result={result}
              updated={updated}
              added={added}
              removed={removed}
              unplaced={unplaced}
            />
          ) : null}
        </main>
      )}
    </div>
  )
}

function ListView({ items }: { items: Appointment[] }) {
  if (items.length === 0) {
    return <p className="empty">Bu filtrelere uyan randevu yok.</p>
  }

  const byClass = new Map<string, Appointment[]>()
  for (const item of items) {
    const key = item.sinif || 'Sınıfsız'
    const list = byClass.get(key) ?? []
    list.push(item)
    byClass.set(key, list)
  }

  return (
    <section className="list">
      <p className="meta">{items.length} kayıt</p>
      {[...byClass.entries()].map(([sinif, rows]) => (
        <div key={sinif} className="group">
          <div className="group-head">
            <h2>{sinif}</h2>
            <span>{rows.length}</span>
          </div>
          <ul>
            {rows.map((a) => (
              <li key={a.id} className={a.empty ? 'is-empty' : ''}>
                <div>
                  <strong>{a.empty ? 'Boş slot' : fullName(a)}</strong>
                  <p>
                    {a.empty
                      ? 'Bu saate öğrenci atanabilir'
                      : [
                          a.veliAd || a.veliSoyad
                            ? `Veli: ${`${a.veliAd} ${a.veliSoyad}`.trim()}`
                            : null,
                          a.telefon ? a.telefon : null,
                        ]
                          .filter(Boolean)
                          .join(' · ') || 'Veli / telefon yok'}
                  </p>
                </div>
                <div className="times">
                  {a.slots.length === 0 ? (
                    <span className="time muted">Saat yok</span>
                  ) : (
                    a.slots.map((s) => (
                      <span key={`${a.id}-${s.day}`} className="time">
                        {s.day} {s.time || s.raw}
                      </span>
                    ))
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}

function CalendarView({ items }: { items: Appointment[] }) {
  const columns = DAY_ORDER.map((day) => ({
    day,
    cells: items
      .flatMap((a) =>
        a.slots
          .filter((s) => s.day === day)
          .map((s) => ({ ...s, appointment: a })),
      )
      .sort((a, b) => a.timeMinutes - b.timeMinutes),
  }))

  const total = columns.reduce((n, c) => n + c.cells.length, 0)

  return (
    <section className="calendar">
      <p className="meta">{total} randevu · haftalık görünüm</p>
      <div className="days">
        {columns.map(({ day, cells }) => (
          <div key={day} className="day">
            <h3>
              {day}
              <span>{cells.length}</span>
            </h3>
            <div className="slots">
              {cells.length === 0 ? (
                <p className="day-empty">Randevu yok</p>
              ) : (
                cells.map((cell) => (
                  <article
                    key={`${day}-${cell.appointment.id}-${cell.raw}`}
                    className={cell.appointment.empty ? 'slot empty' : 'slot'}
                  >
                    <time>{cell.time || '—'}</time>
                    <strong>
                      {cell.appointment.empty
                        ? 'Boş slot'
                        : fullName(cell.appointment)}
                    </strong>
                    <span>
                      {cell.appointment.sinif}
                      {cell.label ? ` · ${cell.label}` : ''}
                    </span>
                  </article>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function SyncView({
  liveReady,
  koclukReady,
  fillEmptySlots,
  setFillEmptySlots,
  onSync,
  onDownload,
  result,
  updated,
  added,
  removed,
  unplaced,
}: {
  liveReady: boolean
  koclukReady: boolean
  fillEmptySlots: boolean
  setFillEmptySlots: (v: boolean) => void
  onSync: () => void
  onDownload: () => void
  result: MatkeysSyncResult | null
  updated: SyncChange[]
  added: SyncChange[]
  removed: SyncChange[]
  unplaced: SyncChange[]
}) {
  const canRun = liveReady && koclukReady
  const hasChanges =
    Boolean(result) &&
    (updated.length > 0 || added.length > 0 || removed.length > 0)

  return (
    <section className="sync">
      <div className="sync-steps">
        <div className={`sync-step ${liveReady ? 'done' : ''}`}>
          <span>1</span>
          <div>
            <strong>Canlı liste</strong>
            <p>{liveReady ? 'Yüklendi' : 'Üstten 1 numaralı alana yükleyin'}</p>
          </div>
        </div>
        <div className={`sync-step ${koclukReady ? 'done' : ''}`}>
          <span>2</span>
          <div>
            <strong>Randevu listeniz</strong>
            <p>{koclukReady ? 'Yüklendi' : 'Üstten 2 numaralı alana yükleyin'}</p>
          </div>
        </div>
        <div className={`sync-step ${result ? 'done' : ''}`}>
          <span>3</span>
          <div>
            <strong>Sonuç</strong>
            <p>{result ? 'Hazır — aşağıdan indirebilirsiniz' : 'Butona basınca oluşur'}</p>
          </div>
        </div>
      </div>

      <div className="sync-box">
        <h2>Listenizi güncelleyin</h2>
        <p className="sync-plain">
          Ne olur?
          <br />
          • Randevu saatleri aynı kalır
          <br />
          • Canlı listede olmayan öğrenciler silinir
          <br />
          • Yeni öğrenciler boş saatlere yazılır
          <br />• Telefon / veli bilgisi güncellenir
        </p>

        <label className="check block">
          <input
            type="checkbox"
            checked={fillEmptySlots}
            onChange={(e) => setFillEmptySlots(e.target.checked)}
          />
          Yeni öğrencileri boş saatlere otomatik yerleştir
        </label>

        <div className="actions">
          <button
            type="button"
            className="btn primary"
            onClick={onSync}
            disabled={!canRun}
          >
            {canRun ? 'Listeyi güncelle' : 'Önce iki dosyayı da yükleyin'}
          </button>
          {result ? (
            <button type="button" className="btn secondary" onClick={onDownload}>
              Excel’i indir
            </button>
          ) : null}
        </div>
      </div>

      {result ? (
        <div className="sync-result">
          <div className="result-banner">
            <h2>Özet</h2>
            <p>
              {hasChanges
                ? `${removed.length} çıkan · ${added.length} yeni · ${updated.length} güncellenen`
                : 'Öğrenci listesinde değişiklik yok. İsterseniz yine de Excel’i indirebilirsiniz.'}
            </p>
            <button type="button" className="btn primary" onClick={onDownload}>
              Güncel Excel’i indir
            </button>
          </div>

          <SimplePeople
            title="Çıkan öğrenciler"
            emptyText="Çıkan kimse yok"
            items={removed}
            tone="out"
          />
          <SimplePeople
            title="Yeni eklenen öğrenciler"
            emptyText="Yeni eklenen yok"
            items={added}
            tone="in"
          />
          <SimplePeople
            title="Bilgisi güncellenenler"
            emptyText="Güncellenen yok"
            items={updated}
            tone="edit"
            showDiff
          />
          {unplaced.length > 0 ? (
            <SimplePeople
              title="Boş saat kalmadığı için eklenemeyenler"
              emptyText=""
              items={unplaced}
              tone="wait"
            />
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

function SimplePeople({
  title,
  emptyText,
  items,
  tone,
  showDiff,
}: {
  title: string
  emptyText: string
  items: SyncChange[]
  tone: 'out' | 'in' | 'wait' | 'edit'
  showDiff?: boolean
}) {
  return (
    <div className={`people ${tone}`}>
      <div className="people-head">
        <h3>{title}</h3>
        <span>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="people-empty">{emptyText}</p>
      ) : (
        <ul>
          {items.map((item, index) => (
            <li key={`${item.label}-${index}`}>
              <strong>{item.label}</strong>
              {showDiff && item.before && item.after ? (
                <p>
                  Tel: {item.before.telefon || '—'} → {item.after.telefon || '—'}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default App
