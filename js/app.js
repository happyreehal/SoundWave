/* ============================================================
   APP.JS — Fixed Version
   Fixes: Guest mode, fast loading, playlist manager,
          proper auth flow, landing screen integration
============================================================ */

function openModal(id) {
  var el = document.getElementById(id);
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
  var el = document.getElementById(id);
  if (el) el.classList.remove("open");
}

document.addEventListener("keydown", function(e) {
  if (e.target.tagName === "INPUT") return;
  switch (e.code) {
    case "Space": e.preventDefault(); Player.togglePlay(); break;
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
    case "ArrowUp": e.preventDefault(); Player.setVolume(Math.min(1, State.volume + 0.05)); break;
    case "ArrowDown": e.preventDefault(); Player.setVolume(Math.max(0, State.volume - 0.05)); break;
    case "KeyM": Player.toggleMute(); break;
    case "KeyL": Player.toggleLike(); break;
    case "KeyS": Player.toggleShuffle(); break;
    case "KeyR": Player.toggleRepeat(); break;
    case "Escape":
      document.querySelectorAll(".modal-overlay.open").forEach(function(m) { m.classList.remove("open"); });
      UI.closeFullscreen();
      break;
  }
});

const PlaylistManager = {
  pendingSong: null,

  createFromModal() {
    var input = document.getElementById("playlist-name-input");
    var name = input && input.value ? input.value.trim() : "";
    if (!name) {
      UI.showToast("Enter a playlist name", "fas fa-exclamation-circle", "yellow");
      return;
    }
    State.createPlaylist(name);
    if (input) input.value = "";
    closeModal("modal-playlist");
    UI.showToast('Playlist "' + name + '" created!', "fas fa-check", "green");
    if (State.currentPage === "library") UI.renderLibrary();
  },

  openPlaylist(id) {
    var pl = State.playlists.find(function(p) { return p.id === id; });
    if (!pl) return;
    var page = document.getElementById("page-library");
    if (!page) return;

    page.innerHTML = '<div class="section-header">' +
      '<div>' +
        '<div class="section-title">📁 ' + UI.escHtml(pl.name) + '</div>' +
        '<div class="section-sub">' + pl.songs.length + ' songs</div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;">' +
        '<button class="see-all" onclick="PlaylistManager.playPlaylist(\'' + id + '\')">' +
          '<i class="fas fa-play"></i> Play All' +
        '</button>' +
        '<button class="see-all" onclick="State.deletePlaylist(\'' + id + '\'); UI.renderLibrary(); UI.showToast(\'Playlist deleted\',\'fas fa-trash\',\'red\');" style="color:#ef4444;border-color:rgba(239,68,68,0.3);">' +
          '<i class="fas fa-trash"></i>' +
        '</button>' +
      '</div>' +
    '</div>' +
    (pl.songs.length === 0
      ? '<div class="no-results"><i class="fas fa-music"></i><h3>Empty playlist</h3><p>Add songs from the context menu</p></div>'
      : '<div class="song-list">' +
          '<div class="song-list-head"><span>#</span><span>Title</span><span>Album</span><span><i class="fas fa-clock"></i></span><span></span></div>' +
          pl.songs.map(function(s, i) { return UI.renderSongRow(s, i); }).join("") +
        '</div>') +
    '<button class="see-all" onclick="UI.renderLibrary()" style="margin-top:20px;">' +
      '<i class="fas fa-arrow-left"></i> Back to Library' +
    '</button>';
    State.currentPage = "library";
  },

  playPlaylist(id) {
    var pl = State.playlists.find(function(p) { return p.id === id; });
    if (!pl || pl.songs.length === 0) return;
    State.queue = [...pl.songs];
    State.queueIndex = 0;
    Player.playSong(pl.songs[0]);
  },

  showAddToPlaylist(song) {
    this.pendingSong = song;
    var list = document.getElementById("playlist-select-list");
    if (!list) return;
    if (State.playlists.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);">No playlists yet. Create one first!</div>';
    } else {
      list.innerHTML = State.playlists.map(function(pl) {
        return '<div class="ctx-item" onclick="PlaylistManager.addPendingToPlaylist(\'' + pl.id + '\')">' +
          '<i class="fas fa-list-ul"></i> ' + UI.escHtml(pl.name) + ' (' + pl.songs.length + ' songs)' +
        '</div>';
      }).join("");
    }
    openModal("modal-add-to-playlist");
  },

  addPendingToPlaylist(playlistId) {
    if (!this.pendingSong) return;
    State.addToPlaylist(playlistId, this.pendingSong);
    closeModal("modal-add-to-playlist");
    UI.showToast("Added to playlist!", "fas fa-check", "green");
    this.pendingSong = null;
    if (State.currentPage === "library") UI.renderLibrary();
  },
};

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
    var page = document.getElementById("page-home");
    if (!page) return;
    page.innerHTML = '<div class="section-header">' +
      '<div><div class="section-title">Good Evening 👋</div><div class="section-sub">Jump back in</div></div>' +
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
    '<div class="section-header"><div><div class="section-title">🔥 Trending Now</div></div>' +
      '<button class="see-all" onclick="Search.execute(\'trending hits 2024\')">See All</button>' +
    '</div>' +
    '<div class="cards-grid" id="trending-grid">' + UI.renderSkeletonCards(8) + '</div>' +
    '<div class="section-header"><div><div class="section-title">📊 Top Charts</div></div><button class="see-all">See All</button></div>' +
    '<div class="song-list">' +
      '<div class="song-list-head"><span>#</span><span>Title</span><span>Album</span><span><i class="fas fa-clock"></i></span><span></span></div>' +
      '<div id="charts-list">' + UI.renderSkeletonRows(8) + '</div>' +
    '</div>' +
    '<div class="section-header" style="margin-top:8px;"><div><div class="section-title">🆕 New Releases</div></div>' +
      '<button class="see-all" onclick="Search.execute(\'new music 2024\')">See All</button>' +
    '</div>' +
    '<div class="cards-grid" id="new-releases-grid">' + UI.renderSkeletonCards(8) + '</div>' +
    '<div class="section-header"><div><div class="section-title">🎤 Pop Hits</div></div>' +
      '<button class="see-all" onclick="Search.execute(\'pop hits 2024\')">See All</button>' +
    '</div>' +
    '<div class="cards-grid" id="pop-grid">' + UI.renderSkeletonCards(6) + '</div>' +
    '<div class="section-header"><div><div class="section-title">🎤 Hip-Hop & Rap</div></div>' +
      '<button class="see-all" onclick="Search.execute(\'hip hop 2024\')">See All</button>' +
    '</div>' +
    '<div class="cards-grid" id="hiphop-grid">' + UI.renderSkeletonCards(6) + '</div>';
  },

  async loadData() {
    try {
      var results = await Promise.all([
        API.search("trending hits 2024", 8),
        API.search("new music 2024", 8),
        API.search("pop hits 2024", 6),
        API.search("hip hop rap 2024", 6),
      ]);
      var trending = results[0];
      var newR = results[1];
      var pop = results[2];
      var hiphop = results[3];

      if (trending.length > 0) {
        var hero = trending[0];
        var hTitle = document.getElementById("hero-title");
        var hMeta = document.getElementById("hero-meta");
        var hBg = document.getElementById("hero-bg");
        if (hTitle) hTitle.textContent = hero.title;
        if (hMeta) hMeta.textContent = hero.artist + " • " + hero.album;
        if (hBg && hero.artwork) {
          hBg.style.backgroundImage = "url(" + hero.artwork + ")";
          hBg.style.backgroundSize = "cover";
          hBg.style.backgroundPosition = "center";
        }
        this.featuredSong = hero;
        this.featuredList = trending;
      }

      var qEl = document.getElementById("quick-grid");
      if (qEl && trending.length > 0) {
        qEl.innerHTML = trending.slice(0, 6).map(function(s) {
          var key = UI._registerSong(s);
          return '<div class="quick-item" onclick="Player.playSong(window.__songRegistry[\'s_' + s.id + '\'])">' +
            '<div class="quick-thumb">' +
              (s.artwork
                ? '<img src="' + s.artwork + '" alt="" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML=\'<<div style=width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:22px;background:var(--bg-elevated)>🎵</div>\'">'
                : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:22px;background:var(--bg-elevated)">🎵</div>') +
            '</div>' +
            '<div class="quick-title">' + UI.escHtml(s.title) + '</div>' +
            '<button class="quick-play"><i class="fas fa-play"></i></button>' +
          '</div>';
        }).join("");
      }

      State.queue = [...trending];
      State.queueIndex = -1;

      var tEl = document.getElementById("trending-grid");
      if (tEl) tEl.innerHTML = trending.map(function(s, i) { return UI.renderCard(s, i, trending); }).join("");

      var cEl = document.getElementById("charts-list");
      if (cEl) cEl.innerHTML = trending.map(function(s, i) { return UI.renderSongRow(s, i); }).join("");

      State.queue = [...State.queue, ...newR];
      var nEl = document.getElementById("new-releases-grid");
      if (nEl) nEl.innerHTML = newR.map(function(s, i) { return UI.renderCard(s, i, newR); }).join("");

      State.queue = [...State.queue, ...pop];
      var pEl = document.getElementById("pop-grid");
      if (pEl) pEl.innerHTML = pop.map(function(s, i) { return UI.renderCard(s, i, pop); }).join("");

      State.queue = [...State.queue, ...hiphop];
      var hEl = document.getElementById("hiphop-grid");
      if (hEl) hEl.innerHTML = hiphop.map(function(s, i) { return UI.renderCard(s, i, hiphop); }).join("");

      var seen = new Set();
      State.queue = State.queue.filter(function(s) {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      });

      UI.renderSidebarLibrary(trending.slice(0, 10));

    } catch (err) {
      console.error("Home load error:", err);
      UI.showToast("Could not load music — Check connection", "fas fa-exclamation-triangle", "red");
    }
  },

  playFeatured() {
    if (this.featuredSong) Player.playSong(this.featuredSong, this.featuredList);
  },
};

