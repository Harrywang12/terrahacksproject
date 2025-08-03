// Global variables
let model;
let webcam;
let canvas;
let ctx;
let isRunning = false;
let maxPredictions;

// Notification variables
let lastBadPostureNotification = 0;
let notificationCooldown = 10000; // 10 seconds between notifications (reduced for testing)
let consecutiveBadPostureCount = 0;
let notificationThreshold = 2;

// Accuracy metrics variables
let poseQualityHistory = [];
let consistencyHistory = [];
let adaptiveThreshold = 0.6;

// DOM elements
const video = document.getElementById('webcam');
const poseCanvas = document.getElementById('pose-canvas');
const predictionLabel = document.getElementById('prediction-label');
const feedbackText = document.getElementById('feedback-text');
const confidencePercentage = document.getElementById('confidence-percentage');
const confidenceProgressRing = document.getElementById('confidence-progress-ring');
const statusIndicator = document.getElementById('status-indicator');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');

// Settings DOM elements
const notificationsEnabledCheckbox = document.getElementById('notifications-enabled');
const testNotificationBtn = document.getElementById('test-notification-btn');

// Accuracy metrics DOM elements
const poseQualityElement = document.getElementById('pose-quality');
const consistencyScoreElement = document.getElementById('consistency-score');
const adaptiveThresholdElement = document.getElementById('adaptive-threshold');

// Feedback messages for different posture classes
const feedbackMessages = {
    'Good posture': '✅ Great posture! Keep it up.',
    'Bad posture': '❌ Sit tall and relax your shoulders.',
    'Leaning Forward': '❌ Bring your head back in line with your spine.'
};

// Initialize the application
async function init() {
    try {
        updateStatus('Loading model...');
        
        // Load the Teachable Machine pose model
        const modelURL = './terrahacksmodel/model.json';
        const metadataURL = './terrahacksmodel/metadata.json';
        
        console.log('Loading Teachable Machine pose model from:', modelURL);
        model = await tmPose.load(modelURL, metadataURL);
        maxPredictions = model.getTotalClasses();
        
        console.log('Model loaded successfully!');
        console.log('Total classes:', maxPredictions);
        
        // Set up canvas
        canvas = poseCanvas;
        ctx = canvas.getContext('2d');
        
        // Set up event listeners
        startBtn.addEventListener('click', startCamera);
        stopBtn.addEventListener('click', stopCamera);
        testNotificationBtn.addEventListener('click', testNotification);
        
        updateStatus('Ready to start');
        
    } catch (error) {
        console.error('Error initializing:', error);
        console.error('Error details:', error.message);
        console.error('Error stack:', error.stack);
        updateStatus('Error loading model');
        updateFeedback(`Failed to load the posture model: ${error.message}`);
    }
}

// Start the webcam and pose detection
async function startCamera() {
    try {
        updateStatus('Starting camera...');
        
        // Start session tracking
        if (window.sessionTracker) {
            window.sessionTracker.startSession();
        }
        
        // Hide the HTML video element and use TM webcam
        const htmlVideo = document.getElementById('webcam');
        if (htmlVideo) {
            htmlVideo.style.display = 'none';
        }
        
        // Set up webcam using Teachable Machine API
        const width = 700;
        const height = 700; // Match CSS dimensions 
        const flip = true; // whether to flip the webcam
        webcam = new tmPose.Webcam(width, height, flip); // width, height, flip
        await webcam.setup(); // request access to the webcam
        await webcam.play();
        
        // Append the webcam canvas to the container
        const webcamContainer = document.querySelector('.webcam-container');
        if (webcamContainer && webcam.canvas) {
            // Style the webcam canvas
            webcam.canvas.style.width = '700px';
            webcam.canvas.style.height = '700px';
            webcam.canvas.style.borderRadius = '15px';
            webcam.canvas.style.objectFit = 'cover';
            webcam.canvas.style.position = 'relative';
            webcam.canvas.style.zIndex = '1';
            
            // Insert before the pose canvas
            webcamContainer.insertBefore(webcam.canvas, canvas);
        }
        
        // Set canvas size to match webcam
        canvas.width = width;
        canvas.height = height;
        
        // Start pose detection
        isRunning = true;
        startBtn.disabled = true;
        stopBtn.disabled = false;
        
        // Start session timer
        startSessionTimer();
        
        updateStatus('Camera active');
        updateFeedback('Camera is now active. Position yourself in front of the camera.');
        
        // Start the detection loop - will run continuously even when app not focused
        detectPose();
        
        console.log('🔄 Detection loop started - will run in background when app is not focused');
        
    } catch (error) {
        console.error('Error starting camera:', error);
        updateStatus('Camera error');
        updateFeedback('Failed to access camera. Please check camera permissions.');
    }
}

