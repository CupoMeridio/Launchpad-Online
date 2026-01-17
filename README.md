# Launchpad Online

A Progressive Web App (PWA) that transforms your browser into a playable launchpad.
This project aims to be a simplified alternative to complex software like Ableton, which, while comprehensive, can be overwhelming for newcomers due to its broad range of functionalities not specific to launchpads. The goal is to provide an intuitive and accessible tool specifically designed for launchpad enthusiasts, making music creation fun and immediate for everyone.

## Features

- **High-Performance Interface**: Interactive 8x8 grid with optimized visual feedback and low-latency response.
- **Advanced Animation Engine**: Custom-built lighting system with complex geometric patterns and color transitions.
- **Multi-page Architecture**: Support for 8 independent pages, enabling a total of 512 assignable sounds.
- **Deep Personalization**: Comprehensive UI customization engine including:
  - **Skins & Backgrounds**: Modular system for applying custom visual themes and backgrounds to the digital interface.
  - **Layout Control**: Real-time adjustment of Launchpad rotation and scaling for ergonomic playability.
  - **Visual Overlays**: Toggleable "stickers" and decorative elements to mimic physical hardware aesthetics.
- **Hardware Integration**: Comprehensive MIDI support for Novation Launchpad and compatible controllers.
- **Web Audio Core**: Professional-grade audio engine leveraging the Web Audio API for high-fidelity playback.
- **Real-time Analysis**: Integrated audio visualization and frequency spectrum analysis.
- **PWA Capabilities**: Full offline functionality and standalone installation support.
- **Project Management**: Robust system for loading, managing, and performing with pre-configured sound sets.

## Current Technical Progress

The project is under active development, focusing on expanding the visual capabilities and refining the hardware integration.

### Core Implementation
- **Lighting System (`js/lights.js`)**: A sophisticated animation registry that manages real-time LED feedback on physical hardware.
  - **Geometric Patterns**: Cross, Expand, circular Wave, and Diagonal sweep animations.
  - **Dynamic Transitions**: Implementation of multi-phase color fading (e.g., Red → Amber → Green).
  - **Directional Logic**: Support for directional variants (Top, Bottom, Left, Right) and Corner-based triggers.
  - **Reverse Propagation**: Converging animation variants for enhanced visual depth.
- **MIDI Integration (`js/midi.js`)**: Robust communication layer using the [`launchpad-webmidi`](https://github.com/LostInBrittany/launchpad-webmidi) library.
  - Automatic device handshake and synchronization.
  - Support for momentary and fixed animation types.
- **Audio Architecture (`js/audio.js`)**: Modular engine for sound asset management and playback optimization.

### Technical Architecture

- **Audio Engine**: Web Audio API wrapper for sound management.
- **MIDI Controller**: Integration layer for MIDI device communication.
- **Interaction Handler**: Event processing for both virtual and physical inputs.
- **Animation Factory**: Scalable system for generating color and directional variants of lighting effects.

## Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/Launchpad-Online.git
   cd Launchpad-Online
   ```

2. **Development Environment**
   This project is a static web application and requires a local server for proper functionality (especially for PWA and MIDI features):
   - **Live Server (Recommended)**: If using VS Code, install the "Live Server" extension and click "Go Live" to start the application.
   - **Manual Server**: Alternatively, use any static file server:
     ```bash
     npx http-server
     ```

3. **Access the Application**
   Navigate to the local address provided by your server (typically `http://localhost:5500` for Live Server or `http://localhost:8080` for http-server).

## Deployment

The application is architected as a static site, making it compatible with modern hosting workflows:
- **Current Development**: Testing is performed locally via development servers to ensure low-latency MIDI and Audio API performance.
- **Future Hosting**: The project is planned for deployment on high-availability static hosting platforms such as **Netlify**, **Vercel**, or **GitHub Pages**. This will allow for public access and automatic PWA updates.

## Hardware Setup

The application automatically initializes compatible MIDI controllers upon connection. For the best performance:
- Connect the MIDI hardware prior to launching the application.
- Verify connection status in the MIDI configuration menu.
- All 64 pads and peripheral control buttons are pre-mapped for immediate use.

## Project Structure

```
Launchpad-Online/
├── assets/                 # Multimedia resources
│   ├── icons/              # App icons and favicons
│   ├── images/             # UI elements (covers, skins)
│   └── samples/            # Audio project files (wav/mp3)
├── css/                    # Stylesheets
│   ├── launchpad.css       # Grid and hardware-specific styles
│   └── style.css           # Global application styles
├── js/                     # Application logic
│   ├── vendor/             # External libraries (WebMIDI)
│   ├── app.js              # Entry point and initialization
│   ├── audio.js            # Web Audio API engine
│   ├── interaction.js      # Input event orchestration
│   ├── lights.js           # Animation registry and logic
│   ├── midi.js             # MIDI protocol handler
│   ├── physicalInterface.js# Hardware output management
│   ├── project.js          # Project loading and state
│   ├── ui.js               # Interface controls and sync
│   ├── video.js            # Background video and effects
│   ├── visualizer.js       # Canvas-based spectrum analysis
│   ├── visualizer-controls.js# Visualizer settings management
│   └── webInterface.js     # Digital grid feedback
├── projects/               # Pre-defined project configurations (JSON)
├── index.html              # Main application entry
├── manifest.json           # PWA configuration
├── sw.js                   # Service Worker for offline support
└── README.md               # Project documentation
```

## Contributing

Contributions focusing on the following areas are welcome:
- Expansion of MIDI controller compatibility profiles.
- Advanced audio processing and real-time effects.
- New algorithmic lighting patterns.
- Documentation and architectural refinements.

## Acknowledgments

This project is made possible by the Web Audio and Web MIDI API standards. Special thanks to the communities supporting browser-based music technology.
