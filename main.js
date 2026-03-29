const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');

// ── Linux sandbox fallback ────────────────────────────────────────────────────
// Only disable sandbox when the SUID helper is missing (dev / AppImage).
// Installed .deb/.rpm packages have the SUID bit set by the package manager.
if (process.platform === 'linux') {
  const sandboxPath = path.join(path.dirname(process.execPath), 'chrome-sandbox');
  try {
    const stat = fs.statSync(sandboxPath);
    const hasSuid = (stat.mode & 0o4000) !== 0;
    if (!hasSuid) {
      app.commandLine.appendSwitch('no-sandbox');
    }
  } catch {
    // chrome-sandbox binary missing — disable sandbox
    app.commandLine.appendSwitch('no-sandbox');
  }
  app.commandLine.appendSwitch('disable-dev-shm-usage');
}

// ── Persistent preferences (encrypted at rest) ───────────────────────────────
const store = new Store({
  encryptionKey: 'zw-k8x2m9v4q7p1',
  defaults: {
    firstLaunch: true,
    defaultAppPromptShown: false,
    lastActiveTab: 'sheet',
    windowBounds: { width: 1400, height: 900, x: undefined, y: undefined },
  },
});

// ── Security: validate Zoho URLs ──────────────────────────────────────────────
function isZohoUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('.zoho.com');
  } catch {
    return false;
  }
}

// ── Extension → Zoho app mapping ──────────────────────────────────────────────
const EXTENSION_TO_APP = {
  '.xlsx': 'sheet', '.xls': 'sheet', '.xlsm': 'sheet', '.xlsb': 'sheet',
  '.xltx': 'sheet', '.xltm': 'sheet', '.xlt': 'sheet',
  '.csv': 'sheet', '.tsv': 'sheet', '.txt': 'sheet',
  '.xml': 'sheet', '.xla': 'sheet', '.xlam': 'sheet',
  '.ods': 'sheet', '.fods': 'sheet', '.sxc': 'sheet',
  '.dif': 'sheet', '.slk': 'sheet', '.prn': 'sheet',
  '.docx': 'writer', '.doc': 'writer', '.docm': 'writer',
  '.dotx': 'writer', '.dotm': 'writer', '.dot': 'writer',
  '.odt': 'writer', '.fodt': 'writer', '.sxw': 'writer',
  '.rtf': 'writer', '.wps': 'writer', '.wpd': 'writer',
  '.pptx': 'show', '.ppt': 'show', '.pptm': 'show',
  '.potx': 'show', '.potm': 'show', '.pot': 'show',
  '.ppsx': 'show', '.pps': 'show', '.ppsm': 'show',
  '.odp': 'show', '.fodp': 'show', '.sxi': 'show',
};

const SUPPORTED_EXTENSIONS = Object.keys(EXTENSION_TO_APP).map(e => e.slice(1));

const SHEET_EXTENSIONS = ['xlsx', 'xls', 'xlsm', 'xlsb', 'xltx', 'xltm', 'xlt', 'csv', 'tsv', 'txt', 'xml', 'xla', 'xlam', 'ods', 'fods', 'sxc', 'dif', 'slk', 'prn'];
const WRITER_EXTENSIONS = ['docx', 'doc', 'docm', 'dotx', 'dotm', 'dot', 'odt', 'fodt', 'sxw', 'rtf', 'wps', 'wpd'];
const SHOW_EXTENSIONS = ['pptx', 'ppt', 'pptm', 'potx', 'potm', 'pot', 'ppsx', 'pps', 'ppsm', 'odp', 'fodp', 'sxi'];

const FILE_FILTERS = [
  { name: 'All Supported', extensions: SUPPORTED_EXTENSIONS },
  { name: 'Spreadsheets', extensions: SHEET_EXTENSIONS },
  { name: 'Documents', extensions: WRITER_EXTENSIONS },
  { name: 'Presentations', extensions: SHOW_EXTENSIONS },
];

// ── Extension → MIME type mapping ─────────────────────────────────────────────
const MIME_TYPES = {
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.xlsm': 'application/vnd.ms-excel.sheet.macroEnabled.12',
  '.xlsb': 'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
  '.xltx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
  '.xltm': 'application/vnd.ms-excel.template.macroEnabled.12',
  '.xlt': 'application/vnd.ms-excel',
  '.csv': 'text/csv',
  '.tsv': 'text/tab-separated-values',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
  '.xla': 'application/vnd.ms-excel',
  '.xlam': 'application/vnd.ms-excel.addin.macroEnabled.12',
  '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
  '.fods': 'application/vnd.oasis.opendocument.spreadsheet',
  '.sxc': 'application/vnd.sun.xml.calc',
  '.dif': 'text/plain',
  '.slk': 'text/plain',
  '.prn': 'text/plain',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
  '.docm': 'application/vnd.ms-word.document.macroEnabled.12',
  '.dotx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
  '.dotm': 'application/vnd.ms-word.template.macroEnabled.12',
  '.dot': 'application/msword',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.fodt': 'application/vnd.oasis.opendocument.text',
  '.sxw': 'application/vnd.sun.xml.writer',
  '.rtf': 'application/rtf',
  '.wps': 'application/vnd.ms-works',
  '.wpd': 'application/vnd.wordperfect',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptm': 'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
  '.potx': 'application/vnd.openxmlformats-officedocument.presentationml.template',
  '.potm': 'application/vnd.ms-powerpoint.template.macroEnabled.12',
  '.pot': 'application/vnd.ms-powerpoint',
  '.ppsx': 'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
  '.pps': 'application/vnd.ms-powerpoint',
  '.ppsm': 'application/vnd.ms-powerpoint.slideshow.macroEnabled.12',
  '.odp': 'application/vnd.oasis.opendocument.presentation',
  '.fodp': 'application/vnd.oasis.opendocument.presentation',
  '.sxi': 'application/vnd.sun.xml.impress',
};

