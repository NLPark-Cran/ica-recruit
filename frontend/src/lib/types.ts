/** 与后端 Pydantic schema 对齐的类型定义 */

export type ClubRole = 'staff' | 'admin'

export interface User {
  id: string
  nickname: string
  avatar_url: string
  is_platform_admin: boolean
  has_tokendance_key: boolean
  /** { [club_slug]: 'staff' | 'admin' } */
  club_roles: Record<string, ClubRole>
}

export interface Club {
  id: string
  slug: string
  name: string
  intro: string
  logo_url: string
  departments: string[]
  card_url: string
  contact: string
  active: boolean
  created_at: string
  my_role: ClubRole | null
}

export interface ClubIn {
  slug: string
  name: string
  intro: string
  logo_url: string
  departments: string[]
  card_url: string
  contact: string
}

export interface Member {
  watcha_user_id: number
  nickname: string
  avatar_url: string
  role: ClubRole
  created_at: string
}

export interface DrawResult {
  round: number
  win: boolean
  prize_name: string
  prize_tier: string
  prize_image: string
  is_virtual: boolean
  code: string | null
  virtual_code: string | null
  redeemed_at: string | null
}

export interface RoundStatus {
  round: number
  enabled: boolean
  title: string
  eligible: boolean
  drawn: boolean
  result: DrawResult | null
}

export interface LotteryStatus {
  applied: boolean
  rounds: RoundStatus[]
  card_url: string
}

export interface ApplicationIn {
  name: string
  student_id: string
  college: string
  grade: string
  phone: string
  wechat: string
  departments: string[]
  allow_adjust: boolean
  intro: string
}

export interface Activity {
  id: string
  title: string
  summary: string
  detail: string
  location: string
  starts_at: string | null
  cover_url: string
  published: boolean
  sort: number
  created_at: string
}

export interface RedeemOut {
  ok: boolean
  code: string
  round: number | null
  prize_name: string
  winner_nickname: string
  redeemed_at: string | null
  message: string
}

export interface RedeemHistoryItem {
  code: string
  round: number
  prize_name: string
  winner: string
  redeemed_at: string | null
}

export interface Prize {
  id: string
  round: number
  name: string
  tier: string
  image_url: string
  total_stock: number
  issued: number
  weight: number
  daily_quota: number
  is_virtual: boolean
  active: boolean
  sort: number
  codes_left?: number
}

export interface PrizeIn {
  round: number
  name: string
  tier: string
  image_url: string
  total_stock: number
  weight: number
  daily_quota: number
  is_virtual: boolean
  active: boolean
  sort: number
}

export interface PoolConfig {
  round: number
  lose_weight: number
  enabled: boolean
  title: string
}

export interface AdminStats {
  visitors: number
  applications: number
  rounds: {
    round: number
    draws: number
    wins: number
    redeemed: number
    today_draws: number
    win_rate: number
  }[]
}

export interface DataAssistantResult {
  sql: string
  rows: Record<string, unknown>[]
  summary: string
}

export interface ActivityDraft {
  title: string
  summary: string
  detail: string
}
