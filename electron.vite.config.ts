import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// [2026-08-18] Windows 빌드 실패 수정: vite-plugin-static-copy 는 src 를 glob 으로 다루는데
//  glob 에서 역슬래시는 **이스케이프 문자**라 Windows 의 resolve() 결과(C:\\...)가 매칭에 실패한다
//  ("No file was found to copy ... /Workers"). POSIX 에선 치환 대상이 없어 무해하다.
const cesiumSource = resolve('node_modules/cesium/Build/Cesium').replace(/\\/g, '/')

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    define: {
      CESIUM_BASE_URL: JSON.stringify('/cesium')
    },
    plugins: [
      react(),
      viteStaticCopy({
        targets: [
          { src: `${cesiumSource}/Workers`, dest: 'cesium' },
          { src: `${cesiumSource}/ThirdParty`, dest: 'cesium' },
          { src: `${cesiumSource}/Assets`, dest: 'cesium' },
          { src: `${cesiumSource}/Widgets`, dest: 'cesium' }
        ]
      })
    ]
  }
})
