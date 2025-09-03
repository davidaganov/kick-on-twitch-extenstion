// Manager for streamer management

import { KickAPI } from "../api/kickApi.js"
import { CACHE_CONSTANTS, STORAGE_KEYS } from "../config/constants.js"

export class StreamerManager {
  // Cache for API requests
  static cache = new Map()

  /**
   * Get streamers list from storage
   * @returns {Promise<Array>} Array of streamer usernames
   */
  static async getStreamers() {
    const result = await chrome.storage.sync.get([STORAGE_KEYS.KICK_STREAMERS])
    return result[STORAGE_KEYS.KICK_STREAMERS] || []
  }

  /**
   * Check cache
   * @param {string} key - Cache key
   * @returns {Object|null} Cached data or null
   */
  static getCached(key) {
    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.timestamp < CACHE_CONSTANTS.CACHE_DURATION) {
      return cached.data
    }
    this.cache.delete(key)
    return null
  }

  /**
   * Save data to cache
   * @param {string} key - Cache key
   * @param {Object} data - Data to cache
   */
  static setCached(key, data) {
    this.cache.set(key, {
      data: data,
      timestamp: Date.now()
    })
  }

  /**
   * Add streamer to list
   * @param {string} username - Username
   * @returns {Promise<void>}
   * @throws {Error} If streamer not found or limit exceeded
   */
  static async addStreamer(username) {
    const streamers = await this.getStreamers()

    // Normalize username before adding
    const normalizedUsername = await KickAPI.validateStreamer(username)
    if (!normalizedUsername) {
      throw new Error("Streamer not found")
    }

    const finalUsername = normalizedUsername.username

    if (!streamers.includes(finalUsername)) {
      // Limit streamers to max allowed
      if (streamers.length >= CACHE_CONSTANTS.MAX_STREAMERS) {
        throw new Error("Maximum streamers reached")
      }

      streamers.push(finalUsername)
      await chrome.storage.sync.set({ [STORAGE_KEYS.KICK_STREAMERS]: streamers })
    }
  }

  /**
   * Remove streamer from list
   * @param {string} username - Username to remove
   * @returns {Promise<void>}
   */
  static async removeStreamer(username) {
    const streamers = await this.getStreamers()
    const filtered = streamers.filter((s) => s !== username)
    await chrome.storage.sync.set({ [STORAGE_KEYS.KICK_STREAMERS]: filtered })
  }

  /**
   * Get all streamers data
   * @param {boolean} forceUpdate - Force update without cache
   * @returns {Promise<Array>} Array of streamer data
   */
  static async getStreamersData(forceUpdate = false) {
    const streamers = await this.getStreamers()
    const data = []

    for (const username of streamers) {
      const cacheKey = `streamer_${username}`

      // Check cache if not force update
      if (!forceUpdate) {
        const cached = this.getCached(cacheKey)
        if (cached) {
          data.push(cached)
          continue
        }
      }

      // Try API first
      let channelInfo = await KickAPI.getChannelInfo(username)
      let livestreamInfo = await KickAPI.getLivestreamInfo(username)

      // Create streamer data object
      const streamerData = {
        username,
        isLive: false,
        viewers: 0,
        category: "",
        title: "",
        thumbnail: "https://kick.com/favicon.ico"
      }

      // Fill data if available
      // First try channelInfo (primary source)
      if (channelInfo && channelInfo.livestream) {
        const stream = channelInfo.livestream
        streamerData.isLive = stream.is_live || false
        streamerData.viewers = stream.viewer_count || 0
        streamerData.category = stream.categories?.[0]?.name || ""
        streamerData.title = stream.session_title || ""
        if (stream.thumbnail) {
          streamerData.thumbnail = stream.thumbnail
        }
      } else if (livestreamInfo) {
        if (typeof livestreamInfo.isLive !== "undefined") {
          // Data from public search API
          streamerData.isLive = livestreamInfo.isLive
          streamerData.viewers = livestreamInfo.viewers
          streamerData.category = livestreamInfo.category
          streamerData.title = livestreamInfo.title
          if (livestreamInfo.thumbnail) {
            streamerData.thumbnail = livestreamInfo.thumbnail
          }
        } else if (livestreamInfo.data) {
          // Data from API in data wrapper
          streamerData.isLive = livestreamInfo.data.is_live || false
          streamerData.viewers = livestreamInfo.data.viewer_count || 0
          streamerData.category = livestreamInfo.data.categories?.[0]?.name || ""
          streamerData.title = livestreamInfo.data.session_title || ""
          if (livestreamInfo.data.thumbnail) {
            streamerData.thumbnail = livestreamInfo.data.thumbnail
          }
        } else if (livestreamInfo.is_live !== undefined) {
          // Direct fields in object (alternative API structure)
          streamerData.isLive = livestreamInfo.is_live
          streamerData.viewers = livestreamInfo.viewer_count || 0
          streamerData.category = livestreamInfo.categories?.[0]?.name || ""
          streamerData.title = livestreamInfo.session_title || ""
          if (livestreamInfo.thumbnail) {
            streamerData.thumbnail = livestreamInfo.thumbnail
          }
        }
      }

      // Try to get avatar from channelInfo
      if (channelInfo?.user?.profile_pic) {
        streamerData.thumbnail = channelInfo.user.profile_pic
      }

      // Cache the result
      this.setCached(cacheKey, streamerData)
      data.push(streamerData)
    }

    return data
  }
}