let mainWindow = null;
let pendingFilePath = null;
let saveBoundsTimer = null;

const isPortable = process.env.PORTABLE_EXECUTABLE_DIR !== undefined;

// ── Robust argv parser ────────────────────────────────────────────────────────
function getSupportedFileFromArgs(argv) {
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--') || arg.startsWith('-')) continue;
    if (arg.endsWith('.js') || arg.endsWith('.exe')) continue;

    const ext = path.extname(arg).toLowerCase();
    if (EXTENSION_TO_APP[ext]) {
      console.log(`[argv-parser] Found supported file: ${arg}`);
      return arg;
    }
  }
  console.log('[argv-parser] No supported file found in argv:', argv);
  return null;
}

// ── IPC sender validation ─────────────────────────────────────────────────────
function isValidSender(event) {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  try {
    return event.senderFrame.url.startsWith('file://');
  } catch {
    return false;
  }
}

// ── Single instance lock ──────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    const filePath = getSupportedFileFromArgs(argv);
    if (filePath) handleFile(filePath);
  });
}

// ── macOS open-file event ─────────────────────────────────────────────────────
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (mainWindow && mainWindow.webContents) {
    handleFile(filePath);
  } else {
    pendingFilePath = filePath;
  }
});

// ── App ready ─────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  buildAppMenu();

  const filePath = getSupportedFileFromArgs(process.argv);
  if (filePath) pendingFilePath = filePath;

  if (store.get('firstLaunch')) {
    store.set('firstLaunch', false);
    showFirstLaunchPrompt();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ── Create the main browser window ────────────────────────────────────────────
function createWindow() {
  const bounds = store.get('windowBounds');

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 1000,
    minHeight: 600,
    title: 'ProDesk',
    webPreferences: {
      preload: path.join(__dirname, app.isPackaged ? 'build' : '.', 'preload.js'),
      webviewTag: true,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      allowRunningInsecureContent: false,
      enableWebSQL: false,
    },
  });

  mainWindow.loadFile('index.html');

  // ── Security: restrict main window navigation to local files only ───
  mainWindow.webContents.on('will-navigate', (event, url) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'file:') {
        event.preventDefault();
      }
    } catch {
      event.preventDefault();
    }
  });

  // ── Security: block main window from opening new windows ────────────
  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  // ── Security: webview hardening ─────────────────────────────────────
  mainWindow.webContents.on('did-attach-webview', (_event, webviewContents) => {
    // Restrict webview navigation to Zoho domains only
    webviewContents.on('will-navigate', (event, url) => {
      if (!isZohoUrl(url)) {
        event.preventDefault();
      }
    });

    // Redirect new-window requests for Zoho URLs back into the webview
    webviewContents.setWindowOpenHandler(({ url }) => {
      if (isZohoUrl(url)) {
        webviewContents.loadURL(url);
      }
      return { action: 'deny' };
    });
  });

  // ── Security: deny all permission requests by default ───────────────
  const allowedPermissions = ['clipboard-read', 'clipboard-sanitized-write', 'notifications'];
  mainWindow.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(allowedPermissions.includes(permission));
  });
  mainWindow.webContents.session.setPermissionCheckHandler((_wc, permission) => {
    return allowedPermissions.includes(permission);
  });

  // ── Security: disable DevTools in production ────────────────────────
  if (app.isPackaged) {
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow.webContents.closeDevTools();
    });
  }

  // ── Security: CSP response headers (defense-in-depth) ──────────────
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.zoho.com; connect-src https://*.zoho.com; frame-src https://*.zoho.com;"
        ],
      },
    });
  });

  // Once the renderer page finishes loading, send any pending file
  mainWindow.webContents.on('did-finish-load', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send('restore-tab', store.get('lastActiveTab'));

    if (pendingFilePath) {
      handleFile(pendingFilePath);
      pendingFilePath = null;
    }
  });

  // Debounced save of window bounds
  const saveBounds = () => {
    if (saveBoundsTimer) clearTimeout(saveBoundsTimer);
    saveBoundsTimer = setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isMinimized() && !mainWindow.isMaximized()) {
        store.set('windowBounds', mainWindow.getBounds());
      }
      saveBoundsTimer = null;
    }, 500);
  };
  mainWindow.on('resize', saveBounds);
  mainWindow.on('move', saveBounds);

  mainWindow.on('closed', () => {
    if (saveBoundsTimer) {
      clearTimeout(saveBoundsTimer);
      saveBoundsTimer = null;
    }
    mainWindow = null;
  });
}

