# Watch Advisor - Copilot Instructions

This is a Progressive Web App (PWA) for watch and outfit coordination built with React (CDN), vanilla JavaScript, and modern web APIs. The application helps users pair their watch collection with their wardrobe using AI-powered recommendations.

## Project Structure

- `index.html` - Single-page application containing all HTML, CSS, and JavaScript inline
- `sw.js` - Service Worker for offline functionality
- `manifest.json` - PWA manifest for mobile app installation
- `icon-192.png`, `icon-512.png` - Application icons
- `README.md` - Comprehensive documentation

## Technology Stack

- **Frontend**: React 18 (CDN-based, no build process)
- **Styling**: Inline CSS with CSS variables for theming
- **Storage**: Browser LocalStorage for all data persistence
- **APIs**: 
  - Claude AI (Anthropic) for outfit descriptions (optional, user-provided API key)
  - Open-Meteo Weather API for 7-day forecasts
- **PWA**: Service Worker for offline support, Web App Manifest

## Code Standards

### No Build Process
- This project intentionally has no build step, bundler, or transpilation
- All code must work directly in modern browsers
- Use React CDN (currently v18.2.0) and vanilla JavaScript
- Do not introduce npm, webpack, babel, or any build tools

### Code Style
- Use ES6+ features supported by modern browsers
- Minimize whitespace and use compact syntax (file is size-optimized)
- Follow existing inline variable naming conventions:
  - Short variable names for size optimization (e.g., `CM` = Color Map, `SK` = Storage Key)
  - Use descriptive names in functions when clarity is important
- CSS uses custom properties (CSS variables) for theming
- Animation keyframes are reused (`.fu`, `.sp`, `.pu` classes)

### Data Management
- All data stored in browser LocalStorage with version suffix (`SK` variable)
- No server-side storage or user accounts
- Export/import functionality for data backup
- Privacy-first approach: no data leaves the user's device (except API calls)

### React Patterns
- Functional components with hooks (useState, useEffect, useMemo, useCallback, memo)
- Components defined inline within the main script
- Event handlers use arrow functions
- State management through React hooks (no Redux or external state libraries)

### Key Features to Preserve
1. **Watch Collection**: Track watches with dial colors, materials, strap/bracelet info, contexts
2. **Wardrobe Management**: Photo upload with AI color/pattern detection
3. **Outfit Matching**: Algorithm scoring outfits based on color harmony, context, materials
4. **Weather Integration**: 7-day forecast affecting recommendations (rain = avoid leather straps)
5. **Rotation Tracking**: 28-day wear calendar
6. **Offline First**: Must work without internet after initial load

## Development Guidelines

### Testing Changes
- Since there's no build process, test by opening `index.html` in a browser
- Test on multiple browsers: Chrome, Safari, Firefox, Edge
- Verify mobile responsiveness (viewport meta tag, touch interactions)
- Test PWA functionality (offline mode, install to home screen)
- Validate LocalStorage persistence across sessions

### Making Changes
- **Keep the inline structure**: Do not split into separate files unless absolutely necessary
- **Minimize file size**: The app is optimized for fast loading
- **Preserve animations**: The app uses subtle animations for polish
- **Maintain touch interactions**: All interactive elements use touch-action and active states
- **Test mobile modals**: Modal system uses body scroll lock for mobile

### API Integration Notes
- Claude API key is optional and stored locally
- Weather API requires no authentication
- Always handle API failures gracefully
- Show loading states for async operations

### Accessibility
- Use semantic HTML where possible
- Maintain ARIA labels on interactive elements
- Ensure touch targets are at least 48x48px
- Test keyboard navigation where applicable

### Browser Compatibility
- Target modern browsers (last 2 versions of major browsers)
- Use feature detection for progressive enhancement
- Service Worker registration includes error handling

## Common Tasks

### Adding New Features
1. Keep all code inline in `index.html`
2. Use existing CSS variables and utility classes
3. Follow React functional component patterns
4. Store new data in LocalStorage with proper versioning
5. Update the `SK` version if data structure changes

### Updating Styles
- Modify CSS custom properties in `:root` for theme changes
- Use existing utility classes (`.chip`, `.btn`, `.modal-backdrop`, etc.)
- Keep animations performant (use transform and opacity)
- Test on mobile devices (viewport units, safe-area-inset)

### Modifying Algorithms
- Main scoring logic is in the outfit matching function
- Color harmony checks warm vs cool tones
- Material compatibility considers formality and weather
- Context scoring matches watch usage with occasion

## Important Notes

- **Do not** add package.json, node_modules, or any build configuration
- **Do not** split into multiple JavaScript files (defeats the no-build approach)
- **Do not** require server-side components (must remain client-only)
- **Do not** add external dependencies beyond existing CDN React
- **Do** maintain the single-file architecture for simplicity
- **Do** preserve the compact, size-optimized code style
- **Do** test on mobile devices (primary use case)
- **Do** ensure offline functionality continues to work

## Privacy & Security

- No user authentication or server storage
- API keys stored in LocalStorage (user's responsibility)
- No analytics or tracking
- All processing happens client-side
- Images processed via FileReader API (stay local)
