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

  // Init axios header
  if (token.value) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token.value}`
  }

  return { token, isLoggedIn, setToken, logout }
})
