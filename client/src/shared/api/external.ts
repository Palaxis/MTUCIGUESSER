import { apiClient } from './client'

export interface WeatherHintData {
  city: string
  temperatureCelsius: number
  weather: string
  recommendation: string
  sourceUpdatedAt: string
}

export async function getDailyWeatherHint(city = 'Moscow') {
  const response = await apiClient.get<{ data: WeatherHintData | null }>('/api/external/weather-hint', {
    params: { city }
  })
  return response.data?.data ?? null
}
