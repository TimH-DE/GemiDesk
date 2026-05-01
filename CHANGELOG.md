# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-05-02

### Added
- **Data Management:** Added a new "Data" tab in settings allowing users to clear app cache/data or perform a full logout (clearing Google sessions).
- **Intelligent Gem ID Detection:** Improved Gem ID discovery by scraping the page HTML when IDs are missing from URLs, ensuring seamless transitions between standard and Gem chats.
- **Session Persistence:** Gem IDs are now persisted in `localStorage`, preventing "Gem deleted" errors and broken links across sessions.
- **Improved Chat Sorting:** Implemented a "bump" mechanism that ensures the currently active chat is always visible at the top of the unpinned list in the sidebar.
- **Performance Improvements:** Significantly reduced background CPU usage by optimizing interval timers, refining mutation observers, preventing heavy DOM queries on `document.body`, and throttling the hidden background scraper view. Ideal for low-power modes.

### Fixed
- **Gem URL Resolution:** Gem chats are now proactively identified and parsed from the initial DOM load. Links are translated instantly without waiting for user interaction or error pages.
- **Chat Order Stability:** Fixed a bug where opening a Gem chat would reorder the global chat history by overriding it with the Gem-specific sidebar list.
- **Data Cleanup & Synchronization:** The global chat history is now selectively cleared on app startup (while preserving pinned chats and folder contents) to stay perfectly in sync with the live webview and resolve infinite loading loops.
- **Pinning & Unpinning Chats:** Fixed the logic for pinning/unpinning chats to correctly forward events to the Gemini wrapper and optimistically update the sidebar UI in real-time.

## [1.0.0] - 2026-04-26

### Added
- **Initial Release of GemiDesk!** 🎉
- **Professional Folder Management:** Enhanced folders with collapsible sections, animated chevrons, and smooth transitions.
- **Subfolders & Nesting:** Full support for nested folder structures with recursive rendering in the sidebar and settings.
- **Folder Reordering:** Added the ability to manually sort folders via Up/Down controls in the settings.
- **Folder Pagination:** Added internal pagination for folders with "Load more" functionality and configurable limits in settings.
- **Persistence:** Folder expansion states, nesting, and custom ordering are now persistent across app restarts.
- **Tabbed Interface:** Support for multiple simultaneous Gemini chats.
- **Smart Folders:** Organize chats into logical categories like 'Projects'.
- **PDF Export:** Export any conversation to a clean PDF format.
- **AI Prompt Enhancer:** Integrated logic to refine and improve user prompts via API.
- **Custom UI Injection:** Deep CSS/JS injection to provide a native-feeling dark mode experience.
- **Nix Flakes Integration:** Full support for reproducible builds and developer shells.
- **Desktop Integration:** Custom application icons and desktop menu entries.
- **Developer Mode:** Added a toggle in settings to inspect Gemini's DOM via native Electron DevTools.
- **Gemini Gems Support:** Integrated navigation, synchronization, and dynamic icon logic for specialized AI personas.

---

[1.0.0]: https://github.com/TimH-DE/GemiDesk/releases/tag/v1.0.0
[1.1.0]: https://github.com/TimH-DE/GemiDesk/releases/tag/v1.1.0
