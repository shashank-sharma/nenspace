/**
 * Debug script for notification colors
 * 
 * Run this in the browser console to debug the color issue
 */

// Check if we're in a browser extension context
if (typeof chrome === 'undefined' || !chrome.runtime) {
  console.error('This script must be run in a browser extension context')
} else {
  console.log('🔍 Nenspace Color Debug Tool')
  console.log('============================')
  
  // Test 1: Send a success notification
  console.log('\n1. Sending success notification...')
  chrome.runtime.sendMessage({
    type: 'REALTIME_NOTIFICATION',
    payload: {
      message: 'Success notification test',
      variant: 'success',
      duration: 5000
    }
  }, (response) => {
    console.log('✅ Success notification sent')
  })
  
  // Test 2: Send an error notification after 2 seconds
  setTimeout(() => {
    console.log('\n2. Sending error notification...')
    chrome.runtime.sendMessage({
      type: 'REALTIME_NOTIFICATION',
      payload: {
        message: 'Error notification test',
        variant: 'error',
        duration: 5000
      }
    }, (response) => {
      console.log('✅ Error notification sent')
    })
  }, 2000)
  
  // Test 3: Send an info notification after 4 seconds
  setTimeout(() => {
    console.log('\n3. Sending info notification...')
    chrome.runtime.sendMessage({
      type: 'REALTIME_NOTIFICATION',
      payload: {
        message: 'Info notification test',
        variant: 'info',
        duration: 5000
      }
    }, (response) => {
      console.log('✅ Info notification sent')
    })
  }, 4000)
  
  console.log('\n📋 Debug Instructions:')
  console.log('1. Watch the browser console for debug logs')
  console.log('2. Look for logs starting with [StatusIndicator] and [IslandNotificationService]')
  console.log('3. Check if the status indicator background changes color')
  console.log('4. Expected colors:')
  console.log('   - Success: Green (#22c55e)')
  console.log('   - Error: Red (#ef4444)')
  console.log('   - Info: Blue (#3b82f6)')
  
  console.log('\n🔍 What to look for:')
  console.log('- [StatusIndicator] Received notification: {message, variant, duration}')
  console.log('- [StatusIndicator] Showing notification: {message, variant, duration}')
  console.log('- [IslandNotificationService] Getting colors for variant: [variant]')
  console.log('- [IslandNotificationService] Standard variant colors: {bg, text, iconColor}')
  console.log('- [StatusIndicator] Notification color: {variant, bgColor, colors, hasCustomBg}')
  
  console.log('\n⏱️  Test will run for about 10 seconds...')
  console.log('Check the console logs and status indicator!')
}
