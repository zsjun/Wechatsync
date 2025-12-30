// const TurndownService = turndown

function createUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0
    var v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// Helper function to convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer) {
  var bytes = new Uint8Array(buffer)
  var binary = ''
  for (var i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

// Async sign function using Web Crypto API (works in Service Workers)
async function signCSDN(apiPath, contentType = 'application/json') {
  var once = createUuid()
  var accept = 'application/json, text/plain, */*'

  // Build signature string with explicit newlines
  var signStr = [
    'POST',
    accept,
    '', // Content-MD5
    contentType,
    '', // Date
    'x-ca-key:203803574',
    'x-ca-nonce:' + once,
    apiPath,
  ].join('\n')

  console.log('[CSDN] signStr:', JSON.stringify(signStr))

  // Use Web Crypto API for HMAC-SHA256
  var encoder = new TextEncoder()
  var keyData = encoder.encode('9znpamsyl2c7cdrr9sas0le9vbc3r6ba')
  var messageData = encoder.encode(signStr)

  var cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  var signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
  var hashInBase64 = arrayBufferToBase64(signature)

  console.log('[CSDN] signature:', hashInBase64)

  return {
    Accept: accept,
    'Content-Type': contentType,
    'x-ca-key': '203803574',
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
    modifyRequestHeaders(
      'imgservice.csdn.net/',
      {
        Origin: 'https://editor.csdn.net',
        Referer: 'https://editor.csdn.net/',
      },
      ['*://imgservice.csdn.net/*']
    )
  }

  async getMetaData() {
    console.log('[CSDN] getMetaData starting...')

    // Strategy 1: Use g-api.csdn.net toolbar API (primary method)
    try {
      console.log(
        '[CSDN] Trying toolbar API: https://g-api.csdn.net/community/toolbar-api/v1/get-user-info'
      )
      var res = await fetch(
        'https://g-api.csdn.net/community/toolbar-api/v1/get-user-info',
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            accept: 'application/json, text/javascript, */*; q=0.01',
            'content-type': 'application/x-www-form-urlencoded; charset=utf-8',
          },
        }
      )
      var data = await res.json()
      console.log('[CSDN] Toolbar API response:', data)

      if (data && data.code === 200 && data.data) {
        var userInfo = data.data
        var avatar =
          userInfo.avatarUrl || userInfo.avatar || userInfo.headPic || ''

        // Try to get userId from various fields
        var userId = userInfo.username || userInfo.userId || userInfo.csdnId

        // If no userId, try to extract from avatar URL
        // Avatar URL format: https://i-avatar.csdnimg.cn/xxx_username.jpg!1
        if (!userId && avatar) {
          var avatarMatch = avatar.match(
            /_([a-zA-Z0-9_-]+)\.(jpg|png|jpeg|gif)/
          )
          if (avatarMatch && avatarMatch[1]) {
            userId = avatarMatch[1]
            console.log('[CSDN] Extracted userId from avatar URL:', userId)
          }
        }

        var username =
          userInfo.nickname || userInfo.nickName || userInfo.username || userId

        if (userId || username) {
          console.log(
            '[CSDN] Toolbar API success, user:',
            username,
            'uid:',
            userId
          )
          return {
            uid: userId || username,
            title: username || userId,
            avatar: avatar,
            type: 'csdn',
            displayName: 'CSDN',
            supportTypes: ['markdown', 'html'],
            home: 'https://mp.csdn.net/',
            icon: 'https://g.csdnimg.cn/static/logo/favicon32.ico',
          }
        }
      }

      // If code is not 200 or data is empty, user might not be logged in
      if (data && data.code !== 200) {
        console.warn(
          '[CSDN] Toolbar API returned error code:',
          data.code,
          data.msg || data.message
        )
      }
    } catch (e) {
      console.warn('[CSDN] Toolbar API failed:', e.message || e)
    }

    // All strategies failed
    console.error('[CSDN] All detection strategies failed')
    throw new Error(
      'Unable to detect CSDN account. Please ensure:\n' +
        '1. You are logged in to CSDN (https://www.csdn.net/)\n' +
        '2. Try visiting https://blog.csdn.net/ first\n' +
        '3. If still failing, use "Add Account" to manually add CSDN'
    )
  }

  async requestUpload(filename) {
    const api =
      'https://imgservice.csdn.net/direct/v1.0/image/upload?watermark=&type=blog&rtype=markdown'
    // Fix: Use parameter filename instead of undefined file
    const fileExt = filename.split('.').pop()
    if (!validateFileExt(fileExt)) {
      throw new Error(`Unsupported file type: ${fileExt}`)
    }

    // Fix: Use $.ajax instead of axios, which automatically includes cookies
    var res = await $.ajax({
      url: api,
      type: 'GET',
      dataType: 'json',
      headers: {
        'x-image-app': 'direct_blog',
        'x-image-suffix': fileExt,
        'x-image-dir': 'direct',
      },
    })

    console.log('[CSDN] requestUpload response:', JSON.stringify(res))

    if (!res || typeof res === 'string') {
      throw new Error(
        `Failed to get upload credentials: ${res || 'Empty response'}`
      )
    }

    // Handle both code: 200 and code: 0 as success (different APIs use different conventions)
    if (res.code !== 200 && res.code !== 0) {
      throw new Error(
        `Failed to get upload credentials: ${
          res.msg || res.message || 'Unknown error'
        } (code: ${res.code})`
      )
    }

    // Return data if present, otherwise return the response itself
    return res.data || res
  }

  async uploadFile(file) {
    try {
      // Fix: Use this.requestUpload
      const uploadData = await this.requestUpload(file.name || 'image.png')

      // Check if we got valid upload credentials
      if (!uploadData || !uploadData.host || !uploadData.filePath) {
        console.warn(
          '[CSDN] No valid upload credentials, using original image URL'
        )
        // Return original URL if available
        if (file.src) {
          return [{ url: file.src }]
        }
        throw new Error('Failed to get upload credentials and no fallback URL')
      }

      const uploadUrl = uploadData.host
      const form = new FormData()
      form.append('key', uploadData.filePath)
      form.append('policy', uploadData.policy)
      form.append('OSSAccessKeyId', uploadData.accessId)
      form.append('success_action_status', '200')
      form.append('signature', uploadData.signature)
      form.append('callback', uploadData.callbackUrl)

      const blob = new Blob([file.bits], { type: file.type })
      form.append('file', blob, file.name || 'image.png')

      // Fix: Use fetch instead of axios, ensure cookies are included
      var res = await fetch(uploadUrl, {
        method: 'POST',
        credentials: 'include',
        body: form,
      })

      const result = await res.json()
      if (result.code !== 200 && result.code !== 0) {
        throw new Error(`Image upload failed: ${result.msg || 'Unknown error'}`)
      }

      var imageUrl = result.data && result.data.imageUrl
      if (!imageUrl && file.src) {
        console.warn('[CSDN] No image URL in response, using original')
        return [{ url: file.src }]
      }

      return [{ url: imageUrl }]
    } catch (error) {
      console.error('[CSDN] Image upload failed:', error)
      // Fallback to original URL if available
      if (file.src) {
        console.warn('[CSDN] Falling back to original image URL:', file.src)
        return [{ url: file.src }]
      }
      throw new Error(`CSDN image upload failed: ${error.message}`)
    }
  }

  async addPost(post) {
    // Implementation: Use same API as editPost to create new article
    // Convert HTML to Markdown if needed (with Service Worker fallback)
    var markdownContent = post.markdown || ''
    if (!markdownContent && post.post_content) {
      try {
        // Try using turndown if available and DOM is accessible
        var turndownService = new turndown()
        if (tools && tools.turndownExt) {
          turndownService.use(tools.turndownExt)
        }
        markdownContent = turndownService.turndown(post.post_content)
      } catch (e) {
        console.warn(
          '[CSDN] turndown failed (Service Worker), using HTML content:',
          e.message
        )
        // Fallback: use HTML content directly or strip tags for markdown
        markdownContent = post.post_content
      }
    }

    // Ensure content is HTML
    var contentHtml = post.post_content || post.content || ''

    var postStruct = {
      content: contentHtml, // Ensure this is HTML
      markdowncontent: markdownContent,
      not_auto_saved: '1',
      readType: 'public',
      source: 'pc_mdeditor',
      status: 2, // 2=draft
      title: post.post_title,
      type: 'original',
      categories: '',
      tags: post.post_tags || '',
      description: post.post_digest || '',
    }

    var headers = await signCSDN('/blog-console-api/v3/mdeditor/saveArticle')
    console.log('[CSDN] addPost sending:', {
      title: postStruct.title,
      contentLen: contentHtml.length,
    })

    var res
    try {
      // Pass postStruct directly; runtime.js will handle JSON.stringify
      res = await $.ajax({
        url: 'https://bizapi.csdn.net/blog-console-api/v3/mdeditor/saveArticle',
        type: 'POST',
        dataType: 'json',
        contentType: 'application/json',
        data: postStruct,
        headers: headers,
      })
    } catch (ajaxError) {
      console.error('[CSDN] addPost ajax error:', ajaxError)
      // $.ajax throws on HTTP errors, extract response if available
      if (ajaxError.responseJSON) {
        res = ajaxError.responseJSON
      } else if (ajaxError.responseText) {
        try {
          res = JSON.parse(ajaxError.responseText)
        } catch (e) {
          throw new Error(
            `CSDN API error: ${ajaxError.status} ${
              ajaxError.statusText || ajaxError.responseText
            }`
          )
        }
      } else {
        throw new Error(
          `CSDN API request failed: ${
            ajaxError.message || ajaxError.statusText || 'Network error'
          }`
        )
      }
    }

    console.log('[CSDN] addPost response:', JSON.stringify(res))

    // Handle different response structures
    var code =
      res.code !== undefined
        ? res.code
        : res.status !== undefined
        ? res.status
        : null
    var msg = res.msg || res.message || res.error || ''
    var data = res.data || res

    if (code !== 200 && code !== 0 && code !== null) {
      if (code === 401 || code === 403) {
        throw new Error('CSDN session expired, please login again')
      }
      throw new Error(
        `Failed to create article: ${msg || 'Unknown error'} (code: ${code})`
      )
    }

    // Check if we got an article ID
    var articleId = data.id || data.articleId || data.article_id
    if (!articleId && res.id) {
      articleId = res.id
    }

    if (!articleId) {
      console.warn('[CSDN] No article ID in response, full response:', res)
      throw new Error(
        `CSDN did not return article ID. Response: ${JSON.stringify(res).slice(
          0,
          200
        )}`
      )
    }

    return {
      status: 'success',
      post_id: articleId,
      draftLink: 'https://editor.csdn.net/md?articleId=' + articleId,
    }
  }

  async editPost(post_id, post) {
    // Convert HTML to Markdown if needed (with Service Worker fallback)
    var markdownContent = post.markdown || ''
    if (!markdownContent && post.post_content) {
      try {
        var turndownService = new turndown()
        if (tools && tools.turndownExt) {
          turndownService.use(tools.turndownExt)
        }
        markdownContent = turndownService.turndown(post.post_content)
      } catch (e) {
        console.warn(
          '[CSDN] turndown failed (Service Worker), using HTML content:',
          e.message
        )
        markdownContent = post.post_content
      }
    }

    // Ensure content is HTML
    var contentHtml = post.post_content || post.content || ''

    var postStruct = {
      id: post_id, // Include article ID for editing
      content: contentHtml, // Ensure this is HTML
      markdowncontent: markdownContent,
      not_auto_saved: '1',
      readType: 'public',
      source: 'pc_mdeditor',
      status: 2, // 2=draft
      title: post.post_title,
      type: 'original',
      categories: '',
      tags: post.post_tags || '',
      description: post.post_digest || '',
    }

    var headers = await signCSDN('/blog-console-api/v3/mdeditor/saveArticle')
    console.log('[CSDN] editPost sending:', {
      id: post_id,
      title: postStruct.title,
      contentLen: contentHtml.length,
    })

    // Pass postStruct directly; runtime.js will handle JSON.stringify
    var res = await $.ajax({
      url: 'https://bizapi.csdn.net/blog-console-api/v3/mdeditor/saveArticle',
      type: 'POST',
      dataType: 'json',
      contentType: 'application/json',
      data: postStruct,
      headers: headers,
    })

    console.log('[CSDN] editPost response:', res)

    if (res.code !== 200) {
      if (res.code === 401 || res.code === 403) {
        throw new Error('CSDN session expired, please login again')
      } else if (res.code === 400) {
        throw new Error(
          `Invalid request parameters: ${res.msg || 'Unknown error'}`
        )
      } else {
        throw new Error(
          `Failed to save: ${res.msg || 'Unknown error'} (code: ${res.code})`
        )
      }
    }

    var articleId = res.data.id || res.data.articleId || post_id
    return {
      status: 'success',
      post_id: articleId,
      draftLink: 'https://editor.csdn.net/md?articleId=' + articleId,
    }
  }

  async preEditPost(post) {
    // Note: In Service Worker context, DOM APIs are not available
    // Use cheerio for HTML manipulation instead
    try {
      // Check if we have the tools and cheerio-compatible $
      if (typeof $ === 'function' && post.content) {
        var $doc = $(post.content)

        // Only process if $ returned a valid cheerio object with html method
        if ($doc && typeof $doc.html === 'function') {
          // Try to process code blocks if tools is available
          if (tools && tools.processDocCode) {
            try {
              tools.processDocCode($doc)
            } catch (e) {
              console.log('[CSDN] processDocCode skipped:', e.message)
            }
          }

          // Try to make images visible if tools is available
          if (tools && tools.makeImgVisible) {
            try {
              tools.makeImgVisible($doc)
            } catch (e) {
              console.log('[CSDN] makeImgVisible skipped:', e.message)
            }
          }

          // Get processed HTML
          var processedHtml = $doc.html()
          if (processedHtml) {
            post.content = processedHtml
          }
        }
      }
      console.log('[CSDN] preEditPost done')
    } catch (e) {
      console.log('[CSDN] preEditPost error:', e.message || e)
      // Continue with original content if processing fails
    }
  }
}
