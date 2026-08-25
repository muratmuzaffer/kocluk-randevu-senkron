import { next } from '@vercel/edge'

export const config = {
  matcher: ['/((?!assets/).*)'],
}

const COOKIE = 'tce_auth'

function ok(user: string, pass: string) {
  const u = process.env.BASIC_AUTH_USER
  const p = process.env.BASIC_AUTH_PASSWORD
  return Boolean(u && p && user === u && pass === p)
}

function parseBasic(header: string | null) {
  if (!header?.startsWith('Basic ')) return null
  try {
    const decoded = atob(header.slice(6))
    const i = decoded.indexOf(':')
    return {
      user: i >= 0 ? decoded.slice(0, i) : decoded,
      pass: i >= 0 ? decoded.slice(i + 1) : '',
    }
  } catch {
    return null
  }
}

function loginPage(error = false) {
  const html = `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Giriş · Tarık Can Erdoğan</title>
  <style>
    :root { color-scheme: light; font-family: "Segoe UI", system-ui, sans-serif; }
    body {
      margin: 0; min-height: 100vh; display: grid; place-items: center;
      background: linear-gradient(180deg, #dfe6ee 0%, #e9edf2 40%, #e9edf2 100%);
      color: #1f2328;
    }
    form {
      width: min(360px, calc(100% - 2rem));
      background: #fff; border: 1px solid #d7dde6; border-radius: 12px;
      padding: 1.4rem 1.35rem 1.25rem; box-shadow: 0 10px 30px rgba(31,35,40,.06);
      display: grid; gap: .7rem;
    }
    h1 { margin: 0; font-size: 1.15rem; }
    p { margin: 0; color: #5b6472; font-size: .92rem; }
    label { display: grid; gap: .3rem; font-size: .85rem; font-weight: 600; }
    input {
      border: 1px solid #d7dde6; border-radius: 8px; padding: .65rem .75rem;
      font: inherit;
    }
    button {
      margin-top: .25rem; border: 0; border-radius: 8px; padding: .7rem .9rem;
      background: #217346; color: #fff; font: inherit; font-weight: 700; cursor: pointer;
    }
    .err { color: #c0392b; font-size: .85rem; font-weight: 600; min-height: 1.2em; }
  </style>
</head>
<body>
  <form method="POST" action="/__login">
    <div>
      <p>Tarık Can Erdoğan</p>
      <h1>Randevu tahtası girişi</h1>
    </div>
    <label>Kullanıcı adı
      <input name="user" autocomplete="username" required />
    </label>
    <label>Şifre
      <input name="pass" type="password" autocomplete="current-password" required />
    </label>
    <div class="err">${error ? 'Kullanıcı adı veya şifre hatalı.' : ''}</div>
    <button type="submit">Giriş yap</button>
  </form>
</body>
</html>`
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

export default async function middleware(request: Request) {
  const userEnv = process.env.BASIC_AUTH_USER
  const passEnv = process.env.BASIC_AUTH_PASSWORD
  if (!userEnv || !passEnv) return next()

  const url = new URL(request.url)

  if (url.pathname === '/__logout') {
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/',
        'Set-Cookie': `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
        'Cache-Control': 'no-store',
      },
    })
  }

  if (url.pathname === '/__login' && request.method === 'POST') {
    const form = await request.formData()
    const user = String(form.get('user') ?? '')
    const pass = String(form.get('pass') ?? '')
    if (!ok(user, pass)) return loginPage(true)

    const token = encodeURIComponent(btoa(`${user}:${pass}`))
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/',
        'Set-Cookie': `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`,
        'Cache-Control': 'no-store',
      },
    })
  }

  const cookie = request.headers.get('cookie') || ''
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`))
  if (match) {
    try {
      const basic = parseBasic(`Basic ${decodeURIComponent(match[1])}`)
      if (basic && ok(basic.user, basic.pass)) return next()
    } catch {
      // geçersiz çerez
    }
  }

  const headerBasic = parseBasic(request.headers.get('authorization'))
  if (headerBasic && ok(headerBasic.user, headerBasic.pass)) return next()

  return loginPage(false)
}
