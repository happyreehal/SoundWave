/* ============================================================
   FEATURES — EQ, Sleep, Lyrics, ContextMenu, Search,
              PlaylistManager, MiniPlayer
============================================================ */

/* ═══════════════════════════════════════════════════════
   EQUALIZER
═══════════════════════════════════════════════════════ */
const EQ = {
  BANDS: ["60Hz","170Hz","310Hz","600Hz","1kHz","3kHz","6kHz","12kHz","14kHz","16kHz"],
  PRESETS: {
    flat:       [0,0,0,0,0,0,0,0,0,0],
    bass:       [8,7,5,3,0,0,-1,-1,-1,-1],
    treble:     [-2,-1,0,0,1,3,5,6,7,8],
    vocal:      [-2,0,2,4,5,4,2,0,-1,-1],
    rock:       [5,3,1,0,-1,1,3,4,4,3],
    jazz:       [4,3,1,2,0,1,2,3,3,2],
    classical:  [5,4,3,2,0,-1,-1,0,2,4],
    electronic: [6,5,2,0,-2,2,4,5,4,3],
    pop:        [1,2,3,3,1,-1,-1,1,2,2],
    lounge:     [4,3,0,-1,-2,-1,0,2,3,4],
  },

  render() {
    const grid = document.getElementById("eq-grid");
    if (!grid) return;
    grid.innerHTML = this.BANDS.map((band, i) =>
      '<div class="eq-band">' +
        '<div class="eq-val" id="eq-val-' + i + '">' + (State.eqValues[i] >= 0 ? "+" : "") + State.eqValues[i] + 'dB</div>' +
        '<div class="eq-slider-wrap">' +
          '<input type="range" class="eq-slider" min="-12" max="12" value="' + State.eqValues[i] +
          '" oninput="EQ.updateBand(' + i + ', +this.value)" orient="vertical"/>' +
        '</div>' +
        '<div class="eq-label">' + band + '</div>' +
      '</div>'
    ).join("");
  },

  updateBand(i, val) {
    State.eqValues[i] = val;
    const el = document.getElementById("eq-val-" + i);
    if (el) el.textContent = (val >= 0 ? "+" : "") + val + "dB";
    document.querySelectorAll(".eq-preset").forEach(b => b.classList.remove("active"));
  },

  applyPreset(name, btn) {
    const preset = this.PRESETS[name];
    if (!preset) return;
    State.eqValues = [...preset];
    document.querySelectorAll(".eq-preset").forEach(b => b.classList.remove("active"));
    if (btn) btn.classList.add("active");
    this.render();
    UI.showToast("EQ: " + name.charAt(0).toUpperCase() + name.slice(1) + " 🎛️", "fas fa-sliders-h", "green");
  },

  reset() {
    State.eqValues = [...this.PRESETS.flat];
    this.render();
    const first = document.querySelector(".eq-preset");
    if (first) first.classList.add("active");
    UI.showToast("EQ reset", "fas fa-undo", "blue");
  },
};

