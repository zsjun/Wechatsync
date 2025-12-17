# Mdnice Article Title Extraction - Technical Solution

## Overview

This document explains the complete technical flow of how article titles are extracted from mdnice.com and passed to Juejin during article synchronization.

## Architecture Flow

```
User clicks "提取文章" 
  ↓
EntryView.vue → chrome.tabs.sendMessage({ method: 'fetchArticle' })
  ↓
page.js receives message → initPageFetch(true)
  ↓
Detects mdnice.com → fetchMdniceArticle()
  ↓
extractTitle() → Multiple strategies
  ↓
Title extracted → Passed to viewer → Background → Juejin driver
```

## Detailed Flow

### 1. User Action: Click "提取文章"

**File**: `packages/web-extension/src/views/EntryView.vue`

```javascript
extractArticle() {
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    var tab = tabs[0]
    
    // Try sending message first
    chrome.tabs.sendMessage(tab.id, {
      method: 'fetchArticle',
    }, async (response) => {
      if (chrome.runtime.lastError) {
        // If page.js not loaded, inject it programmatically
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['libs/juqery.js', 'libs/Readability.js', 'libs/reader.js', 'page.js'],
        })
        // Retry message
        chrome.tabs.sendMessage(tab.id, { method: 'fetchArticle' })
      }
    })
  })
}
```

### 2. Content Script: Message Handler

**File**: `packages/web-extension/src/page.js`

```javascript
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.method === 'fetchArticle') {
    initPageFetch(true)  // Force show article extraction
    sendResponse({ ok: true, started: true })
  }
})
```

### 3. Mdnice Detection and Article Fetching

**File**: `packages/web-extension/src/page.js` (lines 298-372)

```javascript
if (isForceShow) {
  if (window.location.hostname.includes('mdnice.com')) {
    fetchMdniceArticle()
      .then(function (data) {
        // data.title comes from extractTitle() inside fetchMdniceArticle()
        var title = data.title || 'Mdnice 文章'  // Fallback default
        
        // If still default, try extracting from markdown
        if (title === 'Mdnice 文章' && data.markdown) {
          var titleMatch = data.markdown.match(/^#\s+(.+)$/m)
          if (titleMatch) title = titleMatch[1].trim()
        }
        
        // Pass to viewer
        postToViewer({
          title: title,
          article: data.html || data.markdown,
          markdown: data.markdown,
          // ... other data
        })
      })
  }
}
```

### 4. Title Extraction Strategies

**File**: `packages/web-extension/src/page.js` (lines 848-951)

The `extractTitle()` function uses **4 strategies** in order:

#### Strategy 1: Title Input Field Detection

```javascript
function extractTitle() {
  // Search for input fields that might contain the title
  var titleInput = 
    document.querySelector('input[placeholder*="标题"]') ||
    document.querySelector('input[placeholder*="title" i]') ||
    document.querySelector('input[name="title"]') ||
    document.querySelector('input[id*="title" i]') ||
    // Or search all inputs for title-related attributes
    Array.from(document.querySelectorAll('input[type="text"]')).find(function(input) {
      var id = (input.id || '').toLowerCase()
      var name = (input.name || '').toLowerCase()
      var className = (input.className || '').toLowerCase()
      var placeholder = (input.placeholder || '').toLowerCase()
      return (id.includes('title') || name.includes('title') || 
              className.includes('title') || placeholder.includes('title') ||
              placeholder.includes('标题'))
    })
  
  if (titleInput && titleInput.value) {
    return titleInput.value.trim()
  }
}
```

**Why this works**: Mdnice editor typically has a title input field at the top of the editor interface.

#### Strategy 2: HTML Preview H1 Detection

```javascript
// First check for h1 anywhere in document
var h1 = document.querySelector('h1')
if (h1 && h1.textContent.trim()) {
  var h1Text = h1.textContent.trim()
  // Skip generic titles
  if (h1Text.toLowerCase() !== 'mdnice' && 
      !h1Text.toLowerCase().includes('mdnice 文章')) {
    return h1Text
  }
}

// Then check preview containers
var previewSelectors = ['#nice', '#preview', '.preview', '.preview-body', 
                        '.output', '.markdown-body']
for (var i = 0; i < previewSelectors.length; i++) {
  var previewEl = document.querySelector(previewSelectors[i])
  if (previewEl) {
    var previewH1 = previewEl.querySelector('h1')
    if (previewH1 && previewH1.textContent.trim()) {
      return previewH1.textContent.trim()
    }
  }
}
```

**Why this works**: When markdown is rendered to HTML, the first `# heading` becomes an `<h1>` tag in the preview.

#### Strategy 3: Meta Tags and Page Title

```javascript
var metaTitle = 
  document.querySelector('meta[property="og:title"]')?.content ||
  document.querySelector('meta[name="twitter:title"]')?.content ||
  document.title

if (metaTitle && !metaTitle.toLowerCase().includes('mdnice')) {
  return metaTitle.trim()
}
```

**Why this works**: Some pages set meta tags or page title with the article title.

#### Strategy 4: Markdown First Line Extraction

**File**: `packages/web-extension/src/page.js` (lines 953-979)

