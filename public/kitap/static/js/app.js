(() => {
  const root = document.getElementById("app");
  let config = window.APP_CONFIG || { maxUploadMb: 0, hasApiKey: false, modelName: "gemini-2.5-flash" };
  const IMG = "/kitap/static/img";

  const state = {
    view: "home",
    job: null,
    analysis: null,
    themeIndex: 0,
    slideIndex: 0,
    quizReveal: {},
    dragging: false,
    error: null,
    pollTimer: null,
    pdf: null,
    pageUrls: {},
  };

  function $(sel, el = document) {
    return el.querySelector(sel);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function fold(text) {
    return (text || "")
      .toLocaleUpperCase("tr-TR")
      .replaceAll("İ", "I")
      .replaceAll("Ş", "S")
      .replaceAll("Ğ", "G")
      .replaceAll("Ü", "U")
      .replaceAll("Ö", "O")
      .replaceAll("Ç", "C");
  }

  function heading(text, fallback) {
    for (const raw of (text || "").split(/\n+/)) {
      const line = raw.replace(/\s+/g, " ").trim();
      if (!line || line.length > 48) continue;
      const folded = line.toLocaleLowerCase("tr-TR").replace(/:$/, "");
      if (folded.includes("hazır mıyız") || folded.includes("hazir miyiz")) return "HAZIR MIYIZ?";
      if (folded.includes("başlayalım") || folded.includes("baslayalim")) return "BAŞLAYALIM";
      if (folded.includes("izleme testi")) return "İZLEME TESTİ";
      if (folded.includes("ölçme ve değerlendirme") || folded.includes("olcme ve degerlendirme")) {
        return "ÖLÇME VE DEĞERLENDİRME";
      }
      const words = line.split(/\s+/);
      const letters = (line.match(/[A-Za-zÇĞİÖŞÜçğıöşü]/g) || []).length;
      const upper = [...line].filter((ch) => ch === ch.toLocaleUpperCase("tr-TR") && /[A-ZÇĞİÖŞÜ]/.test(ch)).length;
      if (words.length >= 2 && words.length <= 8 && letters && upper / Math.max(line.length, 1) >= 0.45) {
        return line.replace(/:$/, "").toLocaleUpperCase("tr-TR");
      }
    }
    return fallback;
  }

  function classifyPage(text, unitTitle) {
    const folded = (text || "").toLocaleLowerCase("tr-TR");
    if (folded.includes("hazır mıyız") || folded.includes("hazir miyiz")) return ["hazir", "HAZIR MIYIZ?"];
    if (folded.includes("başlayalım") || folded.includes("baslayalim")) return ["basla", "BAŞLAYALIM"];
    if (folded.includes("izleme testi") || folded.includes("ölçme ve değerlendirme")) {
      return ["soru", heading(text, "SORULAR")];
    }
    return ["konu", heading(text, unitTitle)];
  }

  function findUnits(pages) {
    const best = new Map();
    pages.forEach((page, i) => {
      const t = fold(page.text);
      if (t.includes("ICINDEKILER") || t.includes("KITABIMIZI TANIYALIM")) return;
      for (const match of t.matchAll(/(\d+)\s*\.\s*TEMA/g)) {
        const no = Number(match[1]);
        if (best.has(no)) continue;
        const after = (page.text.match(new RegExp(String(no) + "\\s*\\.\\s*TEMA\\s*[:.]?\\s*([^\\d]{4,80})", "i")) || [])[1] || "";
        const title = after.replace(/\s+/g, " ").trim().slice(0, 55) || `${no}. tema`;
        best.set(no, { no, title, start: i + 1 });
      }
    });
    const hits = [...best.values()].sort((a, b) => a.start - b.start || a.no - b.no);
    return hits.map((hit, i) => ({
      no: hit.no,
      title: hit.title,
      start: hit.start,
      end: i + 1 < hits.length ? hits[i + 1].start - 1 : pages.length,
    }));
  }

  function extractUnit(unit, pages) {
    const konular = [];
    let bucket = [];
    let bucketKind = "";
    let bucketTitle = unit.title;
    const flush = () => {
      if (!bucket.length) return;
      const label = bucketKind === "konu" ? bucketTitle : bucketTitle;
      const slides = [...bucket];
      const needsTitle =
        ["hazir", "basla", "soru"].includes(bucketKind) ||
        (bucketKind === "konu" && label.toLocaleLowerCase("tr-TR") !== unit.title.toLocaleLowerCase("tr-TR"));
      if (needsTitle) {
        slides.unshift({
          slayt_basligi: label,
          maddeler: [],
          konusmaci_notu: "",
          sayfa_no: null,
          tur: "baslik",
        });
      }
      konular.push({ konu_basligi: label, slaytlar: slides });
      bucket = [];
    };
    for (let page = unit.start; page <= unit.end; page++) {
      const text = pages[page - 1]?.text || "";
      const [kind, title] = classifyPage(text, unit.title);
      if (bucket.length && (kind !== bucketKind || (title !== bucketTitle && title !== unit.title))) flush();
      bucketKind = kind;
      bucketTitle = title;
      bucket.push({
        slayt_basligi: title,
        maddeler: [`Kitap s.${page}`],
        konusmaci_notu: `Kitap s.${page}`,
        sayfa_no: page,
        tur: kind,
      });
    }
    flush();
    return {
      tema_no: unit.no,
      tema_basligi: unit.title,
      konular: konular.length
        ? konular
        : [{
            konu_basligi: unit.title,
            slaytlar: [{ slayt_basligi: unit.title, maddeler: [`Kitap s.${unit.start}`], konusmaci_notu: "", sayfa_no: unit.start, tur: "konu" }],
          }],
      pekistirme_sorulari: [],
    };
  }

  function flattenSlides(theme) {
    const slides = [
      { kind: "cover", title: theme.tema_basligi, kicker: `${theme.tema_no}. TEMA` },
    ];
    for (const konu of theme.konular) {
      for (const slayt of konu.slaytlar) {
        slides.push({
          kind: slayt.tur === "baslik" ? "title" : slayt.sayfa_no ? "page" : "content",
          kicker: konu.konu_basligi,
          title: slayt.slayt_basligi,
          maddeler: slayt.maddeler,
          note: slayt.konusmaci_notu,
          sayfa_no: slayt.sayfa_no,
          tur: slayt.tur || "konu",
          tema_no: theme.tema_no,
        });
      }
    }
    slides.push({ kind: "close", title: theme.tema_basligi, kicker: "KAPANIS" });
    return slides;
  }

  function currentTheme() {
    return state.analysis?.temalar?.[state.themeIndex] || null;
  }

  function currentSlides() {
    const theme = currentTheme();
    return theme ? flattenSlides(theme) : [];
  }

  function header() {
    return `
      <header class="border-b border-navy/10 bg-white/70 backdrop-blur">
        <div class="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <button data-action="home" class="flex items-center gap-3 text-left">
            <span class="grid h-10 w-10 place-items-center rounded-xl bg-navy text-sand font-display text-lg">K</span>
            <span>
              <span class="block font-display text-xl leading-none text-navy">Kitap Slayt</span>
              <span class="text-xs text-navy/60">PDF → tema → slayt → pekiştirme</span>
            </span>
          </button>
          <div class="hidden sm:flex items-center gap-2 text-xs text-navy/60">
            <a href="/" class="rounded-full border border-navy/15 px-3 py-1 text-navy">Randevu tahtası</a>
            <span class="rounded-full bg-teal/10 px-3 py-1 text-teal">${escapeHtml(config.modelName || "gemini-2.5-flash")}</span>
            ${config.hasApiKey ? '<span class="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">API anahtarı hazır</span>' : '<span class="rounded-full bg-amber-50 px-3 py-1 text-amber-800">GEMINI_API_KEY ekleyin</span>'}
          </div>
        </div>
      </header>
    `;
  }

  function homeView() {
    return `
      ${header()}
      <main class="mx-auto max-w-6xl px-5 py-12">
        <div class="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] items-center">
          <div>
            <p class="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-teal">Eğitim tasarımı</p>
            <h1 class="font-display text-4xl leading-tight text-navy sm:text-5xl">Kitabı yükleyin, slayt ders paketini alın.</h1>
            <p class="mt-5 max-w-xl text-lg text-navy/70">Slaytlar kitaptan alınır, uydurulmaz. Gemini ünite adlarını kitaptan çıkarır; her ünite MatKeys formatında ayrı PPTX olur.</p>
            <ul class="mt-8 grid gap-3 text-sm text-navy/80 sm:grid-cols-3">
              <li class="rounded-2xl bg-white p-4 shadow-sm">Tema ve konu haritası</li>
              <li class="rounded-2xl bg-white p-4 shadow-sm">Slayt + konuşmacı notu</li>
              <li class="rounded-2xl bg-white p-4 shadow-sm">A-D pekiştirme soruları</li>
            </ul>
          </div>
          <form id="upload-form" class="rounded-3xl bg-white p-6 shadow-xl shadow-navy/5">
            <label id="dropzone" class="dropzone flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-navy/20 bg-sand/60 px-6 py-12 text-center">
              <input id="file-input" type="file" accept="application/pdf,.pdf" class="hidden" />
              <div class="mb-3 grid h-14 w-14 place-items-center rounded-full bg-teal text-white text-2xl">↑</div>
              <p class="font-medium text-navy">PDF dosyasını sürükleyin veya seçin</p>
              <p class="mt-2 text-sm text-navy/55">Yalnızca kitap PDF · Gemini destekli</p>
              <p id="file-label" class="mt-4 hidden rounded-full bg-navy px-4 py-1 text-sm text-sand"></p>
            </label>
            <p id="form-error" class="mt-3 hidden text-sm text-red-700"></p>
            <button type="submit" class="mt-5 w-full rounded-2xl bg-navy px-5 py-3 font-medium text-sand transition hover:bg-teal">Analizi başlat</button>
          </form>
        </div>
      </main>
    `;
  }

  function processingView() {
    const job = state.job || {};
    return `
      ${header()}
      <main class="mx-auto max-w-xl px-5 py-20 text-center">
        <p class="text-sm uppercase tracking-[0.18em] text-teal">Gemini çalışıyor</p>
        <h1 class="mt-3 font-display text-3xl text-navy">Kitap çözümleniyor</h1>
        <p class="mt-3 text-navy/70">${escapeHtml(job.message || "Hazırlanıyor…")}</p>
        <div class="mt-8 h-3 overflow-hidden rounded-full bg-white">
          <div class="h-full rounded-full bg-teal transition-all" style="width:${job.progress || 5}%"></div>
        </div>
        <p class="mt-3 text-sm text-navy/50">${job.progress || 0}%</p>
        <p class="mt-8 text-sm text-navy/55">Uzun kitaplarda bu adım birkaç dakika sürebilir. Sayfayı kapatmayın.</p>
      </main>
    `;
  }

  function errorView() {
    return `
      ${header()}
      <main class="mx-auto max-w-lg px-5 py-20 text-center">
        <h1 class="font-display text-3xl text-navy">Analiz tamamlanamadı</h1>
        <p class="mt-4 rounded-2xl bg-red-50 p-4 text-red-800">${escapeHtml(state.error || "Bilinmeyen hata")}</p>
        <button data-action="home" class="mt-8 rounded-2xl bg-navy px-5 py-3 text-sand">Yeni kitap yükle</button>
      </main>
    `;
  }

  function matkeysFrame(title, inner) {
    return `
      <article class="slide-enter mx-auto max-w-5xl overflow-hidden rounded-xl border border-[#1a428a] bg-[#f7f8fb] shadow-xl">
        <div class="flex items-center justify-between bg-[#1a428a] px-5 py-3">
          <p class="text-xl font-bold"><span class="text-[#92d050]">Mat</span><span class="text-white">Keys</span></p>
          <p class="flex-1 text-center text-lg font-bold tracking-wide text-white">${escapeHtml((title || "").toLocaleUpperCase("tr-TR"))}</p>
          <span class="w-24"></span>
        </div>
        <div class="bg-[#f7f8fb]">${inner}</div>
        <div class="flex items-center justify-end bg-[#1a428a] px-5 py-2">
          <p class="text-lg font-bold"><span class="text-[#92d050]">Mat</span><span class="text-white">Keys</span></p>
        </div>
      </article>
    `;
  }

  function slideCard(slide) {
    if (slide.kind === "cover" || slide.kind === "theme") {
      return `
        <article class="slide-enter mx-auto max-w-5xl overflow-hidden rounded-xl border border-[#c5d8ea] bg-white shadow-xl">
          <div class="relative aspect-[16/9]">
            <img src="${IMG}/matkeys-unite.png" alt="" class="absolute inset-0 h-full w-full object-cover" />
            <div class="absolute inset-x-[16%] bottom-[3%] top-[76%] flex flex-col items-center justify-start text-center">
              <p class="text-xs font-bold uppercase tracking-[0.18em] text-[#1a428a] sm:text-sm">${escapeHtml(slide.kicker || "")}</p>
              <h2 class="mt-1 text-xl font-black uppercase leading-tight text-[#1a428a] sm:text-2xl">${escapeHtml(slide.title)}</h2>
            </div>
          </div>
        </article>
      `;
    }
    if (slide.kind === "title") {
      return `
        <article class="slide-enter mx-auto max-w-5xl overflow-hidden rounded-xl border border-[#c5d8ea] bg-white shadow-xl">
          <div class="relative aspect-[16/9]">
            <img src="${IMG}/matkeys-konu.png" alt="" class="absolute inset-0 h-full w-full object-cover" />
            <div class="absolute left-[53.6%] top-[49.6%] flex h-[24.7%] w-[34.1%] items-center justify-center bg-[#fcffff] px-3 text-center">
              <h2 class="text-xl font-black uppercase leading-tight text-[#1f1f1f] sm:text-2xl">${escapeHtml(slide.title)}</h2>
            </div>
          </div>
        </article>
      `;
    }
    if (slide.kind === "close") {
      return matkeysFrame(
        "KAPANIS",
        `<div class="grid min-h-[22rem] place-items-center px-8 py-16 text-center">
           <h2 class="text-3xl font-bold uppercase text-[#1a428a]">${escapeHtml(slide.title)}</h2>
         </div>`
      );
    }
    if (slide.kind === "page") {
      const src = state.pageUrls[slide.sayfa_no] || "";
      return matkeysFrame(
        slide.title,
        `<div class="grid min-h-[28rem] place-items-center bg-[#eef1f6] p-3">
           ${src ? `<img src="${src}" alt="Kitap s.${slide.sayfa_no}" class="max-h-[38rem] w-auto max-w-full shadow-md" />` : `<p class="text-navy/50">Kitap s.${slide.sayfa_no}</p>`}
         </div>`
      );
    }
    return `
      <article class="slide-enter min-h-[28rem] rounded-3xl bg-white p-8 shadow-xl">
        <p class="text-xs font-bold uppercase tracking-[0.18em] text-[#5170ff]">${escapeHtml(slide.kicker)}</p>
        <h2 class="mt-3 text-3xl font-bold uppercase leading-tight text-[#1f1f1f]">${escapeHtml(slide.title)}</h2>
        <ol class="mt-6 space-y-3">
          ${(slide.maddeler || [])
            .map(
              (m, i) => `
                <li class="flex gap-3 rounded-2xl bg-sand px-4 py-3">
                  <span class="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#5170ff] text-sm text-white">${i + 1}</span>
                  <span>${escapeHtml(m)}</span>
                </li>`
            )
            .join("")}
        </ol>
      </article>
    `;
  }

  function viewerView() {
    const analysis = state.analysis;
    const theme = currentTheme();
    const slides = currentSlides();
    const slide = slides[state.slideIndex] || slides[0];
    const themes = analysis.temalar
      .map(
        (t, i) => `
          <button data-action="select-theme" data-index="${i}" class="w-full rounded-xl px-3 py-2 text-left text-sm ${i === state.themeIndex ? "bg-[#92d050] text-[#1f1f1f]" : "bg-white text-navy hover:bg-sand"}">
            <span class="block font-medium">${t.tema_no}. ${escapeHtml(t.tema_basligi)}</span>
            <span class="block text-xs opacity-70">${t.konular.reduce((n, k) => n + k.slaytlar.length, 0)} kitap sayfası</span>
          </button>
        `
      )
      .join("");

    return `
      ${header()}
      <main class="mx-auto grid max-w-7xl gap-6 px-5 py-8 lg:grid-cols-[260px_1fr]">
        <aside class="space-y-3">
          <div class="rounded-2xl bg-navy p-4 text-sand">
            <p class="text-xs uppercase tracking-[0.16em] text-teal">Kitap</p>
            <h2 class="mt-1 font-display text-xl">${escapeHtml(analysis.kitap_adi)}</h2>
            <p class="mt-2 text-xs text-sand/70">${analysis.temalar.length} ünite · Gemini + MatKeys</p>
          </div>
          <div class="space-y-2">${themes}</div>
          <button data-action="download-unit" class="block w-full rounded-2xl bg-navy px-4 py-3 text-center text-sm text-sand">${theme.tema_no}. üniteyi PPTX indir</button>
          <a href="/" class="block rounded-2xl border border-navy/20 px-4 py-3 text-center text-sm text-navy">Randevu tahtası</a>
          <button data-action="home" class="w-full text-sm text-navy/60">Yeni kitap</button>
        </aside>
        <section>
          ${slide ? slideCard(slide) : ""}
          <div class="mt-5 flex items-center justify-between">
            <button data-action="prev" class="rounded-xl border border-navy/15 px-4 py-2 text-sm">← Önceki</button>
            <p class="text-sm text-navy/60">${state.slideIndex + 1} / ${slides.length}${slide?.sayfa_no ? ` · s. ${slide.sayfa_no}` : ""}</p>
            <button data-action="next" class="rounded-xl bg-navy px-4 py-2 text-sm text-sand">Sonraki →</button>
          </div>
        </section>
      </main>
    `;
  }

  function render() {
    if (state.view === "processing") root.innerHTML = processingView();
    else if (state.view === "error") root.innerHTML = errorView();
    else if (state.view === "viewer") root.innerHTML = viewerView();
    else root.innerHTML = homeView();
    bind();
    if (state.view === "viewer") void ensurePageImage();
  }

  function bind() {
    root.querySelectorAll("[data-action]").forEach((el) => el.addEventListener("click", onAction));
    const form = $("#upload-form");
    if (!form) return;
    const zone = $("#dropzone");
    const input = $("#file-input");
    form.addEventListener("submit", onSubmit);
    input.addEventListener("change", () => showFile(input.files[0]));
    ["dragenter", "dragover"].forEach((evt) => {
      zone.addEventListener(evt, (e) => {
        e.preventDefault();
        zone.classList.add("is-drag");
      });
    });
    ["dragleave", "drop"].forEach((evt) => {
      zone.addEventListener(evt, (e) => {
        e.preventDefault();
        zone.classList.remove("is-drag");
      });
    });
    zone.addEventListener("drop", (e) => {
      const file = e.dataTransfer.files[0];
      if (!file) return;
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      showFile(file);
    });
  }

  function showFile(file) {
    const label = $("#file-label");
    if (!file || !label) return;
    label.textContent = file.name;
    label.classList.remove("hidden");
  }

  async function waitPdfjs() {
    for (let i = 0; i < 40; i++) {
      if (window.pdfjsLib) return window.pdfjsLib;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error("PDF okuyucu yüklenemedi. Sayfayı yenileyin.");
  }

  async function extractPages(file) {
    const pdfjs = await waitPdfjs();
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    state.pdf = pdf;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push({
        no: i,
        text: content.items.map((item) => ("str" in item ? item.str : "")).join(" "),
      });
      if (i % 8 === 0 || i === pdf.numPages) {
        state.job = { progress: 8 + Math.round((40 * i) / pdf.numPages), message: `Sayfalar okunuyor… ${i} / ${pdf.numPages}` };
        render();
      }
    }
    return pages;
  }

  async function ensurePageImage() {
    const slide = currentSlides()[state.slideIndex];
    if (!slide?.sayfa_no || !state.pdf || state.pageUrls[slide.sayfa_no]) return;
    const page = await state.pdf.getPage(slide.sayfa_no);
    const viewport = page.getViewport({ scale: 1.45 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await page.render({ canvasContext: canvas.getContext("2d"), viewport, canvas }).promise;
    state.pageUrls[slide.sayfa_no] = canvas.toDataURL("image/jpeg", 0.82);
    render();
  }

  async function onSubmit(e) {
    e.preventDefault();
    const input = $("#file-input");
    const errorBox = $("#form-error");
    const file = input?.files?.[0];
    if (!file) {
      errorBox.textContent = "Önce bir PDF seçin.";
      errorBox.classList.remove("hidden");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      errorBox.textContent = "Yalnızca PDF yükleyebilirsiniz.";
      errorBox.classList.remove("hidden");
      return;
    }
    state.view = "processing";
    state.job = { progress: 4, message: "PDF okunuyor…" };
    state.pageUrls = {};
    render();
    try {
      const pages = await extractPages(file);
      const localUnits = findUnits(pages);
      state.job = { progress: 55, message: "Gemini ünite adlarını çıkarıyor…" };
      render();
      const toc = pages
        .slice(0, 25)
        .map((p) => `--- Sayfa ${p.no} ---\n${p.text}`)
        .join("\n")
        .slice(0, 18000);
      const res = await fetch("/api/kitap/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, toc, units: localUnits }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Gemini analizi başarısız");
      const units = data.units?.length ? data.units : localUnits;
      if (!units.length) throw new Error("Ünite başlığı bulunamadı. PDF içinde “4. TEMA” benzeri başlık olmalı.");
      state.analysis = {
        kitap_adi: data.kitap_adi || file.name.replace(/\.pdf$/i, ""),
        temalar: units.map((unit) => extractUnit(unit, pages)),
      };
      state.job = { id: "local", progress: 100, message: "Hazır", status: "done" };
      state.themeIndex = 0;
      state.slideIndex = 0;
      state.view = "viewer";
      render();
    } catch (err) {
      state.view = "error";
      state.error = err.message;
      render();
    }
  }

  async function downloadUnit() {
    const theme = currentTheme();
    if (!theme || !window.PptxGenJS) return;
    const pres = new window.PptxGenJS();
    pres.defineLayout({ name: "KITAP", width: 13.333, height: 7.5 });
    pres.layout = "KITAP";
    const slides = flattenSlides(theme);
    for (const slide of slides) {
      const s = pres.addSlide();
      if (slide.kind === "cover") {
        s.addImage({ path: `${IMG}/matkeys-unite.png`, x: 0, y: 0, w: 13.333, h: 7.5 });
        s.addText(slide.kicker, { x: 2.6, y: 5.72, w: 8.1, h: 0.38, fontSize: 16, bold: true, color: "1A428A", align: "center" });
        s.addText((slide.title || "").toLocaleUpperCase("tr-TR"), { x: 2.2, y: 6.05, w: 8.9, h: 1.15, fontSize: 20, bold: true, color: "1A428A", align: "center" });
      } else if (slide.kind === "title") {
        s.addImage({ path: `${IMG}/matkeys-konu.png`, x: 0, y: 0, w: 13.333, h: 7.5 });
        s.addShape(pres.ShapeType.rect, { x: 7.15, y: 3.72, w: 4.55, h: 1.85, fill: { color: "FCFFFF" }, line: { color: "FCFFFF" } });
        s.addText((slide.title || "").toLocaleUpperCase("tr-TR"), { x: 7.15, y: 3.72, w: 4.55, h: 1.85, fontSize: 24, bold: true, color: "1F1F1F", align: "center", valign: "middle" });
      } else if (slide.kind === "page") {
        if (!state.pageUrls[slide.sayfa_no] && state.pdf) {
          const page = await state.pdf.getPage(slide.sayfa_no);
          const viewport = page.getViewport({ scale: 1.35 });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          await page.render({ canvasContext: canvas.getContext("2d"), viewport, canvas }).promise;
          state.pageUrls[slide.sayfa_no] = canvas.toDataURL("image/jpeg", 0.8);
        }
        s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: "F7F8FB" } });
        s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.72, fill: { color: "1A428A" } });
        s.addShape(pres.ShapeType.rect, { x: 0, y: 7.02, w: 13.333, h: 0.48, fill: { color: "1A428A" } });
        s.addText((slide.title || "").toLocaleUpperCase("tr-TR"), { x: 3, y: 0.12, w: 7.4, h: 0.48, fontSize: 18, bold: true, color: "FFFFFF", align: "center" });
        if (state.pageUrls[slide.sayfa_no]) {
          s.addImage({ data: state.pageUrls[slide.sayfa_no], x: 1.2, y: 0.9, w: 10.9, h: 5.9 });
        }
      } else {
        s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: "F7F8FB" } });
        s.addText((slide.title || "").toLocaleUpperCase("tr-TR"), { x: 0.8, y: 2.6, w: 11.7, h: 2, fontSize: 28, bold: true, color: "1A428A", align: "center" });
      }
    }
    await pres.writeFile({ fileName: `${theme.tema_no}.TEMA ${theme.tema_basligi}.pptx` });
  }

  function onAction(e) {
    const action = e.currentTarget.dataset.action;
    const slides = currentSlides();
    if (action === "home") {
      state.view = "home";
      state.job = null;
      state.analysis = null;
      render();
    } else if (action === "select-theme") {
      state.themeIndex = Number(e.currentTarget.dataset.index);
      state.slideIndex = 0;
      render();
    } else if (action === "prev") {
      state.slideIndex = Math.max(0, state.slideIndex - 1);
      render();
    } else if (action === "next") {
      state.slideIndex = Math.min(slides.length - 1, state.slideIndex + 1);
      render();
    } else if (action === "download-unit") {
      void downloadUnit();
    }
  }

  document.addEventListener("keydown", (e) => {
    if (state.view !== "viewer") return;
    if (e.key === "ArrowRight") {
      state.slideIndex = Math.min(currentSlides().length - 1, state.slideIndex + 1);
      render();
    } else if (e.key === "ArrowLeft") {
      state.slideIndex = Math.max(0, state.slideIndex - 1);
      render();
    }
  });

  fetch("/api/kitap/config")
    .then((res) => res.json())
    .then((data) => {
      config = data;
      window.APP_CONFIG = data;
      render();
    })
    .catch(() => render());
})();
