function getCache(name, cb) {
  chrome.runtime.sendMessage(
    {
      action: 'getCache',
      name: name,
    },
    function (resp) {
      cb && cb(resp.result[name])
    }
  )
}

function getMultiCache(names, cb) {
  chrome.runtime.sendMessage(
    {
      action: 'getCache',
      names: names,
    },
    function (resp) {
      cb && cb(resp.result)
    }
  )
}

function setCache(name, value, cb) {
  chrome.runtime.sendMessage(
    {
      action: 'setCache',
      name: name,
      value: value,
    },
    function (resp) {
      cb && cb(resp)
    }
  )
}

function sendEvent(category, action, label) {
  chrome.runtime.sendMessage(
    {
      action: 'sendEvent',
      event: {
        category: category,
        action: action,
        label: label,
      },
    },
    function (resp) {
      cb && cb(resp)
    }
  )
}

var unsafeWindow
var sharedTaskStatus = null

// MV3: 存储从 background 通过 chrome.scripting.executeScript 获取的页面全局变量
var pageGlobals = null

// MV3: 异步获取页面全局变量（替代原来的内联脚本注入）
function fetchPageGlobals() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getPageGlobals' }, function (data) {
      if (chrome.runtime.lastError) {
        console.error('fetchPageGlobals error:', chrome.runtime.lastError)
      }
      if (data && (data.title || data.desc || data.thumb)) {
        pageGlobals = data
        console.log('[WCS] pageGlobals fetched via scripting API:', pageGlobals)
      } else {
        console.warn('[WCS] scripting API returned empty, will use DOM fallback. data:', data)
      }
      resolve(pageGlobals)
    })
  })
}

// 页面加载后获取全局变量
setTimeout(function () {
  console.log('[WCS] Starting fetchPageGlobals...')
  fetchPageGlobals().then(result => {
    console.log('[WCS] fetchPageGlobals completed, result:', result)
  })
}, 100)

console.log('accounts', accounts)

// 获取文章数据（同步版本，依赖 pageGlobals 或 DOM fallback）
function getPost() {
  var post = {}
  
  // 优先使用 pageGlobals（通过 scripting API 获取）
  if (pageGlobals && pageGlobals.title) {
    post.title = pageGlobals.title
    post.thumb = pageGlobals.thumb
    post.desc = pageGlobals.desc
    post.nickname = pageGlobals.nickname
    post.publish_time = pageGlobals.publish_time
    console.log('[WCS] Using pageGlobals data')
  } else {
    // DOM fallback（以防 scripting API 失败）
    // 微信公众号文章标题有多种可能的选择器
    post.title = document.querySelector('#activity-name')?.textContent?.trim()
              || document.querySelector('.rich_media_title')?.textContent?.trim()
              || document.querySelector('h1.rich_media_title')?.textContent?.trim()
              || document.querySelector('meta[property="og:title"]')?.content
              || document.title?.replace(/ - 微信公众平台$/, '')?.trim()
    
    // 封面图
    post.thumb = document.querySelector('meta[property="og:image"]')?.content
              || document.querySelector('meta[name="twitter:image"]')?.content
              || document.querySelector('#js_content img')?.src
    
    // 摘要
    post.desc = document.querySelector('meta[property="og:description"]')?.content
             || document.querySelector('meta[name="description"]')?.content
    
    // 作者/公众号名称
    post.nickname = document.querySelector('#js_name')?.textContent?.trim()
                 || document.querySelector('.profile_nickname')?.textContent?.trim()
                 || document.querySelector('a#js_name')?.textContent?.trim()
    
    // 发布时间
    post.publish_time = document.querySelector('#publish_time')?.textContent?.trim()
                     || document.querySelector('.rich_media_meta_text')?.textContent?.trim()
    
    console.log('[WCS] Using DOM fallback data')
  }
  
  // 正文始终从 DOM 获取
  post.content = $('#js_content').html()
  post.link = window.location.href
  
  console.log('[WCS] getPost result:', post)
  return post
}

