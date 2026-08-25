import { useEffect, useMemo, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import {
  blendDeck,
  extractPageTexts,
  findUnits,
  kindCounts,
  loadPdf,
  type Deck,
  type Unit,
} from './lib/pdfSlides'
import {
  contentUrl,
  coverUrl,
  downloadUnitPptx,
  headerTitle,
  previewAt,
  previewLength,
  titleUrl,
  unitTitle,
} from './lib/pptxFromPages'
import './SlaytPage.css'

type Props = {
  active: boolean
}

export default function SlaytPage({ active }: Props) {
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
  const [exporting, setExporting] = useState(false)

  const unit = units.find((u) => u.id === selected) ?? null
  const counts = useMemo(() => (deck ? kindCounts(deck) : null), [deck])
  const total = deck ? previewLength(deck) : 0
  const view = deck ? previewAt(deck, index) : null
  const current = view?.role === 'content' ? view.slide : null
  const heading =
    view && 'heading' in view && view.heading
      ? view.heading
      : deck
        ? unitTitle(deck)
        : ''

  useEffect(() => {
    if (!deck || !active) return
    const n = previewLength(deck)
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(n - 1, i + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [deck, active])

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
      const pages = await extractPageTexts(pdf, (done, all) => {
        setStatus(`Sayfalar okunuyor… ${done} / ${all}`)
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
      `${unit.number}. tema MatKeys formatında: kapak, başlık, içerik, kapanış.`,
    )
  }

  async function download() {
    if (!deck || !pdfRef.current) return
    setExporting(true)
    setError('')
    try {
      await downloadUnitPptx(pdfRef.current, deck, (done, all) => {
        setStatus(`PowerPoint hazırlanıyor… ${done} / ${all}`)
      })
      setStatus('İndirme başladı.')
    } catch {
      setError('PowerPoint indirilemedi.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="slayt-pane">
      <p className="slayt-lead">
        Kitap PDF’ini yükleyin, üniteyi seçin. Soru kitaptan alınır, şıklar
        altına yazılır; cümleler değiştirilmez. Her soru ayrı slayttır.
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
          <span className="pill">MatKeys</span>
          <span className="pill">Kapak + başlık + kapanış</span>
          <span className="pill">Hazır mıyız {counts.hazir}</span>
          <span className="pill">Başlayalım {counts.basla}</span>
          <span className="pill">Konuya giriş {counts.giris}</span>
          <span className="pill">Sorular {counts.soru}</span>
          <span className="pill">{total} slayt</span>
        </div>
      ) : null}

      {deck && view ? (
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
              {index + 1} / {total} · {view.label}
              {current ? ` · s. ${current.page}` : ''}
            </p>
            <button
              type="button"
              className="btn ghost"
              disabled={index >= total - 1}
              onClick={() => setIndex((n) => Math.min(total - 1, n + 1))}
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
          <div className="mk-slide" data-role={view.role}>
            {view.role === 'cover' ? (
              <img className="mk-bg" src={coverUrl} alt="MatKeys kapak" />
            ) : null}
            {view.role === 'title' || view.role === 'end' || view.role === 'section' ? (
              <>
                <img className="mk-bg" src={titleUrl} alt="" />
                <p className="mk-title">{heading}</p>
              </>
            ) : null}
            {view.role === 'content' && current ? (
              <>
                <img className="mk-bg" src={contentUrl} alt="" />
                <p className="mk-head">{headerTitle(deck, current)}</p>
                <div className="mk-card">
                  <p className="mk-prompt">{current.prompt}</p>
                  {current.choices.length ? (
                    <ul
                      className={`mk-choices cols-${current.choices.length > 3 ? 2 : 1}`}
                    >
                      {current.choices.map((choice) => (
                        <li key={choice}>{choice}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="empty-home">
          <h2>Ünite slaytı yok</h2>
          <p>
            PDF yükleyip üniteyi seçin. Sorular kitaptan birebir alınır, slaytta
            düzenli yazılır; beğenirseniz PowerPoint indirin.
          </p>
        </section>
      )}
    </div>
  )
}
