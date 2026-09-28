import { statOptions, type Entry } from './scoring'

export type OcrItem = { text: string; score: number; poly: number[][] }
export type ParsedEcho = { name: string; cost: number; level: number; entries: Entry[]; ocrText: string[] }

const labels = [...statOptions].sort((a, b) => b.length - a.length)
const aliases: Record<string, string> = {
  '暴击率': '暴击', '爆击': '暴击', '暴伤': '暴击伤害',
  '共鸣效率加成': '共鸣效率', '普通攻击伤害加成': '普攻伤害加成',
  '气动伤害': '气动伤害加成', '热熔伤害': '热熔伤害加成',
  '冷凝伤害': '冷凝伤害加成', '导电伤害': '导电伤害加成',
  '衍射伤害': '衍射伤害加成', '湮灭伤害': '湮灭伤害加成',
}

function normalize(input: string): string {
  return input.normalize('NFKC').replace(/\s+/g, '').replace(/[％﹪]/g, '%').replace(/[，。]/g, '.')
}

function identifyStat(label: string, hasPercent: boolean): string | null {
  const clean = normalize(label).replace(/[·•✦✧★☆+]/g, '')
  for (const [alias, canonical] of Object.entries(aliases)) if (clean.includes(alias)) return canonical
  if (clean.includes('攻击')) return hasPercent ? '攻击%' : '攻击'
  if (clean.includes('生命')) return hasPercent ? '生命%' : '生命'
  if (clean.includes('防御')) return hasPercent ? '防御%' : '防御'
  for (const stat of labels) if (clean.includes(stat)) return stat
  return null
}

function centerY(item: OcrItem): number {
  return item.poly.reduce((sum, point) => sum + point[1], 0) / item.poly.length
}

function leftX(item: OcrItem): number {
  return Math.min(...item.poly.map((point) => point[0]))
}

export function parseOcr(items: OcrItem[]): ParsedEcho {
  const sorted = [...items].sort((a, b) => centerY(a) - centerY(b) || leftX(a) - leftX(b))
  const texts = sorted.map((item) => item.text)
  let name = ''
  let cost = 0
  let level = 25
  const rows: { y: number; items: OcrItem[] }[] = []

  for (const item of sorted) {
    const text = normalize(item.text)
    const costMatch = text.match(/C[O0]ST([134])/i)
    if (costMatch) { cost = Number(costMatch[1]); continue }
    const levelMatch = text.match(/^\+([0-9]{1,2})$/)
    if (levelMatch) { level = Number(levelMatch[1]); continue }
    if (!name && !/[0-9%]/.test(text) && !identifyStat(text, false)) { name = item.text.trim(); continue }
    const y = centerY(item)
    const row = rows.find((candidate) => Math.abs(candidate.y - y) <= 16)
    if (row) row.items.push(item)
    else rows.push({ y, items: [item] })
  }

  const entries: Entry[] = []
  for (const row of rows.sort((a, b) => a.y - b.y)) {
    const combined = row.items.sort((a, b) => leftX(a) - leftX(b)).map((item) => normalize(item.text)).join(' ')
    const match = combined.match(/(\d+(?:\.\d+)?)\s*(%?)(?!.*\d)/)
    if (!match) continue
    const value = Number(match[1])
    const hasPercent = match[2] === '%' || /%/.test(combined.slice(match.index))
    const stat = identifyStat(combined.slice(0, match.index), hasPercent)
    if (!stat || !Number.isFinite(value)) continue
    entries.push({ id: crypto.randomUUID(), stat, value, section: entries.length < 2 ? 'main' : 'sub' })
  }
  if (!cost) {
    const [first, second] = entries
    if (second?.stat === '生命') cost = 1
    else if (first && ['暴击', '暴击伤害', '治疗效果加成'].includes(first.stat)) cost = 4
    else if (first && ['气动伤害加成', '热熔伤害加成', '冷凝伤害加成', '导电伤害加成', '衍射伤害加成', '湮灭伤害加成', '共鸣效率'].includes(first.stat)) cost = 3
    else if (second?.stat === '攻击' && level >= 20) cost = second.value >= 120 ? 4 : second.value >= 80 ? 3 : 0
  }
  return { name, cost, level, entries, ocrText: texts }
}
