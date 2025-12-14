console.log('page.js', ReaderArticleFinderJS, 'Readability', Readability)

function initPageFetch(isForceShow) {
  if ($('#syncd-pannel').length == 0)
    $('body').append(`
<div id="syncd-pannel" style="background:#111;position: fixed;
user-select: none;
bottom: 30px;
right: 12px;
left: initial;
width: 306px;
height: 45px;
border: 0px;
z-index: 2147483646;
clip: auto;
color: white;
font-size: 14px;
display: none;">
<div>
  <div style="position: absolute;
  left: 10px;
  width: 240px;
  height: 20px;
  line-height: 20px;
  text-align:left;
  overflow: hidden;
  cursor: pointer;
  top: 12px;" id="syncd-title">正在查找文章...</div>
  <div id="closebtn" style="position: absolute;
  cursor: pointer;
  right: 10px;
  top: 10px;"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#f4f4f4" xmlns:xlink="http://www.w3.org/1999/xlink">
  <path d="M5.69999 5L5 5.70004L11.3 12.0001L5 18.3L5.69999 19L12 12.7L18.3 19L19 18.3L12.7 12.0001L19 5.70004L18.3 5.00012L12 11.3L5.69999 5Z"></path>
</svg></div>
</div>
</div>
`)

  $('#closebtn').click(function () {
    $('#syncd-pannel').remove()
  })

  var READER_VIEW_PAGE_SRC = chrome.runtime.getURL('view.html')
  var isChrome = navigator.userAgent.match(/Chrome\/(\d+)/),
    ChromeVersion = (isChrome && parseInt(isChrome[1], 10)) || 0

  var isInDom = $('.wechatsync-viewer').length
  if (!isInDom) {
    console.log('add viwer')
    var widgetDom = document.createElement('div'),
      widgetRoot = widgetDom.createShadowRoot
        ? widgetDom.createShadowRoot()
        : widgetDom.webkitCreateShadowRoot
        ? widgetDom.webkitCreateShadowRoot()
        : widgetDom
    var widgetWrap = document.createElement(
        ChromeVersion >= 37 ? 'dialog' : 'div'
      ),
      $widgetPage = $(
        '<iframe src="' +
          READER_VIEW_PAGE_SRC +
          '" name="' +
          window.location.href +
          '"></iframe>'
      )

    $widgetPage.css({
      width: '100%',
      height: '100%',
      border: 'none',
    })

    $(widgetWrap)
      .css({
        position: 'fixed',
        width: '100%',
        height: '100%',
        top: 0,
        left: 0,
        background: 'rgb(251, 251, 251)',
        zIndex: '2147483647',
        display: 'block',
        padding: 0,
        border: 'none',
        margin: 0,
      })
      .append($widgetPage)

    var widgetDomMain = $(widgetWrap)
    widgetDomMain.css('display', 'none')
    $(widgetRoot).append($(widgetWrap))
    $('body').append(widgetDomMain)

    $(widgetWrap).addClass('wechatsync-viewer')
  } else {
    var widgetDomMain = $('.wechatsync-viewer')
    var $widgetPage = $('.wechatsync-viewer iframe')
  }

  // The viewer is an extension-origin iframe. If we postMessage before its JS mounts,
  // the initial payload can be lost. Queue messages until the iframe fires `load`.
  var _viewerReady = false
  var _viewerQueue = []

  function _flushViewerQueue() {
    try {
      if (!_viewerReady) return
      if (!$widgetPage || !$widgetPage[0] || !$widgetPage[0].contentWindow)
        return
      while (_viewerQueue.length) {
        var msg = _viewerQueue.shift()
        $widgetPage[0].contentWindow.postMessage(msg, '*')
      }
    } catch (e) {
      // ignore
    }
  }

  function _markViewerReady() {
    _viewerReady = true
    try {
      if ($widgetPage && $widgetPage[0] && $widgetPage[0].dataset) {
        $widgetPage[0].dataset.wcsReady = '1'
      }
    } catch (e) {}
    _flushViewerQueue()
  }

  function postToViewer(data) {
    try {
      if (!$widgetPage || !$widgetPage[0] || !$widgetPage[0].contentWindow)
        return
      var payload = typeof data === 'string' ? data : JSON.stringify(data)
      // If we already marked ready in a previous init, don't re-queue.
      try {
        if ($widgetPage[0].dataset && $widgetPage[0].dataset.wcsReady === '1') {
          _viewerReady = true
        }
      } catch (e) {}

      if (_viewerReady) {
        $widgetPage[0].contentWindow.postMessage(payload, '*')
      } else {
        _viewerQueue.push(payload)
      }
    } catch (e) {
      // ignore
    }
  }

  // Bind iframe load handler once.
  try {
    if ($widgetPage && $widgetPage[0]) {
      var iframeEl = $widgetPage[0]
      if (iframeEl.dataset && iframeEl.dataset.wcsOnloadBound !== '1') {
        iframeEl.addEventListener('load', function () {
          _markViewerReady()
        })
        iframeEl.dataset.wcsOnloadBound = '1'
      }
      // Fallback: mark ready after a short delay (better than dropping all messages).
      setTimeout(function () {
        if (!_viewerReady) _markViewerReady()
      }, 1500)
    }
  } catch (e) {}

  function showArticle() {
    adoptableArticle()
    widgetDomMain.css('display', 'block')
    postToViewer({ method: 'openPannel' })
  }

  $('#syncd-title').click(function () {
    // $("#syncd-pannel").remove();
    showArticle()
  })

  function adoptableArticle() {
    try {
      var $reader = new Readability(document.cloneNode(true)).parse()
      console.log('adoptableArticle', $reader)
    } catch (e) {
      console.log('Readability.error', e)
    }
    var $article = $(ReaderArticleFinderJS.adoptableArticle().outerHTML)
    /*补全绝对路径链接*/
    $article.find('a').each(function (idx, a) {
      a.setAttribute('href', a.href)
      if (a.target == '' || a.target.toLowerCase() == '_self') {
        a.setAttribute('target', '_top')
      }
    })
    $article.find('img').each(function (idx, img) {
      console.log('img.src', img.src, img)
      img.setAttribute('src', img.src)
      var imageSrc = img.getAttribute('src')
      if (!imageSrc) {
        if (img.getAttribute('data-actualsrc') != null) {
          img.setAttribute('src', img.getAttribute('data-actualsrc'))
        }
        if (img.getAttribute('_src') != null) {
          console.log('use _src')
          img.setAttribute('src', img.getAttribute('_src'))
        }
      } else {
        if (imageSrc.indexOf('data:image/svg+xml') > -1) {
          if (img.getAttribute('data-actualsrc') != null) {
            img.setAttribute('src', img.getAttribute('data-actualsrc'))
          }
        }
      }
      console.log('after', img)
    })

    function getImageUrl(node) {
      if (!node) return null
      var link = node.src
      var $node = $(node)
      if ($node.attr('data-src')) {
        link = $node.attr('data-src')
      }
      if (link.indexOf('data:image') > -1) link = null
      return link
    }

    var pageData = {
      article: $article[0].outerHTML,
      url: window.location.href,
      leadingImage: getImageUrl(ReaderArticleFinderJS.leadingImage),
      mainImage: getImageUrl(ReaderArticleFinderJS.mainImageNode()),
      pageNumber: ReaderArticleFinderJS.pageNumber,
      description: ReaderArticleFinderJS.pageDescription(),
      nextPage: ReaderArticleFinderJS.nextPageURL(),
      title: ReaderArticleFinderJS.articleTitle(),
      rtl: !ReaderArticleFinderJS.articleIsLTR(),
    }

    console.log(
      '',
      $widgetPage,
      $widgetPage[0],
      ReaderArticleFinderJS.adoptableArticle(),
      pageData
    )
    postToViewer(pageData)
  }

  function findAndShow(timeout, found) {
    var count = 0
    var tid = setInterval(function () {
      if (count > 20) {
        timeout && timeout()
        return clearInterval(tid)
      }
      if (ReaderArticleFinderJS.isReaderModeAvailable()) {
        clearInterval(tid)
        found && found()
      }
      count++
    }, 1000)
  }

  function getArticle() {
    // var av = ReaderArticleFinderJS.isReaderModeAvailable();
    var arcArticle = null
    try {
      arcArticle = new Readability(document.cloneNode(true)).parse()
      // arcArticle = true;
      console.log('adoptableArticle', arcArticle)
    } catch (e) {
      console.log('Readability.error', e)
    }
    return arcArticle
  }

  function hasArticle() {
    return getArticle() != null
  }

  if (isForceShow) {
    if (window.location.hostname.includes('mdnice.com')) {
      // Mdnice Special Logic
      fetchMdniceArticle()
        .then(function (data) {
          var title = 'Mdnice 文章'
          try {
            if (data.markdown) {
              var titleMatch = data.markdown.match(/^#+\s+(.*)/m)
              if (titleMatch) title = titleMatch[1].trim()
            }
          } catch (e) {}

          // Try to find leading image in markdown
          var leadingImage = null
          try {
            if (data.markdown) {
              var imgMatch = data.markdown.match(/!\[.*?\]\((.*?)\)/)
              leadingImage = imgMatch ? imgMatch[1] : null
            }
          } catch (e) {}

          // Use rendered HTML if available (better for preview), otherwise Markdown
          var finalContent =
            data.html || '<pre>' + (data.markdown || '') + '</pre>'

          var thePageData = {
            article: finalContent,
            markdown: data.markdown || '',
            url: window.location.href,
            leadingImage: leadingImage,
            mainImage: leadingImage,
            pageNumber: 1,
            description: (data.markdown || '')
              .slice(0, 100)
              .replace(/\n/g, ' '),
            nextPage: 0,
            title: title,
            rtl: false,
          }

          console.log('Mdnice data', thePageData)
          postToViewer(thePageData)
          widgetDomMain.css('display', 'block')
          postToViewer({ method: 'openPannel' })
        })
        .catch(function (e) {
          console.log('Mdnice fetch error', e)
          alert('无法从 Mdnice 提取文章: ' + e.message)
        })
      return
    }

    // hasArticle();
    if (ReaderArticleFinderJS.isReaderModeAvailable()) {
      // showArticle();
      findAndShow(
        function () {},
        function () {
          showArticle()
        }
      )
    } else if (hasArticle()) {
      function allocate() {
        var $article = getArticle()
        var $dom = $($article.content)
        var thePageData = {
          article: $article.content,
          url: window.location.href,
          leadingImage: $dom.find('img').eq(0).attr('src'),
          mainImage: $dom.find('img').eq(0).attr('src'),
          pageNumber: 1,
          description: $article.excerpt,
          nextPage: 0,
          title: document.title,
          rtl: false,
        }
        console.log('', $widgetPage, $widgetPage[0], thePageData)
        postToViewer(thePageData)
        widgetDomMain.css('display', 'block')
        postToViewer({ method: 'openPannel' })
      }

      setTimeout(() => {
        allocate()
      }, 1000)
    } else {
      const artitleDoms = $('article')
      if (artitleDoms.length) {
        function allocate() {
          var thePageData = {
            article: artitleDoms[0].outerHTML,
            url: window.location.href,
            leadingImage: artitleDoms.find('img').attr('src'),
            mainImage: artitleDoms.find('img').attr('src'),
            pageNumber: 1,
            description: $('meta[name=description]').attr('content'),
            nextPage: 0,
            title: document.title,
            rtl: false,
          }
          console.log('', $widgetPage, $widgetPage[0], thePageData)
          postToViewer(thePageData)
          widgetDomMain.css('display', 'block')
          postToViewer({ method: 'openPannel' })
        }

        setTimeout(() => {
          allocate()
        }, 1000)
      } else {
        alert('无法识别到文章')
      }
    }
  } else {
    $('#syncd-pannel').show()
    findAndShow(
      function () {
        $('#syncd-title').html('未找到')
        setTimeout(function () {
          $('#syncd-pannel').remove()
        }, 2000)
      },
      function () {
        $('#syncd-title').html(ReaderArticleFinderJS.articleTitle())
      }
    )
  }

  window.addEventListener('message', function (evt) {
    try {
      var data = JSON.parse(evt.data)
      if (data.method == 'closeMe') {
        widgetDomMain.css('display', 'none')
      }
    } catch (e) {}
  })

  chrome.runtime.onMessage.addListener(function (
    request,
    sender,
    sendResponseA
  ) {
    console.log('page.js revice', request)
    postToViewer(request)
  })
}

var isEditorPage =
  window.location.href.indexOf('mp.weixin.qq.com/cgi-bin/appmsg') > -1

if (!isEditorPage) {
  // initPageFetch();
} else {
  window.addEventListener('message', function (evt) {
    try {
      var data = JSON.parse(evt.data)
      if (data.method == 'GoTemplateCenter') {
        // chrome.tabs.create({
        //   url: chrome.runtime.getURL("editor.html")
        // });
        window.open(chrome.runtime.getURL('templates.html'))
      }
    } catch (e) {
      console.log('page listner', e)
    }
  })
}

var methodManager = {
  fetchArticle: function (request, sender, sendResponse) {
    // MV3 messaging: if the sender expects a response (background uses a callback),
    // we must call sendResponse synchronously or keep the port open by returning true.
    // Here we only need an ACK to avoid "The message port closed before a response was received."
    try {
      initPageFetch(true)
      try {
        sendResponse && sendResponse({ ok: true, started: true })
      } catch (e) {
        // ignore
      }
    } catch (e) {
      try {
        sendResponse &&
          sendResponse({ ok: false, error: (e && e.message) || String(e) })
      } catch (e2) {
        // ignore
      }
    }
  },
}

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.method) {
    // Propagate return value in case a method wants to keep the message channel open.
    return methodManager[request.method](request, sender, sendResponse)
  }
})

