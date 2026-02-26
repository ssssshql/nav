<script setup>
import { ref } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'
import { ArrowRight, Loader2, Database, ShieldCheck, Copy, Check } from 'lucide-vue-next'

const router = useRouter()
const step = ref(1)

// DB Config
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
    error.value = e.response?.data?.error || '配置验证失败'
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
  <div class="min-h-screen bg-[#F2F2F2] text-[#1a1a1a] font-sans flex items-center justify-center p-6 relative isolate overflow-hidden">
    
    <!-- Background Texture & Gradient -->
    <div class="absolute inset-0 -z-10 opacity-60 mix-blend-multiply pointer-events-none" style="background-image: url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22 opacity=%220.1%22/%3E%3C/svg%3E');"></div>
    <div class="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-gradient-to-br from-blue-100/40 to-transparent rounded-full blur-[120px] pointer-events-none"></div>
    <div class="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-gradient-to-tl from-orange-100/40 to-transparent rounded-full blur-[120px] pointer-events-none"></div>

    <div class="w-full max-w-[900px] h-[600px] bg-white rounded-[40px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.06)] flex overflow-hidden relative border border-white/50 backdrop-blur-sm">
      
      <!-- Left Panel: Brand & Info -->
      <div class="w-[40%] bg-[#111] text-white p-12 flex flex-col justify-between relative overflow-hidden">
        <!-- Abstract Decoration -->
        <div class="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-white/10 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div class="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-blue-500/20 to-transparent rounded-full blur-3xl translate-y-1/3 -translate-x-1/3"></div>

        <div class="relative z-10">
          <h1 class="text-3xl font-bold tracking-tighter mb-2">Nexus.</h1>
          <p class="text-white/40 text-sm font-medium tracking-wide">系统初始化</p>
        </div>

        <div class="relative z-10 space-y-8">
          <div class="flex gap-4 items-start" :class="{ 'opacity-100': step === 1, 'opacity-40': step !== 1 }">
             <div class="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-sm font-mono transition-colors" :class="{ 'bg-white text-black border-white': step === 1 }">01</div>
             <div>
               <h3 class="font-bold text-sm mb-1">数据库</h3>
               <p class="text-xs text-white/50 leading-relaxed max-w-[200px]">配置 MySQL 连接信息以建立数据基础。</p>
             </div>
          </div>
          
          <div class="w-px h-8 bg-white/10 ml-4"></div>

          <div class="flex gap-4 items-start" :class="{ 'opacity-100': step === 2, 'opacity-40': step !== 2 }">
             <div class="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-sm font-mono transition-colors" :class="{ 'bg-white text-black border-white': step === 2 }">02</div>
             <div>
               <h3 class="font-bold text-sm mb-1">安全验证</h3>
               <p class="text-xs text-white/50 leading-relaxed max-w-[200px]">绑定 2FA 双因素认证以保护管理权限。</p>
             </div>
          </div>
        </div>

        <div class="relative z-10 text-[10px] text-white/20 font-mono">
          V1.0.0 / BUILD 2024
        </div>
      </div>

      <!-- Right Panel: Form -->
      <div class="flex-1 p-12 overflow-y-auto custom-scrollbar bg-white/80">
        <transition
          enter-active-class="transition duration-500 ease-out"
          enter-from-class="opacity-0 translate-x-8"
          enter-to-class="opacity-100 translate-x-0"
          leave-active-class="transition duration-300 ease-in absolute opacity-0"
          mode="out-in"
        >
          <!-- Step 1 Form -->
          <div v-if="step === 1" key="step1" class="h-full flex flex-col justify-center max-w-sm mx-auto">
            <div class="mb-8">
              <h2 class="text-2xl font-bold text-gray-900 mb-2">连接数据库</h2>
              <p class="text-gray-500 text-sm">请输入您的 MySQL 凭据。</p>
            </div>

            <form @submit.prevent="setup" class="space-y-6">
              <div class="space-y-4">
                <div class="group">
                  <label class="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 group-focus-within:text-black transition-colors">主机 & 端口</label>
                  <div class="flex gap-3">
                    <input v-model="dbHost" placeholder="localhost" class="input-base flex-1" required />
                    <input v-model="dbPort" placeholder="3306" class="input-base w-24 text-center font-mono" required />
                  </div>
                </div>

                <div class="group">
                  <label class="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 group-focus-within:text-black transition-colors">数据库名</label>
                  <input v-model="dbName" placeholder="nav" class="input-base w-full" required />
                </div>

                <div class="group">
                  <label class="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 group-focus-within:text-black transition-colors">认证信息</label>
                  <div class="space-y-3">
                    <input v-model="dbUser" placeholder="用户名" class="input-base w-full" required />
                    <input v-model="dbPassword" type="password" placeholder="密码" class="input-base w-full" />
                  </div>
                </div>
              </div>

              <div v-if="error" class="bg-red-50 text-red-600 text-xs px-4 py-3 rounded-lg flex items-center gap-2">
                 <span class="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                 {{ error }}
              </div>

              <button 
                type="submit" 
                :disabled="isLoading" 
                class="w-full bg-black text-white h-12 rounded-xl font-medium text-sm hover:bg-gray-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Loader2 v-if="isLoading" class="w-4 h-4 animate-spin" />
                <span>{{ isLoading ? '连接中...' : '继续' }}</span>
                <ArrowRight v-if="!isLoading" class="w-4 h-4" />
              </button>
            </form>
          </div>

          <!-- Step 2 Success -->
          <div v-else key="step2" class="h-full flex flex-col justify-center items-center text-center max-w-sm mx-auto">
             <div class="w-16 h-16 bg-black text-white rounded-full flex items-center justify-center mb-6 shadow-xl shadow-black/20">
               <ShieldCheck class="w-8 h-8" />
             </div>
             
             <h2 class="text-2xl font-bold text-gray-900 mb-2">设置完成</h2>
             <p class="text-gray-500 text-sm mb-8">请使用 Authenticator App 扫描二维码。</p>

             <div class="bg-white p-3 rounded-2xl border border-gray-100 shadow-lg shadow-gray-200/50 mb-8 transform hover:scale-105 transition-transform duration-300">
               <img :src="qrCode" class="w-40 h-40 object-contain rounded-lg mix-blend-multiply opacity-90" />
             </div>

             <div class="w-full bg-gray-50 rounded-xl p-4 mb-8 flex items-center justify-between border border-gray-100 group hover:border-gray-300 transition-colors cursor-pointer" @click="copySecret">
                <div class="text-left overflow-hidden">
                   <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">密钥 (Secret Key)</p>
                   <p class="text-xs font-mono text-gray-900 font-medium tracking-wide">{{ secret }}</p>
                </div>
                <div class="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-400 group-hover:text-black transition-colors">
                   <Check v-if="copied" class="w-4 h-4 text-green-500" />
                   <Copy v-else class="w-4 h-4" />
                </div>
             </div>

             <button @click="finish" class="w-full bg-black text-white h-12 rounded-xl font-medium text-sm hover:bg-gray-800 active:scale-[0.98] transition-all shadow-xl shadow-black/10">
               完成并登录
             </button>
          </div>
        </transition>
      </div>

    </div>
  </div>
</template>

<style scoped>
.input-base {
  @apply px-4 py-3 bg-[#F8F8F8] border border-transparent rounded-xl text-sm text-gray-900 placeholder-gray-400 transition-all outline-none font-medium;
}
.input-base:focus {
  @apply bg-white border-gray-200 ring-4 ring-gray-100;
}
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #eee;
  border-radius: 4px;
}
</style>
