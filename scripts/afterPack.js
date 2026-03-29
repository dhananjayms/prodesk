const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses');
const path = require('path');
const fs = require('fs');

module.exports = async function afterPack(context) {
  const ext = {
    darwin: '.app',
    win32: '.exe',
    linux: '',
  }[context.electronPlatformName] || '';

  // On Linux the executable name is the package name (lowercase, hyphenated),
  // not the productName. Use executableName from the packager for accuracy.
  let executableName;
  if (context.electronPlatformName === 'linux') {
    executableName = context.packager.executableName;
  } else {
    executableName = context.packager.appInfo.productFilename + ext;
  }
  const electronBinaryPath = path.join(context.appOutDir, executableName);

  console.log(`Flipping Electron fuses on: ${electronBinaryPath}`);

  await flipFuses(electronBinaryPath, {
    version: FuseVersion.V1,
    // Prevent using the binary as a Node.js runtime (ELECTRON_RUN_AS_NODE)
    [FuseV1Options.RunAsNode]: false,
    // Encrypt cookies stored on disk
    [FuseV1Options.EnableCookieEncryption]: true,
    // Block NODE_OPTIONS environment variable
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    // Block --inspect and --inspect-brk debug flags
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    // Validate ASAR archive integrity at load time
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    // Only allow loading the app from an ASAR archive (prevent unpacked tampering)
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
  });

  // Restore original index.html after build
  const srcDir = path.join(__dirname, '..');
  const devHtml = path.join(srcDir, 'index.html.dev');
  if (fs.existsSync(devHtml)) {
    fs.copyFileSync(devHtml, path.join(srcDir, 'index.html'));
    fs.unlinkSync(devHtml);
    fs.unlinkSync(path.join(srcDir, 'index.html.prod'));
    console.log('Restored dev index.html');
  }
};
