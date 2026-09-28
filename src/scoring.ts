import templateBundle from './data/templates.json'

export type Entry = { id: string; stat: string; value: number; section: 'main' | 'sub' }
export type Echo = { id: string; imageUrl: string; name: string; cost: number; level: number; entries: Entry[]; ocrText: string[] }

export type ScoreTemplate = {
  name: string
  main_props: Record<string, Record<string, number>>
  sub_props: Record<string, number>
  skill_weight: number[]
  score_max: number[]
}

export const characters = templateBundle.templates as { id: string; character: string; template: ScoreTemplate }[]
export const templateDate = templateBundle.exportedAt

export const statOptions = [
  '攻击', '攻击%', '生命', '生命%', '防御', '防御%', '暴击', '暴击伤害', '共鸣效率',
  '气动伤害加成', '热熔伤害加成', '冷凝伤害加成', '导电伤害加成', '衍射伤害加成', '湮灭伤害加成',
  '普攻伤害加成', '重击伤害加成', '共鸣技能伤害加成', '共鸣解放伤害加成', '治疗效果加成',
] as const

const elementStats = new Set<string>([
  '气动伤害加成', '热熔伤害加成', '冷凝伤害加成', '导电伤害加成', '衍射伤害加成', '湮灭伤害加成',
])
const skillStats: Record<string, number> = {
  '普攻伤害加成': 0,
  '重击伤害加成': 1,
  '共鸣技能伤害加成': 2,
  '共鸣解放伤害加成': 3,
}

export function rawWeight(entry: Entry, cost: number, template: ScoreTemplate): number {
  if (entry.section === 'main') {
    const key = elementStats.has(entry.stat) ? '属性伤害加成' : entry.stat
    return template.main_props[String(cost)]?.[key] ?? 0
  }
  const skillIndex = skillStats[entry.stat]
  if (skillIndex !== undefined) {
    return (template.sub_props['技能伤害加成'] ?? 0) * (template.skill_weight[skillIndex] ?? 0)
  }
  return template.sub_props[entry.stat] ?? 0
}

export function scoreEcho(echo: Echo, template: ScoreTemplate) {
  const scoreMax = template.score_max[{ 1: 0, 3: 1, 4: 2 }[echo.cost as 1 | 3 | 4]]
  if (!scoreMax) return { entries: echo.entries.map(() => 0), total: 0, valid: false }
  const entries = echo.entries.map((entry) => entry.value * rawWeight(entry, echo.cost, template) / scoreMax * 50)
  return { entries, total: entries.reduce((sum, score) => sum + score, 0), valid: true }
}

export function formatScore(value: number): string { return value.toFixed(2) }
