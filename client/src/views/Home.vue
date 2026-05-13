<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../stores/auth'
import { Search, Plus, Trash2, X, Loader2, Edit, LogOut, Download, UploadCloud, Move } from 'lucide-vue-next'

const auth = useAuthStore()
const sites = ref([])
const defaultCategories = ['工作', '工具', '娱乐', '生活', '开发']
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
const showUserMenu = ref(false)
const importInput = ref(null)

const showContextMenu = ref(false)
const contextMenuPos = ref({ x: 0, y: 0 })
const selectedSite = ref(null)

const editMode = ref(false)
const draggedSite = ref(null)

const getIconUrl = (icon) => {
  if (!icon) return ''
  if (icon.startsWith('http://') || icon.startsWith('https://') || icon.startsWith('data:')) {
    return icon
  }
  return '' + icon
}

const getSiteInitial = (title) => {
  return title ? title.charAt(0).toUpperCase() : '?'
}

const getHostName = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch (e) {
    return url
  }
}

const fetchSites = async () => {
  try {
    const { data } = await axios.get('/api/sites')
    sites.value = data
    console.log('Fetched sites:', data.length)
  } catch (e) {
    console.error('Failed to fetch sites:', e)
  }
}

let fetchTimer = null
const resetNewSite = () => {
  newSite.value = { title: '', url: '', icon: '', category: '日常' }
  iconLoadError.value = false
}
const iconLoadError = ref(false)
const iconPreviewError = ref(false)

