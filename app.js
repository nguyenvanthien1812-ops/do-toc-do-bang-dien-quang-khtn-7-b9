// 3D Virtual Physics Lab - Cổng quang điện & Đồng hồ hiện số
// KHTN 7 - Bài 9: Đo tốc độ (Hình 9.3)

// State Management
const STATE = {
    // Physics Parameters
    angle: 4.0,           // Ramp incline angle in degrees
    gateAPos: 0.20,       // Position of Gate A along the track (0.0 to 1.0 meters)
    gateBPos: 0.80,       // Position of Gate B along the track (0.0 to 1.0 meters)
    g: 9.80,              // Gravitational acceleration (m/s^2)
    ballRadius: 0.022,    // Ball radius in meters (4.4cm diameter - large and visible)
    trackLength: 1.0,     // Length of the track in meters
    
    // Simulation state
    simState: 'idle',     // 'idle', 'rolling', 'finished'
    ballX: 0.0,           // Current position of the ball along the track (0.0 to 1.0)
    ballV: 0.0,           // Current velocity of the ball (m/s)
    simTime: 0.0,         // Physics simulation time elapsed (seconds)
    releaseTime: 0,       // Timestamp when electromagnet was turned off
    
    // Photogate Timing
    timeGateA: null,      // Time when ball crossed Gate A (s)
    timeGateB: null,      // Time when ball crossed Gate B (s)
    gateATriggered: false,
    gateBTriggered: false,
    
    // Manual Stopwatch state
    manualState: 'idle',     // 'idle', 'running', 'stopped'
    manualTimeStart: 0,
    manualTimeElapsed: 0,
    manualDisplayInterval: null,
    
    // Audio configuration
    soundEnabled: true,
    
    // UI elements
    ui: {},
    
    // Camera presets transition
    currentView: 'overview',
    cameraTransition: null,
    
    // View mode: '2d' or '3d'
    viewMode: '2d',
    
    // Lab report trials
    trials: []
};

// Web Audio API Synthesizer for procedural sounds (Zero asset dependencies!)
class SoundEngine {
    constructor() {
        this.ctx = null;
        this.rollingOsc = null;
        this.rollingGain = null;
    }

    init() {
        if (this.ctx) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.error("Web Audio API not supported", e);
        }
    }

    playClick() {
        if (!STATE.soundEnabled || !this.ctx) return;
        this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.04);
        
        gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start();
        osc.stop(this.ctx.currentTime + 0.05);
    }

    playBeep(double = false) {
        if (!STATE.soundEnabled || !this.ctx) return;
        this.init();
        
        const triggerBeep = (timeOffset) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1000, this.ctx.currentTime + timeOffset);
            
            gain.gain.setValueAtTime(0.12, this.ctx.currentTime + timeOffset);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + timeOffset + 0.08);
            
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            
            osc.start(this.ctx.currentTime + timeOffset);
            osc.stop(this.ctx.currentTime + timeOffset + 0.09);
        };

        triggerBeep(0);
        if (double) {
            triggerBeep(0.12);
        }
    }

    startRollingSound() {
        if (!STATE.soundEnabled || !this.ctx) return;
        this.init();
        if (this.rollingOsc) return;

        this.rollingOsc = this.ctx.createOscillator();
        this.rollingGain = this.ctx.createGain();
        
        // Low rumbling sound for rolling ball
        this.rollingOsc.type = 'triangle';
        this.rollingOsc.frequency.setValueAtTime(60, this.ctx.currentTime);
        
        // Add a lowpass filter to make it sound mufflier/more physical
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(120, this.ctx.currentTime);
        
        this.rollingGain.gain.setValueAtTime(0.01, this.ctx.currentTime);
        
        this.rollingOsc.connect(filter);
        filter.connect(this.rollingGain);
        this.rollingGain.connect(this.ctx.destination);
        
        this.rollingOsc.start();
    }

    updateRollingSound(speed) {
        if (!STATE.soundEnabled || !this.ctx || !this.rollingOsc) return;
        
        // Modulate frequency and volume based on rolling velocity
        const freq = 60 + Math.min(speed * 40, 100);
        const gain = 0.01 + Math.min(speed * 0.05, 0.08);
        
        this.rollingOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.05);
        this.rollingGain.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.05);
    }

    stopRollingSound() {
        if (this.rollingOsc) {
            try {
                this.rollingOsc.stop();
                this.rollingOsc.disconnect();
            } catch(e) {}
            this.rollingOsc = null;
            this.rollingGain = null;
        }
    }

    playImpact() {
        if (!STATE.soundEnabled || !this.ctx) return;
        this.init();
        
        // Solid thud + metal ring
        const time = this.ctx.currentTime;
        
        // Thud (low frequency decaying sine)
        const oscThud = this.ctx.createOscillator();
        const gainThud = this.ctx.createGain();
        oscThud.frequency.setValueAtTime(100, time);
        oscThud.frequency.exponentialRampToValueAtTime(40, time + 0.15);
        gainThud.gain.setValueAtTime(0.2, time);
        gainThud.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
        oscThud.connect(gainThud);
        gainThud.connect(this.ctx.destination);
        oscThud.start(time);
        oscThud.stop(time + 0.16);

        // Ring (high frequency metallic resonance)
        const oscRing = this.ctx.createOscillator();
        const gainRing = this.ctx.createGain();
        oscRing.type = 'sine';
        oscRing.frequency.setValueAtTime(1400, time);
        gainRing.gain.setValueAtTime(0.05, time);
        gainRing.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
        oscRing.connect(gainRing);
        gainRing.connect(this.ctx.destination);
        oscRing.start(time);
        oscRing.stop(time + 0.31);
    }
}

const sounds = new SoundEngine();

// Three.js Engine Variables
let scene, camera, renderer, controls;
let trackMesh, ballMesh, magnetMesh, supportBaseMesh, standRodMesh;
let gateAMesh, gateBMesh;
let wireAMesh, wireBMesh;
let laserBeamAMesh, laserBeamBMesh;
let stopperMesh;
let clampBotMesh, botSupportMesh;

// Track pivot in world space (corresponds to x = 0 along the track)
const TRACK_PIVOT = new THREE.Vector3(0, 0.42, -0.48);

