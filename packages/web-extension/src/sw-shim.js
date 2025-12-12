// Shims that must run *before* any other background dependencies.
// MV3 service worker has no `window` and often no DOMParser.
// Some bundled deps check `typeof window !== 'undefined'` and may fall back to Node-only `require(...)`
// if DOMParser is missing. Provide minimal shims to prevent SW startup crash.

if (typeof globalThis.window === 'undefined') {
  globalThis.window = globalThis
}

if (typeof globalThis.DOMParser === 'undefined') {
  globalThis.DOMParser = class DOMParser {
    parseFromString() {
      return {
        getElementById() {
          return null
        },
      }
    }
  }
}


