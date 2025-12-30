import './sw-shim'
import { modifyRequestHeaders as modifyRequestHeadersMV3 } from './mv3/modifyRequestHeaders'
import { load } from 'cheerio'
import './drivers/driverCodePack'
import Store from './db/store'
import { upImage } from './util/image'

import { getGuid } from './util/util'
import {
  initializeDriver,
  getDriverProvider,
  getSettings,
  initDevRuntimeEnvironment,
} from '@/runtime'

import * as localDriver from './drivers/driver'
import axiosLib from 'axios'
import TurndownService from 'turndown'
import tools from '@wechatsync/drivers/tools/index.js'

// Drivers (from @wechatsync/drivers) call `modifyRequestHeaders(...)` as a free identifier.
// Define it in *module scope* (so bundling keeps it and the identifier resolves),
// and delegate to MV3 declarativeNetRequest dynamic rules.
function modifyRequestHeaders(urlPrefix, headers, inspectUrls, handler) {
  try {
    const p = modifyRequestHeadersMV3(urlPrefix, headers, inspectUrls, handler)
    if (p && typeof p.then === 'function') {
      p.catch((err) => console.warn('[mv3] modifyRequestHeaders failed', err))
    }
  } catch (err) {
    console.warn('[mv3] modifyRequestHeaders failed', err)
  }
}
globalThis.modifyRequestHeaders = modifyRequestHeaders

// Polyfill window for Service Worker
if (typeof window === 'undefined') {
  self.window = self
}

// Ensure chrome is available globally for runtime scopes
if (typeof globalThis !== 'undefined' && typeof chrome !== 'undefined') {
  globalThis.chrome = chrome
}

// ========== 全局变量注入（driver 代码需要） ==========

// axios 全局变量
globalThis.axios = axiosLib
globalThis.turndown = TurndownService
globalThis.tools = tools

// jQuery shim - 使用原生 fetch 带上 Cookie
const $ = function (selector) {
  // 如果是 HTML 字符串，用 cheerio 解析
  if (
    typeof selector === 'string' &&
    (selector.startsWith('<') || selector.includes('<'))
  ) {
    return load(selector, { decodeEntities: false }, false)
  }
  // 否则返回 cheerio 的 root
  return load(selector || '', { decodeEntities: false }, false)
}

// $.get - GET 请求（自动解析 JSON）
$.get = async function (url) {
  const res = await fetch(url, { credentials: 'include' })
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

// $.post - POST 请求（自动解析 JSON）
$.post = async function (url, data) {
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:
      typeof data === 'string' ? data : new URLSearchParams(data).toString(),
  })
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

