# 🧘 Posture Checker

A desktop application that uses AI to monitor your posture in real-time using your webcam. Built with Electron and TensorFlow.js, featuring a Teachable Machine pose classification model.

## ✨ Features

- **Real-time Posture Detection**: Uses your webcam to continuously monitor your sitting posture
- **AI-Powered Classification**: Leverages a custom-trained Teachable Machine model to classify posture types
- **Visual Feedback**: Displays skeleton overlay on the video feed with keypoints
- **Smart Feedback**: Provides personalized advice based on detected posture
- **Confidence Scoring**: Shows how confident the AI is in its posture assessment
- **Modern UI**: Clean, responsive design with dark mode support
- **Offline Operation**: Works completely offline once the model is loaded

## 🎯 Posture Classes

The app can detect and provide feedback for:

- **Good posture** ✅ - "Great posture! Keep it up."
- **Bad posture** ❌ - "Sit tall and relax your shoulders."
- **Leaning Forward** ❌ - "Bring your head back in line with your spine."

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- A webcam

### Installation

1. **Clone or download this repository**

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the application**
   ```bash
   npm start
   ```

4. **Grant camera permissions** when prompted

5. **Click "Start Camera"** to begin posture monitoring

## 📁 Project Structure

```
posture-checker/
├── main.js              # Electron main process
├── index.html           # Main UI interface
├── renderer.js          # Webcam and AI logic
├── style.css            # Modern styling
├── preload.js           # Security context
├── package.json         # Dependencies and scripts
├── README.md           # This file
└── my-pose-model/      # AI model files
    ├── model.json
    ├── metadata.json
    └── weights.bin
```

## 🛠️ Development

### Running in Development Mode
```bash
npm run dev
```

### Building for Distribution
```bash
npm run build
```

### Creating Installers
```bash
npm run dist
```

## 🎨 UI Features

- **Responsive Design**: Works on different screen sizes
- **Dark Mode Support**: Automatically adapts to system preferences
- **Real-time Updates**: Live posture classification and feedback
- **Visual Indicators**: Color-coded posture status
- **Confidence Bar**: Visual representation of AI confidence
- **Skeleton Overlay**: Real-time pose keypoints and connections

## 🔧 Technical Details

- **Framework**: Electron for cross-platform desktop app
- **AI Model**: TensorFlow.js with Teachable Machine pose classification
- **Pose Detection**: MediaPipe PoseNet for keypoint extraction
- **Frontend**: Vanilla JavaScript with modern CSS
- **Model Loading**: Local model files for offline operation

## 📱 Usage Instructions

1. **Launch the app** and wait for the model to load
2. **Position yourself** in front of your webcam
3. **Click "Start Camera"** to begin monitoring
4. **Sit naturally** while the app analyzes your posture
5. **Follow the feedback** to improve your posture
6. **Click "Stop Camera"** when finished

## 🎯 Tips for Best Results

- Ensure good lighting in your workspace
- Position yourself so your full upper body is visible
- Sit at a comfortable distance from the camera
- Keep the camera at eye level for optimal detection
- Allow the app a few seconds to calibrate when you start

## 🔒 Privacy

- All processing happens locally on your device
- No video data is sent to external servers
- Camera access is only used for real-time posture analysis
- You can stop the camera at any time

## 🐛 Troubleshooting

### Camera Not Working
- Check camera permissions in your system settings
- Ensure no other applications are using the camera
- Try refreshing the app

### Model Loading Issues
- Verify the `my-pose-model/` folder contains all required files
- Check that `model.json`, `metadata.json`, and `weights.bin` are present
- Ensure the files are not corrupted

### Performance Issues
- Close other resource-intensive applications
- Reduce the camera resolution if needed
- Ensure you have sufficient RAM available

## 📄 License

MIT License - feel free to use this project for personal or commercial purposes.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

If you encounter any issues or have questions, please open an issue on the repository.

---

**Note**: This application is for educational and wellness purposes. It should not replace professional medical advice for posture-related health concerns. 