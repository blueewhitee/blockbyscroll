# NoMoScroll

**Advanced digital wellness extension for mindful browsing**

NoMoScroll is a comprehensive browser extension designed to help you maintain healthy digital habits across social media and distracting websites. It combines scroll tracking, content analysis, video management, and site-specific customizations to create a personalized browsing experience that promotes productivity and mental well-being.

## Core Features

### Smart Scroll Management
- **Scroll Tracking**: Monitor scrolling activity across all your chosen websites
- **Custom Limits**: Set global scroll limits or customize limits per website
- **Visual Progress**: Real-time counter showing current scroll progress
- **Auto-Reset Timer**: Automatically refresh counters after specified time periods
- **Manual Reset**: Quick reset option when you need to continue browsing

### AI-Powered Content Analysis
- **Intelligent Content Assessment**: Powered by Google Gemini AI to analyze page content
- **Content Classification**: Identifies productive, neutral, entertainment, or doomscroll content
- **Smart Recommendations**: Provides personalized suggestions based on content analysis
- **Bonus Scrolls**: Earn extra scrolls for educational or productive content
- **Break Suggestions**: AI recommends when to take breaks based on content quality

### Video Overlay Management
- **X.com (Twitter) Video Overlays**: Hide videos behind customizable overlays with "View Video" buttons
- **Reddit Video Overlays**: Orange-themed overlays for Reddit videos with uppercase styling
- **Auto-play Prevention**: Prevents videos from auto-playing until manually revealed
- **Custom Button Text**: Personalize overlay button text and appearance
- **Cross-Platform Support**: Works with native videos, YouTube embeds, Vimeo, and more

### Platform-Specific Content Blocking
- **YouTube Shorts Blocking**: Hide YouTube Shorts to reduce distractions
- **YouTube Homepage Redirect**: Automatically redirect to subscriptions feed
- **Instagram Reels Blocking**: Hide Instagram Reels from feeds
- **Promoted Content Detection**: Special handling for sponsored/promoted content

## Why NoMoScroll?

Modern digital platforms are engineered to maximize engagement and keep users scrolling indefinitely. This design philosophy can lead to:

- **Productivity Loss**: Hours spent mindlessly consuming content instead of working
- **Information Overload**: Excessive exposure to low-quality or repetitive content
- **Mental Fatigue**: Constant stimulation leading to decreased focus and increased stress
- **Time Mismanagement**: Difficulty controlling time spent on social media and entertainment sites
- **Addictive Behaviors**: Developing unhealthy relationships with digital content consumption
- 
- 📊 Track your scrolling activity 
- 🛑 Set custom scroll limits to prevent endless doomscrolling
- 📱 Visual indicators showing your current scroll progress
- ⏱️ Optional auto-reset timer to refresh counters automatically
- ⚙️ Customizable blocklist to manage which sites are monitored
- 🚫 Block YouTube Shorts and homepage to reduce distractions and time waste

NoMoScroll addresses these challenges through intelligent intervention, content awareness, and personalized digital wellness features that help you browse with intention rather than impulse.

## How It Works

### Intelligent Scroll Management
1. **Smart Tracking**: Monitors significant scroll actions on your selected websites
2. **Flexible Limits**: Set global limits or customize per-site based on your needs
3. **Progressive Blocking**: Friendly overlay appears when limits are reached
4. **Mindful Reset**: Choose to reset manually or use automatic timers

### AI-Enhanced Browsing
1. **Content Analysis**: AI continuously evaluates page content for educational value
2. **Dynamic Recommendations**: Receive personalized suggestions based on content quality
3. **Adaptive Limits**: Earn bonus scrolls for productive content consumption
4. **Break Guidance**: Get AI-powered suggestions for optimal break timing

### Video & Distraction Management
1. **Video Overlays**: Hide autoplay videos behind "View Video" buttons
2. **Platform Customization**: Site-specific features for YouTube, Instagram, X, and Reddit
3. **Content Filtering**: Block distracting elements like Shorts and Reels
4. **Promoted Content Detection**: Special handling for advertisements and sponsored content

## Installation

### From Source (Recommended)

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/nomoscroll.git
   cd nomoscroll
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the extension**
   ```bash
   npm run build
   ```

4. **Load in your browser**
   - **Chrome/Edge**: Go to `chrome://extensions/`, enable Developer mode, click "Load unpacked", and select the `.output/chrome-mv3` directory
   - **Firefox**: Go to `about:debugging`, click "This Firefox", click "Load Temporary Add-on", and select the `manifest.json` file in the `.output/firefox-mv2` directory

### Development Setup

```bash
git clone https://github.com/your-username/nomoscroll.git
cd nomoscroll
npm install
npm run dev
```

A browser will automatically open with the extension loaded for development.

## Getting Started