// $.ajax - 通用 AJAX 请求（自动解析 JSON）
$.ajax = async function (settings) {
  const method = (settings.type || settings.method || 'GET').toUpperCase()
  const fetchOptions = {
    method,
    credentials: 'include',
    headers: { ...(settings.headers || {}) },
  }

  if (method !== 'GET' && settings.data) {
    // jQuery semantics:
    // - `dataType` describes expected RESPONSE type, not request content type.
    // - `contentType` controls request body encoding.
    // Our previous shim treated `dataType: 'JSON'` as "send JSON body", which breaks drivers
    // (e.g. Toutiao) that set dataType but still expect form-urlencoded requests.
    if (settings.contentType === 'application/json') {
      fetchOptions.headers['Content-Type'] = 'application/json'
      fetchOptions.body =
        typeof settings.data === 'string'
          ? settings.data
          : JSON.stringify(settings.data)
    } else {
      fetchOptions.headers['Content-Type'] = 'application/x-www-form-urlencoded'
      fetchOptions.body =
        typeof settings.data === 'string'
          ? settings.data
          : new URLSearchParams(settings.data).toString()
    }
  }

  // Allow callers to pass through fetch options that are important for some sites (e.g. Toutiao).
  // Note: `Referer` header is forbidden; use fetch `referrer` instead.
  if (settings.referrer) fetchOptions.referrer = settings.referrer
  if (settings.referrerPolicy) fetchOptions.referrerPolicy = settings.referrerPolicy
  if (settings.mode) fetchOptions.mode = settings.mode

  const res = await fetch(settings.url, fetchOptions)
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

// 注入到全局作用域，driver 代码可以直接使用
globalThis.$ = $

// ========== 全局变量注入结束 ==========

window.currentDriver = localDriver

// index by tabId
var logWatchers = {}

var rawLogFun = console.log
var _isInjected = false

function startInspectInject() {
  if (_isInjected) return
  console.log = function () {
    rawLogFun.apply(null, arguments)
    try {
      var args = [].slice.apply(arguments)
      brodcastToWatcher(args)
    } catch (e) {
      console.log('brodcastToWatcher.error', e)
    }
  }
  _isInjected = true
}

async function isDisableAddPromotion() {
  const settings = await getSettings()
  return settings.disablePromotion
}

function brodcastToWatcher(args) {
  var tabIds = Object.keys(logWatchers)
  for (let index = 0; index < tabIds.length; index++) {
    const logWatcher = logWatchers[tabIds[index]]
    // console.log('brodcastToWatcher', logWatcher, args)
    chrome.tabs.sendMessage(logWatcher.tab.id, {
      method: 'consoleLog',
      args: args,
    })
  }
}

// var service = analytics.getService('syncer')
// var tracker = service.getTracker('UA-48134052-13')
var tracker = {
  sendEvent: function (category, action, label) {
    console.log('tracker.sendEvent (mock)', category, action, label)
  },
}

let getDriver = localDriver.getDriver
let getPublicAccounts = localDriver.getPublicAccounts

async function setDriver(driver) {
  window.currentDriver = driver
  window.driverMeta = driver.getMeta()
  getDriver = window.currentDriver.getDriver
  getPublicAccounts = async function () {
    var users = await window.currentDriver.getPublicAccounts()
    try {
      users.forEach((publicAccount) => {
        console.log('tracker', publicAccount)
        // tracker.sendEvent(
        //   'user',
        //   publicAccount.type,
        //   [publicAccount.uid, publicAccount.title].join('-')
        // )
      })
    } catch (e) {
      console.log(e)
    }
    return users
  }
  window.getPublicAccounts = getPublicAccounts
  console.log('driver', driver)
}

async function loadDriver() {
  try {
    const driver = await initializeDriver()
    await setDriver(driver)
    // window.currentDriver = driver
    // window.driverMeta = driver.getMeta()
    // getDriver = window.currentDriver.getDriver
    // getPublicAccounts = async function() {
    //   var users = await window.currentDriver.getPublicAccounts()
    //   try {
    //     users.forEach(publicAccount => {
    //       console.log('tracker', publicAccount)
    //       tracker.sendEvent(
    //         'user',
    //         publicAccount.type,
    //         [publicAccount.uid, publicAccount.title].join('-')
    //       )
    //     })
    //   } catch (e) {
    //     console.log(e)
    //   }
    //   return users
    // }
    // console.log('driver', driver)
  } catch (e) {
    console.log('initializeDriver failed', e)
  }
  afterDriver()
}

var publicAccounts = []

var db = new Store()
window.db = db
window.loadDriver = loadDriver
console.log(window.db)

function getCookie(name, cookieStr) {
  let arr,
    reg = new RegExp('(^| )' + name + '=([^;]*)(;|$)')
  if ((arr = cookieStr.match(reg))) {
    return unescape(arr[2])
  } else {
    return ''
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(() => resolve(), ms))
}

class Syner {
  constructor() {
    this.senders = {}
    this.listenRequest()
    this.startWroker()
    this.modifyHeaderIfNecessary()
  }

  modifyHeaderIfNecessary() {
    console.log('modifyHeaderIfNecessary', window.driverMeta)
    var insepectURLs = [
      '*://mp.toutiao.com/mp*',
      '*://card.weibo.com/*',
      '*://mp.weixin.qq.com/*',
      '*://zhuanlan.zhihu.com/api/*',
      // '*://api.bilibili.com/*',
    ]

    if (window.driverMeta && window.driverMeta.inspectUrls) {
      insepectURLs = insepectURLs.concat(window.driverMeta.inspectUrls)
    }

    /*
      chrome.webRequest.onBeforeSendHeaders.addListener(
        function(details) {
          console.log('details.requestHeaders', details, details.url)
          // WEIBO API
          try {
            var modifRules = [
              {
                prefix: 'mp.weixin.qq.com/cgi-bin',
                origin: 'https://mp.weixin.qq.com',
                referer: 'https://mp.weixin.qq.com/cgi-bin/appmsg',
              },
              {
                prefix: 'mp.toutiao.com/mp',
                origin: 'https://mp.toutiao.com',
                referer: 'https://mp.toutiao.com/profile_v4/graphic/publish',
              },
            ]

            for (let index = 0; index < modifRules.length; index++) {
              const modifRule = modifRules[index]
              if (details.url.indexOf(modifRule.prefix) > -1) {
                var foundRefereHeader = false
                for (var i = 0; i < details.requestHeaders.length; ++i) {
                  if (details.requestHeaders[i].name === 'Referer')
                    foundRefereHeader = true
                  if (details.requestHeaders[i].name === 'Origin') {
                    details.requestHeaders[i].value = modifRule.origin
                  }
                }
                if (!foundRefereHeader) {
                  details.requestHeaders.push({
                    name: 'Referer',
                    value: modifRule.referer,
                  })
                }
                console.log('details.requestHeaders', modifRule, details)
              } else {
                // console.log('rule not macth', modifRule.prefix, details.url)
              }
            }

            if (details.url.indexOf('https://card.weibo.com/article/v3') > -1) {
              var foundRefereHeader = false
              for (var i = 0; i < details.requestHeaders.length; ++i) {
                if (details.requestHeaders[i].name === 'Referer')
                  foundRefereHeader = true
                if (details.requestHeaders[i].name === 'Origin') {
                  details.requestHeaders[i].value = 'https://card.weibo.com'
                }
              }
              if (!foundRefereHeader) {
                details.requestHeaders.push({
                  name: 'Referer',
                  value: 'https://card.weibo.com/article/v3/editor',
                })
              }
              console.log('details.requestHeaders', details)
            }

            //  zhihu xsrf token
            if (details.url.indexOf('zhuanlan.zhihu.com/api') > -1) {
              var cookieHeader = details.requestHeaders.filter(h => {
                return h.name.toLowerCase() == 'cookie'
              })

              if (cookieHeader.length) {
                var cookieStr = cookieHeader[0].value
                var _xsrf = getCookie('_xsrf', cookieStr)
                if (_xsrf) {
                  details.requestHeaders.push({
                    name: 'x-xsrftoken',
                    value: _xsrf,
                  })
                }
                console.log('cookieStr', cookieStr)
              }
              console.log('details.requestHeaders', details)
            }
          } catch (e) {
            console.log('modify headers error', e)
          }

          // Bilibili origin set
          if (details.url.indexOf('https://api.bilibili.com/x/article/creative/draft/addupdate') > -1){
            details.requestHeaders.push({
              name: 'origin',
              value: 'https://member.bilibili.com',
            })
            console.log('bilibili header origin add success: ', details)
          }

          try {
            window.driverMeta.urlHandler(details)
          } catch (e) {
            console.log('urlHandler', e)
          }

          return { requestHeaders: details.requestHeaders }
        },
        {
          urls: insepectURLs,
        },
        ['blocking', 'requestHeaders', 'extraHeaders',]
      )
*/
  }

  getSender(guid) {
    return this.senders[guid]
  }

  removeSender(guid) {
    if (this.senders[guid]) delete this.senders[guid]
  }

  listenRequest() {
    var self = this
    chrome.runtime.onMessage.addListener(function (
      request,
      sender,
      sendResponseA
    ) {
      if (request.action && request.action == 'getDriverMeta') {
        sendResponseA(window.driverMeta)
        return true
      }

      if (request.action && request.action == 'reloadDriver') {
        loadDriver().then(() => {
          sendResponseA({ status: 1 })
        })
        return true
      }

      if (request.action && request.action == 'getAccount') {
        ;(async () => {
          try {
            const accounts = await db.getAccounts()
            // CRITICAL FIX: Wait for publicAccounts BEFORE responding
            // This ensures Juejin (and other auto-detected accounts) are available
            if (!publicAccounts || publicAccounts.length === 0) {
              console.log('[WCS] getAccount: publicAccounts empty, fetching...')
              publicAccounts = await getPublicAccounts()
            }
            sendResponseA(accounts.concat(publicAccounts))
          } catch (e) {
            console.error('getAccount error', e)
            sendResponseA([])
          }
        })()
        return true
      }

      // MV3: 使用 chrome.scripting.executeScript 在页面主世界获取全局变量
      if (request.action && request.action == 'getPageGlobals') {
        chrome.scripting
          .executeScript({
            target: { tabId: sender.tab.id },
            world: 'MAIN',
            func: () => {
              // 在页面主世界执行，可以访问页面的全局变量
              // 使用 try-catch 避免影响页面
              try {
                return {
                  title: typeof msg_title !== 'undefined' ? msg_title : null,
                  desc: typeof msg_desc !== 'undefined' ? msg_desc : null,
                  thumb:
                    typeof msg_cdn_url !== 'undefined' ? msg_cdn_url : null,
                  nickname: typeof nickname !== 'undefined' ? nickname : null,
                  publish_time: typeof ct !== 'undefined' ? ct : null,
                }
              } catch (e) {
                return null
              }
            },
          })
          .then((results) => {
            console.log('[WCS] getPageGlobals result:', results)
            sendResponseA(results[0]?.result || null)
          })
          .catch((err) => {
            console.error('[WCS] getPageGlobals error:', err)
            sendResponseA(null)
          })
        return true
      }

      if (request.action && request.action == 'addTask') {
        console.log(request)
        ;(async () => {
          try {
            request.task.status = 'wait'
            request.task.guid = getGuid()
            await db.addTask(request.task)
            // brocast message to the front end
            self.senders[request.task.guid] = sender
            sendResponseA(request.task.guid)
            try {
              var newTask = request.task
              tracker.sendEvent('add', 'link', request.task.post.link)
              tracker.sendEvent(
                'add',
                'title',
                [
                  request.task.post.title,
                  newTask.accounts.map((account) => {
                    return [account.type, account.uid, account.title].join('-')
                  }),
                ].join(';;')
              )
            } catch (e) {
              console.log(e)
            }
          } catch (e) {
            console.error('addTask error', e)
            sendResponseA(null)
          }
        })()
        return true
      }

      if (request.action && request.action == 'parseArticle') {
        console.log(request)
        ;(async () => {
          var driver = getDriver(request.account)
          try {
            var article = await driver.getArticle(request.data)
            sendResponseA({
              article: article,
            })
          } catch (e) {
            console.log(e)
            sendResponseA({
              error: e.toString(),
            })
          }
        })()
        return true
      }

      if (request.action && request.action == 'getCache') {
        console.log(request)
        ;(async () => {
          chrome.storage.local.get(
            request.names ? request.names : [request.name],
            function (result) {
              sendResponseA({
                result: result,
              })
            }
          )
        })()
        return true
      }

      if (request.action && request.action == 'setCache') {
        console.log(request)
        ;(async () => {
          var d = {}
          d[request.name] = request.value
          chrome.storage.local.set(d, function () {
            console.log('cache set')
            sendResponseA({ status: 'ok' })
          })
        })()
        return true
      }

      if (request.action && request.action == 'sendEvent') {
        console.log(request)
        ;(async () => {
          try {
            var event = request.event
            tracker.sendEvent(event.category, event.action, event.label)
          } catch (e) {}
          // var d = {}
          // d[request.name] = request.value
          // chrome.storage.local.set(d, function() {
          //   console.log('cache set')
          // })
          sendResponseA({ status: 'ok' })
        })()
        return true
      }

      if (request.action && request.action == 'startInspect') {
        // self.senders[request.task.guid] = sender
        // logWatchers.push(sender)
        logWatchers[sender.tab.id] = sender
        startInspectInject()
        sendResponseA({ status: 'ok' })
      }

      if (request.action && request.action == 'updateDriver') {
        console.log('updateDriver', request)
        ;(async () => {
          try {
            var isDevelopment = request.data.dev
            var isPatch = request.data.patch
            var patchName = request.data.name
            // var patchName = request.name;
            if (isPatch && isDevelopment) {
              console.log('try patch driver')
              try {
                var patchCodeVm = getDriverProvider(request.data.code)
                if (patchCodeVm.driver) {
                  window.currentDriver.addCustomDriver(
                    patchName,
                    patchCodeVm.driver
                  )
                  console.log('custom driver seted')
                  sendResponseA({
                    result: {
                      status: 1,
                    },
                  })
                } else {
                  sendResponseA({
                    result: {
                      error: 'exports.driver not found',
                      status: 0,
                    },
                  })
                }
                // const codeStartTag = "// DEVTOOL_PLACEHOLDER_INSERT"
                // const driver = await initializeDriver({
                //   beforeCreate(result) {
                //     result.driver = result.driver.replace(codeStartTag, codeStartTag + "\n\n" + request.data.code)
                //     console.log('beforeCreate', result.driver)
                //   },
                // })
                // await setDriver(driver)
                console.log('newDriver.isPatch', patchCodeVm)
              } catch (e) {
                sendResponseA({
                  result: {
                    error: 'initvm failed',
                    detail: e.toString(),
                    status: 0,
                  },
                })
                console.log('initvm failed', e)
              }
            }

            if (!isPatch) {
              var newDriver = getDriverProvider(request.data.code)
              var newDriverMeta = newDriver.getMeta()
              console.log('new version found', newDriverMeta)
              if (isDevelopment) {
                setDriver(newDriver)
                // dynamic reload not store
                sendResponseA({ status: 1 })
              } else {
                // if (newDriverMeta.versionNumber > window.driverMeta.versionNumber) {
                chrome.storage.local.set(
                  {
                    driver: request.data.code,
                  },
                  function () {
                    console.log('driver seted')
                    loadDriver()
                  }
                )
                console.log('is new driver')
                sendResponseA({
                  result: {
                    status: 1,
                  },
                })
                // } else {
                //   sendResponseA({
                //     result: {
                //     status: 0
                //   },
                //   })
                // }
              }
            }
          } catch (e) {
            sendResponseA({
              result: {
                status: 0,
                error: e.toString(),
              },
            })
          }
        })()
        return true
      }

      // Handle request to ensure page.js is injected
      if (request.action && request.action == 'ensurePageScript') {
        ;(async () => {
          try {
            var tabId = null
            // Try to get tab ID from request first (if passed from api.js)
            if (request.tabId) {
              tabId = request.tabId
            } else if (sender.tab && sender.tab.id) {
              tabId = sender.tab.id
            } else {
              // Fallback: try to get active tab
              try {
                var tabs = await chrome.tabs.query({ active: true, currentWindow: true })
                if (tabs && tabs.length > 0) {
                  tabId = tabs[0].id
                }
              } catch (e) {
                console.warn('[WCS] ensurePageScript: Could not query tabs:', e)
              }
            }
            
            if (!tabId) {
              console.error('[WCS] ensurePageScript: No tab ID available, sender:', sender, 'request:', request)
              sendResponseA({ error: 'No tab ID available', sender: sender, request: request })
              return
            }
            
            console.log('[WCS] ensurePageScript: Injecting page.js into tab', tabId, 'URL:', request.url || 'unknown')
            try {
              await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: [
                  'libs/juqery.js',
                  'libs/Readability.js',
                  'libs/reader.js',
                  'page.js',
                ],
              })
              console.log('[WCS] ensurePageScript: Successfully injected page.js')
              sendResponseA({ success: true, injected: true, tabId: tabId })
            } catch (injectError) {
              console.error('[WCS] ensurePageScript: executeScript failed:', injectError)
              console.error('[WCS] ensurePageScript: Error name:', injectError.name)
              console.error('[WCS] ensurePageScript: Error message:', injectError.message)
              if (injectError.stack) {
                console.error('[WCS] ensurePageScript: Error stack:', injectError.stack)
              }
              sendResponseA({ 
                error: injectError.message || String(injectError),
                name: injectError.name,
                stack: injectError.stack
              })
            }
          } catch (e) {
            console.error('[WCS] ensurePageScript: Outer catch - Failed:', e)
            console.error('[WCS] ensurePageScript: Error name:', e.name)
            console.error('[WCS] ensurePageScript: Error message:', e.message)
            if (e.stack) {
              console.error('[WCS] ensurePageScript: Error stack:', e.stack)
            }
            sendResponseA({ 
              error: e.message || String(e),
              name: e.name,
              stack: e.stack
            })
          }
        })()
        return true
      }

      if (request.action && request.action == 'callDriverMethod') {
        console.log(request)
        ;(async () => {
          try {
            var driver = getDriver(request.data.account)
            var methodName = request.methodName
            if (methodName === 'uploadImage') {
              var postId = Math.floor(Math.random() * 100000)
              var imgSRC = request.data.src
              var result = await upImage(
                driver,
                imgSRC,
                postId,
                postId + '.png'
              )
              sendResponseA({
                result: result,
              })
            } else {
              var driverFunc = driver[methodName]
              if (!driverFunc) {
                sendResponseA({
                  error: 'method not exists',
                })
              } else {
                var callResult = await driverFunc(request.data)
                sendResponseA({
                  result: callResult,
                })
              }
            }
          } catch (e) {
            sendResponseA({
              error: e.toString(),
            })
          }
        })()
        return true
      }
    })
  }

  startWroker() {
    var self = this

    ;(async function loop() {
      var tasks = await db.getTasks()
      tasks.forEach((t, tid) => {
        t.tid = tid
      })
      var notDone = tasks.filter((t) => {
        return t.status == 'wait'
      })

      try {
        if (chrome.action) {
          chrome.action.setBadgeText({
            text: notDone.length + '',
          })
        } else {
          chrome.browserAction.setBadgeText({
            text: notDone.length + '',
          })
        }
      } catch (e) {}

      var timeOut = tasks.filter((t) => {
        return t.status == 'uploading'
      })

      timeOut.forEach((t) => {
        // db.editTask(t.tid, {
        //   status: "failed",
        //   msg: "超时"
        // });
      })

      var currentTask = notDone.shift()
      if (!currentTask) {
        setTimeout(loop, 3 * 1000)
        return
      }

      ;(async () => {
        await db.editTask(currentTask.tid, {
          status: 'uploading',
          startTime: Date.now(),
        })

        try {
          for (let index = 0; index < currentTask.accounts.length; index++) {
            const account = currentTask.accounts[index]
            try {
              await self.doSync(account, currentTask)
              console.log('doSync done', account)
              chrome.notifications.create(
                'sync_sucess_' + currentTask.tid,
                {
                  type: 'basic',
                  title: '同步成功',
                  message: currentTask.post.title + ' >> ' + account.title,
                  iconUrl: 'images/logo.png',
                },
                function () {
                  window.setTimeout(function () {
                    chrome.notifications.clear(
                      'sync_sucess_' + currentTask.tid,
                      function () {}
                    )
                  }, 4000)
                }
              )

              var link = ''
              if (account.type != 'wordpress') {
                link = account.editResp.draftLink
              } else {
                link = account.params.wpUrl + '?p=' + account.post_id
              }

              console.log(account.editResp, link)
              tracker.sendEvent('sync', 'sucess', link)
            } catch (e) {
              console.error(e)
              var msgErro = e ? e.toString() : '未知错误'
              chrome.notifications.create(
                'sync_error_' + currentTask.tid,
                {
                  type: 'basic',
                  title: '同步失败',
                  message: msgErro,
                  iconUrl: 'images/logo.png',
                },
                function () {
                  window.setTimeout(function () {
                    chrome.notifications.clear(
                      'sync_error_' + currentTask.tid,
                      function () {}
                    )
                  }, 4000)
                }
              )

              account.status = 'failed'
              account.error = msgErro

              await db.editTask(currentTask.tid, {
                accounts: currentTask.accounts,
              })

              tracker.sendEvent('sync', 'error', msgErro)
              tracker.sendEvent(
                'sync',
                account.type + '-error',
                [currentTask.post.link, +msgErro].join(':')
              )

              tracker.sendEvent(
                'sync-' + window.driverMeta.versionNumber,
                'error',
                msgErro
              )
            }
          }
        } catch (e) {
          console.log(e)
          await db.editTask(currentTask.tid, {
            status: 'failed',
            msg: e + '',
          })
        }
      })()
      setTimeout(loop, 2 * 1000)
    })()
  }

  async doSync(account, currentTask) {
    var driver = getDriver(account)
    var postId
    account.status = 'uploading'
    await db.editTask(currentTask.tid, {
      accounts: currentTask.accounts,
    })

    var postContent = JSON.parse(JSON.stringify(currentTask.post))

    // If the source provides markdown (e.g. mdnice) and this target supports markdown,
    // prefer markdown for this platform by setting `content_<type>` automatically.
    // Note: image URL rewriting currently happens based on HTML; markdown image URLs may not be rewritten.
    try {
      if (
        postContent &&
        postContent.markdown &&
        (!postContent[`content_${account.type}`] ||
          postContent[`content_${account.type}`].trim() === '') &&
        account &&
        account.supportTypes &&
        account.supportTypes.indexOf('markdown') > -1
      ) {
        postContent[`content_${account.type}`] = postContent.markdown
      }
    } catch (e) {
      // ignore
    }

    try {
      if (driver.preEditPost) {
        console.log('driver.preEditPost')
        await driver.preEditPost(postContent)
      } else {
        console.log('driver.preEditPost skip')
      }
    } catch (e) {
      console.log('preEditPost', e)
    }

    try {
      const isAddPromitionDisabled = await isDisableAddPromotion()
      if (!isAddPromitionDisabled) {
        if (driver.addPromotion) {
          console.log('driver.addPromotion')
          await driver.addPromotion(postContent)
        }
      } else {
        console.log('driver.addPromotion skip')
      }
    } catch (e) {
      console.log('addPromotion', e)
    }

    console.log('driver instance', driver)
    var addResp = await driver.addPost(
      Object.assign(
        {
          post_title: postContent.title,
          post_author: account.params ? account.params.wpUser : '',
          post_content: postContent[`content_${account.type}`]
            ? postContent[`content_${account.type}`]
            : postContent.content,
        },
        postContent
      ),
      driver
    )

    if (addResp.status != 'success') {
      throw Error('create post failed')
      return
    }

    postId = addResp.post_id ? addResp.post_id : addResp.response
    account.post_id = postId
    var doc = $(postContent.content || '')
    var imags = doc('img')
    console.log('upload images', imags.length)
    account.totalImages = imags.length
    account.uploadedCount = 1
    account.msg = '准备上传' + imags.length + '张图片'

    db.editTask(currentTask.tid, {
      accounts: currentTask.accounts,
    })

    var imageMaxRetry = 10

    for (let mindex = 0; mindex < imags.length; mindex++) {
      const img = imags.eq(mindex)
      let imgSRC = img.attr('data-src')
      if (!imgSRC) {
        imgSRC = img.attr('data-original')
      }

      if (!imgSRC) {
        imgSRC = img.attr('src')
      }

      if (!imgSRC) {
        account.uploadedCount++
        continue
      }
      console.log('upload image start', imgSRC)

      var maxRetry = 3

      for (let index = 0; index < imageMaxRetry; index++) {
        console.log('imageMaxRetry', index)
        try {
          const newSrc = await upImage(
            driver,
            imgSRC,
            postId,
            postId + mindex + '.png'
          )
          img.attr('src', newSrc.url)
          if (driver.editImg) {
            try {
              driver.editImg(img, newSrc)
            } catch (e) {}
          }
          console.log('upload image done', newSrc.url, newSrc)
          break
        } catch (e) {}

        account.msg =
          '正在上传第' +
          account.uploadedCount +
          '张图片， 总共' +
          imags.length +
          '张图片; 上传失败，1秒后准备重试第' +
          (index + 1) +
          '次'
        db.editTask(currentTask.tid, {
          accounts: currentTask.accounts,
        })
        await wait(1000)
      }
      account.msg =
        '正在上传第' +
        account.uploadedCount +
        '张图片， 总共' +
        imags.length +
        '张图片'
      account.uploadedCount++
      db.editTask(currentTask.tid, {
        accounts: currentTask.accounts,
      })
    }

    console.log('upload images done')
    postContent.content = doc.html()

    // 设置缩略图
    var post_thumbnail = null
    var editInput = {
      post_title: postContent.title,
      post_content: postContent[`content_${account.type}`]
        ? postContent[`content_${account.type}`]
        : postContent.content,
    }

    if (postContent.thumb) {
      var maxRetry = 3
      for (let index = 0; index < imageMaxRetry; index++) {
        console.log('imageMaxRetry', index)
        try {
          post_thumbnail = await upImage(
            driver,
            postContent.thumb,
            postId,
            postId + 'thumb.png'
          )
          editInput = Object.assign(editInput, {
            post_thumbnail: post_thumbnail.id,
            post_thumbnail_raw: post_thumbnail,
          })
          break
        } catch (e) {
          console.log('upload thumb failed', e)
        }
      }
    }
    console.log('update last', editInput)

    var finalPostId = account.params ? parseInt(postId) : postId
    let editResp = null
    try {
      editResp = await driver.editPost(
        finalPostId,
        Object.assign(postContent, editInput)
      )
    } catch (e) {
      console.log('editPost failed：', e)
      editResp = { status: 'failed', error: e.message || e }
    }

    account.editResp = editResp
    account.status =
      editResp && editResp.status === 'success' ? 'done' : 'failed'
    if (account.status === 'failed' && editResp && editResp.error) {
      account.error = editResp.error
    }

    db.editTask(currentTask.tid, {
      accounts: currentTask.accounts,
    })

    console.log('editResp status')
    if (editResp && editResp.status == 'success') {
      db.editTask(currentTask.tid, {
        status: 'done',
        endTime: Date.now(),
      })
    }
  }
}