// window.frames['uchome-ifrHtmlEditor'].window.frames['HtmlEditor'].document.body.innerHTML
// window.onload = function() {
console.log('discuz_cache')
if (
  window.location.href.indexOf('loaddraft') > -1 ||
  (document.referrer && document.referrer.indexOf('loaddraft') > -1)
) {
  ;(function loop() {
    if (window.frames['uchome-ifrHtmlEditor'] || window.e_iframe) {
      function extractPage(cacheData) {
        // resp.result.discuz_cache
        console.log('extractPage', cacheData)
        if (document.querySelector('#subject')) {
          console.log('set title')
          document.querySelector('#subject').value = cacheData.title
        } else {
          console.log('no title')
        }
        if (window.e_iframe) {
          window.e_iframe.contentWindow.document.body.innerHTML =
            cacheData.content
        } else {
          console.log('not frame')
        }
        // for another
        if (window.frames['uchome-ifrHtmlEditor']) {
          document.querySelector('#title').value = cacheData.title
          window.frames['uchome-ifrHtmlEditor'].window.frames[
            'HtmlEditor'
          ].document.body.innerHTML = cacheData.content
        }
      }
      chrome.runtime.sendMessage(
        {
          action: 'getCache',
          name: 'discuz_cache',
        },
        function (resp) {
          var data = JSON.parse(resp.result.discuz_cache)
          // alert(resp.result.discuz_cache)
          console.log('getCache return', resp)
          try {
            extractPage(data)
          } catch (e) {
            console.log('extractPage.error', e)
          }
        }
      )

      return
    } else {
      console.log('not found;')
    }
    setTimeout(loop, 500)
  })()
} else {
  console.log('skip')
}
// }

