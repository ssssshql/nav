<script setup>
import { ref } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()
const token = ref('') // 2FA code
const error = ref('')

const login = async () => {
  try {
    const { data } = await axios.post('/api/login', {
      token: token.value
    })
    auth.setToken(data.token)
    router.push('/')
  } catch (e) {
    error.value = e.response?.data?.error || '登录失败'
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 px-4">
    <div class="bg-white p-8 rounded-2xl shadow-sm w-full max-w-sm border border-gray-100">
      <h1 class="text-2xl font-bold mb-6 text-center">安全验证</h1>
      <form @submit.prevent="login" class="space-y-4">
        <div class="text-center mb-4">
            <p class="text-sm text-gray-500">请输入 Authenticator App 中的 6 位验证码</p>
        </div>
        <input 
            v-model="token" 
            placeholder="2FA 验证码" 
            class="w-full p-3 border rounded-lg text-center text-lg tracking-widest font-mono" 
            maxlength="6"
            pattern="\d*"
            inputmode="numeric"
            autofocus
            required 
        />
        <div v-if="error" class="text-red-500 text-sm text-center">{{ error }}</div>
        <button type="submit" class="w-full bg-black text-white py-2 rounded-lg hover:bg-gray-800">验证</button>
        <div class="text-center mt-4">
            <router-link to="/" class="text-sm text-gray-500">返回首页</router-link>
        </div>
      </form>
    </div>
  </div>
</template>
