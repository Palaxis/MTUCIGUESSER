import axios from 'axios'

// Настройка axios для работы с сессиями
axios.defaults.withCredentials = true

// Автоматически определяем URL сервера на основе текущего хоста
const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }
  // В development режиме Vite проксирует /api запросы
  if (import.meta.env.DEV) {
    return ''
  }
  // В production используем тот же хост на порту 3001
  const { protocol, hostname } = window.location
  return `${protocol}//${hostname}:3001`
}

axios.defaults.baseURL = getApiBaseUrl()

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 403 && !error?.response?.data?.error) {
      error.response.data = {
        error: 'Недостаточно прав для выполнения этого действия'
      }
    }
    return Promise.reject(error)
  }
)

export const apiClient = axios

