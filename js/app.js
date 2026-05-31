/* ============================================================
   APP.JS — Fixed Version
   Fix: quick-grid and library-item onclick use __songRegistry
        instead of raw JSON to avoid quote-breaking
============================================================ */

/* ──────────────────────────────────────────────────────────
   MODAL HELPERS
────────────────────────────────────────────────────────── */
function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add("open");
  el.addEventListener("click", function handler(e) {
    if (e.target === el) {
      closeModal(id);
      el.removeEventListener("click", handler);
    }
  });
  if (id === "modal-eq") EQ.render();
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove("open");
}

/* ──────────────────────────────────────────────────────────
   KEYBOARD SHORTCUTS
────────────────────────────────────────────────────────── */
document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT") return;

  switch (e.code) {
    case "Space":
      e.preventDefault();
      Player.togglePlay();
      break;
    case "ArrowRight":
      if (e.altKey) { e.preventDefault(); Player.next(); }
      else if (!e.ctrlKey && !e.metaKey) {
        if (Player.audio.duration) {
          Player.audio.currentTime = Math.min(
            Player.audio.currentTime + 10,
            Player.audio.duration
          );
        }
      }
      break;
    case "ArrowLeft":
      if (e.altKey) { e.preventDefault(); Player.prev(); }
      else if (!e.ctrlKey && !e.metaKey) {
        if (Player.audio.duration) {
          Player.audio.currentTime = Math.max(
            Player.audio.currentTime - 10, 0
          );
        }
      }
      break;
    case "ArrowUp":
      e.preventDefault();
      Player.setVolume(Math.min(1, State.volume + 0.05));
      break;
    case "ArrowDown":
      e.preventDefault();
      Player.setVolume(Math.max(0, State.volume - 0.05));
      break;
    case "KeyM": Player.toggleMute();    break;
    case "KeyL": Player.toggleLike();    break;
    case "KeyS": Player.toggleShuffle(); break;
    case "KeyR": Player.toggleRepeat();  break;
    case "Escape":
      document.querySelectorAll(".modal-overlay.open")
        .forEach(m => m.classList.remove("open"));
      UI.closeFullscreen();
      break;
  }
});

