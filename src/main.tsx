import { StrictMode, Suspense, lazy, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { pathOf } from './lib/nav'
import './index.css'

const SlaytPage = lazy(() => import('./SlaytPage.tsx'))

function Root() {
  const [path, setPath] = useState(pathOf())
  useEffect(() => {
    const onPop = () => setPath(pathOf())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  if (path.startsWith('/slayt')) {
    return (
      <Suspense fallback={<p className="slayt-boot">Slayt sayfası yükleniyor…</p>}>
        <SlaytPage />
      </Suspense>
    )
  }
  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