// Setup UI References and Event Listeners
function initUI() {
    STATE.ui.angleInput = document.getElementById('input-angle');
    STATE.ui.angleVal = document.getElementById('val-angle');
    STATE.ui.gateAInput = document.getElementById('input-gate-a');
    STATE.ui.gateAVal = document.getElementById('val-gate-a');
    STATE.ui.gateBInput = document.getElementById('input-gate-b');
    STATE.ui.gateBVal = document.getElementById('val-gate-b');
    STATE.ui.distanceVal = document.getElementById('val-distance');
    
    STATE.ui.btnPower = document.getElementById('btn-power');
    STATE.ui.powerText = document.getElementById('power-text');
    STATE.ui.btnReset = document.getElementById('btn-reset');
    STATE.ui.ledTimer = document.getElementById('led-timer');
    
    STATE.ui.manualTimerDisplay = document.getElementById('manual-timer-display');
    STATE.ui.btnManualTime = document.getElementById('btn-manual-time');
    STATE.ui.compResults = document.getElementById('comparison-results');
    STATE.ui.compTimeAuto = document.getElementById('comp-time-auto');
    STATE.ui.compTimeManual = document.getElementById('comp-time-manual');
    STATE.ui.compPrecision = document.getElementById('comp-precision');
    STATE.ui.compErrorAbs = document.getElementById('comp-error-abs');
    STATE.ui.compErrorRel = document.getElementById('comp-error-rel');
    STATE.ui.insightText = document.getElementById('insight-text');
    
    STATE.ui.btnSound = document.getElementById('btn-sound');
    STATE.ui.btnHelp = document.getElementById('btn-help');
    STATE.ui.helpModal = document.getElementById('help-modal');
    STATE.ui.btnCloseModal = document.getElementById('btn-close-modal');
    STATE.ui.btnCloseModalOk = document.getElementById('btn-close-modal-ok');
    
    STATE.ui.viewBtns = document.querySelectorAll('.btn-view');
    STATE.ui.loader = document.getElementById('loader');

    // Attach listeners
    STATE.ui.angleInput.addEventListener('input', (e) => {
        STATE.angle = parseFloat(e.target.value);
        STATE.ui.angleVal.textContent = STATE.angle.toFixed(1) + '°';
        sounds.playClick();
        updateTrackGeometry();
        resetSimulation();
    });

    STATE.ui.gateAInput.addEventListener('input', (e) => {
        let val = parseInt(e.target.value);
        let maxVal = parseInt(STATE.ui.gateBInput.value) - 10; // safety margin
        if (val > maxVal) {
            val = maxVal;
            STATE.ui.gateAInput.value = val;
        }
        STATE.gateAPos = val / 100;
        STATE.ui.gateAVal.textContent = val + ' cm';
        updateDistanceHUD();
        updateGatePositions();
        updateWires();
        if (STATE.simState === 'idle') resetSimulation();
    });

    STATE.ui.gateBInput.addEventListener('input', (e) => {
        let val = parseInt(e.target.value);
        let minVal = parseInt(STATE.ui.gateAInput.value) + 10; // safety margin
        if (val < minVal) {
            val = minVal;
            STATE.ui.gateBInput.value = val;
        }
        STATE.gateBPos = val / 100;
        STATE.ui.gateBVal.textContent = val + ' cm';
        updateDistanceHUD();
        updateGatePositions();
        updateWires();
        if (STATE.simState === 'idle') resetSimulation();
    });

    STATE.ui.btnPower.addEventListener('click', () => {
        toggleElectromagnet();
    });

    STATE.ui.btnReset.addEventListener('click', () => {
        sounds.playClick();
        resetSimulation();
    });

    // Manual Stopwatch events
    STATE.ui.btnManualTime.addEventListener('click', () => {
        triggerManualStopwatch();
    });

    // Spacebar shortcut
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            e.preventDefault();
            triggerManualStopwatch();
        }
    });

    // Sound toggle
    STATE.ui.btnSound.addEventListener('click', () => {
        STATE.soundEnabled = !STATE.soundEnabled;
        if (STATE.soundEnabled) {
            STATE.ui.btnSound.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
            sounds.init();
        } else {
            STATE.ui.btnSound.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
            sounds.stopRollingSound();
        }
        sounds.playClick();
    });

    // Help Modals
    STATE.ui.btnHelp.addEventListener('click', () => {
        sounds.playClick();
        STATE.ui.helpModal.classList.add('active');
    });
    
    const closeModal = () => {
        sounds.playClick();
        STATE.ui.helpModal.classList.remove('active');
    };
    STATE.ui.btnCloseModal.addEventListener('click', closeModal);
    STATE.ui.btnCloseModalOk.addEventListener('click', closeModal);
    
    // Preset views
    STATE.ui.viewBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const view = btn.dataset.view;
            setCameraPreset(view);
            STATE.ui.viewBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            sounds.playClick();
        });
    });

    // View Mode toggles
    STATE.ui.btnMode2d = document.getElementById('btn-mode-2d');
    STATE.ui.btnMode3d = document.getElementById('btn-mode-3d');
    STATE.ui.btnShowSgk = document.getElementById('btn-show-sgk');
    STATE.ui.btnFullscreen = document.getElementById('btn-fullscreen');
    STATE.ui.canvas2dContainer = document.getElementById('canvas-2d-container');
    STATE.ui.canvas3dContainer = document.getElementById('canvas-container');
    STATE.ui.viewPresetsPanel = document.getElementById('view-presets-panel');
    
    // SGK Reference Modal
    STATE.ui.sgkModal = document.getElementById('sgk-modal');
    STATE.ui.btnCloseSgkModal = document.getElementById('btn-close-sgk-modal');
    STATE.ui.btnCloseSgkModalOk = document.getElementById('btn-close-sgk-modal-ok');

    STATE.ui.btnMode2d.addEventListener('click', () => switchViewMode('2d'));
    STATE.ui.btnMode3d.addEventListener('click', () => switchViewMode('3d'));
    
    // SGK Reference Modal (button may have been removed from HTML)
    if (STATE.ui.btnShowSgk) {
        STATE.ui.btnShowSgk.addEventListener('click', () => {
            sounds.playClick();
            STATE.ui.sgkModal.classList.add('active');
        });
    }
    
    const closeSgkModal = () => {
        sounds.playClick();
        if (STATE.ui.sgkModal) STATE.ui.sgkModal.classList.remove('active');
    };
    if (STATE.ui.btnCloseSgkModal) STATE.ui.btnCloseSgkModal.addEventListener('click', closeSgkModal);
    if (STATE.ui.btnCloseSgkModalOk) STATE.ui.btnCloseSgkModalOk.addEventListener('click', closeSgkModal);

    // Fullscreen event listener
    STATE.ui.btnFullscreen.addEventListener('click', () => {
        sounds.playClick();
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Lỗi kích hoạt toàn màn hình: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    });

    document.addEventListener('fullscreenchange', () => {
        if (document.fullscreenElement) {
            STATE.ui.btnFullscreen.innerHTML = '<i class="fa-solid fa-compress"></i> Thu nhỏ';
            STATE.ui.btnFullscreen.classList.add('active');
        } else {
            STATE.ui.btnFullscreen.innerHTML = '<i class="fa-solid fa-expand"></i> Toàn màn hình';
            STATE.ui.btnFullscreen.classList.remove('active');
        }
    });

    // Initialize document click for Audio context unlocking
    document.addEventListener('click', () => {
        sounds.init();
    }, { once: true });

    // Data Table UI Elements & Events
    STATE.ui.btnDataTable = document.getElementById('btn-data-table');
    STATE.ui.dataTableModal = document.getElementById('data-table-modal');
    STATE.ui.btnCloseDataTableModal = document.getElementById('btn-close-data-table-modal');
    STATE.ui.btnCloseDataTableModalOk = document.getElementById('btn-close-data-table-modal-ok');
    STATE.ui.btnRecordData = document.getElementById('btn-record-data');
    STATE.ui.btnClearReportData = document.getElementById('btn-clear-report-data');
    STATE.ui.reportTableBody = document.getElementById('report-table-body');

    if (STATE.ui.btnDataTable) {
        STATE.ui.btnDataTable.addEventListener('click', () => {
            sounds.playClick();
            STATE.ui.dataTableModal.classList.add('active');
            updateReportTableUI();
        });
    }

    const closeDataTableModal = () => {
        sounds.playClick();
        if (STATE.ui.dataTableModal) STATE.ui.dataTableModal.classList.remove('active');
    };
    if (STATE.ui.btnCloseDataTableModal) STATE.ui.btnCloseDataTableModal.addEventListener('click', closeDataTableModal);
    if (STATE.ui.btnCloseDataTableModalOk) STATE.ui.btnCloseDataTableModalOk.addEventListener('click', closeDataTableModal);

    if (STATE.ui.btnRecordData) {
        STATE.ui.btnRecordData.addEventListener('click', () => {
            sounds.playClick();
            recordCurrentTrial();
        });
    }

    if (STATE.ui.btnClearReportData) {
        STATE.ui.btnClearReportData.addEventListener('click', () => {
            sounds.playClick();
            clearReportData();
        });
    }
}

function updateDistanceHUD() {
    const sCm = (STATE.gateBPos - STATE.gateAPos) * 100;
    const sM = STATE.gateBPos - STATE.gateAPos;
    STATE.ui.distanceVal.innerHTML = `${sCm.toFixed(1)} cm (${sM.toFixed(3)} m)`;
}

// 3D Scene Initialization
function init3D() {
    const container = document.getElementById('canvas-container');
    
    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080a12);
    scene.fog = new THREE.FogExp2(0x080a12, 0.10);

    // Camera setup
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.05, 20);
    
    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);

    // Lights — Bright and vibrant for clear visibility
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.1);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
    dirLight.position.set(3, 4, 1.0);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 10;
    dirLight.shadow.camera.left = -1.2;
    dirLight.shadow.camera.right = 1.2;
    dirLight.shadow.camera.top = 1.2;
    dirLight.shadow.camera.bottom = -1.2;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    // Rim light — makes the ball pop
    const rimLight = new THREE.PointLight(0x38bdf8, 1.5, 4);
    rimLight.position.set(-1.0, 1.0, -0.5);
    scene.add(rimLight);

    // Warm accent light from below for dramatic effect
    const warmLight = new THREE.PointLight(0xffaa33, 0.8, 2.5);
    warmLight.position.set(0.5, -0.3, 0.5);
    scene.add(warmLight);

    // Blue accent light to simulate laser glow
    const accentLight = new THREE.PointLight(0x38bdf8, 0.8, 3);
    accentLight.position.set(0.2, 0.3, 0.1);
    scene.add(accentLight);

    // Grid Floor
    const gridHelper = new THREE.GridHelper(10, 50, 0xcbd5e1, 0xe2e8f0);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    // Light-colored lab table top for high contrast with dark photogates
    const tableGeo = new THREE.BoxGeometry(1.8, 0.04, 1.4);
    const tableMat = new THREE.MeshStandardMaterial({
        color: 0xe2e8f0, // Clean light slate gray
        roughness: 0.4,
        metalness: 0.1
    });
    const table = new THREE.Mesh(tableGeo, tableMat);
    table.position.set(0, -0.02, 0);
    table.receiveShadow = true;
    scene.add(table);

    // OrbitControls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI/2 - 0.02; // Don't go under floor
    controls.minDistance = 0.3;
    controls.maxDistance = 3.5;
    
    // Construct all the physical laboratory models
    buildApparatus();

    // Default Camera preset view
    setCameraPreset('overview', false);

    // Window resize handler
    window.addEventListener('resize', onWindowResize);
    
    // Hide loader
    setTimeout(() => {
        STATE.ui.loader.style.opacity = '0';
        setTimeout(() => STATE.ui.loader.style.display = 'none', 500);
    }, 800);
}

