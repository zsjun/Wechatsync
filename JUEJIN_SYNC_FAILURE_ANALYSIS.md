# Juejin Sync Failure Analysis

## Problem Statement
Articles can be extracted from mdnice successfully, but syncing to Juejin (掘金) fails.

---

## Root Cause Analysis

### 1. **Account Loading Race Condition** ⚠️ **HIGH PROBABILITY**

**Issue:**
The viewer calls `loadAccounts()` which requests accounts from background, but `publicAccounts` might be empty or incomplete when the request arrives.

**Code Flow:**
```javascript
// viewer/App.vue:317
loadAccounts() {
  chrome.runtime.sendMessage({ action: 'getAccount' }, (resp) => {
    self.allAccounts = resp.filter(...)  // resp might be incomplete
  })
}

// background.js:413
if (request.action == 'getAccount') {
  sendResponseA(accounts.concat(publicAccounts))  // publicAccounts might be []
  // Then async fetch happens AFTER response sent
  publicAccounts = await getPublicAccounts()  // Too late!
}
```

**Why This Fails:**
- `getPublicAccounts()` is called **asynchronously AFTER** the response is sent
- If Juejin's `getMetaData()` hasn't completed yet, Juejin won't be in the list
- User sees empty account list or Juejin missing

**Evidence:**
- Line 417: `sendResponseA(accounts.concat(publicAccounts))` - sends immediately
- Line 423: `publicAccounts = await getPublicAccounts()` - happens after response

**Fix:**
```javascript
if (request.action && request.action == 'getAccount') {
  (async () => {
    try {
      const accounts = await db.getAccounts()
      // Wait for publicAccounts BEFORE responding
      if (!publicAccounts || publicAccounts.length === 0) {
        publicAccounts = await getPublicAccounts()
      }
      sendResponseA(accounts.concat(publicAccounts))
    } catch (e) {
      console.error('getAccount error', e)
      sendResponseA([])
    }
  })()
  return true
}
```

---

### 2. **Account Selection State Missing** ⚠️ **MEDIUM PROBABILITY**

**Issue:**
Accounts from `getPublicAccounts()` don't have `checked` property initialized, so they won't be selected when user clicks sync.

**Code:**
```javascript
// viewer/App.vue:424
var selectedAc = this.allAccounts.filter((a) => {
  return a.checked  // Accounts from getPublicAccounts() might not have this
})
```

**Why This Fails:**
- Vue checkbox binding requires `account.checked` to exist
- If accounts are loaded without `checked: false`, checkbox won't work
- User selects Juejin, but `selectedAc` is empty

**Fix:**
```javascript
// In loadAccounts(), ensure all accounts have checked property
self.allAccounts = resp.filter(...).map(account => ({
  ...account,
  checked: account.checked || false
}))
```

---

### 3. **Juejin Authentication Failure** ⚠️ **HIGH PROBABILITY**

**Issue:**
Juejin API requires browser cookies. If user isn't logged into Juejin in the browser, all API calls fail.

**Code:**
```javascript
// Juejin.js:33
async getMetaData() {
  var data = await $.get('https://api.juejin.cn/user_api/v1/user/get')
  // This requires cookies from juejin.cn domain
  if (!data || !data.data) {
    throw new Error('获取用户信息失败')  // Fails if not logged in
  }
}
```

**Why This Fails:**
- Service Worker context doesn't automatically share cookies with page context
- User must be logged into Juejin in a **browser tab** for cookies to be available
- `getMetaData()` fails → account not added to list
- Even if account exists, `editPost()` will fail with 401/403

**Evidence:**
- Juejin adapter uses `credentials: 'include'` in fetch calls
- But Service Worker might not have access to page cookies

**Fix:**
- **User Action Required**: Open https://juejin.cn in a tab and ensure logged in
- **Code Fix**: Better error message when authentication fails
```javascript
async getMetaData() {
  try {
    var data = await $.get('https://api.juejin.cn/user_api/v1/user/get')
    if (!data || !data.data) {
      throw new Error('请先在浏览器中登录掘金 (https://juejin.cn)，然后刷新页面重试')
    }
    // ... rest of code
  } catch (e) {
    if (e.message.includes('401') || e.message.includes('403')) {
      throw new Error('掘金登录已过期，请重新登录后重试')
    }
    throw e
  }
}
```

---

### 4. **Task Execution Error Handling** ⚠️ **MEDIUM PROBABILITY**

**Issue:**
Errors during `doSync()` are caught but error messages might not be user-friendly.

**Code:**
```javascript
// background.js:1032
try {
  editResp = await driver.editPost(finalPostId, Object.assign(postContent, editInput))
} catch (e) {
  console.log('editPost failed：', e)
  editResp = { status: 'failed', error: e.message || e }
}
```

**Why This Fails:**
- If `editPost()` throws, error is caught but might be generic
- User sees "同步失败" but doesn't know why
- Could be: API error, network error, authentication error, content format error

**Common Juejin API Errors:**
- `err_no: 401` - Not authenticated
- `err_no: 403` - Forbidden (rate limit, content policy)
- `err_no: 400` - Bad request (invalid markdown, title too long, etc.)

**Fix:**
```javascript
// In Juejin.js editPost()
const data = await res.json()
if (data.err_no !== 0) {
  const errorMessages = {
    401: '请先登录掘金',
    403: '发布权限不足或触发风控，请稍后重试',
    400: `发布失败: ${data.err_msg || '内容格式错误'}`,
  }
  throw new Error(errorMessages[data.err_no] || data.err_msg || '发布失败')
}
```

