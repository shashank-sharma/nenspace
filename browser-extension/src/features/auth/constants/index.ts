// Authentication feature constants

export const AUTH_STEPS = {
  LOGIN: 'login',
  DEV_TOKEN: 'dev_token',
  DEVICE_REGISTRATION: 'device_registration'
} as const

export const AUTH_STEP_MESSAGES = {
  [AUTH_STEPS.LOGIN]: 'Authenticating user...',
  [AUTH_STEPS.DEV_TOKEN]: 'Retrieving sync token...',
  [AUTH_STEPS.DEVICE_REGISTRATION]: 'Registering device...'
} as const

export const DEFAULT_DEVICE_NAME = 'Browser Extension'

