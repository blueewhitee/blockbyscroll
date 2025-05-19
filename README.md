# NoMoScroll

**Control your scrolling and prevent doomscrolling**

NoMoScroll is a browser extension designed to help you maintain healthy scrolling habits on social media and other distracting site by limiting how much you can scroll in a single session.

## Features

- 📊 Track your scrolling activity 
- 🛑 Set custom scroll limits to prevent endless doomscrolling
- 📱 Visual indicators showing your current scroll progress
- 🔄 Quick reset option when you need to continue browsing
- ⏱️ Optional auto-reset timer to refresh counters automatically
- ⚙️ Customizable blocklist to manage which sites are monitored
- 🚫 Block YouTube Shorts and homepage to reduce distractions and time waste

## Why NoMoScroll?

Social media platforms and content sites are designed to keep you scrolling and consuming content endlessly. This can lead to:
- Reduced productivity
- Information overload
- Mental fatigue
- Time wasted

NoMoScroll helps you take control of your scrolling habits by giving you a visual indicator of how much you've scrolled and blocking further scrolling once you've reached your preset limit.

## How It Works

1. **Track Scrolling**: NoMoScroll counts significant scroll actions on your chosen sites
2. **Set Limits**: You decide how many scrolls you want to allow yourself (globally or per site)
3. **Block On Limit**: Once you reach your limit, a friendly overlay prevents further scrolling
4. **Reset When Ready**: You can choose to reset the counter manually or set an automatic timer

## Installation

### From Source

1. Clone this repository
2. Install dependencies: `npm install`
3. Build the extension: `npm run build`
4. Load the extension in your browser:
   - Chrome: Go to `chrome://extensions/`, enable Developer mode, click "Load unpacked", and select the `dist` directory
   - Firefox: Go to `about:debugging`, click "This Firefox", click "Load Temporary Add-on", and select any file in the `dist` directory

### Development

1. Clone this repository
2. Install dependencies: `npm install`
3. Start the development server: `npm run dev`
4. A browser will open with the extension loaded

## Example Usage

1. After installing the extension, click on the NoMoScroll icon in your browser's toolbar
2. Set your global maximum scroll count
3. Add websites to your blocklist that you want to monitor (YouTube, X/Twitter, Reddit are added by default)
4. Optionally set custom scroll limits for specific sites by clicking on their icons
5. Enable YouTube Shorts and homepage blocking to prevent these distracting elements from appearing
6. Browse the web as normal - NoMoScroll will only monitor sites on your blocklist
7. A small counter will appear in the bottom-right corner when on monitored sites
8. When you reach your limit, an overlay will appear, preventing further scrolling
9. You can either close the tab or click "Reset and Continue" to reset the counter
10. Set an auto-reset timer if you want counters to reset automatically after a period of time

## Privacy

NoMoScroll operates locally in your browser and doesn't send any data to external servers. Your browsing data and settings are stored only in your browser's local storage.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

Made with ❤️ to help you scroll less and live more.
