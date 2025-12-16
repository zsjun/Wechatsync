// MV3: 使用外部脚本注入替代内联脚本，避免 CSP 问题
// inject.js 包含 $poster/$syncer API 的实现

setTimeout(function () {
  // 使用外部脚本注入（MV3 兼容）
  var script = document.createElement('script')
  script.src = chrome.runtime.getURL('inject.js')
  script.onload = function () {
    console.log('[WCS] inject.js loaded')
    this.remove()
  }
  script.onerror = function () {
    console.error('[WCS] Failed to load inject.js')
  }
  ;(document.head || document.documentElement).appendChild(script)
}, 50)

// Ensure page.js functionality is available even if content script fails to load
// This is a fallback for cases where page.js doesn't inject properly
// Only run in main frame (not in iframes)
if (window.self === window.top) {
  setTimeout(function () {
    // Check if page.js has loaded by checking for its global functions
    if (typeof window.initPageFetch === 'undefined') {
      console.warn('[WCS] page.js not detected, attempting to inject programmatically')
      // Get current tab ID first
      chrome.runtime.sendMessage({ action: 'getCurrentTab' }, function(tabResponse) {
        if (chrome.runtime.lastError) {
          console.error('[WCS] Could not get current tab:', chrome.runtime.lastError.message)
          return
        }
        // Try to inject page.js via scripting API (requires background script coordination)
        chrome.runtime.sendMessage({
          action: 'ensurePageScript',
          url: window.location.href,
          tabId: tabResponse && tabResponse.tabId ? tabResponse.tabId : null
        }, function(response) {
          if (chrome.runtime.lastError) {
            console.error('[WCS] Could not request page.js injection:', chrome.runtime.lastError.message)
            console.error('[WCS] Error details:', chrome.runtime.lastError)
          } else if (response && response.error) {
            console.error('[WCS] page.js injection failed:', response.error)
            if (response.stack) {
              console.error('[WCS] Error stack:', response.stack)
            }
          } else {
            console.log('[WCS] page.js injection requested successfully:', response)
            // Wait a bit and check if it loaded
            setTimeout(function() {
              if (typeof window.initPageFetch !== 'undefined') {
                console.log('[WCS] page.js successfully loaded after injection')
              } else {
                console.warn('[WCS] page.js still not detected after injection attempt')
              }
            }, 2000)
          }
        })
      })
    } else {
      console.log('[WCS] page.js already loaded')
    }
  }, 1000)
} else {
  console.log('[WCS] api.js running in iframe, skipping page.js injection check')
}

var allAccounts = []
var accounts = []

function getAccounts(cb) {
  chrome.runtime.sendMessage(
    {
      action: 'getAccount',
    },
    function (resp) {
      allAccounts = resp
      cb && cb()
    }
  )
}

if (window.location.href.indexOf('mp.weixin.qq.com') == -1) {
  // getAccounts()
}

function sendToWindow(msg) {
  // Some inpage scripts (e.g. MetaMask) listen to window "message" events and may
  // crash if `event.data` is undefined. Ensure we never postMessage(undefined).
  // Also ensure payload is JSON-serializable.
  var payload = msg
  if (payload == null || (typeof payload !== 'object' && typeof payload !== 'function')) {
    payload = { result: payload }
  }

  try {
    payload.callReturn = true
  } catch (e) {
    payload = { callReturn: true, result: null }
  }

  var data
  try {
    data = JSON.stringify(payload)
  } catch (e) {
    data = JSON.stringify({
      callReturn: true,
      result: null,
      error: 'WCS: sendToWindow payload is not JSON-serializable',
    })
  }

  // JSON.stringify(function(){}) returns undefined, which would break other listeners.
  if (typeof data !== 'string') {
    data = JSON.stringify({
      callReturn: true,
      result: null,
      error: 'WCS: sendToWindow payload stringify returned non-string',
    })
  }

  window.postMessage(data, '*')
}

chrome.runtime.onMessage.addListener(function (request, sender, sendResponseA) {
  try {
    console.log('revice', request)
    if (request.method == 'taskUpdate') {
      // if(_statushandler != null) {
      //   _statushandler(request.task)
      // }
      // window.postMessage
      sendToWindow({
        task: request.task,
        method: 'taskUpdate',
      })
    }

    if (request.method == 'consoleLog') {
      sendToWindow({
        args: request.args,
        method: 'consoleLog',
      })
    }
  } catch (e) {
    console.log(e)
  }
})

var _statushandler = null
var _sensitiveAPIWhiteList = [
  'https://www.wechatsync.com',
  'https://developer.wechatsync.com',
  'http://localhost:8080',
]

window.addEventListener('message', function (evt) {
  // if (evt.origin == 'https://www.wechatsync.com') {
  // console.log('from page', evt)
  try {
    if (typeof evt.data !== 'string') return
    var action = JSON.parse(evt.data)
    if (action.method == 'getAccounts') {
      getAccounts(function () {
        sendToWindow({
          eventID: action.eventID,
          result: allAccounts,
        })
      })
    }
    if (action.method == 'addTask') {
      chrome.runtime.sendMessage(
        {
          action: 'addTask',
          task: action.task,
        },
        function (resp) {
          console.log('addTask return', resp)
        }
      )
    }

    if (action.method == 'magicCall') {
      chrome.extension.sendMessage(
        {
          action: 'callDriverMethod',
          methodName: action.methodName,
          data: action.data,
        },
        function (resp) {
          sendToWindow({
            eventID: action.eventID,
            result: resp,
          })
        }
      )
    }

    if (_sensitiveAPIWhiteList.indexOf(evt.origin) > -1) {
      if (action.method == 'updateDriver') {
        chrome.extension.sendMessage(
          {
            action: 'updateDriver',
            data: action.data,
          },
          function (resp) {
            sendToWindow({
              eventID: action.eventID,
              result: resp,
            })
          }
        )
      }

      if (action.method == 'startInspect') {
        chrome.extension.sendMessage(
          {
            action: 'startInspect',
          },
          function (resp) {
            sendToWindow({
              eventID: action.eventID,
              result: resp,
            })
          }
        )
      }
    }
  } catch (e) {}
  // }
})
