// Recent recall search keywords stored on device.
import { readJson, writeJson } from './storage'

const KEY = 'rg-search-history-v1'
const MAX_SEARCHES = 20

function load(): string[] {
  return readJson<string[]>(KEY) ?? []
}

export function getSearchHistory(): string[] {
  return load()
}

export function saveSearch(keyword: string): void {
  const term = keyword.trim()
  if (!term) return
  const existing = load().filter((k) => k.toLowerCase() !== term.toLowerCase())
  writeJson(KEY, [term, ...existing].slice(0, MAX_SEARCHES))
}

export function removeSearch(keyword: string): void {
  writeJson(KEY, load().filter((k) => k !== keyword))
}

export function clearSearchHistory(): void {
  writeJson(KEY, [])
}
