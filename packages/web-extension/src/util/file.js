
import axios from 'axios'

export function readFileToBase64(url) {
  return new Promise((resolve, reject) => {
    ;(async () => {
      let body = null
      try {
        // Replace axios with fetch for Service Worker compatibility
        const res = await fetch(url)
        body = await res.blob()
      } catch (e) {
        return reject(e)
      }
      if (body != null) {
        const reader = new FileReader()
        reader.readAsDataURL(body)
        reader.onloadend = function () {
          var base64data = reader.result
          resolve(base64data)
        }
        reader.onerror = function (e) {
          reject(e)
        }
      }
    })()
  })
}