import { copyFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const source = resolve('node_modules/onnxruntime-web/dist')
const destination = resolve('public/ort')
mkdirSync(destination, { recursive: true })
for (const name of [
  'ort-wasm-simd-threaded.jsep.mjs',
  'ort-wasm-simd-threaded.jsep.wasm',
]) {
  copyFileSync(resolve(source, name), resolve(destination, name))
}
