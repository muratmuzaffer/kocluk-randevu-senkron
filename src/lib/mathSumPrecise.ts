const math = Math as Math & { sumPrecise?: (numbers: Iterable<number>) => number }
if (typeof math.sumPrecise !== 'function') {
  math.sumPrecise = (numbers) => {
    let sum = 0
    for (const n of numbers) sum += Number(n)
    return sum
  }
}

function installGetOrInsert<T extends Map<unknown, unknown> | WeakMap<object, unknown>>(
  proto: T,
) {
  const map = proto as T & {
    getOrInsertComputed?: (key: unknown, fn: (key: unknown) => unknown) => unknown
  }
  if (typeof map.getOrInsertComputed === 'function') return
  map.getOrInsertComputed = function (key, fn) {
    if (this.has(key as never)) return this.get(key as never)
    const value = fn(key)
    this.set(key as never, value as never)
    return value
  }
}

installGetOrInsert(Map.prototype)
installGetOrInsert(WeakMap.prototype)