watch(() => newSite.value?.url, (newUrl) => {
  if (!newUrl || !newUrl.startsWith('http')) return
  if (newSite.value.icon && newSite.value.icon.startsWith('/data/')) return
  if (fetchTimer) clearTimeout(fetchTimer)
  fetchTimer = setTimeout(async () => {
    isFetchingIcon.value = true
    iconPreviewError.value = false
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

const addSite = async () => {
  const siteData = { ...newSite.value }
  if (siteData.icon && (siteData.icon.startsWith('http://') || siteData.icon.startsWith('https://'))) {
    try {
      const { data } = await axios.post('/api/cache-icon', { iconUrl: siteData.icon })
      if (data.icon) {
        siteData.icon = data.icon
      }
    } catch (e) {
      console.error('[cache-icon] error', e)
    }
  }

  if (siteData.id) {
    await axios.put(`/api/sites/${siteData.id}`, siteData)
  } else {
    await axios.post('/api/sites', siteData)
  }
  showAddModal.value = false
  newSite.value = { title: '', url: '', icon: '', category: '日常' }
  iconLoadError.value = false
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
  newSite.value = { ...selectedSite.value }
  iconLoadError.value = false
  iconPreviewError.value = false
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

const toggleEditMode = () => {
  editMode.value = !editMode.value
  showUserMenu.value = false
}

const handleDragStart = (e, site) => {
  if (!editMode.value) return
  draggedSite.value = site
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', site.id)
}

const handleDragOver = (e, category) => {
  if (!editMode.value || !draggedSite.value) return
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
}

const handleDrop = async (e, category) => {
  e.preventDefault()

  if (!editMode.value || !draggedSite.value) return

  if (draggedSite.value.category !== category && category !== '全部') {
    const draggedId = draggedSite.value.id
    const siteToUpdate = { ...draggedSite.value, category }

    try {
      const response = await axios.put(`/api/sites/${draggedId}`, siteToUpdate)
      console.log('Update response:', response.data)

      // Force re-fetch from server to ensure UI is in sync
      await fetchSites()

      // Switch to the target category to show the moved site
      currentCategory.value = category

    } catch (err) {
      console.error('Failed to update category:', err)

      // Show error message
      if (err?.response) {
        alert(`分类更新失败: ${err.response?.data?.error || err.message}`)
      } else {
        alert(`分类更新失败: ${err.message}`)
      }
    }
  }

  draggedSite.value = null
}

const handleDragEnd = () => {
  draggedSite.value = null
}

onMounted(async () => {
  await auth.checkAuth()
  fetchSites()
  document.addEventListener('click', onGlobalClick)
})

onUnmounted(() => {
  document.removeEventListener('click', onGlobalClick)
})
</script>

<template>
  <div class="page-shell">
    <div class="texture-overlay"></div>
    <div class="bg-pattern"></div>

    <header class="top-bar">
      <div class="brand-group">
        <div class="seal-box">
          <span>禅航</span>
        </div>
        <div class="title-text">
          <h1>道案内</h1>
          <span>NAVIGATION</span>
        </div>
      </div>

      <div class="tools">
        <div class="search-bar">
          <Search class="search-icon" />
          <input v-model="searchQuery" type="text" placeholder="検索..." />
        </div>

        <template v-if="auth.isLoggedIn">
          <div class="menu-wrap">
            <button @click.stop="showUserMenu = !showUserMenu" class="avatar-btn">
              {{ auth.username?.charAt(0).toUpperCase() || 'A' }}
            </button>
            <input ref="importInput" type="file" accept=".json" class="hidden" @change="handleImport" />
            <transition name="dropdown-fade">
              <div v-if="showUserMenu" class="menu-panel">
                <button @click="resetNewSite(); showAddModal = true; showUserMenu = false">
                  <Plus class="w-3 h-3" />
                  追加
                </button>
                <button @click="toggleEditMode" :class="{ active: editMode }">
                  <Move class="w-3 h-3" />
                  {{ editMode ? '完成' : '分类编辑' }}
                </button>
                <button @click="exportSites(); showUserMenu = false">
                  <Download class="w-3 h-3" />
                  出力
                </button>
                <button @click="triggerImport(); showUserMenu = false">
                  <UploadCloud class="w-3 h-3" />
                  入力
                </button>
                <div class="divider-line"></div>
                <button @click="auth.logout(); showUserMenu = false" class="danger">
                  <LogOut class="w-3 h-3" />
                  終了
                </button>
              </div>
            </transition>
          </div>
        </template>
        <template v-else>
          <router-link to="/login" class="login-link">ログイン</router-link>
        </template>
      </div>
    </header>

    <nav class="cat-tabs">
      <button
        v-for="cat in categories"
        :key="cat"
        @click="currentCategory = cat"
        :class="['tab-item', { active: currentCategory === cat, 'drop-target': editMode && cat !== '全部' }]"
        @dragover="handleDragOver($event, cat)"
        @drop="handleDrop($event, cat)"
      >
        {{ cat }}
      </button>
    </nav>

    <div class="scroll-wrapper">
      <main class="cards-grid">
        <a
          v-for="(site, idx) in filteredSites"
          :key="site.id"
          :href="editMode ? null : site.url"
          target="_blank"
          @contextmenu.prevent.stop="handleContextMenu($event, site)"
          :class="['site-card', { 'edit-mode': editMode, 'dragging': draggedSite?.id === site.id }]"
          :style="{ '--idx': idx }"
          :draggable="editMode"
          @dragstart="handleDragStart($event, site)"
          @dragend="handleDragEnd"
        >
          <div class="card-frame">
            <div class="frame-corner frame-tl"></div>
            <div class="frame-corner frame-tr"></div>
            <div class="frame-corner frame-bl"></div>
            <div class="frame-corner frame-br"></div>
          </div>

          <div class="card-content">
            <div class="icon-circle">
              <img
                v-if="site.icon"
                :src="getIconUrl(site.icon)"
                class="icon-image"
                alt=""
                @error="site.icon = ''"
              />
              <span v-else class="icon-text">{{ getSiteInitial(site.title) }}</span>
            </div>
            <div class="title-section">
              <h3 class="card-title">{{ site.title }}</h3>
            </div>
          </div>
        </a>
      </main>
    </div>

    <div v-if="filteredSites.length === 0" class="empty-text">
      何も見つかりませんでした
    </div>

    <transition name="scale-in">
      <div
        v-if="showContextMenu"
        :style="{ top: `${contextMenuPos.y}px`, left: `${contextMenuPos.x}px` }"
        class="ctx-panel"
      >
        <button @click="editSite">
          <Edit class="w-3 h-3" />
          編集
        </button>
        <button @click="deleteSite" class="danger">
          <Trash2 class="w-3 h-3" />
          削除
        </button>
      </div>
    </transition>

    <transition name="scale-in">
      <div v-if="showAddModal" class="modal-bg" @click="showAddModal = false; iconLoadError = false; iconPreviewError = false">
        <div class="modal-content" @click.stop>
          <button class="close-x" @click="showAddModal = false; iconLoadError = false; iconPreviewError = false">
            <X class="w-3.5 h-3.5" />
          </button>

          <div class="modal-header">
            <div class="header-badge">{{ newSite.id ? '編' : '新' }}</div>
            <h2>{{ newSite.id ? '編集' : '追加' }}</h2>
          </div>

          <form @submit.prevent="addSite" class="modal-form">
            <input v-model="newSite.url" type="url" required placeholder="URL" />

            <div class="input-pair">
              <input v-model="newSite.title" required placeholder="タイトル" />
              <select v-model="newSite.category" required>
                <option v-for="cat in defaultCategories" :key="cat" :value="cat">{{ cat }}</option>
              </select>
            </div>

            <div class="icon-input-row">
              <div class="icon-preview-box">
                <Loader2 v-if="isFetchingIcon" class="w-3.5 h-3.5 animate-spin" />
                <template v-else>
                  <img
                    v-if="newSite.icon && !iconPreviewError"
                    :src="getIconUrl(newSite.icon)"
                    class="w-4 h-4 object-contain"
                    alt=""
                    @error="iconPreviewError = true"
                  />
                  <span v-else>?</span>
                </template>
              </div>
              <input
                v-if="!isFetchingIcon && (!newSite.icon || !newSite.icon.startsWith('/data/'))"
                v-model="newSite.icon"
                @input="iconPreviewError = false"
                placeholder="アイコンURL"
              />
              <button
                v-else-if="newSite.icon && newSite.icon.startsWith('/data/')"
                type="button"
                @click="newSite.icon = ''"
                class="change-icon-btn"
              >
                変更
              </button>
            </div>

            <div class="form-buttons">
              <button type="button" @click="showAddModal = false; iconLoadError = false; iconPreviewError = false" class="btn-cancel">
                取消
              </button>
              <button type="submit" class="btn-submit">
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
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@300;400;500;600&family=Noto+Sans+JP:wght@300;400;500&display=swap');

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Noto Sans JP', sans-serif;
  background: #faf9f7;
  color: #3d3d3d;
  overflow: hidden;
  height: 100vh;
}

input:focus, select:focus {
  outline: none;
}

.page-shell {
  height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
  background: linear-gradient(135deg, #faf9f7 0%, #f7f6f4 100%);
}

.texture-overlay {
  position: fixed;
  inset: 0;
  background: url("data:image/svg+xml,%3Csvg viewBox='0 0 300 300' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E");
  pointer-events: none;
  z-index: 0;
}

.bg-pattern {
  position: fixed;
  inset: 0;
  background-image: url('/bg.svg');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  opacity: 0.06;
  pointer-events: none;
  z-index: 0;
}

.top-bar {
  position: relative;
  z-index: 10;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 2rem 3rem 1.5rem;
  flex-shrink: 0;
  gap: 8rem;
}

.brand-group {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.seal-box {
  width: 50px;
  height: 50px;
  background: linear-gradient(135deg, #b07070, #9a6060);
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 3px 12px rgba(176, 112, 112, 0.28);
  transform: rotate(-2deg);
}

.seal-box span {
  font-family: 'Noto Serif JP', serif;
  font-size: 1.125rem;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.05em;
}

.title-text h1 {
  font-family: 'Noto Serif JP', serif;
  font-size: 1.75rem;
  font-weight: 400;
  letter-spacing: 0.35em;
  color: #3d3d3d;
  line-height: 1;
}

.title-text span {
  font-size: 0.5625rem;
  font-weight: 300;
  letter-spacing: 0.5em;
  color: #b0b0b0;
}

.tools {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.search-bar {
  position: relative;
  width: 200px;
}

.search-bar input {
  width: 100%;
  padding: 0.625rem 2rem 0.625rem 1rem;
  border: 1px solid rgba(61, 61, 61, 0.06);
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.65);
  font-family: 'Noto Sans JP', sans-serif;
  font-size: 0.8125rem;
  color: #3d3d3d;
  transition: all 0.25s;
}

.search-bar input::placeholder {
  color: #c0c0c0;
}

.search-bar input:focus {
  background: #fff;
  border-color: rgba(176, 112, 112, 0.18);
}

.search-icon {
  position: absolute;
  right: 0.875rem;
  top: 50%;
  transform: translateY(-50%);
  width: 15px;
  height: 15px;
  color: #b0b0b0;
}

.avatar-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #c4d4c4, #a8b8a8);
  border: none;
  color: #fff;
  font-family: 'Noto Serif JP', serif;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(196, 212, 196, 0.4);
  transition: all 0.25s;
}

.avatar-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 14px rgba(196, 212, 196, 0.55);
}

.menu-wrap {
  position: relative;
}

.menu-panel {
  position: absolute;
  right: 0;
  top: calc(100% + 0.5rem);
  width: 130px;
  background: #fff;
  border: 1px solid rgba(61, 61, 61, 0.05);
  border-radius: 3px;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  box-shadow: 0 5px 20px rgba(61, 61, 61, 0.1);
  z-index: 1000;
}

.menu-panel button {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.5625rem 0.875rem;
  background: transparent;
  border: none;
  color: #3d3d3d;
  font-family: 'Noto Sans JP', sans-serif;
  font-size: 0.8125rem;
  text-align: left;
  cursor: pointer;
  border-radius: 2px;
  transition: all 0.2s;
}

.menu-panel button:hover {
  background: rgba(196, 212, 196, 0.1);
}

.menu-panel button.danger:hover {
  background: rgba(176, 112, 112, 0.1);
  color: #b07070;
}

.divider-line {
  height: 1px;
  background: rgba(61, 61, 61, 0.05);
  margin: 0.25rem 0;
}

.login-link {
  padding: 0.625rem 1.5rem;
  border-radius: 2px;
  background: transparent;
  border: 1px solid rgba(61, 61, 61, 0.08);
  color: #3d3d3d;
  text-decoration: none;
  font-size: 0.8125rem;
  transition: all 0.25s;
}

.login-link:hover {
  background: rgba(196, 212, 196, 0.08);
  border-color: rgba(196, 212, 196, 0.28);
}

.cat-tabs {
  position: relative;
  z-index: 5;
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 0 3rem 1.5rem;
  flex-shrink: 0;
}

.tab-item {
  padding: 0.4375rem 1.125rem;
  border-radius: 2px;
  background: transparent;
  border: 1px solid rgba(61, 61, 61, 0.06);
  color: #a0a0a0;
  font-family: 'Noto Sans JP', sans-serif;
  font-size: 0.8125rem;
  cursor: pointer;
  transition: all 0.25s;
}

.tab-item:hover {
  background: rgba(255, 183, 197, 0.06);
  border-color: rgba(255, 183, 197, 0.18);
  color: #3d3d3d;
}

.tab-item.active {
  background: linear-gradient(135deg, #d4a5b0, #c4a8b0);
  border-color: transparent;
  color: #fff;
  box-shadow: 0 2px 10px rgba(212, 165, 176, 0.3);
}

.scroll-wrapper {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 3rem 2rem;
}

.scroll-wrapper::-webkit-scrollbar {
  width: 6px;
}

.scroll-wrapper::-webkit-scrollbar-track {
  background: rgba(61, 61, 61, 0.02);
  border-radius: 3px;
}

.scroll-wrapper::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, rgba(196, 212, 196, 0.4), rgba(176, 112, 112, 0.3));
  border-radius: 3px;
  transition: background 0.3s;
}

.scroll-wrapper::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, rgba(196, 212, 196, 0.6), rgba(176, 112, 112, 0.45));
}

.cards-grid {
  position: relative;
  z-index: 5;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(78px, 1fr));
  gap: 0.875rem;
  justify-items: center;
  max-width: calc((78px * 8) + (0.875rem * 7) + 1rem);
  margin: 0 auto;
}

.site-card {
  position: relative;
  text-decoration: none;
  color: #3d3d3d;
  width: 78px;
  padding: 0.875rem 0.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.625rem;
  animation: cardFadeIn 0.5s ease calc(var(--idx) * 40ms) both;
  cursor: pointer;
  transition: all 0.3s ease;
}

@keyframes cardFadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.site-card:hover {
  transform: translateY(-2px);
}

.site-card:hover .icon-circle {
  box-shadow: 0 4px 14px rgba(196, 212, 196, 0.28);
}

.card-frame {
  display: none;
}

.card-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.625rem;
  width: 100%;
}

