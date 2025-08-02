// Global variables
let model;
let poseNet;
let webcam;
let canvas;
let ctx;
let isRunning = false;
let animationId;

// Accuracy improvement variables
let predictionHistory = [];
let lastValidPrediction = null;
let poseQualityThreshold = 0.3; // Lowered from 0.5
let confidenceThreshold = 0.5; // Lowered from 0.7
let smoothingWindow = 3; // Reduced from 5
let minPoseScore = 0.2; // Lowered from 0.3
let consecutiveGoodFrames = 0;
let consecutiveBadFrames = 0;
let adaptiveThreshold = 0.5; // Lowered from 0.7
let poseConsistencyHistory = [];

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
        console.log('Starting model initialization...');
        
        // Load PoseNet for pose detection
        console.log('Loading PoseNet...');
        poseNet = await posenet.load({
            architecture: 'MobileNetV1',
            outputStride: 16,
            inputResolution: { width: 256, height: 256 },
            multiplier: 0.75
        });
        console.log('PoseNet loaded successfully');
        
        // Load the TensorFlow.js model directly
        console.log('Loading TensorFlow.js model...');
        const modelURL = './my-pose-model/model.json';
        console.log('Model URL:', modelURL);
        model = await tf.loadLayersModel(modelURL);
        console.log('TensorFlow.js model loaded successfully');
        
        // Load metadata for labels
        console.log('Loading metadata...');
        const metadataResponse = await fetch('./my-pose-model/metadata.json');
        const metadata = await metadataResponse.json();
        window.modelLabels = metadata.labels;
        console.log('Metadata loaded, labels:', metadata.labels);
        
        updateStatus('Model loaded successfully');
        
        // Set up canvas
        canvas = poseCanvas;
        ctx = canvas.getContext('2d');
        
        // Set up event listeners
        startBtn.addEventListener('click', startCamera);
        stopBtn.addEventListener('click', stopCamera);
        
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
        
        // Get webcam stream
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: 640,
                height: 480,
                facingMode: 'user'
            }
        });
        
        video.srcObject = stream;
        
        // Wait for video to be ready
        await new Promise((resolve) => {
            video.onloadedmetadata = resolve;
        });
        
        // Set canvas size to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
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
    if (video.srcObject) {
        const tracks = video.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        video.srcObject = null;
    }
    
    isRunning = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Reset accuracy improvement variables
    predictionHistory = [];
    lastValidPrediction = null;
    consecutiveGoodFrames = 0;
    consecutiveBadFrames = 0;
    poseConsistencyHistory = [];
    
    // Reset UI
    updatePrediction('Camera stopped', 'loading');
    updateFeedback('Camera stopped. Click "Start Camera" to begin.');
    updateConfidence(0);
    updateStatus('Camera stopped');
    
    // Reset accuracy metrics
    if (poseQualityElement) poseQualityElement.textContent = '--';
    if (consistencyScoreElement) consistencyScoreElement.textContent = '--';
    if (adaptiveThresholdElement) adaptiveThresholdElement.textContent = '--';
    
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
}

// Main pose detection loop
async function detectPose() {
    if (!isRunning) return;
    
    try {
        // Get pose keypoints using PoseNet
        const pose = await poseNet.estimatePoses(video, {
            flipHorizontal: false,
            maxDetections: 1,
            scoreThreshold: minPoseScore,
            nmsRadius: 20
        });
        
        if (pose.length > 0 && pose[0].keypoints) {
            // Check pose quality
            const poseQuality = calculatePoseQuality(pose[0].keypoints);
            
            // Always process the pose, but show quality warning if very poor
            const keypoints = pose[0].keypoints;
            const features = extractPoseFeatures(keypoints);
            
            // Make prediction
            const prediction = await model.predict(features);
            
            // Apply accuracy improvements
            const improvedPrediction = applyAccuracyImprovements(prediction);
            
            // Update UI with results
            updatePredictionResults(improvedPrediction);
            
            // Update accuracy metrics
            updateAccuracyMetrics(poseQuality, improvedPrediction);
            
            // Draw pose skeleton
            drawPose(keypoints);
            
            // Show warning if pose quality is very poor
            if (poseQuality < 0.2) {
                updateFeedback('Poor pose quality - try to position yourself better in front of the camera.');
            }
        } else {
            updatePrediction('No person detected', 'loading');
            updateFeedback('Please position yourself in front of the camera.');
            updateConfidence(0);
            updateAccuracyMetrics(0, null);
        }
        
        // Continue the loop
        animationId = requestAnimationFrame(detectPose);
        
    } catch (error) {
        console.error('Error in pose detection:', error);
        updateStatus('Detection error');
    }
}

