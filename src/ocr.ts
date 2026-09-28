import { PaddleOCR, type OcrResultItem } from '@paddleocr/paddleocr-js'
import { parseOcr } from './parseOcr'
import { getRuntimePaths, prepareOfflineResources } from './offline'

const base = import.meta.env.BASE_URL
let enginePromise: ReturnType<typeof PaddleOCR.create> | null = null

function getEngine() {
  if (!enginePromise) {
    enginePromise = getRuntimePaths().then((wasmPaths) => PaddleOCR.create({
      textDetectionModelName: 'PP-OCRv6_small_det',
      textRecognitionModelName: 'PP-OCRv6_small_rec',
      textDetectionModelAsset: { url: `${base}models/PP-OCRv6_small_det_onnx_infer.tar` },
      textRecognitionModelAsset: { url: `${base}models/PP-OCRv6_small_rec_onnx_infer.tar` },
      worker: true,
      ortOptions: { backend: 'wasm', wasmPaths: wasmPaths as string, numThreads: 1, simd: true },
    })).catch((error) => {
      enginePromise = null
      throw error
    })
  }
  return enginePromise
}

export type OcrStage = 'preparing' | 'waiting' | 'initializing' | 'recognizing' | 'parsing'

export async function recognizeEcho(file: File, onStage?: (stage: OcrStage) => void) {
  onStage?.('preparing')
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
  onStage?.('waiting')
  await prepareOfflineResources()
  onStage?.('initializing')
  const engine = await getEngine()
  onStage?.('recognizing')
  const [result] = await engine.predict(canvas)
  onStage?.('parsing')
  return parseOcr(result.items as OcrResultItem[])
}
