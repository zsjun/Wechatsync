import TurndownService from 'turndown'

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'offscreen') return

  if (message.type === 'turndown') {
    try {
      const service = new TurndownService(message.options || {})
      
      // Add standard rules if needed
      service.addRule('strikethrough', {
        filter: ['del', 's', 'strike'],
        replacement: function (content) {
          return '~' + content + '~'
        }
      })
      
      // Handle code blocks better if needed
      service.addRule('fencedCodeBlock', {
        filter: function (node, options) {
          return (
            options.codeBlockStyle === 'fenced' &&
            node.nodeName === 'PRE' &&
            node.firstChild &&
            node.firstChild.nodeName === 'CODE'
          )
        },
        replacement: function (content, node, options) {
          var className = node.firstChild.getAttribute('class') || ''
          var language = (className.match(/language-(\S+)/) || [null, ''])[1]
          var code = node.firstChild.textContent
          
          // If code ends with \n, remove it because fence adds one
          // But turndown might handle this.
          
          return (
            '\n\n' + options.fence + language + '\n' +
            node.firstChild.textContent +
            '\n' + options.fence + '\n\n'
          )
        }
      })

      const markdown = service.turndown(message.content)
      sendResponse(markdown)
    } catch (e) {
      console.error('Turndown error in offscreen:', e)
      sendResponse({ error: e.toString() })
    }
  }
})
