<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../stores/auth'
import { Search, Plus, Trash2, X, Loader2, Image as ImageIcon, Upload, Edit, LogOut, Download, UploadCloud } from 'lucide-vue-next'

const auth = useAuthStore()
const sites = ref([])
const defaultCategories = ['日常', '娱乐', '生活', '学习', '开发', '设计']
const categories = computed(() => {
  const cats = new Set(sites.value.map(s => s.category))
  const merged = new Set([...defaultCategories, ...Array.from(cats)])
  return ['全部', ...Array.from(merged)]
})
const currentCategory = ref('全部')
const searchQuery = ref('')
const showAddModal = ref(false)
const newSite = ref({ title: '', url: '', icon: '', category: '日常' })
const isFetchingIcon = ref(false)
const fileInput = ref(null)
const showUserMenu = ref(false)
const importInput = ref(null)
const hitokoto = ref('')
const hitokotoDisplay = ref('')
let typeTimer = null

const showContextMenu = ref(false)
const contextMenuPos = ref({ x: 0, y: 0 })
const selectedSite = ref(null)

const getSiteInitial = (title) => {
  return title ? title.charAt(0).toUpperCase() : '?'
}

const fetchSites = async () => {
  try {
    const { data } = await axios.get('/api/sites')
    sites.value = data
  } catch (e) {
    console.error(e)
  }
}

const fetchHitokoto = async () => {
  const type = () => {
    if (typeTimer) clearInterval(typeTimer)
    hitokotoDisplay.value = ''
    
    const typeText = hitokoto.value.text
    let i = 0
    typeTimer = setInterval(() => {
      hitokotoDisplay.value += typeText.charAt(i)
      i++
      if (i >= typeText.length) {
        clearInterval(typeTimer)
        setTimeout(type, 2000)
      }
    }, 100)
  }
  
  try {
    const { data } = await axios.get('https://hitokoto.yealqp.cn/')
    hitokoto.value = { text: data.hitokoto, from: data.from, fromWho: data.from_who }
    type()
  } catch (e) {
    // ignore
  }
}

let fetchTimer = null
let skipFetch = false
watch(() => newSite.value.url, (newUrl) => {
  if (!newUrl || !newUrl.startsWith('http')) return
  
  if (skipFetch || newSite.value.icon) return
  
  if (fetchTimer) clearTimeout(fetchTimer)
  fetchTimer = setTimeout(async () => {
    isFetchingIcon.value = true
    try {
      const { data } = await axios.post('/api/fetch-favicon', { url: newUrl })
      if (data.icon) {
        newSite.value.icon = data.icon
      }
    } catch (e) {
      // ignore
    } finally {
      isFetchingIcon.value = false
    }
  }, 800)
})

// Watch icon field - convert URL to base64 when user enters an icon URL
watch(() => newSite.value.icon, (newIcon) => {
  if (!newIcon || newIcon.startsWith('data:')) return

  const imageExtensions = ['.ico', '.png', '.svg', '.jpg', '.jpeg', '.gif', '.webp']
  const isImageUrl = imageExtensions.some(ext => newIcon.toLowerCase().endsWith(ext)) || 
                     newIcon.includes('/favicon') || 
                     newIcon.includes('/icon')

  if (!isImageUrl) return

  if (fetchTimer) clearTimeout(fetchTimer)
  fetchTimer = setTimeout(async () => {
    try {
      const { data } = await axios.post('/api/fetch-favicon', { url: newIcon })
      if (data.icon) {
        newSite.value.icon = data.icon
      }
    } catch (e) {
      // ignore
    }
  }, 500)
})

const triggerFileUpload = () => {
  fileInput.value.click()
}

const handleFileUpload = (event) => {
  const file = event.target.files[0]
  if (!file) return
  
  if (file.size > 5 * 1024 * 1024) {
    alert('文件大小超过 5MB')
    return
  }

  const reader = new FileReader()
  reader.onload = (e) => {
    newSite.value.icon = e.target.result
  }
  reader.readAsDataURL(file)
}

const addSite = async () => {
  if (newSite.value.id) {
    await axios.put(`/api/sites/${newSite.value.id}`, newSite.value)
  } else {
    await axios.post('/api/sites', newSite.value)
  }
  showAddModal.value = false
  newSite.value = { title: '', url: '', icon: '', category: '日常' }
  fetchSites()
}

