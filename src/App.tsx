import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { characters, formatScore, scoreEcho, statOptions, templateDate, type Echo, type Entry } from './scoring'
import { recognizeEcho, type OcrStage } from './ocr'
import { getResourceStatus, prepareOfflineResources, resourceCount, subscribeResources } from './offline'
import { CharacterPicker } from './CharacterPicker'
import './App.css'

type BusyState = Record<string, { stage: OcrStage | 'error'; startedAt: number }>
const base = import.meta.env.BASE_URL
const emptyEntry = (section: Entry['section']): Entry => ({ id: crypto.randomUUID(), section, stat: '攻击%', value: 0 })
const formatBytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`
const formatSpeed = (bytes: number) => bytes >= 1024 * 1024 ? `${formatBytes(bytes)}/秒` : `${Math.round(bytes / 1024)} KB/秒`

function stageText(stage: OcrStage | 'error', downloading: boolean) {
  switch (stage) {
    case 'preparing': return '正在处理图片'
    case 'waiting': return downloading ? '等待离线资源下载完成' : '等待 OCR 资源准备完成'
    case 'initializing': return '正在初始化 OCR 模型'
    case 'recognizing': return '正在识别图片文字'
    case 'parsing': return '正在整理词条并计算分数'
    case 'error': return '识别失败，请检查下载状态或手动填写词条'
  }
}

function App() {
  const [characterId, setCharacterId] = useState('1413')
  const [echoes, setEchoes] = useState<Echo[]>([])
  const [busy, setBusy] = useState<BusyState>({})
  const [resources, setResources] = useState(getResourceStatus)
  const [clock, setClock] = useState(Date.now)
  const [notice, setNotice] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const selected = useMemo(() => characters.find((item) => item.id === characterId) ?? characters[0], [characterId])
  const processing = Object.values(busy).some((item) => item.stage !== 'error')
  const percent = Math.min(100, Math.round(resources.loaded / resources.total * 100))

  useEffect(() => {
    const unsubscribe = subscribeResources(setResources)
    void prepareOfflineResources().catch(() => undefined)
    return unsubscribe
  }, [])

  useEffect(() => {
    if (!processing) return
    const timer = window.setInterval(() => setClock(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [processing])

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
    setEchoes((current) => [{ id, imageUrl, name: file.name.replace(/\.[^.]+$/, ''), cost: 0, level: 25, entries: [], ocrText: [] }, ...current])
    setBusy((current) => ({ ...current, [id]: { stage: 'preparing', startedAt: Date.now() } }))
    setNotice('')
    try {
      const parsed = await recognizeEcho(file, (stage) => setBusy((current) => current[id] ? { ...current, [id]: { ...current[id], stage } } : current))
      setEchoes((current) => current.map((echo) => echo.id === id ? { ...echo, name: parsed.name || echo.name, cost: parsed.cost, level: parsed.level, entries: parsed.entries, ocrText: parsed.ocrText } : echo))
      setBusy((current) => { const next = { ...current }; delete next[id]; return next })
    } catch (error) {
      console.error(error)
      setBusy((current) => current[id] ? { ...current, [id]: { ...current[id], stage: 'error' } } : current)
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
    setBusy((current) => { const next = { ...current }; delete next[id]; return next })
  }
  const totals = echoes.map((echo) => scoreEcho(echo, selected.template))
  const combined = totals.reduce((sum, item) => sum + item.total, 0)

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark">◈</div><span>鸣潮声骸评分</span></div>
      <div className={`resource-status ${resources.phase === 'ready' ? 'is-ready' : ''}`} role="status">
        <div className="resource-title"><span className="status-dot" />
          {import.meta.env.DEV ? '本地开发预览' : resources.phase === 'ready' ? '已备好离线使用' : resources.phase === 'error' ? '离线资源下载失败' : resources.phase === 'downloading' ? `下载 OCR 资源 ${percent}%` : resources.current || '正在检查离线资源'}
        </div>
        {import.meta.env.PROD && resources.phase === 'downloading' && <><progress max={resources.total} value={resources.loaded} aria-label="OCR 资源下载进度" /><small>{resources.current} · {formatBytes(resources.loaded)} / {formatBytes(resources.total)} · {resources.speed > 0 ? formatSpeed(resources.speed) : '正在连接'} · {resources.completed}/{resourceCount} 项已缓存</small></>}
        {import.meta.env.PROD && resources.phase === 'error' && <div className="resource-error"><small>{resources.error}</small><button type="button" onClick={() => void prepareOfflineResources().catch(() => undefined)}>重试下载</button></div>}
      </div>
    </header>

    <main>
      <section className="hero"><div className="hero-copy"><p className="eyebrow">ECHO ANALYZER · LOCAL OCR</p><h1>看清每一条词条的价值</h1><p className="hero-sub">选择角色，粘贴单只声骸的面板截图。识别、校对、逐条评分，都在你的浏览器中完成。</p></div><div className="hero-stat"><span>{characters.length}</span><small>角色评分模板</small></div></section>
      <section className="workspace">
        <div className="controls"><div className="field character-field"><label>评分角色</label><CharacterPicker value={characterId} onChange={setCharacterId} /></div><div className="template-meta">当前模板：{selected.template.name}<br /><span>更换角色后，已有声骸会立即重新评分</span></div></div>
        <div className="dropzone" onClick={() => fileInput.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) void addImage(file) }} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') fileInput.current?.click() }}><div className="drop-icon">⌁</div><div><strong>粘贴截图，开始评分</strong><p>按 Ctrl + V，或点击选择 / 拖入图片。每张图生成独立声骸卡片。</p></div><span className="upload-action">选择图片</span><input ref={fileInput} type="file" accept="image/*" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void addImage(file); event.target.value = '' }} /></div>
        {notice && <p className="notice" role="alert">{notice}</p>}
        {echoes.length > 0 && <div className="results-heading"><div><p className="eyebrow">YOUR ECHOES</p><h2>评分结果 <small>{echoes.length} 只</small></h2></div><div className="aggregate">合计 <strong>{formatScore(combined)}</strong><span>仅供多只声骸参考</span></div></div>}
        <div className="echo-list">{echoes.map((echo, index) => {
          const result = totals[index]
          return <article className="echo-card" key={echo.id}>
            <div className="card-top"><div className="card-index">{String(index + 1).padStart(2, '0')}</div><input className="name-input" aria-label="声骸名称" value={echo.name} onChange={(event) => updateEcho(echo.id, { name: event.target.value })} /><button className="remove-button" onClick={() => removeEcho(echo.id)} aria-label="移除声骸">×</button></div>
            <div className="card-body"><div className="image-column"><img src={echo.imageUrl} alt={`${echo.name}截图`} /><details><summary>查看 OCR 原文</summary><p>{echo.ocrText.length ? echo.ocrText.join(' · ') : '暂无识别内容'}</p></details></div><div className="score-column">
              <div className="card-meta"><label>COST<select value={echo.cost} onChange={(event) => updateEcho(echo.id, { cost: Number(event.target.value) })}><option value="0">请选择</option><option value="1">1</option><option value="3">3</option><option value="4">4</option></select></label><label>强化等级<input type="number" min="0" max="25" step="5" value={echo.level} onChange={(event) => updateEcho(echo.id, { level: Number(event.target.value) })} /></label><div className="card-score"><span>当前得分</span><strong>{result.valid ? formatScore(result.total) : '—'}</strong><small>/ 50</small></div></div>
              {busy[echo.id] && <div className="busy" role="status"><strong>{stageText(busy[echo.id].stage, resources.phase === 'downloading')}</strong>{busy[echo.id].stage !== 'error' && <span>已等待 {Math.max(0, Math.floor((clock - busy[echo.id].startedAt) / 1000))} 秒{busy[echo.id].stage === 'waiting' && resources.phase === 'downloading' ? ` · 下载 ${percent}%` : ''}</span>}</div>}
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