.icon-container {
  display: none;
}

.icon-circle {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.85));
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(61, 61, 61, 0.06);
  transition: all 0.3s ease;
  border: 1px solid rgba(61, 61, 61, 0.04);
}

.icon-image {
  width: 22px;
  height: 22px;
  object-fit: contain;
}

.icon-text {
  font-family: 'Noto Serif JP', serif;
  font-size: 1rem;
  font-weight: 600;
  color: #a8b8a8;
}

.title-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

.card-title {
  font-family: 'Noto Sans JP', sans-serif;
  font-size: 0.75rem;
  font-weight: 400;
  color: #3d3d3d;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
  line-height: 1.3;
}

.icon-bg,
.icon-inner,
.title-line {
  display: none;
}

.empty-text {
  padding: 5rem 2rem;
  text-align: center;
  color: #b0b0b0;
  font-size: 0.875rem;
}

.site-card.edit-mode {
  cursor: grab;
  opacity: 0.85;
  border: 1px dashed rgba(196, 212, 196, 0.4);
}

.site-card.edit-mode:active {
  cursor: grabbing;
}

.site-card.dragging {
  opacity: 0.3;
  transform: scale(0.95);
}

.tab-item.drop-target {
  border: 2px dashed rgba(196, 212, 196, 0.5);
  padding: 0.3125rem 1.0625rem;
}

