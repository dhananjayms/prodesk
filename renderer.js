'use strict';

// ── Element references ──────────────────────────────────────────────
const tabs       = document.querySelectorAll('.tab');
const webviews   = document.querySelectorAll('webview');
const overlay    = document.getElementById('upload-overlay');
const overlayMsg = document.getElementById('upload-message');
const dropZone   = document.getElementById('drop-zone');
const openBtn    = document.getElementById('open-file-btn');

// ── Zoho app home URLs ──────────────────────────────────────────────
const HOME_URLS = {
  sheet:  'https://sheet.zoho.com',
  writer: 'https://writer.zoho.com',
  show:   'https://show.zoho.com',
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

// ── Upload file to Zoho via webview ─────────────────────────────────
// Injects the file into the Zoho import page's file input after it loads.
function uploadFileToWebview(webview, zohoApp, fileName, base64, mimeType) {
  // Navigate to the app home first (so user is on the right Zoho app)
  const currentUrl = webview.getURL();
  const isOnZoho = currentUrl && currentUrl.includes('zoho.com');

  // Wait for the webview to be ready, then trigger Zoho's native upload
  // by injecting a file into the page's drag-and-drop handler
  const injectScript = `
    (function() {
      try {
        var base64 = "${base64}";
        var byteChars = atob(base64);
        var byteArray = new Uint8Array(byteChars.length);
        for (var i = 0; i < byteChars.length; i++) {
          byteArray[i] = byteChars.charCodeAt(i);
        }
        var blob = new Blob([byteArray], { type: "${mimeType}" });
        var file = new File([blob], "${fileName}", { type: "${mimeType}" });
        var dt = new DataTransfer();
        dt.items.add(file);

        // Try to find the file input on the page and set the file
        var inputs = document.querySelectorAll('input[type="file"]');
        if (inputs.length > 0) {
          inputs[0].files = dt.files;
          inputs[0].dispatchEvent(new Event('change', { bubbles: true }));
          'uploaded-via-input';
        } else {
          // Trigger drag-and-drop on the document body
          var dropEvent = new DragEvent('drop', {
            bubbles: true,
            dataTransfer: dt
          });
          document.body.dispatchEvent(dropEvent);
          'uploaded-via-drop';
        }
      } catch(e) {
        'error: ' + e.message;
      }
    })();
  `;

  // If already on Zoho, inject directly after a short delay
  if (isOnZoho) {
    setTimeout(() => {
      webview.executeJavaScript(injectScript).then((result) => {
        console.log('File injection result:', result);
      }).catch(console.error);
    }, 1500);
  } else {
    // Navigate to home first, then inject after load
    webview.loadURL(HOME_URLS[zohoApp]);
    webview.addEventListener('did-finish-load', function onLoad() {
      webview.removeEventListener('did-finish-load', onLoad);
      setTimeout(() => {
        webview.executeJavaScript(injectScript).then((result) => {
          console.log('File injection result:', result);
        }).catch(console.error);
      }, 2000);
    });
  }
}

// ── Handle incoming file from main process ──────────────────────────
window.electronAPI.onOpenFile((payload) => {
  try {
    const { app: zohoApp, fileName, base64, mimeType } = payload;

    // 1. Switch to the correct tab
    switchTab(zohoApp);

    // 2. Show the upload overlay
    showOverlay(fileName, zohoApp);

    // 3. Get the webview and upload the file
    const webview = document.getElementById(zohoApp);
    if (webview) {
      uploadFileToWebview(webview, zohoApp, fileName, base64, mimeType);
    }

    // 4. Hide overlay after upload attempt
    hideOverlayAfterDelay(4000);
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

  // Read the file and trigger the upload flow
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const base64 = reader.result.split(',')[1];
      const mimeType = file.type || 'application/octet-stream';

      switchTab(zohoApp);
      showOverlay(file.name, zohoApp);

      const webview = document.getElementById(zohoApp);
      if (webview) {
        uploadFileToWebview(webview, zohoApp, file.name, base64, mimeType);
      }

      hideOverlayAfterDelay(4000);
    } catch (err) {
      hideOverlay();
      alert(`Failed to open dropped file: ${err.message}`);
    }
  };
  reader.readAsDataURL(file);
});
