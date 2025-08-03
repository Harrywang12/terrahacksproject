// Dashboard and Progress Tracking System
class DashboardManager {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.getElementById('dashboard-btn')?.addEventListener('click', () => this.showDashboard());
        document.getElementById('close-dashboard')?.addEventListener('click', () => this.hideDashboard());
        
        // Close dashboard when clicking outside
        document.getElementById('dashboard-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'dashboard-modal') {
                this.hideDashboard();
            }
        });
    }

    showDashboard() {
        document.getElementById('dashboard-modal').classList.remove('hidden');
        this.loadDashboardData();
        this.initChart();
    }

    hideDashboard() {
        document.getElementById('dashboard-modal').classList.add('hidden');
    }

    loadDashboardData() {
        const user = window.authManager.getCurrentUser();
        if (!user) {
            console.log('No user logged in');
            return;
        }

        const data = user.postureData;
        console.log('Loading dashboard data:', data);
        
        // Update stats overview
        document.getElementById('total-sessions').textContent = data.totalSessions || 0;
        document.getElementById('total-time').textContent = this.formatTime(data.totalTime || 0);
        document.getElementById('avg-posture').textContent = `${Math.round(data.avgGoodPosture || 0)}%`;
        
        // Calculate improvement
        const improvement = this.calculateImprovement(data.sessions);
        document.getElementById('improvement').textContent = `${improvement > 0 ? '+' : ''}${improvement}%`;

        // Load insights
        this.loadInsights(data);
        
        // Load recent sessions
        this.loadRecentSessions(data.sessions);
        
        // Debug info
        console.log(`Loaded ${data.sessions ? data.sessions.length : 0} sessions`);
    }

    formatTime(minutes) {
        if (minutes < 60) return `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}h ${mins}m`;
    }

    calculateImprovement(sessions) {
        if (!sessions || sessions.length < 2) return 0;
        
        // Compare last 3 sessions with previous 3 sessions
        const recent = sessions.slice(-3);
        const previous = sessions.slice(-6, -3);
        
        if (previous.length === 0) return 0;
        
        const recentAvg = recent.reduce((sum, s) => sum + s.goodPosturePercentage, 0) / recent.length;
        const previousAvg = previous.reduce((sum, s) => sum + s.goodPosturePercentage, 0) / previous.length;
        
        return Math.round(recentAvg - previousAvg);
    }

    loadInsights(data) {
        const container = document.getElementById('insights-container');
        container.innerHTML = '';

        const insights = this.generateInsights(data);
        
        insights.forEach(insight => {
            const insightEl = document.createElement('div');
            insightEl.className = `insight-item ${insight.type}`;
            insightEl.innerHTML = `
                <div class="insight-icon">${insight.icon}</div>
                <div class="insight-content">
                    <div class="insight-title">${insight.title}</div>
                    <div class="insight-description">${insight.description}</div>
                </div>
            `;
            container.appendChild(insightEl);
        });
    }

    generateInsights(data) {
        const insights = [];
        const sessions = data.sessions || [];
        const avgPosture = data.avgGoodPosture || 0;
        const improvement = this.calculateImprovement(sessions);

        // Performance insights
        if (avgPosture >= 85) {
            insights.push({
                type: 'excellent',
                icon: '🌟',
                title: 'Excellent Posture!',
                description: 'You\'re maintaining great posture consistently. Keep up the fantastic work!'
            });
        } else if (avgPosture >= 70) {
            insights.push({
                type: 'good',
                icon: '👍',
                title: 'Good Progress',
                description: 'Your posture is improving. Try to be more mindful during longer work sessions.'
            });
        } else if (avgPosture >= 50) {
            insights.push({
                type: 'warning',
                icon: '⚠️',
                title: 'Needs Attention',
                description: 'Your posture needs improvement. Consider setting hourly reminders to check your position.'
            });
        } else {
            insights.push({
                type: 'urgent',
                icon: '🚨',
                title: 'Urgent Action Required',
                description: 'Poor posture detected consistently. Consider consulting a healthcare professional and setting up ergonomic workspace improvements.'
            });
        }

        // Improvement trend
        if (improvement > 10) {
            insights.push({
                type: 'excellent',
                icon: '📈',
                title: 'Great Improvement!',
                description: `Your posture has improved by ${improvement}% in recent sessions.`
            });
        } else if (improvement < -10) {
            insights.push({
                type: 'warning',
                icon: '📉',
                title: 'Declining Trend',
                description: `Your posture has declined by ${Math.abs(improvement)}% recently. Take breaks more frequently.`
            });
        }

        // Session frequency
        const recentSessions = sessions.filter(s => {
            const sessionDate = new Date(s.timestamp);
            const daysDiff = (Date.now() - sessionDate.getTime()) / (1000 * 60 * 60 * 24);
            return daysDiff <= 7;
        });

        if (recentSessions.length < 3) {
            insights.push({
                type: 'info',
                icon: '📅',
                title: 'Monitor More Frequently',
                description: 'Try to monitor your posture more regularly for better insights and improvement tracking.'
            });
        }

        return insights;
    }

    loadRecentSessions(sessions) {
        const container = document.getElementById('sessions-list');
        container.innerHTML = '';

        if (!sessions || sessions.length === 0) {
            container.innerHTML = `
                <div class="no-sessions">
                    <h4>No sessions recorded yet</h4>
                    <p>Start the camera and maintain posture for at least 1 minute to record your first session!</p>
                    <div style="margin-top: 15px; padding: 15px; background: rgba(0, 245, 255, 0.1); border-radius: 10px; border: 1px solid rgba(0, 245, 255, 0.3);">
                        <strong>💡 How to get session data:</strong><br>
                        1. Click "Start Camera"<br>
                        2. Position yourself in front of the camera<br>
                        3. Maintain your posture for at least 1 minute<br>
                        4. Click "Stop Camera" to save the session<br>
                        5. Open dashboard to see your progress!
                    </div>
                </div>
            `;
            return;
        }

        // Show last 5 sessions
        const recentSessions = sessions.slice(-5).reverse();
        
        recentSessions.forEach(session => {
            const sessionEl = document.createElement('div');
            sessionEl.className = 'session-item';
            
            const date = new Date(session.timestamp);
            const duration = this.formatTime(session.duration);
            const quality = this.getPostureQuality(session.goodPosturePercentage);
            
            sessionEl.innerHTML = `
                <div class="session-info">
                    <div class="session-date">${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                    <div class="session-stats">
                        <span class="session-duration">⏱️ ${duration}</span>
                        <span class="session-quality ${quality.class}">🎯 ${Math.round(session.goodPosturePercentage)}% ${quality.text}</span>
                    </div>
                </div>
            `;
            container.appendChild(sessionEl);
        });
    }

    getPostureQuality(percentage) {
        if (percentage >= 85) return { class: 'excellent', text: 'Excellent' };
        if (percentage >= 70) return { class: 'good', text: 'Good' };
        if (percentage >= 50) return { class: 'fair', text: 'Fair' };
        return { class: 'poor', text: 'Needs Work' };
    }

    initChart() {
        this.canvas = document.getElementById('progress-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.drawChart();
    }

    drawChart() {
        const user = window.authManager.getCurrentUser();
        if (!user) return;

        const sessions = user.postureData.sessions || [];
        
        // Get last 7 days of data
        const chartData = this.getChartData(sessions);
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Set up chart dimensions
        const padding = 50;
        const chartWidth = this.canvas.width - (padding * 2);
        const chartHeight = this.canvas.height - (padding * 2);
        
        // Draw background
        this.ctx.fillStyle = 'rgba(15, 15, 15, 0.9)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw grid
        this.drawGrid(padding, chartWidth, chartHeight);
        
        // Draw chart line
        this.drawChartLine(chartData, padding, chartWidth, chartHeight);
        
        // Draw data points
        this.drawDataPoints(chartData, padding, chartWidth, chartHeight);
        
        // Draw labels
        this.drawLabels(chartData, padding, chartWidth, chartHeight);
    }

    getChartData(sessions) {
        const data = [];
        const today = new Date();
        
        // Get last 7 days
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toDateString();
            
            // Find sessions for this day
            const daySessions = sessions.filter(session => {
                const sessionDate = new Date(session.timestamp);
                return sessionDate.toDateString() === dateStr;
            });
            
            // Calculate average for the day
            let avgPosture = 0;
            if (daySessions.length > 0) {
                avgPosture = daySessions.reduce((sum, s) => sum + s.goodPosturePercentage, 0) / daySessions.length;
            }
            
            data.push({
                date: date,
                label: date.toLocaleDateString([], { weekday: 'short' }),
                value: avgPosture,
                sessions: daySessions.length
            });
        }
        
        return data;
    }

    drawGrid(padding, chartWidth, chartHeight) {
        this.ctx.strokeStyle = 'rgba(0, 245, 255, 0.1)';
        this.ctx.lineWidth = 1;
        
        // Horizontal grid lines
        for (let i = 0; i <= 5; i++) {
            const y = padding + (chartHeight / 5) * i;
            this.ctx.beginPath();
            this.ctx.moveTo(padding, y);
            this.ctx.lineTo(padding + chartWidth, y);
            this.ctx.stroke();
        }
        
        // Vertical grid lines
        for (let i = 0; i <= 6; i++) {
            const x = padding + (chartWidth / 6) * i;
            this.ctx.beginPath();
            this.ctx.moveTo(x, padding);
            this.ctx.lineTo(x, padding + chartHeight);
            this.ctx.stroke();
        }
    }

    drawChartLine(data, padding, chartWidth, chartHeight) {
        if (data.length < 2) return;
        
        this.ctx.strokeStyle = '#00f5ff';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        
        data.forEach((point, index) => {
            const x = padding + (chartWidth / 6) * index;
            const y = padding + chartHeight - (point.value / 100) * chartHeight;
            
            if (index === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        });
        
        this.ctx.stroke();
        
        // Add gradient fill
        this.ctx.lineTo(padding + chartWidth, padding + chartHeight);
        this.ctx.lineTo(padding, padding + chartHeight);
        this.ctx.closePath();
        
        const gradient = this.ctx.createLinearGradient(0, padding, 0, padding + chartHeight);
        gradient.addColorStop(0, 'rgba(0, 245, 255, 0.3)');
        gradient.addColorStop(1, 'rgba(0, 245, 255, 0.05)');
        this.ctx.fillStyle = gradient;
        this.ctx.fill();
    }

    drawDataPoints(data, padding, chartWidth, chartHeight) {
        data.forEach((point, index) => {
            const x = padding + (chartWidth / 6) * index;
            const y = padding + chartHeight - (point.value / 100) * chartHeight;
            
            // Outer glow
            this.ctx.fillStyle = 'rgba(0, 245, 255, 0.3)';
            this.ctx.beginPath();
            this.ctx.arc(x, y, 8, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Inner point
            this.ctx.fillStyle = '#00f5ff';
            this.ctx.beginPath();
            this.ctx.arc(x, y, 4, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Value label
            if (point.value > 0) {
                this.ctx.fillStyle = '#ffffff';
                this.ctx.font = '12px Inter';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(`${Math.round(point.value)}%`, x, y - 15);
            }
        });
    }

    drawLabels(data, padding, chartWidth, chartHeight) {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '14px Inter';
        this.ctx.textAlign = 'center';
        
        // X-axis labels (days)
        data.forEach((point, index) => {
            const x = padding + (chartWidth / 6) * index;
            this.ctx.fillText(point.label, x, padding + chartHeight + 30);
        });
        
        // Y-axis labels (percentages)
        this.ctx.textAlign = 'right';
        for (let i = 0; i <= 5; i++) {
            const y = padding + (chartHeight / 5) * i;
            const value = 100 - (i * 20);
            this.ctx.fillText(`${value}%`, padding - 10, y + 5);
        }
    }
}

// Session Tracking for Posture Data
class SessionTracker {
    constructor() {
        this.currentSession = null;
        this.postureReadings = [];
        this.sessionStartTime = null;
    }

    startSession() {
        this.currentSession = {
            timestamp: new Date().toISOString(),
            duration: 0,
            totalReadings: 0,
            goodPostureReadings: 0,
            goodPosturePercentage: 0,
            confidence: []
        };
        this.postureReadings = [];
        this.sessionStartTime = Date.now();
        
        console.log('Posture tracking session started');
    }

    addReading(postureClass, confidence) {
        if (!this.currentSession) {
            console.log('No active session for reading');
            return;
        }

        this.postureReadings.push({
            timestamp: Date.now(),
            posture: postureClass,
            confidence: confidence
        });

        this.currentSession.totalReadings++;
        this.currentSession.confidence.push(confidence);

        if (postureClass === 'Good posture' && confidence > 0.6) {
            this.currentSession.goodPostureReadings++;
        }

        // Update percentage
        this.currentSession.goodPosturePercentage = 
            (this.currentSession.goodPostureReadings / this.currentSession.totalReadings) * 100;
        
        // Log every 50 readings to show progress
        if (this.currentSession.totalReadings % 50 === 0) {
            console.log(`Session progress: ${this.currentSession.totalReadings} readings, ${Math.round(this.currentSession.goodPosturePercentage)}% good posture`);
        }
    }

    endSession() {
        if (!this.currentSession || !this.sessionStartTime) return;

        // Calculate session duration in minutes
        this.currentSession.duration = Math.round((Date.now() - this.sessionStartTime) / (1000 * 60));

        // Only save sessions longer than 1 minute
        if (this.currentSession.duration >= 1) {
            this.saveSession();
        }

        this.currentSession = null;
        this.postureReadings = [];
        this.sessionStartTime = null;
        
        console.log('Posture tracking session ended and saved');
    }

    saveSession() {
        const user = window.authManager.getCurrentUser();
        if (!user) {
            console.log('Cannot save session: No user logged in');
            return;
        }

        // Add session to user data
        if (!user.postureData.sessions) {
            user.postureData.sessions = [];
        }

        console.log('Saving session:', this.currentSession);
        user.postureData.sessions.push(this.currentSession);
        user.postureData.totalSessions = user.postureData.sessions.length;
        
        // Update total time
        user.postureData.totalTime = (user.postureData.totalTime || 0) + this.currentSession.duration;
        
        // Update average good posture
        const totalGoodPosture = user.postureData.sessions.reduce((sum, s) => sum + s.goodPosturePercentage, 0);
        user.postureData.avgGoodPosture = totalGoodPosture / user.postureData.sessions.length;

        // Save updated user data
        window.authManager.updateUserData({ postureData: user.postureData });
        
        console.log(`Session saved! Total sessions: ${user.postureData.totalSessions}`);
    }

    getCurrentSession() {
        return this.currentSession;
    }
}

// Initialize dashboard and session tracker
window.dashboardManager = new DashboardManager();
window.sessionTracker = new SessionTracker();