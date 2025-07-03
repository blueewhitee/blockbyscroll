# Video Overlay Feature Test Guide

## Overview
This guide helps you test the new video overlay feature for X.com that hides embedded videos behind an opaque overlay with a "View Video" button.

## Prerequisites
1. Build and install the extension
2. Ensure X.com (https://x.com) is in your blocked sites list
3. Have the extension enabled

## Testing Steps

### 1. Installation and Setup
```bash
# Build the extension
npm run build

# For Firefox
npm run build:firefox
```

1. Load the extension in your browser
2. Open the extension popup
3. Verify X.com is in the blocked sites list
4. Ensure "Video Overlay" toggle is enabled

### 2. Basic Video Overlay Test
1. Navigate to https://x.com
2. Scroll through the timeline to find posts with videos
3. **Expected**: Videos should be covered with a dark overlay and "View Video" button
4. Click the "View Video" button on any video
5. **Expected**: Overlay disappears and video becomes interactive

### 3. Video Types to Test
Test with these different types of video content on X.com:
- [ ] Organic video posts (user-uploaded videos)
- [ ] Promoted video ads
- [ ] Video replies in threads
- [ ] Videos in quoted tweets
- [ ] GIF videos
- [ ] Live video streams (if available)

### 4. Settings Configuration Test
1. Click on the X.com icon in the extension popup
2. **Expected**: Advanced video overlay settings appear
3. Test each setting:
   - [ ] **Enable/Disable**: Toggle should show/hide overlays
   - [ ] **Auto-play on Reveal**: Videos should auto-play when revealed (if enabled)
   - [ ] **Opacity Slider**: Adjust overlay transparency (50-100%)
   - [ ] **Button Text**: Change button text (e.g., "Play Video", "Show Content")
   - [ ] **Button Color**: Change button color using color picker or hex input

### 5. Dynamic Loading Test
1. Keep X.com open in one tab
2. Scroll down to load new posts dynamically
3. **Expected**: New videos should automatically get overlays
4. **Expected**: No performance degradation during scrolling

### 6. Settings Persistence Test
1. Change video overlay settings in popup
2. Click "Save Settings"
3. Refresh X.com page
4. **Expected**: Settings should persist and be applied

### 7. Multiple Tabs Test
1. Open multiple X.com tabs
2. **Expected**: Video overlays work in all tabs
3. Change settings in popup
4. **Expected**: Settings apply to all open X.com tabs

### 8. Edge Cases Test
- [ ] **No Videos**: Pages with no videos should work normally
- [ ] **Rapid Scrolling**: Fast scrolling shouldn't cause issues
- [ ] **Page Navigation**: Navigating between X.com pages should maintain functionality
- [ ] **Disabled State**: Disabling video overlay should remove all overlays

### 9. Performance Test
1. Open browser developer tools (F12)
2. Go to Console tab
3. Navigate to X.com
4. Look for "VIDEO OVERLAY:" log messages
5. **Expected**: No error messages
6. **Expected**: Smooth page performance

### 10. Browser Compatibility Test
Test in multiple browsers:
- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Edge
- [ ] Safari (if applicable)

## Common Issues and Troubleshooting

### Videos Not Getting Overlays
1. Check browser console for errors
2. Verify X.com is in blocked sites list
3. Ensure video overlay is enabled in settings
4. Try refreshing the page

### Overlays Not Disappearing
1. Check if button click events are working
2. Verify no JavaScript errors in console
3. Try different videos

### Settings Not Saving
1. Check extension permissions
2. Verify popup shows correct settings
3. Try closing and reopening popup

### Performance Issues
1. Check number of videos on page
2. Monitor memory usage
3. Disable other extensions for comparison

## Console Commands for Testing
Open browser console on X.com and run these commands:

```javascript
// Check if video overlay manager is loaded
console.log('Video overlay manager active:', !!window.videoOverlayManager);

// Get video overlay statistics
if (window.videoOverlayManager) {
  console.log('Video stats:', window.videoOverlayManager.getStats());
}

// Find all videos on page
console.log('Videos found:', document.querySelectorAll('video').length);

// Find all overlays
console.log('Overlays found:', document.querySelectorAll('.x-video-overlay').length);
```

## Expected Selectors (for debugging)
The extension should detect videos using these selectors:
- `video` (all video elements)
- `[data-testid="videoPlayer"] video`
- `[data-testid="VideoPlayer"] video`
- `[data-testid="placementTracking"] video` (ads)
- `.video-player video`
- `.Video video`
- `.media-inline video`

## Success Criteria
✅ **Feature Complete** when:
1. All video types on X.com get overlays
2. Clicking "View Video" reveals videos
3. Settings are configurable and persistent
4. No performance degradation
5. Works across browser refresh and navigation
6. Handles dynamic content loading
7. Compatible with major browsers

## Reporting Issues
When reporting issues, include:
1. Browser and version
2. X.com URL where issue occurs
3. Console error messages
4. Steps to reproduce
5. Expected vs actual behavior
6. Screenshots/video if helpful

## Advanced Testing
For developers, you can also test:
1. Mutation observer efficiency
2. Intersection observer performance  
3. Memory leak detection
4. DOM manipulation impact
5. Event listener cleanup 