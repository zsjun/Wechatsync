// const TurndownService = turndown

function createUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0
    var v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function signCSDN(apiPath, contentType = 'application/json') {
  var once = createUuid()
  var signStr = `POST
*/*

application/json

x-ca-key:203803574
x-ca-nonce:${once}
${apiPath}`
  var hash = CryptoJS.HmacSHA256(signStr, '9znpamsyl2c7cdrr9sas0le9vbc3r6ba')
  var hashInBase64 = CryptoJS.enc.Base64.stringify(hash)
  return {
    accept: '*/*',
    'content-type': contentType,
    'x-ca-key': 203803574,
    'x-ca-nonce': once,
    'x-ca-signature': hashInBase64,
    'x-ca-signature-headers': 'x-ca-key,x-ca-nonce',
  }
}

function validateFileExt(ext) {
  switch (ext.toLowerCase()) {
    case 'jpg':
    case 'png':
    case 'jpeg':
    case 'gif':
      return true
    default:
      return false
  }
}

export default class CSDNAdapter {
  constructor() {
    this.name = 'csdn'
    modifyRequestHeaders(
      'bizapi.csdn.net/',
      {
        Origin: 'https://editor.csdn.net',
        Referer: 'https://editor.csdn.net/',
      },
      ['*://bizapi.csdn.net/*']
    )
  }

  async getMetaData() {
    try {
      // Strategy 1: Try API first
      var res = await $.get('https://me.csdn.net/api/user/show')
      if (res && res.data && res.data.username && res.data.csdnid) {
        return {
          uid: res.data.csdnid,
          title: res.data.username,
          avatar: res.data.avatarurl,
          type: 'csdn',
          displayName: 'CSDN',
          supportTypes: ['markdown', 'html'],
          home: 'https://mp.csdn.net/',
          icon: 'https://g.csdnimg.cn/static/logo/favicon32.ico',
        }
      }
    } catch (e) {
      console.warn(
        '[CSDN] API call failed, trying HTML extraction:',
        e.message || e
      )
    }

    // Strategy 2: Extract from blog page HTML
    try {
      var blogUrl = null

      // Try to fetch www.csdn.net and see if we can extract blog URL or username
      try {
        var homePageResponse = await fetch('https://www.csdn.net/', {
          credentials: 'include',
        })
        var homePageText = await homePageResponse.text()
        var $home = $(homePageText)

        // Try to find blog link or username in the page
        var blogLink = $home.find('a[href*="blog.csdn.net"]').first()
        if (blogLink.length > 0) {
          var href = blogLink.attr('href')
          if (href) {
            var urlMatch = href.match(/blog\.csdn\.net\/([^\/\?]+)/)
            if (urlMatch && urlMatch[1]) {
              blogUrl = 'https://blog.csdn.net/' + urlMatch[1]
            }
          }
        }

        // Also try to extract username directly from homepage if available
        var nameDiv = $home.find('.user-profile-head-name')
        if (nameDiv.length > 0) {
          var firstDiv = nameDiv.find('div:first-child')
          if (firstDiv.length > 0) {
            var username = firstDiv.text().trim()
            if (username) {
              // Try to get avatar
              var avatar = ''
              var avatarImg = $home
                .find(
                  '.user-profile-head-avatar img, .user-profile-head img, [class*="avatar"] img'
                )
                .first()
              if (avatarImg.length > 0) {
                avatar = avatarImg.attr('src') || ''
              }

              // Try to get user ID from URL or use username
              var userId = username

              return {
                uid: userId,
                title: username,
                avatar: avatar,
                type: 'csdn',
                displayName: 'CSDN',
                supportTypes: ['markdown', 'html'],
                home: 'https://mp.csdn.net/',
                icon: 'https://g.csdnimg.cn/static/logo/favicon32.ico',
              }
            }
          }
        }
      } catch (e) {
        console.warn(
          '[CSDN] Failed to fetch/parse www.csdn.net:',
          e.message || e
        )
      }

      // If we have blogUrl, fetch and parse it
      if (blogUrl) {
        console.log('[CSDN] Fetching blog page:', blogUrl)
        var blogPageResponse = await fetch(blogUrl, { credentials: 'include' })
        var blogPageText = await blogPageResponse.text()
        var $blog = $(blogPageText)

        // Extract from .user-profile-head-name > div:first-child
        var nameDiv = $blog.find('.user-profile-head-name')
        if (nameDiv.length > 0) {
          var firstDiv = nameDiv.find('div:first-child')
          if (firstDiv.length > 0) {
            var username = firstDiv.text().trim()
            if (username) {
              // Try to get avatar
              var avatar = ''
              var avatarImg = $blog
                .find(
                  '.user-profile-head-avatar img, .user-profile-head img, [class*="avatar"] img'
                )
                .first()
              if (avatarImg.length > 0) {
                avatar = avatarImg.attr('src') || ''
              }

              // Extract user ID from URL
              var userId = null
              var urlMatch = blogUrl.match(/blog\.csdn\.net\/([^\/\?]+)/)
              if (urlMatch && urlMatch[1]) {
                userId = urlMatch[1]
              } else {
                userId = username
              }

              return {
                uid: userId,
                title: username,
                avatar: avatar,
                type: 'csdn',
                displayName: 'CSDN',
                supportTypes: ['markdown', 'html'],
                home: 'https://mp.csdn.net/',
                icon: 'https://g.csdnimg.cn/static/logo/favicon32.ico',
              }
            }
          }
        }
      }
    } catch (e) {
      console.error('[CSDN] HTML extraction failed:', e.message || e)
    }

    // If all strategies fail, throw an error
    throw new Error('无法获取CSDN用户信息，请确保已登录CSDN并访问过博客页面')
  }

