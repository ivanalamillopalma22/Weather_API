// Use config.apiKey if available, otherwise fallback (though config.js should be loaded)
const apiKey = typeof config !== 'undefined' ? config.apiKey : '143cc23ece75e1d31a1ecfb6e96d4803'; 
const apiBase = 'https://api.openweathermap.org/data/2.5/';

const searchBtn = document.getElementById('search-btn');
const cityInput = document.getElementById('city-input');
const themeToggle = document.getElementById('theme-toggle');
const body = document.body;
const errorContainer = document.getElementById('error-container');
const loadingIndicator = document.getElementById('loading-indicator');
const weatherDashboard = document.querySelector('.weather-dashboard');
const favoriteBtn = document.getElementById('favorite-btn');
const favoritesList = document.getElementById('favorites-list');

const loadMoreBtn = document.getElementById('load-more-forecast');
const sortForecast = document.getElementById('sort-forecast');
const filterForecast = document.getElementById('filter-forecast');

// Forecast pagination state
let forecastPagination = {
    dailyData: [],
    shown: 0,
    sortedFiltered: [],
    sort: 'default',
    filter: ''
};

// --- FAVORITES LOGIC ---
function getFavorites() {
    return JSON.parse(localStorage.getItem('weather-favorites') || '[]');
}
function saveFavorites(favs) {
    localStorage.setItem('weather-favorites', JSON.stringify(favs));
}
function isFavorite(city) {
    const favs = getFavorites();
    return favs.includes(city.toLowerCase());
}
function updateFavoriteBtn(city) {
    if (!city) {
        favoriteBtn.classList.remove('favorited');
        favoriteBtn.title = 'Save Favorite';
        return;
    }
    if (isFavorite(city)) {
        favoriteBtn.classList.add('favorited');
        favoriteBtn.title = 'Remove Favorite';
    } else {
        favoriteBtn.classList.remove('favorited');
        favoriteBtn.title = 'Save Favorite';
    }
    // Always show the star (★) character
    favoriteBtn.textContent = '★';
}
function renderFavorites() {
    const favs = getFavorites();
    favoritesList.innerHTML = '';
    favs.forEach(city => {
        const btn = document.createElement('button');
        btn.textContent = city.charAt(0).toUpperCase() + city.slice(1);
        btn.className = 'favorite-city-btn';
        btn.onclick = () => {
            cityInput.value = city;
            getWeather(city);
        };
        favoritesList.appendChild(btn);
    });
}
favoriteBtn.addEventListener('click', () => {
    const city = cityInput.value.trim();
    if (!city) return;
    let favs = getFavorites();
    const cityLower = city.toLowerCase();
    if (favs.includes(cityLower)) {
        favs = favs.filter(f => f !== cityLower);
    } else {
        favs.push(cityLower);
    }
    saveFavorites(favs);
    updateFavoriteBtn(city);
    renderFavorites();
});
cityInput.addEventListener('input', () => {
    updateFavoriteBtn(cityInput.value.trim());
});
// --- END FAVORITES LOGIC ---

// Event Listeners
searchBtn.addEventListener('click', () => {
    const city = cityInput.value;
    if (validateInput(city)) {
        getWeather(city);
    }
});

cityInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const city = cityInput.value;
        if (validateInput(city)) {
            getWeather(city);
        }
    }
});

themeToggle.addEventListener('click', () => {
    const currentTheme = body.getAttribute('data-theme');
    if (currentTheme === 'day') {
        body.setAttribute('data-theme', 'night');
        themeToggle.textContent = 'SWITCH MODE';
    } else {
        body.setAttribute('data-theme', 'day');
        themeToggle.textContent = 'NIGHT MODE';
    }
});

// Input Validation
function validateInput(city) {
    const trimmedCity = city.trim();
    if (!trimmedCity) {
        showError('Please enter a city name.');
        return false;
    }
    // Basic check for invalid characters (letters, spaces, hyphens allowed)
    if (!/^[a-zA-Z\s-]+$/.test(trimmedCity)) {
        showError('Invalid characters in city name.');
        return false;
    }
    return true;
}

// UI State Management
function showLoading() {
    loadingIndicator.classList.remove('hidden');
    weatherDashboard.classList.add('hidden'); // Hide dashboard while loading
    errorContainer.classList.add('hidden');
    searchBtn.disabled = true;
}

function hideLoading() {
    loadingIndicator.classList.add('hidden');
    searchBtn.disabled = false;
}

function showError(message) {
    errorContainer.textContent = message;
    errorContainer.classList.remove('hidden');
    weatherDashboard.classList.add('hidden'); // Hide dashboard on error
}

function showDashboard() {
    weatherDashboard.classList.remove('hidden');
    errorContainer.classList.add('hidden');
}

