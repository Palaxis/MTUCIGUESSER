import axios from 'axios'

// Настройка axios для работы с сессиями
axios.defaults.withCredentials = true
axios.defaults.baseURL = 'http://localhost:3001'

export const apiClient = axios

