export default function handler(req: { method?: string }, res: {
  setHeader: (k: string, v: string) => void
  status: (n: number) => { json: (v: unknown) => void }
}) {
  if (req.method !== 'GET') {
    res.status(405).json({ detail: 'Method not allowed' })
    return
  }
  const key = (process.env.GEMINI_API_KEY || '').trim()
  const hasApiKey = Boolean(key) && !key.toLowerCase().startsWith('your_')
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({
    maxUploadMb: 0,
    hasApiKey,
    modelName: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  })
}
