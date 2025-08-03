const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  sendNotification: (title, body) => {
    console.log('📤 Sending notification via IPC:', title, body);
    ipcRenderer.send('show-notification', { title, body });
  },
  
  // Listen for notification responses
  onNotificationSent: (callback) => ipcRenderer.on('notification-sent', callback),
  onNotificationFailed: (callback) => ipcRenderer.on('notification-failed', callback),
  
  // Remove listeners
  removeNotificationListeners: () => {
    ipcRenderer.removeAllListeners('notification-sent');
    ipcRenderer.removeAllListeners('notification-failed');
  }
});

// Listen for browser notification fallback  
ipcRenderer.on('show-browser-notification', (event, { title, body }) => {
  console.log('📱 Attempting browser notification fallback:', title, body);
  
  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      console.log('✅ Browser notification permission granted, showing notification');
      const notification = new Notification(title, { 
        body,
        icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSI+PGNpcmNsZSBjeD0iMjQiIGN5PSIyNCIgcj0iMjAiIHN0cm9rZT0iIzAwZjVmZiIgc3Ryb2tlLXdpZHRoPSIzIiBmaWxsPSJub25lIi8+PC9zdmc+',
        requireInteraction: true,
        tag: 'posture-alert'
      });
      
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } else if (Notification.permission !== 'denied') {
      console.log('🔔 Requesting browser notification permission');
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          console.log('✅ Permission granted, showing notification');
          const notification = new Notification(title, { 
            body,
            requireInteraction: true,
            tag: 'posture-alert'
          });
          
          notification.onclick = () => {
            window.focus();
            notification.close();
          };
        } else {
          console.log('❌ Browser notification permission denied');
        }
      });
    } else {
      console.log('❌ Browser notifications are denied');
    }
  } else {
    console.log('❌ Browser notifications not available');
  }
});

// Preload script for security context isolation
window.addEventListener('DOMContentLoaded', () => {
  // Any initialization code can go here
}); 