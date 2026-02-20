# Launchpad Online

[![PWA](https://img.shields.io/badge/PWA-Ready-brightgreen.svg)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
[![Web MIDI](https://img.shields.io/badge/Web_MIDI-Supported-blue.svg)](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API)
[![Web Audio](https://img.shields.io/badge/Web_Audio-API-orange.svg)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)

**Launchpad Online** is a Progressive Web App (PWA) designed for performing with Novation Launchpad controllers. It provides both a virtual emulator and hardware integration, supported by a built-in project library.

The project serves as a specialized alternative to Ableton Live, focusing exclusively on Launchpad performance and project playback. Unlike a full Digital Audio Workstation (DAW), this application is dedicated to the core functionalities required for playing and managing Launchpad-specific projects.

## Demo & Media

### Video Presentation
*Coming Soon*
<!-- [![Video Demo](https://img.shields.io/badge/Video-Watch_the_Demo-red?style=for-the-badge&logo=youtube)](YOUR_VIDEO_LINK) -->

### Screenshots
*Coming Soon*
<!-- 
| Main Interface | Customization |
| :---: | :---: |
| ![Main UI](https://via.placeholder.com/400x225?text=Main+UI+Screenshot) | ![Customization](https://via.placeholder.com/400x225?text=Customization+Screenshot) |
| *8x8 grid with real-time visual feedback* | *Skin and layout customization menu* | 
-->

---

## Key Features

- **Modular Animation Engine**: Lighting system with over 30 animation types.
- **Hardware Integration**: Support for Novation Launchpad and compatible controllers via Web MIDI API.
- **Audio Core & Visualizer**: 
  - Audio engine based on Web Audio API for sample playback.
  - Real-time audio visualizer with customizable rendering options.
- **Customization & Aesthetics**:
  - **Launchpad Skins**: Change the appearance of the digital controller, including support for button stickers/decals.
  - **Dynamic Backgrounds**: Decorative background images and video loops to enhance performance videos.
  - **Layout Control**: Rotation and scalability settings for optimal visuals.
- **PWA Ready**: Installable as a native app on desktop and mobile, with offline support.
- **Project Management**: Project loading via JSON files with support for up to 8 pages (512 total sounds).
- **Built-in Project Library**: Access a growing collection of pre-configured projects ready to be played immediately.

---

## Roadmap & Future Ideas

Planned features for future development:

- **Multisampling Support**: Ability to assign multiple audio samples to a single button (e.g., for velocity layering or round-robin).
- **In-App Project Creator**: Integrated tool to build and configure projects directly within the application without manual JSON editing.
- **In-App Animation Designer**: Visual interface to create and customize lighting patterns and animations.
- **Project Library Expansion**: Continuous addition of ready-to-play projects to the built-in library.
- **Performance Optimization**: Continuous research into app optimization to ensure lightweight and fast execution across browsers and the widest possible range of devices.
- **Asset Compression & Memory Management**: Implementation of methods to reduce or compress the size of video and audio assets (currently .mp4 and .wav) to make the app lighter and less memory-intensive.
- **Localization & Multi-language Support**: Implement translations for as many languages as possible to make the application accessible to a global audience.

---

## Getting Started

### Online Access
The easiest way to use the application is via the live demo:
**[https://cupomeridio.github.io/Launchpad-Online/](https://cupomeridio.github.io/Launchpad-Online/)**

*The online version is updated automatically and supports PWA installation directly from the browser.*

### Local Installation (Alternative)
If you wish to run the project locally or contribute to development:

1. **Prerequisites**: A modern browser with Web MIDI and Web Audio support (Chrome, Edge, Opera).
2. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/Launchpad-Online.git
   cd Launchpad-Online
   ```
3. **Start a local server**: A static server is required for MIDI and PWA features.
   - **VS Code**: Use the **Live Server** extension.
   - **Terminal**: Run `npx http-server`.

---

## Project Structure

```text
Launchpad-Online/
├── assets/                 # Media resources
│   ├── icons/              # App icons and favicons
│   ├── images/             # UI images and launchpad covers
│   └── videos/             # Background video loops
├── css/                    # Application styling
│   ├── launchpad.css       # Launchpad-specific styles
│   └── style.css           # General application styles
├── js/                     # Application logic
│   ├── vendor/             # Third-party libraries
│   │   └── launchpad-webmidi.js
│   ├── animationClasses.js # Animation class definitions
│   ├── animationData.js    # Animation data and structures
│   ├── animationEngine.js  # Core animation rendering engine
│   ├── animationLibrary.js # Registry of available animations
│   ├── app.js              # Main application entry point
│   ├── audio.js            # Web Audio API engine
│   ├── interaction.js      # User interaction handling
│   ├── lights.js           # Legacy light management (refactored)
│   ├── midi.js             # MIDI hardware integration
│   ├── physicalInterface.js # Physical Launchpad mapping
│   ├── project.js          # Project and page management
│   ├── static-data.json    # Static configuration data
│   ├── ui.js               # UI components and DOM management
│   ├── video.js            # Video background controller
│   ├── visualizer-controls.js # Visualizer UI controls
│   ├── visualizer.js       # Audio visualizer logic
│   └── webInterface.js     # Virtual Launchpad interface
├── locales/                # Internationalization (i18n)
│   ├── de.json
│   ├── en.json
│   ├── es.json
│   ├── fr.json
│   └── it.json
├── projects/               # Performance projects (JSON + Samples)
│   └── [Project Name]/
├── index.html              # Main HTML entry point
├── manifest.json           # PWA manifest
├── package.json            # NPM configuration
└── README.md               # Project documentation
```

---

## Contributing

Contributions are welcome. If you have proposals for new animations, interface improvements, or compatibility profiles for new MIDI controllers:

1. Fork the project.
2. Create a branch for your change (`git checkout -b feature/NewFeature`).
3. Commit your changes (`git commit -m 'Add NewFeature'`).
4. Push to the branch (`git push origin feature/NewFeature`).
5. Open a Pull Request.

---

## License

Distributed under the MIT License. See `LICENSE` for more information.

---

## Acknowledgments

- [LostInBrittany/launchpad-webmidi](https://github.com/LostInBrittany/launchpad-webmidi) for the base library.
- All contributors and electronic music enthusiasts.

---
*Developed for the Launchpad community.*
