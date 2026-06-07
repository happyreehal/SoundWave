/* ============================================================
   APP.JS — Init, Welcome Flow, HomePage, PWA, Confetti
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
  if (id === "modal-stats") UI.renderStats();
  if (id === "modal-theme") ThemeManager.updateUI();

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
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

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
      MiniPlayer.closeMore();
      break;
  }
});

/* ═══════════════════════════════════════════════════════
   CONFETTI ANIMATION (First login celebration)
═══════════════════════════════════════════════════════ */
const Confetti = {
  canvas: null,
  ctx: null,
  particles: [],
  active: false,

  start(duration = 3000) {
    this.canvas = document.getElementById("confetti-canvas");
    if (!this.canvas) return;

    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.canvas.style.display = "block";
    this.ctx = this.canvas.getContext("2d");

    this.particles = [];
    const colors = ["#1db954", "#1ed760", "#7c3aed", "#ec4899", "#f59e0b", "#3b82f6"];

    for (let i = 0; i < 120; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: -20 - Math.random() * 200,
        size: 4 + Math.random() * 8,
        speedY: 2 + Math.random() * 4,
        speedX: -2 + Math.random() * 4,
        rotation: Math.random() * 360,
        rotationSpeed: -5 + Math.random() * 10,
        color: colors[Math.floor(Math.random() * colors.length)],
        shape: Math.random() > 0.5 ? "square" : "circle",
      });
    }

    this.active = true;
    this.animate();

    setTimeout(() => {
      this.active = false;
      setTimeout(() => {
        if (this.canvas) this.canvas.style.display = "none";
      }, 1000);
    }, duration);
  },

  animate() {
    if (!this.active && this.particles.length === 0) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.particles.forEach((p, i) => {
      p.x += p.speedX;
      p.y += p.speedY;
      p.rotation += p.rotationSpeed;
      p.speedY += 0.08; // gravity

      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate((p.rotation * Math.PI) / 180);
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = Math.max(0, 1 - (p.y / this.canvas.height));

      if (p.shape === "square") {
        this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      } else {
        this.ctx.beginPath();
        this.ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();

      if (p.y > this.canvas.height + 50) {
        this.particles.splice(i, 1);
      }
    });

    if (this.particles.length > 0) {
      requestAnimationFrame(() => this.animate());
    }
  },
};

/* ═══════════════════════════════════════════════════════
   PULL-TO-REFRESH (Mobile)
═══════════════════════════════════════════════════════ */
const PullToRefresh = {
  startY: 0,
  currentY: 0,
  pulling: false,
  threshold: 80,

  init() {
    const content = document.getElementById("content-area");
    if (!content) return;

    content.addEventListener("touchstart", (e) => {
      if (content.scrollTop !== 0) return;
      if (!UI.isMobile()) return;
      this.startY = e.touches[0].clientY;
      this.pulling = true;
    }, { passive: true });

    content.addEventListener("touchmove", (e) => {
      if (!this.pulling) return;
      this.currentY = e.touches[0].clientY;
      const distance = this.currentY - this.startY;

      if (distance > 10 && content.scrollTop === 0) {
        const indicator = document.getElementById("pull-refresh-indicator");
        if (indicator) {
          indicator.classList.add("active");
          if (distance > this.threshold) {
            indicator.querySelector(".ptr-text").textContent = "Release to refresh";
          } else {
            indicator.querySelector(".ptr-text").textContent = "Pull to refresh";
          }
        }
      }
    }, { passive: true });

    content.addEventListener("touchend", () => {
      if (!this.pulling) return;
      this.pulling = false;
      const distance = this.currentY - this.startY;

      const indicator = document.getElementById("pull-refresh-indicator");
      if (distance > this.threshold && State.currentPage === "home") {
        // Refresh
        if (indicator) {
          indicator.classList.add("refreshing");
          indicator.querySelector(".ptr-text").textContent = "Refreshing...";
        }
        Player.haptic(20);
        this.refreshHome();
      } else {
        if (indicator) {
          indicator.classList.remove("active");
        }
      }
    });
  },

  async refreshHome() {
    HomePage.isLoaded = false;
    await HomePage.load();

    const indicator = document.getElementById("pull-refresh-indicator");
    if (indicator) {
      setTimeout(() => {
        indicator.classList.remove("active", "refreshing");
        indicator.querySelector(".ptr-text").textContent = "Pull to refresh";
      }, 500);
    }
    UI.showToast("Updated!", "fas fa-check", "green");
  },
};

