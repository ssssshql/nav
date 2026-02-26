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
  try {
    const { data } = await axios.get('/api/setup-status');
    if (to.path === '/setup') {
      if (!data.setupRequired) {
        next('/');
      } else {
        next();
      }
      return;
    }
    
    if (data.setupRequired) {
      next('/setup');
    } else {
      next();
    }
  } catch (e) {
    next();
  }
});

export default router