---

### 5. **Content Format Issues** ⚠️ **LOW PROBABILITY**

**Issue:**
Mdnice provides markdown, but Juejin's `editPost()` converts HTML to markdown. If conversion fails or produces invalid markdown, API rejects it.

**Code:**
```javascript
// Juejin.js:116
async editPost(post_id, post) {
  var contentToConvert = post.content || post.post_content
  // Uses turndown or offscreen converter
  var markdown = await globalThis.convertHtmlToMarkdown(contentToConvert)
  // Sends markdown to API
  body: JSON.stringify({
    mark_content: markdown,  // If markdown is malformed, API rejects
    // ...
  })
}
```

**Why This Might Fail:**
- HTML to markdown conversion might produce invalid markdown
- Juejin API might reject certain markdown syntax
- Image URLs might not be properly converted

**Fix:**
- Prefer using mdnice's original markdown if available
- Validate markdown before sending
- Better error handling for conversion failures

---

## Diagnostic Steps

### Step 1: Check if Juejin Account is Loaded
1. Open browser console (F12)
2. In viewer panel, check console for: `'allAccounts', resp`
3. Verify Juejin appears in the array
4. If missing, check background console for: `'[WCS] juejin getMetaData failed:'`

### Step 2: Check Authentication
1. Open https://juejin.cn in a new tab
2. Ensure you're logged in (check top right corner)
3. Go back to mdnice page
4. Try sync again

### Step 3: Check Task Execution
1. Open Service Worker console: `chrome://extensions` → "Service Worker" (Inspect)
2. Look for errors during `doSync()`
3. Check for: `'editPost failed：'` or `'Juejin editPost'` logs

### Step 4: Check API Response
1. In Service Worker console, look for Juejin API responses
2. Check for `err_no` values (0 = success, non-zero = error)
3. Check `err_msg` for specific error message

---

## Recommended Fixes (Priority Order)

### Fix 1: Wait for Public Accounts Before Responding (CRITICAL)
**File:** `packages/web-extension/src/background.js:413`

```javascript
if (request.action && request.action == 'getAccount') {
  (async () => {
    try {
      const accounts = await db.getAccounts()
      // Ensure publicAccounts are loaded
      if (!publicAccounts || publicAccounts.length === 0) {
        publicAccounts = await getPublicAccounts()
      }
      sendResponseA(accounts.concat(publicAccounts))
    } catch (e) {
      console.error('getAccount error', e)
      sendResponseA([])
    }
  })()
  return true
}
```

### Fix 2: Initialize Checked Property (HIGH)
**File:** `packages/web-extension/src/viewer/App.vue:329`

```javascript
self.allAccounts = resp.filter((item) => {
  if (!item.supportTypes) return true
  return item.supportTypes.indexOf(self.contentType) > -1
}).map(account => ({
  ...account,
  checked: account.checked !== undefined ? account.checked : false
}))
```

### Fix 3: Better Error Messages for Authentication (HIGH)
**File:** `packages/@wechatsync/drivers/src/Juejin.js:32`

```javascript
async getMetaData() {
  try {
    var data = await $.get('https://api.juejin.cn/user_api/v1/user/get')
    if (!data || !data.data) {
      throw new Error('获取用户信息失败：请先在浏览器中登录掘金 (https://juejin.cn)')
    }
    // ... rest
  } catch (e) {
    if (e.message.includes('401') || e.message.includes('403') || e.message.includes('未登录')) {
      throw new Error('掘金登录已过期，请打开 https://juejin.cn 重新登录后重试')
    }
    throw e
  }
}
```

### Fix 4: Better Error Handling in editPost (MEDIUM)
**File:** `packages/@wechatsync/drivers/src/Juejin.js:154`

```javascript
const data = await res.json()
if (data.err_no !== 0) {
  const errorMap = {
    401: '请先登录掘金',
    403: '发布权限不足或触发风控',
    400: `内容格式错误: ${data.err_msg || ''}`,
  }
  throw new Error(errorMap[data.err_no] || data.err_msg || `发布失败 (错误码: ${data.err_no})`)
}
```

---

## Testing Checklist

- [ ] Juejin account appears in viewer account list
- [ ] Juejin checkbox can be checked
- [ ] Task is created when clicking "同步"
- [ ] Background console shows Juejin driver execution
- [ ] No authentication errors in console
- [ ] API calls succeed (check Network tab)
- [ ] Article appears in Juejin drafts

---

## Quick Debug Commands

**In Service Worker Console:**
```javascript
// Check if publicAccounts are loaded
publicAccounts

// Check if Juejin is in the list
publicAccounts.filter(a => a.type === 'juejin')

// Manually trigger getPublicAccounts
getPublicAccounts().then(console.log)

// Test Juejin getMetaData
const JuejinAdapter = (await import('./drivers/driver.js')).default
const driver = new JuejinAdapter()
driver.getMetaData().then(console.log).catch(console.error)
```

---

## Conclusion

**Most Likely Causes (in order):**
1. **Account not loaded** - Race condition in `getAccount` handler
2. **Not authenticated** - User not logged into Juejin in browser
3. **Account not selected** - Missing `checked` property
4. **API error** - Poor error handling masks real issue

**Immediate Action:**
1. Apply Fix 1 (wait for publicAccounts)
2. Apply Fix 2 (initialize checked)
3. Verify user is logged into Juejin
4. Check Service Worker console for detailed errors