// Draw a canvas texture for the track ruler scale
function createRulerTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    // Brushed aluminum background
    ctx.fillStyle = '#b0b8c4';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Subtle metal noise/scratches
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    for(let i=0; i<100; i++) {
        ctx.fillRect(Math.random()*canvas.width, 0, Math.random()*5 + 1, canvas.height);
    }
    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    for(let i=0; i<100; i++) {
        ctx.fillRect(Math.random()*canvas.width, 0, Math.random()*5 + 1, canvas.height);
    }
    
    // Ruler edge lines
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height - 4);
    ctx.lineTo(canvas.width, canvas.height - 4);
    ctx.stroke();

    // Vạch chia (Ticks)
    // 0cm is at left (z = -0.5), 100cm is at right (z = 0.5)
    // Let's match the physical length. Let's make padding 2% at both ends.
    // Length is 1 meter. 100 divisions.
    const padding = 12; // pixels padding on canvas ends to look realistic
    const usableWidth = canvas.width - (padding * 2);
    
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#1e293b';
    ctx.font = 'bold 16px "Share Tech Mono", monospace';
    ctx.textAlign = 'center';
    
    for (let i = 0; i <= 100; i++) {
        const x = padding + (i / 100) * usableWidth;
        
        ctx.beginPath();
        if (i % 10 === 0) {
            // Major tick
            ctx.lineWidth = 2.5;
            ctx.moveTo(x, canvas.height - 4);
            ctx.lineTo(x, canvas.height - 24);
            ctx.stroke();
            
            // Draw numbers (0, 10, 20... 100)
            ctx.fillText(i.toString(), x, canvas.height - 28);
        } else if (i % 5 === 0) {
            // Medium tick
            ctx.lineWidth = 1.8;
            ctx.moveTo(x, canvas.height - 4);
            ctx.lineTo(x, canvas.height - 18);
            ctx.stroke();
        } else {
            // Minor tick
            ctx.lineWidth = 1.0;
            ctx.moveTo(x, canvas.height - 4);
            ctx.lineTo(x, canvas.height - 12);
            ctx.stroke();
        }
    }
    
    // Unit mark
    ctx.font = 'italic 12px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('cm', canvas.width - 2, 16);

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 4;
    return texture;
}

// Build 3D laboratory equipment models
function buildApparatus() {
    // Shared materials
    const silverMetal = new THREE.MeshStandardMaterial({
        color: 0xcccccc,
        roughness: 0.15,
        metalness: 0.85
    });
    
    const darkMetal = new THREE.MeshStandardMaterial({
        color: 0x222630,
        roughness: 0.45,
        metalness: 0.7
    });

    const copperWire = new THREE.MeshStandardMaterial({
        color: 0xcc743e,
        roughness: 0.3,
        metalness: 0.9
    });

    // 1. Stand Base (Đế giá đỡ)
    const baseGeo = new THREE.BoxGeometry(0.24, 0.02, 0.36);
    supportBaseMesh = new THREE.Mesh(baseGeo, darkMetal);
    supportBaseMesh.position.set(0, 0.01, -0.48); // sits at the top end
    supportBaseMesh.castShadow = true;
    supportBaseMesh.receiveShadow = true;
    scene.add(supportBaseMesh);

    // Vertical Rod (Thanh trục đứng bằng kim loại)
    const rodGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.6, 16);
    standRodMesh = new THREE.Mesh(rodGeo, silverMetal);
    standRodMesh.position.set(0, 0.3, -0.48);
    standRodMesh.castShadow = true;
    scene.add(standRodMesh);

    // Clamp holding the top of the track
    const clampGeo = new THREE.BoxGeometry(0.04, 0.04, 0.06);
    const clamp = new THREE.Mesh(clampGeo, darkMetal);
    clamp.position.set(0, 0.42, -0.48);
    clamp.castShadow = true;
    scene.add(clamp);

    // 2. The Incline Track (Máng trượt)
    // We create a group for the track to easily rotate it around the pivot
    trackMesh = new THREE.Group();
    trackMesh.position.copy(TRACK_PIVOT);
    scene.add(trackMesh);

    // Track frame: U-channel
    // We construct the U-channel by drawing a profile shape and extruding it,
    // or simply using three overlapping boxes for sides and bottom.
    // Three boxes are cleaner and map textures better.
    const trackWidth = 0.05;
    const trackDepth = 0.015;
    const trackLen = STATE.trackLength;
    
    const bottomGeo = new THREE.BoxGeometry(trackWidth, 0.006, trackLen);
    
    // Ruler texture on the bottom face of the U channel
    const rulerTex = createRulerTexture();
    const bottomMat = [
        new THREE.MeshStandardMaterial({ color: 0xa1a8b5, metalness: 0.8, roughness: 0.3 }), // right
        new THREE.MeshStandardMaterial({ color: 0xa1a8b5, metalness: 0.8, roughness: 0.3 }), // left
        new THREE.MeshStandardMaterial({ map: rulerTex, roughness: 0.25, metalness: 0.4 }),   // top (ruler scale!)
        new THREE.MeshStandardMaterial({ color: 0xa1a8b5, metalness: 0.8, roughness: 0.3 }), // bottom
        new THREE.MeshStandardMaterial({ color: 0xa1a8b5, metalness: 0.8, roughness: 0.3 }), // front
        new THREE.MeshStandardMaterial({ color: 0xa1a8b5, metalness: 0.8, roughness: 0.3 }), // back
    ];
    
    const trackBottom = new THREE.Mesh(bottomGeo, bottomMat);
    trackBottom.position.set(0, -0.003, trackLen/2);
    trackBottom.receiveShadow = true;
    trackMesh.add(trackBottom);

    const sideHeight = 0.02;
    const sideThick = 0.005;
    const sideGeo = new THREE.BoxGeometry(sideThick, sideHeight, trackLen);
    
    const leftSide = new THREE.Mesh(sideGeo, silverMetal);
    leftSide.position.set(-trackWidth/2 - sideThick/2, sideHeight/2 - 0.006, trackLen/2);
    leftSide.castShadow = true;
    trackMesh.add(leftSide);

    const rightSide = new THREE.Mesh(sideGeo, silverMetal);
    rightSide.position.set(trackWidth/2 + sideThick/2, sideHeight/2 - 0.006, trackLen/2);
    rightSide.castShadow = true;
    trackMesh.add(rightSide);

    // Stopper at the end of the track (Tấm chặn bi)
    const stopperGeo = new THREE.BoxGeometry(trackWidth + sideThick*2, sideHeight + 0.01, 0.008);
    const redPlast = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.3 }); // Orange stopper block
    stopperMesh = new THREE.Mesh(stopperGeo, redPlast);
    stopperMesh.position.set(0, sideHeight/2, trackLen);
    stopperMesh.castShadow = true;
    trackMesh.add(stopperMesh);

    // 3. Electromagnet Model (Nam châm điện)
    magnetMesh = new THREE.Group();
    magnetMesh.position.set(0, 0.03, 0.0); // local coordinates relative to track pivot
    trackMesh.add(magnetMesh);

    // Bracket attachment
    const magBracketGeo = new THREE.BoxGeometry(trackWidth + sideThick*2 + 0.002, 0.05, 0.02);
    const bracket = new THREE.Mesh(magBracketGeo, darkMetal);
    bracket.position.set(0, 0.005, 0);
    bracket.castShadow = true;
    magnetMesh.add(bracket);

    // Coil Core (Sắt non)
    const coreGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.04, 16);
    const core = new THREE.Mesh(coreGeo, darkMetal);
    core.position.set(0, 0.025, 0);
    core.rotation.x = Math.PI/2;
    core.castShadow = true;
    magnetMesh.add(core);

    // Winding (Cuộn dây đồng)
    const windGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.03, 16);
    const winding = new THREE.Mesh(windGeo, copperWire);
    winding.position.set(0, 0.025, 0);
    winding.rotation.x = Math.PI/2;
    winding.castShadow = true;
    magnetMesh.add(winding);

    // Small screw contact
    const contactGeo = new THREE.BoxGeometry(0.02, 0.01, 0.01);
    const contact = new THREE.Mesh(contactGeo, silverMetal);
    contact.position.set(0, 0.04, 0);
    magnetMesh.add(contact);

    // 4. Steel Ball — Large and vibrant chrome/gold finish
    const ballGeo = new THREE.SphereGeometry(STATE.ballRadius, 40, 40);
    const ballMat = new THREE.MeshStandardMaterial({
        color: 0xffd700,       // Gold color - highly visible
        metalness: 1.0,
        roughness: 0.04,
        envMapIntensity: 1.5
    });
    ballMesh = new THREE.Mesh(ballGeo, ballMat);
    ballMesh.castShadow = true;
    ballMesh.receiveShadow = true;
    scene.add(ballMesh);

    // 5. Build Photogates (Cổng quang điện chữ U)
    gateAMesh = createPhotogate(0x2563eb); // Blue highlight
    gateBMesh = createPhotogate(0xe11d48); // Red highlight
    trackMesh.add(gateAMesh);
    trackMesh.add(gateBMesh);

    // Extract laser beams to keep references
    laserBeamAMesh = gateAMesh.getObjectByName("laser");
    laserBeamBMesh = gateBMesh.getObjectByName("laser");

    // 6. Support Stand at the bottom end (Thanh giá đỡ phía cuối máng)
    // To support the slope, a simple light-alloy frame at the end of the table
    const supportGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.15, 8);
    botSupportMesh = new THREE.Mesh(supportGeo, silverMetal);
    botSupportMesh.position.set(0, 0.075, 0.48);
    botSupportMesh.castShadow = true;
    scene.add(botSupportMesh);

    // Connect support to track with a clamp
    const clampBotGeo = new THREE.BoxGeometry(0.03, 0.03, 0.03);
    clampBotMesh = new THREE.Mesh(clampBotGeo, darkMetal);
    clampBotMesh.position.set(0, 0.15, 0.48);
    clampBotMesh.castShadow = true;
    scene.add(clampBotMesh);

    // 7. Digital Timer Box Model (Đặt phía sau/bên cạnh giá đỡ để không cản trở góc nhìn)
    const timerDevice = new THREE.Group();
    timerDevice.position.set(-0.22, 0.06, 0.0); // on table, in background
    timerDevice.rotation.y = Math.PI / 2 - Math.PI / 12; // Rotated to face the front-side camera
    scene.add(timerDevice);

    // Device Body
    const devBodyGeo = new THREE.BoxGeometry(0.22, 0.12, 0.16);
    const devBodyMat = new THREE.MeshStandardMaterial({
        color: 0xe2e8f0, // real light gray metal casing
        roughness: 0.35,
        metalness: 0.15
    });
    const devBody = new THREE.Mesh(devBodyGeo, devBodyMat);
    devBody.castShadow = true;
    devBody.receiveShadow = true;
    timerDevice.add(devBody);

    // Rubber feet
    const feetGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.01, 8);
    const feetMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const footOffsets = [[-0.09, -0.08], [0.09, -0.08], [-0.09, 0.08], [0.09, 0.08]];
    footOffsets.forEach(offset => {
        const foot = new THREE.Mesh(feetGeo, feetMat);
        foot.position.set(offset[0], -0.065, offset[1]);
        timerDevice.add(foot);
    });

    // Dark screen bezel
    const bezelGeo = new THREE.BoxGeometry(0.18, 0.08, 0.005);
    const bezelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
    const bezel = new THREE.Mesh(bezelGeo, bezelMat);
    bezel.position.set(0, 0.01, 0.081);
    timerDevice.add(bezel);

    // LED Screen surface
    const screenGeo = new THREE.PlaneGeometry(0.14, 0.04);
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.set(0, 0.015, 0.084);
    timerDevice.add(screen);

    // Plug Sockets on the timer front (2 ports)
    const plugGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.006, 12);
    const plugMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9 });
    
    const socketA = new THREE.Mesh(plugGeo, plugMat);
    socketA.position.set(-0.04, -0.03, 0.081);
    socketA.rotation.x = Math.PI/2;
    timerDevice.add(socketA);

    const socketB = new THREE.Mesh(plugGeo, plugMat);
    socketB.position.set(0.04, -0.03, 0.081);
    socketB.rotation.x = Math.PI/2;
    timerDevice.add(socketB);

    // 8. Connecting Cables (Dây nối điện dạng ống mềm)
    // Created as empty meshes first, will update dynamically on render
    const wireMat = new THREE.MeshStandardMaterial({
        color: 0x111111,
        roughness: 0.8,
        metalness: 0.1
    });
    wireAMesh = new THREE.Mesh(new THREE.BufferGeometry(), wireMat);
    wireBMesh = new THREE.Mesh(new THREE.BufferGeometry(), wireMat);
    scene.add(wireAMesh);
    scene.add(wireBMesh);

    // Initial setup positions
    updateTrackGeometry();
    updateGatePositions();
    updateWires();
    resetSimulation();
}

