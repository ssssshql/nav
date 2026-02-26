<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()
const error = ref('')
const inputs = ref(['', '', '', '', '', ''])
const inputRefs = ref([])

const handleInput = (index, e) => {
  const value = e.target.value.replace(/\D/g, '')
  inputs.value[index] = value.slice(-1)
  
  if (value && index < 5) {
    inputRefs.value[index + 1]?.focus()
  }
}

const handleKeydown = (index, e) => {
  if (e.key === 'Backspace' && !inputs.value[index] && index > 0) {
    inputRefs.value[index - 1]?.focus()
  }
}

const handlePaste = (e) => {
  e.preventDefault()
  const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
  paste.split('').forEach((char, i) => {
    inputs.value[i] = char
  })
  if (paste.length > 0 && paste.length < 6) {
    inputRefs.value[paste.length]?.focus()
  } else if (paste.length === 6) {
    inputRefs.value[5]?.focus()
  }
}

const login = async () => {
  const code = inputs.value.join('')
  if (code.length !== 6) {
    error.value = '请输入完整的 6 位 2FA 验证码'
    return
  }
  
  try {
    const { data } = await axios.post('/api/login', {
      token: code
    })
    auth.setToken(data.token)
    router.push('/')
  } catch (e) {
    error.value = e.response?.data?.error || '登录失败'
  }
}

onMounted(() => {
  inputRefs.value[0]?.focus()
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-white px-4">
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <h1 class="text-3xl font-medium text-gray-900 mb-2">Quick</h1>
        <p class="text-sm text-gray-400">安全验证</p>
        <p class="text-sm text-gray-400 mt-2">请输入 2FA 验证码</p>
      </div>

      <form @submit.prevent="login">
        <div class="flex justify-center gap-2 mb-6" @paste="handlePaste">
          <input
            v-for="(_, i) in 6"
            :key="i"
            ref="inputRefs"
            :value="inputs[i]"
            @input="handleInput(i, $event)"
            @keydown="handleKeydown(i, $event)"
            type="text"
            inputmode="numeric"
            maxlength="1"
            class="w-12 h-14 text-center text-xl font-mono bg-gray-50 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 transition-all"
          />
        </div>

        <div v-if="error" class="text-red-500 text-sm text-center mb-4">{{ error }}</div>

        <button type="submit" class="w-full bg-gray-900 text-white py-3 rounded-xl hover:bg-gray-800 transition-colors text-sm font-medium">
          验证
        </button>

        <div class="text-center mt-6">
          <router-link to="/" class="text-sm text-gray-400 hover:text-gray-600">返回首页</router-link>
        </div>
      </form>
    </div>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap');

* {
  font-family: 'Inter', sans-serif;
}

body {
  -webkit-font-smoothing: antialiased;
}
</style>