  async requestUpload(filename) {
    const api =
      'https://imgservice.csdn.net/direct/v1.0/image/upload?watermark=&type=blog&rtype=markdown'
    const fileExt = file.name.split('.').pop()
    if (!validateFileExt(fileExt)) {
      return null
    }

    var res = await axios({
      url: api,
      method: 'get',
      headers: {
        'x-image-app': 'direct_blog',
        'x-image-suffix': fileExt,
        'x-image-dir': 'direct',
      },
    })
    if (res.status !== 200 || res.data.code !== 200) {
      console.log(res)
      return null
    }
    return res.data.data
  }

  async uploadFile(file) {
    const uploadData = await requestUpload(file.name)
    if (!uploadData) {
      return [{ url: file.src }]
    }

    const uploadUrl = uploadData.host
    const form = new FormData()
    form.append('key', uploadData.filePath)
    form.append('policy', uploadData.policy)
    form.append('OSSAccessKeyId', uploadData.accessId)
    form.append('success_action_status', '200')
    form.append('signature', uploadData.signature)
    form.append('callback', uploadData.callbackUrl)

    const f = new File([file.bits], 'temp', {
      type: file.type,
    })
    form.append('file', f)

    var res = await axios({
      url: uploadUrl,
      method: 'post',
      data: form,
    })
    if (res.status !== 200 || res.data.code !== 200) {
      console.log(res)
      return [{ url: file.src }]
    }
    return [{ url: res.data.data.imageUrl }]
  }

  async addPost(post) {
    return {
      status: 'success',
      post_id: 0,
    }
  }
  async editPost(post_id, post) {
    // 支持HTML
    if (!post.markdown) {
      var turndownService = new turndown()
      turndownService.use(tools.turndownExt)
      var markdown = turndownService.turndown(post.post_content)
      console.log(markdown)
      post.markdown = markdown
    }

    var postStruct = {
      content: post.post_content,
      markdowncontent: post.markdown,
      not_auto_saved: '1',
      readType: 'public',
      source: 'pc_mdeditor',
      status: 2,
      title: post.post_title,
    }
    var headers = signCSDN('/blog-console-api/v3/mdeditor/saveArticle')
    var res = await axios.post(
      'https://bizapi.csdn.net/blog-console-api/v3/mdeditor/saveArticle',
      postStruct,
      {
        headers: headers,
      }
    )
    post_id = res.data.data.id
    console.log(res)
    return {
      status: 'success',
      post_id: post_id,
      draftLink: 'https://editor.csdn.net/md?articleId=' + post_id,
    }
  }

  async preEditPost(post) {
    var div = $('<div>')
    $('body').append(div)
    try {
      div.html(post.content)
      var doc = div
      tools.processDocCode(div)
      tools.makeImgVisible(div)
      var tempDoc = $('<div>').append(doc.clone())
      post.content =
        tempDoc.children('div').length == 1
          ? tempDoc.children('div').html()
          : tempDoc.html()

      console.log('after.predEdit', post.content)
    } catch (e) {
      console.log('preEdit.error', e)
    }
  }
}