// Function to construct a generic Photogate model (Chữ U)
function createPhotogate(highlightColor) {
    const gateGroup = new THREE.Group();

    // Dark grey plastic chassis
    const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.4,
        metalness: 0.4
    });
    const accentMat = new THREE.MeshStandardMaterial({
        color: highlightColor,
        roughness: 0.3,
        metalness: 0.5
    });

    // U-shape legs: 3 parts (left, right, bottom bridge)
    // Dimensions aligned to sit on the track:
    // Left leg (Box)
    const legLeft = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.05, 0.02), bodyMat);
    legLeft.position.set(-0.03, 0.02, 0);
    legLeft.castShadow = true;
    gateGroup.add(legLeft);

    // Right leg (Box)
    const legRight = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.05, 0.02), bodyMat);
    legRight.position.set(0.03, 0.02, 0);
    legRight.castShadow = true;
    gateGroup.add(legRight);

    // Bottom support clamp
    const bottomClamp = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.012, 0.024), bodyMat);
    bottomClamp.position.set(0, -0.01, 0);
    bottomClamp.castShadow = true;
    gateGroup.add(bottomClamp);

    // Color label accent on the top/side
    const label = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.015, 0.015), accentMat);
    label.position.set(-0.03, 0.04, 0);
    gateGroup.add(label);

    const labelR = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.015, 0.015), accentMat);
    labelR.position.set(0.03, 0.04, 0);
    gateGroup.add(labelR);

    // Glowing Laser Cylinder (Tia hồng ngoại/laser dày, dễ quan sát)
    // Lies between the two legs of the U-shape
    const laserGeo = new THREE.CylinderGeometry(0.002, 0.002, 0.052, 8);
    const laserMat = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.75
    });
    const laser = new THREE.Mesh(laserGeo, laserMat);
    laser.name = "laser";
    laser.rotation.z = Math.PI/2;
    laser.position.set(0, 0.02, 0); // crossing gap at 2cm height
    gateGroup.add(laser);

    // Photo emitter/detector lenses
    const lensGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.002, 12);
    const lensMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    
    const lensL = new THREE.Mesh(lensGeo, lensMat);
    lensL.position.set(-0.025, 0.02, 0);
    lensL.rotation.z = Math.PI/2;
    gateGroup.add(lensL);

    const lensR = new THREE.Mesh(lensGeo, lensMat);
    lensR.position.set(0.025, 0.02, 0);
    lensR.rotation.z = -Math.PI/2;
    gateGroup.add(lensR);

    return gateGroup;
}

// Adjust track incline angle and relocate meshes dynamically
function updateTrackGeometry() {
    const rad = (STATE.angle * Math.PI) / 180;
    
    // Rotate track group around pivot
    trackMesh.rotation.x = rad;
    
    // Re-adjust support stand height clamps dynamically
    const trackLength = STATE.trackLength;
    
    // End position of track in world coordinates
    // Pivot is at TRACK_PIVOT. Track points down along Z local axis.
    const direction = new THREE.Vector3(0, 0, 1).applyEuler(trackMesh.rotation);
    const endPos = TRACK_PIVOT.clone().add(direction.multiplyScalar(trackLength));
    
    // Move and stretch the support stand meshes to stay connected to the track
    if (clampBotMesh) {
        clampBotMesh.position.copy(endPos);
    }
    if (botSupportMesh) {
        botSupportMesh.position.set(endPos.x, endPos.y / 2, endPos.z);
        botSupportMesh.scale.set(1, endPos.y / 0.15, 1);
    }
}

// Position photogates along the track local axis
function updateGatePositions() {
    // Gate positions along the track Z-axis (local)
    // 0 is top pivot, 1.0 is stopper
    gateAMesh.position.set(0, 0, STATE.gateAPos);
    gateBMesh.position.set(0, 0, STATE.gateBPos);
}

