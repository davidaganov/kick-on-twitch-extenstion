function formatNumber(num) {
  if (num < 1000) return num.toString()

  if (num < 1000000) {
    const thousands = (num / 1000).toFixed(1)
    return thousands.replace(".", ",").replace(",0", "") + " тыс."
  }

  const millions = (num / 1000000).toFixed(1)
  return millions.replace(".", ",").replace(",0", "") + " млн."
}

function applyTheme(element, theme) {
  element.classList.remove("theme-kick", "theme-twitch", "theme-kick-sidebar", "theme-twitch-sidebar")

  if (theme === "twitch") {
    element.classList.add(element === document.body ? "theme-twitch" : "theme-twitch-sidebar")
  } else {
    element.classList.add(element === document.body ? "theme-kick" : "theme-kick-sidebar")
  }
}

async function loadSavedTheme() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["theme"], (result) => {
      const savedTheme = result.theme || "twitch"
      resolve(savedTheme)
    })
  })
}

const UI_CONSTANTS = {
  DEFAULT_THEME: "twitch",
  MAX_VISIBLE_STREAMERS: 5,
  THEME_OPTIONS: {
    KICK: "kick",
    TWITCH: "twitch"
  }
}

class TwitchKickIntegration {
  constructor() {
    this.kickBlock = null
    this.streamersData = []
    this.observer = null
    this.showAllStreamers = false // Flag to show all streamers
    this.maxVisibleStreamers = 5 // Default value
    this.currentTheme = "twitch" // Default theme
    this.init()
  }