.tab-item.drop-target:hover {
  background: rgba(196, 212, 196, 0.15);
  border-color: rgba(196, 212, 196, 0.6);
}

.menu-panel button.active {
  background: rgba(196, 212, 196, 0.2);
  color: #3d3d3d;
  font-weight: 500;
}

.ctx-panel {
  position: fixed;
  z-index: 200;
  background: #fff;
  border: 1px solid rgba(61, 61, 61, 0.05);
  border-radius: 3px;
  padding: 0.5rem;
  min-width: 110px;
  box-shadow: 0 5px 22px rgba(61, 61, 61, 0.1);
}

.ctx-panel button {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  width: 100%;
  padding: 0.5625rem 0.875rem;
  background: transparent;
  border: none;
  color: #3d3d3d;
  font-family: 'Noto Sans JP', sans-serif;
  font-size: 0.8125rem;
  text-align: left;
  cursor: pointer;
  border-radius: 2px;
  transition: all 0.2s;
}

.ctx-panel button:hover {
  background: rgba(196, 212, 196, 0.1);
}

.ctx-panel button.danger:hover {
  background: rgba(176, 112, 112, 0.1);
  color: #b07070;
}

.modal-bg {
  position: fixed;
  inset: 0;
  z-index: 150;
  background: rgba(61, 61, 61, 0.18);
  backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.modal-content {
  position: relative;
  width: 100%;
  max-width: 360px;
  background: #fff;
  border: 1px solid rgba(61, 61, 61, 0.05);
  border-radius: 3px;
  padding: 2.25rem 2rem;
  box-shadow: 0 10px 36px rgba(61, 61, 61, 0.12);
}

.close-x {
  position: absolute;
  top: 1.25rem;
  right: 1.25rem;
  background: transparent;
  border: none;
  color: #c8c8c8;
  cursor: pointer;
  transition: color 0.2s;
}

.close-x:hover {
  color: #3d3d3d;
}

.modal-header {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  margin-bottom: 2rem;
}

.header-badge {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #c4d4c4, #a8b8a8);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Noto Serif JP', serif;
  font-size: 1rem;
  font-weight: 700;
  color: #fff;
}

.modal-header h2 {
  font-family: 'Noto Serif JP', serif;
  font-size: 1.25rem;
  font-weight: 400;
  color: #3d3d3d;
  letter-spacing: 0.1em;
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.modal-form input,
.modal-form select {
  padding: 0.625rem 1rem;
  border: 1px solid rgba(61, 61, 61, 0.06);
  border-radius: 2px;
  background: rgba(250, 249, 247, 0.5);
  font-family: 'Noto Sans JP', sans-serif;
  font-size: 0.875rem;
  color: #3d3d3d;
  transition: all 0.25s;
}

.modal-form input::placeholder {
  color: #c8c8c8;
}

.modal-form input:focus,
.modal-form select:focus {
  background: #fff;
  border-color: rgba(176, 112, 112, 0.18);
}

.input-pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.icon-input-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.icon-preview-box {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(196, 212, 196, 0.12), rgba(196, 212, 196, 0.06));
  border: 1px solid rgba(61, 61, 61, 0.04);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #b8b8b8;
}

.icon-input-row input {
  flex: 1;
}

.change-icon-btn {
  padding: 0.5625rem 1rem;
  border-radius: 2px;
  background: transparent;
  border: 1px solid rgba(61, 61, 61, 0.08);
  color: #3d3d3d;
  font-family: 'Noto Sans JP', sans-serif;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}

.change-icon-btn:hover {
  background: rgba(196, 212, 196, 0.08);
  border-color: rgba(196, 212, 196, 0.28);
}

.form-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.25rem;
}

