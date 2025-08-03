const { app, BrowserWindow, Notification, ipcMain } = require('electron');
const path = require('path');

let mainWindow;
let lastNotificationTime = 0;
const NOTIFICATION_COOLDOWN = 10000; // 10 seconds between notifications (reduced for testing)

// Set proper app name for notifications
app.setName('Perfect Posture');

// Force app identity for macOS notifications
if (process.platform === 'darwin') {
  // Set bundle identifier for macOS
  app.setAsDefaultProtocolClient('perfectposture');
}

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
    try {
      // Force request notification permission on macOS
      console.log('📱 Requesting macOS notification permission...');
      
      // Check if we have permission
      const hasPermission = await new Promise((resolve) => {
        // Create a test notification to trigger permission request
        const testNotification = new Notification({
          title: 'Perfect Posture',
          body: 'Notification permission test',
          silent: true,
          // Force app name for macOS
          ...(process.platform === 'darwin' && {
            subtitle: 'Perfect Posture'
          })
        });
        
        testNotification.on('show', () => {
          console.log('✅ macOS notifications working!');
          testNotification.close();
          resolve(true);
        });
        
        testNotification.on('failed', (error) => {
          console.log('❌ macOS notification failed:', error.message);
          resolve(false);
        });
        
        try {
          testNotification.show();
          // Timeout after 3 seconds
          setTimeout(() => {
            testNotification.close();
            resolve(false);
          }, 3000);
        } catch (error) {
          console.log('❌ Error showing test notification:', error.message);
          resolve(false);
        }
      });
      
      if (hasPermission) {
        console.log('✅ macOS notification system ready');
        return true;
      } else {
        console.log('⚠️ macOS notifications may be blocked - check System Preferences');
        return false;
      }
    } catch (error) {
      console.log('❌ Error requesting macOS notification permission:', error.message);
      return false;
    }
  }
  return true; // On other platforms, assume permission is granted
}

// Handle notification requests from renderer
ipcMain.on('show-notification', async (event, { title, body }) => {
  console.log('Received notification request from renderer:', title, body);
  const now = Date.now();
  
  // Check if enough time has passed since last notification
  if (now - lastNotificationTime > NOTIFICATION_COOLDOWN) {
    console.log('📬 Sending notification:', title, body);
    console.log('🕐 Time since last notification:', Math.round((now - lastNotificationTime) / 1000), 'seconds');
    
    try {
      // Ensure notifications are supported
      if (!Notification.isSupported()) {
        console.log('Notifications not supported on this platform');
        // Try browser notification fallback immediately
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('show-browser-notification', { title, body });
        }
        return;
      }

      // Create notification with enhanced macOS settings
      const notification = new Notification({
        title: title,
        body: body,
        silent: false,
        urgency: 'normal',
        // Enhanced macOS settings for better visibility
        ...(process.platform === 'darwin' && {
          subtitle: 'Perfect Posture',
          sound: 'default', // Use default system sound
          hasReply: false,
          replyPlaceholder: '',
          actions: [],
          // Force notification to show even when app is not focused
          silent: false,
          timeoutType: 'default'
        }),
        // Windows settings
        ...(process.platform === 'win32' && {
          icon: path.join(__dirname, 'assets', 'icon.png')
        }),
        // Linux settings  
        ...(process.platform === 'linux' && {
          icon: path.join(__dirname, 'assets', 'icon.png')
        })
      });
      
      // Handle notification events
      notification.on('click', () => {
        console.log('🖱️ Notification clicked - bringing app to front');
        if (mainWindow) {
          if (mainWindow.isMinimized()) {
            mainWindow.restore();
          }
          if (!mainWindow.isVisible()) {
            mainWindow.show();
          }
          mainWindow.focus();
          
          // On macOS, also bring to front
          if (process.platform === 'darwin') {
            app.focus({ steal: true });
          }
        }
      });
      
      notification.on('show', () => {
        console.log('✅ Native notification shown successfully:', title);
        // Send success confirmation
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('notification-sent', { title, body, type: 'native' });
        }
      });
      
      notification.on('failed', (error) => {
        console.error('❌ Native notification failed:', error.message);
        console.log('🔄 Trying browser notification fallback...');
        // Send browser notification fallback immediately
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('show-browser-notification', { title, body });
          mainWindow.webContents.send('notification-failed', { error: error.message, fallback: 'browser' });
        }
      });

      notification.on('close', () => {
        console.log('📱 Notification closed:', title);
      });
      
      // Show the notification with immediate feedback
      try {
        // Force notification to show on macOS even when app is not focused
        if (process.platform === 'darwin') {
          // On macOS, we need to ensure the notification is properly registered
          console.log('🍎 Showing macOS notification with focus handling...');
        }
        
        notification.show();
        lastNotificationTime = now;
        
        // Force show notification for debugging
        console.log('🔔 Notification.show() called successfully');
        
        // Send success response back to renderer
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('notification-sent', { title, body, type: 'native' });
        }
      } catch (showError) {
        console.error('❌ Error showing notification:', showError);
        // Immediate fallback to browser notification
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('show-browser-notification', { title, body });
        }
      }
      
    } catch (error) {
      console.error('❌ Error creating notification:', error);
      // Send error response back to renderer
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('notification-failed', { error: error.message });
      }
    }
  } else {
    console.log('⏳ Notification skipped due to cooldown. Time since last:', Math.round((now - lastNotificationTime) / 1000), 'seconds');
    console.log('⏰ Cooldown remaining:', Math.ceil((NOTIFICATION_COOLDOWN - (now - lastNotificationTime)) / 1000), 'seconds');
    console.log('🚨 IMPORTANT: If this is a posture alert, it was blocked by cooldown!');
  }
});



// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  // Debug notification support on startup
  console.log('🔔 Notification support check:');
  console.log('  - Notification.isSupported():', Notification.isSupported());
  console.log('  - Platform:', process.platform);
  console.log('  - App name set to:', app.getName());
  
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