// Calculate pose quality based on keypoint scores and visibility
function calculatePoseQuality(keypoints) {
    const importantKeypoints = [0, 1, 2, 5, 6, 11, 12]; // nose, eyes, shoulders, hips
    let totalScore = 0;
    let validKeypoints = 0;
    
    importantKeypoints.forEach(index => {
        if (keypoints[index] && keypoints[index].score > 0.2) {
            totalScore += keypoints[index].score;
            validKeypoints++;
        }
    });
    
    return validKeypoints > 0 ? totalScore / validKeypoints : 0;
}

// Apply accuracy improvements to prediction
function applyAccuracyImprovements(prediction) {
    const probabilities = prediction.dataSync();
    const labels = window.modelLabels || ['Good posture', 'Bad posture'];
    
    // Find the class with highest probability
    let maxProb = 0;
    let predictedClass = '';
    
    probabilities.forEach((prob, index) => {
        if (prob > maxProb) {
            maxProb = prob;
            predictedClass = labels[index] || `Class ${index}`;
        }
    });
    
    console.log('Raw prediction:', { predictedClass, maxProb, probabilities });
    
    // Add to prediction history for temporal smoothing
    predictionHistory.push({
        class: predictedClass,
        confidence: maxProb,
        timestamp: Date.now()
    });
    
    // Keep only recent predictions
    if (predictionHistory.length > smoothingWindow) {
        predictionHistory.shift();
    }
    
    // Apply temporal smoothing
    const smoothedPrediction = applyTemporalSmoothing();
    
    console.log('Smoothed prediction:', smoothedPrediction);
    
    // Always show prediction, but mark as unstable if confidence is low
    const isStable = smoothedPrediction.confidence > confidenceThreshold;
    
    return {
        class: smoothedPrediction.class,
        confidence: smoothedPrediction.confidence,
        isStable: isStable
    };
}

// Calculate adaptive threshold based on recent performance
function calculateAdaptiveThreshold() {
    if (predictionHistory.length < 3) {
        return confidenceThreshold;
    }
    
    // Calculate variance in recent predictions
    const recentConfidences = predictionHistory.slice(-3).map(p => p.confidence);
    const meanConfidence = recentConfidences.reduce((sum, c) => sum + c, 0) / recentConfidences.length;
    const variance = recentConfidences.reduce((sum, c) => sum + Math.pow(c - meanConfidence, 2), 0) / recentConfidences.length;
    
    // If predictions are stable (low variance), lower the threshold
    // If predictions are unstable (high variance), raise the threshold
    const stabilityFactor = Math.max(0.1, Math.min(0.3, variance));
    
    return confidenceThreshold + stabilityFactor;
}

// Check pose consistency over time
function checkPoseConsistency(prediction) {
    poseConsistencyHistory.push(prediction.class);
    
    // Keep only recent history
    if (poseConsistencyHistory.length > 10) {
        poseConsistencyHistory.shift();
    }
    
    if (poseConsistencyHistory.length < 3) {
        return 0.5; // Neutral score for insufficient history
    }
    
    // Calculate consistency as percentage of most common class
    const classCounts = {};
    poseConsistencyHistory.forEach(className => {
        classCounts[className] = (classCounts[className] || 0) + 1;
    });
    
    const mostFrequentClass = Object.keys(classCounts).reduce((a, b) => 
        classCounts[a] > classCounts[b] ? a : b
    );
    
    const consistencyRatio = classCounts[mostFrequentClass] / poseConsistencyHistory.length;
    
    // Return consistency score (0-1)
    return consistencyRatio;
}

// Apply temporal smoothing to reduce jitter
function applyTemporalSmoothing() {
    if (predictionHistory.length === 0) {
        return { class: 'Analyzing...', confidence: 0 };
    }
    
    // If we have very few predictions, just use the latest one
    if (predictionHistory.length < 2) {
        const latest = predictionHistory[predictionHistory.length - 1];
        return {
            class: latest.class,
            confidence: latest.confidence
        };
    }
    
    // Group predictions by class
    const classCounts = {};
    const classConfidences = {};
    
    predictionHistory.forEach(pred => {
        if (!classCounts[pred.class]) {
            classCounts[pred.class] = 0;
            classConfidences[pred.class] = 0;
        }
        classCounts[pred.class]++;
        classConfidences[pred.class] += pred.confidence;
    });
    
    // Find most frequent class
    let mostFrequentClass = '';
    let maxCount = 0;
    
    Object.keys(classCounts).forEach(className => {
        if (classCounts[className] > maxCount) {
            maxCount = classCounts[className];
            mostFrequentClass = className;
        }
    });
    
    // If no clear winner, use the latest prediction
    if (maxCount === 1) {
        const latest = predictionHistory[predictionHistory.length - 1];
        return {
            class: latest.class,
            confidence: latest.confidence
        };
    }
    
    // Calculate average confidence for the most frequent class
    const avgConfidence = classConfidences[mostFrequentClass] / classCounts[mostFrequentClass];
    
    return {
        class: mostFrequentClass,
        confidence: avgConfidence
    };
}

