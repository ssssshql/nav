# AGENTS.md - 开发指南

本文档为 AI 代理提供代码库开发规范。

## 项目概述

- **项目类型**: 全栈 Web 应用 (Koa + Vue 3)
- **包管理器**: pnpm
- **数据库**: MySQL + Sequelize
- **认证**: JWT + 2FA (TOTP)

## 目录结构

```
nav/
├── client/                 # 前端 Vue 3 项目
│   ├── src/
│   │   ├── views/         # 页面组件
│   │   ├── stores/        # Pinia 状态管理
│   │   ├── router/        # Vue Router 配置
│   │   ├── App.vue
│   │   └── main.js
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
├── server/                 # 后端 Node.js 项目
│   ├── app.js             # 主入口 (Koa)
│   ├── models.js          # Sequelize 模型定义
│   └── package.json
├── docker-compose.yml
└── README.md
```

## 构建与运行命令

### 前端 (client/)

```bash
cd client
pnpm install          # 安装依赖
pnpm dev              # 开发服务器 (http://localhost:5173)
pnpm build            # 生产构建
pnpm preview          # 预览生产构建
```

### 后端 (server/)

```bash
cd server
pnpm install          # 安装依赖
pnpm start            # 生产模式运行
pnpm dev              # 开发模式 (带热重载)
```

### 数据库

```bash
# 启动 MySQL (Docker)
docker-compose up -d mysql

# 端口: 3306, 账号: root, 密码: rootpassword
```

## 测试与 Lint

**注意**: 项目当前未配置 ESLint、Prettier 或测试框架。

如需添加，建议:
- 前端: `pnpm add -D eslint @vitejs/plugin-eslint prettier`
- 后端: `pnpm add -D eslint prettier jest`

## 代码风格指南

### 通用规范

- 使用 2 空格缩进
- 字符串使用单引号 `'`
- 文件末尾保留一个空行
- 避免不必要的 console.log (生产环境)
- 异步操作使用 async/await

### 前端 (Vue 3)

#### 组件规范

- 使用 `<script setup>` 语法
- 组件名使用 PascalCase (如 `Home.vue`, `Login.vue`)
- 导入顺序: Vue 内置 → 第三方库 → 本地模块

```vue
<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../stores/auth'
import { Search, Plus } from 'lucide-vue-next'
import SomeComponent from './SomeComponent.vue'

const props = defineProps({ title: String })
const emit = defineEmits(['update'])

const count = ref(0)
</script>

<template>
  <div>{{ count }}</div>
</template>
```

#### 样式规范

- 使用 Tailwind CSS 类名
- 保持模板简洁，避免内联复杂逻辑
- 事件处理使用 `@click` 而非 `onClick`

#### 状态管理 (Pinia)

```javascript
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const token = ref('')
  // ...
  return { token }
})
```

#### 导入顺序 (Vue 文件)

1. Vue/Router/Pinia 内置
2. 第三方库 (axios, lucide-vue-next)
3. 本地 stores
4. 本地组件/视图
5. 样式文件

### 后端 (Node.js/Koa)

#### 模块系统

- 使用 CommonJS (`require`/`module.exports`)
- Node.js 内置模块放顶部，第三方放中间，本地放底部

```javascript
const path = require('path')
const fs = require('fs')
const Koa = require('koa')
const Router = require('koa-router')
const { initDB, getDB } = require('./models')
```

#### 错误处理

- 使用 try-catch 处理异步错误
- 统一错误响应格式: `{ error: 'message' }`
- HTTP 状态码正确使用 (200/400/401/403/404/500)

```javascript
try {
  const result = await someAsyncOperation()
  ctx.body = result
} catch (e) {
  console.error(e)
  ctx.status = 500
  ctx.body = { error: 'Internal server error' }
}
```

#### 路由定义

```javascript
const router = new Router()

// 公开路由
router.get('/api/public', async (ctx) => {
  ctx.body = { data: '公开数据' }
})

// 受保护路由 - 使用中间件
router.post('/api/protected', authMiddleware, async (ctx) => {
  ctx.body = { data: '受保护数据' }
})
```

### API 设计

- RESTful 风格
- 请求体 JSON 格式
- 认证: `Authorization: Bearer <token>`
- 响应格式: `{ data }` 或 `{ error: 'message' }`

### 数据库 (Sequelize)

- 模型定义使用 `sequelize.define()`
- 使用 `async/await` 查询
- 错误需要 try-catch 捕获

```javascript
const { Site } = getDB()
const sites = await Site.findAll()
await Site.create({ title, url, category })
await site.destroy()
```

## 命名约定

| 类型 | 约定 | 示例 |
|------|------|------|
| Vue 组件 | PascalCase | `Home.vue`, `Login.vue` |
| Pinia Store | camelCase | `auth.js`, `settings.js` |
| 路由文件 | camelCase | `index.js` |
| 数据库模型 | PascalCase | `Site`, `SystemConfig` |
| 数据库字段 | camelCase | `twoFactorSecret`, `userId` |
| API 端点 | kebab-case | `/api/setup-status`, `/api/fetch-favicon` |

## 注意事项

1. **环境变量**: 敏感信息不提交到版本控制
2. **生产构建**: 前端需先 `pnpm build`，后端会托管静态文件
3. **2FA 认证**: 使用 TOTP，secret 存储在 SystemConfig 表
4. **无测试**: 当前项目无单元/集成测试，修改需谨慎测试
5. **无类型检查**: 未使用 TypeScript，需确保参数类型正确

## 常用调试

```bash
# 查看后端日志
cd server && pnpm dev

# 查看前端热更新
cd client && pnpm dev

# 重启数据库
docker-compose restart mysql
```
