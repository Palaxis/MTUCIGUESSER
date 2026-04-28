const WEATHER_API_BASE_URL = process.env.WEATHER_API_BASE_URL || 'https://api.open-meteo.com/v1/forecast';
const WEATHER_API_TIMEOUT_MS = Number.parseInt(process.env.WEATHER_API_TIMEOUT_MS || '3500', 10);
const WEATHER_API_RETRY_COUNT = Number.parseInt(process.env.WEATHER_API_RETRY_COUNT || '2', 10);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const CITY_COORDS = {
  moscow: { city: 'Moscow', latitude: 55.7558, longitude: 37.6176 },
  msk: { city: 'Moscow', latitude: 55.7558, longitude: 37.6176 },
  москвa: { city: 'Moscow', latitude: 55.7558, longitude: 37.6176 },
  москва: { city: 'Moscow', latitude: 55.7558, longitude: 37.6176 }
};

function resolveCity(cityRaw) {
  const normalized = String(cityRaw || 'Moscow').trim().toLowerCase();
  return CITY_COORDS[normalized] || { city: 'Moscow', latitude: 55.7558, longitude: 37.6176 };
}

function weatherCodeToText(code) {
  if (code === 0) return 'ясно';
  if ([1, 2, 3].includes(code)) return 'облачно';
  if ([45, 48].includes(code)) return 'туман';
  if ([51, 53, 55, 56, 57].includes(code)) return 'морось';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'дождь';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'снег';
  if ([95, 96, 99].includes(code)) return 'гроза';
  return 'переменная погода';
}

function toInternalWeatherFormat(apiData, cityName) {
  if (!apiData || !apiData.current) {
    return null;
  }

  const temperature = Math.round(Number(apiData.current.temperature_2m));
  const weatherDescription = weatherCodeToText(Number(apiData.current.weather_code));
  const city = cityName || 'Moscow';

  let recommendation = 'Проверьте погоду перед прогулкой по корпусу.';
  if (temperature <= 0) {
    recommendation = 'На улице холодно: пригодится верхняя одежда перед дорогой в корпус.';
  } else if (temperature >= 25) {
    recommendation = 'Тепло: можно дойти до корпуса без лишней верхней одежды.';
  }

  return {
    city,
    temperatureCelsius: temperature,
    weather: weatherDescription,
    recommendation,
    sourceUpdatedAt: new Date().toISOString()
  };
}

async function fetchWeatherWithTimeout(city) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEATHER_API_TIMEOUT_MS);
  try {
    const location = resolveCity(city);
    const params = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      current: 'temperature_2m,weather_code',
      timezone: 'auto'
    });
    const response = await fetch(`${WEATHER_API_BASE_URL}?${params.toString()}`, {
      method: 'GET',
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`);
    }
    return { payload: await response.json(), city: location.city };
  } finally {
    clearTimeout(timeout);
  }
}

export async function getWeatherHint(city) {
  let lastError = null;
  for (let attempt = 0; attempt <= WEATHER_API_RETRY_COUNT; attempt += 1) {
    try {
      const { payload, city: resolvedCity } = await fetchWeatherWithTimeout(city);
      return toInternalWeatherFormat(payload, resolvedCity);
    } catch (error) {
      lastError = error;
      if (attempt < WEATHER_API_RETRY_COUNT) {
        await sleep(150 * (attempt + 1));
      }
    }
  }

  throw lastError || new Error('Weather API unavailable');
}