// Draw smooth CatmullRom curves for wiring cables
function updateWires() {
    const getCableCurve = (gateMesh, socketWorldPos) => {
        // Find plug connection point on the photogate (e.g. bottom clamp) in world space
        const gateConnectLocal = new THREE.Vector3(0, -0.015, 0);
        const gateWorldPos = gateConnectLocal.applyMatrix4(gateMesh.matrixWorld);

        // Define curve points for hanging cable effect
        const midPoint = new THREE.Vector3()
            .addVectors(gateWorldPos, socketWorldPos)
            .multiplyScalar(0.5);
        
        // Let it sag downwards under gravity
        midPoint.y -= 0.15;
        midPoint.z += 0.05; // slightly forward

        const points = [
            gateWorldPos,
            new THREE.Vector3().lerpVectors(gateWorldPos, midPoint, 0.4),
            midPoint,
            new THREE.Vector3().lerpVectors(midPoint, socketWorldPos, 0.6),
            socketWorldPos
        ];

        const curve = new THREE.CatmullRomCurve3(points);
        return new THREE.TubeGeometry(curve, 20, 0.0035, 8, false);
    };

    // World socket positions on timer
    // timer is at (0.28, 0.08, -0.05), rotation -PI/8
    // Socket A is at local (-0.04, -0.03, 0.081) relative to timer
    const socketALocal = new THREE.Vector3(-0.04, -0.03, 0.081);
    const socketBLocal = new THREE.Vector3(0.04, -0.03, 0.081);
    
    // We get world matrix of timer parent
    // The easiest way is to traverse and compute matrixWorld
    scene.updateMatrixWorld(true);
    
    // Re-construct the matrices using the new timer coordinates
    let timerMatrix = new THREE.Matrix4();
    timerMatrix.compose(
        new THREE.Vector3(-0.22, 0.06, 0.0),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2 - Math.PI / 12),
        new THREE.Vector3(1, 1, 1)
    );

    const socketAWorld = socketALocal.clone().applyMatrix4(timerMatrix);
    const socketBWorld = socketBLocal.clone().applyMatrix4(timerMatrix);

    // Update Tube geometries
    const geoA = getCableCurve(gateAMesh, socketAWorld);
    wireAMesh.geometry.dispose();
    wireAMesh.geometry = geoA;

    const geoB = getCableCurve(gateBMesh, socketBWorld);
    wireBMesh.geometry.dispose();
    wireBMesh.geometry = geoB;
}

// Reset ball position to electromagnet and clear timer displays
function resetSimulation() {
    STATE.simState = 'idle';
    STATE.ballX = 0.012; // Start just next to the core (accounting for radius)
    STATE.ballV = 0.0;
    STATE.simTime = 0.0;
    
    STATE.timeGateA = null;
    STATE.timeGateB = null;
    STATE.gateATriggered = false;
    STATE.gateBTriggered = false;
    
    // Clear LED
    STATE.ui.ledTimer.textContent = '0.000';
    STATE.ui.ledTimer.classList.remove('finished');
    
    // Set laser beams active
    if (laserBeamAMesh) {
        laserBeamAMesh.material.color.setHex(0xff0000);
        laserBeamAMesh.material.opacity = 0.45;
    }
    if (laserBeamBMesh) {
        laserBeamBMesh.material.color.setHex(0xff0000);
        laserBeamBMesh.material.opacity = 0.45;
    }

    // Toggle button look
    STATE.ui.btnPower.classList.remove('btn-secondary');
    STATE.ui.btnPower.classList.add('btn-danger');
    STATE.ui.powerText.textContent = 'Ngắt Nam châm (Thả bi)';
    
    // Magnet active wire color or intensity
    setMagnetState(true);

    // Update ball 3D position
    updateBall3D();
    
    sounds.stopRollingSound();
}

function setMagnetState(active) {
    if (!magnetMesh) return;
    const winding = magnetMesh.children[2];
    if (active) {
        winding.material.emissive = new THREE.Color(0xd97706).multiplyScalar(0.25); // faint orange glow indicating current flow
    } else {
        winding.material.emissive = new THREE.Color(0x000000);
    }
}

// Calculate the 3D world position and rotation of the ball
function updateBall3D() {
    const rad = (STATE.angle * Math.PI) / 180;
    
    // Ball local coordinates: rolling along track Z axis (from 0 to 1m)
    // Its Y coordinate should sit on top of track bed: 
    // bottom thickness is 0.006, height of sides is 0.02.
    // The ball rests between the sides. Let's place it at Y local offset:
    // radius = 0.012. Since track bottom is at local -0.003 and track bed surface is at 0.0.
    // Ball centers sits at local Y = radius = 0.012.
    const ballLocalPos = new THREE.Vector3(0, STATE.ballRadius, STATE.ballX);
    
    // Convert to world space
    const ballWorldPos = ballLocalPos.clone().applyMatrix4(trackMesh.matrixWorld);
    ballMesh.position.copy(ballWorldPos);

    // Ball rotation mapping
    // Angle rotated = distance / radius
    const rotRad = STATE.ballX / STATE.ballRadius;
    ballMesh.rotation.x = rotRad;
}

// Disconnect power to electromagnet -> releases the ball
function toggleElectromagnet() {
    if (STATE.simState !== 'idle') return;
    
    sounds.playClick();
    STATE.simState = 'rolling';
    STATE.releaseTime = performance.now();
    
    // Magnet de-energized
    setMagnetState(false);
    
    // Toggle power button state
    STATE.ui.btnPower.classList.remove('btn-danger');
    STATE.ui.btnPower.classList.add('btn-secondary');
    STATE.ui.powerText.textContent = 'Nam châm đã ngắt';
    
    sounds.startRollingSound();
}

// Physics Loop (called inside requestAnimationFrame)
function updatePhysics(dt) {
    if (STATE.simState !== 'rolling') return;

    // Incline Rolling Acceleration formula: a = 5/7 * g * sin(alpha)
    const rad = (STATE.angle * Math.PI) / 180;
    const accel = (5.0 / 7.0) * STATE.g * Math.sin(rad);

    // Update speed and position
    STATE.ballV += accel * dt;
    STATE.ballX += STATE.ballV * dt;
    STATE.simTime += dt;

    sounds.updateRollingSound(STATE.ballV);

    // Check Photogate A trigger
    // Trigger occurs when the ball spans the photogate position
    // Since ball center is at STATE.ballX, trigger starts when ball front hits gate
    // (ballX >= gateAPos - radius) and stops when ball back leaves (ballX >= gateAPos + radius)
    // We trigger the exact moment the CENTER crosses the laser beam for neat decimal times
    if (!STATE.gateATriggered && STATE.ballX >= STATE.gateAPos) {
        STATE.gateATriggered = true;
        STATE.timeGateA = STATE.simTime;
        sounds.playBeep(false); // Short beep
        
        // Visual laser effect: laser turns yellow/dim
        laserBeamAMesh.material.color.setHex(0x34c759); // Green flash
        laserBeamAMesh.material.opacity = 0.9;
        setTimeout(() => {
            laserBeamAMesh.material.color.setHex(0x1e293b); // blocked/invisible
            laserBeamAMesh.material.opacity = 0.1;
        }, 60);
    }

    // Check Photogate B trigger
    if (!STATE.gateBTriggered && STATE.ballX >= STATE.gateBPos) {
        STATE.gateBTriggered = true;
        STATE.timeGateB = STATE.simTime;
        sounds.playBeep(true); // Double beep
        
        // Visual laser effect
        laserBeamBMesh.material.color.setHex(0x34c759);
        laserBeamBMesh.material.opacity = 0.9;
        setTimeout(() => {
            laserBeamBMesh.material.color.setHex(0x1e293b);
            laserBeamBMesh.material.opacity = 0.1;
        }, 60);

        // In A<->B mode, stop timer display and lock time
        const measuredTime = STATE.timeGateB - STATE.timeGateA;
        STATE.ui.ledTimer.textContent = measuredTime.toFixed(3);
        STATE.ui.ledTimer.classList.add('finished');
        
        // Auto update comparison tables if manual timer is also running or finished
        evaluateComparison();
    }

    // Live Digital LED update when counting between A and B
    if (STATE.gateATriggered && !STATE.gateBTriggered) {
        const liveTime = STATE.simTime - STATE.timeGateA;
        STATE.ui.ledTimer.textContent = liveTime.toFixed(3);
    }

    // Check stopper impact at end of track
    const stopperLimit = STATE.trackLength - STATE.ballRadius - 0.008; // accounting for ball size and stopper thickness
    if (STATE.ballX >= stopperLimit) {
        STATE.ballX = stopperLimit;
        STATE.ballV = 0.0;
        STATE.simState = 'finished';
        sounds.stopRollingSound();
        sounds.playImpact();
    }

    updateBall3D();
}

