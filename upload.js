// Upload Page JavaScript - Mobile & Desktop
let selectedFile = null;
let selectedNetwork = null;

document.addEventListener('DOMContentLoaded', () => {
    initUpload();
    checkSession();
});

function initUpload() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');

    // Click to upload
    dropZone.addEventListener('click', () => fileInput.click());

    // File input change
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    // Drag and drop (desktop)
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    dropZone.addEventListener('dragenter', () => dropZone.classList.add('dragover'));
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
        dropZone.classList.remove('dragover');
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) handleFile(files[0]);
    });
}

async function handleFile(file) {
    if (!file.name.match(/\.(cap|pcap|pcapng)$/i)) {
        showToast('Please select a valid .cap, .pcap, or .pcapng file');
        return;
    }

    selectedFile = file;
    
    // Show file info
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileSize').textContent = formatBytes(file.size);
    document.getElementById('fileFormat').textContent = file.name.split('.').pop().toUpperCase();
    document.getElementById('fileInfo').classList.remove('hidden');

    // Analyze file
    showLoading('Analyzing capture file...');
    
    try {
        // Simulate analysis (replace with actual API call)
        await simulateAnalysis();
        
        // Show mock networks for demo
        const networks = [
            { ssid: 'HomeWiFi_5G', bssid: 'AA:BB:CC:DD:EE:FF', signal: '-45', security: 'WPA2' },
            { ssid: 'Office_Guest', bssid: '11:22:33:44:55:66', signal: '-62', security: 'WPA' }
        ];
        
        displayNetworks(networks);
        hideLoading();
        
    } catch (error) {
        hideLoading();
        showToast('Analysis failed: ' + error.message);
    }
}

function simulateAnalysis() {
    return new Promise(resolve => setTimeout(resolve, 1500));
}

function displayNetworks(networks) {
    const container = document.getElementById('networksList');
    container.innerHTML = '';
    
    networks.forEach((network, index) => {
        const div = document.createElement('div');
        div.className = 'network-item';
        div.innerHTML = `
            <div class="network-icon">📶</div>
            <div class="network-info">
                <div class="network-name">${escapeHtml(network.ssid)}</div>
                <div class="network-mac">${network.bssid}</div>
            </div>
            <div class="network-signal">${network.signal} dBm</div>
        `;
        
        div.addEventListener('click', () => selectNetwork(div, network));
        container.appendChild(div);
    });
    
    document.getElementById('networksSection').classList.remove('hidden');
}

function selectNetwork(element, network) {
    // Remove previous selection
    document.querySelectorAll('.network-item').forEach(el => {
        el.classList.remove('selected');
    });
    
    // Add selection
    element.classList.add('selected');
    selectedNetwork = network;
    
    // Save to session
    sessionStorage.setItem('targetNetwork', JSON.stringify(network));
    sessionStorage.setItem('captureFile', selectedFile.name);
    
    // Show next button
    document.getElementById('nextBtn').classList.remove('hidden');
    
    // Haptic feedback on mobile
    if (navigator.vibrate) {
        navigator.vibrate(50);
    }
}

function goToConfig() {
    if (!selectedNetwork) {
        showToast('Please select a network first');
        return;
    }
    window.location.href = 'config.html';
}

function clearFile() {
    selectedFile = null;
    selectedNetwork = null;
    document.getElementById('fileInfo').classList.add('hidden');
    document.getElementById('networksSection').classList.add('hidden');
    document.getElementById('nextBtn').classList.add('hidden');
    document.getElementById('fileInput').value = '';
}

function checkSession() {
    // Restore previous selection if exists
    const saved = sessionStorage.getItem('targetNetwork');
    if (saved && location.search.includes('restore')) {
        // Would restore here
    }
}

// Utility functions
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message) {
    // Simple toast implementation
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 100px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.9);
        color: white;
        padding: 15px 25px;
        border-radius: 25px;
        z-index: 1000;
        font-size: 0.95rem;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function showLoading(text) {
    // Implementation for loading overlay
}

function hideLoading() {
    // Implementation for hiding loading
}

// Mobile menu toggle
function toggleMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    
    sidebar.classList.toggle('open');
    overlay.classList.toggle('show');
    
    // Prevent body scroll when menu open
    document.body.style.overflow = sidebar.classList.contains('open') ? 'hidden' : '';
}