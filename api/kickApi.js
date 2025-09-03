// API class for working with Kick.com

import { API_CONSTANTS, FETCH_OPTIONS } from "../config/constants.js"

export class KickAPI {
  /**
   * Get channel information
   * @param {string} username - Username
   * @returns {Promise<Object|null>} Channel data or null
   */
  static async getChannelInfo(username) {
    try {
      // Try different endpoints
      const endpoints = [
        API_CONSTANTS.ENDPOINTS.CHANNEL(username),
        API_CONSTANTS.ENDPOINTS.CHANNEL_V1(username),
        API_CONSTANTS.ENDPOINTS.CHANNEL_LEGACY(username)
      ]

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, FETCH_OPTIONS.DEFAULT)

          if (response.ok) {
            const text = await response.text()

            if (!text.startsWith("<!DOCTYPE") && !text.startsWith("<html")) {
              try {
                return JSON.parse(text)
              } catch (parseError) {
                console.warn(`JSON parse error for ${username} on ${endpoint}:`, parseError)
                // Continue trying other endpoints
              }
            }
          } else {
            console.warn(`HTTP ${response.status} for ${username} on ${endpoint}`)
          }
        } catch (err) {
          console.warn(`Network error for ${username} on ${endpoint}:`, err.message)
          // Ignore individual endpoint errors
        }
      }

      return null
    } catch (error) {
      console.error(`Critical error in getChannelInfo for ${username}:`, error)
      return null
    }
  }

  /**
   * Get livestream information
   * @param {string} username - Username
   * @returns {Promise<Object|null>} Livestream data or null
   */
  static async getLivestreamInfo(username) {
    try {
      // Try different livestream endpoints
      const endpoints = [
        API_CONSTANTS.ENDPOINTS.LIVESTREAM(username),
        API_CONSTANTS.ENDPOINTS.LIVESTREAM_V2(username),
        API_CONSTANTS.ENDPOINTS.LIVESTREAM_LEGACY(username)
      ]

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, FETCH_OPTIONS.DEFAULT)

          if (response.ok) {
            const text = await response.text()

            if (!text.startsWith("<!DOCTYPE") && !text.startsWith("<html")) {
              try {
                return JSON.parse(text)
              } catch (parseError) {
                console.warn(`JSON parse error for ${username} on ${endpoint}:`, parseError)
                // Continue trying other endpoints
              }
            }
          } else {
            console.warn(`HTTP ${response.status} for ${username} on ${endpoint}`)
          }
        } catch (err) {
          console.warn(`Network error for ${username} on ${endpoint}:`, err.message)
          // Ignore individual endpoint errors
        }
      }

      return null
    } catch (error) {
      console.error(`Critical error in getLivestreamInfo for ${username}:`, error)
      return null
    }
  }

  /**
   * Validate streamer and normalize username
   * @param {string} username - Username to validate
   * @returns {Promise<Object|null>} Streamer data object or null
   */
  static async validateStreamer(username) {
    try {
      // First try to get channel info
      const channelInfo = await this.getChannelInfo(username)

      // Check that channel exists and has valid data
      if (
        channelInfo &&
        channelInfo.user &&
        channelInfo.user.username &&
        typeof channelInfo.user.username === "string" &&
        channelInfo.user.username.trim().length > 0
      ) {
        // Additional check - channel should have basic fields
        const hasValidData =
          channelInfo.user.id || channelInfo.user.profile_pic || channelInfo.followers_count !== undefined

        if (hasValidData) {
          return {
            username: channelInfo.user.username.trim(),
            displayName: channelInfo.user.username.trim(),
            thumbnail: channelInfo.user.profile_pic || "https://kick.com/favicon.ico",
            verified: true
          }
        }
      }

      return null
    } catch (error) {
      console.error("Validation error:", error)
      return null
    }
  }
}