// Window resize handler
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Camera Presets Animations
function setCameraPreset(viewName, animate = true) {
    STATE.currentView = viewName;
    
    let targetPos, targetLookAt;
    
    // Rotate of track changes target coordinates slightly, but we hardcode robust views
    const rad = (STATE.angle * Math.PI) / 180;
    
    switch(viewName) {
        case 'gate-a':
            // Zoom closely on Photogate A
            const gateALocal = new THREE.Vector3(0, 0.03, STATE.gateAPos);
            targetLookAt = gateALocal.applyMatrix4(trackMesh.matrixWorld);
            targetPos = targetLookAt.clone().add(new THREE.Vector3(0.18, 0.08, 0.10));
            break;
            
        case 'gate-b':
            // Zoom closely on Photogate B
            const gateBLocal = new THREE.Vector3(0, 0.03, STATE.gateBPos);
            targetLookAt = gateBLocal.applyMatrix4(trackMesh.matrixWorld);
            targetPos = targetLookAt.clone().add(new THREE.Vector3(0.18, 0.08, 0.10));
            break;
            
        case 'timer':
            // Look directly at Digital Timer display (rotated screen)
            targetLookAt = new THREE.Vector3(-0.22, 0.06, 0.0);
            targetPos = new THREE.Vector3(0.12, 0.12, 0.06); // facing the screen directly
            break;
            
        case 'overview':
        default:
            // Textbook style front-side overview showing track sloping left-to-right & timer behind
            targetLookAt = new THREE.Vector3(0.0, 0.26, 0.0);
            targetPos = new THREE.Vector3(0.95, 0.40, 0.0);
            break;
    }

    if (!animate) {
        camera.position.copy(targetPos);
        controls.target.copy(targetLookAt);
        controls.update();
    } else {
        // Setup smooth interpolation
        STATE.cameraTransition = {
            startPos: camera.position.clone(),
            startTarget: controls.target.clone(),
            endPos: targetPos,
            endTarget: targetLookAt,
            progress: 0.0,
            duration: 0.8 // seconds
        };
    }
}

// Interpolate camera positions in loop
function handleCameraTransition(dt) {
    if (!STATE.cameraTransition) return;
    
    const transition = STATE.cameraTransition;
    transition.progress += dt / transition.duration;
    
    if (transition.progress >= 1.0) {
        camera.position.copy(transition.endPos);
        controls.target.copy(transition.endTarget);
        STATE.cameraTransition = null;
    } else {
        // Smoothstep interpolation
        const t = transition.progress;
        const smoothT = t * t * (3 - 2 * t);
        
        camera.position.lerpVectors(transition.startPos, transition.endPos, smoothT);
        controls.target.lerpVectors(transition.startTarget, transition.endTarget, smoothT);
    }
    controls.update();
}

// -------------------------------------------------------------
// Manual timing stopwatch logic
// -------------------------------------------------------------
function triggerManualStopwatch() {
    if (STATE.manualState === 'idle') {
        // START stopwatch
        sounds.playClick();
        STATE.manualState = 'running';
        STATE.manualTimeStart = performance.now();
        STATE.ui.btnManualTime.innerHTML = '<i class="fa-solid fa-square"></i> Dừng Bấm giờ (Space)';
        STATE.ui.btnManualTime.classList.remove('btn-warning');
        STATE.ui.btnManualTime.classList.add('btn-danger');
        
        STATE.manualDisplayInterval = setInterval(() => {
            const current = (performance.now() - STATE.manualTimeStart) / 1000;
            STATE.ui.manualTimerDisplay.textContent = current.toFixed(3);
        }, 33);
        
        // Show results table
        STATE.ui.compResults.style.display = 'block';
        evaluateComparison();
        
    } else if (STATE.manualState === 'running') {
        // STOP stopwatch
        sounds.playClick();
        STATE.manualState = 'stopped';
        clearInterval(STATE.manualDisplayInterval);
        STATE.manualTimeElapsed = (performance.now() - STATE.manualTimeStart) / 1000;
        STATE.ui.manualTimerDisplay.textContent = STATE.manualTimeElapsed.toFixed(3);
        
        STATE.ui.btnManualTime.innerHTML = '<i class="fa-solid fa-rotate"></i> Reset Bấm giờ';
        STATE.ui.btnManualTime.classList.remove('btn-danger');
        STATE.ui.btnManualTime.classList.add('btn-secondary');
        
        evaluateComparison();
    } else {
        // RESET manual stopwatch
        sounds.playClick();
        STATE.manualState = 'idle';
        STATE.manualTimeElapsed = 0;
        STATE.ui.manualTimerDisplay.textContent = '0.000';
        STATE.ui.btnManualTime.innerHTML = '<i class="fa-solid fa-stopwatch"></i> Bấm giờ Thủ công (Phím SPACE)';
        STATE.ui.btnManualTime.classList.remove('btn-secondary');
        STATE.ui.btnManualTime.classList.add('btn-warning');
        evaluateComparison();
    }
}

// Comparative calculations and pedagogy text generator
function evaluateComparison() {
    const hasAuto = STATE.gateBTriggered;
    const hasManual = (STATE.manualState === 'stopped');

    const autoTime = hasAuto ? (STATE.timeGateB - STATE.timeGateA) : 0.0;
    const manualTime = STATE.manualTimeElapsed;

    // Update cells
    STATE.ui.compTimeAuto.textContent = hasAuto ? `${autoTime.toFixed(3)} s` : '0.000 s';
    STATE.ui.compTimeManual.textContent = hasManual ? `${manualTime.toFixed(3)} s` : (STATE.manualState === 'running' ? 'Đang chạy...' : '0.000 s');

    if (hasAuto && hasManual) {
        // Calculate errors
        const errorAbs = manualTime - autoTime;
        const errorRel = (Math.abs(errorAbs) / autoTime) * 100;

        STATE.ui.compErrorAbs.textContent = `${(errorAbs >= 0 ? '+' : '')}${errorAbs.toFixed(3)} s`;
        STATE.ui.compErrorRel.textContent = `${errorRel.toFixed(1)}%`;
        
        // Set styling based on error severity
        if (errorRel < 5) {
            STATE.ui.compPrecision.innerHTML = '<i class="fa-solid fa-circle-check text-success"></i> Rất cao';
            STATE.ui.compErrorRel.style.color = '#34c759'; // green
        } else if (errorRel < 15) {
            STATE.ui.compPrecision.innerHTML = '<i class="fa-solid fa-triangle-exclamation text-warning"></i> Trung bình';
            STATE.ui.compErrorRel.style.color = '#ffcc00'; // yellow
        } else {
            STATE.ui.compPrecision.innerHTML = '<i class="fa-solid fa-triangle-exclamation text-danger"></i> Thấp';
            STATE.ui.compErrorRel.style.color = '#ff3b30'; // red
        }

        // Educational message depending on the result
        let msg = `Cổng quang điện đo: <strong>${autoTime.toFixed(3)}s</strong>. `;
        msg += `Bấm tay đo: <strong>${manualTime.toFixed(3)}s</strong>.<br>`;
        msg += `Sai số tuyệt đối là <strong>${Math.abs(errorAbs).toFixed(3)}s</strong> (lệch ~${errorRel.toFixed(0)}%). `;
        msg += `Hệ thần kinh cần khoảng 150-250ms để truyền tín hiệu từ mắt đến ngón tay. Do đó, bấm giờ bằng tay luôn tạo ra sai số lớn và không ổn định ở các phép đo tốc độ cao!`;
        
        STATE.ui.insightText.innerHTML = msg;
    } else {
        STATE.ui.compPrecision.textContent = '--';
        STATE.ui.compErrorAbs.textContent = '0.000 s';
        STATE.ui.compErrorRel.textContent = '0.0%';
        STATE.ui.compErrorRel.style.color = 'var(--text-secondary)';
        
        if (STATE.simState === 'idle') {
            STATE.ui.insightText.innerHTML = '<i class="fa-solid fa-circle-info"></i> Hãy thả nam châm để bi lăn, sau đó sử dụng bấm giờ thủ công để cảm nhận sai số!';
        } else if (STATE.simState === 'rolling') {
            if (STATE.manualState === 'running') {
                STATE.ui.insightText.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Cả hai đồng hồ đang chạy. Hãy bấm Space hoặc nhấp Dừng khi bi lăn qua cổng B!';
            } else {
                STATE.ui.insightText.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Bi đang lăn! Hãy nhấn nút bấm giờ khi bi đi qua cổng A và cổng B.';
            }
        } else {
            STATE.ui.insightText.innerHTML = '<i class="fa-solid fa-circle-info"></i> Nhấn Đặt lại (Reset) để thực hiện lượt thí nghiệm mới.';
        }
    }
}

// -------------------------------------------------------------
// Interactive 3D Dragging for photogates
// -------------------------------------------------------------
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let dragPlane = new THREE.Plane();
let dragIntersection = new THREE.Vector3();
let selectedGate = null; // 'A' or 'B'
let isDragging = false;