// 异步版本的 getPost，确保 pageGlobals 已加载
async function getPostAsync() {
  console.log('[WCS] getPostAsync called, current pageGlobals:', pageGlobals)
  if (!pageGlobals) {
    console.log('[WCS] pageGlobals is null, fetching...')
    await fetchPageGlobals()
    console.log('[WCS] After fetch, pageGlobals:', pageGlobals)
  }
  return getPost()
}

function extractUrlValue(key, url) {
  if (typeof url === 'undefined') url = window.location.href
  var match = url.match('[?&]' + key + '=([^&]+)')
  return match ? match[1] : null
}

var isSinglePage = window.location.href.indexOf('mp.weixin.qq.com/s') > -1
if (isSinglePage) {
  //   setTimeout(() => {
  //     getPost();
  //   }, 3000);
  var div = $(
    "<div class='sync-btn' style='position: fixed; left: 0; right: 0;top: 68px;width: 950px; margin-left: auto;margin-right: auto;'></div>"
  )
  div.append(
    '<div data-toggle="modal" data-target="#exampleModalCenter" style=\'    font-size: 14px;border: 1px solid #eee;width: 105px; text-align: center; box-shadow: 0px 0px 1px rgba(0,0,0, 0.1);border-radius: 5px;padding: 5px; cursor: pointer;    background: rgb(0, 123, 255);color: white;\'>同步该文章</div>'
  )

  async function afterGet() {
    var post = await getPostAsync()
    var html = ''
    accounts = allAccounts
    var supportAccounts = allAccounts.filter((item) => {
      if (!item.supportTypes) return true
      return item.supportTypes.indexOf('html') > -1
    })

    supportAccounts.forEach((account, index) => {
      html +=
        `
            <div class="form-check mb-1">
  <input class="form-check-input" type="checkbox" value="` +
        account.uid +
        `" name="submit_check" id="defaultCheck` +
        index +
        `">
  <label class="form-check-label" for="defaultCheck` +
        index +
        `">
  <img src="` +
        (account.avatar || account.icon
          ? account.avatar || account.icon
          : chrome.extension.getURL('images/wordpress.ico')) +
        `" class="icon" height="20" style="vertical-align: -3px;height: 20px !important">
  ` +
        account.title +
        `
  </label>
</div>
            `
    })

    var con =
      `
        <div class="media">
        <img class="align-self-center mr-3" src="` +
      post.thumb +
      `" width="150" alt="Generic placeholder image">
        <div class="media-body">
          <h5 class="mt-0" style="font-weight:bold">` +
      post.title +
      `</h5>
          <p>` +
      post.desc +
      `</p>
        </div>
      </div>
      <hr>
      <div id="top-tip-block"></div>
      <h6>账号</h6>
      <div id="syncd-users">
      ` +
      html +
      `
      </div>
      <div id="tip-block"></div>
        `

    $('#exampleModalCenter .modal-body').html('')
    $('#exampleModalCenter .modal-body').append(con)
    console.log('clicka')
    restoreAndAutodCheckd()
    // console.log($('#exampleModalCenter').modal())
    $('#syncd-users').click(checkShareStatus)
  }
  div.click(function () {
    getAccounts(() => {
      afterGet()
    })
  })
  $('#page-content').append(div)
}

var html = `
<!-- Modal -->
<div class="modal fade" id="exampleModalCenter" tabindex="-1" role="dialog" aria-labelledby="exampleModalCenterTitle" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered" role="document" style="color: #444;">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="exampleModalLongTitle">同步文章</h5>
        <button type="button" class="close" data-dismiss="modal" aria-label="Close" id="closesyncmodl">
          <span aria-hidden="true">&times;</span>
        </button>
      </div>
      <div class="modal-body">

      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-dismiss="modal" style="font-size: 13px;    line-height: 1.5;">取消</button>
        <button type="button" class="btn btn-primary" style="font-size: 13px;    line-height: 1.5;">同步</button>
      </div>
    </div>
  </div>
</div>
`

$('body').append(html)

