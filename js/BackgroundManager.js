/**
 * @author BCA Student
 * @version 1.0.0
 */

class BackgroundManager {
    constructor(options = {}) {
        // Configuration
        this.config = {
            container: options.container || document.body,
            technique: options.technique || 'auto', // 'auto', 'css', 'canvas', 'webgl'
            particleCount: options.particleCount || 'auto', // 'auto', number
            enableTransitions: options.enableTransitions !== false,
            transitionDuration: options.transitionDuration || 1500,
            fps: options.fps || 60,
            debug: options.debug || false,
            ...options
        };

        // State
        this.currentWeather = null;
        this.currentTechnique = null;
        this.isRunning = false;
        this.isPaused = false;
        this.animationFrame = null;
        this.canvasContext = null;
        this.particles = [];

        // Device capabilities
        this.capabilities = this.detectCapabilities();
        
        // Select best technique
        if (this.config.technique === 'auto') {
            this.currentTechnique = this.selectBestTechnique();
        } else {
            this.currentTechnique = this.config.technique;
        }

        // Create background container
        this.bgElement = null;
        this.canvasElement = null;

        // Callbacks
        this.onStateChange = options.onStateChange || null;

        this.log('BackgroundManager initialized', {
            technique: this.currentTechnique,
            capabilities: this.capabilities
        });
    }

    /**
     * Detect device capabilities
     */
    detectCapabilities() {
        const capabilities = {
            isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
            hasWebGL: this.checkWebGLSupport(),
            hasCanvas: !!document.createElement('canvas').getContext,
            prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
            devicePixelRatio: window.devicePixelRatio || 1,
            screenWidth: window.innerWidth,
            screenHeight: window.innerHeight,
            batteryLevel: null,
            isLowEndDevice: false
        };

        // Check if low-end device
        capabilities.isLowEndDevice = 
            capabilities.isMobile && 
            (capabilities.screenWidth < 768 || navigator.hardwareConcurrency < 4);

        // Battery API (if available)
        if ('getBattery' in navigator) {
            navigator.getBattery().then(battery => {
                capabilities.batteryLevel = battery.level;
                this.log('Battery level:', (battery.level * 100) + '%');
            });
        }

        return capabilities;
    }