// Stop the webcam and pose detection
function stopCamera() {
    // End session tracking
    if (window.sessionTracker) {
        window.sessionTracker.endSession();
    }
    
    if (webcam) {
        webcam.stop();
        
        // Remove the webcam canvas if it exists
        if (webcam.canvas && webcam.canvas.parentNode) {
            webcam.canvas.parentNode.removeChild(webcam.canvas);
        }
    }
    
    // Show the HTML video element again
    const htmlVideo = document.getElementById('webcam');
    if (htmlVideo) {
        htmlVideo.style.display = 'block';
    }
    
    isRunning = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    
    // Stop session timer
    stopSessionTimer();
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Reset notification variables
    consecutiveBadPostureCount = 0;
    lastBadPostureNotification = 0;
    
    // Reset accuracy metrics
    poseQualityHistory = [];
    consistencyHistory = [];
    adaptiveThreshold = 0.6;
    
    // Reset UI
    updatePrediction('Camera stopped', 'loading');
    updateFeedback('Camera stopped. Click "Start Camera" to begin.');
    updateConfidence(0);
    updateStatus('Camera stopped');
    
    // Clear any running timeouts (since we switched from requestAnimationFrame)
    // No need to cancel animationId since we're using setTimeout now
}

// Main pose detection loop
async function detectPose() {
    if (!isRunning) return;
    
    try {
        // Update webcam frame
        webcam.update();
        
        // Prediction #1: run input through posenet
        const { pose, posenetOutput } = await model.estimatePose(webcam.canvas);
        
        if (pose) {
            // Prediction #2: run input through teachable machine classification model
            const prediction = await model.predict(posenetOutput);
            
            console.log('Raw prediction:', prediction);
            
            // Find the class with highest probability
            let maxProb = 0;
            let predictedClass = '';
            
            for (let i = 0; i < maxPredictions; i++) {
                const classPrediction = prediction[i];
                console.log(`${classPrediction.className}: ${classPrediction.probability}`);
                
                if (classPrediction.probability > maxProb) {
                    maxProb = classPrediction.probability;
                    predictedClass = classPrediction.className;
                }
            }
            
            // Update UI with results
            updatePredictionResults(predictedClass, maxProb);
            
            // Track posture data for progress monitoring
            if (window.sessionTracker) {
                window.sessionTracker.addReading(predictedClass, maxProb);
            }
            
            // Handle notifications for bad posture
            handlePostureNotification(predictedClass, maxProb);
            
            // Update accuracy metrics
            updateAccuracyMetrics(pose, maxProb);
            
            // Draw pose skeleton
            drawPose(pose);
            
        } else {
            updatePrediction('No person detected', 'loading');
            updateFeedback('Please position yourself in front of the camera.');
            updateConfidence(0);
        }
        
        // Continue the loop - use setTimeout for background running
        setTimeout(() => {
            if (isRunning) {
                detectPose();
            }
        }, 100); // Run every 100ms (10 FPS) for consistent background detection
        
    } catch (error) {
        console.error('Error in pose detection:', error);
        updateStatus('Detection error');
    }
}

// Update prediction results in the UI
function updatePredictionResults(predictedClass, confidence) {
    // Update prediction display
    updatePrediction(predictedClass, getClassType(predictedClass));
    
    // Update feedback
    const feedback = getDetailedFeedback(predictedClass, confidence);
    updateFeedback(feedback);
    
    // Update confidence
    const confidencePercent = Math.round(confidence * 100);
    updateConfidence(confidencePercent);
    
    // Update status
    if (confidence > 0.7) {
        updateStatus('High confidence');
    } else if (confidence > 0.5) {
        updateStatus('Medium confidence');
    } else {
        updateStatus('Low confidence - hold still');
    }
}

