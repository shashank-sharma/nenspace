/**
 * Branded types for type-safe IDs
 * Prevents accidentally mixing different ID types
 */

declare const __brand: unique symbol

type Brand<T, TBrand> = T & { [__brand]: TBrand }

// User IDs
export type UserId = Brand<string, "UserId">
export const UserId = (id: string): UserId => id as UserId

// Device IDs  
export type DeviceId = Brand<string, "DeviceId">
export const DeviceId = (id: string): DeviceId => id as DeviceId

// Token IDs
export type TokenId = Brand<string, "TokenId">
export const TokenId = (id: string): TokenId => id as TokenId

// Dev Token IDs
export type DevTokenId = Brand<string, "DevTokenId">
export const DevTokenId = (id: string): DevTokenId => id as DevTokenId

// Modal IDs
export type ModalId = Brand<string, "ModalId">
export const ModalId = (id: string): ModalId => id as ModalId

// Command IDs
export type CommandId = Brand<string, "CommandId">
export const CommandId = (id: string): CommandId => id as CommandId

/**
 * Type guards to check if a string is a valid branded ID
 */
export function isUserId(value: unknown): value is UserId {
  return typeof value === "string" && value.length > 0
}

export function isDeviceId(value: unknown): value is DeviceId {
  return typeof value === "string" && value.length > 0
}

export function isTokenId(value: unknown): value is TokenId {
  return typeof value === "string" && value.length > 0
}

export function isDevTokenId(value: unknown): value is DevTokenId {
  return typeof value === "string" && value.length > 0
}

