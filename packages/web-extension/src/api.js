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
  msg.callReturn = true
  window.postMessage(JSON.stringify(msg), '*')
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