// Handle posture notifications
function handlePostureNotification(predictedClass, confidence) {
    const now = Date.now();
    
    // Check if notifications are enabled
    if (!notificationsEnabledCheckbox || !notificationsEnabledCheckbox.checked) {
        return;
    }
    
    // Check if it's bad posture with sufficient confidence
    if (predictedClass === 'Bad posture' && confidence > 0.6) {
        consecutiveBadPostureCount++;
        console.log(`Bad posture detected: ${consecutiveBadPostureCount}/${notificationThreshold}`);
        
        // Send notification if we have enough consecutive bad posture detections
        // and enough time has passed since last notification
        if (consecutiveBadPostureCount >= notificationThreshold && 
            now - lastBadPostureNotification > notificationCooldown) {
            
            console.log('🚨 Sending notification for bad posture...');
            console.log('📍 Current app focus state:', document.hasFocus());
            console.log('📍 Document visibility:', document.visibilityState);
            
            // Send notification via enhanced system
            sendPostureNotification(
                '⚠️ Perfect Posture Alert',
                'Please sit up straight and adjust your posture!'
            );
            
            lastBadPostureNotification = now;
            consecutiveBadPostureCount = 0; // Reset counter after notification
        }
    } else if (predictedClass === 'Good posture' && confidence > 0.6) {
        // Reset bad posture counter when good posture is detected
        consecutiveBadPostureCount = 0;
        console.log('Good posture detected - resetting bad posture counter');
    }
}

// Get detailed feedback based on prediction
function getDetailedFeedback(predictedClass, confidence) {
    // Base feedback
    let feedback = feedbackMessages[predictedClass] || 'Analyzing posture...';
    
    // Add confidence-based feedback
    if (confidence > 0.8) {
        feedback += ' (Very confident)';
    } else if (confidence > 0.6) {
        feedback += ' (Confident)';
    } else if (confidence > 0.4) {
        feedback += ' (Moderate confidence)';
    } else {
        feedback += ' (Low confidence - hold still)';
    }
    
    return feedback;
}

// Get CSS class type for styling
function getClassType(className) {
    if (className === 'Good posture') return 'good';
    if (className === 'Bad posture') return 'bad';
    if (className === 'Leaning Forward') return 'leaning';
    return 'loading';
}

// Draw pose skeleton on canvas
function drawPose(pose) {
    if (!pose || !webcam.canvas) return;
    
    // Draw the webcam image
    ctx.drawImage(webcam.canvas, 0, 0);
    
    // Draw the keypoints and skeleton
    const minPartConfidence = 0.3;
    tmPose.drawKeypoints(pose.keypoints, minPartConfidence, ctx);
    tmPose.drawSkeleton(pose.keypoints, minPartConfidence, ctx);
}

// UI update functions
function updatePrediction(label, className) {
    predictionLabel.className = `prediction-label ${className}`;
    predictionLabel.querySelector('.label-text').textContent = label;
}

function updateFeedback(text) {
    feedbackText.querySelector('span').textContent = text;
}

function updateConfidence(percentage) {
    // Update circular progress ring
    const circumference = 2 * Math.PI * 50; // radius = 50
    const offset = circumference - (percentage / 100) * circumference;
    
    if (confidenceProgressRing) {
        confidenceProgressRing.style.strokeDashoffset = offset;
        
        // Change ring color based on confidence level
        if (percentage >= 80) {
            confidenceProgressRing.style.stroke = '#00ff7f';
        } else if (percentage >= 60) {
            confidenceProgressRing.style.stroke = '#00f5ff';
        } else if (percentage >= 40) {
            confidenceProgressRing.style.stroke = '#ffa500';
        } else {
            confidenceProgressRing.style.stroke = '#ff4757';
        }
    }
    
    // Update percentage text
    if (confidencePercentage) {
        confidencePercentage.textContent = `${percentage}%`;
    }
}

function updateStatus(text) {
    statusIndicator.querySelector('.status-text').textContent = text;
}

