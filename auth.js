// Authentication System
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.users = JSON.parse(localStorage.getItem('postureUsers') || '{}');
        this.init();
    }

    init() {
        // Check if user is already logged in
        const savedUser = localStorage.getItem('currentPostureUser');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            this.showMainApp();
        } else {
            this.showLoginScreen();
        }

        // Set up event listeners
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Form switching
        document.getElementById('show-register')?.addEventListener('click', () => this.showRegisterForm());
        document.getElementById('show-login')?.addEventListener('click', () => this.showLoginForm());

        // Authentication actions
        document.getElementById('login-btn')?.addEventListener('click', () => this.handleLogin());
        document.getElementById('register-btn')?.addEventListener('click', () => this.handleRegister());
        document.getElementById('logout-btn')?.addEventListener('click', () => this.handleLogout());

        // Enter key support
        document.getElementById('login-form')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleLogin();
        });
        document.getElementById('register-form')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleRegister();
        });
    }

    showLoginForm() {
        document.getElementById('login-form').classList.add('active');
        document.getElementById('register-form').classList.remove('active');
    }

    showRegisterForm() {
        document.getElementById('register-form').classList.add('active');
        document.getElementById('login-form').classList.remove('active');
    }

    showLoginScreen() {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('main-app').classList.add('hidden');
    }

    showMainApp() {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
    }

    async handleLogin() {
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;

        if (!email || !password) {
            this.showError('Please fill in all fields');
            return;
        }

        const user = this.users[email];
        if (!user || user.password !== this.hashPassword(password)) {
            this.showError('Invalid email or password');
            return;
        }

        // Update last login
        user.lastLogin = new Date().toISOString();
        this.users[email] = user;
        localStorage.setItem('postureUsers', JSON.stringify(this.users));

        this.currentUser = user;
        localStorage.setItem('currentPostureUser', JSON.stringify(user));

        this.showSuccess('Login successful!');
        setTimeout(() => this.showMainApp(), 1000);
    }

    async handleRegister() {
        const name = document.getElementById('register-name').value.trim();
        const email = document.getElementById('register-email').value.trim();
        const password = document.getElementById('register-password').value;

        if (!name || !email || !password) {
            this.showError('Please fill in all fields');
            return;
        }

        if (password.length < 6) {
            this.showError('Password must be at least 6 characters');
            return;
        }

        if (this.users[email]) {
            this.showError('Email already registered');
            return;
        }

        // Create new user
        const newUser = {
            name,
            email,
            password: this.hashPassword(password),
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString(),
            postureData: {
                sessions: [],
                totalTime: 0,
                totalSessions: 0,
                avgGoodPosture: 0,
                weeklyGoal: 80 // Default weekly goal of 80% good posture
            }
        };

        this.users[email] = newUser;
        localStorage.setItem('postureUsers', JSON.stringify(this.users));

        this.currentUser = newUser;
        localStorage.setItem('currentPostureUser', JSON.stringify(newUser));

        this.showSuccess('Account created successfully!');
        setTimeout(() => this.showMainApp(), 1000);
    }

    handleLogout() {
        this.currentUser = null;
        localStorage.removeItem('currentPostureUser');
        this.showLoginScreen();
        
        // Clear any running sessions
        if (typeof window.stopCamera === 'function') {
            window.stopCamera();
        }
    }

    hashPassword(password) {
        // Simple hash function for demo purposes
        // In production, use proper password hashing
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString();
    }

    showError(message) {
        this.showMessage(message, 'error');
    }

    showSuccess(message) {
        this.showMessage(message, 'success');
    }

    showMessage(message, type) {
        // Remove existing messages
        const existing = document.querySelector('.auth-message');
        if (existing) existing.remove();

        const messageEl = document.createElement('div');
        messageEl.className = `auth-message ${type}`;
        messageEl.textContent = message;

        const activeForm = document.querySelector('.auth-form.active');
        activeForm.appendChild(messageEl);

        setTimeout(() => messageEl.remove(), 3000);
    }

    getCurrentUser() {
        return this.currentUser;
    }

    updateUserData(data) {
        if (!this.currentUser) return;

        this.currentUser = { ...this.currentUser, ...data };
        this.users[this.currentUser.email] = this.currentUser;
        
        localStorage.setItem('postureUsers', JSON.stringify(this.users));
        localStorage.setItem('currentPostureUser', JSON.stringify(this.currentUser));
    }
}

// Initialize auth manager
window.authManager = new AuthManager();