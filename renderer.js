// Global variables
let model;
let poseNet;
let webcam;
let canvas;
let ctx;
let isRunning = false;
let animationId;

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
        // Get pose keypoints using PoseNet
        const pose = await poseNet.estimatePoses(video, {
            flipHorizontal: false,
            maxDetections: 1,
            scoreThreshold: 0.3,
            nmsRadius: 20
        });
        
        if (pose.length > 0 && pose[0].keypoints) {
            // Extract keypoints and create feature vector
            const keypoints = pose[0].keypoints;
            const features = extractPoseFeatures(keypoints);
            
            // Make prediction
            const prediction = await model.predict(features);
            
            // Update UI with results
            updatePredictionResults(prediction);
            
            // Draw pose skeleton
            drawPose(keypoints);
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

// Extract pose features from keypoints
function extractPoseFeatures(keypoints) {
    // Create a feature vector from landmark positions
    const features = [];
    
    keypoints.forEach(keypoint => {
        features.push(keypoint.position.x);
        features.push(keypoint.position.y);
        features.push(keypoint.score || 0); // PoseNet uses 'score'
    });
    
    // Normalize features (simple min-max normalization)
    const min = Math.min(...features);
    const max = Math.max(...features);
    const normalizedFeatures = features.map(f => (f - min) / (max - min));
    
    // Pad or truncate to match model input size (14739 features)
    const targetSize = 14739;
    while (normalizedFeatures.length < targetSize) {
        normalizedFeatures.push(0);
    }
    
    return tf.tensor2d([normalizedFeatures.slice(0, targetSize)], [1, targetSize]);
}

// Update prediction results in the UI
function updatePredictionResults(prediction) {
    // Get prediction probabilities
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
    
    // Update prediction label
    updatePrediction(predictedClass, getClassType(predictedClass));
    
    // Update feedback
    const feedback = feedbackMessages[predictedClass] || 'Analyzing posture...';
    updateFeedback(feedback);
    
    // Update confidence
    const confidence = Math.round(maxProb * 100);
    updateConfidence(confidence);
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