// Test notification function
async function testNotification() {
    try {
        console.log('Test notification button clicked');
        console.log('Window.electronAPI available:', !!window.electronAPI);
        console.log('Notification API available:', 'Notification' in window);
        console.log('Current notification permission:', Notification.permission);
        
        // Request notification permission first
        if ('Notification' in window && Notification.permission === 'default') {
            console.log('Requesting notification permission...');
            const permission = await Notification.requestPermission();
            console.log('Notification permission result:', permission);
        }
        
        // Send test notification using enhanced system
        console.log('🧪 Sending test notification...');
        console.log('Testing notifications when app is not focused...');
        
        // Try Electron first
        if (window.electronAPI && window.electronAPI.sendNotification) {
            window.electronAPI.sendNotification('✅ Perfect Posture Test', 'This is a test notification from Perfect Posture!');
            updateFeedback('Test notification sent! Now switch to another app and wait for the notification.');
            
            // Also try browser notification after 5 seconds for comparison
            setTimeout(() => {
                console.log('🧪 Testing browser notification as backup...');
                sendBrowserNotification('🧪 Browser Test', 'This is a browser notification test!');
            }, 5000);
        } else {
            sendBrowserNotification('✅ Perfect Posture Test', 'This is a test notification from Perfect Posture!');
            updateFeedback('Test notification sent via browser! Check your browser notifications.');
        }
    } catch (error) {
        console.error('Error testing notification:', error);
        updateFeedback('Error testing notification: ' + error.message);
    }
}

// Update accuracy metrics
function updateAccuracyMetrics(pose, confidence) {
    // Calculate pose quality based on keypoint confidence
    const keypoints = pose.keypoints;
    const visibleKeypoints = keypoints.filter(kp => kp.score > 0.3);
    const poseQuality = visibleKeypoints.length / keypoints.length;
    
    // Add to history (keep last 10 readings)
    poseQualityHistory.push(poseQuality);
    if (poseQualityHistory.length > 10) {
        poseQualityHistory.shift();
    }
    
    // Calculate consistency based on confidence stability
    consistencyHistory.push(confidence);
    if (consistencyHistory.length > 10) {
        consistencyHistory.shift();
    }
    
    // Calculate consistency score (standard deviation of recent confidences)
    const consistencyScore = calculateConsistency(consistencyHistory);
    
    // Update adaptive threshold based on recent performance
    if (confidence > 0.8) {
        adaptiveThreshold = Math.min(adaptiveThreshold + 0.01, 0.9);
    } else if (confidence < 0.5) {
        adaptiveThreshold = Math.max(adaptiveThreshold - 0.01, 0.3);
    }
    
    // Update UI
    if (poseQualityElement) {
        const qualityPercent = Math.round(poseQuality * 100);
        poseQualityElement.textContent = `${qualityPercent}%`;
        poseQualityElement.className = `metric-value ${getQualityClass(qualityPercent)}`;
    }
    
    if (consistencyScoreElement) {
        const consistencyPercent = Math.round((1 - consistencyScore) * 100);
        consistencyScoreElement.textContent = `${consistencyPercent}%`;
        consistencyScoreElement.className = `metric-value ${getQualityClass(consistencyPercent)}`;
    }
    
    if (adaptiveThresholdElement) {
        const thresholdPercent = Math.round(adaptiveThreshold * 100);
        adaptiveThresholdElement.textContent = `${thresholdPercent}%`;
        adaptiveThresholdElement.className = `metric-value ${getQualityClass(thresholdPercent)}`;
    }
}

// Calculate consistency (lower is better)
function calculateConsistency(history) {
    if (history.length < 2) return 0;
    
    const mean = history.reduce((sum, val) => sum + val, 0) / history.length;
    const variance = history.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / history.length;
    return Math.sqrt(variance);
}

// Get quality class for styling
function getQualityClass(percentage) {
    if (percentage >= 80) return 'high';
    if (percentage >= 60) return 'medium';
    return 'low';
}

// Enhanced notification function
function sendPostureNotification(title, body) {
    console.log('🚨 Sending posture notification:', title, body);
    console.log('📍 Document visibility:', document.visibilityState);
    console.log('📍 Window focused:', document.hasFocus());
    
    if (window.electronAPI && window.electronAPI.sendNotification) {
        console.log('📤 Attempting Electron native notifications');
        window.electronAPI.sendNotification(title, body);
    } else {
        console.log('📱 Electron API unavailable, using browser notifications');
        sendBrowserNotification(title, body);
    }
}

