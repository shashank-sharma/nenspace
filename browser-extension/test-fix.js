/**
 * Test script to verify the background color fix
 * 
 * Run this in the browser console to test the reactive background color
 */

// Check if we're in a browser extension context
if (typeof chrome === 'undefined' || !chrome.runtime) {
  console.error('This script must be run in a browser extension context')
} else {
  console.log('🎨 Testing Background Color Fix')
  console.log('===============================')
  
  console.log('\n🔍 What should happen:')
  console.log('1. Status indicator background should change to blue (#3b82f6)')
  console.log('2. Text and icon should be white')
  console.log('3. You should see the debug log: [StatusIndicator] Notification color:')
  
  console.log('\n📋 Test sequence:')
  console.log('1. Info notification (blue background)')
  console.log('2. Success notification (green background)')
  console.log('3. Error notification (red background)')
  
  // Test 1: Info notification (blue)
  console.log('\n1. Sending info notification (should be blue)...')
  chrome.runtime.sendMessage({
    type: 'REALTIME_NOTIFICATION',
    payload: {
      message: 'Info notification - should be blue background',
      variant: 'info',
      duration: 4000
    }
  })
  
  // Test 2: Success notification (green) after 5 seconds
  setTimeout(() => {
    console.log('\n2. Sending success notification (should be green)...')
    chrome.runtime.sendMessage({
      type: 'REALTIME_NOTIFICATION',
      payload: {
        message: 'Success notification - should be green background',
        variant: 'success',
        duration: 4000
      }
    })
  }, 5000)
  
  // Test 3: Error notification (red) after 10 seconds
  setTimeout(() => {
    console.log('\n3. Sending error notification (should be red)...')
    chrome.runtime.sendMessage({
      type: 'REALTIME_NOTIFICATION',
      payload: {
        message: 'Error notification - should be red background',
        variant: 'error',
        duration: 4000
      }
    })
  }, 10000)
  
  console.log('\n✅ Expected Results:')
  console.log('- Info: Blue background (#3b82f6)')
  console.log('- Success: Green background (#22c55e)')
  console.log('- Error: Red background (#ef4444)')
  console.log('- All with white text and icons')
  
  console.log('\n🔍 Debug logs to watch for:')
  console.log('- [StatusIndicator] Notification color: {variant, bgColor, colors, hasCustomBg}')
  console.log('- [IslandNotificationService] Getting colors for variant: [variant]')
  console.log('- [IslandNotificationService] Standard variant colors: {bg, text, iconColor}')
  
  console.log('\n⏱️  Test will run for about 15 seconds...')
  console.log('Watch the status indicator background color change!')
}
