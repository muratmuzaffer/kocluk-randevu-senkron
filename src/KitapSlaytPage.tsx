import { useEffect, useMemo, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import {
  extractPageModels,
  findUnits,
  kindCounts,
  loadPdf,
  renderPageDataUrl,
  type Deck,
  type Unit,
} from './lib/pdfSlides'
import {
  buildKitapDeck,
  konuUrl,
  kitapViews,
  downloadKitapPptx,
  uniteUrl,
} from './lib/kitapPages'
import { unitTitle } from './lib/pptxFromPages'
import './SlaytPage.css'
import './KitapSlaytPage.css'

type Props = {
  active: boolean
}

export default function KitapSlaytPage({ active }: Props) {
  const pdfRef = useRef<PDFDocumentProxy | null>(null)
  const [fileName, setFileName] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [units, setUnits] = useState<Unit[]>([])
  const [models, setModels] = useState<Awaited<ReturnType<typeof extractPageModels>>>([])
  const [selected, setSelected] = useState('')
  const [deck, setDeck] = useState<Deck | null>(null)
  const [index, setIndex] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [pageImage, setPageImage] = useState('')

  const unit = units.find((u) => u.id === selected) ?? null
  const counts = useMemo(() => (deck ? kindCounts(deck) : null), [deck])
  const views = useMemo(() => (deck ? kitapViews(deck) : []), [deck])
  const view = views[index] ?? null
  const total = views.length

  useEffect(() => {
    if (!deck || !active) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(total - 1, i + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [deck, active, total])

  useEffect(() => {
    if (view?.role !== 'page' || !pdfRef.current) {
      setPageImage('')
      return
    }
    let cancelled = false
    const pdf = pdfRef.current
    const page = view.page
    void renderPageDataUrl(pdf, page, 1.45, true).then((url) => {
      if (!cancelled) setPageImage(url)
    })
    return () => {
      cancelled = true
    }
  }, [view])

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
          : 'Ünite başlığı bulunamadı. PDF içinde “4. TEMA” benzeri başlık olmalı.',
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
    const next = buildKitapDeck(unit, models)
    setDeck(next)
    setIndex(0)
    setStatus(`${unit.number}. tema: kapak fotoğrafı bir kez, konu başlıkları ayrı şablon.`)
  }

  async function download() {
    if (!deck || !pdfRef.current) return
    setExporting(true)
    setError('')
    try {
      await downloadKitapPptx(pdfRef.current, deck, (done, all) => {
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
        Kitap PDF’ini yükleyin. İlk slaytta ünite adı kapak fotoğrafına yazılır;
        konu başlıklarında yalnızca kareli şablon kullanılır. İçerik kitaptan
        alınır, uydurulmaz.
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
          <span className="pill">Kapak 1 kez</span>
          <span className="pill">Konu şablonu</span>
          <span className="pill">Hazır mıyız {counts.hazir}</span>
          <span className="pill">Başlayalım {counts.basla}</span>
          <span className="pill">Konu {counts.giris}</span>
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
              {index + 1} / {total}
              {view.role === 'page' ? ` · s. ${view.page}` : ` · ${view.role === 'cover' ? 'Kapak' : view.role === 'title' ? 'Başlık' : 'Kapanış'}`}
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
              {exporting ? 'Hazırlanıyor…' : 'PPTX indir'}
            </button>
          </div>
          <div className="mk-slide" data-role={view.role}>
            {view.role === 'cover' ? (
              <>
                <img className="mk-bg" src={uniteUrl} alt="Ünite kapağı" />
                <div className="ks-cover-copy">
                  <p>{view.kicker}</p>
                  <h2>{view.title}</h2>
                </div>
              </>
            ) : null}
            {view.role === 'title' ? (
              <>
                <img className="mk-bg" src={konuUrl} alt="" />
                <h2 className="ks-konu-title">{view.title}</h2>
              </>
            ) : null}
            {view.role === 'page' ? (
              <div className="ks-chrome">
                <header>
                  <p className="ks-logo">
                    <span className="mat">Mat</span>Keys
                  </p>
                  <h2>{view.title}</h2>
                  <span className="ks-logo" aria-hidden="true" />
                </header>
                <div className="ks-page">
                  {pageImage ? (
                    <img src={pageImage} alt={`Kitap s.${view.page}`} />
                  ) : (
                    <p className="mk-wait">Kitap sayfası hazırlanıyor…</p>
                  )}
                </div>
                <footer>
                  <p className="ks-logo">
                    <span className="mat">Mat</span>Keys
                  </p>
                </footer>
              </div>
            ) : null}
            {view.role === 'close' ? (
              <div className="ks-chrome">
                <header>
                  <p className="ks-logo">
                    <span className="mat">Mat</span>Keys
                  </p>
                  <h2>Kapanış</h2>
                </header>
                <div className="ks-close">
                  <h2>{unitTitle(deck)}</h2>
                </div>
                <footer>
                  <p className="ks-logo">
                    <span className="mat">Mat</span>Keys
                  </p>
                </footer>
              </div>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="empty-home">
          <h2>Kitap slaytı yok</h2>
          <p>
            PDF yükleyip üniteyi seçin. Kapak fotoğrafı bir kez kullanılır; konu
            başlıkları diğer şablona yazılır.
          </p>
        </section>
      )}
    </div>
  )
}
