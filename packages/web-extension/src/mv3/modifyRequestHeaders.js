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
      chrome.declarativeNetRequest.updateDynamicRules(details, () => {
        const err = chrome.runtime?.lastError
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
  if (!chrome?.declarativeNetRequest?.updateDynamicRules) {
    console.warn(
      '[mv3] declarativeNetRequest unavailable; skip modifyRequestHeaders',
      urlPrefix
    )
    return
  }

  if (handler) {
    console.warn(
      '[mv3] modifyRequestHeaders(handler) is not supported; ignoring handler'
    )
  }
  if (inspectUrls?.length) {
    // We keep this for backward compatibility; SW cannot inspect/observe requests via DNR.
    // URL observation should be done via fetch wrappers or other explicit APIs.
  }

  const ruleId = stableRuleId(
    `hdr:${urlPrefix}:${Object.keys(headers).sort().join(',')}`
  )
  const requestHeaders = Object.entries(headers).map(([header, value]) => ({
    header,
    operation: 'set',
    value: String(value),
  }))

  const rule = {
    id: ruleId,
    priority: 1,
    action: {
      type: 'modifyHeaders',
      requestHeaders,
    },
    condition: {
      urlFilter: urlPrefix,
      resourceTypes: ['xmlhttprequest', 'other'],
    },
  }

  await updateDynamicRules({
    removeRuleIds: [ruleId],
    addRules: [rule],
  })
}