// Extract pose features from keypoints with improved normalization
function extractPoseFeatures(keypoints) {
    // Create a feature vector from landmark positions
    const features = [];
    
    // Extract keypoint positions and scores
    keypoints.forEach(keypoint => {
        features.push(keypoint.position.x);
        features.push(keypoint.position.y);
        features.push(keypoint.score || 0);
    });
    
    // Calculate additional posture-specific features
    const postureFeatures = calculatePostureFeatures(keypoints);
    features.push(...postureFeatures);
    
    // Improved normalization using z-score normalization
    const normalizedFeatures = normalizeFeatures(features);
    
    // Pad or truncate to match model input size (14739 features)
    const targetSize = 14739;
    while (normalizedFeatures.length < targetSize) {
        normalizedFeatures.push(0);
    }
    
    return tf.tensor2d([normalizedFeatures.slice(0, targetSize)], [1, targetSize]);
}

// Calculate posture-specific features
function calculatePostureFeatures(keypoints) {
    const features = [];
    
    // Head position relative to shoulders
    if (keypoints[0] && keypoints[5] && keypoints[6]) { // nose, left_shoulder, right_shoulder
        const nose = keypoints[0].position;
        const leftShoulder = keypoints[5].position;
        const rightShoulder = keypoints[6].position;
        
        const shoulderCenterX = (leftShoulder.x + rightShoulder.x) / 2;
        const shoulderCenterY = (leftShoulder.y + rightShoulder.y) / 2;
        
        // Head forward/backward position
        const headForward = nose.x - shoulderCenterX;
        features.push(headForward);
        
        // Head height relative to shoulders
        const headHeight = shoulderCenterY - nose.y;
        features.push(headHeight);
        
        // Head tilt (using eyes if available)
        if (keypoints[1] && keypoints[2]) { // left_eye, right_eye
            const leftEye = keypoints[1].position;
            const rightEye = keypoints[2].position;
            const headTilt = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
            features.push(headTilt);
        } else {
            features.push(0);
        }
    } else {
        features.push(0, 0, 0);
    }
    
    // Shoulder alignment
    if (keypoints[5] && keypoints[6]) {
        const leftShoulder = keypoints[5].position;
        const rightShoulder = keypoints[6].position;
        
        const shoulderSlope = Math.atan2(rightShoulder.y - leftShoulder.y, rightShoulder.x - leftShoulder.x);
        features.push(shoulderSlope);
        
        const shoulderHeightDiff = Math.abs(leftShoulder.y - rightShoulder.y);
        features.push(shoulderHeightDiff);
        
        // Shoulder width (normalized)
        const shoulderWidth = Math.sqrt(
            Math.pow(rightShoulder.x - leftShoulder.x, 2) + 
            Math.pow(rightShoulder.y - leftShoulder.y, 2)
        );
        features.push(shoulderWidth);
    } else {
        features.push(0, 0, 0);
    }
    
    // Spine straightness (shoulder to hip alignment)
    if (keypoints[5] && keypoints[6] && keypoints[11] && keypoints[12]) {
        const leftShoulder = keypoints[5].position;
        const rightShoulder = keypoints[6].position;
        const leftHip = keypoints[11].position;
        const rightHip = keypoints[12].position;
        
        const shoulderCenterX = (leftShoulder.x + rightShoulder.x) / 2;
        const hipCenterX = (leftHip.x + rightHip.x) / 2;
        
        const spineAlignment = Math.abs(shoulderCenterX - hipCenterX);
        features.push(spineAlignment);
        
        // Spine angle
        const spineAngle = Math.atan2(hipCenterX - shoulderCenterX, leftHip.y - leftShoulder.y);
        features.push(spineAngle);
    } else {
        features.push(0, 0);
    }
    
    // Additional posture indicators
    if (keypoints[7] && keypoints[8] && keypoints[5] && keypoints[6]) { // elbows and shoulders
        const leftElbow = keypoints[7].position;
        const rightElbow = keypoints[8].position;
        const leftShoulder = keypoints[5].position;
        const rightShoulder = keypoints[6].position;
        
        // Arm angles (indicator of slouching)
        const leftArmAngle = Math.atan2(leftElbow.y - leftShoulder.y, leftElbow.x - leftShoulder.x);
        const rightArmAngle = Math.atan2(rightElbow.y - rightShoulder.y, rightElbow.x - rightShoulder.x);
        
        features.push(leftArmAngle, rightArmAngle);
    } else {
        features.push(0, 0);
    }
    
    return features;
}

