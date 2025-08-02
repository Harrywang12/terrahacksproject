// Global variables
let model;
let webcam;
let canvas;
let ctx;
let isRunning = false;
let animationId;
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
const confidenceFill = document.getElementById('confidence-fill');
const confidenceText = document.getElementById('confidence-text');
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
        
        // Set up webcam using Teachable Machine API
        const width = 700;
        const height = 900; 
        const flip = true; // whether to flip the webcam
        webcam = new tmPose.Webcam(width, height, flip); // width, height, flip
        await webcam.setup(); // request access to the webcam
        await webcam.play();
        
        // Set canvas size to match webcam
        canvas.width = width;
        canvas.height = height;
        
        // Start pose detection
        isRunning = true;
        startBtn.disabled = true;
        stopBtn.disabled = false;
        
        updateStatus('Camera active');
        updateFeedback('Camera is now active. Position yourself in front of the camera.');
        
        // Start the detection loop
        detectPose();
        
    } catch (error) {
        console.error('Error starting camera:', error);
        updateStatus('Camera error');
        updateFeedback('Failed to access camera. Please check camera permissions.');
    }
}

// Stop the webcam and pose detection
function stopCamera() {
    if (webcam) {
        webcam.stop();
    }
    
    isRunning = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    
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
    
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
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
        
        // Continue the loop
        animationId = requestAnimationFrame(detectPose);
        
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
            
            console.log('Sending notification for bad posture...');
            
            // Send notification
            if (window.electronAPI && window.electronAPI.sendNotification) {
                window.electronAPI.sendNotification(
                    '⚠️ Perfect Posture Alert',
                    'Please sit up straight and adjust your posture!'
                );
                console.log('Notification sent via Electron API');
            } else {
                console.error('Electron API not available, trying browser notification...');
                // Fallback to browser notification
                if ('Notification' in window) {
                    if (Notification.permission === 'granted') {
                        new Notification('⚠️ Perfect Posture Alert', {
                            body: 'Please sit up straight and adjust your posture!'
                        });
                    } else if (Notification.permission !== 'denied') {
                        Notification.requestPermission().then(permission => {
                            if (permission === 'granted') {
                                new Notification('⚠️ Perfect Posture Alert', {
                                    body: 'Please sit up straight and adjust your posture!'
                                });
                            }
                        });
                    }
                }
            }
            
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
    confidenceFill.style.width = `${percentage}%`;
    confidenceText.textContent = `${percentage}%`;
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
        
        // Send test notification directly
        if (window.electronAPI && window.electronAPI.sendNotification) {
            console.log('Sending via Electron API...');
            window.electronAPI.sendNotification(
                '✅ Perfect Posture Test',
                'This is a test notification from Perfect Posture!'
            );
            updateFeedback('Test notification sent via Electron! Check your notifications.');
        } else {
            console.log('Electron API not available, trying browser notification...');
            // Fallback to browser notification
            if ('Notification' in window && Notification.permission === 'granted') {
                console.log('Sending browser notification...');
                const notification = new Notification('✅ Perfect Posture Test', {
                    body: 'This is a test notification from Perfect Posture!',
                    icon: null,
                    requireInteraction: true
                });
                updateFeedback('Test notification sent via browser! Check your notifications.');
                    } else {
            console.log('Browser notification not available or permission denied');
            updateFeedback('Please enable notifications in your browser settings. Permission: ' + Notification.permission);
            // Fallback alert for testing
            alert('Test notification: Perfect Posture Alert!\n\nThis is a test notification from Perfect Posture!');
        }
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

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init); 