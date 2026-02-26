<script setup>
import { ref } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'
import { Loader2, Copy, Check, Database, Shield } from 'lucide-vue-next'

const router = useRouter()
const step = ref(1)

const dbHost = ref('localhost')
const dbPort = ref('3306')
const dbName = ref('nav')
const dbUser = ref('root')
const dbPassword = ref('')

const qrCode = ref('')
const error = ref('')
const secret = ref('')
const isLoading = ref(false)
const copied = ref(false)

const setup = async () => {
  error.value = ''
  isLoading.value = true
  try {
    const { data } = await axios.post('/api/setup', {
      dbHost: dbHost.value,
      dbPort: dbPort.value,
      dbName: dbName.value,
      dbUser: dbUser.value,
      dbPassword: dbPassword.value
    })
    qrCode.value = data.qrCode
    secret.value = data.secret
    step.value = 2
  } catch (e) {
    error.value = e.response?.data?.error || '配置失败'
  } finally {
    isLoading.value = false
  }
}

const copySecret = () => {
  navigator.clipboard.writeText(secret.value)
  copied.value = true
  setTimeout(() => copied.value = false, 2000)
}

const finish = () => {
  router.push('/login')
}
</script>

<template>
  <div class="min-h-screen bg-white flex items-center justify-center px-4">
    <div class="w-full max-w-sm">
      <!-- Header -->
      <div class="text-center mb-10">
        <h1 class="text-4xl font-medium text-gray-900 mb-2">Quick</h1>
        <div class="flex items-center justify-center gap-2">
          <span class="text-xs px-2 py-1 rounded-full" :class="step === 1 ? 'bg-gray-100 text-gray-600' : 'text-green-600 bg-green-50'">
            {{ step === 1 ? '进行中' : '完成' }}
          </span>
        </div>
      </div>

      <!-- Step 1: DB Config -->
      <div v-if="step === 1" class="space-y-6">
        <div class="flex items-center gap-3 mb-6">
          <div class="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
            <Database class="w-5 h-5 text-gray-600" />
          </div>
          <div>
            <h2 class="font-medium text-gray-900">数据库配置</h2>
            <p class="text-xs text-gray-400">连接 MySQL 数据库</p>
          </div>
        </div>

        <form @submit.prevent="setup" class="space-y-4">
          <div>
            <label class="text-xs text-gray-400 mb-1.5 block">地址</label>
            <div class="flex gap-2">
              <input v-model="dbHost" placeholder="localhost" class="input-base flex-1" required />
              <input v-model="dbPort" placeholder="3306" class="input-base w-24" required />
            </div>
          </div>
          
          <div>
            <label class="text-xs text-gray-400 mb-1.5 block">数据库名</label>
            <input v-model="dbName" placeholder="nav" class="input-base w-full" required />
          </div>
          
          <div>
            <label class="text-xs text-gray-400 mb-1.5 block">用户名</label>
            <input v-model="dbUser" placeholder="root" class="input-base w-full" required />
          </div>
          
          <div>
            <label class="text-xs text-gray-400 mb-1.5 block">密码</label>
            <input v-model="dbPassword" type="password" placeholder="可选" class="input-base w-full" />
          </div>

          <div v-if="error" class="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg">{{ error }}</div>

          <button 
            type="submit" 
            :disabled="isLoading" 
            class="w-full bg-gray-900 text-white py-3 rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Loader2 v-if="isLoading" class="w-4 h-4 animate-spin" />
            <span v-else>下一步</span>
          </button>
        </form>
      </div>

      <!-- Step 2: 2FA -->
      <div v-else class="space-y-6">
        <div class="flex items-center gap-3 mb-6">
          <div class="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
            <Shield class="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h2 class="font-medium text-gray-900">绑定 2FA</h2>
            <p class="text-xs text-gray-400">使用 Authenticator 扫描</p>
          </div>
        </div>

        <div class="bg-gray-50 rounded-2xl p-6 text-center">
          <img :src="qrCode" class="w-40 h-40 mx-auto rounded-xl bg-white mb-4" />
          <p class="text-xs text-gray-400 mb-3">使用 Google Authenticator 或<br/>同类应用扫描上方二维码</p>
        </div>

        <div class="bg-gray-50 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p class="text-[10px] text-gray-400 uppercase mb-1">密钥</p>
            <p class="text-xs font-mono text-gray-600">{{ secret }}</p>
          </div>
          <button @click="copySecret" class="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 shadow-sm">
            <Check v-if="copied" class="w-4 h-4 text-green-500" />
            <Copy v-else class="w-4 h-4" />
          </button>
        </div>

        <button @click="finish" class="w-full bg-gray-900 text-white py-3 rounded-xl text-sm font-medium">
          完成
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.input-base {
  @apply px-4 py-2.5 bg-gray-50 border-0 rounded-xl text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:bg-gray-100 transition-colors;
}
</style>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap');

* {
  font-family: 'Inter', sans-serif;
}

body {
  -webkit-font-smoothing: antialiased;
}
</style>
