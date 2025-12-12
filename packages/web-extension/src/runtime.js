import Sval from 'sval'
import svalScopes from '@wechatsync/drivers/scopes'
import moment from 'moment'
import axios from 'axios'

// Shim jQuery for drivers
const $ = function(selector) {
  // Minimal DOM support if needed, or just return empty for safety
  // console.warn('jQuery($) called with', selector)
  return []
}
$.get = async function(url) {
  const res = await axios.get(url)
  return res.data
}
$.post = async function(url, data) {
  const res = await axios.post(url, data)
  return res.data
}
$.ajax = async function(settings) {
  const config = {
    url: settings.url,
    method: settings.type || settings.method || 'GET',
    data: settings.data,
    headers: settings.headers
  }
  const res = await axios(config)
  return res.data
}

export function getSettings() {
  return new Promise((resolve, reject) => {
    try {
      getCache('settings', value => {
        if (value.settings) {
          try {
            var settings = JSON.parse(value.settings)
            resolve(settings)
          } catch(e) {
            reject(e)
          }
        } else {
          resolve({})
        }
      })
    } catch (e) {
      reject(e)
    }
  })
}

function wait(ms) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms)
  })
}

function getRuntimeScopes() {
  // MV3 Service Worker 没有 DOM；用 typeof 防止 ReferenceError
  const SafeDOMParser = typeof DOMParser !== 'undefined' ? DOMParser : undefined
  const SafeDocument = typeof document !== 'undefined' ? document : undefined
  const SafeCryptoJS = typeof CryptoJS !== 'undefined' ? CryptoJS : globalThis.CryptoJS

  return {
    ...svalScopes,
    console: console,
    $: $,
    DOMParser: SafeDOMParser,
    document: SafeDocument,
    Blob: Blob,
    Promise: Promise,
    wait: wait,
    moment: moment,
    getSettings: getSettings,
    setCache: setCache,
    getCache: getCache,
    initializeFrame: initializeFrame,
    requestFrameMethod: requestFrameMethod,
    modifyRequestHeaders: modifyRequestHeaders,
    CryptoJS: SafeCryptoJS,
    helpers: {
      parseTokenAndToHeaders: parseTokenAndToHeaders,
    },
  }
}

export function initDevRuntimeEnvironment() {
  const scopes = getRuntimeScopes()

  Object.keys(scopes).forEach(key => {
    const g = typeof globalThis !== 'undefined' ? globalThis : window
    if (g && !Object.prototype.hasOwnProperty.call(g, key)) {
      g[key] = scopes[key]
    }
  })
}

export function getDriverProvider(code) {
  const options = {
    // ECMA Version of the code (5 | 6 | 7 | 8 | 9 | 10 | 2015 | 2016 | 2017 | 2018 | 2019)
    ecmaVer: 9,
    // Whether the code runs in a sandbox
    sandBox: true,
  }

  const interpreter = new Sval(options)
  const scopes = getRuntimeScopes()

  for (var k in scopes) {
    interpreter.import(k, scopes[k])
  }
  interpreter.run(code)

  return interpreter.exports
}

// MV3 service worker 环境没有 window；用 globalThis 避免注册时直接 ReferenceError
try {
  if (typeof globalThis !== 'undefined') {
    globalThis.initializeDriver = initializeDriver
  }
} catch (e) {
  // ignore
}

export function initializeDriver(conf = {}) {
  return new Promise((resolve, reject) => {
    function createDriver(driverRemote) {
      console.log('initializeDriver', driverRemote ? 'remote' : 'local')
      const g = typeof globalThis !== 'undefined' ? globalThis : window
      const code = driverRemote ? driverRemote : g.driver
      const driver = getDriverProvider(code)
      resolve(driver)
    }
    chrome.storage.local.get(['driver'], function(result) {
      try {
        if (conf.beforeCreate) {
          conf.beforeCreate(result)
        }
        createDriver(result.driver)
      } catch (e) {
        reject(e)
      }
    })
  })
}