// ── First-launch prompt ───────────────────────────────────────────────────────
function showFirstLaunchPrompt() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  if (isPortable) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Portable Mode',
      message: 'You are running the portable version.',
      detail:
        'File associations (double-click to open) are only available with the installer version.\n\n' +
        'You can still open files via File > Open or by dragging them onto this window.',
    });
    store.set('defaultAppPromptShown', true);
    return;
  }

  if (store.get('defaultAppPromptShown')) return;
  store.set('defaultAppPromptShown', true);

  dialog
    .showMessageBox(mainWindow, {
      type: 'question',
      title: 'Default Application',
      message: 'Set ProDesk as your default app for spreadsheets, documents, and presentations?',
      buttons: ['Yes', 'Not Now'],
      defaultId: 0,
      cancelId: 1,
    })
    .then(({ response }) => {
      if (response === 0) showDefaultAppInstructions();
    });
}

function showDefaultAppInstructions() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const platform = process.platform;
  let detail = '';

  if (platform === 'win32') {
    detail =
      'The NSIS installer has already registered ProDesk for supported file types.\n\n' +
      'If it is not set as default, go to:\n' +
      'Settings > Apps > Default Apps > ProDesk';
  } else if (platform === 'darwin') {
    detail =
      'On macOS, open System Settings > General > Default Apps and choose ProDesk for the file types you want.';
  } else {
    detail =
      'Run the following command in a terminal for each MIME type you want to associate:\n\n' +
      'xdg-mime default prodesk.desktop application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\n' +
      'xdg-mime default prodesk.desktop application/vnd.openxmlformats-officedocument.wordprocessingml.document\n' +
      'xdg-mime default prodesk.desktop application/vnd.openxmlformats-officedocument.presentationml.presentation';
  }

  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Set as Default',
    message: 'How to set ProDesk as default',
    detail,
  });
}

// ── Read a file and send it to the renderer ───────────────────────────────────
async function handleFile(filePath) {
  try {
    // Security: resolve to absolute path and verify it exists
    const resolvedPath = path.resolve(filePath);
    const ext = path.extname(resolvedPath).toLowerCase();
    const zohoApp = EXTENSION_TO_APP[ext];
    if (!zohoApp) {
      dialog.showErrorBox('Unsupported File', `The file type "${ext}" is not supported.`);
      return;
    }

    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
    const fileName = path.basename(resolvedPath);

    const fileBuffer = await fs.promises.readFile(resolvedPath);
    const base64 = fileBuffer.toString('base64');

    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
      mainWindow.webContents.send('open-file', {
        app: zohoApp,
        fileName,
        base64,
        mimeType,
        filePath: resolvedPath,
      });
    }
  } catch (err) {
    dialog.showErrorBox('File Error', `Could not open file:\n${err.message}`);
  }
}

// ── IPC handlers (with sender validation) ─────────────────────────────────────

async function showOpenFileDialog() {
  if (!mainWindow || mainWindow.isDestroyed()) return false;

  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open File',
    filters: FILE_FILTERS,
    properties: ['openFile'],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    await handleFile(result.filePaths[0]);
    return true;
  }
  return false;
}

ipcMain.handle('open-file-dialog', (event) => {
  if (!isValidSender(event)) return false;
  return showOpenFileDialog();
});

ipcMain.handle('get-app-version', (event) => {
  if (!isValidSender(event)) return null;
  return app.getVersion();
});

ipcMain.on('save-active-tab', (event, tabName) => {
  if (!isValidSender(event)) return;
  if (['sheet', 'writer', 'show'].includes(tabName)) {
    store.set('lastActiveTab', tabName);
  }
});

// ── Application menu ──────────────────────────────────────────────────────────
function buildAppMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open File',
          accelerator: 'CmdOrCtrl+O',
          click: () => showOpenFileDialog(),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        // Reload only available in development
        ...(app.isPackaged ? [] : [{
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.reload();
          },
        }]),
        ...(app.isPackaged ? [] : [{ type: 'separator' }]),
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+=',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              const level = mainWindow.webContents.getZoomLevel();
              mainWindow.webContents.setZoomLevel(level + 0.5);
            }
          },
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              const level = mainWindow.webContents.getZoomLevel();
              mainWindow.webContents.setZoomLevel(level - 0.5);
            }
          },
        },
        {
          label: 'Reset Zoom',
          accelerator: 'CmdOrCtrl+0',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.setZoomLevel(0);
          },
        },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'togglefullscreen' },
        ...(isMac ? [{ type: 'separator' }, { role: 'front' }] : [{ role: 'close' }]),
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About ProDesk',
          click: () => {
            if (!mainWindow || mainWindow.isDestroyed()) return;
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About ProDesk',
              message: 'ProDesk',
              detail: `Version ${app.getVersion()}\n\nA desktop wrapper for Zoho Sheet, Zoho Writer, and Zoho Show.`,
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
