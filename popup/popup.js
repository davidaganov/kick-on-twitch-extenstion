// Inline utility functions for popup
function formatNumber(num) {
  if (num < 1000) {
    return num.toString()
  }

  if (num < 1000000) {
    // Format thousands: 2512 -> "2,5 тыс."
    const thousands = (num / 1000).toFixed(1)
    return thousands.replace(".", ",").replace(",0", "") + " тыс."
  }

  // Format millions: 1234567 -> "1,2 млн."
  const millions = (num / 1000000).toFixed(1)
  return millions.replace(".", ",").replace(",0", "") + " млн."
}

function applyTheme(element, theme) {
  const body = element

  // Remove previous theme class
  body.classList.remove("theme-kick", "theme-twitch")

  // Add new theme class
  if (theme === "twitch") {
    body.classList.add("theme-twitch")
  } else {
    // Kick theme uses :root, no class needed
  }

  console.log(`Applied theme: ${theme}`)
}

async function loadSavedTheme() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["theme"], (result) => {
      const savedTheme = result.theme || "twitch"
      resolve(savedTheme)
    })
  })
}

async function saveTheme(theme) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({ theme: theme }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError)
      } else {
        console.log(`Theme ${theme} saved`)
        resolve()
      }
    })
  })
}

function initThemeHandlers(callback) {
  const themeRadios = document.querySelectorAll('input[name="theme"]')
  themeRadios.forEach((radio) => {
    radio.addEventListener("change", (e) => {
      const selectedTheme = e.target.value
      callback(selectedTheme)
    })
  })
}

function setActiveThemeRadio(theme) {
  const themeRadio = document.querySelector(`input[name="theme"][value="${theme}"]`)
  if (themeRadio) {
    themeRadio.checked = true
  }
}

const UI_CONSTANTS = {
  DEFAULT_THEME: "twitch",
  THEME_OPTIONS: {
    KICK: "kick",
    TWITCH: "twitch"
  }
}

function showError(message) {
  const container = document.getElementById("error-container")
  if (!container) return

  // Clear previous errors
  container.innerHTML = ""

  // Create error element
  const errorDiv = document.createElement("div")
  errorDiv.className = "error-message"
  errorDiv.textContent = message
  container.appendChild(errorDiv)

  // Remove error after 3 seconds
  setTimeout(() => {
    if (container && container.contains(errorDiv)) {
      container.removeChild(errorDiv)
    }
  }, 3000)
}

// Global variables for DOM elements
let streamerInput, addBtn, streamersList, settingsBtn, settingsModal, closeSettingsBtn, skeletonLoader

document.addEventListener("DOMContentLoaded", async () => {
  streamerInput = document.getElementById("streamer-input")
  addBtn = document.getElementById("add-btn")
  streamersList = document.getElementById("streamers-list")
  settingsBtn = document.getElementById("settings-btn")
  settingsModal = document.getElementById("settings-modal")
  closeSettingsBtn = document.getElementById("close-settings-btn")
  skeletonLoader = document.getElementById("skeleton-loader")

  // Load saved settings
  loadSavedSettings()

  // Show loading status
  streamersList.innerHTML = `<div class="loading">Загружаем список...</div>`

  // Load current streamers list
  await loadStreamers()

  // Add streamer functionality
  addBtn.addEventListener("click", addStreamer)
  streamerInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") addStreamer()
  })

  // Update button state based on input length
  streamerInput.addEventListener("input", updateAddButtonState)

  // Settings modal handlers
  settingsBtn.addEventListener("click", openSettings)
  closeSettingsBtn.addEventListener("click", closeSettings)
  settingsModal.addEventListener("click", (e) => {
    if (e.target === settingsModal) {
      closeSettings()
    }
  })

  // Theme selection handlers
  initThemeHandlers(handleThemeChange)

  // Initialize button state after DOM is fully loaded
  setTimeout(() => {
    updateAddButtonState()
  }, 10)

  // Handle remove button clicks and streamer item clicks
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("remove-btn")) {
      const username = e.target.dataset.username
      if (username) {
        // Disable button during removal process
        e.target.disabled = true
        e.target.textContent = "Удаление..."
        removeStreamer(username, e.target)
      }
    }
  })

  // Handle streamer item clicks to open Kick channel
  document.addEventListener("click", (e) => {
    const streamerItem = e.target.closest(".streamer-item")
    if (streamerItem && !e.target.classList.contains("remove-btn")) {
      const username = streamerItem.querySelector(".remove-btn")?.dataset.username
      if (username) {
        // Open Kick channel in new tab
        chrome.tabs.create({
          url: `https://kick.com/${username}`,
          active: true
        })
      }
    }
  })
})

// Skeleton loader management functions
function showSkeletonLoader() {
  if (skeletonLoader) {
    skeletonLoader.style.display = "block"
  }
}

function hideSkeletonLoader() {
  if (skeletonLoader) {
    skeletonLoader.style.display = "none"
  }
}

