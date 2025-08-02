const { app, BrowserWindow, Notification, ipcMain } = require('electron');
const path = require('path');

let mainWindow;
let lastNotificationTime = 0;
const NOTIFICATION_COOLDOWN = 10000; // 10 seconds between notifications (reduced for testing)

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 800,
    height: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    title: 'Perfect Posture',
    icon: null, // You can add an icon file here if desired
    resizable: true,
    show: false // Don't show until ready
  });

  // Load the index.html file
  mainWindow.loadFile('index.html');

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Remove DevTools opening by default
  // mainWindow.webContents.openDevTools();
}

// Request notification permissions on macOS
async function requestNotificationPermission() {
  if (process.platform === 'darwin') {
    // On macOS, notifications are typically allowed by default
    // We'll handle permission issues when actually sending notifications
    console.log('macOS notification system ready');
    return true;
  }
  return true; // On other platforms, assume permission is granted
}

// Handle notification requests from renderer
ipcMain.on('show-notification', (event, { title, body }) => {
  console.log('Received notification request from renderer:', title, body);
  const now = Date.now();
  
  // Check if enough time has passed since last notification
  if (now - lastNotificationTime > NOTIFICATION_COOLDOWN) {
    console.log('Sending notification:', title, body);
    
    try {
      // Create notification with proper macOS settings
      const notification = new Notification({
        title: title,
        body: body,
        silent: false,
        timeoutType: 'default',
        // macOS specific options
        ...(process.platform === 'darwin' && {
          subtitle: 'Perfect Posture',
          urgency: 'normal'
        })
      });
      
      // Handle notification events
      notification.on('click', () => {
        console.log('Notification clicked');
        // Bring app to front when notification is clicked
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      });
      
      notification.on('show', () => {
        console.log('Notification shown successfully:', title);
      });
      
      notification.on('failed', (error) => {
        console.error('Notification failed:', error);
        // Try browser notification as fallback
        if (mainWindow && mainWindow.webContents) {
          console.log('Sending fallback browser notification');
          mainWindow.webContents.send('show-browser-notification', { title, body });
        }
      });
      
      notification.show();
      lastNotificationTime = now;
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  } else {
    console.log('Notification skipped due to cooldown. Time since last:', now - lastNotificationTime, 'ms');
  }
});



// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  // Request notification permissions first
  await requestNotificationPermission();
  
  createWindow();

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
}); 