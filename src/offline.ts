const base = import.meta.env.BASE_URL
const cacheName = 'wuwa-ocr-assets-v1'

const assets = [
  { path: 'models/PP-OCRv6_small_det_onnx_infer.tar', label: '文字检测模型', bytes: 9891840 },
  { path: 'models/PP-OCRv6_small_rec_onnx_infer.tar', label: '文字识别模型', bytes: 21319680 },
  { path: 'ort/ort-wasm-simd-threaded.jsep.wasm', label: 'OCR 运行时', bytes: 28312028 },
  { path: 'ort/ort-wasm-simd-threaded.jsep.mjs', label: '运行时模块', bytes: 46851 },
] as const

export type ResourceStatus = {
  phase: 'installing' | 'checking' | 'downloading' | 'ready' | 'error'
  loaded: number
  total: number
  current: string
  completed: number
  speed: number
  error?: string
}

const total = assets.reduce((sum, asset) => sum + asset.bytes, 0)
let status: ResourceStatus = { phase: 'installing', loaded: 0, total, current: '', completed: 0, speed: 0 }
let promise: Promise<void> | null = null
let runtimePaths: { mjs: string; wasm: string } | null = null
const listeners = new Set<(next: ResourceStatus) => void>()

function update(patch: Partial<ResourceStatus>) {
  status = { ...status, ...patch }
  listeners.forEach((listener) => listener(status))
}

export function getResourceStatus() { return status }

export function subscribeResources(listener: (next: ResourceStatus) => void) {
  listeners.add(listener)
  listener(status)
  return () => { listeners.delete(listener) }
}

function assetUrl(path: string) { return new URL(`${base}${path}`, location.origin).href }

async function waitForController() {
  if (navigator.serviceWorker.controller) return
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      navigator.serviceWorker.removeEventListener('controllerchange', onChange)
      reject(new Error('离线页面启动超时，请刷新后重试'))
    }, 60000)
    const onChange = () => {
      if (!navigator.serviceWorker.controller) return
      window.clearTimeout(timeout)
      navigator.serviceWorker.removeEventListener('controllerchange', onChange)
      resolve()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onChange)
    onChange()
  })
}

async function prepare() {
  if (!('serviceWorker' in navigator) || !('caches' in window)) throw new Error('当前浏览器不支持离线缓存')
  update({ phase: 'installing', loaded: 0, completed: 0, speed: 0, current: '正在安装离线页面', error: undefined })
  const existingRegistration = await navigator.serviceWorker.getRegistration(base)
  if (!existingRegistration) await navigator.serviceWorker.register(`${base}sw.js`)
  await navigator.serviceWorker.ready
  await waitForController()

  update({ phase: 'checking', current: '正在检查已缓存资源' })
  const cache = await caches.open(cacheName)
  let completedBytes = 0
  let completed = 0
  for (const asset of assets) {
    const url = assetUrl(asset.path)
    let cached = await cache.match(url)
    if (!cached) {
      cached = await caches.match(url, { ignoreSearch: true })
      if (cached) await cache.put(url, cached)
    }
    if (cached) {
      completedBytes += asset.bytes
      completed += 1
      update({ loaded: completedBytes, completed, speed: 0 })
      continue
    }

    update({ phase: 'downloading', current: asset.label, loaded: completedBytes, completed, speed: 0 })
    const response = await fetch(url)
    if (!response.ok) throw new Error(`${asset.label}下载失败（HTTP ${response.status}）`)
    const write = cache.put(url, response.clone())
    let received = 0
    let lastUpdate = performance.now()
    let lastBytes = 0
    try {
      if (response.body) {
        const reader = response.body.getReader()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          received += value.byteLength
          const now = performance.now()
          const elapsed = now - lastUpdate
          if (elapsed >= 300 || received >= asset.bytes) {
            update({ loaded: Math.min(total, completedBytes + received), speed: elapsed > 0 ? (received - lastBytes) * 1000 / elapsed : 0 })
            lastUpdate = now
            lastBytes = received
          }
        }
      } else {
        received = (await response.arrayBuffer()).byteLength
      }
      await write
    } catch (error) {
      await write.catch(() => undefined)
      throw error
    }
    completedBytes += asset.bytes
    completed += 1
    update({ loaded: completedBytes, completed, speed: 0 })
  }
  const mjs = await cache.match(assetUrl('ort/ort-wasm-simd-threaded.jsep.mjs'))
  const wasm = await cache.match(assetUrl('ort/ort-wasm-simd-threaded.jsep.wasm'))
  if (!mjs || !wasm) throw new Error('OCR 运行时缓存不完整')
  runtimePaths = {
    mjs: URL.createObjectURL(await mjs.blob()),
    wasm: URL.createObjectURL(await wasm.blob()),
  }
  update({ phase: 'ready', loaded: total, completed: assets.length, speed: 0, current: '' })
}

export function prepareOfflineResources() {
  if (!import.meta.env.PROD) return Promise.resolve()
  if (!promise) {
    promise = prepare().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : '资源准备失败'
      update({ phase: 'error', current: '', speed: 0, error: message })
      promise = null
      throw error
    })
  }
  return promise
}

export async function getRuntimePaths() {
  if (!import.meta.env.PROD) return `${base}ort/`
  await prepareOfflineResources()
  if (!runtimePaths) throw new Error('OCR 运行时缓存未就绪')
  return runtimePaths
}

export const resourceCount = assets.length
