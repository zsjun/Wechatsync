
export default class ToutiaoAdapter {
  constructor() {
    // this.skipReadImage = true
    this.name = 'toutiao'

    // In MV3, driver requests originate from the extension Service Worker.
    // Toutiao APIs are sensitive to Origin/Referer; align them to the creator console.
    // This uses MV3 declarativeNetRequest dynamic rules via global `modifyRequestHeaders`.
    try {
      modifyRequestHeaders(
        'mp.toutiao.com/',
        {
          Origin: 'https://mp.toutiao.com',
          Referer: 'https://mp.toutiao.com/profile_v4/graphic/publish',
        },
        ['*://mp.toutiao.com/*']
      )
    } catch (e) {
      // ignore
    }
  }

  async _ensureToutiaoPublishTab() {
    if (typeof chrome === 'undefined' || !chrome.tabs) {
      throw new Error('Toutiao: chrome.tabs is not available')
    }

    const publishUrl = 'https://mp.toutiao.com/profile_v4/graphic/publish'

    const queryTabs = () =>
      new Promise((resolve) => {
        try {
          chrome.tabs.query({ url: publishUrl + '*' }, (tabs) => {
            resolve(tabs || [])
          })
        } catch (e) {
          resolve([])
        }
      })

    const tabs = await queryTabs()
    if (tabs.length && typeof tabs[0].id === 'number') return tabs[0].id

    // Create an inactive tab to ensure requests originate from mp.toutiao.com context.
    const tabId = await new Promise((resolve, reject) => {
      chrome.tabs.create(
        { url: publishUrl, active: false },
        (tab) => {
          if (chrome.runtime && chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
            return
          }
          if (!tab || typeof tab.id !== 'number') {
            reject(new Error('Toutiao: failed to create publish tab'))
            return
          }
          resolve(tab.id)
        }
      )
    })

    // Wait until the tab finishes loading (best-effort).
    await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        cleanup()
        resolve()
      }, 15000)

      const cleanup = () => {
        clearTimeout(timeout)
        try {
          chrome.tabs.onUpdated.removeListener(onUpdated)
        } catch (e) {}
      }

      const onUpdated = (id, info) => {
        if (id !== tabId) return
        if (info && info.status === 'complete') {
          cleanup()
          resolve()
        }
      }

      try {
        chrome.tabs.onUpdated.addListener(onUpdated)
      } catch (e) {
        cleanup()
        resolve()
      }
    })

    return tabId
  }

  async _publishViaToutiaoTab(payload) {
    if (
      typeof chrome === 'undefined' ||
      !chrome.scripting ||
      !chrome.scripting.executeScript
    ) {
      throw new Error('Toutiao: chrome.scripting is not available')
    }

    const tabId = await this._ensureToutiaoPublishTab()

    const execRes = await chrome.scripting.executeScript({
      target: { tabId },
      // Try to run in page (MAIN) world so fetch has correct origin.
      // If the browser doesn't support it, Chrome will ignore/throw; caller will see error.
      world: 'MAIN',
      func: async (data) => {
        try {
          const url =
            'https://mp.toutiao.com/mp/agw/article/publish?source=mp&type=article'
          const f = new FormData()
          Object.keys(data || {}).forEach((k) => {
            const v = data[k]
            if (v === undefined) return
            if (v === null) {
              f.append(k, '')
              return
            }
            if (typeof v === 'object') {
              f.append(k, JSON.stringify(v))
              return
            }
            f.append(k, String(v))
          })

          const resp = await fetch(url, {
            method: 'POST',
            body: f,
            credentials: 'include',
            referrer: 'https://mp.toutiao.com/profile_v4/graphic/publish',
            referrerPolicy: 'strict-origin-when-cross-origin',
            mode: 'cors',
          })

          const text = await resp.text()
          let json = null
          try {
            json = JSON.parse(text)
          } catch (e) {
            return {
              ok: false,
              status: resp.status,
              statusText: resp.statusText,
              error: 'Non-JSON response (likely not logged in)',
              text: text.slice(0, 500),
            }
          }
          return { ok: true, status: resp.status, data: json }
        } catch (e) {
          return { ok: false, error: e && e.message ? e.message : String(e) }
        }
      },
      args: [payload],
    })

    const result = execRes && execRes[0] && execRes[0].result
    if (!result) throw new Error('Toutiao: publish via tab returned empty result')
    if (!result.ok) {
      throw new Error(
        'Toutiao: publish via tab failed: ' + (result.error || 'unknown')
      )
    }
    return result.data
  }

  async getMetaData() {
    try {
      var res = await $.ajax({
        url: 'https://mp.toutiao.com/mp/agw/media/get_media_info',
      })
      // 兼容处理：如果返回的是字符串则解析，如果已经是对象则直接使用
      if (typeof res === 'string') {
        res = JSON.parse(res)
      }
      
      console.log('[Toutiao] getMetaData response:', res)
      
      if (!res || !res.data || !res.data.user) {
        throw new Error('获取用户信息失败：请先登录今日头条创作者平台')
      }
      
      return {
        uid: res.data.user.id,
        title: res.data.user.screen_name,
        avatar: res.data.user.https_avatar_url || res.data.user.avatar_url,
        supportTypes: ['html', 'markdown'],
        type: 'toutiao',
        displayName: '今日头条',
        home: 'https://mp.toutiao.com/profile_v4/graphic/publish?from=toutiao_pc',
        icon: 'https://sf1-ttcdn-tos.pstatp.com/obj/ttfe/pgcfe/sz/mp_logo.png',
      }
    } catch (e) {
      console.error('[Toutiao] getMetaData error:', e)
      throw e
    }
  }

  async addPost(post) {
    return {
      status: 'success',
      post_id: 0,
    }
  }

  async editPost(post_id, post) {
    console.log('[Toutiao] editPost started')
    
    // Get title from multiple possible sources
    var articleTitle = post.post_title || post.title || ''
    if (!articleTitle || articleTitle.trim().length === 0) {
      console.warn('[Toutiao] No title found in post, using default')
      articleTitle = '未命名文章'
    }
    console.log('[Toutiao] editPost: title =', articleTitle)
    
    // Get content
    var content = post.post_content || post.content || ''
    
    var pgc_feed_covers = []
    if (post.post_thumbnail_raw && post.post_thumbnail_raw.images) {
      pgc_feed_covers.push({
        id: 0,
        url: post.post_thumbnail_raw.url,
        uri: post.post_thumbnail_raw.images[0].origin_web_uri,
        origin_uri: post.post_thumbnail_raw.images[0].origin_web_uri,
        ic_uri: '',
        thumb_width: post.post_thumbnail_raw.images[0].width,
        thumb_height: post.post_thumbnail_raw.images[0].height,
      })
    }

    // Visit publish page first to get cookies/tokens
    await $.get('https://mp.toutiao.com/profile_v4/graphic/publish?from=toutiao_pc')

    // IMPORTANT:
    // Use legacy jQuery-style form-urlencoded payload (works with our MV3 $.ajax shim).
    // Many Toutiao endpoints expect `pgc_feed_covers` to be a JSON string, not an object/array.
    // Newer publish page is v4; some fields are required/validated server-side, so we include
    // common defaults seen in the editor's own requests.
    const requestData = {
      title: articleTitle,
      article_ad_type: 2,
      article_type: 0,
      from_diagnosis: 0,
      origin_debut_check_pgc_normal: 0,
      tree_plan_article: 0,
      save: 0,
      timer_status: 0,
      timer_time: '',
      claim_origin: 0,
      is_fans_article: 0,
      govern_forward: 0,
      praise: 0,
      disable_praise: 0,
      activity_tag: 0,
      trends_writing_tag: 0,
      community_sync: 0,
      is_refute_rumor: 0,
      mp_editor_stat: { a_justify: 1 },
      draft_form_data: { coverType: 2 },
      educluecard: '',
      pgc_id: 0,
      content: content,
      pgc_feed_covers: pgc_feed_covers || [],
    }

    let res
    try {
      res = await $.ajax({
        url: 'https://mp.toutiao.com/mp/agw/article/publish?source=mp&type=article',
        type: 'POST',
        dataType: 'JSON',
        referrer: 'https://mp.toutiao.com/profile_v4/graphic/publish',
        referrerPolicy: 'strict-origin-when-cross-origin',
        mode: 'cors',
        data: {
          ...requestData,
          // legacy shape: stringify some fields
          mp_editor_stat: JSON.stringify(requestData.mp_editor_stat),
          draft_form_data: JSON.stringify(requestData.draft_form_data),
          pgc_feed_covers: JSON.stringify(requestData.pgc_feed_covers),
        },
      })
    } catch (e) {
      // keep going to strict check / fallback
      res = e && e.response ? e.response : null
      throw e
    }
    
    // Parse response if string
    if (typeof res === 'string') {
      try {
        res = JSON.parse(res)
      } catch (e) {
        console.error('[Toutiao] Failed to parse response:', res)
      }
    }
    
    console.log('[Toutiao] API response:', res)

    // Strict success check: don't treat "保存失败" (err_no=7050) as success.
    // The API typically returns:
    // { err_no: 0, data: { pgc_id: "xxxx" }, message: "success" }
    // Failures may still include `data` but with `pgc_id: "0"`.
    if (!res || typeof res !== 'object') {
      throw new Error('发布失败：API 返回数据异常')
    }
    if (typeof res.err_no !== 'undefined' && res.err_no !== 0) {
      // 7050 is common when the request doesn't come from the real Toutiao editor context.
      // Fallback to publishing inside an actual mp.toutiao.com tab (page-origin fetch).
      if (res.err_no === 7050) {
        console.warn('[Toutiao] err_no=7050, falling back to tab-context publish')
        const tabRes = await this._publishViaToutiaoTab({
          ...requestData,
          mp_editor_stat: requestData.mp_editor_stat,
          draft_form_data: requestData.draft_form_data,
          pgc_feed_covers: requestData.pgc_feed_covers,
        })
        res = tabRes
      } else {
        throw new Error(
          res.reason || res.message || `保存失败 (err_no=${res.err_no})`
        )
      }
    }
    if (!res.data || !res.data.pgc_id || String(res.data.pgc_id) === '0') {
      throw new Error(res.reason || res.message || '保存失败：未生成草稿')
    }

    return {
      status: 'success',
      post_id: res.data.pgc_id,
      draftLink:
        'https://mp.toutiao.com/profile_v4/graphic/publish?pgc_id=' +
        res.data.pgc_id,
    }
  }

  async uploadFileBySrc(file) {
    var src = file.src
    var res = await $.ajax({
      url: 'https://mp.toutiao.com/tools/catch_picture/',
      type: 'POST',
      headers: {
        accept: '*/*',
      },
      data: {
        upfile: src,
        version: 2,
      },
    })

    // throw new Error('fuck');
    if (res.images && !res.images.length) {
      throw new Error('图片上传失败 ' + src)
    }

    // http only
    console.log('uploadFile', res)
    return [res]
  }

  async uploadFile(file) {
    var src = file.src
    var uploadUrl = 'https://mp.toutiao.com/mp/agw/article_material/photo/upload_picture?type=ueditor&pgc_watermark=1&action=uploadimage&encode=utf-8'
    // var blob = new Blob([file.bits], {
    //   type: file.type
    // });
    var file = new File([file.bits], 'temp', {
      type: file.type
    });
    var formdata = new FormData()
    formdata.append('upfile', file)
    var res = await axios({
      url: uploadUrl,
      method: 'post',
      data: formdata,
      headers: { 'Content-Type': 'multipart/form-data' },
    })

    if (res.data.state != 'SUCCESS') {
      throw new Error('图片上传失败 ' + src)
    }
    // http only
    console.log('uploadFile', res)
    return [{
      id: res.data.original,
      object_key: res.data.original,
      url: res.data.url,
      images: [
        res.data
      ]
    }]
  }

  async preEditPost(post) {
    try {
      console.log('[Toutiao] preEditPost started')
      
      // In Service Worker context, $ is cheerio
      var wrapperHtml = '<div>' + (post.content || '') + '</div>'
      var doc = $(wrapperHtml)
      
      if (!doc || typeof doc.find !== 'function') {
        console.warn('[Toutiao] preEditPost: wrapper is not valid, skipping')
        return
      }
      
      // Remove links (Toutiao doesn't allow external links) - replace with inner content
      var links = doc.find('a')
      for (let i = 0; i < links.length; i++) {
        var link = links.eq(i)
        try {
          var innerHtml = link.html() || ''
          link.replaceWith(innerHtml)
        } catch (e) {}
      }

      // Remove iframes
      doc.find('iframe').remove()

      // Remove SVG images
      var images = doc.find('img')
      for (let i = 0; i < images.length; i++) {
        var img = images.eq(i)
        var src = img.attr('src')
        if (src && src.indexOf('.svg') > -1) {
          console.log('[Toutiao] Removing SVG image:', src)
          img.remove()
        }
      }
      
      // Remove QQ music elements
      doc.find('qqmusic').next().remove()
      doc.find('qqmusic').remove()

      // Process code blocks if tools available
      if (typeof tools !== 'undefined' && tools.processDocCode) {
        try {
          tools.processDocCode(doc)
        } catch (e) {
          console.warn('[Toutiao] processDocCode error:', e)
        }
      }
      
      // Make images visible
      if (typeof tools !== 'undefined' && tools.makeImgVisible) {
        try {
          tools.makeImgVisible(doc)
        } catch (e) {
          console.warn('[Toutiao] makeImgVisible error:', e)
        }
      }

      post.content = doc.html()
      console.log('[Toutiao] preEditPost done, content length:', post.content?.length || 0)
    } catch (e) {
      console.log('[Toutiao] preEditPost error:', e)
      // Don't throw - allow post to continue with original content
    }
  }

  editImg(img, source) {
    img.attr('web_uri', source.images[0].origin_web_uri)
  }
  //   <img class="" src="http://p2.pstatp.com/large/pgc-image/bc0a9fc8e595453083d85deb947c3d6e" data-ic="false" data-ic-uri="" data-height="1333" data-width="1000" image_type="1" web_uri="pgc-image/bc0a9fc8e595453083d85deb947c3d6e" img_width="1000" img_height="1333"></img>
}
