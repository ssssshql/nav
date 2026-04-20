import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token') || '')
  const isLoggedIn = ref(!!token.value)

  const setToken = (newToken) => {
    token.value = newToken
    isLoggedIn.value = !!newToken
    localStorage.setItem('token', newToken)
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
  }

  const logout = () => {
    token.value = ''
    isLoggedIn.value = false
    localStorage.removeItem('token')
    delete axios.defaults.headers.common['Authorization']
  }

  // 验证当前 token 是否有效
  const checkAuth = async () => {
    if (!token.value) return
    try {
      await axios.get('/api/user-info')
    } catch (e) {
      // 401 会被拦截器自动处理（logout + 跳转）
    }
  }

  // Init axios header
  if (token.value) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token.value}`
  }

  // Axios 响应拦截器：401 时自动退出登录
  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response && error.response.status === 401 && isLoggedIn.value) {
        logout()
        // 跳转到登录页（避免重复跳转）
        if (window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
      }
      return Promise.reject(error)
    }
  )

  return { token, isLoggedIn, setToken, logout, checkAuth }
})

