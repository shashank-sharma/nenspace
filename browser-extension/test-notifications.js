/**
 * Test script for notification variants and colors
 * 
 * Run this in the browser console to test all notification variants
 * and see their colors in action.
 */

// Check if we're in a browser extension context
if (typeof chrome === 'undefined' || !chrome.runtime) {
  console.error('This script must be run in a browser extension context')
} else {
  console.log('🎨 Nenspace Notification Color Test')
  console.log('===================================')
  
  // Test all notification variants
  const variants = ['success', 'error', 'info', 'warning', 'loading', 'default']
  
  console.log('\n📋 Available notification variants:')
  variants.forEach((variant, index) => {
    console.log(`${index + 1}. ${variant}`)
  })
  
  console.log('\n🔔 Testing notification variants...')
  console.log('Watch the status indicator for colored notifications!')
  
  // Test each variant with a delay
  variants.forEach((variant, index) => {
    setTimeout(() => {
      console.log(`\n${index + 1}. Testing ${variant} notification...`)
      
      // Send test notification via background script
      chrome.runtime.sendMessage({
        type: 'REALTIME_NOTIFICATION',
        payload: {
          message: `This is a ${variant} notification`,
          variant: variant,
          duration: 3000
        }
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.log(`✅ ${variant} notification sent (no response expected)`)
        } else {
          console.log(`✅ ${variant} notification sent`)
        }
      })
    }, index * 4000) // 4 second intervals
  })
  
  // Show color information
  setTimeout(() => {
    console.log('\n🎨 Color Information:')
    console.log('====================')
    console.log('success: Green (#22c55e) - Success messages')
    console.log('error:   Red (#ef4444)   - Error messages')
    console.log('info:    Blue (#3b82f6)  - Information messages')
    console.log('warning: Yellow (#eab308) - Warning messages')
    console.log('loading: Gray (#6b7280)  - Loading states')
    console.log('default: Dark Gray (#1f2937) - Default messages')
    
    console.log('\n💡 Tips:')
    console.log('- Colors match the frontend notification system')
    console.log('- Each variant has distinct background, text, and icon colors')
    console.log('- Notifications auto-dismiss after 3 seconds')
    console.log('- Use the appropriate variant for your message type')
  }, variants.length * 4000 + 2000)
  
  console.log('\n⏱️  Test will run for about 30 seconds...')
  console.log('Watch the status indicator for the colored notifications!')
}