    /**
     * Check WebGL support
     */
    checkWebGLSupport() {
        try {
            const canvas = document.createElement('canvas');
            return !!(
                window.WebGLRenderingContext &&
                (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
            );
        } catch (e) {
            return false;
        }
    }

    /**
     * Select best rendering technique based on device capabilities
     */
    selectBestTechnique() {
        if (this.capabilities.prefersReducedMotion) {
            return 'css'; // Simple static/minimal animation
        }

        if (this.capabilities.isLowEndDevice) {
            return 'css'; // Lightweight CSS animations
        }

        if (this.capabilities.hasWebGL && !this.capabilities.isMobile) {
            return 'canvas'; // Canvas for desktop (WebGL reserved for premium)
        }

        if (this.capabilities.hasCanvas) {
            return 'canvas'; // Canvas for capable devices
        }

        return 'css'; // Fallback to CSS
    }

    /**
     * Set weather state and update background
     * @param {Object} weatherData - Weather information
     */
    setWeather(weatherData) {
        const {
            code,           // OpenWeatherMap weather code
            main,           // Weather main category (Clear, Rain, Snow, etc.)
            description,    // Detailed description
            isNight,        // Is it night time
            intensity,      // Weather intensity (light, moderate, heavy)
            timestamp       // Current time
        } = weatherData;

        // Determine weather state
        const weatherState = this.determineWeatherState(weatherData);

        if (weatherState === this.currentWeather) {
            this.log('Weather state unchanged');
            return;
        }

        this.log('Changing weather to:', weatherState);

        // Stop current animation
        if (this.isRunning) {
            this.stop();
        }

        // Update state
        this.currentWeather = weatherState;

        // Render new background
        this.render();

        // Start animation
        this.start();

        // Callback
        if (this.onStateChange) {
            this.onStateChange(weatherState);
        }
    }

    /**
     * Smooth transition to new background state (for sunrise/sunset)
     * @param {String} newState - Target weather state
     * @param {Number} duration - Transition duration in ms (default: 3000)
     */
    async fadeTransition(newState, duration = 3000) {
        if (newState === this.currentWeather) {
            this.log('Weather state unchanged');
            return;
        }

        this.log('Fading to:', newState);

        // Create new background element
        const oldElement = this.bgElement || this.canvasElement;
        const oldWeather = this.currentWeather;

        // Update state
        this.currentWeather = newState;

        // Create new background
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.inset = '0';
        tempContainer.style.opacity = '0';
        tempContainer.style.transition = `opacity ${duration}ms ease-in-out`;

        // Temporarily change container for rendering
        const originalContainer = this.config.container;
        this.config.container = tempContainer;
        this.render();
        this.config.container = originalContainer;

        // Add new background to container
        originalContainer.appendChild(tempContainer);

        // Trigger fade in
        await new Promise(resolve => {
            requestAnimationFrame(() => {
                tempContainer.style.opacity = '1';
                
                // Fade out old element
                if (oldElement) {
                    oldElement.style.transition = `opacity ${duration}ms ease-in-out`;
                    oldElement.style.opacity = '0';
                }

                // Complete transition
                setTimeout(() => {
                    if (oldElement) {
                        oldElement.remove();
                    }
                    
                    // Move new elements to main container
                    const newBg = tempContainer.querySelector('.weather-bg') || 
                                  tempContainer.querySelector('.weather-canvas');
                    if (newBg) {
                        originalContainer.appendChild(newBg);
                        this.bgElement = newBg.classList.contains('weather-bg') ? newBg : null;
                        this.canvasElement = newBg.tagName === 'CANVAS' ? newBg : null;
                        if (this.canvasElement) {
                            this.canvasContext = this.canvasElement.getContext('2d');
                        }
                    }
                    tempContainer.remove();
                    
                    // Start new animation
                    this.start();
                    
                    resolve();
                }, duration);
            });
        });

        this.log('Transition complete');
    }

    /**
     * Determine weather state from weather data
     */
    determineWeatherState(weatherData) {
        const { main, code, isNight } = weatherData;

        // Handle night time
        if (isNight) {
            if (main === 'Clear') return 'night-clear';
            if (main === 'Clouds') return 'night-cloudy';
        }

        // Handle sunrise/sunset
        const hour = new Date().getHours();
        if (hour >= 5 && hour <= 7) return 'sunrise';
        if (hour >= 18 && hour <= 20) return 'sunset';

        // Map OpenWeatherMap codes to weather states
        // https://openweathermap.org/weather-conditions
        if (code >= 200 && code < 300) return 'heavy-rain'; // Thunderstorm
        if (code >= 300 && code < 400) return 'light-rain'; // Drizzle
        if (code >= 500 && code < 600) {
            return code >= 502 ? 'heavy-rain' : 'light-rain'; // Rain
        }
        if (code >= 600 && code < 700) return 'snow'; // Snow
        if (code >= 700 && code < 800) return 'fog'; // Atmosphere (Mist, Fog)
        if (code === 800) return 'sunny'; // Clear
        if (code === 801 || code === 802) return 'partly-cloudy'; // Few/Scattered clouds
        if (code >= 803) return 'overcast'; // Broken/Overcast clouds

        return 'sunny'; // Default
    }

    /**
     * Render background based on selected technique
     */
    render() {
        // Remove existing background
        this.cleanup();

        // Render based on technique
        switch (this.currentTechnique) {
            case 'css':
                this.renderCSS();
                break;
            case 'canvas':
                this.renderCanvas();
                break;
            case 'webgl':
                this.renderWebGL();
                break;
            default:
                this.renderCSS();
        }
    }

    /**
     * Render using CSS/SVG (lightweight)
     */
    renderCSS() {
        this.bgElement = document.createElement('div');
        this.bgElement.className = `weather-bg bg-${this.currentWeather}`;
        
        // Add weather-specific elements
        switch (this.currentWeather) {
            case 'sunny':
                this.bgElement.innerHTML = `
                    <div class="sun"></div>
                    <div class="heat-shimmer"></div>
                    <div class="cloud cloud-1"></div>
                    <div class="cloud cloud-2"></div>
                `;
                break;

            case 'partly-cloudy':
                this.bgElement.innerHTML = `
                    <div class="sun" style="opacity: 0.7;"></div>
                    ${this.generateClouds(4)}
                `;
                break;

            case 'overcast':
                this.bgElement.innerHTML = `
                    <div class="overcast-layer"></div>
                    <div class="vignette"></div>
                `;
                break;

            case 'light-rain':
                this.bgElement.innerHTML = `
                    <div class="rain">
                        ${this.generateRaindrops(30)}
                    </div>
                    <div class="ripple">${this.generateRipples(5)}</div>
                `;
                break;

            case 'heavy-rain':
                this.bgElement.innerHTML = `
                    <div class="rain heavy-rain">
                        ${this.generateRaindrops(60)}
                    </div>
                    <div class="lightning"></div>
                    <div class="ripple">${this.generateRipples(10)}</div>
                `;
                break;

            case 'snow':
                this.bgElement.innerHTML = `
                    ${this.generateSnowflakes(40)}
                    <div class="snow-accumulation"></div>
                `;
                break;

            case 'fog':
                this.bgElement.innerHTML = `
                    <div class="fog-layer"></div>
                    <div class="fog-layer" style="animation-delay: -15s; opacity: 0.5;"></div>
                `;
                break;

            case 'night-clear':
                this.bgElement.innerHTML = `
                    <div class="stars"></div>
                    <div class="moon"></div>
                `;
                break;

            case 'sunrise':
            case 'sunset':
                this.bgElement.innerHTML = `
                    <div class="sun-orb" style="left: ${this.currentWeather === 'sunrise' ? '10%' : '80%'};"></div>
                    ${this.generateClouds(3)}
                `;
                break;
        }

        // Add fade-in transition
        if (this.config.enableTransitions) {
            this.bgElement.style.opacity = '0';
            this.config.container.appendChild(this.bgElement);
            setTimeout(() => {
                this.bgElement.style.opacity = '1';
            }, 10);
        } else {
            this.config.container.appendChild(this.bgElement);
        }
    }

    /**
     * Generate cloud HTML
     */
    generateClouds(count) {
        let html = '';
        for (let i = 0; i < count; i++) {
            const top = Math.random() * 60 + 10;
            const delay = Math.random() * 10;
            const duration = 20 + Math.random() * 20;
            html += `<div class="cloud cloud-${i + 1}" style="top: ${top}%; animation-delay: ${delay}s; animation-duration: ${duration}s;"></div>`;
        }
        return html;
    }

    /**
     * Generate raindrop HTML
     */
    generateRaindrops(count) {
        const limit = this.capabilities.isMobile ? Math.min(count, 20) : count;
        let html = '';
        for (let i = 0; i < limit; i++) {
            const left = Math.random() * 100;
            const delay = Math.random() * 2;
            html += `<div class="raindrop" style="left: ${left}%; animation-delay: ${delay}s;"></div>`;
        }
        return html;
    }

    /**
     * Generate ripple HTML
     */
    generateRipples(count) {
        let html = '';
        for (let i = 0; i < count; i++) {
            const left = Math.random() * 100;
            const delay = Math.random() * 2;
            html += `<div class="ripple-circle" style="left: ${left}%; animation-delay: ${delay}s;"></div>`;
        }
        return html;
    }

    /**
     * Generate snowflake HTML
     */
    generateSnowflakes(count) {
        const limit = this.capabilities.isMobile ? Math.min(count, 25) : count;
        const symbols = ['❄', '❅', '❆'];
        let html = '';
        for (let i = 0; i < limit; i++) {
            const left = Math.random() * 100;
            const delay = Math.random() * 10;
            const size = 0.5 + Math.random() * 1;
            const symbol = symbols[Math.floor(Math.random() * symbols.length)];
            html += `<div class="snowflake" style="left: ${left}%; animation-delay: ${delay}s; font-size: ${size}em;">${symbol}</div>`;
        }
        return html;
    }

    /**
     * Render using Canvas (advanced particles)
     */
    renderCanvas() {
        // Create canvas element
        this.canvasElement = document.createElement('canvas');
        this.canvasElement.className = 'weather-bg weather-canvas';
        this.canvasElement.width = window.innerWidth * this.capabilities.devicePixelRatio;
        this.canvasElement.height = window.innerHeight * this.capabilities.devicePixelRatio;
        this.canvasElement.style.width = '100%';
        this.canvasElement.style.height = '100%';

        this.canvasContext = this.canvasElement.getContext('2d');
        this.config.container.appendChild(this.canvasElement);

        // Initialize particles based on weather
        this.initializeParticles();

        this.log('Canvas rendering initialized');
    }

    /**
     * Initialize particles for canvas rendering
     */
    initializeParticles() {
        this.particles = [];
        
        let particleCount = this.config.particleCount === 'auto' 
            ? (this.capabilities.isMobile ? 50 : 100)
            : this.config.particleCount;

        const width = this.canvasElement.width;
        const height = this.canvasElement.height;

        switch (this.currentWeather) {
            case 'light-rain':
            case 'heavy-rain':
                for (let i = 0; i < particleCount; i++) {
                    this.particles.push({
                        x: Math.random() * width,
                        y: Math.random() * height,
                        speedY: 5 + Math.random() * 10,
                        speedX: Math.random() * 2 - 1,
                        length: 10 + Math.random() * 20,
                        opacity: 0.3 + Math.random() * 0.4
                    });
                }
                break;

            case 'snow':
                for (let i = 0; i < particleCount; i++) {
                    this.particles.push({
                        x: Math.random() * width,
                        y: Math.random() * height,
                        speedY: 1 + Math.random() * 2,
                        speedX: Math.random() * 2 - 1,
                        size: 2 + Math.random() * 4,
                        opacity: 0.5 + Math.random() * 0.5
                    });
                }
                break;
        }
    }

    /**
     * Render WebGL (premium effects - placeholder)
     */
    renderWebGL() {
        this.log('WebGL rendering not yet implemented, falling back to canvas');
        this.currentTechnique = 'canvas';
        this.renderCanvas();
    }

    /**
     * Start animation loop
     */
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.isPaused = false;

        if (this.currentTechnique === 'canvas' || this.currentTechnique === 'webgl') {
            this.animate();
        }

        this.log('Animation started');
    }

