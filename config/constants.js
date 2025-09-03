// Common constants for the extension
export const API_CONSTANTS = {
  BASE_URL: "https://kick.com/api/v2",
  ENDPOINTS: {
    CHANNEL: (username) => `${API_CONSTANTS.BASE_URL}/channels/${username}`,
    CHANNEL_V1: (username) => `https://kick.com/api/v1/channels/${username}`,
    CHANNEL_LEGACY: (username) => `https://kick.com/api/channels/${username}`,
    LIVESTREAM: (username) => `https://kick.com/api/v1/channels/${username}/livestream`,
    LIVESTREAM_V2: (username) => `${API_CONSTANTS.BASE_URL}/channels/${username}/livestream`,
    LIVESTREAM_LEGACY: (username) => `https://kick.com/api/channels/${username}/livestream`
  }
}

export const CACHE_CONSTANTS = {
  CACHE_DURATION: 10 * 60 * 1000, // 10 minutes
  MAX_STREAMERS: 10
}

export const UI_CONSTANTS = {
  MAX_VISIBLE_STREAMERS: 5,
  DEFAULT_THEME: "kick",
  THEME_OPTIONS: {
    KICK: "kick",
    TWITCH: "twitch"
  }
}

export const STORAGE_KEYS = {
  KICK_STREAMERS: "kickStreamers",
  THEME: "theme",
  STREAMERS_DATA: "streamersData"
}

export const FETCH_OPTIONS = {
  DEFAULT: {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Referer: "https://kick.com/",
      Origin: "https://kick.com"
    },
    mode: "cors",
    credentials: "omit"
  }
}
