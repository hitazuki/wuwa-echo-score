import { useEffect, useMemo, useRef, useState } from 'react'
import { characters } from './scoring'
import './CharacterPicker.css'

type Character = (typeof characters)[number]

const avatarUrl = (character: Character) => `${import.meta.env.BASE_URL}avatars/${character.id}.png`

export function CharacterPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const options = useRef<HTMLDivElement>(null)
  const selected = characters.find((item) => item.id === value) ?? characters[0]
  const results = useMemo(() => characters.filter((item) =>
    `${item.character} ${item.template.name} ${item.id}`.toLowerCase().includes(query.trim().toLowerCase()),
  ), [query])

  useEffect(() => {
    if (!open) return
    search.current?.focus()
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [open])

  useEffect(() => {
    if (open) options.current?.querySelector<HTMLElement>(`.character-option[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const choose = (item: Character) => {
    onChange(item.id)
    setOpen(false)
    setQuery('')
    setActive(0)
  }

  return <div className="character-picker" ref={root}>
    <button type="button" className="character-trigger" aria-haspopup="listbox" aria-expanded={open} aria-controls="character-options" onClick={() => setOpen((current) => !current)}>
      <img src={avatarUrl(selected)} alt="" />
      <span className="character-trigger-text"><strong>{selected.character}</strong><small>{selected.template.name}</small></span>
      <span className="character-chevron" aria-hidden="true">⌄</span>
    </button>
    {open && <div className="character-menu">
      <input ref={search} type="search" aria-label="搜索角色" placeholder="搜索角色名称" value={query} onChange={(event) => { setQuery(event.target.value); setActive(0) }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') { setOpen(false); return }
          if (event.key === 'ArrowDown') { event.preventDefault(); setActive((current) => Math.min(current + 1, results.length - 1)) }
          if (event.key === 'ArrowUp') { event.preventDefault(); setActive((current) => Math.max(current - 1, 0)) }
          if (event.key === 'Enter' && results[active]) { event.preventDefault(); choose(results[active]) }
        }} />
      <div id="character-options" className="character-options" role="listbox" aria-label="评分角色" ref={options}>
        {results.map((item, index) => <button key={item.id} type="button" role="option" aria-selected={item.id === selected.id} data-index={index} className={`character-option ${index === active ? 'is-active' : ''}`} onMouseEnter={() => setActive(index)} onClick={() => choose(item)}>
          <img src={avatarUrl(item)} alt="" loading="lazy" />
          <span><strong>{item.character}</strong><small>{item.template.name}</small></span>
        </button>)}
        {results.length === 0 && <p className="character-empty">没有找到角色</p>}
      </div>
    </div>}
  </div>
}
