# ProDesk

A native desktop application that wraps **Zoho Sheet**, **Zoho Writer**, and **Zoho Show** into a single Electron window. Open office files directly from your desktop and they'll launch in the appropriate Zoho editor.

## Prerequisites

- **Node.js** 20 or later
- **Git**

## Setup

```bash
git clone https://github.com/your-username/prodesk.git
cd prodesk
npm install
npm start
```

## Building

Build platform-specific installers using electron-builder:

```bash
# Windows (NSIS installer + portable EXE)
npm run build:win

# macOS (DMG — universal x64 + arm64)
npm run build:mac

# Linux (AppImage, .deb, .rpm)
npm run build:linux
```

Built artifacts are written to the `dist/` folder.

## Generating Icons

Place a 1024x1024 PNG source image in the project root, then run:

```bash
npx electron-icon-builder --input=icon-source.png --output=./assets
```

This generates `icon.png`, `icon.ico`, and `icon.icns` in the `assets/` folder. Replace the placeholder files before building.

## Releasing

The GitHub Actions workflow automatically builds and creates a release when you push a version tag:

```bash
git tag v1.0.0
git push --tags
```

This triggers three parallel CI jobs (Windows, macOS, Linux) that build the installers and attach them to a GitHub Release.

## File Associations

Once installed, the app registers itself as a handler for common office file types. Double-clicking any of these files will open them in ProDesk:

| Extensions               | Opens In     |
|--------------------------|--------------|
| .xlsx, .xls, .xlsm, .csv | Zoho Sheet   |
| .docx, .doc, .odt, .rtf  | Zoho Writer  |
| .pptx, .ppt, .odp        | Zoho Show    |

### How It Works Per Platform

**Windows** — The NSIS installer writes registry entries that associate each extension with ProDesk. Each extension gets a ProgId (e.g. `ProDesk.xlsx`) and the `"open"` verb is registered so double-clicking runs `ProDesk.exe "%1"`. The file path arrives in `process.argv`. The `perMachine` option is set to `false` so no admin rights are needed.

**macOS** — electron-builder generates `Info.plist` entries from the `fileAssociations` and `extendInfo.CFBundleDocumentTypes` config. macOS delivers the file path exclusively through the `app.on('open-file')` event, which fires both before and after `app.ready`. The app handles both cases.

**Linux** — electron-builder generates a `.desktop` file with `MimeType=` entries for all supported MIME types. After installing the `.deb` or `.rpm`, the desktop database is updated. You may need to manually set the default with `xdg-mime` (see Testing section below). The file path arrives in `process.argv`, same as Windows.

### "Open With" Context Menu

After installation, all three platforms show "Open with ProDesk" when right-clicking supported files:
- **Windows**: Automatic via NSIS registry entries
- **macOS**: Automatic via Info.plist / CFBundleDocumentTypes
- **Linux**: Requires the `.desktop` file to be installed properly (handled by `.deb`/`.rpm`)

### Portable Version (Windows)

The portable `.exe` cannot register file associations since it has no installer. On first launch it shows an informational message. Files can still be opened via File > Open or drag-and-drop.

## Persistent Preferences

The app uses `electron-store` to remember:
- **Window size & position** — restored on next launch
- **Last active tab** — Sheet, Writer, or Show
- **First-launch state** — default-app prompt shown only once

## Testing File Associations

### Windows

1. `npm run build:win`
2. Run the NSIS installer (`.exe` in `dist/`)
3. Right-click any `.xlsx` file → **Open with** → **ProDesk**
4. Or double-click an `.xlsx` — the app should launch and load the file
5. Test with `.docx` (Writer) and `.pptx` (Show) as well

### macOS

1. `npm run build:mac`
2. Open the `.dmg`, drag **ProDesk** to Applications
3. If Gatekeeper blocks it: `xattr -cr "/Applications/ProDesk.app"`
4. Right-click any `.xlsx` → **Open With** → **ProDesk**
5. Or double-click — the file path arrives via `open-file` event

### Linux

1. `npm run build:linux`
2. Install the `.deb`:
   ```bash
   sudo dpkg -i dist/prodesk_1.0.0_amd64.deb
   ```
3. Set as default for spreadsheets:
   ```bash
   xdg-mime default prodesk.desktop application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
   ```
4. Set as default for documents:
   ```bash
   xdg-mime default prodesk.desktop application/vnd.openxmlformats-officedocument.wordprocessingml.document
   ```
5. Set as default for presentations:
   ```bash
   xdg-mime default prodesk.desktop application/vnd.openxmlformats-officedocument.presentationml.presentation
   ```
6. Double-click an `.xlsx` file — the app should launch and load it

## GitHub Actions CI/CD

The workflow at `.github/workflows/build.yml` runs on every tag push matching `v*`:

1. **build-mac** — builds on `macos-latest`, uploads `.dmg`
2. **build-win** — builds on `windows-latest`, uploads `.exe`
3. **build-linux** — builds on `ubuntu-latest`, uploads `.AppImage`, `.deb`, `.rpm`
4. **release** — downloads all artifacts and creates a GitHub Release with all files attached

## Code Signing

For production releases you should sign your builds:

### Windows

Set the following environment variables (or GitHub Actions secrets):

- `CSC_LINK` — path or URL to your `.pfx` code signing certificate
- `CSC_KEY_PASSWORD` — certificate password
- Use an **EV (Extended Validation)** certificate to avoid SmartScreen warnings

### macOS

Set the following environment variables:

- `CSC_LINK` — path or base64 of your `.p12` Apple Developer certificate
- `CSC_KEY_PASSWORD` — certificate password
- `APPLE_ID` — your Apple ID email
- `APPLE_APP_SPECIFIC_PASSWORD` — app-specific password for notarization
- `APPLE_TEAM_ID` — your Apple Developer Team ID

## Folder Structure

```
prodesk/
├── .github/
│   └── workflows/
│       └── build.yml          # CI/CD pipeline
├── assets/
│   ├── icon.icns              # macOS icon
│   ├── icon.ico               # Windows icon
│   ├── icon.png               # Linux icon
│   └── README.md              # Icon generation instructions
├── dist/                      # Build output (gitignored)
├── index.html                 # Renderer — UI, tabs, webviews
├── main.js                    # Main process — window, menus, IPC, file handling
├── package.json               # Dependencies & electron-builder config
├── preload.js                 # Context bridge for IPC
└── README.md                  # This file
```

## License

MIT