/* ═══════════════════════════════════════════════════════
   SLEEP TIMER (with End of Song)
═══════════════════════════════════════════════════════ */
const SleepTimer = {
  interval: null,

  set(minutes, btn) {
    clearInterval(this.interval);
    State.sleepEndOfSong = false;
    State.sleepRemaining = minutes * 60;
    document.querySelectorAll(".sleep-opt").forEach(b => b.classList.remove("active"));
    if (btn) btn.classList.add("active");
    const countdown = document.getElementById("sleep-countdown");
    if (countdown) countdown.style.display = "block";

    this.interval = setInterval(() => {
      State.sleepRemaining--;
      this.updateDisplay();
      if (State.sleepRemaining <= 0) {
        clearInterval(this.interval);
        Player.audio.pause();
        State.isPlaying = false;
        UI.setPlayState(false);
        UI.showToast("Sleep timer ended. Goodnight! 😴", "fas fa-moon", "blue");
        closeModal("modal-sleep");
      }
    }, 1000);
    UI.showToast("Sleep timer: " + minutes + " min ⏰", "fas fa-moon", "blue");
  },

  setEndOfSong(btn) {
    clearInterval(this.interval);
    State.sleepRemaining = 0;
    State.sleepEndOfSong = true;
    document.querySelectorAll(".sleep-opt").forEach(b => b.classList.remove("active"));
    if (btn) btn.classList.add("active");
    const countdown = document.getElementById("sleep-countdown");
    if (countdown) countdown.style.display = "none";
    UI.showToast("Will stop after current song 😴", "fas fa-moon", "blue");
    closeModal("modal-sleep");
  },

  cancel() {
    clearInterval(this.interval);
    State.sleepRemaining = 0;
    State.sleepEndOfSong = false;
    document.querySelectorAll(".sleep-opt").forEach(b => b.classList.remove("active"));
    const countdown = document.getElementById("sleep-countdown");
    if (countdown) countdown.style.display = "none";
    UI.showToast("Sleep timer cancelled", "fas fa-times", "red");
  },

  updateDisplay() {
    const el = document.getElementById("sleep-time-display");
    if (!el) return;
    const m = Math.floor(State.sleepRemaining / 60).toString().padStart(2, "0");
    const s = (State.sleepRemaining % 60).toString().padStart(2, "0");
    el.textContent = m + ":" + s;
  },
};

/* ═══════════════════════════════════════════════════════
   LYRICS
═══════════════════════════════════════════════════════ */
const Lyrics = {
  _data: {},
  _currentSongId: null,
  _activeIndex: -1,
  _fetchTimeout: null,

  async updateForSong(song) {
    if (!song) return;

    const titleEl  = document.getElementById("lyrics-title");
    const artistEl = document.getElementById("lyrics-artist");
    if (titleEl)  titleEl.textContent  = song.title;
    if (artistEl) artistEl.textContent = song.artist;

    if (this._currentSongId === song.id && this._data[song.id]) {
      this.renderLines(this._data[song.id]);
      return;
    }

    this._currentSongId = song.id;
    this._activeIndex = -1;
    this.showLoading();

    if (this._fetchTimeout) clearTimeout(this._fetchTimeout);

    this._fetchTimeout = setTimeout(async () => {
      try {
        const lyrics = await API.getLyrics(song);
        if (this._currentSongId !== song.id) return;

        if (lyrics && lyrics.length > 0) {
          this._data[song.id] = lyrics;
          this.renderLines(lyrics);
        } else {
          this.showNoLyrics();
        }
      } catch (e) {
        this.showNoLyrics();
      }
    }, 500);
  },

  renderLines(lines) {
    const container = document.getElementById("lyrics-lines");
    if (!container) return;

    container.innerHTML = lines.map((line, i) =>
      '<div class="lyric-line" data-index="' + i + '" data-time="' + (line.time || 0) +
      '" onclick="Lyrics.seekTo(' + (line.time || 0) + ')">' +
      '<span>' + (line.text || "♪") + '</span></div>'
    ).join("");

    const fsPanel = document.getElementById("fs-lyrics");
    if (fsPanel && !fsPanel.classList.contains("hidden")) {
      const dst = document.getElementById("fs-lyrics-lines");
      if (dst) dst.innerHTML = container.innerHTML;
    }
  },

  highlightLine(currentTime) {
    if (!this._currentSongId) return;
    const lines = this._data[this._currentSongId];
    if (!lines || lines.length === 0) return;

    let activeIdx = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (currentTime >= lines[i].time) {
        activeIdx = i;
        break;
      }
    }

    if (activeIdx === this._activeIndex) return;
    this._activeIndex = activeIdx;

    ["lyrics-lines", "fs-lyrics-lines"].forEach(containerId => {
      const container = document.getElementById(containerId);
      if (!container) return;
      const allLines = container.querySelectorAll(".lyric-line");
      allLines.forEach((el, i) => {
        el.classList.remove("active", "passed");
        if (i < activeIdx) el.classList.add("passed");
        else if (i === activeIdx) el.classList.add("active");
      });
      if (activeIdx >= 0 && allLines[activeIdx]) {
        allLines[activeIdx].scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  },

  seekTo(time) {
    if (!isNaN(time) && time >= 0) {
      Player.audio.currentTime = time;
      State.currentTime = time;
    }
  },

  showLoading() {
    const html =
      '<div style="text-align:center;padding:40px 16px;color:var(--text-muted);">' +
        '<div class="spinner" style="margin:0 auto 12px;width:28px;height:28px;border-width:3px;"></div>' +
        '<div style="font-size:13px;">Loading lyrics...</div>' +
      '</div>';
    ["lyrics-lines", "fs-lyrics-lines"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = html;
    });
  },

  showNoLyrics() {
    const html =
      '<div style="text-align:center;padding:40px 16px;color:var(--text-muted);">' +
        '<i class="fas fa-music" style="font-size:32px;margin-bottom:12px;display:block;opacity:0.4;"></i>' +
        '<div style="font-size:14px;font-weight:600;margin-bottom:6px;">No lyrics available</div>' +
        '<div style="font-size:12px;opacity:0.6;">for this song</div>' +
      '</div>';
    ["lyrics-lines", "fs-lyrics-lines"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = html;
    });
  },
};