// Browser notification fallback
function sendBrowserNotification(title, body) {
    if ('Notification' in window) {
        if (Notification.permission === 'granted') {
            console.log('✅ Showing browser notification');
            const notification = new Notification(title, {
                body: body,
                icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSI+PGNpcmNsZSBjeD0iMjQiIGN5PSIyNCIgcj0iMjAiIHN0cm9rZT0iIzAwZjVmZiIgc3Ryb2tlLXdpZHRoPSIzIiBmaWxsPSJub25lIi8+PC9zdmc+',
                requireInteraction: true,
                tag: 'posture-alert',
                vibrate: [200, 100, 200]
            });
            
            notification.onclick = () => {
                window.focus();
                notification.close();
            };
        } else if (Notification.permission !== 'denied') {
            console.log('🔔 Requesting notification permission');
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    console.log('✅ Permission granted, sending notification');
                    sendBrowserNotification(title, body);
                } else {
                    console.log('❌ Notification permission denied');
                    showInAppAlert(title, body);
                }
            });
        } else {
            console.log('❌ Notifications denied, showing in-app alert');
            showInAppAlert(title, body);
        }
    } else {
        console.log('❌ Notifications not supported, showing in-app alert');
        showInAppAlert(title, body);
    }
}

// In-app alert fallback
function showInAppAlert(title, body) {
    // Create a temporary overlay notification
    const alertDiv = document.createElement('div');
    alertDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, rgba(255, 71, 87, 0.95), rgba(255, 0, 255, 0.95));
        color: white;
        padding: 15px 20px;
        border-radius: 15px;
        border: 2px solid rgba(255, 71, 87, 0.5);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        z-index: 9999;
        max-width: 300px;
        font-family: 'Inter', sans-serif;
        animation: slideIn 0.3s ease-out;
    `;
    
    alertDiv.innerHTML = `
        <div style="font-weight: 700; margin-bottom: 5px;">${title}</div>
        <div style="font-size: 0.9rem; opacity: 0.9;">${body}</div>
    `;
    
    // Add animation keyframes
    if (!document.querySelector('#alert-styles')) {
        const style = document.createElement('style');
        style.id = 'alert-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(alertDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => alertDiv.remove(), 300);
        }
    }, 5000);
    
    // Click to dismiss
    alertDiv.onclick = () => alertDiv.remove();
}

// Listen for notification responses from main process
if (window.electronAPI) {
    window.electronAPI.onNotificationSent((event, data) => {
        if (data.type === 'native') {
            console.log('✅ Native notification confirmed sent:', data);
        } else {
            console.log('✅ Notification confirmed sent:', data);
        }
    });
    
    window.electronAPI.onNotificationFailed((event, data) => {
        console.log('❌ Notification failed in main process:', data);
        if (data.fallback === 'browser') {
            console.log('🔄 Main process is handling browser fallback');
        } else {
            console.log('🔄 Attempting manual browser fallback');
            sendBrowserNotification('⚠️ Perfect Posture Alert', 'Please check your posture! You\'ve been slouching for a while.');
        }
    });
}

// Session Timer Functions
function startSessionTimer() {
    sessionStartTime = Date.now();
    updateSessionTimer(); // Update immediately
    
    // Update timer every second
    sessionTimerInterval = setInterval(updateSessionTimer, 1000);
}

function stopSessionTimer() {
    if (sessionTimerInterval) {
        clearInterval(sessionTimerInterval);
        sessionTimerInterval = null;
    }
    sessionStartTime = null;
    
    // Reset timer display
    const timerElement = document.getElementById('session-timer');
    if (timerElement) {
        timerElement.querySelector('.timer-text').textContent = '00:00';
    }
}

function updateSessionTimer() {
    if (!sessionStartTime) return;
    
    const elapsed = Date.now() - sessionStartTime;
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    const timeString = `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    
    const timerElement = document.getElementById('session-timer');
    if (timerElement) {
        timerElement.querySelector('.timer-text').textContent = timeString;
    }
}

function getSessionDuration() {
    if (!sessionStartTime) return 0;
    return Math.floor((Date.now() - sessionStartTime) / 1000);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init);

// Expose functions globally for auth system
window.stopCamera = stopCamera; 