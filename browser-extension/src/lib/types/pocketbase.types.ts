/**
 * PocketBase Types
 * 
 * Type definitions for PocketBase API interactions and errors.
 */

export interface PocketBaseError {
  status: number
  message: string
  data?: {
    message?: string
    data?: Record<string, string[]>
  }
}

export interface PocketBaseResponse<T = unknown> {
  page: number
  perPage: number
  totalItems: number
  totalPages: number
  items: T[]
}

export interface PocketBaseUser {
  id: string
  email: string
  name?: string
  username?: string
  verified: boolean
  created: string
  updated: string
}

export interface PocketBaseAuthData {
  token: string
  record: PocketBaseUser
}

export interface PocketBaseConfig {
  baseUrl?: string
  enableLogging?: boolean
}