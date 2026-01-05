/**
 * Device Registration and Tracking Service
 * 
 * Handles device registration and token management for browser extensions.
 */

import type { 
  DeviceRegistration, 
  DeviceResponse
} from '../../features/auth/types'
import { getPocketBase } from './pocketbase/client'
import { API_ENDPOINTS } from '../config/constants'
import { parsePocketBaseError } from '../utils/error-handler.util'
import { createLogger } from '../utils/logger.util'

const logger = createLogger('[DeviceService]')

class DeviceService {
  /**
   * Get development/sync token from custom API (deprecated - use dev token management instead)
   * @deprecated Use devTokenApiService.generateDevToken() instead
   */
  async getDevToken(backendUrl: string, primaryToken: string): Promise<string> {
    try {
      const pb = getPocketBase(backendUrl)
      
      // Use PocketBase send method for custom API endpoint
      const response = await pb.send<{ token: string }>(API_ENDPOINTS.DEV_TOKEN, {
        method: 'GET',
        headers: {
          'Authorization': primaryToken
        }
      })

      return response.token
    } catch (error) {
      logger.error('Failed to get dev token', error)
      throw parsePocketBaseError(error)
    }
  }

  /**
   * Register browser as a device
   */
  async registerDevice(
    backendUrl: string,
    primaryToken: string,
    deviceData: DeviceRegistration
  ): Promise<DeviceResponse> {
    try {
      const pb = getPocketBase(backendUrl)
      
      // Use PocketBase send method with proper body serialization
      const response = await pb.send<DeviceResponse>(API_ENDPOINTS.TRACK_CREATE, {
        method: 'POST',
        headers: {
          'Authorization': primaryToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(deviceData)
      })

      return response
    } catch (error) {
      logger.error('Failed to register device', error)
      throw parsePocketBaseError(error)
    }
  }

}

export const deviceService = new DeviceService()