// Fetch Weather Data
async function getWeather(city) {
    showLoading();
    try {
        // Fetch Current Weather - Append ,PH to ensure Philippines
        // Trim whitespace and handle the query format
        const trimmedCity = city.trim();
        const queryCity = trimmedCity.toLowerCase().includes('ph') ? trimmedCity : `${trimmedCity},PH`;
        
        const weatherResponse = await fetch(`${apiBase}weather?q=${queryCity}&units=metric&appid=${apiKey}`);
        
        if (!weatherResponse.ok) {
            const errorData = await weatherResponse.json();
            if (weatherResponse.status === 401) {
                throw new Error('Invalid API Key. Please check your configuration.');
            }
            throw new Error(errorData.message || 'City not found');
        }
        
        const weatherData = await weatherResponse.json();

        // Filter for Luzon Coordinates (Approximate Bounding Box)
        // Luzon Lat: ~12.5 to ~19.0, Lon: ~119.0 to ~124.5
        const { lat, lon } = weatherData.coord;
        if (lat < 12.5 || lat > 19.0 || lon < 119.0 || lon > 124.5) {
            throw new Error('Please search for a city within Luzon, Philippines.');
        }

        updateCurrentWeather(weatherData);
        updateFavoriteBtn(weatherData.name);

        // Fetch Forecast
        const forecastResponse = await fetch(`${apiBase}forecast?q=${queryCity}&units=metric&appid=${apiKey}`);
        const forecastData = await forecastResponse.json();
        updateForecast(forecastData);
        
        // Fetch Air Quality (Bonus: Multiple API calls combined)
        const airQualityResponse = await fetch(`${apiBase}air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`);
        const airQualityData = await airQualityResponse.json();
        updateAirQuality(airQualityData);

        showDashboard();
        renderFavorites();

    } catch (error) {
        showError(error.message);
    } finally {
        hideLoading();
    }
}

function updateCurrentWeather(data) {
    document.getElementById('city-name').textContent = data.name;
    
    const date = new Date();
    document.getElementById('date').textContent = date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    document.getElementById('temperature').textContent = Math.round(data.main.temp);
    document.getElementById('humidity').textContent = `${data.main.humidity}%`;
    document.getElementById('wind-speed').textContent = `${data.wind.speed} km/h`;
    document.getElementById('weather-desc').textContent = data.weather[0].description.toUpperCase();
    
    const iconCode = data.weather[0].icon;
    const iconUrl = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
    const iconImg = document.getElementById('weather-icon');
    iconImg.src = iconUrl;
    iconImg.classList.remove('hidden');
}

function updateAirQuality(data) {
    const aqi = data.list[0].main.aqi;
    const aqiText = ['Good', 'Fair', 'Moderate', 'Poor', 'Very Poor'][aqi - 1] || 'Unknown';
    const aqiElement = document.getElementById('air-quality');
    if(aqiElement) {
        aqiElement.textContent = `${aqi} - ${aqiText}`;
    }
}

function updateForecast(data) {
    const forecastContainer = document.getElementById('forecast-container');
    forecastContainer.innerHTML = '';
    // Filter for one reading per day (e.g., near noon)
    const dailyData = data.list.filter(reading => reading.dt_txt.includes("12:00:00"));
    forecastPagination.dailyData = dailyData;
    forecastPagination.shown = 0;
    forecastPagination.sort = 'default';
    forecastPagination.filter = '';
    applySortFilterAndRender(3);
}

function applySortFilterAndRender(count, reset = true) {
    let arr = [...forecastPagination.dailyData];
    // Filter
    if (forecastPagination.filter) {
        arr = arr.filter(day => day.weather[0].description.toLowerCase().includes(forecastPagination.filter));
    }
    // Sort
    if (forecastPagination.sort === 'temp-asc') {
        arr.sort((a, b) => a.main.temp - b.main.temp);
    } else if (forecastPagination.sort === 'temp-desc') {
        arr.sort((a, b) => b.main.temp - a.main.temp);
    }
    forecastPagination.sortedFiltered = arr;
    if (reset) forecastPagination.shown = 0;
    renderForecastItems(count);
}

function renderForecastItems(count) {
    const forecastContainer = document.getElementById('forecast-container');
    const arr = forecastPagination.sortedFiltered;
    // Always clear before rendering new items (prevents stacking)
    forecastContainer.innerHTML = '';
    let start = 0;
    let end = Math.min(count, arr.length);
    for (let i = start; i < end; i++) {
        const day = arr[i];
        const date = new Date(day.dt * 1000);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const temp = Math.round(day.main.temp);
        const iconCode = day.weather[0].icon;
        const description = day.weather[0].description;
        const humidity = day.main.humidity;
        const forecastItem = document.createElement('div');
        forecastItem.classList.add('forecast-item');
        forecastItem.innerHTML = `
            <span>${dayName}</span>
            <img src="https://openweathermap.org/img/wn/${iconCode}.png" alt="icon" width="30">
            <span>${temp}°C</span>
            <span style="font-size: 0.8rem; text-transform: uppercase;">${description}</span>
            <span style="font-size: 0.8rem;">💧${humidity}%</span>
        `;
        forecastContainer.appendChild(forecastItem);
    }
    forecastPagination.shown = end;
    // Show or hide the Load More button
    if (forecastPagination.shown < arr.length) {
        loadMoreBtn.style.display = '';
    } else {
        loadMoreBtn.style.display = 'none';
    }
}

if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', function() {
        renderForecastItems(5); // Show all 5 after clicking
    });
}

if (sortForecast) {
    sortForecast.addEventListener('change', function() {
        forecastPagination.sort = this.value;
        applySortFilterAndRender(3);
    });
}
if (filterForecast) {
    filterForecast.addEventListener('input', function() {
        forecastPagination.filter = this.value.trim().toLowerCase();
        applySortFilterAndRender(3);
    });
}

// Initial load (Optional: Load a default city)
renderFavorites();
updateFavoriteBtn(cityInput.value.trim());