/* ──────────────────────────────────────────────────────────
   HOME PAGE
────────────────────────────────────────────────────────── */
const HomePage = {
  featuredSong: null,
  featuredList: [],

  async load() {
    this.renderStructure();
    await this.loadData();
  },

  renderStructure() {
    const page = document.getElementById("page-home");
    if (!page) return;
    page.innerHTML = `
      <!-- Quick Play Grid -->
      <div class="section-header">
        <div>
          <div class="section-title">Good Evening 👋</div>
          <div class="section-sub">Jump back in</div>
        </div>
      </div>
      <div class="quick-grid" id="quick-grid">
        ${Array(6).fill(`
          <div class="skeleton" style="height:56px;border-radius:10px;"></div>
        `).join("")}
      </div>

      <!-- Hero Banner -->
      <div class="hero" id="hero-banner" onclick="HomePage.playFeatured()">
        <div class="hero-bg-img" id="hero-bg"
             style="background:linear-gradient(135deg,#1a0a2e,#0f3460);">
        </div>
        <div class="hero-overlay"></div>
        <div class="hero-body">
          <div class="hero-tag">
            <i class="fas fa-fire"></i> Featured Today
          </div>
          <div class="hero-title" id="hero-title">Loading...</div>
          <div class="hero-meta" id="hero-meta">Loading...</div>
          <div class="hero-actions">
            <button class="hero-play"
                    onclick="event.stopPropagation(); HomePage.playFeatured()">
              <i class="fas fa-play"></i> Play Now
            </button>
          </div>
        </div>
      </div>

      <!-- Trending -->
      <div class="section-header">
        <div><div class="section-title">🔥 Trending Now</div></div>
        <button class="see-all"
                onclick="Search.execute('trending hits 2024')">
          See All
        </button>
      </div>
      <div class="cards-grid" id="trending-grid">
        ${UI.renderSkeletonCards(8)}
      </div>

      <!-- Top Charts -->
      <div class="section-header">
        <div><div class="section-title">📊 Top Charts</div></div>
        <button class="see-all">See All</button>
      </div>
      <div class="song-list">
        <div class="song-list-head">
          <span>#</span>
          <span>Title</span>
          <span>Album</span>
          <span><i class="fas fa-clock"></i></span>
          <span></span>
        </div>
        <div id="charts-list">${UI.renderSkeletonRows(8)}</div>
      </div>

      <!-- New Releases -->
      <div class="section-header" style="margin-top:8px;">
        <div><div class="section-title">🆕 New Releases</div></div>
        <button class="see-all"
                onclick="Search.execute('new music 2024')">
          See All
        </button>
      </div>
      <div class="cards-grid" id="new-releases-grid">
        ${UI.renderSkeletonCards(8)}
      </div>

      <!-- Pop Hits -->
      <div class="section-header">
        <div><div class="section-title">🎤 Pop Hits</div></div>
        <button class="see-all"
                onclick="Search.execute('pop hits 2024')">
          See All
        </button>
      </div>
      <div class="cards-grid" id="pop-grid">
        ${UI.renderSkeletonCards(6)}
      </div>

      <!-- Hip Hop -->
      <div class="section-header">
        <div><div class="section-title">🎤 Hip-Hop & Rap</div></div>
        <button class="see-all"
                onclick="Search.execute('hip hop 2024')">
          See All
        </button>
      </div>
      <div class="cards-grid" id="hiphop-grid">
        ${UI.renderSkeletonCards(6)}
      </div>
    `;
  },

  async loadData() {
    try {
      const [trending, newR, pop, hiphop] = await Promise.all([
        API.search("trending hits 2024", 8),
        API.search("new music 2024",     8),
        API.search("pop hits 2024",      6),
        API.search("hip hop rap 2024",   6),
      ]);

      // ── Hero ─────────────────────────────────────────
      if (trending.length > 0) {
        const hero   = trending[0];
        const hTitle = document.getElementById("hero-title");
        const hMeta  = document.getElementById("hero-meta");
        const hBg    = document.getElementById("hero-bg");

        if (hTitle) hTitle.textContent = hero.title;
        if (hMeta)  hMeta.textContent  = `${hero.artist} • ${hero.album}`;
        if (hBg && hero.artwork) {
          hBg.style.backgroundImage    = `url(${hero.artwork})`;
          hBg.style.backgroundSize     = "cover";
          hBg.style.backgroundPosition = "center";
        }
        this.featuredSong = hero;
        this.featuredList = trending;
      }

      // ── Quick Play ────────────────────────────────────
      const qEl = document.getElementById("quick-grid");
      if (qEl && trending.length > 0) {
        qEl.innerHTML = trending.slice(0, 6).map(s => {
          // Register song and use key — fixes quote-break bug
          const key = UI._registerSong(s);
          return `
            <div class="quick-item"
                 onclick="Player.playSong(window.__songRegistry['${key}'])">
              <div class="quick-thumb">
                ${s.artwork
                  ? `<img src="${s.artwork}" alt="" loading="lazy">`
                  : `<div style="width:100%;height:100%;display:flex;
                                align-items:center;justify-content:center;
                                font-size:22px;background:var(--bg-elevated)">
                      🎵
                     </div>`
                }
              </div>
              <div class="quick-title">${UI.escHtml(s.title)}</div>
              <button class="quick-play">
                <i class="fas fa-play"></i>
              </button>
            </div>
          `;
        }).join("");
      }

      // ── Set Queue ─────────────────────────────────────
      State.queue      = [...trending];
      State.queueIndex = -1;

      // ── Trending Cards ────────────────────────────────
      const tEl = document.getElementById("trending-grid");
      if (tEl) {
        tEl.innerHTML = trending
          .map((s, i) => UI.renderCard(s, i, trending))
          .join("");
      }

      // ── Charts List ───────────────────────────────────
      const cEl = document.getElementById("charts-list");
      if (cEl) {
        cEl.innerHTML = trending
          .map((s, i) => UI.renderSongRow(s, i))
          .join("");
      }

      // ── New Releases ──────────────────────────────────
      State.queue = [...State.queue, ...newR];
      const nEl = document.getElementById("new-releases-grid");
      if (nEl) {
        nEl.innerHTML = newR
          .map((s, i) => UI.renderCard(s, i, newR))
          .join("");
      }

      // ── Pop ───────────────────────────────────────────
      State.queue = [...State.queue, ...pop];
      const pEl = document.getElementById("pop-grid");
      if (pEl) {
        pEl.innerHTML = pop
          .map((s, i) => UI.renderCard(s, i, pop))
          .join("");
      }

      // ── Hip Hop ───────────────────────────────────────
      State.queue = [...State.queue, ...hiphop];
      const hEl = document.getElementById("hiphop-grid");
      if (hEl) {
        hEl.innerHTML = hiphop
          .map((s, i) => UI.renderCard(s, i, hiphop))
          .join("");
      }

      // ── Deduplicate queue ─────────────────────────────
      const seen = new Set();
      State.queue = State.queue.filter(s => {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      });

      // ── Library Sidebar ───────────────────────────────
      App.renderLibrarySidebar(trending.slice(0, 10));

    } catch (err) {
      console.error("Home load error:", err);
      UI.showToast(
        "Could not load music — Check connection",
        "fas fa-exclamation-triangle",
        "red"
      );
    }
  },

  playFeatured() {
    if (this.featuredSong) {
      Player.playSong(this.featuredSong, this.featuredList);
    }
  },
};