function waitForElement(selector, timeout) {
  timeout = timeout || 3000
  return new Promise(function (resolve) {
    var el = document.querySelector(selector)
    if (el) {
      return resolve(el)
    }
    var observer = new MutationObserver(function (mutations) {
      var el = document.querySelector(selector)
      if (el) {
        resolve(el)
        observer.disconnect()
      }
    })
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })
    setTimeout(function () {
      observer.disconnect()
      resolve(null)
    }, timeout)
  })
}

function fetchMdniceArticle() {
  // Return { markdown, html, saveTime }.
  // Strategy:
  // 0) Simulate "Copy to WeChat" click to ensure rendering
  // 1) DOM preview container (#nice or common fallbacks) for HTML
  // 2) Editor extraction (Ace / CodeMirror / Monaco / textarea) for Markdown
  return new Promise(function (resolve, reject) {
    // 0. Simulate click on "Copy to WeChat" if available to trigger rendering/formatting
    var wechatBtn = document.querySelector('#nice-sidebar-wechat')
    if (wechatBtn) {
      console.log(
        'Clicking #nice-sidebar-wechat to generate WeChat-ready content'
      )
      try {
        wechatBtn.click()
      } catch (e) {
        console.warn('Failed to click wechat sidebar button', e)
      }
    }

    setTimeout(
      function () {
        function safeGetText(el) {
          try {
            return el
              ? el.value != null
                ? el.value
                : el.innerText || el.textContent || ''
              : ''
          } catch (e) {
            return ''
          }
        }

        function extractMarkdownFromEditors() {
          // Ace
          try {
            var aceLines = document.querySelectorAll(
              '.ace_text-layer .ace_line, .ace_line'
            )
            if (aceLines && aceLines.length) {
              var lines = []
              aceLines.forEach(function (line) {
                lines.push(line.innerText)
              })
              return lines.join('\n')
            }
          } catch (e) {}

          // CodeMirror 6 (DOM-based)
          try {
            var cm6Lines = document.querySelectorAll('.cm-editor .cm-line')
            if (cm6Lines && cm6Lines.length) {
              var cmLines = []
              cm6Lines.forEach(function (line) {
                cmLines.push(line.innerText)
              })
              // CM6 may represent empty doc as a single empty line; still fine.
              return cmLines.join('\n')
            }
          } catch (e) {}

          // CodeMirror 5 (instance attached to element.CodeMirror)
          try {
            var cmEl = document.querySelector('.CodeMirror')
            if (cmEl && cmEl.CodeMirror && cmEl.CodeMirror.getValue) {
              return cmEl.CodeMirror.getValue()
            }
          } catch (e) {}

          // Monaco (best-effort)
          try {
            if (
              window.monaco &&
              window.monaco.editor &&
              window.monaco.editor.getModels
            ) {
              var models = window.monaco.editor.getModels()
              if (models && models.length && models[0].getValue) {
                return models[0].getValue()
              }
            }
          } catch (e) {}

          // textarea fallback (mdnice often keeps a hidden textarea)
          try {
            var ta = document.querySelector(
              'textarea[name="content"], textarea[name="markdown"], textarea#content, textarea#markdown, textarea'
            )
            var text = safeGetText(ta)
            if (text && text.length > 0) return text
          } catch (e) {}

          return ''
        }

        function findPreviewHtml() {
          // mdnice preview container historically uses #nice; add common fallbacks.
          var selectors = [
            '#nice',
            '#preview',
            '.preview',
            '.preview-body',
            '.output',
            '.markdown-body',
            '[data-testid="preview"]',
          ]
          for (var i = 0; i < selectors.length; i++) {
            var el = document.querySelector(selectors[i])
            if (el && el.innerHTML && el.innerHTML.trim().length > 0) {
              return el.innerHTML
            }
          }
          return ''
        }

        function findPreviewHtmlInSameOriginIframes() {
          try {
            var iframes = document.querySelectorAll('iframe')
            for (var i = 0; i < iframes.length; i++) {
              var iframe = iframes[i]
              var doc = null
              try {
                doc =
                  iframe.contentDocument ||
                  (iframe.contentWindow && iframe.contentWindow.document)
              } catch (e) {
                doc = null
              }
              if (!doc) continue
              try {
                var html = ''
                // reuse the same selectors
                var selectors = [
                  '#nice',
                  '#preview',
                  '.preview',
                  '.preview-body',
                  '.output',
                  '.markdown-body',
                  '[data-testid="preview"]',
                ]
                for (var j = 0; j < selectors.length; j++) {
                  var el = doc.querySelector(selectors[j])
                  if (el && el.innerHTML && el.innerHTML.trim().length > 0) {
                    html = el.innerHTML
                    break
                  }
                }
                if (html && html.trim().length > 0) return html
              } catch (e) {
                // ignore this iframe
              }
            }
          } catch (e) {}
          return ''
        }

        function extractMarkdownFromSameOriginIframes() {
          try {
            var iframes = document.querySelectorAll('iframe')
            for (var i = 0; i < iframes.length; i++) {
              var iframe = iframes[i]
              var win = null
              var doc = null
              try {
                win = iframe.contentWindow
                doc = iframe.contentDocument || (win && win.document)
              } catch (e) {
                win = null
                doc = null
              }
              if (!doc) continue
              try {
                // Ace
                var aceLines = doc.querySelectorAll(
                  '.ace_text-layer .ace_line, .ace_line'
                )
                if (aceLines && aceLines.length) {
                  var lines = []
                  aceLines.forEach(function (line) {
                    lines.push(line.innerText)
                  })
                  return lines.join('\n')
                }
                // CM6
                var cm6Lines = doc.querySelectorAll('.cm-editor .cm-line')
                if (cm6Lines && cm6Lines.length) {
                  var cmLines = []
                  cm6Lines.forEach(function (line) {
                    cmLines.push(line.innerText)
                  })
                  return cmLines.join('\n')
                }
                // textarea
                var ta = doc.querySelector(
                  'textarea[name="content"], textarea[name="markdown"], textarea#content, textarea#markdown, textarea'
                )
                var text = safeGetText(ta)
                if (text && text.length > 0) return text
              } catch (e) {
                // ignore
              }
            }
          } catch (e) {}
          return ''
        }

        function resolveWith(markdown, html) {
          resolve({
            markdown: markdown || '',
            html: html || null,
            saveTime: Date.now(),
          })
        }

        // 1) DOM preview first (fast), and always try to also extract markdown.
        waitForElement('#nice', 2000).then(function () {
          var html = findPreviewHtml()
          var markdown = extractMarkdownFromEditors()
          if (!html) html = findPreviewHtmlInSameOriginIframes()
          if (!markdown) markdown = extractMarkdownFromSameOriginIframes()
          if (html && html.trim().length > 0) {
            console.log('Mdnice: extracted HTML from preview container')
            resolveWith(markdown, html)
            return
          }
          if (markdown && markdown.trim().length > 0) {
            console.log(
              'Mdnice: extracted Markdown from editor (no preview html found)'
            )
            resolveWith(markdown, null)
            return
          }

          reject(new Error('No content found via DOM'))
        })
      },
      wechatBtn ? 1000 : 0
    )
  })
}
