// Authentication feature types

export interface DeviceRegistration {
  name: string
  hostname: string
  os: string
  arch: string
}

export interface DeviceResponse {
  id: string
  name?: string
  hostname?: string
  os?: string
  arch?: string
  created?: string
  updated?: string
}

export interface LoginCredentials {
  identity: string
  password: string
}

export interface AuthFlowResult {
  success: boolean
  error?: string
  authData?: import('$lib/types').StoredAuth
  needsProfileSelection?: boolean
}

