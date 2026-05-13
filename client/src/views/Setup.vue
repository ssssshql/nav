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
  <div class="min-h-screen bg-page flex items-center justify-center px-4">
    <div class="w-full max-w-sm fade-in">
      <!-- Header -->
      <div class="text-center mb-10">
        <h1 class="font-title text-3xl text-stone-800 tracking-tight mb-2">禅航</h1>
        <div class="flex items-center justify-center gap-2">
          <span class="text-[11px] px-2.5 py-1 rounded-full font-body" :class="step === 1 ? 'bg-stone-100 text-stone-500' : 'text-green-700 bg-green-50'">
            {{ step === 1 ? '进行中' : '完成' }}
          </span>
        </div>
      </div>

      <!-- Step 1: DB Config -->
      <div v-if="step === 1" class="space-y-6">
        <div class="flex items-center gap-3 mb-6">
          <div class="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center">
            <Database class="w-5 h-5 text-stone-500" />
          </div>
          <div>
            <h2 class="font-medium text-stone-800 text-sm font-body">数据库配置</h2>
            <p class="text-xs text-stone-300 font-body">连接 MySQL 数据库</p>
          </div>
        </div>

        <form @submit.prevent="setup" class="space-y-4">
          <div>
            <label class="text-xs text-stone-400 mb-1.5 block font-body">地址</label>
            <div class="flex gap-2">
              <input v-model="dbHost" placeholder="localhost" class="input-base flex-1" required />
              <input v-model="dbPort" placeholder="3306" class="input-base w-24" required />
            </div>
          </div>

          <div>
            <label class="text-xs text-stone-400 mb-1.5 block font-body">数据库名</label>
            <input v-model="dbName" placeholder="nav" class="input-base w-full" required />
          </div>

          <div>
            <label class="text-xs text-stone-400 mb-1.5 block font-body">用户名</label>
            <input v-model="dbUser" placeholder="root" class="input-base w-full" required />
          </div>

          <div>
            <label class="text-xs text-stone-400 mb-1.5 block font-body">密码</label>
            <input v-model="dbPassword" type="password" placeholder="可选" class="input-base w-full" />
          </div>

          <div v-if="error" class="text-red-400 text-xs bg-red-50 px-3 py-2 rounded-lg font-body">{{ error }}</div>

          <button
            type="submit"
            :disabled="isLoading"
            class="w-full bg-stone-800 text-white py-3 rounded-xl text-sm font-body disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm hover:bg-stone-700 transition-colors"
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
            <h2 class="font-medium text-stone-800 text-sm font-body">绑定 2FA</h2>
            <p class="text-xs text-stone-300 font-body">使用 Authenticator 扫描</p>
          </div>
        </div>

        <div class="bg-stone-50 rounded-2xl p-6 text-center border border-stone-100">
          <img :src="qrCode" class="w-40 h-40 mx-auto rounded-xl bg-white mb-4 shadow-sm" />
          <p class="text-xs text-stone-400 mb-3 font-body leading-relaxed">使用 Google Authenticator 或<br/>同类应用扫描上方二维码</p>
        </div>

        <div class="bg-stone-50 border border-stone-100 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p class="text-[10px] text-stone-300 uppercase mb-1 font-body tracking-wider">密钥</p>
            <p class="text-xs font-mono text-stone-600">{{ secret }}</p>
          </div>
          <button @click="copySecret" class="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-stone-400 hover:text-stone-600 shadow-sm border border-stone-100 transition-colors">
            <Check v-if="copied" class="w-4 h-4 text-green-500" />
            <Copy v-else class="w-4 h-4" />
          </button>
        </div>

        <button @click="finish" class="w-full bg-stone-800 text-white py-3 rounded-xl text-sm font-body shadow-sm hover:bg-stone-700 transition-colors">
          完成
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.input-base {
  @apply px-4 py-2.5 bg-stone-50 border border-stone-200/60 rounded-xl text-sm text-stone-700 placeholder-stone-300 focus:outline-none focus:border-stone-300 focus:bg-white transition-all;
  font-family: 'DM Sans', 'Noto Sans SC', sans-serif;
}
</style>

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
