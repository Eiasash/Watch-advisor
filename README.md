# ⌚ Watch Advisor

**AI-Powered Watch & Outfit Coordinator for Watch Enthusiasts**

> Pair your luxury timepieces with your wardrobe using intelligent color matching, weather insights, and AI-powered styling recommendations.

## 🌐 Live Application

**Access the app here:** [https://eiasash.github.io/Watch-advisor/](https://eiasash.github.io/Watch-advisor/)

## 📖 Overview

Watch Advisor is a sophisticated Progressive Web App (PWA) designed for watch collectors and style enthusiasts who want to coordinate their timepieces with their wardrobe. Whether you own genuine pieces or replicas, this app helps you create cohesive outfits that complement your watch collection.

## ✨ Key Features for Watch Geeks

### 🎯 Watch Collection Management
- **Comprehensive Watch Database**: Store unlimited watches with detailed specifications
  - Dial color, case material, bracelet/strap options
  - Color temperature (warm/cool tones)
  - Matching colors (MC) and avoiding colors (AC)
  - Context suitability (formal, casual, weekend, date, etc.)
  - Weather appropriateness (light/mid/heavy layers)
  - Status tracking (active, incoming, service, sold, etc.)
- **Smart Color Matching**: Pre-configured matching and avoiding colors for each watch
- **Custom Emojis**: Personalize each watch with emoji identifiers
- **Genuine vs Replica Tracking**: Separate your authentic pieces from homages

### 👔 Wardrobe Coordination
- **Garment Library**: Build your complete wardrobe
  - Tops: Shirts, Polos, T-Shirts, Sweaters/Knits, Jackets/Blazers
  - Bottoms: Pants/Trousers, Chinos, Jeans, Shorts
  - Shoes: All footwear types
- **Photo-Based Import**: Upload photos of your clothes for AI-powered identification
  - Automatic color detection from 40+ color options
  - Pattern recognition (solid, plaid, striped, checked, print, textured)
  - Material inference (cotton, linen, wool, cashmere, silk, denim, leather, etc.)
  - Season suggestions based on garment type and material
- **Context-Aware Sorting**: Organize clothes by occasion (formal, casual, date, travel, etc.)

### 🤖 AI-Powered Outfit Generation
- **Intelligent Matching Algorithm**: 
  - Color harmony analysis between watch and clothing
  - Context appropriateness scoring
  - Material and pattern coordination
  - Season compatibility checking
- **Claude AI Integration**: Get vivid, editorial-style outfit descriptions
  - Cinematic vision of your complete look
  - Color interplay analysis
  - Risk assessment for potential clashes
  - Strap/bracelet recommendations for specific outfits
- **Multiple Outfit Suggestions**: Generate several options for each watch

### 🌤️ Weather Integration
- **7-Day Forecast Planning**: Plan your weekly watch rotation with weather in mind
  - Real-time weather data integration
  - Temperature-based layering recommendations
  - Rain detection for bracelet vs. leather strap decisions
- **Smart Seasonal Recommendations**: 
  - Heavy layers (≤5°C): Leather straps stay warm
  - Mid layers (6-24°C): Versatile options
  - Light layers (25°C+): Steel bracelets preferred

### 📊 Insights & Analytics
- **Wear Tracking**: 28-day visual calendar showing which watch you wore each day
- **Rotation Statistics**: See your most and least worn pieces
- **Never Worn Alerts**: Identify watches that haven't been logged
- **Context Analysis**: Track which occasions you dress for most

### 💾 Data Persistence
- **Local Storage**: All your data stays on your device
- **Import/Export**: Backup and restore your complete collection
- **Offline Capable**: PWA works without internet (except AI features)

## 🚀 Getting Started

### Prerequisites
- Modern web browser (Chrome, Safari, Firefox, Edge)
- Optional: Claude API key for AI outfit descriptions ([Get one here](https://console.anthropic.com))

### Installation

1. **Web Access**: Simply visit [https://eiasash.github.io/Watch-advisor/](https://eiasash.github.io/Watch-advisor/)

2. **Install as PWA** (Recommended):
   - **iOS**: Safari → Share → "Add to Home Screen"
   - **Android**: Chrome → Menu → "Add to Home Screen"
   - **Desktop**: Click the install icon in the address bar

### First-Time Setup

1. **Add Your Watches**:
   - Go to "Watches" tab
   - Click "+" to add a watch
   - Fill in details: name, dial color, bracelet/strap
   - Set matching colors (colors that work well)
   - Set avoiding colors (colors that clash)
   - Choose appropriate contexts (formal, casual, etc.)
   - Select weather weights

2. **Build Your Wardrobe**:
   - Navigate to "Wardrobe" tab
   - Use "Add from Photo" to scan your clothes
   - Or manually add garments with details
   - The app will auto-suggest materials and seasons

3. **Configure AI (Optional)**:
   - Go to Settings
   - Add your Claude API key for outfit descriptions
   - This enables detailed styling feedback

## 💡 Usage Guide

### Creating Outfits

1. **Go to "Fits" Tab**: Main outfit generation interface
2. **Select Context**: Choose your occasion (formal, casual, date, etc.)
3. **Pick a Watch**: Select from your collection
4. **Generate Outfits**: App creates multiple coordinated looks
5. **Review AI Feedback**: Get styling insights and risk assessments
6. **Save Favorites**: Store winning combinations for later

### Planning Your Week

1. **Check Weather**: 7-day forecast automatically loads
2. **Set Contexts**: Assign occasions to each day
3. **Lock Watches** (Optional): Fix specific watches for certain days
4. **Generate Plan**: Get a full week of coordinated outfits
5. **Avoid Repeats**: Algorithm prevents wearing same outfit on consecutive days

### Tracking Your Rotation

1. **Log Wear**: Record which watch you wore today
2. **View Calendar**: See 28-day history at a glance
3. **Check Stats**: Identify rotation patterns
4. **Balance Collection**: Ensure all pieces get wrist time

## 🎨 Color Matching Tips

### For Watch Geeks:
- **Black/Charcoal Dials**: Versatile – pair with almost anything
- **White/Cream Dials**: Elegant – best with neutrals, avoid earth tones
- **Blue Dials**: Cool – navy, grey, white; avoid warm browns
- **Green Dials**: Nature – olive, khaki, cream, tan
- **Gold/Bronze**: Warm – browns, creams, burgundy; avoid cool greys
- **Silver/Steel**: Cool – greys, blues, blacks, whites

### Bracelet vs. Strap:
- **Steel Bracelets**: Perfect for hot weather, rain, casual/sport contexts
- **Leather Straps**: Formal occasions, cooler weather, dressy looks
- **NATO/Fabric**: Casual, travel, summer, versatile

## 🔧 Technical Details

### Built With
- **React 18**: Modern UI framework
- **Vanilla JS**: No build step required
- **Claude AI**: Anthropic's language model for styling
- **Open-Meteo API**: Weather data
- **Service Workers**: Offline functionality

### Browser Compatibility
- ✅ Chrome/Edge (recommended)
- ✅ Safari (iOS/macOS)
- ✅ Firefox
- ✅ All modern mobile browsers

### Data Storage
- Uses browser localStorage
- Typical size: ~1-5MB depending on collection
- No server-side storage – your data stays private

## 📱 Progressive Web App Features

- **Offline Mode**: Browse collection and create outfits without internet
- **Home Screen Icon**: Install like a native app
- **Fast Loading**: Service worker caching
- **Responsive Design**: Works on phone, tablet, desktop
- **No Installation Required**: Just visit the URL

## 🤝 Contributing

This is a personal project, but feedback and suggestions are welcome! 

## 📄 License

All rights reserved. Personal use only.

## 🙏 Acknowledgments

- Weather data powered by [Open-Meteo](https://open-meteo.com/)
- AI insights powered by [Anthropic Claude](https://www.anthropic.com/)
- Built for watch enthusiasts, by watch enthusiasts

---

**Happy coordinating! May your watches always match your fits. ⌚✨**
