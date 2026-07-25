const axios = require("axios");

const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

const WEATHER_CODES = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

async function getWeather(location) {
  const { data: geo } = await axios.get(GEOCODE_URL, {
    params: { name: location, count: 1 },
  });

  const place = geo.results?.[0];
  if (!place) {
    throw new Error(`Could not find a location matching "${location}"`);
  }

  const { data: forecast } = await axios.get(FORECAST_URL, {
    params: {
      latitude: place.latitude,
      longitude: place.longitude,
      current: "temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code",
      daily: "temperature_2m_max,temperature_2m_min,weather_code",
      timezone: "auto",
      forecast_days: 3,
    },
  });

  return {
    location: [place.name, place.admin1, place.country].filter(Boolean).join(", "),
    current: {
      temperatureC: forecast.current.temperature_2m,
      humidityPercent: forecast.current.relative_humidity_2m,
      windSpeedKmh: forecast.current.wind_speed_10m,
      condition: WEATHER_CODES[forecast.current.weather_code] || "Unknown",
    },
    daily: forecast.daily.time.map((date, i) => ({
      date,
      maxTemperatureC: forecast.daily.temperature_2m_max[i],
      minTemperatureC: forecast.daily.temperature_2m_min[i],
      condition: WEATHER_CODES[forecast.daily.weather_code[i]] || "Unknown",
    })),
  };
}

module.exports = { getWeather };
