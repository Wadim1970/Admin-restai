// Ответы /api/admin/trainer-facts (Waiter-app, api/_lib/trainerFactsService.js).

export type FactStatus = 'draft' | 'confirmed' | 'rejected'
export type FactType =
  | 'weight' | 'cooking_time_min' | 'ingredients' | 'allergens' | 'may_contain' | 'sauce'
  | 'doneness_recommended' | 'gluten_free_possible' | 'dairy_free_possible' | 'modifications'
  | 'wine_pairing' | 'flavor_profile' | 'guest_description'

// Форма значения зависит от типа факта (проверяет сервер, trainerFactsCore.js).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FactValue = Record<string, any>

export interface LevelReady { ready: boolean | null; missing: string[] }
export type Readiness = Record<1 | 2 | 3, LevelReady>

export interface StudioDish {
  id: string
  name: string
  section: string
  sectionOrder: number | null
  productType: 'food' | 'drink' | 'alcohol'
  price: number
  hidden: boolean
  available: boolean
  thumbUrl: string
  ready: Readiness
  statuses: Partial<Record<FactType, FactStatus>>
  review: FactType[]
}

export interface StudioSection {
  name: string
  order: number
  dishes: number
  ready: Record<1 | 2 | 3, number>
  applicable: Record<1 | 2 | 3, number>
  drafts: number
}

export interface FactMeta { key: FactType; label: string; na: boolean; ai: boolean; batch: boolean }

export interface StudioResponse {
  restaurant: { id: string; name: string }
  sections: StudioSection[]
  dishes: StudioDish[]
  meta: {
    factTypes: FactMeta[]
    allergens: { code: string; name: string }[]
    batchTypes: FactType[]
  }
}

export interface DishFact {
  type: FactType
  value: FactValue
  status: FactStatus
  source: 'menu' | 'ai' | 'manual'
  reviewNote: string | null
  confirmedBy: string | null
  confirmedAt: string | null
  updatedAt: string | null
}

export interface DishResponse {
  dish: {
    id: string; name: string; section: string; productType: 'food' | 'drink' | 'alcohol'; description: string
    ingredients: string[]; weight: { value: number; unit: string } | null; cookTimeMin: number | null; imageUrl: string; hidden: boolean
  }
  facts: DishFact[]
  ready: Readiness
  allergenHints: Record<string, string[]>
  alcohol: { id: string; name: string }[]
  log: { at: string; type: string; action: string; actor: string; from: string | null; to: string | null }[]
}

export interface SyncResult { dishes: number; created: number; returnedToDraft: number; refreshed: number }

export const STATUS_LABELS: Record<FactStatus, string> = { draft: 'Черновик', confirmed: 'Подтверждено', rejected: 'Отклонено' }
export const STATUS_COLORS: Record<FactStatus, string> = { draft: 'gold', confirmed: 'green', rejected: 'red' }
export const SOURCE_LABELS = { menu: 'из меню', ai: 'черновик ИИ', manual: 'введено вручную' } as const

export const LEVEL_LABELS: Record<1 | 2 | 3, string> = { 1: 'Названия', 2: 'Состав', 3: 'Шеф' }
export const MISSING_LABELS: Record<string, string> = {
  key_ingredients: 'ключевые ингредиенты', ingredients: 'состав', weight: 'масса', allergens: 'аллергены', sauce: 'соус',
}

export const DONENESS_LABELS: Record<string, string> = {
  rare: 'С кровью (rare)', medium_rare: 'Слабая (medium rare)', medium: 'Средняя (medium)', medium_well: 'Выше средней (medium well)', well_done: 'Полная (well done)',
}
export const YES_NO_LABELS: Record<string, string> = { yes: 'Да', no: 'Нет', partial: 'Частично' }
export const WEIGHT_UNITS = ['г', 'мл', 'шт', 'кг', 'л']

// Порядок карточек фактов в карточке блюда: сначала нужные для уровней.
export const FACT_ORDER: FactType[] = [
  'ingredients', 'weight', 'allergens', 'sauce', 'doneness_recommended', 'gluten_free_possible', 'dairy_free_possible',
  'modifications', 'wine_pairing', 'may_contain', 'flavor_profile', 'guest_description', 'cooking_time_min',
]