.btn-cancel,
.btn-submit {
  padding: 0.625rem 1.5rem;
  border-radius: 2px;
  font-family: 'Noto Sans JP', sans-serif;
  font-size: 0.8125rem;
  cursor: pointer;
  transition: all 0.25s;
}

.btn-cancel {
  background: transparent;
  border: 1px solid rgba(61, 61, 61, 0.08);
  color: #3d3d3d;
}

.btn-cancel:hover {
  background: rgba(61, 61, 61, 0.03);
}

.btn-submit {
  background: linear-gradient(135deg, #c4d4c4, #a8b8a8);
  border: none;
  color: #fff;
  box-shadow: 0 2px 10px rgba(196, 212, 196, 0.4);
}

.btn-submit:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 15px rgba(196, 212, 196, 0.55);
}

.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition: all 0.2s;
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.scale-in-enter-active,
.scale-in-leave-active {
  transition: all 0.25s;
}

.scale-in-enter-from,
.scale-in-leave-to {
  opacity: 0;
  transform: scale(0.96);
}

.hidden {
  display: none;
}

@media (max-width: 768px) {
  .top-bar {
    padding: 1.5rem 1.25rem 1rem;
    flex-direction: column;
    gap: 1rem;
  }

  .brand-group {
    flex-direction: column;
    gap: 0.75rem;
  }

  .seal-box {
    width: 42px;
    height: 42px;
  }

  .seal-box span {
    font-size: 0.9375rem;
  }

  .title-text h1 {
    font-size: 1.375rem;
  }

  .tools {
    width: 100%;
    justify-content: center;
  }

  .search-bar {
    width: 100%;
    max-width: 280px;
  }

  .cat-tabs {
    padding: 0 1.25rem 1rem;
    gap: 0.5rem;
  }

  .tab-item {
    padding: 0.375rem 0.875rem;
    font-size: 0.75rem;
  }

  .scroll-wrapper {
    padding: 0 1.25rem 1.5rem;
  }

  .cards-grid {
    grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
    gap: 0.75rem;
  }

  .site-card {
    width: 70px;
    padding: 0.75rem 0.5rem;
    gap: 0.5rem;
  }

  .icon-circle {
    width: 38px;
    height: 38px;
  }

  .icon-image {
    width: 20px;
    height: 20px;
  }

  .icon-text {
    font-size: 0.9375rem;
  }

  .card-title {
    font-size: 0.625rem;
    line-height: 1.2;
  }

  .modal-content {
    padding: 1.5rem 1.25rem;
    max-width: 320px;
  }

  .modal-header h2 {
    font-size: 1.125rem;
  }
}
</style>