```javascript
function resolveWith(markdown, html) {
  var title = extractTitle()  // Try strategies 1-3 first
  
  // If still no title, extract from markdown directly
  if (!title && markdown) {
    // Parse markdown line-by-line
    var lines = markdown.split('\n')
    for (var i = 0; i < Math.min(lines.length, 10); i++) {
      var line = lines[i].trim()
      if (line && line.startsWith('#')) {
        // Remove # and whitespace
        var extractedTitle = line.replace(/^#+\s*/, '').trim()
        if (extractedTitle && extractedTitle.length > 0) {
          title = extractedTitle
          break
        }
      }
    }
    
    // Fallback to regex
    if (!title) {
      var titleMatch = markdown.match(/^#\s+(.+)$/m)
      if (titleMatch) title = titleMatch[1].trim()
    }
  }
  
  resolve({
    title: title || null,  // null if all strategies fail
    markdown: markdown,
    html: html
  })
}
```

**Why this works**: In markdown, the title is typically the first line starting with `#`.

### 5. Title Flow to Juejin

**File**: `packages/web-extension/src/viewer/App.vue`

```javascript
doSubmit() {
  var post = {
    title: self.$refs.title.innerText,  // From viewer display
    content: originalHtml,
    markdown: self.pageData.markdown
  }
  
  chrome.runtime.sendMessage({
    action: 'addTask',
    task: {
      post: post,
      accounts: selectedAc
    }
  })
}
```

**File**: `packages/web-extension/src/background.js` (line 904)

```javascript
var addResp = await driver.addPost({
  post_title: postContent.title,  // ← Title passed here
  post_content: postContent.content,
  // ...
})
```

**File**: `packages/@wechatsync/drivers/src/Juejin.js` (line 332)

```javascript
async editPost(post_id, post) {
  // Ensure title is available - try multiple sources
  var articleTitle = post.post_title || post.title || ''
  
  if (!articleTitle || articleTitle.trim().length === 0) {
    console.warn('Juejin: No title found, using default')
    articleTitle = 'Untitled Article'
  }
  
  // Send to Juejin API
  const res = await fetch('https://api.juejin.cn/content_api/v1/article_draft/create', {
    method: 'POST',
    body: JSON.stringify({
      title: articleTitle,  // ← Title sent to Juejin
      mark_content: markdown,
      // ...
    })
  })
}
```

## Extraction Priority Order

1. **Title Input Field** (most reliable)
   - Directly from editor UI
   - Fastest and most accurate

2. **HTML Preview H1** (reliable if preview rendered)
   - From rendered markdown
   - Requires preview to be generated

3. **Meta Tags/Page Title** (fallback)
   - From page metadata
   - May not always have article title

4. **Markdown First Line** (last resort)
   - Parse markdown source
   - Most reliable fallback

5. **Default: "Mdnice 文章"** (error case)
   - Only if all strategies fail
   - Indicates extraction problem

## Debugging

### Console Logs to Check

When title extraction runs, you should see these logs:

```
[WCS] fetchMdniceArticle() called
[WCS] fetchMdniceArticle: Promise started
Mdnice: Starting title extraction...
Mdnice: Found title from input field: <title>  // Strategy 1
// OR
Mdnice: Found title from HTML h1 in preview: <title>  // Strategy 2
// OR
Mdnice: Found title from meta/page title: <title>  // Strategy 3
// OR
Mdnice: Found title from markdown first line: <title>  // Strategy 4
Mdnice: Final extracted title: <title>
[WCS] fetchMdniceArticle resolved with data: { hasTitle: true, title: "<title>" }
[WCS] Mdnice: Using extracted title: <title>
```

### Common Issues

1. **"Mdnice 文章" appears**:
   - All extraction strategies failed
   - Check console for which strategies were tried
   - Verify page structure matches expected selectors

2. **Title input not found**:
   - Mdnice UI might have changed
   - Check actual DOM structure with DevTools
   - Update selectors in `extractTitle()`

3. **Markdown not extracted**:
   - Editor might use different structure
   - Check if markdown is in expected format
   - Verify `fetchMdniceArticle()` is getting markdown

## Code Locations Summary

| Component | File | Key Function | Lines |
|-----------|------|--------------|-------|
| User Action | `views/EntryView.vue` | `extractArticle()` | 414-450 |
| Message Handler | `page.js` | `fetchArticle()` | 494-517 |
| Mdnice Detection | `page.js` | `initPageFetch()` | 298-372 |
| Article Fetching | `page.js` | `fetchMdniceArticle()` | 634-1012 |
| Title Extraction | `page.js` | `extractTitle()` | 848-951 |
| Markdown Fallback | `page.js` | `resolveWith()` | 953-979 |
| Title to Viewer | `page.js` | `postToViewer()` | 350-360 |
| Viewer Display | `viewer/App.vue` | `doSubmit()` | 400-443 |
| Background Task | `background.js` | `doSync()` | 900-920 |
| Juejin Upload | `drivers/Juejin.js` | `editPost()` | 255-360 |

## Testing Checklist

- [ ] Open mdnice.com editor
- [ ] Enter a title in the title input field
- [ ] Click "提取文章" in extension
- [ ] Check console for `[WCS]` logs
- [ ] Verify title appears in viewer
- [ ] Select Juejin account
- [ ] Click "同步"
- [ ] Verify title appears in Juejin draft

## Future Improvements

1. **Real-time Title Detection**: Monitor DOM changes for title updates
2. **Multiple Title Sources**: Combine confidence scores from all strategies
3. **Title Validation**: Check if extracted title is reasonable (not empty, not generic)
4. **Caching**: Store extracted title to avoid re-extraction
5. **User Override**: Allow user to manually edit title before sync

