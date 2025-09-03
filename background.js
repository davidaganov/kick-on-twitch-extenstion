import { KickAPI } from "./api/kickApi.js"
import { StreamerManager } from "./managers/streamerManager.js"
import { STORAGE_KEYS } from "./config/constants.js"

async function initialUpdate(forceUpdate = false) {
  const data = await StreamerManager.getStreamersData(forceUpdate)
  await chrome.storage.local.set({ [STORAGE_KEYS.STREAMERS_DATA]: data })

  // Send data to open Twitch tabs with delay
  setTimeout(() => {
    chrome.tabs.query({ url: "https://www.twitch.tv/*" }, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, { type: "UPDATE_STREAMERS", data }).catch(() => {})
      })
    })
  }, 2000)
}
initialUpdate()

// Data update intervals
let updateCounter = 0

setInterval(async () => {
  updateCounter++

  const isFullUpdate = updateCounter % 3 === 0 // Full update every 9 minutes

  try {
    const data = await StreamerManager.getStreamersData(!isFullUpdate)

    if (!isFullUpdate) {
      const onlineStreamers = data.filter((s) => s.isLive)
      if (onlineStreamers.length > 0) {
        const fullData = await StreamerManager.getStreamersData(true)
        await chrome.storage.local.set({ [STORAGE_KEYS.STREAMERS_DATA]: fullData })

        chrome.tabs.query({ url: "https://www.twitch.tv/*" }, (tabs) => {
          tabs.forEach((tab) => {
            chrome.tabs.sendMessage(tab.id, { type: "UPDATE_STREAMERS", data: fullData }).catch(() => {})
          })
        })
        return
      }
    }

    await chrome.storage.local.set({ [STORAGE_KEYS.STREAMERS_DATA]: data })

    // Send update
    chrome.tabs.query({ url: "https://www.twitch.tv/*" }, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, { type: "UPDATE_STREAMERS", data }).catch(() => {})
      })
    })
  } catch (error) {
    console.error("Ошибка обновления данных:", error)
  }
}, 180000)

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_STREAMERS_DATA") {
    StreamerManager.getStreamersData(request.forceUpdate || false)
      .then((data) => {
        sendResponse(data)
      })
      .catch((error) => {
        console.error("Ошибка получения данных стримеров:", error)
        sendResponse([])
      })
    return true
  }

  if (request.type === "ADD_STREAMER") {
    StreamerManager.addStreamer(request.username)
      .then(async () => {
        await initialUpdate(true)
        sendResponse({ success: true })
      })
      .catch((error) => {
        console.error("Ошибка добавления стримера:", error)
        sendResponse({ success: false, error: error.message })
      })
    return true
  }

  if (request.type === "REMOVE_STREAMER") {
    StreamerManager.removeStreamer(request.username)
      .then(async () => {
        await initialUpdate(true)
        sendResponse()
      })
      .catch((error) => {
        console.error("Ошибка удаления стримера:", error)
        sendResponse()
      })
    return true
  }

  if (request.type === "VALIDATE_STREAMER") {
    KickAPI.validateStreamer(request.username).then(sendResponse)
    return true
  }

  if (request.type === "THEME_CHANGED") {
    // Save theme to storage
    chrome.storage.sync.set({ [STORAGE_KEYS.THEME]: request.theme }, () => {
      if (chrome.runtime.lastError) {
        console.error("Ошибка сохранения темы:", chrome.runtime.lastError)
      } else {
        console.log(`Тема ${request.theme} сохранена`)
      }
    })

    // Send theme change
    chrome.tabs.query({ url: "https://www.twitch.tv/*" }, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, {
          type: "THEME_CHANGED",
          [STORAGE_KEYS.THEME]: request.theme
        })
      })
    })
    return true
  }
})