$('body').append(`
<div data-toggle="modal" data-target="#exampleModalCenterForShare" id="sharetrigger"></div>
<!-- Modal -->
<div class="modal fade" id="exampleModalCenterForShare" tabindex="-1" role="dialog" aria-labelledby="exampleModalCenterForShareTitle" aria-hidden="true">
  <div class="modal-dialog modal-sm modal-dialog-centered modal-dialog-scrollable" role="document" style="color: #444;">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="exampleModalLongTitle">求分享</h5>
        <button type="button" class="close" data-dismiss="modal" aria-label="Close" id="closesyncmodl">
          <span aria-hidden="true">&times;</span>
        </button>
      </div>
      <div class="modal-body">
 <div><h3 style="color: #aaa;font-size: 16px;">请帮忙分享给有需要的人！</h3>
 <p id="doubanshare" style="/* margin-top: 17px */">
 </p>
 <p id="weiboshare" style="margin-bottom: 25px;">
</p>
<h3 style="color: #666;font-size: 16px;">或复制分享</h3><textarea style="
    width: 100%;
    height: 200px;
    background: #eee;
    color: #777;
    padding: 10px;
    border: 1px solid #ddd;
    "
    id="sshare-text"
    ></textarea></div>
    </div>
    </div>
  </div>
</div>
`)

var hasbeenShared = false
var syncCount = 0
var syncCountKey = `total_sync`
var isShareKey = `detect_share`
var shareShowedKey = `share_showed`
var shareShowedCount = 0
var popupShareTime = null
var shareShouldCost = 12 * 1000
var shareTotalShowLimit = 6
var shareInteractioned = false

function afterShareInteraction(type) {
  shareInteractioned = true
  var label = sharedTaskStatus
    ? sharedTaskStatus.accounts.map((account) => {
        return [account.type, account.uid, account.title].join('-')
      })
    : 'default'
  sendEvent('share', type, [label, syncCount].join(';;'))
}

function isTimeToShowShareTip() {
  return syncCount < 5
    ? syncCount > 1 && syncCount % 2 == 0
    : syncCount % 3 == 0
}

function showShareTip() {
  // maybe show sharetip
  if (isTimeToShowShareTip()) {
    if (hasbeenShared) return
    $('#sharetrigger').click()
    popupShareTime = Date.now()
    // count
    setCache(shareShowedKey, shareShowedCount + 1)
  }
}

function initShareConfig() {
  var shareText = document.getElementById('sshare-text')
  var doubanshare = document.getElementById('doubanshare')
  var weiboshare = document.getElementById('weiboshare')

  var shareUrl = 'https://www.wechatsync.com/?utm_source=byshare'
  var sharText = `文章同步助手 - 一键同步文章到头条、百家号等多达20个渠道，提高内容发布效率，解放生产力！`

  shareText.innerHTML = sharText + ' ' + shareUrl
  shareText.onselect = function () {
    afterShareInteraction('share-selected')
  }

  doubanshare.addEventListener('click', function () {
    afterShareInteraction('douban-clicked')
    ~(function () {
      var d = document,
        e = encodeURIComponent,
        s1 = window.getSelection,
        s2 = d.getSelection,
        s3 = d.selection,
        s = s1 ? s1() : s2 ? s2() : s3 ? s3.createRange().text : '',
        r =
          'https://www.douban.com/recommend/?url=' +
          e(shareUrl) +
          '&title=' +
          e(sharText) +
          '&sel=' +
          e(s) +
          '&v=1',
        w = 450,
        h = 330,
        x = function () {
          var openWin = window.open(
            r,
            'douban',
            'toolbar=0,resizable=1,scrollbars=yes,status=1,width=' +
              w +
              ',height=' +
              h +
              ',left=' +
              (screen.width - w) / 2 +
              ',top=' +
              (screen.height - h) / 2
          )
          if (!openWin) location.href = r + '&r=1'
        }
      if (/Firefox/.test(navigator.userAgent)) {
        setTimeout(x, 0)
      } else {
        x()
      }
    })()
  })

  weiboshare.addEventListener('click', function () {
    afterShareInteraction('weibo-clicked')
    ;(function () {
      var d = document,
        e = encodeURIComponent,
        s1 = window.getSelection,
        s2 = d.getSelection,
        s3 = d.selection,
        s = s1 ? s1() : s2 ? s2() : s3 ? s3.createRange().text : '',
        r =
          'https://service.weibo.com/share/share.php?url=' +
          e(shareUrl) +
          '&language=zh_cn&title=' +
          e(sharText) +
          '%20%40_fun0&source=&sourceUrl=&ralateUid=&message=&uids=&pic=&searchPic=false&content=',
        w = 450,
        h = 330,
        x = function () {
          var openWin = window.open(
            r,
            'weibo',
            'toolbar=0,resizable=1,scrollbars=yes,status=1,width=' +
              w +
              ',height=' +
              h +
              ',left=' +
              (screen.width - w) / 2 +
              ',top=' +
              (screen.height - h) / 2
          )
          if (!openWin) location.href = r + '&r=1'
        }
      if (/Firefox/.test(navigator.userAgent)) {
        setTimeout(x, 0)
      } else {
        x()
      }
    })()
  })

  doubanshare.innerHTML = `<a ><img src="https://img3.doubanio.com/pics/fw2douban1.png" alt="推荐到豆瓣" /></a>`
  weiboshare.innerHTML = `<a style="font-size: 13px"><img height="18" src="https://cambrian-images.cdn.bcebos.com/a487b054820191e8e7a2fcf136b925b9_1551320091220.jpeg" style="vertical-align: -3px;" /> 分享到微博</a>`
}

