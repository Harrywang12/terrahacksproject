const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  sendNotification: (title, body) => ipcRenderer.send('show-notification', { title, body })
});

// Listen for browser notification fallback
ipcRenderer.on('show-browser-notification', (event, { title, body }) => {
  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      new Notification(title, { body });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification(title, { body });
        }
      });
    }
  }
});

// Preload script for security context isolation
window.addEventListener('DOMContentLoaded', () => {
  // Any initialization code can go here
}); 