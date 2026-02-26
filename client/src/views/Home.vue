<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../stores/auth'
import { Search, Plus, Trash2, X, Loader2, Globe, LayoutGrid, Type, Image as ImageIcon, Upload, Edit } from 'lucide-vue-next'

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

const showContextMenu = ref(false)
const contextMenuPos = ref({ x: 0, y: 0 })
const selectedSite = ref(null)

const getSiteInitial = (title) => {
  return title ? title.charAt(0).toUpperCase() : '?'
}

const getRandomBgColor = (title) => {
  const colors = [
    'bg-red-100 text-red-600',
    'bg-orange-100 text-orange-600',
    'bg-amber-100 text-amber-600',
    'bg-yellow-100 text-yellow-600',
    'bg-lime-100 text-lime-600',
    'bg-green-100 text-green-600',
    'bg-emerald-100 text-emerald-600',
    'bg-teal-100 text-teal-600',
    'bg-cyan-100 text-cyan-600',
    'bg-sky-100 text-sky-600',
    'bg-blue-100 text-blue-600',
    'bg-indigo-100 text-indigo-600',
    'bg-violet-100 text-violet-600',
    'bg-purple-100 text-purple-600',
    'bg-fuchsia-100 text-fuchsia-600',
    'bg-pink-100 text-pink-600',
    'bg-rose-100 text-rose-600',
  ]
  const index = title ? title.charCodeAt(0) % colors.length : 0
  return colors[index]
}

const fetchSites = async () => {
  try {
    const { data } = await axios.get('/api/sites')
    sites.value = data
  } catch (e) {
    console.error(e)
  }
}