/* ═══════════════════════════════════════════════════════
   CONTEXT MENU (Bug-fixed — uses song object directly)
═══════════════════════════════════════════════════════ */
const ContextMenu = {
  currentSong: null,

  open(event, songIndex) {
    // Legacy method — kept for compatibility
    const song = State.queue[songIndex] || State.currentSong;
    this.openForSong(event, song?.id);
  },

  // ✅ NEW: Direct song ID based (fixes "Water → I Remember" bug)
  openForSong(event, songId) {
    event.preventDefault();
    event.stopPropagation();

    const song = window.__songRegistry["s_" + songId];
    if (!song) return;

    this.currentSong = song;

    const menu = document.getElementById("context-menu");
    if (!menu) return;
    menu.classList.remove("hidden");

    let x = event.clientX, y = event.clientY;
    if (event.touches && event.touches[0]) {
      x = event.touches[0].clientX;
      y = event.touches[0].clientY;
    }
    if (x + 220 > window.innerWidth)  x = window.innerWidth - 230;
    if (y + 280 > window.innerHeight) y = window.innerHeight - 290;
    menu.style.left = x + "px";
    menu.style.top  = y + "px";
  },

  close() {
    const menu = document.getElementById("context-menu");
    if (menu) menu.classList.add("hidden");
  },

  action(type) {
    this.close();
    const song = this.currentSong;
    if (!song) return;

    switch (type) {
      case "play":
        Player.playSong(song);
        break;
      case "queue":
        State.addToQueue(song);
        UI.renderQueue();
        UI.showToast("Added to queue", "fas fa-list-ul", "green");
        Player.haptic(10);
        break;
      case "like":
        State.toggleLike(song.id);
        UI.refreshSongHeart(song.id);
        UI.updateLikeBtn(State.liked.has(song.id));
        Player.haptic([10, 50, 10]);
        UI.showToast(
          State.liked.has(song.id) ? "Added to Liked Songs 💚" : "Removed",
          "fas fa-heart",
          State.liked.has(song.id) ? "green" : "red"
        );
        break;
      case "add-to-playlist":
        PlaylistManager.showAddToPlaylist(song);
        break;
      case "share":
        PlaylistManager.shareSong(song);
        break;
      case "itunes":
        if (song.itunesUrl) window.open(song.itunesUrl, "_blank");
        break;
      case "remove":
        const idx = State.queue.findIndex(s => s.id === song.id);
        if (idx !== -1) {
          State.removeFromQueue(idx);
          UI.renderQueue();
          UI.showToast("Removed from queue", "fas fa-trash", "red");
        }
        break;
    }
  },
};