window.addEventListener('mousedown', onPointerDown);
window.addEventListener('mousemove', onPointerMove);
window.addEventListener('mouseup', onPointerUp);

// Mobile touch support
window.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
        onPointerDown(e.touches[0]);
    }
}, { passive: false });

window.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && isDragging) {
        e.preventDefault(); // prevent scroll while dragging
        onPointerMove(e.touches[0]);
    }
}, { passive: false });

window.addEventListener('touchend', onPointerUp);

function onPointerDown(event) {
    if (STATE.simState !== 'idle') return; // block drag during simulation run
    
    // Calculate normalized device coordinates (-1 to +1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    
    // Find gate parts intersecting the ray
    // We check intersections with gate groups
    const intersectsA = raycaster.intersectObjects(gateAMesh.children, true);
    const intersectsB = raycaster.intersectObjects(gateBMesh.children, true);

    if (intersectsA.length > 0) {
        selectedGate = 'A';
        isDragging = true;
        controls.enabled = false; // lock orbit camera
        sounds.playClick();
    } else if (intersectsB.length > 0) {
        selectedGate = 'B';
        isDragging = true;
        controls.enabled = false;
        sounds.playClick();
    }

    if (isDragging) {
        // Setup intersection drag plane perpendicular to the vertical axis of the track
        // Normal points UP relative to the track slope
        const normal = new THREE.Vector3(0, 1, 0).applyEuler(trackMesh.rotation);
        dragPlane.setFromNormalAndCoplanarPoint(normal, TRACK_PIVOT);
    }
}

function onPointerMove(event) {
    if (!isDragging || !selectedGate) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    if (raycaster.ray.intersectPlane(dragPlane, dragIntersection)) {
        // Project world dragIntersection coordinates onto local Z axis of track
        // Position relative to track pivot point
        const localOffset = dragIntersection.clone().sub(TRACK_PIVOT);
        
        // Direction vector of track Z-axis
        const trackDir = new THREE.Vector3(0, 0, 1).applyEuler(trackMesh.rotation);
        
        // Scalar projection
        let zPos = localOffset.dot(trackDir);
        
        // Clamp bounds for gates (in meters)
        if (selectedGate === 'A') {
            const maxA = STATE.gateBPos - 0.10; // Gate A must remain at least 10cm before Gate B
            zPos = Math.max(0.10, Math.min(zPos, maxA));
            STATE.gateAPos = zPos;
            
            // Update HUD values
            const valCm = Math.round(zPos * 100);
            STATE.ui.gateAInput.value = valCm;
            STATE.ui.gateAVal.textContent = valCm + ' cm';
        } else {
            const minB = STATE.gateAPos + 0.10; // Gate B must remain at least 10cm after Gate A
            zPos = Math.max(minB, Math.min(zPos, 0.95));
            STATE.gateBPos = zPos;
            
            // Update HUD values
            const valCm = Math.round(zPos * 100);
            STATE.ui.gateBInput.value = valCm;
            STATE.ui.gateBVal.textContent = valCm + ' cm';
        }

        updateDistanceHUD();
        updateGatePositions();
        updateWires();
    }
}

function onPointerUp() {
    if (isDragging) {
        isDragging = false;
        selectedGate = null;
        controls.enabled = true; // unlock camera rotation
        sounds.playClick();
    }
}

// -------------------------------------------------------------
// Animation Render Loop
// -------------------------------------------------------------
let lastTime = 0;

function animate(currentTime) {
    requestAnimationFrame(animate);

    if (lastTime === 0) {
        lastTime = currentTime;
        return;
    }

    const dt = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    // Clamp delta time to prevent physics clipping/explosions on lag spikes
    const cappedDt = Math.min(dt, 0.1);

    // Physics update (always runs regardless of view mode)
    updatePhysics(cappedDt);

    // Always sync timer displays every frame
    syncTimerDisplays();

    if (STATE.viewMode === '2d') {
        update2DSchematic();
    } else {
        // Camera transitions interpolation
        handleCameraTransition(cappedDt);

        // Update OrbitControls
        if (!STATE.cameraTransition) {
            controls.update();
        }

        // Render Scene in 3D
        renderer.render(scene, camera);
    }
}

// Sync timer numbers to ALL display elements (sidebar LED, SVG LED, floating 3D timer)
function syncTimerDisplays() {
    const currentTime = STATE.ui.ledTimer ? STATE.ui.ledTimer.textContent : '0.000';
    const isLocked = STATE.gateBTriggered;

    // Floating timer (3D mode overlay)
    const ftValue = document.getElementById('ft-value');
    if (ftValue) {
        ftValue.textContent = currentTime;
        if (isLocked) {
            ftValue.classList.add('ft-green');
        } else {
            ftValue.classList.remove('ft-green');
        }
    }
}

// Initialize everything on load
window.onload = () => {
    initUI();
    init3D();
    init2DRuler();
    switchViewMode('2d'); // default to 2D SGK schematic view
    requestAnimationFrame(animate);
};

// -------------------------------------------------------------
// 2D Schematic & View Switch Mode Helpers
// -------------------------------------------------------------
window.showDefaultReference = function(img) {
    img.style.display = 'none';
    const fallback = document.getElementById('img-fallback-message-modal');
    if (fallback) {
        fallback.style.display = 'flex';
    }
};

function switchViewMode(mode) {
    STATE.viewMode = mode;
    sounds.playClick();
    
    if (mode === '2d') {
        STATE.ui.btnMode2d.classList.add('active');
        STATE.ui.btnMode3d.classList.remove('active');
        STATE.ui.canvas2dContainer.classList.add('active');
        STATE.ui.canvas3dContainer.style.display = 'none';
        document.body.classList.remove('mode-3d');
        update2DSchematic();
    } else {
        STATE.ui.btnMode2d.classList.remove('active');
        STATE.ui.btnMode3d.classList.add('active');
        STATE.ui.canvas2dContainer.classList.remove('active');
        STATE.ui.canvas3dContainer.style.display = 'block';
        document.body.classList.add('mode-3d');
        // Trigger window resize to adjust Three.js viewport
        setTimeout(onWindowResize, 10);
    }
}
function init2DRuler() {
    const ticksGroup = document.getElementById('svg-ruler-ticks');
    if (!ticksGroup) return;
    
    let html = '';
    for (let i = 0; i <= 100; i += 1) {
        const x = 80 + (i / 100) * 500;
        if (i % 10 === 0) {
            // Major tick - Made longer and bolder with pure black color
            html += `<line x1="${x}" y1="12" x2="${x}" y2="0" stroke="#000000" stroke-width="2.2"/>`;
            html += `<text x="${x}" y="-6" fill="#000000" font-size="13" font-weight="bold" text-anchor="middle">${i}</text>`;
        } else if (i % 5 === 0) {
            // Medium tick
            html += `<line x1="${x}" y1="12" x2="${x}" y2="5" stroke="#1e293b" stroke-width="1.5"/>`;
        } else {
            // Minor tick
            html += `<line x1="${x}" y1="12" x2="${x}" y2="8" stroke="#475569" stroke-width="1.0"/>`;
        }
    }
    ticksGroup.innerHTML = html;
}