setTimeout(initShareConfig, 200)

chrome.runtime.onMessage.addListener(function (request, sender, sendResponseA) {
  console.log('content.js revice', request)
  try {
    console.log('revice', request)
    if (request.method == 'taskUpdate') {
      buildStatusHtml(request.task)
    }
  } catch (e) {
    console.log(e)
  }
})

function checkShareStatus() {
  console.log('checkShareStatus')
  if (popupShareTime) {
    var spendTime = Date.now() - popupShareTime
    var isReachShareCost = spendTime > shareShouldCost
    if (isReachShareCost && shareInteractioned) {
      console.log('reach share action')
      setCache(isShareKey, '1')
    }
    console.log('spendTime', spendTime)
  }
}

getMultiCache([isShareKey, syncCountKey, shareShowedKey], function (result) {
  console.log('result', result)
  if (result[isShareKey]) {
    hasbeenShared = true
  }

  if (result[syncCountKey]) {
    syncCount = parseInt(result[syncCountKey])
  }

  if (result[shareShowedKey]) {
    shareShowedCount = parseInt(result[shareShowedKey])
  }
})

function buildStatusHtml(taskStatus) {
  var isNotFirstAppend = $('.alld-pubaccounts').length
  sharedTaskStatus = taskStatus

  var allDoneAccounts = taskStatus.accounts.filter((_) => _.status == 'done')
  var isAllDone = allDoneAccounts.length == taskStatus.accounts.length
  // console.log('isAllDone', isAllDone, localStorage.getItem('dismiss_donate'))
  var list = taskStatus.accounts.map((account) => {
    var msg =
      (account.status == 'uploading'
        ? ` <div class="lds-dual-ring"></div>` +
          (account.msg ? account.msg : `同步中`)
        : ``) +
      (account.status == 'failed'
        ? `同步失败, 错误内容：` + account.error
        : ``) +
      (account.status == 'done' && account.editResp
        ? `同步成功 <a
                      href="` +
          account.editResp.draftLink +
          `"
                      style="margin-left: 5px"
                      target="_blank"
                      >查看草稿</a
                    >`
        : ``)
    if (isNotFirstAppend) {
      var obj = $('.' + account.type + '-message')
      if (obj.length) {
        obj.html(msg)
      }
      return msg
    }
    return (
      `<div class="account-item taskStatus">
                 ` +
      (account.avatar || account.icon
        ? ` <img src="` +
          (account.avatar || account.icon) +
          `" class="icon"
      width="20"
      height="20"
      style="vertical-align: -6px;height: 20px !important"
    />`
        : '') +
      `<span class="name-block">` +
      account.title +
      `</span><span
                  style="margin-left: 15px"
                  class="` +
      account.type +
      `-message ` +
      account.status +
      ` message"
                >
                  ` +
      msg +
      `</span></div>`
    )
  })
  var html =
    `
  <div class="alld-pubaccounts">
  ` +
    list.join('\n') +
    `</div>`

  console.log(list, html)

  // $("#syncd-users").html("");
  if (isNotFirstAppend) {
    // taskStatus.accounts.map(account => {
    // });
  } else {
    $('#syncd-users').html(html)
  }

  if (isAllDone) {
    console.log('all done, notify share')
    // syncCount = syncCount+1
    setCache(syncCountKey, syncCount + 1)
    showShareTip()
    // $('#exampleModalCenterForShare').on('hide.bs.modal', function() {
    //   console.log('share closed')
    //   // do something…
    // })
  }
}