  async init() {
    // Update constants with loaded values
    if (UI_CONSTANTS) {
      this.maxVisibleStreamers = UI_CONSTANTS.MAX_VISIBLE_STREAMERS || 5
      this.currentTheme = UI_CONSTANTS.DEFAULT_THEME || "twitch"
    }

    await this.loadSavedTheme()

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.startObserver())
    } else {
      this.startObserver()
    }

    await this.updateStreamersData()
    chrome.runtime.onMessage.addListener((request) => {
      if (request.type === "UPDATE_STREAMERS") {
        this.streamersData = request.data
        this.showAllStreamers = false
        this.renderStreamers()
      }

      if (request.type === "THEME_CHANGED") {
        this.applyTheme(request.theme)
      }
    })
  }

  repositionKickBlock() {
    if (!this.kickBlock || !document.contains(this.kickBlock)) return

    const followedSection = document.querySelector('[aria-label="Отслеживаемые каналы"]')
    if (followedSection) {
      const nextElement = followedSection.nextElementSibling
      if (nextElement !== this.kickBlock) {
        followedSection.insertAdjacentElement("afterend", this.kickBlock)
      }
    }
  }

  startObserver() {
    this.observer = new MutationObserver((mutations) => {
      if (!this.kickBlock) {
        this.tryCreateKickBlock()
      }

      mutations.forEach((mutation) => {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const svgElements = node.querySelectorAll ? node.querySelectorAll("svg") : []

              svgElements.forEach((svg) => {
                if (svg.closest("#kick-streamers-extension")) {
                  this.fixSvgElement(svg)
                }
              })

              if (node.tagName === "svg" && node.closest("#kick-streamers-extension")) {
                this.fixSvgElement(node)
              }
            }
          })
        }
      })
    })

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    })

    this.tryCreateKickBlock()

    setTimeout(() => this.tryCreateKickBlock(), 1000)
    setTimeout(() => this.tryCreateKickBlock(), 3000)
    setTimeout(() => this.tryCreateKickBlock(), 5000)
  }

  fixSvgElement(svg) {
    try {
      const path = svg.querySelector("path")
      if (path) {
        const dAttr = path.getAttribute("d")
        if (dAttr && dAttr.includes("z") && !dAttr.includes("L")) {
          try {
            path.setAttribute("d", "M7 7 L10 10 L7 13 M10 7 L13 10 L10 13")
            path.setAttribute("stroke", "currentColor")
            path.setAttribute("stroke-width", "1.5")
            path.setAttribute("fill", "none")
          } catch (pathError) {
            const textElement = document.createElement("span")
            textElement.textContent = "→"
            textElement.style.cssText = "font-size: 14px; color: #adadb8;"
            svg.parentNode.replaceChild(textElement, svg)
          }
        }
      }
    } catch (error) {
      try {
        const textElement = document.createElement("span")
        textElement.textContent = "→"
        textElement.style.cssText = "font-size: 14px; color: #adadb8;"
        svg.parentNode.replaceChild(textElement, svg)
      } catch (replaceError) {}
    }
  }

  tryCreateKickBlock() {
    if (this.kickBlock && document.contains(this.kickBlock)) {
      this.repositionKickBlock()
      return
    }

    const sidebarSelectors = [
      '[data-a-target="side-nav"]',
      ".side-nav.side-nav--expanded",
      ".side-nav",
      'nav[aria-label="Левая панель"]',
      ".Layout-sc-1xcs6mc-0.kHqXhd.side-nav.side-nav--expanded"
    ]

    let sidebar = null

    for (const selector of sidebarSelectors) {
      const element = document.querySelector(selector)
      if (element) {
        sidebar = element
        break
      }
    }

    if (!sidebar) return false

    let insertTarget = null

    let followedSection = document
      .querySelector('[data-a-target="side-nav-show-more-button"]')
      ?.closest(".side-nav-section")

    if (!followedSection) {
      followedSection = document.querySelector('[aria-label="Отслеживаемые каналы"]')
    }

    if (!followedSection) {
      const showMoreBtn = document.querySelector('[data-a-target="side-nav-show-more-button"]')
      if (showMoreBtn) {
        followedSection = showMoreBtn.closest(".side-nav-section")
      }
    }

    if (followedSection) {
      insertTarget = followedSection
    } else {
      insertTarget = sidebar
    }

    this.createKickBlock(insertTarget)
    return true
  }

  createKickBlock(insertTarget) {
    if (this.kickBlock) {
      this.kickBlock.remove()
    }

    this.kickBlock = document.createElement("div")
    this.kickBlock.className = "Layout-sc-1xcs6mc-0 iGMbNn side-nav-section"
    this.kickBlock.setAttribute("aria-label", "Каналы с Kick")
    this.kickBlock.setAttribute("role", "group")
    this.kickBlock.id = "kick-streamers-extension"

    this.kickBlock.innerHTML = `
      <div class="Layout-sc-1xcs6mc-0 fxkdFl side-nav-header" data-a-target="kick-nav-header-expanded">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h3 class="CoreText-sc-1txzju1-0 dzXkjr">Каналы с Kick</h3>
        </div>
      </div>
      <div class="InjectLayout-sc-1i43xsx-0 cpWPwm tw-transition-group kick-streamers-list">
        <div class="kick-loading" style="padding: 10px; text-align: center; color: #adadb8; font-size: 12px;">Загрузка</div>
      </div>
    `

    // Insert the block
    if (insertTarget && insertTarget.classList.contains("side-nav-section")) {
      // Insert after "Отслеживаемые каналы" section
      insertTarget.insertAdjacentElement("afterend", this.kickBlock)
    } else if (insertTarget) {
      // Insert at end of found container
      insertTarget.appendChild(this.kickBlock)
    } else {
      // Fallback - insert at end of sidebar
      sidebar.appendChild(this.kickBlock)
    }

    // Apply current theme to newly created block
    this.applyTheme(this.currentTheme)

    // Apply current language to newly created block
    this.updateSidebarTranslations()

    // Render streamers if data already exists
    if (this.streamersData.length > 0) {
      this.renderStreamers()
    }
  }

  async updateStreamersData(forceUpdate = false) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: "GET_STREAMERS_DATA",
          forceUpdate: forceUpdate
        },
        (data) => {
          if (chrome.runtime.lastError) {
            console.error("Data fetch error:", chrome.runtime.lastError.message || chrome.runtime.lastError)
            resolve()
            return
          }

          this.streamersData = data || []
          // Reset show all streamers flag on data update
          this.showAllStreamers = false
          this.renderStreamers()
          resolve()
        }
      )
    })
  }

  renderStreamers() {
    if (!this.kickBlock) {
      return
    }

    const list = this.kickBlock.querySelector(".kick-streamers-list")
    if (!list) return

    if (this.streamersData.length === 0) {
      list.innerHTML = `<div style="padding: 10px; text-align: center; color: #adadb8; font-size: 12px;">Каналы не добавлены</div>`
      return
    }

    // Sort streamers: live ones first by viewer count (highest first), offline last
    const sortedStreamers = [...this.streamersData].sort((a, b) => {
      if (a.isLive && !b.isLive) return -1
      if (!a.isLive && b.isLive) return 1
      if (a.isLive && b.isLive) {
        return (b.viewers || 0) - (a.viewers || 0)
      }
      return 0
    })

    // Determine how many streamers to show
    const visibleStreamers = this.showAllStreamers ? sortedStreamers : sortedStreamers.slice(0, this.maxVisibleStreamers)

    const hasMoreStreamers = sortedStreamers.length > this.maxVisibleStreamers

    const html = visibleStreamers
      .map((streamer) => {
        const isLive = streamer.isLive
        const viewerCount = isLive ? formatNumber(streamer.viewers) : ""

        // Classes for live/offline states
        const linkClasses = isLive
          ? "ScCoreLink-sc-16kq0mq-0 fytYW InjectLayout-sc-1i43xsx-0 cnzybN side-nav-card__link tw-link"
          : "ScCoreLink-sc-16kq0mq-0 fytYW InjectLayout-sc-1i43xsx-0 cnzybN side-nav-card__link side-nav-card__link--offline tw-link"

        const avatarClasses = isLive
          ? "Layout-sc-1xcs6mc-0 kErOMx side-nav-card__avatar"
          : "Layout-sc-1xcs6mc-0 kErOMx side-nav-card__avatar side-nav-card__avatar--offline"

        return `
        <div class="ScTransitionBase-sc-hx4quq-0 jaUBmE tw-transition" aria-hidden="false" style="transition-property: transform, opacity; transition-timing-function: ease;">
          <div>
            <div class="Layout-sc-1xcs6mc-0 AoXTY side-nav-card">
              <a data-a-id="kick-channel-${streamer.username}"
                 data-test-selector="kick-channel"
                 aria-haspopup="dialog"
                 class="${linkClasses}"
                 href="https://kick.com/${streamer.username}"
                 target="_blank"
                 rel="noopener noreferrer">
                <div class="${avatarClasses}">
                  <div class="ScAvatar-sc-144b42z-0 dLsNfm tw-avatar">
                    <img class="InjectLayout-sc-1i43xsx-0 fAYJcN tw-image tw-image-avatar"
                         alt="${streamer.username}"
                         src="${streamer.thumbnail || "https://kick.com/favicon.ico"}"
                         style="object-fit: cover;"
                         onerror="this.src='https://kick.com/favicon.ico'">
                  </div>

                </div>
                <div class="Layout-sc-1xcs6mc-0 bLlihH">
                  <div class="Layout-sc-1xcs6mc-0 dJfBsr">
                    <div data-a-target="side-nav-card-metadata" class="Layout-sc-1xcs6mc-0 ffUuNa">
                      <div class="Layout-sc-1xcs6mc-0 kvrzxX side-nav-card__title">
                        <p title="${
                          streamer.username
                        }" data-a-target="side-nav-title" class="CoreText-sc-1txzju1-0 dTdgXA InjectLayout-sc-1i43xsx-0 hnBAak">${
          streamer.username
        }</p>
                      </div>
                      <div class="Layout-sc-1xcs6mc-0 dWQoKW side-nav-card__metadata" data-a-target="side-nav-game-title">
                        <p dir="auto" title="${streamer.category || ""}" class="CoreText-sc-1txzju1-0 iMyVXK">${
          streamer.category || ""
        }</p>
                      </div>
                    </div>
                    <div class="Layout-sc-1xcs6mc-0 cXMAQb side-nav-card__live-status" data-a-target="side-nav-live-status">
                      ${
                        isLive
                          ? `
                        <div class="Layout-sc-1xcs6mc-0 kvrzxX">
                          <div class="ScChannelStatusIndicator-sc-bjn067-0 fJwlvq tw-channel-status-indicator"></div>
                          <p class="CoreText-sc-1txzju1-0 cWFBTs InjectLayout-sc-1i43xsx-0 cdydzE">В эфире</p>
                          <div class="Layout-sc-1xcs6mc-0 dqfEBK">
                            <span aria-hidden="true" class="CoreText-sc-1txzju1-0 fYAAA-D">${viewerCount}</span>
                            <p class="CoreText-sc-1txzju1-0 cWFBTs InjectLayout-sc-1i43xsx-0 cdydzE">${formatNumber(
                              streamer.viewers
                            )} зрителей</p>
                          </div>
                        </div>
                      `
                          : `
                        <span class="CoreText-sc-1txzju1-0 fYAAA-D">Не в сети</span>
                      `
                      }
                    </div>
                  </div>
                </div>
                <div class="Layout-sc-1xcs6mc-0 dJfBsr">
                  <div class="Layout-sc-1xcs6mc-0 side-nav-card__link__tooltip-arrow">
                    <div class="ScSvgWrapper-sc-wkgzod-0 dKXial tw-svg">
                      <svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path d="M7 7 L10 10 L7 13 M10 7 L13 10 L10 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                      </svg>
                    </div>
                    <p class="CoreText-sc-1txzju1-0 cWFBTs InjectLayout-sc-1i43xsx-0 cdydzE">Открыть канал на Kick.com</p>
                  </div>
                </div>
              </a>
            </div>
          </div>
        </div>
      `
      })
      .join("")

    // Add "Show more" or "Hide" button if needed
    let finalHtml = html
    if (hasMoreStreamers) {
      if (!this.showAllStreamers) {
        // "Показать еще" button
        finalHtml += `
          <div class="Layout-sc-1xcs6mc-0 fxBSrn side-nav-show-more-toggle__button kick-show-more">
            <button data-a-target="side-nav-show-more-button" data-test-selector="ShowMore" class="ScCoreLink-sc-16kq0mq-0 bmaSLQ tw-link kick-show-more-btn">
              <span class="CoreText-sc-1txzju1-0 fomEUL">Показать еще</span>
            </button>
          </div>
        `
      } else {
        // "Скрыть" button
        finalHtml += `
          <div class="Layout-sc-1xcs6mc-0 fxBSrn side-nav-show-more-toggle__button kick-show-more">
            <button data-a-target="side-nav-show-more-button" data-test-selector="ShowMore" class="ScCoreLink-sc-16kq0mq-0 bmaSLQ tw-link kick-hide-btn">
              <span class="CoreText-sc-1txzju1-0 fomEUL">Скрыть</span>
            </button>
          </div>
        `
      }
    }

    list.innerHTML = finalHtml

    // Add handlers for buttons
    const showMoreBtn = list.querySelector(".kick-show-more-btn")
    const hideBtn = list.querySelector(".kick-hide-btn")

    if (showMoreBtn) {
      showMoreBtn.addEventListener("click", () => {
        this.showAllStreamers = true
        this.renderStreamers()
      })
    }

    if (hideBtn) {
      hideBtn.addEventListener("click", () => {
        this.showAllStreamers = false
        this.renderStreamers()
      })
    }

    // Handle SVG errors after HTML insertion
    try {
      // Find all SVG elements in our block
      const svgElements = list.querySelectorAll("svg")
      svgElements.forEach((svg) => {
        // Check that SVG is correctly created
        if (!svg.getAttribute("viewBox")) {
          svg.setAttribute("viewBox", "0 0 20 20")
        }
      })
    } catch (error) {
      console.error("Ошибка обработки SVG элементов:", error)
    }
  }

  // Load saved theme
  async loadSavedTheme() {
    const savedTheme = await loadSavedTheme()
    this.currentTheme = savedTheme
    this.applyTheme(savedTheme)
  }

  applyTheme(theme) {
    // Apply theme to document body
    applyTheme(document.body, theme)

    // Apply theme to extension element
    const extensionElement = document.getElementById("kick-streamers-extension")
    if (extensionElement) {
      applyTheme(extensionElement, theme)
    }

    this.currentTheme = theme
  }

  updateSidebarTranslations() {
    if (!this.kickBlock) return

    // Update title
    const titleElement = this.kickBlock.querySelector("h3")
    if (titleElement) {
      titleElement.textContent = "Каналы с Kick"
    }

    // Update aria-label
    this.kickBlock.setAttribute("aria-label", "Каналы с Kick")
  }
}

// Global SVG error handler
const originalError = console.error
console.error = function (...args) {
  // Intercept SVG errors and fix them
  if (args.some((arg) => typeof arg === "string" && arg.includes("attribute d: Expected number"))) {
    // Find all problematic SVG elements
    const svgElements = document.querySelectorAll("#kick-streamers-extension svg")
    svgElements.forEach((svg) => {
      const path = svg.querySelector("path")
      if (path && path.getAttribute("d").includes("z")) {
        // Replace problematic path with simple one
        path.setAttribute("d", "M7 7 L10 10 L7 13 M10 7 L13 10 L10 13")
        path.setAttribute("stroke", "currentColor")
        path.setAttribute("stroke-width", "1.5")
        path.setAttribute("fill", "none")
      }
    })
    return
  }

  // Call original console.error for other errors
  originalError.apply(console, args)
}

// Initialize only if we're on Twitch
if (window.location.hostname === "www.twitch.tv") {
  new TwitchKickIntegration()
}
