function stableRuleId(input) {
  // Simple, stable 32-bit hash -> positive int within DNR ruleId range.
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  // keep in [1, 2147483647]
  return ((h >>> 0) % 2147483646) + 1
}

function updateDynamicRules(details) {
  return new Promise((resolve, reject) => {
    try {
      chrome.declarativeNetRequest.updateDynamicRules(details, (err) => {
        if (err) reject(err)
        else resolve()
      })
    } catch (e) {
      reject(e)
    }
  })
}

/**
 * MV3 replacement for legacy webRequest-based header modification.
 *
 * Signature kept compatible with existing drivers:
 * - urlPrefix: string
 * - headers: record<string, string>
 * - inspectUrls: string[] (ignored in MV3, kept for compatibility)
 * - handler: function (ignored in MV3, kept for compatibility)
 */
export async function modifyRequestHeaders(
  urlPrefix,
  headers,
  inspectUrls = [],
  handler
) {
  // MV3: no blocking webRequest, use DNR modifyHeaders instead.
  if (handler) {
    console.warn(
      '[mv3] modifyRequestHeaders(handler) is not supported; ignoring handler'
    )
  }

  if (!chrome.declarativeNetRequest) {
    console.warn(
      '[mv3] declarativeNetRequest unavailable; skip modifyRequestHeaders',
      urlPrefix
    )
    return
  }

  const ruleId = stableRuleId(
    `hdr:${urlPrefix}:${Object.keys(headers).sort().join(',')}`
  )

  // URL observation should be done via fetch wrappers or other explicit APIs.
  // Most of these calls are API requests; keep scope tight.
  const resourceTypes = ['xmlhttprequest', 'other']
  
  // Exclude requests from CSDN domains so we don't break CSDN's own editor
  const excludedInitiatorDomains = urlPrefix.includes('csdn.net') 
    ? ['csdn.net', 'editor.csdn.net', 'mp.csdn.net', 'blog.csdn.net']
    : []

  try {
    console.log('[mv3] modifyRequestHeaders start', {
      urlPrefix,
    })

    const requestHeaders = Object.entries(headers).map(([header, value]) => ({
      header,
      operation: 'set',
      value,
    }))

    const condition = {
      urlFilter: urlPrefix,
      resourceTypes,
    }
    
    // Only add excludedInitiatorDomains if we have any
    if (excludedInitiatorDomains.length > 0) {
      condition.excludedInitiatorDomains = excludedInitiatorDomains
    }

    const rule = {
      id: ruleId,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders,
      },
      condition,
    }

    const updateDetails = {
      removeRuleIds: [ruleId],
      addRules: [rule],
    }
    await updateDynamicRules(updateDetails)
    console.log('[mv3] modifyRequestHeaders success', { ruleId })
  } catch (e) {
    console.warn('[mv3] modifyRequestHeaders failed', e)
  }
}
