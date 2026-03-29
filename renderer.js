'use strict';

// ── Element references ──────────────────────────────────────────────
const tabs       = document.querySelectorAll('.tab');
const webviews   = document.querySelectorAll('webview');
const overlay    = document.getElementById('upload-overlay');
const overlayMsg = document.getElementById('upload-message');
const dropZone   = document.getElementById('drop-zone');
const openBtn    = document.getElementById('open-file-btn');

// ── Zoho import URLs ────────────────────────────────────────────────
const IMPORT_URLS = {
  sheet:  'https://sheet.zoho.com/sheet/import',
  writer: 'https://writer.zoho.com/writer/import',
  show:   'https://show.zoho.com/show/import',
};

// ── Pretty app names ────────────────────────────────────────────────
const APP_NAMES = {
  sheet:  'Sheet',
  writer: 'Writer',
  show:   'Show',
};

// ── Extension → app (for drag-and-drop) ─────────────────────────────
const EXT_TO_APP = {
  xlsx: 'sheet', xls: 'sheet', xlsm: 'sheet', xlsb: 'sheet',
  xltx: 'sheet', xltm: 'sheet', xlt: 'sheet',
  csv: 'sheet', tsv: 'sheet', txt: 'sheet',
  xml: 'sheet', xla: 'sheet', xlam: 'sheet',
  ods: 'sheet', fods: 'sheet', sxc: 'sheet',
  dif: 'sheet', slk: 'sheet', prn: 'sheet',
  docx: 'writer', doc: 'writer', docm: 'writer',
  dotx: 'writer', dotm: 'writer', dot: 'writer',
  odt: 'writer', fodt: 'writer', sxw: 'writer',
  rtf: 'writer', wps: 'writer', wpd: 'writer',
  pptx: 'show', ppt: 'show', pptm: 'show',
  potx: 'show', potm: 'show', pot: 'show',
  ppsx: 'show', pps: 'show', ppsm: 'show',
  odp: 'show', fodp: 'show', sxi: 'show',
};

// ── Tab switching ───────────────────────────────────────────────────
function switchTab(appName) {
  tabs.forEach(t => t.classList.toggle('active', t.dataset.app === appName));
  webviews.forEach(wv => wv.classList.toggle('active', wv.id === appName));
  window.electronAPI.saveActiveTab(appName);
}

tabs.forEach(tab => {
  tab.addEventListener('click', () => switchTab(tab.dataset.app));
});

// ── Restore last active tab on launch ───────────────────────────────
window.electronAPI.onRestoreTab((tabName) => {
  if (tabName && ['sheet', 'writer', 'show'].includes(tabName)) {
    switchTab(tabName);
  }
});

// ── Open file button ────────────────────────────────────────────────
openBtn.addEventListener('click', () => {
  window.electronAPI.openFileDialog();
});

// ── Show / hide overlay ─────────────────────────────────────────────
let overlayTimer = null;

function showOverlay(fileName, appName) {
  if (overlayTimer) {
    clearTimeout(overlayTimer);
    overlayTimer = null;
  }
  overlayMsg.textContent = `Opening ${fileName} in Zoho ${APP_NAMES[appName] || appName}...`;
  overlay.classList.add('visible');
}

function hideOverlay() {
  if (overlayTimer) {
    clearTimeout(overlayTimer);
    overlayTimer = null;
  }
  overlay.classList.remove('visible');
}

function hideOverlayAfterDelay(ms) {
  if (overlayTimer) clearTimeout(overlayTimer);
  overlayTimer = setTimeout(hideOverlay, ms);
}

// ── Handle incoming file from main process ──────────────────────────
window.electronAPI.onOpenFile((payload) => {
  try {
    const { app: zohoApp, fileName } = payload;

    switchTab(zohoApp);
    showOverlay(fileName, zohoApp);

    const webview = document.getElementById(zohoApp);
    if (webview) {
      webview.loadURL(IMPORT_URLS[zohoApp]);
    }

    hideOverlayAfterDelay(2000);
  } catch (err) {
    hideOverlay();
    alert(`Failed to open file: ${err.message}`);
  }
});

// ── Drag and Drop ───────────────────────────────────────────────────
let dragCounter = 0;

document.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragCounter++;
  dropZone.classList.add('visible');
});

document.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dragCounter--;
  if (dragCounter <= 0) {
    dragCounter = 0;
    dropZone.classList.remove('visible');
  }
});

document.addEventListener('dragover', (e) => {
  e.preventDefault();
});

document.addEventListener('drop', (e) => {
  e.preventDefault();
  dragCounter = 0;
  dropZone.classList.remove('visible');

  const files = e.dataTransfer.files;
  if (files.length === 0) return;

  const file = files[0];
  const ext = file.name.split('.').pop().toLowerCase();
  const zohoApp = EXT_TO_APP[ext];

  if (!zohoApp) {
    alert(`Unsupported file type: .${ext}`);
    return;
  }

  try {
    switchTab(zohoApp);
    showOverlay(file.name, zohoApp);

    const webview = document.getElementById(zohoApp);
    if (webview) {
      webview.loadURL(IMPORT_URLS[zohoApp]);
    }

    hideOverlayAfterDelay(2000);
  } catch (err) {
    hideOverlay();
    alert(`Failed to open dropped file: ${err.message}`);
  }
});
