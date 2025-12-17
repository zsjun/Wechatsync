// Mdnice Title Extraction Test Script
// Copy and paste this entire code into the browser console on mdnice.com

(function() {
  console.log('=== Mdnice Title Extraction Test ===');
  
  function extractTitle() {
    console.log('Mdnice: Starting title extraction...');
    
    // Strategy 1: Extract from sidebar container (most reliable for mdnice)
    // The title is in: .nice-article-sidebar-list-item-container[style] > p
    try {
      var sidebarContainers = document.querySelectorAll('.nice-article-sidebar-list-item-container');
      console.log('Found sidebar containers:', sidebarContainers.length);
      
      for (var i = 0; i < sidebarContainers.length; i++) {
        var container = sidebarContainers[i];
        var styleAttr = container.getAttribute('style');
        console.log('Container', i, 'style attribute:', styleAttr);
        
        // Check if container has style attribute (not null)
        if (styleAttr !== null) {
          var pTag = container.querySelector('p');
          console.log('Found p tag:', pTag);
          
          if (pTag && pTag.textContent && pTag.textContent.trim()) {
            var titleText = pTag.textContent.trim();
            console.log('✅ Mdnice: Found title from sidebar container:', titleText);
            return titleText;
          }
        }
      }
    } catch (e) {
      console.warn('Mdnice: Error extracting title from sidebar container', e);
    }
    
    // Strategy 2: Try to find title input field in mdnice editor (fallback)
    try {
      var titleInput = document.querySelector('input[placeholder*="标题"]') ||
                      document.querySelector('input[placeholder*="title" i]') ||
                      document.querySelector('input[name="title"]') ||
                      document.querySelector('input[id*="title" i]') ||
                      document.querySelector('.title input') ||
                      document.querySelector('#title') ||
                      document.querySelector('input.title');
      
      if (titleInput) {
        var titleValue = titleInput.value || titleInput.getAttribute('value') || titleInput.textContent || '';
        if (titleValue && titleValue.trim()) {
          console.log('✅ Mdnice: Found title from input field:', titleValue.trim());
          return titleValue.trim();
        }
      }
    } catch (e) {
      console.warn('Mdnice: Error extracting title from input fields', e);
    }
    
    // Strategy 3: Try to extract from HTML preview (h1 tag in preview container)
    try {
      var h1 = document.querySelector('h1');
      if (h1 && h1.textContent && h1.textContent.trim()) {
        var h1Text = h1.textContent.trim();
        if (h1Text.toLowerCase() !== 'mdnice' && !h1Text.toLowerCase().includes('mdnice 文章')) {
          console.log('✅ Mdnice: Found title from h1:', h1Text);
          return h1Text;
        }
      }
      
      var previewSelectors = ['#nice', '#preview', '.preview', '.preview-body', '.output', '.markdown-body'];
      for (var i = 0; i < previewSelectors.length; i++) {
        var previewEl = document.querySelector(previewSelectors[i]);
        if (previewEl) {
          var previewH1 = previewEl.querySelector('h1');
          if (previewH1 && previewH1.textContent && previewH1.textContent.trim()) {
            var previewH1Text = previewH1.textContent.trim();
            if (previewH1Text.toLowerCase() !== 'mdnice' && !previewH1Text.toLowerCase().includes('mdnice 文章')) {
              console.log('✅ Mdnice: Found title from HTML h1 in preview:', previewH1Text);
              return previewH1Text;
            }
          }
        }
      }
    } catch (e) {
      console.warn('Mdnice: Error extracting title from preview', e);
    }
    
    // Strategy 4: Try to get from page title or meta tags
    try {
      var metaTitle = null;
      var ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle && ogTitle.content) {
        metaTitle = ogTitle.content;
      } else {
        var twitterTitle = document.querySelector('meta[name="twitter:title"]');
        if (twitterTitle && twitterTitle.content) {
          metaTitle = twitterTitle.content;
        } else {
          metaTitle = document.title;
        }
      }
      
      if (metaTitle && metaTitle.trim() && !metaTitle.toLowerCase().includes('mdnice')) {
        console.log('✅ Mdnice: Found title from meta/page title:', metaTitle.trim());
        return metaTitle.trim();
      }
    } catch (e) {
      console.warn('Mdnice: Error extracting title from meta', e);
    }
    
    console.warn('❌ Mdnice: Could not extract title from any source');
    return null;
  }
  
  // Run the extraction
  var title = extractTitle();
  
  console.log('=== Result ===');
  if (title) {
    console.log('✅ Extracted Title:', title);
    return title;
  } else {
    console.log('❌ No title found');
    
    // Debug: Show what we found
    console.log('\n=== Debug Info ===');
    console.log('Sidebar containers:', document.querySelectorAll('.nice-article-sidebar-list-item-container').length);
    document.querySelectorAll('.nice-article-sidebar-list-item-container').forEach(function(container, idx) {
      console.log('Container', idx, ':', {
        hasStyle: container.getAttribute('style') !== null,
        style: container.getAttribute('style'),
        pTag: container.querySelector('p') ? container.querySelector('p').textContent : 'no p tag'
      });
    });
    
    return null;
  }
})();

