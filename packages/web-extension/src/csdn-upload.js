/**
 * CSDN Image Upload Content Script
 * Runs on CSDN editor pages to handle image uploads with proper cookies/origin
 */

;(function () {
  'use strict'

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'csdn_upload_image') {
      handleImageUpload(request.file)
        .then((result) => sendResponse({ success: true, data: result }))
        .catch((error) =>
          sendResponse({ success: false, error: error.message })
        )
      return true // Keep channel open for async response
    }

    if (request.action === 'csdn_get_upload_credentials') {
      getUploadCredentials(request.fileExt)
        .then((result) => sendResponse({ success: true, data: result }))
        .catch((error) =>
          sendResponse({ success: false, error: error.message })
        )
      return true
    }

    if (request.action === 'csdn_ping') {
      sendResponse({ success: true, ready: true })
      return true
    }
  })

  async function getUploadCredentials(fileExt) {
    const url =
      'https://imgservice.csdn.net/direct/v1.0/image/upload?type=blog&rtype=markdown&watermark='

    console.log('[CSDN Content] Getting upload credentials...')

    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/json, text/plain, */*',
        'x-image-app': 'direct_blog',
        'x-image-suffix': fileExt || 'png',
        'x-image-dir': 'direct',
      },
    })

    const data = await response.json()
    console.log('[CSDN Content] Credentials response:', data)

    if (data && (data.code === 200 || data.code === 0) && data.data) {
      return data.data
    }

    throw new Error(
      `Failed to get credentials: ${
        data.msg || data.message || 'Unknown error'
      } (code: ${data.code})`
    )
  }

  async function handleImageUpload(file) {
    // file should have: { name, type, bits (base64), src }
    const fileExt = (file.name || 'image.png').split('.').pop().toLowerCase()

    // Step 1: Get upload credentials
    const credentials = await getUploadCredentials(fileExt)

    if (!credentials || !credentials.host) {
      throw new Error('Invalid upload credentials received')
    }

    // Step 2: Upload to OSS
    let uploadUrl = credentials.host
    if (!uploadUrl.startsWith('http')) {
      uploadUrl = 'https://' + uploadUrl
    }

    const form = new FormData()
    form.append('key', credentials.filePath)
    form.append('policy', credentials.policy)
    form.append('OSSAccessKeyId', credentials.accessId)
    form.append('success_action_status', '200')
    form.append('signature', credentials.signature)
    if (credentials.callbackUrl) {
      form.append('callback', credentials.callbackUrl)
    }

    // Convert base64 to blob
    let blob
    if (file.bits) {
      // file.bits could be base64 string or array
      if (typeof file.bits === 'string') {
        const binary = atob(file.bits)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i)
        }
        blob = new Blob([bytes], { type: file.type || 'image/png' })
      } else {
        blob = new Blob([new Uint8Array(file.bits)], {
          type: file.type || 'image/png',
        })
      }
    } else {
      throw new Error('No image data provided')
    }

    form.append('file', blob, file.name || 'image.png')

    console.log('[CSDN Content] Uploading to OSS:', uploadUrl)

    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      body: form,
    })

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text()
      throw new Error(
        `OSS upload failed: ${uploadResponse.status} ${errorText}`
      )
    }

    const result = await uploadResponse.json()
    console.log('[CSDN Content] Upload result:', result)

    if (result.code !== 200 && result.code !== 0) {
      throw new Error(`Upload processing failed: ${result.msg || 'Unknown'}`)
    }

    const imageUrl = result.data && result.data.imageUrl
    if (!imageUrl) {
      throw new Error('No image URL in upload response')
    }

    return { url: imageUrl }
  }

  console.log('[CSDN Content] Image upload handler ready')
})()