function setCache(name, value) {
  var d = {}
  d[name] = value
  chrome.storage.local.set(d, function() {
    console.log('cache set')
  })
}

function getCache(name, cb) {
  chrome.storage.local.get(name, function(result) {
    cb(result)
  })
}

var abb = {}
var frameStack = {}

// Service Worker 环境没有 window；统一挂到 globalThis
const __global = typeof globalThis !== 'undefined' ? globalThis : window
// IMPORTANT: keep a leading semicolon / separate statement to avoid `{}` being treated as a call.
__global.onmessage = (e) => {
  try {
    var action = JSON.parse(e.data)
    if (action.eventId && abb[action.eventId]) {
      abb[action.eventId](action.err, action.data)
    }
  } catch (e) {}
}

function requestFrameMethod(d, name) {
  return new Promise((resolve, reject) => {
    var evtId = Date.now() + Math.random()
    d.eventId = evtId
    abb[evtId] = function(err, data) {
      if (err) {
        reject(err)
      } else {
        resolve(data)
      }
    }

    var callFrame = frameStack[name]
    callFrame.contentWindow.postMessage(JSON.stringify(d), '*')
  })
}

function initializeFrame(src, type, forceOpen) {
  if (!frameStack[type]) {
    if (!forceOpen) {
      frameStack[type] = document.createElement('iframe')
      frameStack[type].src = src || 'https://segmentfault.com/write?freshman=1'
      document.body.append(frameStack[type])
    } else {
      window.open(src)
    }
  }
}

const _rules = {}

/**
 * 从webRequest中替换headers或监听请求
 * @function
 * @param {string} ulrPrefix - 要修改的链接匹配串
 * @param {string} headers - 要修改为的headers.
 * @param {array} inspectUrls - 需要监听的url结构.
 * @param {function} handler - 或者自己处理的回调函数.
 */
function modifyRequestHeaders(ulrPrefix, headers, inspectUrls, handler) {
  // once
  if (!_rules[ulrPrefix]) {
    _rules[ulrPrefix] = headers
  }
  console.log('modifyRequestHeaders', ulrPrefix)
  chrome.webRequest.onBeforeSendHeaders.addListener(
    function(details) {
      try {
        var macthedUrl = details.url.indexOf(ulrPrefix) > -1
        if (macthedUrl) {
          details.requestHeaders = details.requestHeaders.map(_ => {
            if (headers[_.name]) {
              _.value = headers[_.name]
            }
            return _
          })

          Object.keys(headers).forEach(name => {
            var existsHeaders = details.requestHeaders.filter(
              _ => _.name == name
            )
            if (existsHeaders.length) {
            } else {
              details.requestHeaders.push({
                name: name,
                value: headers[name],
              })
            }
          })
        }
        // call
        if (handler) {
          handler(details)
        }
      } catch (e) {
        console.log('modify headers error', e)
      }
      return { requestHeaders: details.requestHeaders }
    },
    {
      urls: inspectUrls,
    },
    ['blocking', 'requestHeaders', 'extraHeaders']
  )
}

function getCookie(name, cookieStr) {
  let arr,
    reg = new RegExp('(^| )' + name + '=([^;]*)(;|$)')
  if ((arr = cookieStr.match(reg))) {
    return unescape(arr[2])
  } else {
    return ''
  }
}

/**
 * 从webRequest Header头中找到某个Cookie再以某个Key插入Header头中
 * @function
 * @param {object} details - webRequest回调
 * @param {string} cookieKey - Cookie名称.
 * @param {string} headerKey - 插入Header中的名称.
 */
function parseTokenAndToHeaders(details, cookieKey, headerKey) {
  var cookieHeader = details.requestHeaders.filter(h => {
    return h.name.toLowerCase() == 'cookie'
  })
  if (cookieHeader.length) {
    var cookieStr = cookieHeader[0].value
    var _xsrf = getCookie(cookieKey, cookieStr)
    if (_xsrf) {
      details.requestHeaders.push({
        name: headerKey,
        value: _xsrf,
      })
    }
  }
}