const exportSites = () => {
  const data = JSON.stringify(sites.value, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `nav-sites-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const triggerImport = () => {
  importInput.value.click()
}

const handleImport = async (event) => {
  const file = event.target.files[0]
  if (!file) return
  
  try {
    const text = await file.text()
    const data = JSON.parse(text)
    if (!Array.isArray(data)) {
      alert('文件格式错误')
      return
    }
    
    for (const site of data) {
      if (site.title && site.url) {
        await axios.post('/api/sites', {
          title: site.title,
          url: site.url,
          icon: site.icon || '',
          category: site.category || '日常'
        })
      }
    }
    
    fetchSites()
    alert('导入成功')
  } catch (e) {
    alert('导入失败: ' + e.message)
  }
  
  event.target.value = ''
}

const deleteSite = async () => {
  if (!selectedSite.value) return
  if (confirm('确认删除?')) {
    await axios.delete(`/api/sites/${selectedSite.value.id}`)
    fetchSites()
  }
  closeContextMenu()
}

const editSite = () => {
  if (!selectedSite.value) return
  skipFetch = true
  newSite.value = { ...selectedSite.value }
  showAddModal.value = true
  closeContextMenu()
}

const handleContextMenu = (e, site) => {
  if (!auth.isLoggedIn) return
  showContextMenu.value = true
  selectedSite.value = site
  contextMenuPos.value = { x: e.clientX, y: e.clientY }
}

const closeContextMenu = () => {
  showContextMenu.value = false
}

const filteredSites = computed(() => {
  let result = sites.value
  if (currentCategory.value !== '全部') {
    result = result.filter(s => s.category === currentCategory.value)
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(s => s.title.toLowerCase().includes(q) || s.url.toLowerCase().includes(q))
  }
  return result
})

const onGlobalClick = () => {
  if (showContextMenu.value) closeContextMenu()
  if (showUserMenu.value) showUserMenu.value = false
}

onMounted(() => {
  fetchSites()
  fetchHitokoto()
  document.addEventListener('click', onGlobalClick)
})

onUnmounted(() => {
  document.removeEventListener('click', onGlobalClick)
})
</script>

<template>
  <div class="min-h-screen bg-white" @contextmenu.prevent>
    <div class="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <!-- Header -->
      <header class="flex items-center justify-between mb-8">
        <h1 class="text-lg font-medium text-gray-900">Quick</h1>
        
        <template v-if="auth.isLoggedIn">
          <div class="relative">
<button 
              @click.stop="showUserMenu = !showUserMenu" 
              class="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm text-gray-600"
            >
              {{ auth.username?.charAt(0).toUpperCase() || 'U' }}
            </button>
            
            <input 
              ref="importInput"
              type="file"
              accept=".json"
              class="hidden"
              @change="handleImport"
            />
            
            <transition
              enter-active-class="transition ease-out duration-100"
              enter-from-class="opacity-0"
              enter-to-class="opacity-100"
              leave-active-class="transition ease-in duration-75"
              leave-from-class="opacity-100"
              leave-to-class="opacity-0"
            >
<div v-if="showUserMenu" class="absolute right-0 top-10 mt-1 w-32 bg-white border border-gray-100 rounded-lg py-1 z-50 shadow-sm">
                <button @click="skipFetch = false; newSite = { title: '', url: '', icon: '', category: '日常' }; showAddModal = true; showUserMenu = false" class="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 transition-colors">
                  <Plus class="w-3 h-3" />
                  添加
                </button>
                <button @click="exportSites(); showUserMenu = false" class="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 transition-colors">
                  <Download class="w-3 h-3" />
                  导出
                </button>
                <button @click="triggerImport(); showUserMenu = false" class="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 transition-colors">
                  <UploadCloud class="w-3 h-3" />
                  导入
                </button>
                <button @click="auth.logout(); showUserMenu = false" class="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-500 hover:bg-gray-50 transition-colors">
                  <LogOut class="w-3 h-3" />
                  退出
                </button>
              </div>
            </transition>
          </div>
        </template>
        <template v-else>
          <router-link to="/login" class="text-sm text-gray-400">登录</router-link>
        </template>
      </header>

      <!-- Search -->
      <div class="mb-6">
        <input 
          v-model="searchQuery"
          type="text" 
          class="w-full px-4 py-2 bg-gray-50 border-0 rounded-lg text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:bg-gray-100 transition-colors"
          placeholder="搜索..." 
        />
      </div>

      <!-- Categories -->
      <div class="mb-8 flex gap-3 text-sm overflow-x-auto pb-2">
        <button
          v-for="cat in categories"
          :key="cat"
          @click="currentCategory = cat"
          :class="[
            currentCategory === cat 
              ? 'text-gray-900' 
              : 'text-gray-400 hover:text-gray-600'
          ]"
          class="transition-colors whitespace-nowrap"
        >
          {{ cat }}
        </button>
      </div>

      <!-- Sites Grid -->
      <main @click="closeContextMenu" class="mb-12">
        <div class="grid sm:grid-cols-6 grid-cols-2 gap-3 sm:gap-4">
          <a 
            v-for="site in filteredSites" 
            :key="site.id" 
            :href="site.url" 
            target="_blank"
            @contextmenu.prevent.stop="handleContextMenu($event, site)"
            class="flex sm:flex-col items-center gap-2 p-2 sm:p-3 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <div class="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
              <img 
                v-if="site.icon" 
                :src="site.icon" 
                class="w-5 h-5 object-contain"
                alt=""
                @error="site.icon = ''"
              />
              <span v-else class="text-sm text-gray-400">
                {{ getSiteInitial(site.title) }}
              </span>
            </div>
            <p class="text-xs text-gray-600 truncate w-full text-center hidden sm:block">{{ site.title }}</p>
            <p class="text-xs text-gray-600 truncate flex-1 sm:hidden">{{ site.title }}</p>
          </a>
        </div>
        
        <div v-if="filteredSites.length === 0" class="py-12 text-center">
          <p class="text-sm text-gray-300">暂无</p>
        </div>
      </main>

      <!-- Footer -->
      <footer class="fixed sm:bottom-6 sm:right-6 right-4 bottom-4 text-right max-w-[60vw]">
        <p v-if="hitokoto" class="text-xs text-gray-400 italic truncate">
          {{ hitokotoDisplay }}
          <span v-if="hitokoto.fromWho || hitokoto.from" class="text-gray-300">
            — {{ hitokoto.fromWho || '' }}{{ hitokoto.fromWho && hitokoto.from ? ' / ' : '' }}{{ hitokoto.from || '' }}
          </span>
        </p>
      </footer>
    </div>

    <!-- Context Menu -->
    <div 
      v-if="showContextMenu" 
      :style="{ top: `${contextMenuPos.y}px`, left: `${contextMenuPos.x}px` }"
      class="fixed z-50 bg-white border border-gray-100 rounded-lg py-1 w-24 shadow-sm"
    >
      <button @click="editSite" class="flex items-center gap-2 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 w-full text-left transition-colors">
        <Edit class="w-3 h-3" />
        编辑
      </button>
      <button @click="deleteSite" class="flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-gray-50 w-full text-left transition-colors">
        <Trash2 class="w-3 h-3" />
        删除
      </button>
    </div>

    <!-- Add Modal -->
    <transition
      enter-active-class="transition ease-out duration-150"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition ease-in duration-100"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="showAddModal" class="fixed inset-0 z-50 flex items-center justify-center px-4">
        <div class="absolute inset-0 bg-black/5" @click="showAddModal = false"></div>
        
        <div class="bg-white w-full max-w-xs rounded-lg shadow-lg relative z-10">
          <div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 class="text-sm font-medium text-gray-800">{{ newSite.id ? '编辑' : '添加' }}</h2>
            <button @click="showAddModal = false" class="text-gray-300 hover:text-gray-500">
              <X class="h-4 w-4" />
            </button>
          </div>

          <form @submit.prevent="addSite" class="p-4 space-y-3">
            <div>
              <input 
                v-model="newSite.url" 
                type="url" 
                required 
                placeholder="网址"
                class="w-full h-9 px-3 bg-gray-50 border-0 rounded text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:bg-gray-100 transition-colors" 
              />
            </div>

            <div class="grid grid-cols-2 gap-2">
              <input 
                v-model="newSite.title" 
                required 
                placeholder="标题"
                class="h-9 px-3 bg-gray-50 border-0 rounded text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:bg-gray-100 transition-colors" 
              />
              <select 
                v-model="newSite.category" 
                required 
                class="h-9 px-3 bg-gray-50 border-0 rounded text-sm text-gray-700 focus:outline-none focus:bg-gray-100 transition-colors"
              >
                <option v-for="cat in defaultCategories" :key="cat" :value="cat">{{ cat }}</option>
              </select>
            </div>

            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                <img 
                  v-if="newSite.icon" 
                  :src="newSite.icon" 
                  class="w-6 h-6 object-contain"
                  alt=""
                  @error="newSite.icon = ''"
                />
                <span v-else class="text-xs text-gray-300">?</span>
              </div>
              <input 
                v-model="newSite.icon" 
                placeholder="图标链接"
                class="flex-1 h-9 px-3 bg-gray-50 border-0 rounded text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:bg-gray-100 transition-colors" 
              />
            </div>

            <div class="flex justify-end gap-2 pt-1">
              <button 
                type="button" 
                @click="showAddModal = false" 
                class="px-3 h-8 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                取消
              </button>
              <button 
                type="submit" 
                class="px-4 h-8 bg-gray-900 text-white text-xs rounded hover:bg-gray-800 transition-colors"
              >
                保存
              </button>
            </div>
          </form>
        </div>
      </div>
    </transition>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap');

* {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}

body {
  -webkit-font-smoothing: antialiased;
}

input:focus {
  outline: none;
}
</style>
