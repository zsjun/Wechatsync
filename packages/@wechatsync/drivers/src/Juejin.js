export default class JuejinAdapter {
  constructor(ac) {
    this.version = '0.0.2'
    this.name = 'juejin'

    // modify origin headers
    modifyRequestHeaders(
      'api.juejin.cn',
      {
        Origin: 'https://juejin.cn',
        Referer: 'https://juejin.cn/editor/drafts/new',
      },
      ['*://api.juejin.cn/*'],
      function (details) {
        if (details.initiator && details.initiator.indexOf('juejin.cn') > -1) {
          details.requestHeaders = details.requestHeaders.map((_) => {
            if (_.name === 'Origin') {
              _.value = details.initiator
            }

            if (_.name === 'Referer') {
              _.value = details.initiator + '/'
            }

            return _
          })
        }
      }
    )
  }

  async getMetaData() {
    try {
      var data = await $.get('https://api.juejin.cn/user_api/v1/user/get')
      console.log('Juejin getMetaData response:', data)

      if (!data || !data.data) {
        throw new Error(
          '获取用户信息失败：请先在浏览器中登录掘金 (https://juejin.cn)，然后刷新页面重试'
        )
      }

      // 尝试多种可能的头像字段名
      var avatar =
        data.data.avatar_large ||
        data.data.avatar_url ||
        data.data.avatar ||
        data.data.avatar_medium ||
        data.data.avatar_small

      console.log('Juejin avatar raw:', avatar)

      // 如果头像URL存在但没有协议，添加https://
      if (avatar) {
        if (avatar.startsWith('//')) {
          avatar = 'https:' + avatar
        } else if (
          !avatar.startsWith('http://') &&
          !avatar.startsWith('https://')
        ) {
          avatar = 'https://' + avatar.replace(/^\/+/, '')
        }
      }

      console.log('Juejin avatar processed:', avatar)

      return {
        uid: data.data.user_id,
        title: data.data.user_name,
        avatar: avatar,
        type: 'juejin',
        displayName: '掘金',
        raw: data.data,
        supportTypes: ['markdown', 'html'],
        home: 'https://juejin.cn/editor/drafts',
        icon: 'https://juejin.cn/favicon.ico',
      }
    } catch (e) {
      // Better error messages for authentication failures
      if (
        e.message &&
        (e.message.includes('401') ||
          e.message.includes('403') ||
          e.message.includes('未登录') ||
          e.message.includes('登录'))
      ) {
        throw new Error(
          '掘金登录已过期，请打开 https://juejin.cn 重新登录后重试'
        )
      }
      throw e
    }
  }

  async uploadFile(file) {
    console.log('Juejin uploadFile', file)
    
    // If file has a src (original URL), try to use it directly first
    // Juejin may accept external image URLs in markdown
    if (file.src && file.src.startsWith('http')) {
      console.log('Juejin: Using original image URL:', file.src)
      return [
        {
          url: file.src,
        },
      ]
    }

    const blob = new Blob([file.bits], { type: file.type })
    
    // Try multiple upload endpoints in order
    const endpoints = [
      {
        url: 'https://cdn-ms.juejin.im/v1/upload?bucket=gold-user-assets',
        fieldName: 'file',
        description: 'CDN endpoint (legacy)',
      },
      {
        url: 'https://api.juejin.cn/content_api/v1/article/upload_image',
        fieldName: 'image',
        description: 'Content API endpoint',
        headers: {
          Origin: 'https://juejin.cn',
          Referer: 'https://juejin.cn/editor/drafts/new',
        },
      },
      {
        url: 'https://api.juejin.cn/image_api/v1/image/upload',
        fieldName: 'image',
        description: 'Image API endpoint',
        headers: {
          Origin: 'https://juejin.cn',
          Referer: 'https://juejin.cn/editor/drafts/new',
        },
      },
    ]

    let lastError = null

    for (const endpoint of endpoints) {
      try {
        console.log(`Juejin: Trying ${endpoint.description}: ${endpoint.url}`)
        const formData = new FormData()
        formData.append(endpoint.fieldName, blob, file.name || 'image.png')

        const fetchOptions = {
          method: 'POST',
          credentials: 'include',
          body: formData,
        }

        if (endpoint.headers) {
          fetchOptions.headers = endpoint.headers
        }

        const res = await fetch(endpoint.url, fetchOptions)

        console.log(
          `Juejin ${endpoint.description} status:`,
          res.status,
          res.statusText
        )

        if (!res.ok) {
          const errorText = await res.text()
          console.error(
            `Juejin ${endpoint.description} failed:`,
            errorText.substring(0, 200)
          )
          lastError = new Error(
            `${endpoint.description} failed: ${res.status} ${res.statusText}`
          )
          continue // Try next endpoint
        }

        const text = await res.text()
        console.log(
          `Juejin ${endpoint.description} response:`,
          text.substring(0, 200)
        )

        let data
        try {
          data = JSON.parse(text)
        } catch (e) {
          lastError = new Error(
            `Parse failed for ${endpoint.description}: ${e.message}`
          )
          continue
        }

        // Handle different response formats
        // CDN format: { d: { url: { http: "...", https: "..." } } }
        if (data.d && data.d.url) {
          return [
            {
              url: data.d.url.https || data.d.url.http,
            },
          ]
        }

        // API format: { err_no: 0, data: { url: "..." } }
        if (data.err_no === 0 && data.data && data.data.url) {
          return [
            {
              url: data.data.url,
            },
          ]
        }

        // Direct URL format: { url: "..." }
        if (data.url) {
          return [
            {
              url: data.url,
            },
          ]
        }

        lastError = new Error(
          `Unexpected response format from ${endpoint.description}`
        )
      } catch (error) {
        console.warn(`Juejin ${endpoint.description} error:`, error.message)
        lastError = error
        continue
      }
    }

    // All endpoints failed - return original URL if available, or throw
    if (file.src) {
      console.warn(
        'Juejin: All upload endpoints failed, using original URL:',
        file.src
      )
      return [
        {
          url: file.src,
        },
      ]
    }

    throw new Error(
      `All Juejin upload endpoints failed. Last error: ${lastError?.message || 'Unknown'}`
    )
  }

  async addPost(post, _instance) {
    return {
      status: 'success',
      post_id: 0,
    }
  }

  async editPost(post_id, post) {
    console.log('Juejin editPost')
    
    // Prefer markdown if available (from mdnice or doSync)
    // Check for platform-specific markdown first, then general markdown
    var markdown = post.content_juejin || post.markdown || ''
    
    // If we have markdown, use it directly (no conversion needed)
    if (markdown && markdown.trim().length > 0) {
      console.log('Juejin: Using existing markdown (no conversion needed)')
    } else {
      // Need to convert HTML to markdown
      // Always convert from HTML (post.content) to ensure we get the images that might have been uploaded by doSync.
      var contentToConvert = post.content || post.post_content
      
      // Try to use offscreen document for conversion (has real DOM)
      try {
        // Check if offscreen document is available
        if (typeof chrome !== 'undefined' && chrome.offscreen) {
          // Create offscreen document if it doesn't exist
          const clients = await chrome.offscreen.hasDocument()
          if (!clients) {
            await chrome.offscreen.createDocument({
              url: 'offscreen.html',
              reasons: ['DOM_SCRAPING'],
              justification: 'Convert HTML to markdown using turndown'
            })
          }
          
          // Use offscreen document for conversion
          markdown = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Offscreen conversion timeout'))
            }, 10000) // 10 second timeout
            
            chrome.runtime.sendMessage(
              {
                target: 'offscreen',
                type: 'turndown',
                content: contentToConvert,
                options: {}
              },
              (response) => {
                clearTimeout(timeout)
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message))
                } else if (response && response.error) {
                  reject(new Error(response.error))
                } else if (typeof response === 'string') {
                  resolve(response)
                } else {
                  reject(new Error('Invalid response from offscreen'))
                }
              }
            )
          })
          console.log('Juejin: Converted HTML to markdown via offscreen document')
        } else {
          throw new Error('Offscreen API not available')
        }
      } catch (offscreenError) {
        console.warn('Juejin: Offscreen conversion failed, trying direct conversion:', offscreenError.message)
        
        // Fallback: Try to use markdown from post if available
        // If not, we'll need to skip conversion or use a simpler approach
        if (post.markdown && post.markdown.trim().length > 0) {
          console.log('Juejin: Using post.markdown as fallback')
          markdown = post.markdown
        } else {
          // Last resort: Use HTML content directly (Juejin API might accept HTML in mark_content)
          console.warn('Juejin: No markdown available and conversion failed, using HTML content')
          markdown = contentToConvert || ''
        }
      }
    }

    // Ensure title is available - try multiple sources
    var articleTitle = post.post_title || post.title || ''
    
    if (!articleTitle || articleTitle.trim().length === 0) {
      console.warn('Juejin: No title found in post, using default')
      articleTitle = 'Untitled Article'
    }
    
    console.log('Juejin editPost: title =', articleTitle)

    const res = await fetch(
      'https://api.juejin.cn/content_api/v1/article_draft/create',
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          brief_content: '',
          category_id: '0',
          cover_image: '',
          edit_type: 10,
          html_content: 'deprecated',
          link_url: '',
          mark_content: markdown,
          tag_ids: [],
          title: articleTitle,
        }),
      }
    )

    let data
    const text = await res.text()

    if (!res.ok) {
      throw new Error(
        `Create draft failed ${res.status}: ${text.substring(0, 100)}`
      )
    }

    try {
      data = JSON.parse(text)
    } catch (e) {
      throw new Error(`Parse draft response failed: ${e.message}`)
    }

    // Better error handling for API responses
    if (data.err_no !== 0) {
      const errorMap = {
        401: '请先登录掘金',
        403: '发布权限不足或触发风控，请稍后重试',
        400: `内容格式错误: ${data.err_msg || ''}`,
      }
      const errorMsg =
        errorMap[data.err_no] ||
        data.err_msg ||
        `发布失败 (错误码: ${data.err_no})`
      console.error('Juejin editPost API error:', data)
      throw new Error(errorMsg)
    }

    var post_id = data.data?.id
    if (!post_id) {
      throw new Error('发布失败：API 返回数据异常')
    }

    console.log('Juejin editPost success:', data)
    return {
      status: 'success',
      post_id: post_id,
      draftLink: 'https://juejin.cn/editor/drafts/' + post_id,
    }
  }

  async preEditPost(post) {
    try {
      console.log('Juejin.preEditPost')
      // In Service Worker context, $ is cheerio, not jQuery
      // Create a wrapper div and set its HTML content
      // Cheerio's $('<div>') returns a cheerio instance that supports find()
      // Create wrapper with content already inside to ensure proper cheerio instance
      var wrapperHtml = '<div>' + (post.content || '') + '</div>'
      var wrapper = $(wrapperHtml)
      
      // Verify wrapper is a valid cheerio instance with find() method
      if (!wrapper || typeof wrapper.find !== 'function') {
        console.warn('Juejin.preEditPost: wrapper is not a valid cheerio instance, skipping processing')
        return // Skip processing if cheerio instance is invalid
      }
      
      // Process the content with tools (they expect cheerio objects with find() method)
      // tools.processDocCode expects an object with .find() method
      if (tools.processDocCode && typeof tools.processDocCode === 'function') {
        try {
          tools.processDocCode(wrapper)
        } catch (toolError) {
          console.warn('Juejin.processDocCode error:', toolError)
          // Continue even if processDocCode fails
        }
      }
      
      if (tools.makeImgVisible && typeof tools.makeImgVisible === 'function') {
        try {
          tools.makeImgVisible(wrapper)
        } catch (toolError) {
          console.warn('Juejin.makeImgVisible error:', toolError)
          // Continue even if makeImgVisible fails
        }
      }

      // Extract the processed HTML from the wrapper
      var processedHtml = wrapper.html()
      
      if (processedHtml) {
        post.content = processedHtml
      }

      console.log('Juejin.preEditPost done, content length:', post.content?.length || 0)
    } catch (e) {
      console.log('Juejin.preEditPost error', e)
      // Don't throw - allow post to continue with original content
      // The error is logged but won't block the sync process
    }
  }

  addPromotion(post) {
    var sharcode = `<blockquote><p>本文使用 <a href="https://juejin.cn/post/6940875049587097631" class="internal">文章同步助手</a> 同步</p></blockquote>`
    post.content = post.content.trim() + `${sharcode}`
  }
}