console.log('background.js')
function afterDriver() {
  var syncer = new Syner()
  window.syncer = syncer
  ;(async () => {
    publicAccounts = await getPublicAccounts()
  })()
  window.getPublicAccounts = getPublicAccounts
}

// MV3 Service Worker 环境没有 `process.env`，并且可能没有 DOM（document/DOMParser）。
// 为避免 Service Worker 注册失败（Status code: 15），启动阶段只做最小初始化。
;(async () => {
  try {
    console.log('MODE', import.meta.env?.MODE, 'PROD', import.meta.env?.PROD)
  } catch (e) {
    // ignore
  }

  // 先使用内置 driver meta，确保 service worker 能起来。
  try {
    window.driverMeta = localDriver.getMeta()
  } catch (e) {
    console.log('getMeta failed', e)
  }

  // 不在启动阶段执行 initDevRuntimeEnvironment()/loadDriver()，
  // 这些会在 SW 中引用 document/DOMParser 或依赖动态执行 driver（Sval），容易导致启动即崩。
  afterDriver()
})()
var sharedContextmenuId = null
var _contextMenuListenerBound = false

function onContextMenuClicked(info, tab) {
  try {
    if (!info || info.menuItemId !== 'getAttrile') return
    if (!tab || typeof tab.id !== 'number') return

    var link = info.linkUrl || info.frameUrl || info.pageUrl
    const msg = {
      method: 'fetchArticle',
      text: tab.title,
      link: link,
      info: info,
    }

    function notifyFetchArticleFailed(detail) {
      try {
        chrome.notifications.create(
          'fetch_article_failed_' + tab.id + '_' + Date.now(),
          {
            type: 'basic',
            title: '提取失败',
            message:
              (detail ? detail + '\n' : '') +
              '请检查扩展对当前站点的访问权限（Site access），然后刷新页面重试。',
            iconUrl: 'images/logo.png',
          },
          function () {}
        )
      } catch (e) {
        // ignore
      }
    }

    // Some sites require explicit "site access" permission, and in MV3 the content script
    // might not be present yet (or the tab is not ready). Add a best-effort retry by
    // injecting `page.js` and resending.
    chrome.tabs.sendMessage(tab.id, msg, async () => {
      if (!chrome.runtime.lastError) return
      console.warn(
        '[WCS] sendMessage(fetchArticle) failed:',
        chrome.runtime.lastError?.message,
        'tab.url=',
        tab.url
      )
      try {
        // Best-effort: inject page.js (no-op if already present), then retry once.
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          // page.js depends on jquery/Readability/reader helpers when running as a content script.
          // Inject them together to avoid runtime errors when site access was previously disabled.
          files: [
            'libs/juqery.js',
            'libs/Readability.js',
            'libs/reader.js',
            'page.js',
          ],
        })
        chrome.tabs.sendMessage(tab.id, msg, () => {
          if (chrome.runtime.lastError) {
            console.warn(
              '[WCS] retry sendMessage(fetchArticle) failed:',
              chrome.runtime.lastError?.message
            )
            notifyFetchArticleFailed(
              chrome.runtime.lastError?.message || '无法发送消息到页面'
            )
          }
        })
      } catch (e) {
        console.warn('[WCS] executeScript(page.js) failed:', e)
        notifyFetchArticleFailed((e && e.message) || String(e))
      }
    })
  } catch (e) {
    console.log('contextMenus.onClicked error', e)
  }
}

function createSharedContextmenu() {
  chrome.contextMenus.removeAll(function () {
    sharedContextmenuId = chrome.contextMenus.create({
      id: 'getAttrile',
      title: '提取文章并同步',
      contexts: ['all'],
    })

    // MV3: cannot pass `onclick` to create(); must use onClicked event.
    if (!_contextMenuListenerBound) {
      chrome.contextMenus.onClicked.addListener(onContextMenuClicked)
      _contextMenuListenerBound = true
    }
  })
}

function removeSharedContextmenu() {
  if (sharedContextmenuId) {
    chrome.contextMenus.remove(sharedContextmenuId)
    sharedContextmenuId = null
  }
}

createSharedContextmenu()

// chrome.tabs.executeScript(
//   tab.id,
//   {
//     code: args.code,
//   },
//   function(res) {
//     chrome.tabs.remove(tab.id)
//     console.log('sendResponseA', res)
//     sendResponseA({
//       error: null,
//       result: res,
//     })
//   }
// )
