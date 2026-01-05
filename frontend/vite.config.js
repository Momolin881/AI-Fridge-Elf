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
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // React 核心庫
          if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
            return 'vendor-react';
          }
          // LINE LIFF SDK
          if (id.includes('@line/liff')) {
            return 'vendor-liff';
          }
          // Ant Design - 細分成多個 chunk
          if (id.includes('antd')) {
            // Ant Design 圖標單獨分離（通常很大）
            if (id.includes('@ant-design/icons')) {
              return 'vendor-antd-icons';
            }
            return 'vendor-antd';
          }
          // Chart.js
          if (id.includes('chart.js') || id.includes('react-chartjs-2')) {
            return 'vendor-charts';
          }
          // 其他 node_modules
          if (id.includes('node_modules')) {
            return 'vendor-other';
          }
        },
      },
    },
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