// Improved feature normalization using z-score
function normalizeFeatures(features) {
    const mean = features.reduce((sum, val) => sum + val, 0) / features.length;
    const variance = features.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / features.length;
    const stdDev = Math.sqrt(variance);
    
    return features.map(f => stdDev > 0 ? (f - mean) / stdDev : 0);
}

// Update prediction results in the UI with improved feedback
function updatePredictionResults(prediction) {
    const { class: predictedClass, confidence, isStable } = prediction;
    
    // Always show the prediction
    updatePrediction(predictedClass, getClassType(predictedClass));
    
    // Update feedback with more detailed information
    const feedback = getDetailedFeedback(prediction);
    updateFeedback(feedback);
    
    // Update confidence
    const confidencePercent = Math.round(confidence * 100);
    updateConfidence(confidencePercent);
    
    // Update status based on stability
    if (isStable) {
        updateStatus('Stable detection');
    } else {
        updateStatus('Low confidence - hold still');
    }
}

// Update accuracy metrics in the UI
function updateAccuracyMetrics(poseQuality, prediction) {
    // Update pose quality
    if (poseQualityElement) {
        const qualityPercent = Math.round(poseQuality * 100);
        poseQualityElement.textContent = `${qualityPercent}%`;
        poseQualityElement.className = `metric-value ${qualityPercent > 70 ? 'high' : qualityPercent > 40 ? 'medium' : 'low'}`;
    }
    
    // Update consistency score
    if (consistencyScoreElement) {
        let consistency = 0.5; // Default to neutral
        if (prediction && prediction.class) {
            // Create a temporary prediction object for consistency checking
            const tempPrediction = { class: prediction.class };
            consistency = checkPoseConsistency(tempPrediction);
        }
        const consistencyPercent = Math.round(consistency * 100);
        consistencyScoreElement.textContent = `${consistencyPercent}%`;
        consistencyScoreElement.className = `metric-value ${consistencyPercent > 80 ? 'high' : consistencyPercent > 60 ? 'medium' : 'low'}`;
    }
    
    // Update adaptive threshold
    if (adaptiveThresholdElement) {
        const currentThreshold = calculateAdaptiveThreshold();
        const thresholdPercent = Math.round(currentThreshold * 100);
        adaptiveThresholdElement.textContent = `${thresholdPercent}%`;
        adaptiveThresholdElement.className = `metric-value ${thresholdPercent < 75 ? 'high' : thresholdPercent < 85 ? 'medium' : 'low'}`;
    }
}

// Get detailed feedback based on prediction and pose analysis
function getDetailedFeedback(prediction) {
    const { class: predictedClass, confidence, isStable } = prediction;
    
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
function drawPose(keypoints) {
    if (!keypoints) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw keypoints
    drawKeypoints(keypoints);
    
    // Draw skeleton
    drawSkeleton(keypoints);
}

// Draw keypoints
function drawKeypoints(keypoints) {
    keypoints.forEach((keypoint, index) => {
        if (keypoint.score > 0.2) {
            const x = keypoint.position.x;
            const y = keypoint.position.y;
            
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, 2 * Math.PI);
            ctx.fillStyle = '#00ff00';
            ctx.fill();
            
            ctx.beginPath();
            ctx.arc(x, y, 8, 0, 2 * Math.PI);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    });
}

// Draw skeleton connections
function drawSkeleton(keypoints) {
    // PoseNet Pose connections (17 keypoints)
    const connections = [
        [0, 1],   // nose to left_eye
        [0, 2],   // nose to right_eye
        [1, 3],   // left_eye to left_ear
        [2, 4],   // right_eye to right_ear
        [5, 6],   // left_shoulder to right_shoulder
        [5, 7],   // left_shoulder to left_elbow
        [7, 9],   // left_elbow to left_wrist
        [6, 8],   // right_shoulder to right_elbow
        [8, 10],  // right_elbow to right_wrist
        [5, 11],  // left_shoulder to left_hip
        [6, 12],  // right_shoulder to right_hip
        [11, 12], // left_hip to right_hip
        [11, 13], // left_hip to left_knee
        [13, 15], // left_knee to left_ankle
        [12, 14], // right_hip to right_knee
        [14, 16]  // right_knee to right_ankle
    ];
    
    connections.forEach(([first, second]) => {
        const firstPoint = keypoints[first];
        const secondPoint = keypoints[second];
        
        if (firstPoint && secondPoint && 
            firstPoint.score > 0.2 && secondPoint.score > 0.2) {
            
            const x1 = firstPoint.position.x;
            const y1 = firstPoint.position.y;
            const x2 = secondPoint.position.x;
            const y2 = secondPoint.position.y;
            
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 3;
            ctx.stroke();
        }
    });
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

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init); 