$('#exampleModalCenter .btn-primary').click(async function (e) {
  // var listAccount = $('input[name="submit_check"]')
  // var saccounts = []
  // for (let index = 0; index < listAccount.length; index++) {
  //   const element = listAccount[index]
  //   if (element.checked) {
  //     var aa = accounts.filter((t) => {
  //       return t.uid == element.value
  //     })
  //     console.log(accounts, element.value)
  //     saccounts.push(aa[0])
  //   }
  // }
  const saccounts = getAllCheckedAccounts()

  if (!saccounts.length) {
    alert('请选择账号')
    return e.stopPropagation()
  }

  // MV3: 异步获取文章数据
  const post = await getPostAsync()

  chrome.runtime.sendMessage(
    {
      action: 'addTask',
      task: {
        post: post,
        accounts: saccounts,
      },
    },
    function (resp) {
      console.log('addTask return', resp)
    }
  )
  // getCache

  $('#syncd-users').html('等待发布...')
  // $("#closesyncmodl").click();
})

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

function saveCheckdStatus(accounts) {
  try {
    localStorage.setItem('_sync_checked_all', JSON.stringify(accounts))
  } catch (e) {}
}

function restoreCheckedState() {
  if (localStorage.getItem('_sync_checked_all')) {
    const checkedAccounts = JSON.parse(
      localStorage.getItem('_sync_checked_all')
    )
    return checkedAccounts
  }
  return []
}

function restoreAndAutodCheckd() {
  var listAccount = $('input[name="submit_check"]')
  var checkedAccounts = restoreCheckedState()
  for (let index = 0; index < listAccount.length; index++) {
    const element = listAccount[index]
    var cAccounts = checkedAccounts.filter((t) => {
      return t.uid == element.value
    })
    if (cAccounts.length) {
      element.checked = true
    }
  }
}

function getAllCheckedAccounts() {
  var listAccount = $('input[name="submit_check"]')
  var saccounts = []
  for (let index = 0; index < listAccount.length; index++) {
    const element = listAccount[index]
    if (element.checked) {
      var aa = accounts.filter((t) => {
        return t.uid == element.value
      })
      console.log(accounts, element.value)
      saccounts.push(aa[0])
    }
  }
  // if (!saccounts.length) {
  //   alert('请选择账号')
  //   return e.stopPropagation()
  // }
  saveCheckdStatus(saccounts)
  return saccounts
}

// getAccounts();

var isEditorPage =
  window.location.href.indexOf('mp.weixin.qq.com/cgi-bin/appmsg') > -1
