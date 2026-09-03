export const config = { maxDuration: 60 }

type UnitHint = { no: number; title: string; start: number; end: number }

type GeminiOutline = {
  kitap_adi?: string
  temalar?: { tema_no?: number; tema_basligi?: string }[]
}

function hasKey() {
  const key = (process.env.GEMINI_API_KEY || '').trim()
  return Boolean(key) && !key.toLowerCase().startsWith('your_')
}

async function geminiOutline(toc: string, hints: UnitHint[]) {
  const key = (process.env.GEMINI_API_KEY || '').trim()
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  const hintText = hints
    .map((u) => `${u.no}. TEMA ${u.title} (s.${u.start}-${u.end})`)
    .join('\n')
  const prompt = `Sen bir kitap analistisin. Uydurma ünite ekleme.
Aşağıdaki içindekiler / kapak metninden kitap adını ve gerçek ünite başlıklarını çıkar.
Yerel ipuçları varsa numarayı koru, başlığı kitaptaki haliyle düzelt.

Yerel ünite ipuçları:
${hintText || '(yok)'}

--- METİN ---
${(toc || '').slice(0, 18000)}

Yalnızca JSON yaz:
{"kitap_adi":"...","temalar":[{"tema_no":4,"tema_basligi":"..."}]}`

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          maxOutputTokens: 4096,
        },
      }),
    },
  )
  const payload = (await response.json()) as {
    error?: { message?: string }
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }
  if (!response.ok) {
    const message = payload.error?.message || `Gemini HTTP ${response.status}`
    if (String(response.status) === '429' || /quota|resource/i.test(message)) {
      throw new Error('Gemini kotası doldu. Biraz bekleyip aynı kitabı tekrar analiz edin.')
    }
    throw new Error(`Gemini API hatası: ${message}`)
  }
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const parsed = JSON.parse(text) as GeminiOutline
  return parsed
}

export default async function handler(
  req: { method?: string; body?: { filename?: string; toc?: string; units?: UnitHint[] } },
  res: { status: (n: number) => { json: (v: unknown) => void } },
) {
  if (req.method !== 'POST') {
    res.status(405).json({ detail: 'Method not allowed' })
    return
  }
  if (!hasKey()) {
    res.status(503).json({
      detail: 'GEMINI_API_KEY tanımlı değil. Vercel ortam değişkenine Google AI Studio anahtarınızı yazın.',
    })
    return
  }

  const filename = String(req.body?.filename || 'kitap.pdf')
  const toc = String(req.body?.toc || '')
  const hints = Array.isArray(req.body?.units) ? req.body.units : []

  try {
    const outline = await geminiOutline(toc, hints)
    const titles = new Map<number, string>()
    for (const tema of outline.temalar || []) {
      if (tema.tema_no && tema.tema_basligi) titles.set(tema.tema_no, tema.tema_basligi)
    }
    const units = hints.map((unit) => ({
      ...unit,
      title: titles.get(unit.no) || unit.title,
    }))
    res.status(200).json({
      kitap_adi: outline.kitap_adi || filename.replace(/\.pdf$/i, ''),
      units,
      modelName: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gemini analizi başarısız'
    res.status(502).json({ detail: message })
  }
}
