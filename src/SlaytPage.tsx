import { useEffect, useMemo, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import {
  blendDeck,
  extractPageModels,
  findUnits,
  kindCounts,
  loadPdf,
  renderBandDataUrl,
  type Deck,
  type PageModel,
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
import { choiceBits, stepBits } from './lib/bookCards'
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
  const [models, setModels] = useState<PageModel[]>([])
  const [selected, setSelected] = useState('')
  const [deck, setDeck] = useState<Deck | null>(null)
  const [index, setIndex] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [figure, setFigure] = useState('')
  const [figure2, setFigure2] = useState('')

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

  useEffect(() => {
    if (
      !current ||
      !pdfRef.current ||
      current.figureTop == null ||
      current.figureBottom == null
    ) {
      setFigure('')
      setFigure2('')
      return
    }
    let cancelled = false
    const pdf = pdfRef.current
    renderBandDataUrl(pdf, current.page, current.figureTop, current.figureBottom)
      .then((url) => {
        if (!cancelled) setFigure(url)
      })
      .catch(() => {
        if (!cancelled) setFigure('')
      })
    if (current.figureTop2 != null && current.figureBottom2 != null) {
      renderBandDataUrl(
        pdf,
        current.page2 || current.page,
        current.figureTop2,
        current.figureBottom2,
      )
        .then((url) => {
          if (!cancelled) setFigure2(url)
        })
        .catch(() => {
          if (!cancelled) setFigure2('')
        })
    } else {
      setFigure2('')
    }
    return () => {
      cancelled = true
    }
  }, [current])

  async function onFile(file: File) {
    setError('')
    setUnits([])
    setModels([])
    setDeck(null)
    setSelected('')
    setFileName(file.name)
    setBusy(true)
    setStatus('PDF okunuyor…')
    try {
      const pdf = await loadPdf(file)
      pdfRef.current = pdf
      const pages = await extractPageModels(pdf, (done, all) => {
        setStatus(`Sayfalar okunuyor… ${done} / ${all}`)
      })
      const found = findUnits(pages.map((p) => p.text))
      setModels(pages)
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
    if (!unit || !models.length) return
    setError('')
    const next = blendDeck(unit, models)
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
        Kitap PDF’ini yükleyin, üniteyi seçin. Konu başlıkları slayta yazılır;
        içerik kitaptan kırpılıp yapıştırılır. Uzun sorular alınmaz; ünite
        soruları en sonda durur.
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
                {current.layout === 'crop' || (!current.prompt && figure) ? (
                  figure ? (
                    figure2 ? (
                      <div className="mk-pair">
                        <img src={figure} alt="" />
                        <img src={figure2} alt="" />
                      </div>
                    ) : (
                      <img className="mk-crop" src={figure} alt="" />
                    )
                  ) : (
                    <p className="mk-wait">Kitap kırpılıyor…</p>
                  )
                ) : (
                <div
                  className={`mk-card layout-${current.layout || 'prose'} ${
                    figure
                      ? current.figureRole === 'hero' || current.layout === 'math'
                        ? 'hero-fig'
                        : 'with-fig'
                      : ''
                  }`}
                >
                  {figure ? (
                    <img className="mk-fig" src={figure} alt="" />
                  ) : null}
                  <div className="mk-copy">
                    {current.pill ? (
                      <span
                        className={`mk-pill ${/etkinlik/i.test(current.pill) ? 'green' : ''}`}
                      >
                        {current.pill}
                      </span>
                    ) : null}
                    {current.prompt ? (
                      <p
                        className={`mk-prompt ${current.layout === 'math' && !figure ? 'math' : ''}`}
                      >
                        {current.prompt}
                      </p>
                    ) : null}
                    {current.layout === 'steps' && current.bullets.length ? (
                      <div className={`mk-steps cols-${current.bullets.length > 2 ? 2 : 1}`}>
                        {current.bullets.map((bit, i) => {
                          const { head, body } = stepBits(bit)
                          return (
                            <div key={bit} className="mk-step">
                              <strong>{head || `${i + 1}. Adım`}</strong>
                              <span>{body}</span>
                            </div>
                          )
                        })}
                      </div>
                    ) : null}
                    {current.layout === 'open' && current.parts.length ? (
                      <ol className="mk-parts">
                        {current.parts.map((part, i) => {
                          const { letter, text } = choiceBits(part)
                          return (
                            <li key={part}>
                              <em>{letter || String.fromCharCode(97 + i)}</em>
                              <span>{text || part}</span>
                            </li>
                          )
                        })}
                      </ol>
                    ) : null}
                    {current.layout === 'mcq' && current.choices.length ? (
                      <ul
                        className={`mk-choices cols-${
                          current.choices.some((c) => c.length > 42) ||
                          current.choices.length <= 3 ||
                          figure
                            ? 1
                            : 2
                        }`}
                      >
                        {current.choices.map((choice) => {
                          const { letter, text } = choiceBits(choice)
                          return (
                            <li key={choice}>
                              {letter ? <b>{letter}</b> : null}
                              <span>{text || choice}</span>
                            </li>
                          )
                        })}
                      </ul>
                    ) : null}
                  </div>
                </div>
                )}
              </>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="empty-home">
          <h2>Ünite slaytı yok</h2>
          <p>
            PDF yükleyip üniteyi seçin. Kitap sırası korunur; kırpılan parçalar
            slayta yapıştırılır. Beğenirseniz PowerPoint indirin.
          </p>
        </section>
      )}
    </div>
  )
}