/* ═══════════════════════════════════════════════════════
   SHAKE TO SHUFFLE (Mobile)
═══════════════════════════════════════════════════════ */
const ShakeDetector = {
  lastTime: 0,
  threshold: 25,
  lastX: 0, lastY: 0, lastZ: 0,

  init() {
    if (!window.DeviceMotionEvent) return;

    // iOS 13+ requires permission
    if (typeof DeviceMotionEvent.requestPermission === "function") {
      // Will ask on first user interaction
      return;
    }

    window.addEventListener("devicemotion", (e) => this.handle(e));
  },

  handle(e) {
    if (!UI.isMobile()) return;

    const acc = e.accelerationIncludingGravity;
    if (!acc) return;

    const now = Date.now();
    if (now - this.lastTime < 1500) return; // Throttle

    const dx = Math.abs(acc.x - this.lastX);
    const dy = Math.abs(acc.y - this.lastY);
    const dz = Math.abs(acc.z - this.lastZ);

    if ((dx > this.threshold && dy > this.threshold) ||
        (dx > this.threshold && dz > this.threshold) ||
        (dy > this.threshold && dz > this.threshold)) {
      this.lastTime = now;
      if (State.currentSong) {
        Player.haptic([50, 100, 50]);
        Player.next();
        UI.showToast("📳 Shuffled to next!", "fas fa-random", "blue");
      }
    }

    this.lastX = acc.x;
    this.lastY = acc.y;
    this.lastZ = acc.z;
  },
};

/* ═══════════════════════════════════════════════════════
   HOMEPAGE (Premium with all features)
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
      : "Friend";

    page.innerHTML =
      '<div class="greeting-section">' +
        '<div class="greeting-title">' + greeting + ', ' + UI.escHtml(userName) + ' 👋</div>' +
        '<div class="greeting-sub">' + this.getTagline() + '</div>' +
      '</div>' +

      '<div class="quick-grid" id="quick-grid">' +
        Array(6).fill('<div class="skeleton" style="height:56px;border-radius:10px;"></div>').join("") +
      '</div>' +

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

      '<div id="recently-played-section"></div>' +

      '<div class="section-header">' +
        '<div><div class="section-title">🔥 Trending Now</div></div>' +
        '<button class="see-all" onclick="Search.executeFromSuggestion(\'trending hits 2024\')">See All</button>' +
      '</div>' +
      '<div class="cards-grid" id="trending-grid">' + UI.renderSkeletonCards(8) + '</div>' +

      '<div id="made-for-you-section"></div>' +

      '<div class="section-header"><div><div class="section-title">📊 Top Charts</div></div></div>' +
      '<div class="song-list">' +
        '<div class="song-list-head"><span>#</span><span>Title</span><span>Album</span><span><i class="fas fa-clock"></i></span><span></span></div>' +
        '<div id="charts-list">' + UI.renderSkeletonRows(8) + '</div>' +
      '</div>' +

      '<div class="section-header" style="margin-top:8px;">' +
        '<div><div class="section-title">🆕 New Releases</div></div>' +
        '<button class="see-all" onclick="Search.executeFromSuggestion(\'new music 2024\')">See All</button>' +
      '</div>' +
      '<div class="cards-grid" id="new-releases-grid">' + UI.renderSkeletonCards(8) + '</div>' +

      '<div class="section-header">' +
        '<div><div class="section-title">🎤 Pop Hits</div></div>' +
        '<button class="see-all" onclick="Search.executeFromSuggestion(\'pop hits 2024\')">See All</button>' +
      '</div>' +
      '<div class="cards-grid" id="pop-grid">' + UI.renderSkeletonCards(6) + '</div>' +

      '<div class="section-header">' +
        '<div><div class="section-title">🎤 Hip-Hop & Rap</div></div>' +
        '<button class="see-all" onclick="Search.executeFromSuggestion(\'hip hop 2024\')">See All</button>' +
      '</div>' +
      '<div class="cards-grid" id="hiphop-grid">' + UI.renderSkeletonCards(6) + '</div>';
  },

  /* Time-based tagline */
  getTagline() {
    const h = new Date().getHours();
    const taglines = {
      morning:   ["Start your day with music 🌅", "Wake up to your favorites ☕", "Energize your morning 🎵"],
      afternoon: ["Keep the rhythm going 🎶", "Music for your day ☀️", "Find your vibe ✨"],
      evening:   ["Wind down with music 🌆", "Evening melodies 🎼", "Relax and enjoy 🎧"],
      night:     ["Late night vibes 🌙", "Peaceful music for the night ⭐", "Chill till you drop 💤"],
    };
    let period;
    if (h < 12) period = "morning";
    else if (h < 17) period = "afternoon";
    else if (h < 21) period = "evening";
    else period = "night";
    const list = taglines[period];
    return list[Math.floor(Math.random() * list.length)];
  },

  /* Time-based search queries for recommendations */
  getTimeBasedQuery() {
    const h = new Date().getHours();
    if (h < 12)        return "morning chill music";
    else if (h < 17)   return "upbeat hits";
    else if (h < 21)   return "evening relax music";
    else               return "night chill sleep music";
  },

  async loadData() {
    try {
      const timeQuery = this.getTimeBasedQuery();
      const results = await Promise.all([
        API.search("trending hits 2024", 8),
        API.search("new music 2024", 8),
        API.search("pop hits 2024", 6),
        API.search("hip hop rap 2024", 6),
        API.search(timeQuery, 6),
      ]);
      const trending = results[0];
      const newR     = results[1];
      const pop      = results[2];
      const hiphop   = results[3];
      const timeRec  = results[4];

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
            '<div class="quick-item" onclick="Player.playFromRegistry(\'' + s.id + '\')">' +
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

      this.renderRecentlyPlayed();
      await this.renderMadeForYou(timeRec);

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
    // Register songs
    recent.forEach(s => UI._registerSong(s));

    container.innerHTML =
      '<div class="section-header">' +
        '<div><div class="section-title">⏰ Recently Played</div></div>' +
      '</div>' +
      '<div class="cards-grid">' +
        recent.map((s, i) => UI.renderCard(s, i, recent)).join("") +
      '</div>';
  },

  async renderMadeForYou(fallbackSongs) {
    const container = document.getElementById("made-for-you-section");
    if (!container) return;

    const liked = [...State.liked].map(id => window.__songRegistry["s_" + id]).filter(Boolean);
    let recommendations = [];
    let basedOn = "";

    if (liked.length >= 2) {
      // Genre-based recommendations
      const genreCount = {};
      liked.forEach(s => {
        const g = s.genre || "Music";
        genreCount[g] = (genreCount[g] || 0) + 1;
      });
      const topGenre = Object.entries(genreCount).sort((a, b) => b[1] - a[1])[0][0];
      recommendations = await API.search(topGenre + " hits", 6);
      basedOn = "Based on your love for " + topGenre;
    } else if (fallbackSongs && fallbackSongs.length > 0) {
      recommendations = fallbackSongs;
      basedOn = "Perfect for this time of day";
    }

    if (recommendations.length === 0) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML =
      '<div class="section-header">' +
        '<div>' +
          '<div class="section-title">✨ Made For You</div>' +
          '<div class="section-sub">' + UI.escHtml(basedOn) + '</div>' +
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
   PWA INSTALL PROMPT
═══════════════════════════════════════════════════════ */
let deferredInstallPrompt = null;

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;

  // Show custom prompt after 5 seconds (if not dismissed)
  setTimeout(() => {
    if (!localStorage.getItem("install_dismissed") && deferredInstallPrompt) {
      const prompt = document.getElementById("install-prompt");
      if (prompt) prompt.classList.remove("hidden");
    }
  }, 5000);
});

