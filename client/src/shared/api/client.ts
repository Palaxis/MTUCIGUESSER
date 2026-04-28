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

let accessToken: string | null = null
let refreshRequest: Promise<string | null> | null = null

function setAuthHeader(token: string | null) {
  accessToken = token
  if (token) {
    axios.defaults.headers.common.Authorization = `Bearer ${token}`
  } else {
    delete axios.defaults.headers.common.Authorization
  }
}

export function setAccessToken(token: string | null) {
  setAuthHeader(token)
}

export function clearAccessToken() {
  setAuthHeader(null)
}

async function refreshAccessToken() {
  if (!refreshRequest) {
    refreshRequest = axios
      .post<{ accessToken: string }>('/api/auth/refresh')
      .then((response) => {
        const nextToken = response.data?.accessToken || null
        setAuthHeader(nextToken)
        return nextToken
      })
      .catch((_error) => {
        clearAccessToken()
        window.dispatchEvent(new CustomEvent('auth:session-expired'))
        return null
      })
      .finally(() => {
        refreshRequest = null
      })
  }
  return refreshRequest
}

axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config
    const statusCode = error?.response?.status
    const requestUrl = originalRequest?.url || ''
    const isAuthFlowRequest =
      requestUrl.includes('/api/auth/login') ||
      requestUrl.includes('/api/auth/register') ||
      requestUrl.includes('/api/auth/logout') ||
      requestUrl.includes('/api/auth/refresh')

    if (statusCode === 401 && originalRequest && !originalRequest._retry && !isAuthFlowRequest) {
      originalRequest._retry = true
      const refreshedToken = await refreshAccessToken()
      if (refreshedToken) {
        originalRequest.headers = {
          ...originalRequest.headers,
          Authorization: `Bearer ${refreshedToken}`
        }
        return axios(originalRequest)
      }
    }

    if (error?.response?.status === 403 && !error?.response?.data?.error) {
      error.response.data = {
        error: 'Недостаточно прав для выполнения этого действия'
      }
    }
    return Promise.reject(error)
  }
)

export const apiClient = axios

