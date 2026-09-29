import { useEffect, useRef, useState } from 'react'
import { rawWeight, type Entry, type ScoreTemplate } from './scoring'
import './ScoreDetailsDialog.css'

type Character = { id: string; character: string; template: ScoreTemplate }
type Cost = 1 | 3 | 4

const costs: Cost[] = [1, 3, 4]
const skillStats = [
  '普攻伤害加成',
  '重击伤害加成',
  '共鸣技能伤害加成',
  '共鸣解放伤害加成',
] as const
const displayStat = (stat: string) => stat === '攻击' || stat === '生命' || stat === '防御' ? `${stat}（固定值）` : stat
const displayNumber = (value: number) => Number(value.toFixed(4)).toString()

function DetailRows({ stats, section, cost, template }: {
  stats: string[]
  section: Entry['section']
  cost: Cost
  template: ScoreTemplate
}) {
  const scoreMax = template.score_max[{ 1: 0, 3: 1, 4: 2 }[cost]]
  return <div className="score-detail-table">
    <div className="score-detail-heading"><span>词条</span><span>有效权重</span><span>每 1 点得分</span></div>
    {stats.map((stat) => {
      const weight = rawWeight({ id: '', section, stat, value: 1 }, cost, template)
      return <div className="score-detail-row" key={stat}>
        <span>{displayStat(stat)}{stat === '属性伤害加成' && <small>适用于各属性伤害加成</small>}</span>
        <span>{displayNumber(weight)}</span>
        <strong className={weight === 0 ? 'is-zero' : ''}>{weight === 0 ? '不计分' : displayNumber(weight / scoreMax * 50)}</strong>
      </div>
    })}
  </div>
}

export function ScoreDetailsDialog({ selected, initialCost, onClose }: {
  selected: Character
  initialCost: Cost
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [cost, setCost] = useState<Cost>(initialCost)
  const { template } = selected
  const scoreMax = template.score_max[{ 1: 0, 3: 1, 4: 2 }[cost]]
  const mainStats = Object.keys(template.main_props[String(cost)] ?? {})
  const subStats = [...Object.keys(template.sub_props).filter((stat) => stat !== '技能伤害加成'), ...skillStats]

  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])

  return <dialog ref={dialog} className="score-details-dialog" aria-labelledby="score-details-title" onClose={onClose}
    onClick={(event) => { if (event.target === dialog.current) dialog.current?.close() }}>
    <div className="score-details-content">
      <header className="score-details-header">
        <img src={`${import.meta.env.BASE_URL}avatars/${selected.id}.png`} alt="" />
        <div><p>角色评分模板</p><h2 id="score-details-title">{selected.character} · 评分细则</h2><small>{template.name}</small></div>
        <button type="button" className="score-details-close" aria-label="关闭评分细则" onClick={() => dialog.current?.close()}>×</button>
      </header>
      <div className="score-details-body">
        <div className="score-details-formula">
          <strong>计算方式</strong>
          <span>每条得分 = 词条数值 × 有效权重 ÷ COST 对应的评分上限 × 50</span>
          <small>百分比按显示数字计算，例如暴击 7.5% 输入 7.5。总分先累加未取整的单项分值，再保留两位小数。</small>
        </div>
        <div className="score-details-costs" aria-label="选择声骸 COST">
          {costs.map((item) => <button type="button" key={item} aria-pressed={cost === item} onClick={() => setCost(item)}>COST {item}</button>)}
        </div>
        <p className="score-details-limit">COST {cost} 的评分上限（score_max）：<strong>{displayNumber(scoreMax)}</strong></p>
        <section><h3>主词条</h3><DetailRows stats={mainStats} section="main" cost={cost} template={template} /></section>
        <section><h3>副词条</h3><DetailRows stats={subStats} section="sub" cost={cost} template={template} /></section>
        <p className="score-details-note">四种伤害加成的有效权重 = 技能伤害基础权重 {displayNumber(template.sub_props['技能伤害加成'] ?? 0)} × 对应技能系数（{skillStats.map((stat, index) => `${stat.replace('伤害加成', '')} ${displayNumber(template.skill_weight[index] ?? 0)}`).join('、')}）。权重为 0 的词条不加分。</p>
      </div>
    </div>
  </dialog>
}
