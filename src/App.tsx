import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { characters, formatScore, scoreEcho, statOptions, templateDate, type Echo, type Entry } from './scoring'
import { recognizeEcho } from './ocr'
import './App.css'

type BusyState = Record<string, '识别中' | '识别失败'>
const base = import.meta.env.BASE_URL
const emptyEntry = (section: Entry['section']): Entry => ({ id: crypto.randomUUID(), section, stat: '攻击%', value: 0 })

function App() {
  const [characterId, setCharacterId] = useState('1413')
  const [echoes, setEchoes] = useState<Echo[]>([])
  const [busy, setBusy] = useState<BusyState>({})
  const [offlineReady, setOfflineReady] = useState(false)
  const [notice, setNotice] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const selected = useMemo(() => characters.find((item) => item.id === characterId) ?? characters[0], [characterId])

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return
    let active = true
    const check = async () => {
      try {
        const assets = [`${base}index.html`, `${base}models/PP-OCRv6_small_det_onnx_infer.tar`, `${base}models/PP-OCRv6_small_rec_onnx_infer.tar`, `${base}ort/ort-wasm-simd-threaded.jsep.wasm`]
        const cacheNames = await caches.keys()
        const requests = (await Promise.all(cacheNames.map(async (name) => (await caches.open(name)).keys()))).flat()
        const storedPaths = new Set(requests.map((request) => new URL(request.url).pathname))
        if (active) setOfflineReady(Boolean(navigator.serviceWorker.controller) && assets.every((asset) => storedPaths.has(asset)))
      } catch (error) { console.warn('无法检查离线资源', error); if (active) setOfflineReady(false) }
    }
    navigator.serviceWorker.register(`${base}sw.js`).then(() => navigator.serviceWorker.ready).then(check).catch(() => setOfflineReady(false))
    navigator.serviceWorker.addEventListener('controllerchange', check)
    const timer = window.setInterval(check, 5000)
    return () => { active = false; window.clearInterval(timer); navigator.serviceWorker.removeEventListener('controllerchange', check) }
  }, [])

  const updateEcho = useCallback((id: string, patch: Partial<Echo>) => {
    setEchoes((current) => current.map((echo) => echo.id === id ? { ...echo, ...patch } : echo))
  }, [])
  const updateEntry = (echoId: string, entryId: string, patch: Partial<Entry>) => {
    setEchoes((current) => current.map((echo) => echo.id === echoId
      ? { ...echo, entries: echo.entries.map((entry) => entry.id === entryId ? { ...entry, ...patch } : entry) }
      : echo))
  }

  const addImage = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) { setNotice('请选择图片文件。'); return }
    const id = crypto.randomUUID()
    const imageUrl = URL.createObjectURL(file)
    setEchoes((current) => [...current, { id, imageUrl, name: file.name.replace(/\.[^.]+$/, ''), cost: 0, level: 25, entries: [], ocrText: [] }])
    setBusy((current) => ({ ...current, [id]: '识别中' }))
    setNotice('')
    try {
      const parsed = await recognizeEcho(file)
      setEchoes((current) => current.map((echo) => echo.id === id ? { ...echo, name: parsed.name || echo.name, cost: parsed.cost, level: parsed.level, entries: parsed.entries, ocrText: parsed.ocrText } : echo))
      setBusy((current) => { const next = { ...current }; delete next[id]; return next })
    } catch (error) {
      console.error(error)
      setBusy((current) => ({ ...current, [id]: '识别失败' }))
      setNotice('OCR 未完成。可在卡片中手动录入，或重新粘贴图片。')
    }
  }, [])

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const item = [...(event.clipboardData?.items ?? [])].find((candidate) => candidate.type.startsWith('image/'))
      const file = item?.getAsFile()
      if (file) { event.preventDefault(); void addImage(file) }
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [addImage])

  const removeEcho = (id: string) => {
    const echo = echoes.find((item) => item.id === id)
    if (echo) URL.revokeObjectURL(echo.imageUrl)
    setEchoes((current) => current.filter((item) => item.id !== id))
  }
  const totals = echoes.map((echo) => scoreEcho(echo, selected.template))
  const combined = totals.reduce((sum, item) => sum + item.total, 0)

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark">◈</div><span>鸣潮声骸评分</span></div>
      <div className={`offline-pill ${offlineReady ? 'is-ready' : ''}`}><span className="status-dot" />{offlineReady ? '已备好离线使用' : import.meta.env.DEV ? '本地开发预览' : '正在准备离线资源'}</div>
    </header>

    <main>
      <section className="hero"><div className="hero-copy"><p className="eyebrow">ECHO ANALYZER · LOCAL OCR</p><h1>看清每一条词条的价值</h1><p className="hero-sub">选择角色，粘贴单只声骸的面板截图。识别、校对、逐条评分，都在你的浏览器中完成。</p></div><div className="hero-stat"><span>{characters.length}</span><small>角色评分模板</small></div></section>
      <section className="workspace">
        <div className="controls"><div className="field character-field"><label htmlFor="character">评分角色</label><select id="character" value={characterId} onChange={(event) => setCharacterId(event.target.value)}>{characters.map((item) => <option key={item.id} value={item.id}>{item.character} ({item.id}) · {item.template.name}</option>)}</select></div><div className="template-meta">当前模板：{selected.template.name}<br /><span>更换角色后，已有声骸会立即重新评分</span></div></div>
        <div className="dropzone" onClick={() => fileInput.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) void addImage(file) }} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') fileInput.current?.click() }}><div className="drop-icon">⌁</div><div><strong>粘贴截图，开始评分</strong><p>按 Ctrl + V，或点击选择 / 拖入图片。每张图生成独立声骸卡片。</p></div><span className="upload-action">选择图片</span><input ref={fileInput} type="file" accept="image/*" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void addImage(file); event.target.value = '' }} /></div>
        {notice && <p className="notice" role="alert">{notice}</p>}
        {echoes.length > 0 && <div className="results-heading"><div><p className="eyebrow">YOUR ECHOES</p><h2>评分结果 <small>{echoes.length} 只</small></h2></div><div className="aggregate">合计 <strong>{formatScore(combined)}</strong><span>仅供多只声骸参考</span></div></div>}
        <div className="echo-list">{echoes.map((echo, index) => {
          const result = totals[index]
          return <article className="echo-card" key={echo.id}>
            <div className="card-top"><div className="card-index">{String(index + 1).padStart(2, '0')}</div><input className="name-input" aria-label="声骸名称" value={echo.name} onChange={(event) => updateEcho(echo.id, { name: event.target.value })} /><button className="remove-button" onClick={() => removeEcho(echo.id)} aria-label="移除声骸">×</button></div>
            <div className="card-body"><div className="image-column"><img src={echo.imageUrl} alt={`${echo.name}截图`} /><details><summary>查看 OCR 原文</summary><p>{echo.ocrText.length ? echo.ocrText.join(' · ') : '暂无识别内容'}</p></details></div><div className="score-column">
              <div className="card-meta"><label>COST<select value={echo.cost} onChange={(event) => updateEcho(echo.id, { cost: Number(event.target.value) })}><option value="0">请选择</option><option value="1">1</option><option value="3">3</option><option value="4">4</option></select></label><label>强化等级<input type="number" min="0" max="25" step="5" value={echo.level} onChange={(event) => updateEcho(echo.id, { level: Number(event.target.value) })} /></label><div className="card-score"><span>当前得分</span><strong>{result.valid ? formatScore(result.total) : '—'}</strong><small>/ 50</small></div></div>
              {busy[echo.id] && <div className="busy">{busy[echo.id] === '识别中' ? '正在加载模型并识别图片…' : '识别失败，请手动填写词条。'}</div>}
              <div className="entry-table"><div className="entry-head"><span>类型</span><span>词条</span><span>数值</span><span>得分</span><span /></div>{echo.entries.map((entry, row) => <div className="entry-row" key={entry.id}><select aria-label={`第${row + 1}条类型`} value={entry.section} onChange={(event) => updateEntry(echo.id, entry.id, { section: event.target.value as Entry['section'] })}><option value="main">主词条</option><option value="sub">副词条</option></select><select aria-label={`第${row + 1}条词条`} value={entry.stat} onChange={(event) => updateEntry(echo.id, entry.id, { stat: event.target.value })}>{statOptions.map((stat) => <option key={stat}>{stat}</option>)}</select><input aria-label={`第${row + 1}条数值`} type="number" min="0" step="0.1" value={entry.value} onChange={(event) => updateEntry(echo.id, entry.id, { value: Number(event.target.value) })} /><strong>{result.valid ? formatScore(result.entries[row]) : '—'}</strong><button aria-label={`删除第${row + 1}条`} onClick={() => updateEcho(echo.id, { entries: echo.entries.filter((item) => item.id !== entry.id) })}>×</button></div>)}</div>
              <div className="entry-actions"><button onClick={() => updateEcho(echo.id, { entries: [...echo.entries, emptyEntry('main')] })}>＋ 主词条</button><button onClick={() => updateEcho(echo.id, { entries: [...echo.entries, emptyEntry('sub')] })}>＋ 副词条</button><span>请核对 OCR 结果后使用分数</span></div>
            </div></div>
          </article>
        })}</div>
      </section>
    </main>
    <footer>本工具仅计算声骸词条评分，不代表实战伤害。评分模板导出于 {new Date(templateDate).toLocaleDateString('zh-CN')}。截图仅在本机处理。<a href={`${base}THIRD_PARTY_NOTICES.txt`}>第三方资源说明</a></footer>
  </div>
}

export default App
