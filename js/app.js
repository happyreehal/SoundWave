/* ============================================================
   APP.JS — Initialization, Navigation, HomePage, Welcome Flow
============================================================ */

/* ═══════════════════════════════════════════════════════
   MODAL HELPERS
═══════════════════════════════════════════════════════ */
function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add("open");

  const handler = (e) => {
    if (e.target === el) {
      closeModal(id);
      el.removeEventListener("click", handler);
    }
  };
  el.addEventListener("click", handler);

  if (id === "modal-eq") EQ.render();

  // Auto-focus first input
  setTimeout(() => {
    const input = el.querySelector("input[type='text']");
    if (input) input.focus();
  }, 100);
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("open");
}

/* ═══════════════════════════════════════════════════════
   KEYBOARD SHORTCUTS
═══════════════════════════════════════════════════════ */
document.addEventListener("keydown", (e) => {
  // Ignore when typing in input
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

  // Question mark = show shortcuts
  if (e.key === "?" || (e.shiftKey && e.code === "Slash")) {
    e.preventDefault();
    openModal("modal-shortcuts");
    return;
  }

  switch (e.code) {
    case "Space":
      e.preventDefault();
      Player.togglePlay();
      break;
    case "ArrowRight":
      if (e.altKey) { e.preventDefault(); Player.next(); }
      else if (Player.audio.duration) {
        Player.audio.currentTime = Math.min(Player.audio.currentTime + 10, Player.audio.duration);
      }
      break;
    case "ArrowLeft":
      if (e.altKey) { e.preventDefault(); Player.prev(); }
      else if (Player.audio.duration) {
        Player.audio.currentTime = Math.max(Player.audio.currentTime - 10, 0);
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
    case "KeyM": Player.toggleMute(); break;
    case "KeyL": Player.toggleLike(); break;
    case "KeyS": Player.toggleShuffle(); break;
    case "KeyR": Player.toggleRepeat(); break;
    case "Escape":
      document.querySelectorAll(".modal-overlay.open").forEach(m => m.classList.remove("open"));
      UI.closeFullscreen();
      Search.hideSuggestions();
      break;
  }
});

/* ═══════════════════════════════════════════════════════
   HOMEPAGE
═══════════════════════════════════════════════════════ */
const HomePage = {
  featuredSong: null,
  featuredList: [],
  isLoaded: false,

  async load() {
    if (this.isLoaded) return;
    this.renderStructure();
    await this.loadData();
    this.isLoaded = true;
  },

  renderStructure() {
    const page = document.getElementById("page-home");
    if (!page) return;

    const greeting = UI.getGreeting();
    const userName = State.currentUser
      ? (State.currentUser.displayName || "").split(" ")[0]
      : "Guest";

    page.innerHTML =
      // Personalized greeting
      '<div class="greeting-section">' +
        '<div class="greeting-title">' + greeting + ', ' + UI.escHtml(userName) + ' 👋</div>' +
        '<div class="greeting-sub">Let\'s find your perfect vibe</div>' +
      '</div>' +

      // Quick play row (top picks)
      '<div class="quick-grid" id="quick-grid">' +
        Array(6).fill('<div class="skeleton" style="height:56px;border-radius:10px;"></div>').join("") +
      '</div>' +

      // Featured hero
      '<div class="hero" id="hero-banner" onclick="HomePage.playFeatured()">' +
        '<div class="hero-bg-img" id="hero-bg" style="background:linear-gradient(135deg,#1a0a2e,#0f3460);"></div>' +
        '<div class="hero-overlay"></div>' +
        '<div class="hero-body">' +
          '<div class="hero-tag"><i class="fas fa-fire"></i> Featured Today</div>' +
          '<div class="hero-title" id="hero-title">Loading...</div>' +
          '<div class="hero-meta" id="hero-meta">Loading...</div>' +
          '<div class="hero-actions">' +
            '<button class="hero-play" onclick="event.stopPropagation(); HomePage.playFeatured()">' +
              '<i class="fas fa-play"></i> Play Now' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // Recently played (only if user has history)
      '<div id="recently-played-section"></div>' +

      // Trending Now
      '<div class="section-header">' +
        '<div><div class="section-title">🔥 Trending Now</div></div>' +
        '<button class="see-all" onclick="Search.executeFromSuggestion(\'trending hits 2024\')">See All</button>' +
      '</div>' +
      '<div class="cards-grid" id="trending-grid">' + UI.renderSkeletonCards(8) + '</div>' +

      // Made For You (based on liked genres)
      '<div id="made-for-you-section"></div>' +

      // Top Charts
      '<div class="section-header"><div><div class="section-title">📊 Top Charts</div></div></div>' +
      '<div class="song-list">' +
        '<div class="song-list-head"><span>#</span><span>Title</span><span>Album</span><span><i class="fas fa-clock"></i></span><span></span></div>' +
        '<div id="charts-list">' + UI.renderSkeletonRows(8) + '</div>' +
      '</div>' +

      // New Releases
      '<div class="section-header" style="margin-top:8px;">' +
        '<div><div class="section-title">🆕 New Releases</div></div>' +
        '<button class="see-all" onclick="Search.executeFromSuggestion(\'new music 2024\')">See All</button>' +
      '</div>' +
      '<div class="cards-grid" id="new-releases-grid">' + UI.renderSkeletonCards(8) + '</div>' +

      // Pop Hits
      '<div class="section-header">' +
        '<div><div class="section-title">🎤 Pop Hits</div></div>' +
        '<button class="see-all" onclick="Search.executeFromSuggestion(\'pop hits 2024\')">See All</button>' +
      '</div>' +
      '<div class="cards-grid" id="pop-grid">' + UI.renderSkeletonCards(6) + '</div>' +

      // Hip-Hop
      '<div class="section-header">' +
        '<div><div class="section-title">🎤 Hip-Hop & Rap</div></div>' +
        '<button class="see-all" onclick="Search.executeFromSuggestion(\'hip hop 2024\')">See All</button>' +
      '</div>' +
      '<div class="cards-grid" id="hiphop-grid">' + UI.renderSkeletonCards(6) + '</div>';
  },

  async loadData() {
    try {
      const results = await Promise.all([
        API.search("trending hits 2024", 8),
        API.search("new music 2024", 8),
        API.search("pop hits 2024", 6),
        API.search("hip hop rap 2024", 6),
      ]);
      const trending = results[0];
      const newR     = results[1];
      const pop      = results[2];
      const hiphop   = results[3];

      // Hero
      if (trending.length > 0) {
        const hero = trending[0];
        const hTitle = document.getElementById("hero-title");
        const hMeta  = document.getElementById("hero-meta");
        const hBg    = document.getElementById("hero-bg");
        if (hTitle) hTitle.textContent = hero.title;
        if (hMeta)  hMeta.textContent  = hero.artist + " • " + hero.album;
        if (hBg && hero.artwork) {
          hBg.style.backgroundImage    = "url(" + hero.artwork + ")";
          hBg.style.backgroundSize     = "cover";
          hBg.style.backgroundPosition = "center";
        }
        this.featuredSong = hero;
        this.featuredList = trending;
      }

      // Quick play
      const qEl = document.getElementById("quick-grid");
      if (qEl && trending.length > 0) {
        qEl.innerHTML = trending.slice(0, 6).map(s => {
          UI._registerSong(s);
          return (
            '<div class="quick-item" onclick="Player.playSong(window.__songRegistry[\'s_' + s.id + '\'])">' +
              '<div class="quick-thumb">' +
              (s.artwork
                ? '<img src="' + s.artwork + '" alt="" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML=\'<div style=width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:22px;background:var(--bg-elevated)>🎵</div>\'">'
                : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:22px;background:var(--bg-elevated)">🎵</div>') +
              '</div>' +
              '<div class="quick-title">' + UI.escHtml(s.title) + '</div>' +
              '<button class="quick-play"><i class="fas fa-play"></i></button>' +
            '</div>'
          );
        }).join("");
      }

      // Recently played (if exists)
      this.renderRecentlyPlayed();

      // Made for you (based on liked songs)
      await this.renderMadeForYou();

      // Trending
      State.queue = [...trending];
      State.queueIndex = -1;
      const tEl = document.getElementById("trending-grid");
      if (tEl) tEl.innerHTML = trending.map((s, i) => UI.renderCard(s, i, trending)).join("");

      const cEl = document.getElementById("charts-list");
      if (cEl) cEl.innerHTML = trending.map((s, i) => UI.renderSongRow(s, i)).join("");

      // New releases
      State.queue = [...State.queue, ...newR];
      const nEl = document.getElementById("new-releases-grid");
      if (nEl) nEl.innerHTML = newR.map((s, i) => UI.renderCard(s, i, newR)).join("");

      // Pop
      State.queue = [...State.queue, ...pop];
      const pEl = document.getElementById("pop-grid");
      if (pEl) pEl.innerHTML = pop.map((s, i) => UI.renderCard(s, i, pop)).join("");

      // Hip-Hop
      State.queue = [...State.queue, ...hiphop];
      const hEl = document.getElementById("hiphop-grid");
      if (hEl) hEl.innerHTML = hiphop.map((s, i) => UI.renderCard(s, i, hiphop)).join("");

      // Dedupe queue
      const seen = new Set();
      State.queue = State.queue.filter(s => {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      });

      UI.renderSidebarLibrary(trending.slice(0, 10));

    } catch (err) {
      console.error("Home load error:", err);
      UI.showToast("Could not load — check connection", "fas fa-exclamation-triangle", "red");
    }
  },

  renderRecentlyPlayed() {
    const container = document.getElementById("recently-played-section");
    if (!container) return;
    if (State.recentlyPlayed.length < 3) {
      container.innerHTML = "";
      return;
    }
    const recent = State.recentlyPlayed.slice(0, 8);
    container.innerHTML =
      '<div class="section-header">' +
        '<div><div class="section-title">⏰ Recently Played</div></div>' +
      '</div>' +
      '<div class="cards-grid">' +
        recent.map((s, i) => UI.renderCard(s, i, recent)).join("") +
      '</div>';
  },

  async renderMadeForYou() {
    const container = document.getElementById("made-for-you-section");
    if (!container) return;

    // Get genres from liked songs
    const liked = [...State.liked].map(id => window.__songRegistry["s_" + id]).filter(Boolean);
    if (liked.length < 2) {
      container.innerHTML = "";
      return;
    }

    // Get most common genre
    const genreCount = {};
    liked.forEach(s => {
      const g = s.genre || "Music";
      genreCount[g] = (genreCount[g] || 0) + 1;
    });
    const topGenre = Object.entries(genreCount).sort((a, b) => b[1] - a[1])[0][0];

    // Search related songs
    const recommendations = await API.search(topGenre + " hits", 6);
    if (recommendations.length === 0) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML =
      '<div class="section-header">' +
        '<div>' +
          '<div class="section-title">✨ Made For You</div>' +
          '<div class="section-sub">Based on your love for ' + UI.escHtml(topGenre) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="cards-grid">' +
        recommendations.map((s, i) => UI.renderCard(s, i, recommendations)).join("") +
      '</div>';
  },

  playFeatured() {
    if (this.featuredSong) Player.playSong(this.featuredSong, this.featuredList);
  },
};

/* ═══════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════ */
const App = {
  async init() {
    Player.init();
    this.bindNav();
    this.bindTopbar();
    this.bindContextMenu();
    this.bindGlobalClicks();
    await this.loadSearchPage();
    FB.init();
  },

  /* ═══════════════════════════════════════════════════════
     GUEST MODE
  ═══════════════════════════════════════════════════════ */
  enterAsGuest() {
    State.isGuest = true;
    State.currentUser = null;
    State.load(); // Load guest data
    this.showApp();
    UI.showToast("Welcome, Guest! 🎵", "fas fa-user", "blue");
  },

  /* ═══════════════════════════════════════════════════════
     WELCOME ANIMATION + APP
     Login ke baad: welcome animation (2 sec) → app
  ═══════════════════════════════════════════════════════ */
  showWelcomeAndApp(user) {
    // Hide landing
    const landing = document.getElementById("landing-screen");
    if (landing) landing.classList.add("hidden");

    // Show welcome screen
    const welcome = document.getElementById("welcome-screen");
    const wName   = document.getElementById("welcome-name");
    const wAvatar = document.getElementById("welcome-avatar");
    const wInit   = document.getElementById("welcome-initials");
    const wGreet  = document.getElementById("welcome-greeting");

    if (welcome) {
      const displayName = user.displayName || "User";
      const firstName   = displayName.split(" ")[0];
      const initials = displayName.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();

      if (wName)  wName.textContent  = firstName;
      if (wInit)  wInit.textContent  = initials;
      if (wGreet) wGreet.textContent = UI.getGreeting() + ",";

      // Set photo if available
      if (user.photoURL && wAvatar) {
        wAvatar.innerHTML =
          '<img src="' + user.photoURL + '" alt="" onerror="this.parentElement.innerHTML=\'' + initials + '\'">';
      }

      welcome.classList.remove("hidden");

      // After welcome animation completes (2.5s), show app
      setTimeout(() => {
        welcome.classList.add("hidden");
        this.showApp();
      }, 2500);
    } else {
      this.showApp();
    }
  },

  /* ═══════════════════════════════════════════════════════
     SHOW APP
  ═══════════════════════════════════════════════════════ */
  showApp() {
    const landing = document.getElementById("landing-screen");
    if (landing) landing.classList.add("hidden");

    const loader = document.getElementById("app-loader");
    if (loader) {
      loader.classList.remove("hidden");
      const app = document.getElementById("app");
      if (app) app.style.display = "";
    }

    // Reset homepage so it reloads with new user data
    HomePage.isLoaded = false;

    HomePage.load().then(() => {
      if (loader) loader.classList.add("hidden");
      App.checkServerMode();
      if (State.currentUser && !State.isGuest) {
        setTimeout(() => UI.renderSidebarLibrary(), 500);
      }
    });
  },

  /* ═══════════════════════════════════════════════════════
     CHECK SERVER MODE
  ═══════════════════════════════════════════════════════ */
  checkServerMode() {
    setTimeout(() => {
      if (State.isGuest) {
        UI.showToast("Welcome! Sign in to save your library 💚", "fas fa-info-circle", "blue");
      }
    }, 3000);
  },

  /* ═══════════════════════════════════════════════════════
     NAV BINDINGS
  ═══════════════════════════════════════════════════════ */
  bindNav() {
    document.querySelectorAll(".nav-item[data-page]").forEach(item => {
      item.addEventListener("click", () => {
        const page = item.dataset.page;
        UI.navigate(page);
      });
    });

    document.querySelectorAll(".right-tab").forEach(tab => {
      tab.addEventListener("click", () => UI.switchRightPanel(tab.dataset.panel));
    });
  },

  /* ═══════════════════════════════════════════════════════
     TOPBAR
  ═══════════════════════════════════════════════════════ */
  bindTopbar() {
    const searchInput = document.getElementById("search-input");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => Search.handleInput(e.target.value));
      searchInput.addEventListener("focus", () => {
        if (!searchInput.value.trim() && State.searchHistory.length > 0) {
          Search.showSuggestions("");
        }
      });
      searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const q = searchInput.value.trim();
          if (q) {
            UI.navigateTo("search");
            Search.execute(q);
            Search.hideSuggestions();
          }
        }
      });
    }
    const sc = document.querySelector(".search-clear");
    if (sc) sc.addEventListener("click", () => Search.clear());
  },

  /* ═══════════════════════════════════════════════════════
     CONTEXT MENU
  ═══════════════════════════════════════════════════════ */
  bindContextMenu() {
    document.querySelectorAll(".ctx-item[data-action]").forEach(item => {
      item.addEventListener("click", () => ContextMenu.action(item.dataset.action));
    });
  },

  /* ═══════════════════════════════════════════════════════
     GLOBAL CLICK HANDLERS
  ═══════════════════════════════════════════════════════ */
  bindGlobalClicks() {
    // Close search suggestions when clicking outside
    document.addEventListener("click", (e) => {
      const searchWrap = document.querySelector(".search-wrap");
      if (searchWrap && !searchWrap.contains(e.target)) {
        Search.hideSuggestions();
      }
    });
  },

  /* ═══════════════════════════════════════════════════════
     SEARCH PAGE (Categories)
  ═══════════════════════════════════════════════════════ */
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
      { name: "Punjabi",    color: "#16a085" },
      { name: "Workout",    color: "#d35400" },
      { name: "Chill",      color: "#34495e" },
      { name: "Romance",    color: "#e84393" },
    ];

    page.innerHTML =
      '<div id="search-categories">' +
        '<div class="section-header"><div><div class="section-title">Browse Categories</div></div></div>' +
        '<div class="cards-grid" style="grid-template-columns:repeat(auto-fill, minmax(140px,1fr));">' +
          genres.map(g =>
            '<div onclick="Search.executeFromSuggestion(\'' + g.name + ' music\')" ' +
              'class="genre-card stagger-item" ' +
              'style="background:linear-gradient(135deg,' + g.color + 'cc,' + g.color + '77);">' +
              g.name +
            '</div>'
          ).join("") +
        '</div>' +
      '</div>' +
      '<div id="search-results" style="display:none;"></div>';
  },
};

/* ═══════════════════════════════════════════════════════
   START
═══════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  App.init().catch(err => console.error("App init error:", err));
});