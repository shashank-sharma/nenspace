/**
 * Debug script for testing realtime notifications
 * 
 * Run this in the browser console to test the realtime connection
 * and send test notifications.
 */

// Check if we're in a browser extension context
if (typeof chrome === 'undefined' || !chrome.runtime) {
  console.error('This script must be run in a browser extension context')
} else {
  console.log('🔍 Nenspace Realtime Debug Tool')
  console.log('================================')
  
  // Test 1: Check background script status
  console.log('\n1. Checking background script status...')
  chrome.runtime.sendMessage({ type: 'GET_HEALTH_STATUS' }, (response) => {
    if (response && response.success) {
      console.log('✅ Health Status:', response.health)
    } else {
      console.error('❌ Failed to get health status:', response)
    }
  })
  
  // Test 2: Check realtime status
  console.log('\n2. Checking realtime status...')
  chrome.runtime.sendMessage({ type: 'REALTIME_GET_STATUS' }, (response) => {
    if (response && response.success) {
      console.log('✅ Realtime Status Response:', response)
    } else {
      console.error('❌ Failed to get realtime status:', response)
    }
  })
  
  // Test 3: Check browser ID
  console.log('\n3. Checking browser ID...')
  chrome.runtime.sendMessage({ type: 'GET_BROWSER_ID' }, (response) => {
    if (response && response.success) {
      console.log('✅ Browser ID:', response.browserId)
    } else {
      console.error('❌ Failed to get browser ID:', response)
    }
  })
  
  // Test 4: Listen for realtime messages
  console.log('\n4. Setting up realtime message listener...')
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'REALTIME_NOTIFICATION') {
      console.log('🔔 Realtime notification received:', message.payload)
    } else if (message.type === 'REALTIME_STATUS') {
      console.log('📡 Realtime status update:', message.payload)
    } else if (message.type === 'HEALTH_STATUS') {
      console.log('💚 Health status update:', message.payload)
    }
  })
  
  // Test 5: Manual health check
  console.log('\n5. Triggering manual health check...')
  chrome.runtime.sendMessage({ type: 'CHECK_HEALTH' }, (response) => {
    if (response && response.success) {
      console.log('✅ Manual health check result:', response.health)
    } else {
      console.error('❌ Manual health check failed:', response)
    }
  })
  
  console.log('\n📋 Debug Summary:')
  console.log('- Check the console for realtime messages')
  console.log('- Send a test notification from your API')
  console.log('- Watch for "🔔 Realtime notification received" messages')
  console.log('\n💡 If you don\'t see notifications:')
  console.log('1. Check that the browser profile is selected')
  console.log('2. Verify the user is authenticated')
  console.log('3. Ensure the backend is healthy')
  console.log('4. Check the topic format matches: notifications:{userId}:{profileId}')
}
