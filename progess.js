// Progress Page JavaScript

let isPaused = false;
let updateInterval;
let foundPassword = null;
let startTime = Date.now();

document.addEventListener('DOMContentLoaded', () => {
    initProgress();
    connectToServer();
});

function initProgress() {
    // Start progress simulation
    updateInterval = setInterval(updateProgress, 100);
}

function connectToServer() {
    // Try WebSocket first
    try {
        const ws = new WebSocket('ws://localhost:8080/ws/progress');
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            updateDisplay(data);
        };
        
        ws.onerror = () => {
            // Fall back to polling
            startPolling();
        };
    } catch (e) {
        startPolling();
    }
}

function startPolling() {
    setInterval(async () => {
        try {
            const response = await fetch('/api/status');
            const data = await response.json();
            updateDisplay(data);
        } catch (e) {
            // Demo mode
        }
    }, 500);
}

function updateProgress() {
    // Demo simulation
    const elapsed = (Date.now() - startTime) / 1000;
    const tested = Math.floor(elapsed * 5000);
    const total = 1000000;
    const percent = Math.min((tested / total) * 100, 100);
    
    const data = {
        percent: percent,
        tested: tested,
        total: total,
        speed: 5000 + Math.floor(Math.random() * 1000),
        elapsed: elapsed,
        current: generateRandomPassword(),
        status: percent >= 100 ? 'failed' : 'running'
    };
    
    updateDisplay(data);
    
    // Simulate finding password at 45%
    if (percent > 45 && percent < 46 && !foundPassword) {
        foundPassword = 'MyP@ssw0rd2024!';
        showResults();
    }
}

function updateDisplay(data) {
    // Update circle
    const circle = document.getElementById('circleFill');
    const circumference = 2 * Math.PI * 42;
    const offset = circumference - (data.percent / 100) * circumference;
    circle.style.strokeDashoffset = offset;
    
    document.getElementById('percentText').textContent = Math.floor(data.percent) + '%';
    
    // Update stats
    document.getElementById('speedStat').textContent = (data.speed / 1000).toFixed(1) + 'k';
    document.getElementById('testedStat').textContent = formatNumber(data.tested);
    document.getElementById('timeStat').textContent = formatTime(data.elapsed);
    
    // Update linear progress
    document.getElementById('linearFill').style.width = data.percent + '%';
    document.getElementById('currentAttempt').textContent = formatNumber(data.tested);
    document.getElementById('totalAttempts').textContent = formatNumber(data.total);
    
    // Update current password
    if (data.current) {
        document.getElementById('currentPassword').textContent = data.current;
    }
    
    // Add to attempts list
    if (data.current && Math.random() > 0.7) {
        addAttempt(data.current);
    }
}

function generateRandomPassword() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    const patterns = [
        () => 'Pass' + Math.floor(Math.random() * 9999),
        () => 'Admin' + String.fromCharCode(65 + Math.floor(Math.random() * 26)) + Math.floor(Math.random() * 99),
        () => 'Welcome' + Math.floor(Math.random() * 999),
        () => 'Password' + String.fromCharCode(33 + Math.floor(Math.random() * 15)),
        () => {
            let result = '';
            for (let i = 0; i < 10; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return result;
        }
    ];
    
    const pattern = patterns[Math.floor(Math.random() * patterns.length)];
    return pattern();
}

function addAttempt(password) {
    const list = document.getElementById('attemptsList');
    const row = document.createElement('div');
    row.className = 'attempt-row';
    row.innerHTML = `
        <span>${password}</span>
        <span style="color: var(--danger)">✗</span>
    `;
    list.insertBefore(row, list.firstChild);
    
    // Keep only last 20
    while (list.children.length > 20) {
        list.removeChild(list.lastChild);
    }
}

function showResults() {
    clearInterval(updateInterval);
    
    document.getElementById('statusBar').style.display = 'none';
    document.querySelector('.progress-circle-container').style.display = 'none';
    document.querySelector('.stats-container').style.display = 'none';
    document.querySelector('.linear-progress').style.display = 'none';
    document.querySelector('.current-password-box').style.display = 'none';
    document.querySelector('.attempts-section').style.display = 'none';
    
    document.getElementById('resultsPanel').classList.remove('hidden');
    
    // Fill results
    const network = JSON.parse(sessionStorage.getItem('targetNetwork') || '{}');
    document.getElementById('resultNetwork').textContent = network.ssid || 'Unknown';
    document.getElementById('resultTime').textContent = formatTime((Date.now() - startTime) / 1000);
    document.getElementById('resultAttempts').textContent = formatNumber(Math.floor((Date.now() - startTime) / 1000 * 5000));
    
    // Confetti effect
    createConfetti();
}

function togglePassword() {
    const span = document.getElementById('passwordText');
    span.textContent = span.textContent === '••••••••' ? foundPassword : '••••••••';
}

function copyPassword() {
    navigator.clipboard.writeText(foundPassword).then(() => {
        showToast('Password copied!');
    });
}

function exportResult() {
    const result = {
        password: foundPassword,
        network: JSON.parse(sessionStorage.getItem('targetNetwork') || '{}'),
        timestamp: new Date().toISOString(),
        config: JSON.parse(sessionStorage.getItem('crackConfig') || '{}')
    };
    
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crack-result-${Date.now()}.json`;
    a.click();
}

function togglePause() {
    isPaused = !isPaused;
    const btn = document.getElementById('pauseBtn');
    const pulse = document.querySelector('.status-pulse');
    
    if (isPaused) {
        btn.textContent = '▶️';
        pulse.classList.remove('running');
        pulse.classList.add('paused');
        document.getElementById('statusText').textContent = 'Paused';
        clearInterval(updateInterval);
    } else {
        btn.textContent = '⏸️';
        pulse.classList.remove('paused');
        pulse.classList.add('running');
        document.getElementById('statusText').textContent = 'Cracking in progress...';
        updateInterval = setInterval(updateProgress, 100);
    }
}

function stopAttack() {
    if (confirm('Stop the attack?')) {
        clearInterval(updateInterval);
        window.location.href = 'index.html';
    }
}

function createConfetti() {
    // Simple confetti effect
    for (let i = 0; i < 50; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.style.cssText = `
                position: fixed;
                width: 10px;
                height: 10px;
                background: hsl(${Math.random() * 360}, 100%, 50%);
                left: ${Math.random() * 100}vw;
                top: -10px;
                border-radius: 50%;
                animation: fall ${2 + Math.random() * 2}s linear;
                z-index: 1000;
            `;
            document.body.appendChild(confetti);
            setTimeout(() => confetti.remove(), 4000);
        }, i * 50);
    }
}

// Add fall animation
const style = document.createElement('style');
style.textContent = `
    @keyframes fall {
        to {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Utility functions
function formatNumber(num) {
    if (num > 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num > 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 100px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--success);
        color: white;
        padding: 15px 25px;
        border-radius: 25px;
        z-index: 1000;
        animation: fadeIn 0.3s;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

// Menu toggle
function toggleMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    sidebar.classList.toggle('open');
    overlay.classList.toggle('show');
    document.body.style.overflow = sidebar.classList.contains('open') ? 'hidden' : '';
}