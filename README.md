# ScrollStop

**Control your X/Twitter scrolling and prevent doomscrolling**

ScrollStop is a browser extension designed to help you maintain healthy scrolling habits on X (formerly Twitter) by limiting how much you can scroll in a single session.

## Features

- 📊 Track your scrolling activity on sites addded to blocklist
- 🛑 Set custom scroll limits to prevent endless doomscrolling
-  domain-specific scroll counter that tracks scrolls separately for each website
- 📱 Visual indicators showing your current scroll progress
- 🔄 Quick reset option when you need to continue browsing
- ⚙️ Customize settings to fit your browsing habits

## Why ScrollStop?

Social media platforms like X are designed to keep you scrolling and consuming content endlessly. This can lead to:
- Reduced productivity
- Information overload
- Mental fatigue
- Time wasted

ScrollStop helps you take control of your scrolling habits by giving you a visual indicator of how much you've scrolled and blocking further scrolling once you've reached your preset limit.

## How It Works

1. **Track Scrolling**: ScrollStop counts significant scroll actions on X/Twitter
2. **Set Limits**: You decide how many scrolls you want to allow yourself
3. **Block On Limit**: Once you reach your limit, a friendly overlay prevents further scrolling
4. **Reset When Ready**: You can choose to reset the counter and continue browsing

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

## Usage

1. After installing the extension, click on the ScrollStop icon in your browser's toolbar
2. Set your desired maximum scroll count
3. Browse X/Twitter as normal
4. A small counter will appear in the bottom-right corner, showing your current scroll count
5. When you reach your limit, an overlay will appear, preventing further scrolling
6. You can either close the tab or click "Reset and Continue" to reset the counter

## Privacy

ScrollStop operates locally in your browser and doesn't send any data to external servers. Your browsing data and settings are stored only in your browser's local storage.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

Made with ❤️ to help you scroll less and live more.
