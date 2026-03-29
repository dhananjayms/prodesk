# Application Icons

This folder should contain the following icon files:

| File       | Format | Required For | Notes                              |
|------------|--------|--------------|------------------------------------|
| icon.png   | PNG    | Linux        | 512x512 minimum                    |
| icon.ico   | ICO    | Windows      | Multi-size (16, 32, 48, 64, 256)   |
| icon.icns  | ICNS   | macOS        | Multi-size Apple icon format        |

## Generating Icons

Start with a single **1024x1024 PNG** source image, then use `electron-icon-builder` to generate all formats:

```bash
# Install the tool
npm install -g electron-icon-builder

# Generate all icon formats from a single source PNG
npx electron-icon-builder --input=icon-source.png --output=./assets
```

Alternatively, you can use the `icns-and-ico` package:

```bash
npx icns-and-ico icon-source.png --out ./assets
```

Replace the placeholder files below with the generated output before building.
