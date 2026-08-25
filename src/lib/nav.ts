export function pathOf() {
  return window.location.pathname
}

export function go(to: string) {
  if (pathOf() === to) return
  window.history.pushState({}, '', to)
  window.dispatchEvent(new PopStateEvent('popstate'))
}