const App = {
  async init() {
    this.createParticles();
    Player.init();
    this.bindNav();
    this.bindTopbar();
    this.bindContextMenu();
    await this.loadSearchPage();
    FB.init();
  },

  enterAsGuest() {
    State.isGuest = true;
    State.currentUser = null;
    this.showApp();
    UI.showToast("Welcome, Guest! 🎵", "fas fa-user", "blue");
  },

  showApp() {
    var landing = document.getElementById("landing-screen");
    if (landing) landing.classList.add("hidden");
    var loader = document.getElementById("app-loader");
    if (loader) {
      loader.classList.remove("hidden");
      var app = document.getElementById("app");
      if (app) app.style.display = "";
    }
    HomePage.load().then(function() {
      if (loader) loader.classList.add("hidden");
      App.checkServerMode();
      if (State.currentUser && !State.isGuest) {
        setTimeout(function() { UI.renderSidebarLibrary(); }, 500);
      }
    });
  },

  createParticles() {
    var container = document.getElementById("particles");
    if (!container) return;
    for (var i = 0; i < 20; i++) {
      var p = document.createElement("div");
      p.className = "particle";
      p.style.left = Math.random() * 100 + "%";
      p.style.animationDelay = Math.random() * 8 + "s";
      p.style.animationDuration = (6 + Math.random() * 6) + "s";
      container.appendChild(p);
    }
  },

  checkServerMode() {
    var isServer = window.location.port === "3000";
    setTimeout(function() {
      if (isServer) {
        UI.showToast("🎵 Full song mode active!", "fas fa-music", "green");
      } else {
        UI.showToast("Welcome to SoundWave Pro! 🎵", "fas fa-music", "green");
        setTimeout(function() {
          UI.showToast("💡 Run: node server.js for full songs!", "fas fa-info-circle", "blue");
        }, 3000);
      }
    }, 1000);
  },

  bindNav() {
    document.querySelectorAll(".nav-item[data-page]").forEach(function(item) {
      item.addEventListener("click", function() {
        var page = item.dataset.page;
        UI.navigate(page);
        if (page === "search") {
          var si = document.getElementById("search-input");
          if (si) si.focus();
        }
      });
    });
    document.querySelectorAll(".right-tab").forEach(function(tab) {
      tab.addEventListener("click", function() { UI.switchRightPanel(tab.dataset.panel); });
    });
  },

  bindTopbar() {
    var searchInput = document.getElementById("search-input");
    if (searchInput) {
      searchInput.addEventListener("input", function(e) { Search.handleInput(e.target.value); });
      searchInput.addEventListener("focus", function() {
        if (!searchInput.value.trim()) UI.navigateTo("search");
      });
    }
    var sc = document.querySelector(".search-clear");
    if (sc) sc.addEventListener("click", function() { Search.clear(); });
  },

  bindContextMenu() {
    document.querySelectorAll(".ctx-item[data-action]").forEach(function(item) {
      item.addEventListener("click", function() { ContextMenu.action(item.dataset.action); });
    });
  },

  async loadSearchPage() {
    var page = document.getElementById("page-search");
    if (!page) return;
    var genres = [
      { name: "Pop", color: "#e74c3c" }, { name: "Hip-Hop", color: "#f39c12" },
      { name: "R&B", color: "#9b59b6" }, { name: "Rock", color: "#2c3e50" },
      { name: "Electronic", color: "#3498db" }, { name: "K-Pop", color: "#e91e63" },
      { name: "Jazz", color: "#795548" }, { name: "Classical", color: "#607d8b" },
      { name: "Latin", color: "#c0392b" }, { name: "Indie", color: "#27ae60" },
      { name: "Country", color: "#8d6e63" }, { name: "Bollywood", color: "#ff6b35" },
    ];
    page.innerHTML = '<div id="search-categories">' +
      '<div class="section-header"><div><div class="section-title">Browse Categories</div></div></div>' +
      '<div class="cards-grid" style="grid-template-columns:repeat(auto-fill, minmax(140px,1fr));">' +
        genres.map(function(g) {
          return '<div onclick="Search.execute(\'' + g.name + ' music\')" ' +
            'style="background:linear-gradient(135deg,' + g.color + 'cc,' + g.color + '77);border-radius:16px;padding:20px 14px;cursor:pointer;min-height:80px;display:flex;align-items:flex-end;font-size:16px;font-weight:800;color:#fff;transition:all 0.2s;" ' +
            'onmouseover="this.style.transform=\'scale(1.05)\'" onmouseout="this.style.transform=\'scale(1)\'">' +
            g.name +
          '</div>';
        }).join("") +
      '</div>' +
    '</div>' +
    '<div id="search-results" style="display:none;">' +
      '<div class="section-header"><div><div class="section-title" id="search-result-title">Top Results</div></div></div>' +
      '<div class="cards-grid" id="search-cards"></div>' +
      '<div class="section-header" style="margin-top:8px;"><div><div class="section-title">Songs</div></div></div>' +
      '<div class="song-list">' +
        '<div class="song-list-head"><span>#</span><span>Title</span><span>Album</span><span><i class="fas fa-clock"></i></span><span></span></div>' +
        '<div id="search-songs"></div>' +
      '</div>' +
    '</div>';
  },
};

document.addEventListener("DOMContentLoaded", function() {
  App.init().catch(function(err) { console.error("App init error:", err); });
});