let fetchTimer = null
watch(() => newSite.value.url, (newUrl) => {
  if (!newUrl || !newUrl.startsWith('http')) return
  
  if (fetchTimer) clearTimeout(fetchTimer)
  fetchTimer = setTimeout(async () => {
    isFetchingIcon.value = true
    try {
      const { data } = await axios.post('/api/fetch-favicon', { url: newUrl })
      if (data.icon) {
        newSite.value.icon = data.icon
      } else {
        newSite.value.icon = ''
      }
    } catch (e) {
      newSite.value.icon = ''
    } finally {
      isFetchingIcon.value = false
    }
  }, 800)
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
  newSite.value = { ...selectedSite.value }
  showAddModal.value = true
  closeContextMenu()
}

const handleContextMenu = (e, site) => {
  if (!auth.isLoggedIn) return
  showContextMenu.value = true
  selectedSite.value = site
  const x = e.clientX
  const y = e.clientY
  contextMenuPos.value = { x, y }
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
}

onMounted(() => {
  fetchSites()
  document.addEventListener('click', onGlobalClick)
})

onUnmounted(() => {
  document.removeEventListener('click', onGlobalClick)
})
</script>

<template>
  <div class="min-h-screen bg-[#f5f5f5] flex flex-col items-center py-12 px-4 font-sans text-[#111111]" @contextmenu.prevent>
    <div class="w-full max-w-6xl">
      <!-- Header -->
      <div class="flex items-center justify-between mb-8">
        <h1 class="text-2xl font-bold tracking-tight text-[#111111]">Nexus</h1>
        <div class="flex items-center gap-4">
          <button v-if="auth.isLoggedIn" @click="newSite = { title: '', url: '', icon: '', category: '日常' }; showAddModal = true" class="text-sm font-medium text-gray-500 hover:text-[#111111] transition-colors flex items-center gap-1.5">
            <Plus class="h-4 w-4" />
            <span>添加</span>
          </button>
          <button v-if="auth.isLoggedIn" @click="auth.logout" class="text-sm font-medium text-gray-500 hover:text-red-500 transition-colors">
            退出
          </button>
          <router-link v-else to="/login" class="text-sm font-medium text-gray-500 hover:text-[#111111] transition-colors">登录</router-link>
        </div>
      </div>

      <!-- Search -->
      <div class="mb-8">
        <div class="relative max-w-2xl mx-auto">
          <input 
            v-model="searchQuery"
            type="text" 
            class="block w-full pl-12 pr-12 py-3 bg-white border border-gray-200 rounded-none text-base placeholder-gray-400 focus:border-gray-300 focus:ring-0 transition-all outline-none" 
            placeholder="搜索..." 
          />
          <div class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
            <Search class="h-5 w-5" />
          </div>
        </div>
      </div>

      <!-- Top Categories -->
      <div class="mb-8 flex justify-center flex-wrap gap-2">
        <button
          v-for="cat in categories"
          :key="cat"
          @click="currentCategory = cat"
          :class="[
            currentCategory === cat 
              ? 'bg-gray-200 text-[#111111] font-medium' 
              : 'text-gray-500 hover:text-[#111111] hover:bg-gray-100'
          ]"
          class="px-4 py-2 text-sm transition-colors"
        >
          {{ cat }}
        </button>
      </div>

      <!-- Main Grid -->
      <main @click="closeContextMenu">
        <div class="grid grid-cols-6 gap-4">
            <a 
              v-for="site in filteredSites" 
              :key="site.id" 
              :href="site.url" 
              target="_blank"
              @contextmenu.prevent.stop="handleContextMenu($event, site)"
              class="group flex flex-col items-center gap-2 p-4 hover:bg-gray-100 transition-colors"
            >
              <div class="w-10 h-10 flex items-center justify-center bg-white border border-gray-200">
                <img 
                  v-if="site.icon" 
                  :src="site.icon" 
                  class="w-6 h-6 object-contain" 
                  alt=""
                  @error="site.icon = ''"
                />
                <span v-else :class="['w-6 h-6 flex items-center justify-center text-sm font-bold', getRandomBgColor(site.title)]">
                  {{ getSiteInitial(site.title) }}
                </span>
              </div>
              <span class="text-xs text-gray-600 group-hover:text-[#111111] transition-colors text-center truncate w-full">{{ site.title }}</span>
            </a>
          </div>
          
          <div v-if="filteredSites.length === 0" class="flex flex-col items-center justify-center py-20 text-gray-400">
            <p class="text-sm">暂无网站</p>
          </div>
        </main>
      
      <!-- Context Menu -->
      <div 
        v-if="showContextMenu" 
        :style="{ top: `${contextMenuPos.y}px`, left: `${contextMenuPos.x}px` }"
        class="fixed z-50 bg-white border border-gray-200 py-1 w-28"
      >
        <button @click="editSite" class="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left">
          <Edit class="w-3.5 h-3.5" />
          编辑
        </button>
        <button @click="deleteSite" class="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left">
          <Trash2 class="w-3.5 h-3.5" />
          删除
        </button>
      </div>
    </div>
    
    <!-- Footer -->
    <footer class="py-8 text-center text-xs text-gray-400">
      <p>power by ssssshql</p>
    </footer>

    <!-- Add Modal -->
    <transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div v-if="showAddModal" class="fixed inset-0 z-50 flex items-center justify-center px-4">
        <div class="absolute inset-0 bg-black/20 backdrop-blur-sm" @click="showAddModal = false"></div>
        
        <div class="bg-white w-full max-w-lg border border-gray-200 relative z-10">
          <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 class="text-lg font-bold text-gray-900">{{ newSite.id ? '编辑网站' : '添加网站' }}</h2>
            <button @click="showAddModal = false" class="p-1 text-gray-400 hover:text-black hover:bg-gray-100 transition-all">
              <X class="h-5 w-5" />
            </button>
          </div>

          <form @submit.prevent="addSite" class="p-6 space-y-5">
            <div class="space-y-1.5">
              <label class="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <Globe class="w-3.5 h-3.5" />
                网址链接
              </label>
              <div class="relative group">
                <input 
                  v-model="newSite.url" 
                  type="url" 
                  required 
                  placeholder="https://example.com"
                  class="w-full h-11 pl-4 pr-10 bg-gray-50 border border-gray-200 text-sm focus:bg-white focus:border-gray-300 focus:ring-0 transition-all outline-none placeholder-gray-400" 
                />
                <div class="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 v-if="isFetchingIcon" class="w-4 h-4 text-black animate-spin" />
                </div>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-1.5">
                <label class="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <Type class="w-3.5 h-3.5" />
                  标题
                </label>
                <input 
                  v-model="newSite.title" 
                  required 
                  placeholder="网站名称"
                  class="w-full h-11 px-4 bg-gray-50 border border-gray-200 text-sm focus:bg-white focus:border-gray-300 focus:ring-0 transition-all outline-none placeholder-gray-400" 
                />
              </div>
              
              <div class="space-y-1.5">
                <label class="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <LayoutGrid class="w-3.5 h-3.5" />
                  分类
                </label>
                <div class="relative">
                  <input 
                    v-model="newSite.category" 
                    required 
                    list="category-options" 
                    placeholder="选择分类..."
                    class="w-full h-11 px-4 bg-gray-50 border border-gray-200 text-sm focus:bg-white focus:border-gray-300 focus:ring-0 transition-all outline-none placeholder-gray-400" 
                  />
                  <datalist id="category-options">
                    <option v-for="cat in defaultCategories" :key="cat" :value="cat"></option>
                  </datalist>
                </div>
              </div>
            </div>

            <div class="space-y-1.5">
              <label class="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <ImageIcon class="w-3.5 h-3.5" />
                图标 (可选)
              </label>
              <div class="flex gap-3">
                <div class="w-11 h-11 shrink-0 bg-gray-50 border border-gray-200 flex items-center justify-center overflow-hidden relative group cursor-pointer" @click="triggerFileUpload">
                  <img 
                    v-if="newSite.icon" 
                    :src="newSite.icon" 
                    class="w-6 h-6 object-contain"
                    @error="newSite.icon = ''" 
                  />
                  <ImageIcon v-else class="w-5 h-5 text-gray-300" />
                  <div class="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Upload class="w-4 h-4 text-white" />
                  </div>
                </div>
                
                <input 
                  v-model="newSite.icon" 
                  placeholder="自动获取或粘贴图片链接"
                  class="flex-1 h-11 px-4 bg-gray-50 border border-gray-200 text-sm focus:bg-white focus:border-gray-300 focus:ring-0 transition-all outline-none placeholder-gray-400" 
                />
                
                <input 
                  type="file" 
                  ref="fileInput" 
                  accept="image/*" 
                  class="hidden" 
                  @change="handleFileUpload" 
                />
              </div>
              <p class="text-[10px] text-gray-400 pl-1">支持自动获取或点击图标上传本地图片。</p>
            </div>

            <div class="pt-2 flex items-center justify-end gap-3">
              <button 
                type="button" 
                @click="showAddModal = false" 
                class="px-5 h-11 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-black transition-colors"
              >
                取消
              </button>
              <button 
                type="submit" 
                class="px-6 h-11 bg-[#111111] text-white text-sm font-medium hover:bg-black transition-colors"
              >
                {{ newSite.id ? '更新' : '保存' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </transition>
  </div>
</template>
