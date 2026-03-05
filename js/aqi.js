
const AQI = {
    // Fetch air quality data
    async fetchAirQuality(lat, lon) {
        try {
            const response = await fetch(
                `${CONFIG.BASE_URL}/air_pollution?lat=${lat}&lon=${lon}&appid=${CONFIG.API_KEY}`
            );
            
            if (!response.ok) throw new Error('AQI data unavailable');
            
            const data = await response.json();
            this.displayAirQuality(data.list[0]);
            
        } catch (error) {
            console.error('AQI fetch error:', error);
            this.displayUnavailableAQI();
        }
    },

    // Display air quality data
    displayAirQuality(data) {
        const aqi = data.main.aqi;
        const components = data.components;
        
        // Calculate US AQI from PM2.5 (more accurate number)
        const pm25 = components.pm2_5;
        const usAQI = this.calculateUSAQI(pm25);
        
        // Get city name from Weather object if available
        const cityName = window.Weather?.currentCity?.name || '';
        
        // Display AQI with city name
        const aqiValueEl = document.getElementById('aqiValue');
        const aqiStatusEl = document.getElementById('aqiStatus');
        
        // Show city name and AQI value
        if (cityName) {
            aqiValueEl.textContent = usAQI;
            aqiStatusEl.textContent = `${cityName} AQI is ${usAQI}`;
        } else {
            aqiValueEl.textContent = usAQI;
            aqiStatusEl.textContent = `AQI: ${usAQI}`;
        }
        
        // Apply color based on AQI level
        const aqiInfo = this.getUSAQIInfo(usAQI);
        aqiValueEl.className = `aqi-value ${aqiInfo.class}`;
        aqiStatusEl.style.color = aqiInfo.color;
        
        // Update indicator position on scale (0-500 range)
        const indicator = document.getElementById('aqiIndicator');
        if (indicator) {
            const position = Math.min((usAQI / 500) * 100, 100);
            indicator.style.left = `${position}%`;
        }
        
        // Show section
        document.getElementById('aqiSection').style.display = 'block';
    },

    // Display unavailable AQI
    displayUnavailableAQI() {
        document.getElementById('aqiValue').textContent = 'N/A';
        document.getElementById('aqiStatus').textContent = 'Data unavailable';
        
        const fields = ['pm25', 'pm10', 'co', 'no2', 'o3', 'so2'];
        fields.forEach(field => {
            document.getElementById(field).textContent = 'N/A';
        });
    },

    // Get AQI information
    getAQIInfo(aqi) {
        const aqiLevels = {
            1: { status: 'Good', class: 'good', color: '#22c55e' },
            2: { status: 'Fair', class: 'good', color: '#22c55e' },
            3: { status: 'Moderate', class: 'moderate', color: '#fbbf24' },
            4: { status: 'Poor', class: 'unhealthy', color: '#f97316' },
            5: { status: 'Very Poor', class: 'hazardous', color: '#dc2626' }
        };
        
        return aqiLevels[aqi] || { 
            status: 'Unknown', 
            class: '', 
            color: '#6b7280' 
        };
    },

    // Calculate US AQI from PM2.5 concentration
    calculateUSAQI(pm25) {
        // US EPA AQI breakpoints for PM2.5
        const breakpoints = [
            { cLow: 0, cHigh: 12, iLow: 0, iHigh: 50 },
            { cLow: 12.1, cHigh: 35.4, iLow: 51, iHigh: 100 },
            { cLow: 35.5, cHigh: 55.4, iLow: 101, iHigh: 150 },
            { cLow: 55.5, cHigh: 150.4, iLow: 151, iHigh: 200 },
            { cLow: 150.5, cHigh: 250.4, iLow: 201, iHigh: 300 },
            { cLow: 250.5, cHigh: 500, iLow: 301, iHigh: 500 }
        ];

        for (const bp of breakpoints) {
            if (pm25 >= bp.cLow && pm25 <= bp.cHigh) {
                const aqi = ((bp.iHigh - bp.iLow) / (bp.cHigh - bp.cLow)) * 
                           (pm25 - bp.cLow) + bp.iLow;
                return Math.round(aqi);
            }
        }

        return pm25 > 500 ? 500 : 0;
    },

    // Get US AQI information with detailed levels
    getUSAQIInfo(aqi) {
        if (aqi <= 50) {
            return { status: 'Good', class: 'good', color: '#00e400' };
        } else if (aqi <= 100) {
            return { status: 'Moderate', class: 'moderate', color: '#ffff00' };
        } else if (aqi <= 150) {
            return { status: 'Unhealthy for Sensitive Groups', class: 'unhealthy-sensitive', color: '#ff7e00' };
        } else if (aqi <= 200) {
            return { status: 'Unhealthy', class: 'unhealthy', color: '#ff0000' };
        } else if (aqi <= 300) {
            return { status: 'Very Unhealthy', class: 'very-unhealthy', color: '#8f3f97' };
        } else {
            return { status: 'Hazardous', class: 'hazardous', color: '#7e0023' };
        }
    }
};

