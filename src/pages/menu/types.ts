// Ответ /api/admin/menu (Waiter-app, api/_lib/menuService.js).
import type { Restaurant } from '../hall/types'

export type ProductType = 'food' | 'drink' | 'alcohol'

export interface Place { sectionId: string | null; subsectionId: string | null; subSubsectionId: string | null }

export interface ModifierOption { id?: string; name: string; priceDelta: number; available: boolean }
export interface ModifierGroup { id?: string; name: string; type: 'single' | 'multi'; required: boolean; options: ModifierOption[] }

export interface Dish {
  id: string
  name: string
  section: string
  sectionOrder: number | null
  price: number
  productType: ProductType
  weight: { value: number; unit: string } | null
  cookTimeMin: number | null
  description: string
  ingredients: string[]
  kbju: { kcal: number | null; protein: number | null; fat: number | null; carbs: number | null } | null
  specs: { key: string; value: string }[]
  tags: string[]
  imageUrl: string
  thumbUrl: string
  hidden: boolean
  available: boolean
  stopped: boolean
  courseRole: string | null
  mealTimes: string[]
  place: Place
  modifiers: ModifierGroup[]
  // Блюдо и его копия в «Популярном» — одно блюдо в двух разделах.
  popularTwinId: string | null
}

export interface Section { name: string; order: number; dishes: number; hidden: number; place: Place }

export interface TreeNode { id: string; name: string; children?: TreeNode[] }

export interface MenuResponse {
  restaurant: Restaurant
  sections: Section[]
  dishes: Dish[]
  tree: TreeNode[]
  options: { productTypes: ProductType[]; courseRoles: string[]; mealTimes: string[]; weightUnits: string[] }
}

export const TYPE_LABELS: Record<ProductType, string> = { food: 'Еда', drink: 'Напиток', alcohol: 'Алкоголь' }

export const ROLE_LABELS: Record<string, string> = {
  breakfast: 'Завтрак', soup: 'Суп', salad: 'Салат', starter: 'Закуска', main: 'Горячее', side: 'Гарнир', sauce: 'Соус',
  bread: 'Хлеб', soft: 'Безалкогольный напиток', hot_drink: 'Горячий напиток', alco: 'Алкоголь', dessert: 'Десерт', other: 'Другое',
}

export const MEAL_LABELS: Record<string, string> = { breakfast: 'Завтрак', lunch: 'Обед', dinner: 'Ужин', late: 'Поздний вечер' }

export const isPopularSection = (name: string) => name.trim().toLowerCase() === 'популярное'