/* ──────────────────────────────────────────────────────────
   MAIN APP
────────────────────────────────────────────────────────── */
const App = {

  async init() {
    Player.init();
    this.bindNav();
    this.bindTopbar();
    this.bindContextMenu();
    await HomePage.load();
    await this.loadSearchPage();
    this.checkServerMode();
  },

  checkServerMode() {
    const isServer = window.location.port === "3000";
    setTimeout(() => {
      if (isServer) {
        UI.showToast("🎵 Full song mode active!", "fas fa-music", "green");
      } else {
        UI.showToast("Welcome to SoundWave Pro! 🎵", "fas fa-music", "green");
        setTimeout(() => {
          UI.showToast(
            "💡 Run: node server.js for full songs!",
            "fas fa-info-circle",
            "blue"
          );
        }, 3000);
      }
    }, 1000);
  },

  bindNav() {
    document.querySelectorAll(".nav-item[data-page]").forEach(item => {
      item.addEventListener("click", async () => {
        const page = item.dataset.page;
        UI.navigateTo(page);
        if (page === "search") {
          document.getElementById("search-input")?.focus();
        }
      });
    });

    document.querySelectorAll(".right-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        UI.switchRightPanel(tab.dataset.panel);
      });
    });
  },

  bindTopbar() {
    const searchInput = document.getElementById("search-input");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        Search.handleInput(e.target.value);
      });
      searchInput.addEventListener("focus", () => {
        if (!searchInput.value.trim()) {
          UI.navigateTo("search");
        }
      });
    }

    document.querySelector(".search-clear")
      ?.addEventListener("click", () => Search.clear());
  },

  bindContextMenu() {
    document.querySelectorAll(".ctx-item[data-action]")
      .forEach(item => {
        item.addEventListener("click", () => {
          ContextMenu.action(item.dataset.action);
        });
      });
  },

  // ── Library Sidebar ─────────────────────────────────────
  renderLibrarySidebar(songs = []) {
    const container = document.querySelector(".sidebar-library");
    if (!container) return;

    container.innerHTML = `
      <div class="library-header">
        <span class="library-title">Your Library</span>
        <button class="library-add-btn"
                onclick="UI.showToast(
                  'Create playlist — Coming soon!',
                  'fas fa-plus',
                  'blue'
                )">
          <i class="fas fa-plus"></i>
        </button>
      </div>
      ${songs.map(s => {
        // Use registry key — fixes quote-break bug
        const key = UI._registerSong(s);
        return `
          <div class="library-item"
               onclick="Player.playSong(window.__songRegistry['${key}'])">
            <div class="library-thumb">
              ${s.artwork
                ? `<img src="${s.artwork}" alt="" loading="lazy">`
                : `<div style="width:100%;height:100%;
                              background:var(--bg-elevated);
                              display:flex;align-items:center;
                              justify-content:center;font-size:18px;">
                    🎵
                   </div>`
              }
            </div>
            <div class="library-item-info">
              <div class="library-item-name">${UI.escHtml(s.title)}</div>
              <div class="library-item-sub">${UI.escHtml(s.artist)}</div>
            </div>
          </div>
        `;
      }).join("")}
    `;
  },

  // ── Search Page ──────────────────────────────────────────
  async loadSearchPage() {
    const page = document.getElementById("page-search");
    if (!page) return;

    const genres = [
      { name: "Pop",        color: "#e74c3c" },
      { name: "Hip-Hop",    color: "#f39c12" },
      { name: "R&B",        color: "#9b59b6" },
      { name: "Rock",       color: "#2c3e50" },
      { name: "Electronic", color: "#3498db" },
      { name: "K-Pop",      color: "#e91e63" },
      { name: "Jazz",       color: "#795548" },
      { name: "Classical",  color: "#607d8b" },
      { name: "Latin",      color: "#c0392b" },
      { name: "Indie",      color: "#27ae60" },
      { name: "Country",    color: "#8d6e63" },
      { name: "Bollywood",  color: "#ff6b35" },
    ];

    page.innerHTML = `
      <div id="search-categories">
        <div class="section-header">
          <div><div class="section-title">Browse Categories</div></div>
        </div>
        <div class="cards-grid"
             style="grid-template-columns:repeat(auto-fill, minmax(140px,1fr));">
          ${genres.map(g => `
            <div onclick="Search.execute('${g.name} music')"
                 style="background:linear-gradient(135deg,${g.color}cc,${g.color}77);
                        border-radius:16px;padding:20px 14px;cursor:pointer;
                        min-height:80px;display:flex;align-items:flex-end;
                        font-size:16px;font-weight:800;color:#fff;transition:all 0.2s;"
                 onmouseover="this.style.transform='scale(1.05)'"
                 onmouseout="this.style.transform='scale(1)'">
              ${g.name}
            </div>
          `).join("")}
        </div>
      </div>

      <div id="search-results" style="display:none;">
        <div class="section-header">
          <div>
            <div class="section-title" id="search-result-title">Top Results</div>
          </div>
        </div>
        <div class="cards-grid" id="search-cards"></div>

        <div class="section-header" style="margin-top:8px;">
          <div><div class="section-title">Songs</div></div>
        </div>
        <div class="song-list">
          <div class="song-list-head">
            <span>#</span>
            <span>Title</span>
            <span>Album</span>
            <span><i class="fas fa-clock"></i></span>
            <span></span>
          </div>
          <div id="search-songs"></div>
        </div>
      </div>
    `;
  },
};

/* ──────────────────────────────────────────────────────────
   START
────────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  App.init().catch(err => {
    console.error("App init error:", err);
  });
});
