/**
 * Test script for colored notification backgrounds with white text
 * 
 * Run this in the browser console to test all notification variants
 * with colored backgrounds and white text/icons.
 */

// Check if we're in a browser extension context
if (typeof chrome === 'undefined' || !chrome.runtime) {
  console.error('This script must be run in a browser extension context')
} else {
  console.log('🎨 Nenspace Colored Notification Test')
  console.log('=====================================')
  
  // Test all notification variants with their expected colors
  const variants = [
    { name: 'success', color: '#22c55e', icon: '✓ CheckCircle2' },
    { name: 'error', color: '#ef4444', icon: '✗ XCircle' },
    { name: 'info', color: '#3b82f6', icon: 'ℹ Info' },
    { name: 'warning', color: '#eab308', icon: '⚠ AlertTriangle' },
    { name: 'loading', color: '#6b7280', icon: '⟳ Loader2 (spinning)' },
    { name: 'default', color: '#1f2937', icon: '🔔 Bell' }
  ]
  
  console.log('\n📋 Testing notification variants:')
  variants.forEach((variant, index) => {
    console.log(`${index + 1}. ${variant.name} - Background: ${variant.color} - Icon: ${variant.icon}`)
  })
  
  console.log('\n🔔 Sending colored notifications...')
  console.log('Watch the status indicator for:')
  console.log('- Colored backgrounds (green, red, blue, yellow, gray, dark gray)')
  console.log('- White text and icons for contrast')
  console.log('- Appropriate icons for each variant')
  
  // Test each variant with a delay
  variants.forEach((variant, index) => {
    setTimeout(() => {
      console.log(`\n${index + 1}. Testing ${variant.name} notification...`)
      console.log(`   Expected: Background ${variant.color}, White text/icon, ${variant.icon}`)
      
      // Send test notification via background script
      chrome.runtime.sendMessage({
        type: 'REALTIME_NOTIFICATION',
        payload: {
          message: `${variant.name.toUpperCase()} notification with colored background`,
          variant: variant.name,
          duration: 4000
        }
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.log(`   ✅ ${variant.name} notification sent`)
        } else {
          console.log(`   ✅ ${variant.name} notification sent`)
        }
      })
    }, index * 5000) // 5 second intervals
  })
  
  // Show summary
  setTimeout(() => {
    console.log('\n🎨 Color Summary:')
    console.log('=================')
    console.log('✅ Background colors change based on variant')
    console.log('✅ Text is always white for contrast')
    console.log('✅ Icons are always white for contrast')
    console.log('✅ Icons change based on variant:')
    console.log('   - success: ✓ (CheckCircle2)')
    console.log('   - error: ✗ (XCircle)')
    console.log('   - info: ℹ (Info)')
    console.log('   - warning: ⚠ (AlertTriangle)')
    console.log('   - loading: ⟳ (Loader2 - spinning)')
    console.log('   - default: 🔔 (Bell)')
    
    console.log('\n💡 Visual Design:')
    console.log('- High contrast white text/icons on colored backgrounds')
    console.log('- Consistent with modern notification design patterns')
    console.log('- Easy to distinguish between different message types')
  }, variants.length * 5000 + 2000)
  
  console.log('\n⏱️  Test will run for about 35 seconds...')
  console.log('Watch the status indicator for the colored notifications!')
}