function update2DSchematic() {
    // 1. Angle Rotation (Pivot is (160, 12))
    const trackGroup = document.getElementById('svg-track-group');
    if (trackGroup) {
        trackGroup.setAttribute('transform', `rotate(${STATE.angle}, 160, 12)`);
    }

    // 2. End support stand - touches the BOTTOM of the track (local y=+12)
    const rad = (STATE.angle * Math.PI) / 180;
    const localX = 600;
    const localY = 12; // bottom surface of the track
    const dx0 = localX - 160;
    const dy0 = localY - 12;
    // Rotate to world coordinates
    const xEnd = 160 + dx0 * Math.cos(rad) - dy0 * Math.sin(rad);
    const yEnd = 12 + dx0 * Math.sin(rad) + dy0 * Math.cos(rad);

    const supportRod = document.getElementById('svg-support-rod');
    const supportClamp = document.getElementById('svg-support-clamp');
    if (supportRod) {
        supportRod.setAttribute('x1', xEnd);
        supportRod.setAttribute('y1', yEnd);
        supportRod.setAttribute('x2', xEnd);
        supportRod.setAttribute('y2', 355);
    }
    if (supportClamp) {
        supportClamp.setAttribute('x', xEnd - 10);
        supportClamp.setAttribute('y', yEnd - 8);
    }

    // 3. Gate A and Gate B positions (Shifted to local x starting at 80)
    const xGateA = 80 + STATE.gateAPos * 500;
    const xGateB = 80 + STATE.gateBPos * 500;

    const gateA = document.getElementById('svg-gate-a');
    const gateB = document.getElementById('svg-gate-b');
    if (gateA) gateA.setAttribute('transform', `translate(${xGateA}, 0)`);
    if (gateB) gateB.setAttribute('transform', `translate(${xGateB}, 0)`);

    // 4. Cables Bezier Curve rendering
    const getWorldGateConn = (xLocal) => {
        const yLocal = 15; // bottom of photogate clamp
        const dx = xLocal - 160;
        const dy = yLocal - 12;
        const dxRot = dx * Math.cos(rad) - dy * Math.sin(rad);
        const dyRot = dx * Math.sin(rad) + dy * Math.cos(rad);
        return { x: 160 + dxRot, y: 12 + dyRot };
    };

    const connA = getWorldGateConn(xGateA);
    const connB = getWorldGateConn(xGateB);

    const cableA = document.getElementById('svg-cable-a');
    const cableB = document.getElementById('svg-cable-b');

    if (cableA) {

        const cx = (connA.x + 405) / 2;
        const cy = Math.max(connA.y, 329) + 65;
        cableA.setAttribute('d', `M ${connA.x} ${connA.y} Q ${cx} ${cy} 405 329`);
    }
    if (cableB) {
        const cx = (connB.x + 525) / 2;
        const cy = Math.max(connB.y, 329) + 55;
        cableB.setAttribute('d', `M ${connB.x} ${connB.y} Q ${cx} ${cy} 525 329`);
    }

    // 5. Ball Position (Resting cx shifted to 85)
    const ball = document.getElementById('svg-ball');
    const ballLabel = document.getElementById('svg-ball-label');
    const xBall = 85 + STATE.ballX * 500;
    if (ball) ball.setAttribute('cx', xBall);
    if (ballLabel) ballLabel.setAttribute('x', xBall);

    // 6. Laser beams trigger status colors
    const laserA = document.getElementById('svg-laser-a');
    const laserB = document.getElementById('svg-laser-b');
    if (laserA) {
        if (STATE.gateATriggered) {
            if (STATE.ballX < STATE.gateAPos + 0.05) { // within trigger proximity
                laserA.setAttribute('stroke', '#34c759');
                laserA.setAttribute('opacity', '0.2');
            } else {
                laserA.setAttribute('stroke', '#ff3b30');
                laserA.setAttribute('opacity', '0.75');
            }
        } else {
            laserA.setAttribute('stroke', '#ff3b30');
            laserA.setAttribute('opacity', '0.75');
        }
    }
    if (laserB) {
        if (STATE.gateBTriggered) {
            if (STATE.ballX < STATE.gateBPos + 0.05) {
                laserB.setAttribute('stroke', '#34c759');
                laserB.setAttribute('opacity', '0.2');
            } else {
                laserB.setAttribute('stroke', '#ff3b30');
                laserB.setAttribute('opacity', '0.75');
            }
        } else {
            laserB.setAttribute('stroke', '#ff3b30');
            laserB.setAttribute('opacity', '0.75');
        }
    }

    // 7. Switch lever position
    const switchLever = document.getElementById('svg-switch-lever');
    if (switchLever) {
        if (STATE.simState === 'idle') {
            // ON (Lever pointing left, green)
            switchLever.setAttribute('x2', '16.5');
            switchLever.setAttribute('y2', '5');
            switchLever.setAttribute('stroke', '#34c759');
        } else {
            // OFF (Lever pointing right, red)
            switchLever.setAttribute('x2', '28.5');
            switchLever.setAttribute('y2', '5');
            switchLever.setAttribute('stroke', '#ef4444');
        }
    }

    // 8. LED Display readout — sync cả SVG 2D lẫn floating timer 3D
    const svgLED = document.getElementById('svg-led-display');
    const ftValue = document.getElementById('ft-value');
    const currentTime = STATE.ui.ledTimer.textContent;
    if (svgLED) {
        svgLED.textContent = currentTime;
        if (STATE.gateBTriggered) {
            svgLED.setAttribute('fill', '#34c759'); // green locked time
        } else {
            svgLED.setAttribute('fill', '#ef4444'); // red counting time
        }
    }
    if (ftValue) {
        ftValue.textContent = currentTime;
        if (STATE.gateBTriggered) {
            ftValue.classList.add('ft-green');
        } else {
            ftValue.classList.remove('ft-green');
        }
    }
}

// ============================================================================
// Lab Report Trials Logging Logic
// ============================================================================

function recordCurrentTrial() {
    // Chỉ cho ghi nếu phép đo đã hoàn tất (đã kích hoạt cổng B)
    if (!STATE.gateBTriggered) {
        alert('Chưa có số liệu đo mới! Vui lòng bấm "Ngắt Nam châm (Thả bi)" và đợi bi lăn qua cả hai Cổng quang điện.');
        return;
    }
    
    const time = STATE.timeGateB - STATE.timeGateA;
    const sM = STATE.gateBPos - STATE.gateAPos;
    const speed = sM / time;
    
    // Kiểm tra trùng lặp lượt đo vừa chạy (tránh lưu đè nhiều lần cùng 1 kết quả)
    const isDuplicate = STATE.trials.length > 0 && 
                        Math.abs(STATE.trials[STATE.trials.length - 1].time - time) < 0.0001 &&
                        Math.abs(STATE.trials[STATE.trials.length - 1].distance - sM) < 0.0001 &&
                        STATE.trials[STATE.trials.length - 1].angle === STATE.angle;
    
    if (isDuplicate) {
        if (!confirm('Số liệu lượt chạy này giống hệt lượt chạy đã ghi gần nhất. Bạn vẫn muốn ghi thêm?')) {
            return;
        }
    }
    
    STATE.trials.push({
        angle: STATE.angle,
        distance: sM,
        time: time,
        speed: speed
    });
    
    updateReportTableUI();
    
    // Hiển thị thông báo nhỏ
    const btnRecord = document.getElementById('btn-record-data');
    if (btnRecord) {
        const originalHTML = btnRecord.innerHTML;
        btnRecord.innerHTML = '<i class="fa-solid fa-circle-check"></i> Đã ghi thành công!';
        btnRecord.classList.remove('btn-warning');
        btnRecord.classList.add('btn-secondary');
        btnRecord.disabled = true;
        setTimeout(() => {
            btnRecord.innerHTML = originalHTML;
            btnRecord.classList.remove('btn-secondary');
            btnRecord.classList.add('btn-warning');
            btnRecord.disabled = false;
        }, 1200);
    }
}

function clearReportData() {
    if (STATE.trials.length === 0) return;
    if (confirm('Bạn có chắc chắn muốn xóa toàn bộ bảng báo cáo số liệu thực hành?')) {
        STATE.trials = [];
        updateReportTableUI();
    }
}

function deleteTrial(index) {
    sounds.playClick();
    STATE.trials.splice(index, 1);
    updateReportTableUI();
}
// Export to window scope so onclick attribute in inline HTML can access it
window.deleteTrial = deleteTrial;

function updateReportTableUI() {
    const tbody = STATE.ui.reportTableBody;
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (STATE.trials.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 30px;">Chưa có số liệu nào được ghi nhận. Bấm nút "Ghi số liệu hiện tại" để lưu lần chạy vừa rồi.</td></tr>`;
        document.getElementById('avg-s').textContent = '--';
        document.getElementById('avg-t').textContent = '--';
        document.getElementById('avg-v').textContent = '--';
        return;
    }
    
    let sumS = 0;
    let sumT = 0;
    let sumV = 0;
    
    STATE.trials.forEach((trial, index) => {
        sumS += trial.distance;
        sumT += trial.time;
        sumV += trial.speed;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>Lần ${index + 1}</td>
            <td style="font-family: var(--font-mono);">${trial.angle.toFixed(1)}°</td>
            <td style="font-family: var(--font-mono); font-weight: 600; color: #38bdf8;">${trial.distance.toFixed(3)} m</td>
            <td style="font-family: var(--font-mono); font-weight: 600; color: #f43f5e;">${trial.time.toFixed(3)} s</td>
            <td style="font-family: var(--font-mono); font-weight: 700; color: #34c759;">${trial.speed.toFixed(3)} m/s</td>
            <td>
                <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.75rem; min-width: auto; flex: none;" onclick="deleteTrial(${index})">
                    <i class="fa-solid fa-trash-can"></i> Xóa
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    const count = STATE.trials.length;
    const avgS = sumS / count;
    const avgT = sumT / count;
    const avgV = sumV / count;
    
    document.getElementById('avg-s').textContent = `${avgS.toFixed(3)} m`;
    document.getElementById('avg-t').textContent = `${avgT.toFixed(3)} s`;
    document.getElementById('avg-v').textContent = `${avgV.toFixed(3)} m/s`;
}
