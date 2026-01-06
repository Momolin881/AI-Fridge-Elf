import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { execSync } from 'child_process'

// 獲取 Git commit hash
const getGitHash = () => {
  // 優先使用環境變數（Zeabur/GitHub Actions）
  if (process.env.VITE_GIT_HASH) {
    return process.env.VITE_GIT_HASH
  }

  // 本地開發時從 git 抓取
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch (e) {
    return 'dev'
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    // 移除 manualChunks 配置，讓 Vite 自動處理代碼分割
    // 避免模塊載入順序問題導致的 "Cannot read properties of undefined" 錯誤
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@services': path.resolve(__dirname, './src/services'),
    },
  },

  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    __GIT_HASH__: JSON.stringify(getGitHash()),
  },
})