### Basic Setup
1. **Install & Open**: Click the NoMoScroll icon in your browser toolbar
2. **Configure Sites**: Add websites to monitor (YouTube, X/Twitter, Reddit, Instagram, Facebook are included by default)
3. **Set Limits**: Choose your global scroll limit or customize per-site limits
4. **Enable Features**: Turn on video overlays, content blocking, and AI analysis as desired

### Advanced Configuration

#### Site-Specific Settings
Click on any site icon in your blocked sites list to access advanced features:

**YouTube Settings:**
- Hide YouTube Shorts from feeds
- Redirect homepage to subscriptions
- Custom scroll limits

**X.com (Twitter) Settings:**
- Video overlay with custom button text and color
- Opacity control for overlays
- Auto-play prevention

**Reddit Settings:**
- Orange-themed video overlays
- Reddit-specific promoted content detection
- Custom scroll limits

**Instagram Settings:**
- Hide Instagram Reels
- Custom scroll limits

#### AI Content Analysis
- **Automatic**: AI analyzes content as you browse
- **Smart Rewards**: Earn bonus scrolls for educational content
- **Break Suggestions**: Receive personalized break recommendations
- **Content Quality Tracking**: Monitor the quality of content you consume

### Daily Usage Workflow

1. **Start Your Session**: Open the extension and start browsing mindfully
2. **Browse Mindfully**: The extension tracks your activity across monitored sites
3. **Monitor Progress**: Check the scroll counter in the bottom-right corner
4. **Receive AI Insights**: Get real-time content quality feedback and recommendations
5. **Manage Videos**: Click "View Video" buttons to consciously engage with video content
6. **Take Breaks**: Follow AI suggestions for optimal break timing
7. **Reset When Needed**: Use manual reset or let automatic timers refresh your limits

### Pro Tips
- **Custom Limits**: Set lower limits for high-distraction sites and higher limits for educational sites
- **Video Overlays**: Use them to reduce impulsive video consumption on social media
- **AI Analysis**: Pay attention to content quality scores to improve your browsing habits

## Privacy & Security

### Data Handling
- **Local Storage**: All user preferences and scroll counts are stored locally in your browser
- **No Data Collection**: NoMoScroll does not collect, store, or transmit personal browsing data
- **AI Analysis**: Content analysis is performed via Google Gemini API with anonymized page content only
- **No Tracking**: No user behavior tracking or analytics are implemented

### What Data is Processed
- **Scroll Counts**: Stored locally per domain
- **Settings**: Extension preferences stored in browser sync storage
- **Content for AI**: Anonymized text content sent to Gemini API for analysis (no personal data)
- **No Personal Information**: URLs, personal data, or identifiable information are never transmitted

### Permissions
The extension requires minimal permissions:
- **Host Permissions**: To monitor scrolling on specified websites
- **Storage**: To save your settings and scroll counts locally
- **Tabs**: To detect when you switch between pages

## Technical Details

### Supported Browsers
- Chrome (Manifest V3)
- Microsoft Edge (Chromium-based)
- Firefox (Manifest V2)
- Safari (Experimental support)

### Supported Platforms
- **YouTube**: Shorts blocking, homepage redirect, video overlays
- **X.com (Twitter)**: Video overlays, custom styling, promoted content detection
- **Reddit**: Orange-themed overlays, native video support, iframe embeds
- **Instagram**: Reels blocking, scroll limiting
- **Facebook**: Basic scroll limiting
- **Custom Sites**: Add any website for scroll tracking

### AI Content Analysis
- **Provider**: Google Gemini API
- **Processing**: Real-time content classification
- **Categories**: Productive, neutral, entertainment, doomscroll, unknown
- **Recommendations**: Bonus scrolls, break suggestions, content quality scores

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

We welcome contributions! Here's how you can help:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes** and test thoroughly
4. **Commit your changes**: `git commit -m 'Add amazing feature'`
5. **Push to your branch**: `git push origin feature/amazing-feature`
6. **Open a Pull Request**

### Development Guidelines
- Follow existing code style and conventions
- Test new features across supported browsers
- Update documentation for new features
- Ensure privacy and security standards are maintained

## Issues & Support

- **Bug Reports**: [Create an issue](https://github.com/your-username/nomoscroll/issues)
- **Feature Requests**: [Start a discussion](https://github.com/your-username/nomoscroll/discussions)
- **Security Issues**: Contact us privately at security@nomoscroll.com

## Acknowledgments

- **WXT Framework**: For excellent browser extension development experience
- **Google Gemini**: For AI-powered content analysis capabilities
- **Community**: For feedback, suggestions, and contributions

---

**Made with love to help you scroll mindfully and live intentionally.**

*NoMoScroll - Because every scroll should be a choice, not a compulsion.*
