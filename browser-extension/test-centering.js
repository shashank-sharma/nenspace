/**
 * Test script to verify icon centering
 * 
 * Run this in the browser console to test icon centering
 */

// Check if we're in a browser extension context
if (typeof chrome === 'undefined' || !chrome.runtime) {
  console.error('This script must be run in a browser extension context')
} else {
  console.log('🎯 Testing Icon Centering')
  console.log('========================')
  
  console.log('\n🔍 What to check:')
  console.log('1. Default state: Icon should be perfectly centered in the circle')
  console.log('2. Notification state: Icon should be centered vertically, aligned left with text')
  console.log('3. All icons should be properly aligned regardless of size')
  
  console.log('\n📋 Test sequence:')
  console.log('1. Check default state (no notification)')
  console.log('2. Send a notification to see icon + text alignment')
  console.log('3. Send different variants to test all icons')
  
  // Test 1: Check default state first
  console.log('\n1. Check default state - icon should be centered in circle')
  console.log('   Look at the status indicator - the icon should be perfectly centered')
  
  // Test 2: Send a notification after 2 seconds
  setTimeout(() => {
    console.log('\n2. Sending notification - icon should be centered vertically with text')
    chrome.runtime.sendMessage({
      type: 'REALTIME_NOTIFICATION',
      payload: {
        message: 'Icon centering test',
        variant: 'success',
        duration: 5000
      }
    })
  }, 2000)
  
  // Test 3: Send different variants to test all icons
  setTimeout(() => {
    console.log('\n3. Testing different icon variants...')
    chrome.runtime.sendMessage({
      type: 'REALTIME_NOTIFICATION',
      payload: {
        message: 'Info icon test',
        variant: 'info',
        duration: 3000
      }
    })
  }, 8000)
  
  setTimeout(() => {
    chrome.runtime.sendMessage({
      type: 'REALTIME_NOTIFICATION',
      payload: {
        message: 'Error icon test',
        variant: 'error',
        duration: 3000
      }
    })
  }, 12000)
  
  console.log('\n✅ Expected Results:')
  console.log('- Default state: Icon perfectly centered in circle')
  console.log('- Notification state: Icon centered vertically, text aligned properly')
  console.log('- All icons (✓, ✗, ℹ, ⚠, ⟳, 🔔) should be centered')
  console.log('- No visual misalignment or off-center icons')
  
  console.log('\n🎯 Centering Details:')
  console.log('- Default: justify-content: center, align-items: center')
  console.log('- Notification: justify-content: flex-start, align-items: center')
  console.log('- Icon container: display: flex, align-items: center, justify-content: center')
  
  console.log('\n⏱️  Test will run for about 15 seconds...')
  console.log('Check the icon alignment in both states!')
}
