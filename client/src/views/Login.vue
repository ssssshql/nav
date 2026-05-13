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
  <div class="min-h-screen flex items-center justify-center bg-page px-4">
    <div class="w-full max-w-sm fade-in">
      <div class="text-center mb-10">
        <h1 class="font-title text-3xl text-stone-800 tracking-tight mb-1">禅航</h1>
        <p class="text-xs text-stone-300 tracking-widest uppercase mb-6">Verification</p>
        <p class="text-sm text-stone-400">请输入 2FA 验证码</p>
      </div>

      <form @submit.prevent="login">
        <div class="flex justify-center gap-2.5 mb-6" @paste="handlePaste">
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
            class="w-12 h-14 text-center text-xl font-mono bg-white border border-stone-200/60 rounded-xl focus:outline-none focus:border-stone-400 transition-all text-stone-700"
          />
        </div>

        <div v-if="error" class="text-red-400 text-xs text-center mb-4 font-body">{{ error }}</div>

        <button type="submit" class="w-full bg-stone-800 text-white py-3 rounded-xl hover:bg-stone-700 transition-colors text-sm font-body shadow-sm">
          验证
        </button>

        <div class="text-center mt-8">
          <router-link to="/" class="text-xs text-stone-300 hover:text-stone-500 transition-colors font-body tracking-wide">返回首页</router-link>
        </div>
      </form>
    </div>
  </div>
</template>

<style>
.font-title {
  font-family: 'Instrument Serif', Georgia, serif;
}

* {
  font-family: 'DM Sans', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif;
}

body {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.bg-page {
  background-color: #faf9f7;
}

.fade-in {
  animation: fadeIn 0.5s ease both;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
