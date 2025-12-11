import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// ============================================================
// captures 폴더를 public으로 자동 복사 (dev 서버 실행 시)
// ============================================================
const copyFolderPlugin = {
  name: 'copy-captures',
  apply: 'serve', // 개발 서버에서만 실행
  configResolved(config) {
    const source = path.resolve(__dirname, 'captures')
    const dest = path.resolve(__dirname, 'public', 'captures')
    
    // captures 폴더가 존재하면 public/captures로 복사
    if (fs.existsSync(source)) {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true })
      }
      
      try {
        fs.readdirSync(source).forEach(file => {
          const srcFile = path.join(source, file)
          const destFile = path.join(dest, file)
          
          if (fs.statSync(srcFile).isFile()) {
            fs.copyFileSync(srcFile, destFile)
          }
        })
        
        console.log('[Vite] ✅ captures 폴더를 public으로 복사 완료')
      } catch (error) {
        console.warn('[Vite] ⚠️ captures 폴더 복사 실패:', error.message)
      }
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), copyFolderPlugin],
  server: {
    // 개발 서버에서 정적 파일 제공
    fs: {
      // captures 폴더 접근 허용
      allow: ['captures', 'public', '.']
    }
  },
  build: {
    // 번들 크기 최적화
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom']
        }
      }
    }
  }
})
