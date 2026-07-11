// Configuration Page JavaScript

document.addEventListener('DOMContentLoaded', () => {
    initModeCards();
    initCharToggles();
    initSliders();
    updateEstimation();
});

function initModeCards() {
    const cards = document.querySelectorAll('.mode-card');
    
    cards.forEach(card => {
        card.addEventListener('click', () => {
            cards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            card.querySelector('input').checked = true;
            updateEstimation();
        });
    });
}

function initCharToggles() {
    const toggles = document.querySelectorAll('.charset-toggle');
    
    toggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
            toggle.classList.toggle('active');
            updateEstimation();
        });
    });
}

function initSliders() {
    const range = document.getElementById('lengthRange');
    const minInput = document.getElementById('minLength');
    const maxInput = document.getElementById('maxLength');
    
    range.addEventListener('input', (e) => {
        maxInput.value = e.target.value;
        updateEstimation();
    });
}

function adjustLength(field, delta) {
    const input = document.getElementById(field + 'Length');
    let value = parseInt(input.value) + delta;
    value = Math.max(1, Math.min(64, value));
    input.value = value;
    updateEstimation();
}

function updateEstimation() {
    const minLen = parseInt(document.getElementById('minLength').value) || 8;
    const maxLen = parseInt(document.getElementById('maxLength').value) || 16;
    
    let charsetSize = 0;
    document.querySelectorAll('.charset-toggle.active').forEach(toggle => {
        const checkbox = toggle.querySelector('input');
        switch(checkbox.value) {
            case 'lower': charsetSize += 26; break;
            case 'upper': charsetSize += 26; break;
            case 'numbers': charsetSize += 10; break;
            case 'symbols': charsetSize += 20; break;
            case 'special': charsetSize += 50; break;
            case 'spaces': charsetSize += 1; break;
        }
    });
    
    const mode = document.querySelector('input[name="attackMode"]:checked').value;
    let combinations = 0;
    
    if (mode === 'brute') {
        for (let i = minLen; i <= maxLen; i++) {
            combinations += Math.pow(charsetSize, i);
        }
    } else if (mode === 'dictionary') {
        combinations = 10000;
        if (document.getElementById('ruleNumbers').checked) combinations *= 100;
        if (document.getElementById('ruleSymbols').checked) combinations *= 50;
        if (document.getElementById('ruleLeet').checked) combinations *= 5;
    } else {
        combinations = 50000 * Math.pow(charsetSize, 3);
    }
    
    // Format number
    let formatted;
    if (combinations > 1e12) {
        formatted = (combinations / 1e12).toFixed(2) + ' trillion';
    } else if (combinations > 1e9) {
        formatted = (combinations / 1e9).toFixed(2) + ' billion';
    } else if (combinations > 1e6) {
        formatted = (combinations / 1e6).toFixed(2) + ' million';
    } else {
        formatted = combinations.toLocaleString();
    }
    
    document.getElementById('estCombinations').textContent = formatted;
    
    // Estimate time (assuming 10,000 H/s)
    const seconds = combinations / 10000;
    let timeText;
    if (seconds > 86400) {
        timeText = Math.floor(seconds / 86400) + ' days';
    } else if (seconds > 3600) {
        timeText = Math.floor(seconds / 3600) + ' hours';
    } else if (seconds > 60) {
        timeText = Math.floor(seconds / 60) + ' minutes';
    } else {
        timeText = Math.floor(seconds) + ' seconds';
    }
    
    document.getElementById('estTime').textContent = timeText;
}

function startAttack() {
    // Collect all configuration
    const config = {
        attackMode: document.querySelector('input[name="attackMode"]:checked').value,
        charsets: Array.from(document.querySelectorAll('.charset-toggle.active')).map(t => 
            t.querySelector('input').value
        ),
        minLength: document.getElementById('minLength').value,
        maxLength: document.getElementById('maxLength').value,
        rules: {
            numbers: document.getElementById('ruleNumbers').checked,
            symbols: document.getElementById('ruleSymbols').checked,
            leet: document.getElementById('ruleLeet').checked,
            case: document.getElementById('ruleCase').checked
        },
        customWords: document.getElementById('customWords').value,
        target: JSON.parse(sessionStorage.getItem('targetNetwork') || '{}')
    };
    
    // Save configuration
    sessionStorage.setItem('crackConfig', JSON.stringify(config));
    
    // Send to server
    fetch('/api/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            window.location.href = 'progress.html';
        } else {
            showToast('Failed to start: ' + data.error);
        }
    })
    .catch(() => {
        // Demo mode - proceed anyway
        window.location.href = 'progress.html';
    });
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 100px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--danger);
        color: white;
        padding: 15px 25px;
        border-radius: 25px;
        z-index: 1000;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Menu toggle
function toggleMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    sidebar.classList.toggle('open');
    overlay.classList.toggle('show');
    document.body.style.overflow = sidebar.classList.contains('open') ? 'hidden' : '';
}