function isSkeletonVisible() {
  return skeletonLoader && skeletonLoader.style.display === "block"
}

function updateAddButtonState() {
  if (!streamerInput || !addBtn) return

  const inputValue = streamerInput.value.trim()
  const isValidLength = inputValue.length >= 2

  // Check if currently loading (has loading-state class)
  const isCurrentlyLoading = addBtn.classList.contains("loading-state")

  if (isCurrentlyLoading) {
    // Don't change state during loading
    return
  }

  if (!isValidLength) {
    // Insufficient length - disable button
    addBtn.disabled = true
    // CSS will handle gray color via :disabled selector
  } else {
    // Active state - enable button
    addBtn.disabled = false
    // CSS will handle normal color
  }
}

async function addStreamer() {
  // Check if DOM elements are initialized
  if (!streamerInput || !addBtn) {
    console.error("DOM elements not initialized")
    return
  }

  const username = streamerInput.value.trim()
  if (!username) return

  // Disable button and set loading state
  addBtn.disabled = true
  addBtn.classList.add("loading-state")

  // Show skeleton loader and clear "No channels added" message
  showSkeletonLoader()

  // Remove empty state message if present
  if (streamersList && streamersList.innerHTML.includes('class="empty"')) {
    streamersList.innerHTML = ""
  }

  try {
    // Validate and normalize streamer username
    const normalizedUsername = await validateAndNormalizeStreamer(username)

    if (!normalizedUsername) {
      showError("Канал не найден на Kick")
      // Restore button and hide skeleton on validation error
      addBtn.disabled = false
      addBtn.classList.remove("loading-state")
      hideSkeletonLoader()
      updateAddButtonState()
      return
    }

    chrome.runtime.sendMessage(
      {
        type: "ADD_STREAMER",
        username: normalizedUsername
      },
      async (response) => {
        if (chrome.runtime.lastError) {
          console.error("Addition error:", chrome.runtime.lastError)
          showError("Ошибка при добавлении канала")
          // Restore button and hide skeleton on error
          addBtn.disabled = false
          addBtn.classList.remove("loading-state")
          hideSkeletonLoader()
          updateAddButtonState()
          return
        }

        if (response && response.success) {
          streamerInput.value = ""
          // Wait for background to process the addition
          setTimeout(async () => {
            await loadStreamers()
            // Restore button after successful load
            addBtn.disabled = false
            addBtn.classList.remove("loading-state")
            updateAddButtonState()
          }, 800) // 800ms delay for background processing
        } else {
          const errorMessage = response?.error || "Ошибка при добавлении канала"
          showError(errorMessage)
          // Restore button and hide skeleton on error
          addBtn.disabled = false
          addBtn.classList.remove("loading-state")
          hideSkeletonLoader()
          updateAddButtonState()
        }
      }
    )
  } catch (error) {
    console.error("Streamer addition error:", error)
    showError("Произошла ошибка при добавлении канала")
    // Restore button and hide skeleton on error
    addBtn.disabled = false
    addBtn.classList.remove("loading-state")
    hideSkeletonLoader()
    updateAddButtonState()
  }
}

async function validateAndNormalizeStreamer(username) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(
        {
          type: "VALIDATE_STREAMER",
          username: username
        },
        (result) => {
          if (chrome.runtime.lastError) {
            console.error("Validation error:", chrome.runtime.lastError)
            resolve(null)
            return
          }
          resolve(result ? result.username : null)
        }
      )
    } catch (error) {
      console.error("Validation error:", error)
      resolve(null)
    }
  })
}

async function removeStreamer(username, removeBtn) {
  try {
    chrome.runtime.sendMessage(
      {
        type: "REMOVE_STREAMER",
        username: username
      },
      () => {
        if (chrome.runtime.lastError) {
          console.error("Removal error:", chrome.runtime.lastError)
          // Restore button on error
          if (removeBtn) {
            removeBtn.disabled = false
            removeBtn.textContent = "Удалить"
          }
          return
        }
        // Wait for background to process removal
        setTimeout(() => {
          loadStreamers()
        }, 500)
      }
    )
  } catch (error) {
    console.error("Removal error:", error)
    // Restore button on error
    if (removeBtn) {
      removeBtn.disabled = false
      removeBtn.textContent = "Удалить"
    }
  }
}

async function loadStreamers() {
  return new Promise((resolve) => {
    // Check if DOM element is initialized
    if (!streamersList) {
      console.error("streamersList not initialized")
      hideSkeletonLoader()
      resolve()
      return
    }

    try {
      chrome.runtime.sendMessage({ type: "GET_STREAMERS_DATA" }, (data) => {
        if (chrome.runtime.lastError) {
          console.error("Background script communication error:", chrome.runtime.lastError)
          streamersList.innerHTML = `<div class="loading">Ошибка при добавлении канала</div>`
          hideSkeletonLoader()
          resolve()
          return
        }

        const streamers = data || []
        renderStreamers(streamers)
        hideSkeletonLoader()
        resolve()
      })
    } catch (error) {
      console.error("Streamers loading error:", error)
      hideSkeletonLoader()
      resolve()
    }
  })
}