document.addEventListener("click", (e) => {
  const menu = document.getElementById("context-menu");
  if (menu && !menu.contains(e.target)) ContextMenu.close();
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") ContextMenu.close(); });

/* ═══════════════════════════════════════════════════════
   LONG PRESS DETECTION (Mobile context menu)
═══════════════════════════════════════════════════════ */
const LongPress = {
  pressTimer: null,
  pressDuration: 500,
  startX: 0,
  startY: 0,

  init() {
    document.addEventListener("touchstart", (e) => {
      const target = e.target.closest("[data-id]");
      if (!target) return;

      const songId = target.dataset.id;
      if (!songId) return;

      this.startX = e.touches[0].clientX;
      this.startY = e.touches[0].clientY;

      this.pressTimer = setTimeout(() => {
        if (navigator.vibrate) navigator.vibrate(50);
        target.classList.add("long-pressing");

        // Show context menu
        ContextMenu.openForSong({
          preventDefault: () => {},
          stopPropagation: () => {},
          clientX: this.startX,
          clientY: this.startY,
        }, songId);

        setTimeout(() => target.classList.remove("long-pressing"), 300);
      }, this.pressDuration);
    }, { passive: true });

    document.addEventListener("touchmove", (e) => {
      if (!this.pressTimer) return;
      const dx = Math.abs(e.touches[0].clientX - this.startX);
      const dy = Math.abs(e.touches[0].clientY - this.startY);
      if (dx > 10 || dy > 10) {
        clearTimeout(this.pressTimer);
        this.pressTimer = null;
      }
    }, { passive: true });

    document.addEventListener("touchend", () => {
      clearTimeout(this.pressTimer);
      this.pressTimer = null;
      document.querySelectorAll(".long-pressing").forEach(el => el.classList.remove("long-pressing"));
    });

    document.addEventListener("touchcancel", () => {
      clearTimeout(this.pressTimer);
      this.pressTimer = null;
    });
  },
};

/* ═══════════════════════════════════════════════════════
   SEARCH (with suggestions + did you mean)
═══════════════════════════════════════════════════════ */
const Search = {
  debounceTimer: null,
  suggestTimer: null,
  currentQuery: "",

  async handleInput(value) {
    const query = value.trim();
    const clearBtn = document.querySelector(".search-clear");
    if (clearBtn) clearBtn.style.display = query ? "flex" : "none";

    clearTimeout(this.debounceTimer);
    clearTimeout(this.suggestTimer);

    if (!query) {
      this.hideSuggestions();
      UI.navigateTo("home");
      return;
    }

    this.suggestTimer = setTimeout(() => this.showSuggestions(query), 200);

    this.currentQuery = query;
    this.debounceTimer = setTimeout(() => {
      if (!UI.isMobile()) {
        UI.navigateTo("search");
        this.execute(query);
      }
    }, 400);
  },

  async showSuggestions(query) {
    const dropdown = document.getElementById("search-suggestions");
    if (!dropdown) return;

    let html = "";

    if (query.length < 2 && State.searchHistory.length > 0) {
      html += '<div class="suggestion-header">Recent Searches</div>';
      State.searchHistory.slice(0, 5).forEach(q => {
        html +=
          '<div class="suggestion-item" onclick="Search.executeFromSuggestion(\'' + UI.escHtml(q).replace(/'/g, "\\'") + '\')">' +
            '<div class="suggestion-icon"><i class="fas fa-history"></i></div>' +
            '<div class="suggestion-text"><div class="suggestion-title">' + UI.escHtml(q) + '</div></div>' +
          '</div>';
      });
      dropdown.innerHTML = html;
      dropdown.classList.remove("hidden");
      return;
    }

    if (query.length < 2) {
      this.hideSuggestions();
      return;
    }

    const results = await API.searchSuggestions(query, 6);
    if (!results || results.length === 0) {
      this.hideSuggestions();
      return;
    }

    html += '<div class="suggestion-header">Top Results</div>';
    results.forEach(s => {
      UI._registerSong(s);
      html +=
        '<div class="suggestion-item" onclick="Player.playFromRegistry(\'' + s.id + '\'); Search.hideSuggestions();">' +
          '<div class="suggestion-icon">' +
          (s.artwork ? '<img src="' + s.artwork + '" loading="lazy">' : '<i class="fas fa-music"></i>') +
          '</div>' +
          '<div class="suggestion-text">' +
            '<div class="suggestion-title">' + UI.escHtml(s.title) + '</div>' +
            '<div class="suggestion-sub">' + UI.escHtml(s.artist) + '</div>' +
          '</div>' +
          '<div class="suggestion-type">Song</div>' +
        '</div>';
    });

    dropdown.innerHTML = html;
    dropdown.classList.remove("hidden");
  },

  hideSuggestions() {
    const dropdown = document.getElementById("search-suggestions");
    if (dropdown) dropdown.classList.add("hidden");
  },

  executeFromSuggestion(query) {
    const input = document.getElementById("search-input");
    if (input) input.value = query;
    this.hideSuggestions();
    UI.navigateTo("search");
    this.execute(query);
  },

  async execute(query) {
    if (!query) return;

    State.addToSearchHistory(query);

    const resultsSection = document.getElementById("search-results");
    const categories = document.getElementById("search-categories");
    if (resultsSection) resultsSection.style.display = "block";
    if (categories) categories.style.display = "none";

    if (resultsSection) {
      resultsSection.innerHTML =
        '<div class="section-header"><div><div class="section-title">Searching...</div></div></div>' +
        '<div class="cards-grid">' + UI.renderSkeletonCards(6) + '</div>';
    }

    const songs = await API.search(query, 20);

    if (songs.length === 0) {
      // Fallback: search by first word
      const firstWord = query.split(" ")[0];
      const related = firstWord !== query ? await API.search(firstWord, 10) : [];

      if (related.length > 0) {
        const suggestion = related[0].artist;
        resultsSection.innerHTML =
          '<div class="did-you-mean">' +
            '<i class="fas fa-lightbulb" style="color:var(--accent);"></i>' +
            'Did you mean <strong onclick="Search.executeFromSuggestion(\'' + UI.escHtml(suggestion).replace(/'/g, "\\'") + '\')">' + UI.escHtml(suggestion) + '</strong>?' +
          '</div>' +
          '<div class="section-header">' +
            '<div><div class="section-title">Related Results</div></div>' +
          '</div>' +
          '<div class="cards-grid">' +
            related.slice(0, 6).map((s, i) => UI.renderCard(s, i, related)).join("") +
          '</div>' +
          '<div class="section-header" style="margin-top:8px;">' +
            '<div><div class="section-title">Songs</div></div>' +
          '</div>' +
          '<div class="song-list">' +
            '<div class="song-list-head"><span>#</span><span>Title</span><span>Album</span><span><i class="fas fa-clock"></i></span><span></span></div>' +
            related.map((s, i) => UI.renderSongRow(s, i)).join("") +
          '</div>';
      } else {
        resultsSection.innerHTML =
          '<div class="empty-state">' +
            '<i class="fas fa-search empty-icon"></i>' +
            '<h3>Nothing found</h3>' +
            '<p>Try different keywords</p>' +
          '</div>';
      }
      return;
    }

    State.queue = songs;

    // Check if we should show "Did you mean?"
    const didYouMean = await API.getDidYouMean(query, songs.length);
    let dymHtml = "";
    if (didYouMean) {
      dymHtml =
        '<div class="did-you-mean">' +
          '<i class="fas fa-lightbulb" style="color:var(--accent);"></i>' +
          'Did you mean <strong onclick="Search.executeFromSuggestion(\'' + UI.escHtml(didYouMean).replace(/'/g, "\\'") + '\')">' + UI.escHtml(didYouMean) + '</strong>?' +
        '</div>';
    }

    resultsSection.innerHTML =
      dymHtml +
      '<div class="section-header"><div><div class="section-title">Top Results for "' + UI.escHtml(query) + '"</div></div></div>' +
      '<div class="cards-grid">' +
        songs.slice(0, 6).map((s, i) => UI.renderCard(s, i, songs)).join("") +
      '</div>' +
      '<div class="section-header" style="margin-top:8px;">' +
        '<div><div class="section-title">Songs</div></div>' +
      '</div>' +
      '<div class="song-list">' +
        '<div class="song-list-head"><span>#</span><span>Title</span><span>Album</span><span><i class="fas fa-clock"></i></span><span></span></div>' +
        songs.slice(0, 20).map((s, i) => UI.renderSongRow(s, i)).join("") +
      '</div>';
  },

  clear() {
    const input = document.getElementById("search-input");
    if (input) input.value = "";
    const clearBtn = document.querySelector(".search-clear");
    if (clearBtn) clearBtn.style.display = "none";
    this.hideSuggestions();
    UI.navigateTo("home");
  },
};

/* ═══════════════════════════════════════════════════════
   MINI PLAYER (More menu / Bottom sheet)
═══════════════════════════════════════════════════════ */
const MiniPlayer = {
  _backdrop: null,

  openMore() {
    if (!State.currentSong) {
      UI.showToast("No song playing", "fas fa-info-circle", "blue");
      return;
    }

    Player.haptic(8);
    const song = State.currentSong;

    const titleEl  = document.getElementById("mini-more-title");
    const artistEl = document.getElementById("mini-more-artist");
    const thumbEl  = document.getElementById("mini-more-thumb");

    if (titleEl)  titleEl.textContent  = song.title;
    if (artistEl) artistEl.textContent = song.artist;
    if (thumbEl) {
      thumbEl.innerHTML = song.artwork
        ? '<img src="' + song.artwork + '" alt="">'
        : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:18px;background:var(--bg-elevated);">🎵</div>';
    }

    // Backdrop
    if (!this._backdrop) {
      this._backdrop = document.createElement("div");
      this._backdrop.className = "sheet-backdrop";
      this._backdrop.onclick = () => this.closeMore();
      document.body.appendChild(this._backdrop);
    } else {
      this._backdrop.style.display = "";
    }

    const sheet = document.getElementById("mini-more-menu");
    if (sheet) sheet.classList.remove("hidden");
  },

  closeMore() {
    const sheet = document.getElementById("mini-more-menu");
    if (sheet) sheet.classList.add("hidden");
    if (this._backdrop) this._backdrop.style.display = "none";
  },

  /* Actions */
  actionAddToPlaylist() {
    this.closeMore();
    if (!State.currentSong) return;
    PlaylistManager.showAddToPlaylist(State.currentSong);
  },

  actionAddToQueue() {
    this.closeMore();
    if (!State.currentSong) return;
    State.addToQueue(State.currentSong);
    UI.renderQueue();
    UI.showToast("Added to queue", "fas fa-list-ul", "green");
  },

  actionShare() {
    this.closeMore();
    if (!State.currentSong) return;
    PlaylistManager.shareSong(State.currentSong);
  },
};

/* ═══════════════════════════════════════════════════════
   PLAYLIST MANAGER (Full CRUD + Share + Rename + Delete)
═══════════════════════════════════════════════════════ */
const PlaylistManager = {
  pendingSong: null,
  renamingPlaylistId: null,
  openedPlaylistId: null,

  /* CREATE */
  createFromModal() {
    const input = document.getElementById("playlist-name-input");
    const name = input && input.value ? input.value.trim() : "";
    if (!name) {
      UI.showToast("Enter a playlist name", "fas fa-exclamation-circle", "yellow");
      return;
    }
    State.createPlaylist(name);
    if (input) input.value = "";
    closeModal("modal-playlist");
    UI.showToast('Playlist "' + name + '" created!', "fas fa-check", "green");
    if (State.currentPage === "library") UI.renderLibrary();
    UI.renderSidebarLibrary();
  },

  /* RENAME */
  startRename(id) {
    const pl = State.playlists.find(p => p.id === id);
    if (!pl) return;
    this.renamingPlaylistId = id;
    const input = document.getElementById("rename-playlist-input");
    if (input) input.value = pl.name;
    openModal("modal-rename-playlist");
  },

  renameFromModal() {
    const input = document.getElementById("rename-playlist-input");
    const newName = input && input.value ? input.value.trim() : "";
    if (!newName) {
      UI.showToast("Enter a new name", "fas fa-exclamation-circle", "yellow");
      return;
    }
    if (this.renamingPlaylistId) {
      State.renamePlaylist(this.renamingPlaylistId, newName);
      closeModal("modal-rename-playlist");
      UI.showToast("Playlist renamed", "fas fa-check", "green");

      if (State.currentPage === "library") {
        if (this.openedPlaylistId === this.renamingPlaylistId) {
          this.openPlaylist(this.renamingPlaylistId);
        } else {
          UI.renderLibrary();
        }
      }
      UI.renderSidebarLibrary();
    }
    this.renamingPlaylistId = null;
  },

  /* DELETE */
  confirmDelete(id) {
    const pl = State.playlists.find(p => p.id === id);
    if (!pl) return;
    if (confirm('Delete "' + pl.name + '"?\nThis cannot be undone.')) {
      State.deletePlaylist(id);
      UI.showToast("Playlist deleted", "fas fa-trash", "red");
      this.openedPlaylistId = null;
      UI.renderLibrary();
      UI.renderSidebarLibrary();
    }
  },

  /* OPEN (with responsive mobile layout) */
  openPlaylist(id) {
    const pl = State.playlists.find(p => p.id === id);
    if (!pl) return;
    const page = document.getElementById("page-library");
    if (!page) return;

    this.openedPlaylistId = id;
    UI.navigateTo("library");
    State.currentPage = "library";

    const coverClass = pl.coverGradient || "gradient-1";
    const coverHtml = pl.cover
      ? '<img src="' + pl.cover + '" alt="" loading="lazy">'
      : '<div>📁</div>';

    let html =
      '<button class="see-all" onclick="UI.renderLibrary()" style="margin-bottom:20px;">' +
        '<i class="fas fa-arrow-left"></i> Back to Library' +
      '</button>' +
      '<div class="playlist-detail-header">' +
        '<div class="playlist-detail-cover ' + coverClass + '">' + coverHtml + '</div>' +
        '<div class="playlist-detail-info">' +
          '<div class="playlist-detail-label">Playlist</div>' +
          '<div class="playlist-detail-title">' + UI.escHtml(pl.name) + '</div>' +
          '<div class="playlist-detail-meta">' + pl.songs.length + ' song' + (pl.songs.length !== 1 ? 's' : '') + '</div>' +
          '<div class="playlist-detail-actions">' +
            (pl.songs.length > 0
              ? '<button class="hero-play" onclick="PlaylistManager.playPlaylist(\'' + id + '\')"><i class="fas fa-play"></i> Play All</button>'
              : '') +
            '<button class="see-all" onclick="PlaylistManager.startRename(\'' + id + '\')"><i class="fas fa-edit"></i> Rename</button>' +
            '<button class="see-all" onclick="PlaylistManager.sharePlaylist(\'' + id + '\')"><i class="fas fa-share-alt"></i> Share</button>' +
            '<button class="see-all" onclick="PlaylistManager.confirmDelete(\'' + id + '\')" style="color:#ef4444;border-color:rgba(239,68,68,0.3);"><i class="fas fa-trash"></i></button>' +
          '</div>' +
        '</div>' +
      '</div>';

    if (pl.songs.length === 0) {
      html +=
        '<div class="empty-state">' +
          '<i class="fas fa-music empty-icon"></i>' +
          '<h3>This playlist is empty</h3>' +
          '<p>Add songs from anywhere using the menu</p>' +
          '<button class="empty-state-action" onclick="UI.navigate(\'home\')"><i class="fas fa-search"></i> Find Songs</button>' +
        '</div>';
    } else {
      html +=
        '<div class="song-list">' +
          '<div class="song-list-head"><span>#</span><span>Title</span><span>Album</span><span><i class="fas fa-clock"></i></span><span></span></div>';
      pl.songs.forEach((s, i) => {
        UI._registerSong(s);
        const active = State.currentSong && State.currentSong.id === s.id;
        html +=
          '<div class="song-row ' + (active ? "active" : "") + '" onclick="Player.playFromRegistry(\'' + s.id + '\')" data-id="' + s.id + '">' +
            '<div class="song-num">' +
              '<span class="song-num-text">' + (i + 1) + '</span>' +
              '<span class="song-play-btn"><i class="fas fa-play"></i></span>' +
            '</div>' +
            '<div class="song-info">' +
              '<div class="song-thumb">' +
              (s.artwork
                ? '<img src="' + s.artwork + '" loading="lazy">'
                : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:16px;background:var(--bg-elevated)">🎵</div>') +
              '</div>' +
              '<div>' +
                '<div class="song-name">' + UI.escHtml(s.title) + '</div>' +
                '<div class="song-artist">' + UI.escHtml(s.artist) + '</div>' +
              '</div>' +
            '</div>' +
            '<div class="song-album secondary truncate">' + UI.escHtml(s.album || "") + '</div>' +
            '<div class="song-duration">' + UI.formatTime(s.duration) + '</div>' +
            '<div class="song-heart" onclick="event.stopPropagation(); PlaylistManager.removeFromPlaylist(\'' + id + '\', \'' + s.id + '\')" style="color:#ef4444;" title="Remove from playlist">' +
              '<i class="fas fa-minus-circle"></i>' +
            '</div>' +
          '</div>';
      });
      html += '</div>';
    }

    page.innerHTML = html;
  },

  /* PLAY */
  playPlaylist(id) {
    const pl = State.playlists.find(p => p.id === id);
    if (!pl || pl.songs.length === 0) return;

    // Register all songs
    pl.songs.forEach(s => UI._registerSong(s));

    State.queue = [...pl.songs];
    State.queueIndex = 0;
    Player.playSong(pl.songs[0]);
  },

  playLikedSongs() {
    const liked = [...State.liked]
      .map(id => window.__songRegistry["s_" + id])
      .filter(Boolean);
    if (liked.length === 0) return;
    State.queue = [...liked];
    State.queueIndex = 0;
    Player.playSong(liked[0]);
  },

  /* ADD TO PLAYLIST */
  showAddToPlaylist(song) {
    this.pendingSong = song;
    const list = document.getElementById("playlist-select-list");
    if (!list) return;
    if (State.playlists.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);">No playlists yet.<br>Create one below!</div>';
    } else {
      list.innerHTML = State.playlists.map(pl => {
        const already = pl.songs.find(s => s.id === song.id);
        const grad = pl.coverGradient || "gradient-1";
        return (
          '<div class="ctx-item" onclick="PlaylistManager.addPendingToPlaylist(\'' + pl.id + '\')" style="padding:12px;">' +
            '<div class="playlist-cover ' + grad + '" style="width:36px;height:36px;font-size:18px;border-radius:6px;margin:0;flex-shrink:0;">📁</div>' +
            '<div style="flex:1;min-width:0;">' +
              '<div style="font-size:14px;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + UI.escHtml(pl.name) + '</div>' +
              '<div style="font-size:11px;color:var(--text-muted);">' + pl.songs.length + ' songs' + (already ? ' · Already added' : '') + '</div>' +
            '</div>' +
            (already ? '<i class="fas fa-check" style="color:var(--accent);"></i>' : '<i class="fas fa-plus" style="color:var(--text-muted);"></i>') +
          '</div>'
        );
      }).join("");
    }
    openModal("modal-add-to-playlist");
  },

  addPendingToPlaylist(playlistId) {
    if (!this.pendingSong) return;
    const added = State.addToPlaylist(playlistId, this.pendingSong);
    closeModal("modal-add-to-playlist");
    if (added) {
      UI.showToast("Added to playlist!", "fas fa-check", "green");
      Player.haptic([10, 50, 10]);
    } else {
      UI.showToast("Already in playlist", "fas fa-info-circle", "blue");
    }
    this.pendingSong = null;
    if (State.currentPage === "library") {
      if (this.openedPlaylistId) this.openPlaylist(this.openedPlaylistId);
      else UI.renderLibrary();
    }
    UI.renderSidebarLibrary();
  },

  /* REMOVE */
  removeFromPlaylist(playlistId, songId) {
    State.removeFromPlaylist(playlistId, songId);
    UI.showToast("Removed from playlist", "fas fa-minus-circle", "red");
    this.openPlaylist(playlistId);
    UI.renderSidebarLibrary();
  },

  /* SHARE */
  sharePlaylist(id) {
    const pl = State.playlists.find(p => p.id === id);
    if (!pl) return;
    const url = window.location.origin + window.location.pathname + "?playlist=" + id;
    UI.showShare(url, pl.name);
  },

  shareSong(song) {
    const url = song.itunesUrl || window.location.href;
    if (navigator.share) {
      navigator.share({
        title: song.title,
        text: song.title + " by " + song.artist,
        url: url,
      }).catch(() => {});
    } else {
      UI.showShare(url, song.title);
    }
  },
};