document.addEventListener("DOMContentLoaded", () => {
  const installBtn = document.getElementById("install-btn");
  if (installBtn) {
    installBtn.addEventListener("click", async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      console.log("Install:", outcome);
      if (outcome === "accepted") {
        UI.showToast("Installing SoundWave Pro! 🎉", "fas fa-check", "green");
      }
      deferredInstallPrompt = null;
      App.dismissInstallPrompt();
    });
  }
});

window.addEventListener("appinstalled", () => {
  console.log("✅ PWA installed");
  UI.showToast("Installed! Find on home screen 🎉", "fas fa-check", "green");
  App.dismissInstallPrompt();
});

/* ═══════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════ */
const App = {
  async init() {
    ThemeManager.init();  // ✅ Initialize theme FIRST
    Player.init();
    this.bindNav();
    this.bindTopbar();
    this.bindContextMenu();
    this.bindGlobalClicks();
    await this.loadSearchPage();
    FB.init();

    // Initialize features
    LongPress.init();
    PullToRefresh.init();
    ShakeDetector.init();
  },

  /* ═══════════════════════════════════════════════════════
     GUEST MODE
  ═══════════════════════════════════════════════════════ */
  enterAsGuest() {
    State.isGuest = true;
    State.currentUser = null;
    State.load();
    this.showApp();
    UI.showToast("Welcome, Guest! 🎵", "fas fa-user", "blue");
  },

  /* ═══════════════════════════════════════════════════════
     WELCOME ANIMATION + APP
  ═══════════════════════════════════════════════════════ */
  showWelcomeAndApp(user, isFirstLogin) {
    const landing = document.getElementById("landing-screen");
    if (landing) landing.classList.add("hidden");

    const welcome = document.getElementById("welcome-screen");
    const wName   = document.getElementById("welcome-name");
    const wAvatar = document.getElementById("welcome-avatar");
    const wInit   = document.getElementById("welcome-initials");
    const wGreet  = document.getElementById("welcome-greeting");

    if (welcome) {
      const displayName = user.displayName || "User";
      const firstName   = displayName.split(" ")[0];
      const initials    = displayName.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();

      if (wName)  wName.textContent  = firstName;
      if (wInit)  wInit.textContent  = initials;
      if (wGreet) wGreet.textContent = isFirstLogin ? "Welcome to SoundWave," : (UI.getGreeting() + ",");

      if (user.photoURL && wAvatar) {
        wAvatar.innerHTML =
          '<img src="' + user.photoURL + '" alt="" onerror="this.parentElement.innerHTML=\'' + initials + '\'">';
      }

      welcome.classList.remove("hidden");

      // 🎉 Confetti for first login
      if (isFirstLogin) {
        setTimeout(() => Confetti.start(4000), 500);
      }

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

    HomePage.isLoaded = false;

    HomePage.load().then(() => {
      if (loader) loader.classList.add("hidden");
      App.checkServerMode();

      if (State.currentUser && !State.isGuest) {
        setTimeout(() => UI.renderSidebarLibrary(), 500);
      }

      // ✅ Try to restore last session (auto-continue)
      setTimeout(() => {
        Player.restoreSession();
      }, 1000);
    });
  },

  checkServerMode() {
    setTimeout(() => {
      if (State.isGuest) {
        UI.showToast("Sign in to save your library 💚", "fas fa-info-circle", "blue");
      }
    }, 3500);
  },

  /* ═══════════════════════════════════════════════════════
     PWA INSTALL DISMISS
  ═══════════════════════════════════════════════════════ */
  dismissInstallPrompt() {
    const prompt = document.getElementById("install-prompt");
    if (prompt) prompt.classList.add("hidden");
    localStorage.setItem("install_dismissed", "1");
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
            searchInput.blur();
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
     GLOBAL CLICKS
  ═══════════════════════════════════════════════════════ */
  bindGlobalClicks() {
    document.addEventListener("click", (e) => {
      const searchWrap = document.querySelector(".search-wrap");
      if (searchWrap && !searchWrap.contains(e.target)) {
        Search.hideSuggestions();
      }
    });
  },

  /* ═══════════════════════════════════════════════════════
     SEARCH PAGE (Genres)
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

    const categoriesEl = document.getElementById("search-categories");
    if (categoriesEl) {
      categoriesEl.innerHTML =
        '<div class="section-header"><div><div class="section-title">Browse Categories</div></div></div>' +
        '<div class="cards-grid" style="grid-template-columns:repeat(auto-fill, minmax(140px,1fr));">' +
          genres.map(g =>
            '<div onclick="Search.executeFromSuggestion(\'' + g.name + ' music\')" ' +
              'class="genre-card stagger-item" ' +
              'style="background:linear-gradient(135deg,' + g.color + 'cc,' + g.color + '77);">' +
              g.name +
            '</div>'
          ).join("") +
        '</div>';
    }
  },
};
/* ═══════════════════════════════════════════════════════
   LANDING SCREEN — Toggle body class for nav hide
═══════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  document.body.classList.add("landing-active");

  // Observer to detect when landing hides
  const landing = document.getElementById("landing-screen");
  if (landing) {
    const observer = new MutationObserver(() => {
      if (landing.classList.contains("hidden")) {
        document.body.classList.remove("landing-active");
      } else {
        document.body.classList.add("landing-active");
      }
    });
    observer.observe(landing, { attributes: true, attributeFilter: ["class"] });
  }
});
/* ═══════════════════════════════════════════════════════
   START
═══════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  App.init().catch(err => console.error("App init error:", err));
});

/* ═══════════════════════════════════════════════════════
   HANDLE URL PARAMS (PWA shortcuts)
═══════════════════════════════════════════════════════ */
window.addEventListener("load", () => {
  const params = new URLSearchParams(window.location.search);
  const action = params.get("action");
  const playlist = params.get("playlist");

  if (action === "search") {
    setTimeout(() => UI.navigate("search"), 500);
  } else if (action === "library") {
    setTimeout(() => UI.navigate("library"), 500);
  } else if (playlist) {
    setTimeout(() => PlaylistManager.openPlaylist(playlist), 1000);
  }
});

/* ═══════════════════════════════════════════════════════
   HANDLE WINDOW UNLOAD (Save session)
═══════════════════════════════════════════════════════ */
window.addEventListener("beforeunload", () => {
  if (State.currentSong) {
    State.saveSession();
  }
});