import { useEffect, useMemo, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { go } from './lib/nav'
import {
  blendDeck,
  extractPageTexts,
  findUnits,
  kindCounts,
  loadPdf,
  renderPageDataUrl,
  type Deck,
  type Unit,
} from './lib/pdfSlides'
import { downloadUnitPptx } from './lib/pptxFromPages'
import './App.css'
import './SlaytPage.css'

export default function SlaytPage() {
  const pdfRef = useRef<PDFDocumentProxy | null>(null)
  const [fileName, setFileName] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [units, setUnits] = useState<Unit[]>([])
  const [texts, setTexts] = useState<string[]>([])
  const [selected, setSelected] = useState('')
  const [deck, setDeck] = useState<Deck | null>(null)
  const [index, setIndex] = useState(0)
  const [preview, setPreview] = useState('')
  const [exporting, setExporting] = useState(false)

  const unit = units.find((u) => u.id === selected) ?? null
  const counts = useMemo(() => (deck ? kindCounts(deck) : null), [deck])
  const current = deck?.slides[index] ?? null

  useEffect(() => {
    if (!deck) return
    const total = deck.slides.length
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') setIndex((n) => Math.max(0, n - 1))
      if (e.key === 'ArrowRight') {
        setIndex((n) => Math.min(total - 1, n + 1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [deck])

  useEffect(() => {
    if (!deck || !current || !pdfRef.current) {
      setPreview('')
      return
    }
    let cancelled = false
    setPreview('')
    renderPageDataUrl(pdfRef.current, current.page, 1.25)
      .then((url) => {
        if (!cancelled) setPreview(url)
      })
      .catch(() => {
        if (!cancelled) setError('Sayfa önizlemesi alınamadı.')
      })
    return () => {
      cancelled = true
    }
  }, [deck, current])

  async function onFile(file: File) {
    setError('')
    setUnits([])
    setTexts([])
    setDeck(null)
    setSelected('')
    setFileName(file.name)
    setBusy(true)
    setStatus('PDF okunuyor…')
    try {
      const pdf = await loadPdf(file)
      pdfRef.current = pdf
      const pages = await extractPageTexts(pdf, (done, total) => {
        setStatus(`Sayfalar okunuyor… ${done} / ${total}`)
      })
      const found = findUnits(pages)
      setTexts(pages)
      setUnits(found)
      if (found[0]) setSelected(found[0].id)
      setStatus(
        found.length
          ? `${found.length} ünite bulundu. Birini seçin.`
          : 'Ünite başlığı bulunamadı. PDF içinde “1. TEMA” benzeri başlık olmalı.',
      )
    } catch {
      setError('PDF okunamadı. Dosyanın bozulmadığından emin olun.')
      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  function makeDeck() {
    if (!unit || !texts.length) return
    setError('')
    const next = blendDeck(unit, texts)
    setDeck(next)
    setIndex(0)
    setStatus(
      `${unit.number}. tema harmanlandı: Hazır mıyız → Başlayalım → Konuya giriş → Sorular.`,
    )
  }

  async function download() {
    if (!deck || !pdfRef.current) return
    setExporting(true)
    setError('')
    try {
      await downloadUnitPptx(pdfRef.current, deck, (done, total) => {
        setStatus(`PowerPoint hazırlanıyor… ${done} / ${total}`)
      })
      setStatus('İndirme başladı.')
    } catch {
      setError('PowerPoint indirilemedi.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="home slayt-home">
      <header className="home-bar">
        <div className="home-brand">
          <p className="brand">Tarık Can Erdoğan</p>
          <h1>Ders slaytı</h1>
        </div>
        <div className="home-actions">
          <button type="button" className="btn ghost" onClick={() => go('/')}>
            Randevu tahtası
          </button>
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

      <p className="slayt-lead">
        Kitap PDF’ini yükleyin, üniteyi seçin. Slayt tek dosyada harmanlanır:
        Hazır mıyız, Başlayalım, konuya giriş, sonra sorular. Konu başlıkları
        ayrı sunumlara bölünmez. Kitaptaki sayfalar olduğu gibi kullanılır.
      </p>

      <section className="files-panel slayt-files">
        <label className={`file-chip ${fileName ? 'on' : ''}`}>
          <input
            type="file"
            accept="application/pdf,.pdf"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onFile(f)
              e.currentTarget.value = ''
            }}
          />
          <strong>Kitap PDF</strong>
          <span>{fileName || 'matematik_5_2.pdf seç'}</span>
        </label>
        <select
          className="slayt-select"
          value={selected}
          disabled={!units.length || busy}
          onChange={(e) => {
            setSelected(e.target.value)
            setDeck(null)
          }}
          aria-label="Ünite"
        >
          {units.length === 0 ? (
            <option value="">Önce PDF yükleyin</option>
          ) : (
            units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.number}. tema · {u.title} · s. {u.start}–{u.end}
              </option>
            ))
          )}
        </select>
        <button
          type="button"
          className="btn primary"
          disabled={!unit || busy}
          onClick={makeDeck}
        >
          Slaytı hazırla
        </button>
      </section>

      {status ? <p className="slayt-status">{status}</p> : null}
      {error ? <p className="alert">{error}</p> : null}

      {counts && deck ? (
        <div className="slayt-meta">
          <span className="pill">Kapak {counts.kapak}</span>
          <span className="pill">Hazır mıyız {counts.hazir}</span>
          <span className="pill">Başlayalım {counts.basla}</span>
          <span className="pill">Konuya giriş {counts.giris}</span>
          <span className="pill">Sorular {counts.soru}</span>
          <span className="pill">{deck.slides.length} slayt</span>
        </div>
      ) : null}

      {deck && current ? (
        <section className="slayt-stage">
          <div className="slayt-toolbar">
            <button
              type="button"
              className="btn ghost"
              disabled={index === 0}
              onClick={() => setIndex((n) => Math.max(0, n - 1))}
            >
              Önceki
            </button>
            <p>
              {index + 1} / {deck.slides.length} · {current.label} · s.{' '}
              {current.page}
            </p>
            <button
              type="button"
              className="btn ghost"
              disabled={index >= deck.slides.length - 1}
              onClick={() =>
                setIndex((n) => Math.min(deck.slides.length - 1, n + 1))
              }
            >
              Sonraki
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={exporting}
              onClick={() => void download()}
            >
              {exporting ? 'Hazırlanıyor…' : 'Beğendim, indir'}
            </button>
          </div>
          <div className="slayt-frame">
            {preview ? (
              <img src={preview} alt={`${current.label}, sayfa ${current.page}`} />
            ) : (
              <p>Önizleme yükleniyor…</p>
            )}
          </div>
        </section>
      ) : (
        <section className="empty-home">
          <h2>Ünite slaytı yok</h2>
          <p>
            PDF yükleyip üniteyi seçin. Önizlemeyi burada görün; beğenirseniz
            PowerPoint olarak indirin.
          </p>
        </section>
      )}
    </div>
  )
}
