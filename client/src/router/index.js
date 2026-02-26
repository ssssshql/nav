import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Login from '../views/Login.vue'
import Setup from '../views/Setup.vue'
import axios from 'axios'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Home },
    { path: '/login', component: Login },
    { path: '/setup', component: Setup },
  ]
})

// Check setup status
router.beforeEach(async (to, from, next) => {
  if (to.path === '/setup') {
    next();
    return;
  }
  
  // Skip check for login page to avoid loops if backend fails or something
  // But strictly, we should check if setup is needed everywhere.
  
  try {
    const { data } = await axios.get('/api/setup-status');
    if (data.setupRequired) {
      next('/setup');
    } else {
      next();
    }
  } catch (e) {
    // If backend is down, we might just proceed or show error.
    next();
  }
});

export default router
