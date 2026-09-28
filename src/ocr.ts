import { PaddleOCR, type OcrResultItem } from '@paddleocr/paddleocr-js'
import { parseOcr } from './parseOcr'

const base = import.meta.env.BASE_URL
let enginePromise: ReturnType<typeof PaddleOCR.create> | null = null

function getEngine() {
  if (!enginePromise) {
    enginePromise = PaddleOCR.create({
      textDetectionModelName: 'PP-OCRv6_small_det',
      textRecognitionModelName: 'PP-OCRv6_small_rec',
      textDetectionModelAsset: { url: `${base}models/PP-OCRv6_small_det_onnx_infer.tar` },
      textRecognitionModelAsset: { url: `${base}models/PP-OCRv6_small_rec_onnx_infer.tar` },
      worker: true,
      ortOptions: { backend: 'wasm', wasmPaths: `${base}ort/`, numThreads: 1, simd: true },
    }).catch((error) => {
      enginePromise = null
      throw error
    })
  }
  return enginePromise
}

export async function recognizeEcho(file: File) {
  const bitmap = await createImageBitmap(file)
  const scale = bitmap.width < 700 ? 2 : 1
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width * scale
  canvas.height = bitmap.height * scale
  const context = canvas.getContext('2d')
  if (!context) throw new Error('无法创建图片画布')
  context.imageSmoothingEnabled = true
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const engine = await getEngine()
  const [result] = await engine.predict(canvas)
  return parseOcr(result.items as OcrResultItem[])
}
