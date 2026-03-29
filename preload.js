const { contextBridge, ipcRenderer } = require('electron');

// Track listeners so we can remove previous ones and prevent stacking
let openFileListener = null;
let restoreTabListener = null;

// Expose a safe API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Listen for files opened from the main process
  onOpenFile: (callback) => {
    // Remove previous listener to prevent memory leak on repeated calls
    if (openFileListener) {
      ipcRenderer.removeListener('open-file', openFileListener);
    }
    openFileListener = (_event, payload) => callback(payload);
    ipcRenderer.on('open-file', openFileListener);
  },

  // Listen for tab restoration on launch
  onRestoreTab: (callback) => {
    if (restoreTabListener) {
      ipcRenderer.removeListener('restore-tab', restoreTabListener);
    }
    restoreTabListener = (_event, tabName) => callback(tabName);
    ipcRenderer.on('restore-tab', restoreTabListener);
  },

  // Trigger the native open-file dialog
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),

  // Get the app version string
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // Persist the active tab to electron-store
  saveActiveTab: (tabName) => ipcRenderer.send('save-active-tab', tabName),
});
