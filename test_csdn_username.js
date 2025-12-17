// CSDN Username Extraction Test Script
// Run this in the browser console on a CSDN blog page like:
// https://blog.csdn.net/tttyyy556?spm=1000.2115.3001.10640

(function() {
  console.log('=== CSDN Username Extraction Test ===\n');
  
  // Strategy 1: Extract from user-profile-head-name div
  console.log('1. Looking for .user-profile-head-name div...');
  var nameDiv = document.querySelector('.user-profile-head-name');
  
  if (nameDiv) {
    console.log('   ✅ Found .user-profile-head-name div');
    console.log('   Div HTML:', nameDiv.outerHTML);
    
    // Get the first div inside
    var firstDiv = nameDiv.querySelector('div:first-child');
    if (firstDiv) {
      var username = firstDiv.textContent || firstDiv.innerText || '';
      username = username.trim();
      console.log('   ✅ Found first div inside:', firstDiv.outerHTML);
      console.log('   ✅ Extracted username:', username);
      
      // Also try to get avatar
      var avatar = null;
      var avatarImg = document.querySelector('.user-profile-head-avatar img') ||
                      document.querySelector('.user-profile-head img') ||
                      document.querySelector('[class*="avatar"] img');
      if (avatarImg) {
        avatar = avatarImg.src || avatarImg.getAttribute('src');
        console.log('   ✅ Found avatar:', avatar);
      }
      
      // Try to get user ID from URL
      var userId = null;
      var urlMatch = window.location.pathname.match(/\/blog\.csdn\.net\/([^\/\?]+)/);
      if (urlMatch && urlMatch[1]) {
        userId = urlMatch[1];
        console.log('   ✅ Extracted user ID from URL:', userId);
      }
      
      console.log('\n=== Result ===');
      console.log('Username:', username);
      console.log('User ID:', userId || username);
      console.log('Avatar:', avatar || 'not found');
      
      return {
        uid: userId || username,
        title: username,
        avatar: avatar || '',
        type: 'csdn',
        displayName: 'CSDN',
        supportTypes: ['markdown', 'html'],
        home: 'https://mp.csdn.net/',
        icon: 'https://g.csdnimg.cn/static/logo/favicon32.ico',
      };
    } else {
      console.warn('   ⚠️  No first div found inside .user-profile-head-name');
      console.log('   Div children:', nameDiv.children);
      console.log('   Div innerHTML:', nameDiv.innerHTML);
    }
  } else {
    console.warn('   ❌ .user-profile-head-name div not found');
    
    // Debug: Show what divs are available
    console.log('\n=== Debug: Available divs ===');
    var allDivs = document.querySelectorAll('div[class*="user"], div[class*="profile"], div[class*="name"]');
    console.log('Found', allDivs.length, 'divs with user/profile/name in class');
    allDivs.forEach(function(div, idx) {
      if (idx < 10) { // Show first 10
        console.log('  Div', idx, ':', div.className, '- text:', (div.textContent || '').substring(0, 50));
      }
    });
  }
  
  // Strategy 2: Try to extract from URL
  console.log('\n2. Trying to extract from URL...');
  var urlMatch = window.location.pathname.match(/\/blog\.csdn\.net\/([^\/\?]+)/);
  if (urlMatch && urlMatch[1]) {
    var usernameFromUrl = urlMatch[1];
    console.log('   ✅ Found username in URL:', usernameFromUrl);
    return {
      uid: usernameFromUrl,
      title: usernameFromUrl,
      avatar: '',
      type: 'csdn',
      displayName: 'CSDN',
      supportTypes: ['markdown', 'html'],
      home: 'https://mp.csdn.net/',
      icon: 'https://g.csdnimg.cn/static/logo/favicon32.ico',
    };
  } else {
    console.warn('   ❌ Could not extract username from URL');
    console.log('   Current URL:', window.location.href);
  }
  
  console.log('\n❌ No username found');
  return null;
})();