function renderStreamers(streamers) {
  // Check if DOM element is initialized
  if (!streamersList) {
    console.error("streamersList not initialized")
    return
  }

  // Show empty state when no streamers and skeleton not visible
  if ((!streamers || streamers.length === 0) && !isSkeletonVisible()) {
    streamersList.innerHTML = `<div class="empty">Каналы не добавлены</div>`
    return
  }

  // Clear list when empty but skeleton is visible
  if ((!streamers || streamers.length === 0) && isSkeletonVisible()) {
    streamersList.innerHTML = ""
    return
  }

  // Sort: online streamers first, then by viewer count (highest first), offline last
  const sortedStreamers = [...streamers].sort((a, b) => {
    if (a.isLive && !b.isLive) return -1
    if (!a.isLive && b.isLive) return 1
    if (a.isLive && b.isLive) {
      return (b.viewers || 0) - (a.viewers || 0)
    }
    return 0
  })

  const html = sortedStreamers
    .map((streamer) => {
      const isLive = streamer.isLive
      const status = isLive ? "В эфире" : "Не в сети"
      const viewers = isLive ? `${formatNumber(streamer.viewers)}` : ""

      return `
      <div class="streamer-item">
        <div class="streamer-avatar">
          <img src="${streamer.thumbnail || "https://kick.com/favicon.ico"}"
               alt="${streamer.username}"
               onerror="this.src='https://kick.com/favicon.ico'">
        </div>
        <div class="streamer-info">
          <div class="streamer-name">${streamer.username}</div>
          <div class="streamer-details">
            <span class="status ${isLive ? "live" : "offline"}">${status}</span>
            ${viewers ? `<span class="viewers">${viewers}</span>` : ""}
          </div>
        </div>
        <button class="remove-btn" data-username="${streamer.username}">Удалить</button>
      </div>
    `
    })
    .join("")

  streamersList.innerHTML = html

  // Remove handlers are added via event delegation at document level
}

// Settings modal management functions
function openSettings() {
  if (settingsModal) {
    settingsModal.classList.add("show")
    settingsModal.classList.remove("closing")
  }
}

function closeSettings() {
  if (settingsModal) {
    settingsModal.classList.add("closing")

    // Wait for animation to complete before hiding
    setTimeout(() => {
      if (settingsModal) {
        settingsModal.classList.remove("show", "closing")
      }
    }, 300)
  }
}

async function loadSavedSettings() {
  const savedTheme = await loadSavedTheme()

  // Apply theme
  applyTheme(document.body, savedTheme)

  // Set corresponding radio button
  setActiveThemeRadio(savedTheme)

  // Initialize interface with Russian text
  initializeInterface()
}

async function handleThemeChange(selectedTheme) {
  applyTheme(document.body, selectedTheme)

  // Send message through background script (it will save settings)
  chrome.runtime.sendMessage({
    type: "THEME_CHANGED",
    theme: selectedTheme
  })
}

// Initialize interface with Russian text
function initializeInterface() {
  // Update title
  const titleElement = document.querySelector(".header h1")
  if (titleElement) {
    titleElement.textContent = "Каналы с Kick"
  }

  // Update input placeholder
  if (streamerInput) {
    streamerInput.placeholder = "Введите название канала"
  }

  // Update button text
  if (addBtn) {
    if (!addBtn.classList.contains("loading-state")) {
      addBtn.textContent = "Добавить"
    }
  }

  // Update settings modal text
  const settingsTitle = document.querySelector(".settings-modal-header h3")
  if (settingsTitle) {
    settingsTitle.textContent = "Настройки"
  }

  // Update settings button tooltip
  const settingsBtn = document.getElementById("settings-btn")
  if (settingsBtn) {
    settingsBtn.title = "Настройки"
  }

  const themeLabel = document.querySelector('label[for="theme-kick"]')
  if (themeLabel) {
    themeLabel.previousElementSibling.textContent = "Тема оформления:"
  }

  // Update theme descriptions
  const themeDescElements = document.querySelectorAll(".theme-desc")
  themeDescElements.forEach((desc, index) => {
    if (index === 0) {
      desc.textContent = "Зеленая тема"
    } else {
      desc.textContent = "Фиолетовая тема"
    }
  })

  // Update theme names
  const themeNameElements = document.querySelectorAll(".theme-name")
  themeNameElements.forEach((name, index) => {
    if (index === 0) {
      name.textContent = "Kick"
    } else {
      name.textContent = "Twitch"
    }
  })

  // Update version
  const versionElement = document.querySelector(".version")
  if (versionElement) {
    versionElement.textContent = "Версия 1.0.0"
  }
}