    /**
     * Animation loop for canvas/WebGL
     */
    animate() {
        if (!this.isRunning || this.isPaused) return;

        if (this.currentTechnique === 'canvas') {
            this.animateCanvas();
        }

        this.animationFrame = requestAnimationFrame(() => this.animate());
    }

    /**
     * Animate canvas particles
     */
    animateCanvas() {
        const ctx = this.canvasContext;
        const width = this.canvasElement.width;
        const height = this.canvasElement.height;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Draw background gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        
        switch (this.currentWeather) {
            case 'light-rain':
            case 'heavy-rain':
                gradient.addColorStop(0, '#667eea');
                gradient.addColorStop(1, '#764ba2');
                break;
            case 'snow':
                gradient.addColorStop(0, '#e6f2ff');
                gradient.addColorStop(1, '#d0e7ff');
                break;
            default:
                gradient.addColorStop(0, '#89c4f4');
                gradient.addColorStop(1, '#b8d5f2');
        }
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Update and draw particles
        this.particles.forEach(particle => {
            // Update position
            particle.y += particle.speedY;
            particle.x += particle.speedX;

            // Reset if out of bounds
            if (particle.y > height) {
                particle.y = -20;
                particle.x = Math.random() * width;
            }
            if (particle.x < 0 || particle.x > width) {
                particle.x = Math.random() * width;
            }

            // Draw particle
            ctx.save();
            ctx.globalAlpha = particle.opacity;
            
            switch (this.currentWeather) {
                case 'light-rain':
                case 'heavy-rain':
                    ctx.strokeStyle = 'rgba(174, 194, 224, 0.8)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(particle.x, particle.y);
                    ctx.lineTo(particle.x, particle.y + particle.length);
                    ctx.stroke();
                    break;

                case 'snow':
                    ctx.fillStyle = 'white';
                    ctx.beginPath();
                    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
                    ctx.fill();
                    break;
            }
            
            ctx.restore();
        });
    }

    /**
     * Stop animation
     */
    stop() {
        this.isRunning = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        this.log('Animation stopped');
    }

    /**
     * Pause animation
     */
    pause() {
        this.isPaused = true;
        this.log('Animation paused');
    }

    /**
     * Resume animation
     */
    resume() {
        if (!this.isRunning) return;
        this.isPaused = false;
        this.animate();
        this.log('Animation resumed');
    }

    /**
     * Cleanup and remove background elements
     */
    cleanup() {
        if (this.bgElement) {
            this.bgElement.remove();
            this.bgElement = null;
        }
        if (this.canvasElement) {
            this.canvasElement.remove();
            this.canvasElement = null;
            this.canvasContext = null;
        }
        this.particles = [];
    }

    /**
     * Destroy manager and cleanup
     */
    destroy() {
        this.stop();
        this.cleanup();
        this.log('BackgroundManager destroyed');
    }

    /**
     * Debug logging
     */
    log(...args) {
        if (this.config.debug) {
            console.log('[BackgroundManager]', ...args);
        }
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BackgroundManager;
}