if (isEditorPage) {
  // intiEditor();
  var script = document.createElement('script')
  script.type = 'text/javascript'
  script.src = chrome.runtime.getURL('autoformat.js')
  script.setAttribute('data-url', chrome.runtime.getURL('templates.html'))
  document.head.appendChild(script)
  // document.head.removeChild(script);
  const editorStatusBar = buildStatusContainer()

  function prepairSubmitTask() {
    const allChecked = getAllCheckedAccounts()
    console.log('prepairSubmitTask', 'syncform-selectbox', allChecked)
    if (!allChecked.length) {
      console.log('selected', 0)
      return
    }
    chrome.runtime.sendMessage(
      {
        action: 'parseArticle',
        account: {
          type: 'weixin',
        },
        data: {
          msgId: extractUrlValue('appmsgid'),
        },
      },
      function (resp) {
        editorStatusBar.show()
        $('#syncd-users').html('等待发布...')
        chrome.runtime.sendMessage(
          {
            action: 'addTask',
            task: {
              post: resp.article,
              accounts: allChecked,
            },
          },
          function (resp) {
            console.log('addTask return', resp)
          }
        )
        console.log('parseArticle return', resp)
      }
    )
  }

  const observer = new MutationObserver(onMutation)
  observer.observe(document, {
    childList: true,
    subtree: true,
  })

  function onMutation(mutations) {
    const found = []
    for (const { addedNodes } of mutations) {
      for (const node of addedNodes) {
        if (!node.tagName) continue // not an element
        if (node.classList.contains('mass-send__list')) {
          found.push(node)
        } else if (node.firstElementChild) {
          found.push(...node.getElementsByClassName('mass-send__list'))
        }
      }
    }

    if (found.length) {
      console.log('onMutation.found', found)
      initSyncForm()
    }
    // found.forEach(processFilter)
  }

  var _isInted = false
  function initSyncForm() {
    function afterGet() {
      var html = `
        <h6 style="margin-bottom: 12px">同步助手</h6> <div id="syncform-selectbox" style="padding-left: 5px">`
      accounts = allAccounts
      var supportAccounts = allAccounts.filter((item) => {
        if (!item.supportTypes) return true
        return item.supportTypes.indexOf('html') > -1
      })

      supportAccounts.forEach((account, index) => {
        html +=
          `
            <div class="form-check mb-1">
  <input class="form-check-input" type="checkbox" value="` +
          account.uid +
          `" name="submit_check" id="defaultCheck` +
          index +
          `">
  <label class="form-check-label" for="defaultCheck` +
          index +
          `">
  <img src="` +
          (account.avatar || account.icon
            ? account.avatar || account.icon
            : chrome.runtime.getURL('images/wordpress.ico')) +
          `" class="icon" height="18" style="height: 20px !important">
  ` +
          account.title +
          `
  </label>
</div>
            `
      })

      $('.mass-send__form').append(html + '</div>')
      restoreAndAutodCheckd()
      console.log('html', html)
    }

    getAccounts(() => {
      afterGet()
      setTimeout(() => {
        $('.mass-send__footer .weui-desktop-btn_primary').click(() => {
          console.log('clicked')
          getAllCheckedAccounts()
          ;(function waitUntil() {
            const confirmDialogs = $('.weui-desktop-dialog__wrp').filter(
              function () {
                return $(this).text().indexOf('开始群发后无法撤销') > -1
              }
            )
            if (confirmDialogs.length) {
              confirmDialogs.find('.weui-desktop-btn_primary').click(() => {
                console.log('btn clicked')
                prepairSubmitTask()
              })
              return
            }
            setTimeout(waitUntil, 300)
          })()
        })
      }, 100)
    })

    console.log('initSyncForm', allAccounts)
  }
}

function buildStatusContainer() {
  const template = `<div class="weui-desktop-dialog" style="position: fixed;
    right: -25px;
    top: 25px;
    min-width: 350px;
    width: 350px;
    z-index: 99998;">
    <div class="weui-desktop-dialog__hd" style="
    line-height: 50px;
    height: 50px;
">
  <h3 class="weui-desktop-dialog__title">同步助手</h3>
    <button class="weui-desktop-icon-btn weui-desktop-dialog__close-btn"><svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg"><path d="M10.01 8.996l7.922-7.922c.086-.086.085-.21.008-.289l-.73-.73c-.075-.074-.208-.075-.29.007L9 7.984 1.077.062C.995-.02.863-.019.788.055l-.73.73c-.078.078-.079.203.007.29l7.922 7.92-7.922 7.922c-.086.086-.085.212-.007.29l.73.73c.075.074.207.074.29-.008l7.92-7.921 7.922 7.921c.082.082.215.082.29.008l.73-.73c.077-.078.078-.204-.008-.29l-7.921-7.921z"></path></svg></button></div>
    <div style="    width: 100%;
    min-height: 300px;
    background: white;">
      <div id="syncd-users" style="padding: 0 32px"></div>
      <div id="tip-block" style="padding: 0 32px"></div>
    </div>
  </div>`
  const wrapper = $(template)
  $('body').append(wrapper)

  $('#exampleModalCenterForShare').css({
    zIndex: '99998',
  })
  wrapper.hide()
  wrapper.find('.weui-desktop-dialog__close-btn').click(() => {
    wrapper.hide()
  })
  return wrapper
}
