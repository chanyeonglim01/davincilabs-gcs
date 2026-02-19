import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { viteStaticCopy } from 'vite-plugin-static-copy'

const cesiumSource = resolve('node_modules/cesium/Build/Cesium')

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
