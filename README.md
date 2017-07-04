# CFO

CFO is a traditional two-pane file manager. It is aimed at power users, built to be controlled (almost exlusively) with keyboard shortcuts (most notably F-keys).

CFO shall become a modernized version of [Fire Commander](https://addons.mozilla.org/en-us/firefox/addon/fire-commander/). Fire Commander is built using XUL/XPCOM, a tech stack that is becoming obsolete. Electron-based CFO will continue its mission.

## Feature + Task list

- Directory listing
  - [X] Tabs
  - [X] Statusbar
  - [ ] Filetype/symlink icons
  - [X] Quick search
  - [X] Fast rename
- File operations
  - [X] Create file/directory
  - [X] Scan
  - [X] Delete
  - [X] Copy
  - [X] Move
  - [ ] Search
- Viewers
  - [ ] Image
  - [ ] Text
  - [ ] Audio
  - [ ] Video
- File systems
  - [X] Local
  - [ ] ZIP
  - [ ] ISO 9660
  - [ ] Windows drives
  - [X] Favorites
  - [ ] SQLite
  - [ ] Wifi?
- Miscellaneous
  - [X] Menu
  - [X] No toolbar
  - [ ] Configuration
  - [X] Persistence
  - [ ] Selection
  - [ ] Clipboard support
  - [ ] Logo / App icon

## Running

```bash
$ npm install
$ npm start
```

## Building

```bash
$ npm install
$ make
```

## Contributing

This project is looking for contributors. Please open an issue describing your intentions before working on a PR.
