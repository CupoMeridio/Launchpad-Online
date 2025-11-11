# Launchpad Online

A Progressive Web App (PWA) that transforms your browser into a playable launchpad. This project aims to be a simplified alternative to complex software like Ableton, which, while comprehensive, can be overwhelming for newcomers due to its broad range of functionalities not specific to launchpads. The goal is to provide an intuitive and accessible tool specifically designed for launchpad enthusiasts, making music creation fun and immediate for everyone.

## 🚀 Features

- **Interactive Launchpad Interface**: 8x8 grid of playable pads with visual feedback
- **Multi-page Support**: 8 different pages with up to 64 sounds each (512 total sounds)
- **MIDI Controller Support**: Full integration with Novation Launchpad and other MIDI controllers
- **Web Audio Engine**: Custom audio engine using Web Audio API for high-quality sound playback
- **Real-time Visualizer**: Audio visualization with frequency analysis
- **Progressive Web App**: Works offline and can be installed as a standalone app
- **Project Management**: Load and play pre-made projects with multiple sound sets
- **Responsive Design**: Works on desktop and mobile devices

## 🎵 Current Status

The project is currently in active development with the following achievements:

### ✅ Completed Features
- **Audio Engine**: Fully functional Web Audio API implementation with sound loading and playback
- **MIDI Integration**: Complete MIDI support using the `launchpad-webmidi` library
  - Automatic Launchpad detection and connection
  - Real-time MIDI input handling for both grid pads and control buttons
  - Visual connection status indicator
- **UI/UX**: Modern, responsive interface with interactive pads and menu system
- **PWA Functionality**: Service worker implementation for offline capability
- **Project Structure**: Modular architecture with separate concerns (audio, MIDI, interaction, app state)

### 🔄 In Development
- Additional visual effects and LED feedback for MIDI controllers
- Enhanced project creation and editing capabilities
- Sound library management
- Recording and playback functionality

## 🛠️ Technical Architecture

### Core Modules
- **Audio Engine** (`js/audio.js`): Web Audio API wrapper for sound management
- **MIDI Controller** (`js/midi.js`): MIDI device integration and event handling
- **Interaction Handler** (`js/interaction.js`): User input processing and pad triggering
- **Application State** (`js/app.js`): Global state management and initialization

### Dependencies
- **launchpad-webmidi**: Modern MIDI controller library for Launchpad integration
- **Web Audio API**: Native browser audio processing
- **Service Worker**: PWA functionality and offline support

## 🎯 Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/Launchpad-Online.git
   cd Launchpad-Online
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run locally**
   ```bash
   # Use any static file server
   npx http-server
   # or
   py -m http.server 8000
   ```

4. **Open in browser**
   Navigate to `http://localhost:8000` and start playing!

## 🎹 MIDI Controller Setup

The app automatically detects compatible MIDI controllers. For optimal experience:
- Connect your Novation Launchpad before opening the app
- The connection status will appear in the MIDI menu
- All 64 grid pads and control buttons are fully mapped

## 📱 PWA Installation

While optional, installing the app as a PWA provides a native-like experience. You can also use the app directly from your browser without installation.

1. Open the app in a **Chrome** browser. While other Chromium-based browsers might support PWA installation, Chrome is recommended. Firefox compatibility is not guaranteed, and Safari is currently not supported due to missing library support.
2. Look for the "Install" button in the address bar
3. Follow the prompts to install as a standalone app
4. Launch from your device's app drawer for a native-like experience

## 🎼 Project Structure

```
Launchpad-Online/
├── js/
│   ├── app.js              # Main application logic
│   ├── audio.js            # Audio engine implementation
│   ├── midi.js             # MIDI controller integration
│   ├── interaction.js      # User interaction handling
│   └── vendor/             # Third-party libraries
├── assets/                 # Sound files and images
├── sw.js                   # Service worker
├── index.html              # Main application HTML
├── manifest.json           # PWA manifest
└── package.json            # Node.js dependencies
```

## 🤝 Contributing

This project is open for contributions! Areas where help is welcome:
- Additional MIDI controller support
- Sound effects and audio processing
- Visual enhancements and animations
- Project sharing and collaboration features
- Documentation improvements

## 🙏 Acknowledgments

Inspired by:
- **Super Pads Lights DJ Launchpad**: An application for Android and iOS <mcurl name="Super Pads Lights DJ Launchpad" url="https://play.google.com/store/apps/details?id=com.opalastudios.superlaunchpad&hl=en&pli=1"></mcurl>
- **Unipad**: A program available for both desktop and mobile devices
- **Websites like launchpad.digitalraven.studio**: <mcurl name="launchpad.digitalraven.studio" url="https://launchpad.digitalraven.studio/"></mcurl>
- **And intro.novationmusic.com/viral-hiphop**: <mcurl name="intro.novationmusic.com/viral-hiphop" url="https://intro.novationmusic.com/viral-hiphop"></mcurl>

Special thanks to the Web Audio API and Web MIDI API communities for making browser-based music creation possible.
