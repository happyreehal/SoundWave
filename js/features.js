/* ============================================================
   FEATURES — EQ, Sleep Timer, Lyrics, Context Menu, Search
============================================================ */
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
    var grid = document.getElementById("eq-grid");
    if (!grid) return;
    grid.innerHTML = this.BANDS.map(function(band, i) {
      return '<div class="eq-band">' +
        '<div class="eq-val" id="eq-val-' + i + '">' + (State.eqValues[i] >= 0 ? "+" : "") + State.eqValues[i] + 'dB</div>' +
        '<div class="eq-slider-wrap">' +
          '<input type="range" class="eq-slider" min="-12" max="12" value="' + State.eqValues[i] + '" oninput="EQ.updateBand(' + i + ', +this.value)" orient="vertical"/>' +
        '</div>' +
        '<div class="eq-label">' + band + '</div>' +
      '</div>';
    }).join("");
  },

  updateBand(i, val) {
    State.eqValues[i] = val;
    var el = document.getElementById("eq-val-" + i);
    if (el) el.textContent = (val >= 0 ? "+" : "") + val + "dB";
    document.querySelectorAll(".eq-preset").forEach(function(b) { b.classList.remove("active"); });
  },

  applyPreset(name, btn) {
    var preset = this.PRESETS[name];
    if (!preset) return;
    State.eqValues = [...preset];
    document.querySelectorAll(".eq-preset").forEach(function(b) { b.classList.remove("active"); });
    if (btn) btn.classList.add("active");
    this.render();
    UI.showToast("EQ: " + name.charAt(0).toUpperCase() + name.slice(1) + " 🎛️", "fas fa-sliders-h", "green");
  },

  reset() {
    State.eqValues = [...this.PRESETS.flat];
    this.render();
    var first = document.querySelector(".eq-preset");
    if (first) first.classList.add("active");
    UI.showToast("EQ reset", "fas fa-undo", "blue");
  },
};

const SleepTimer = {
  interval: null,

  set(minutes, btn) {
    clearInterval(this.interval);
    State.sleepRemaining = minutes * 60;
    document.querySelectorAll(".sleep-opt").forEach(function(b) { b.classList.remove("active"); });
    if (btn) btn.classList.add("active");
    var countdown = document.getElementById("sleep-countdown");
    if (countdown) countdown.style.display = "block";
    var self = this;
    this.interval = setInterval(function() {
      State.sleepRemaining--;
      self.updateDisplay();
      if (State.sleepRemaining <= 0) {
        clearInterval(self.interval);
        Player.audio.pause();
        State.isPlaying = false;
        UI.setPlayState(false);
        UI.showToast("Sleep timer ended. Goodnight! 😴", "fas fa-moon", "blue");
        closeModal("modal-sleep");
      }
    }, 1000);
    UI.showToast("Sleep timer: " + minutes + " min ⏰", "fas fa-moon", "blue");
  },

  cancel() {
    clearInterval(this.interval);
    State.sleepRemaining = 0;
    document.querySelectorAll(".sleep-opt").forEach(function(b) { b.classList.remove("active"); });
    var countdown = document.getElementById("sleep-countdown");
    if (countdown) countdown.style.display = "none";
    UI.showToast("Sleep timer cancelled", "fas fa-times", "red");
  },

  updateDisplay() {
    var el = document.getElementById("sleep-time-display");
    if (!el) return;
    var m = Math.floor(State.sleepRemaining / 60).toString().padStart(2, "0");
    var s = (State.sleepRemaining % 60).toString().padStart(2, "0");
    el.textContent = m + ":" + s;
  },
};

// ✅ LYRICS - Completely Fixed Version
const Lyrics = {
  _data: {},           // Song id → lyrics lines cache
  _currentSongId: null,
  _activeIndex: -1,
  _fetchTimeout: null,

  async updateForSong(song) {
    if (!song) return;

    // Title/artist update karo
    var titleEl  = document.getElementById("lyrics-title");
    var artistEl = document.getElementById("lyrics-artist");
    if (titleEl)  titleEl.textContent  = song.title;
    if (artistEl) artistEl.textContent = song.artist;

    // ✅ Same song dobara fetch mat karo
    if (this._currentSongId === song.id && this._data[song.id]) {
      this.renderLines(this._data[song.id]);
      return;
    }

    this._currentSongId = song.id;
    this._activeIndex   = -1;
    this.showLoading();

    // ✅ Cancel previous pending fetch
    if (this._fetchTimeout) clearTimeout(this._fetchTimeout);

    // ✅ 500ms wait - song load hone do pehle
    var self = this;
    this._fetchTimeout = setTimeout(async function() {
      try {
        var lyrics = await API.getLyrics(song);

        // ✅ Check karo same song hai abhi bhi
        if (self._currentSongId !== song.id) return;

        if (lyrics && lyrics.length > 0) {
          self._data[song.id] = lyrics;
          self.renderLines(lyrics);
          console.log("✅ Lyrics loaded:", lyrics.length, "lines");
        } else {
          // ✅ Placeholder nahi - sirf "not available" dikhao
          self.showNoLyrics();
        }
      } catch (e) {
        console.warn("Lyrics error:", e.message);
        self.showNoLyrics();
      }
    }, 500);
  },

  renderLines(lines) {
    var container = document.getElementById("lyrics-lines");
    if (!container) return;

    container.innerHTML = lines.map(function(line, i) {
      return '<div class="lyric-line" data-index="' + i + '" data-time="' + (line.time || 0) + '" ' +
        'onclick="Lyrics.seekTo(' + (line.time || 0) + ')">' +
        '<span>' + (line.text || "♪") + '</span>' +
      '</div>';
    }).join("");
  },

  // ✅ MAIN FIX - Proper sync
  highlightLine(currentTime) {
    if (!this._currentSongId) return;
    var lines = this._data[this._currentSongId];
    if (!lines || lines.length === 0) return;

    // ✅ Reverse loop - last matching line dhundo
    var activeIdx = -1;
    for (var i = lines.length - 1; i >= 0; i--) {
      if (currentTime >= lines[i].time) {
        activeIdx = i;
        break;
      }
    }

    // Same line → skip (performance optimization)
    if (activeIdx === this._activeIndex) return;
    this._activeIndex = activeIdx;

    // ✅ DOM update
    var allLines = document.querySelectorAll(".lyric-line");
    allLines.forEach(function(el, i) {
      el.classList.remove("active", "passed");
      if      (i < activeIdx)  el.classList.add("passed");
      else if (i === activeIdx) el.classList.add("active");
    });

    // ✅ Active line scroll into view
    if (activeIdx >= 0 && allLines[activeIdx]) {
      allLines[activeIdx].scrollIntoView({
        behavior: "smooth",
        block:    "center",
      });
    }
  },

  seekTo(time) {
    if (!isNaN(time) && time >= 0) {
      Player.audio.currentTime = time;
      State.currentTime = time;
    }
  },

  showLoading() {
    var container = document.getElementById("lyrics-lines");
    if (!container) return;
    container.innerHTML =
      '<div style="text-align:center;padding:40px 16px;color:var(--text-muted);">' +
        '<div class="spinner" style="margin:0 auto 12px;width:28px;height:28px;border-width:3px;"></div>' +
        '<div style="font-size:13px;">Loading lyrics...</div>' +
      '</div>';
  },

  showNoLyrics() {
    var container = document.getElementById("lyrics-lines");
    if (!container) return;
    container.innerHTML =
      '<div style="text-align:center;padding:40px 16px;color:var(--text-muted);">' +
        '<i class="fas fa-music" style="font-size:32px;margin-bottom:12px;display:block;opacity:0.4;"></i>' +
        '<div style="font-size:14px;font-weight:600;margin-bottom:6px;">No lyrics available</div>' +
        '<div style="font-size:12px;opacity:0.6;">for this song</div>' +
      '</div>';
  },
};

const ContextMenu = {
  songIndex: -1,
  currentSong: null,

  open(event, songIndex) {
    event.preventDefault();
    this.songIndex = songIndex;
    this.currentSong = State.queue[songIndex] || State.currentSong;
    var menu = document.getElementById("context-menu");
    if (!menu) return;
    menu.classList.remove("hidden");
    var x = event.clientX, y = event.clientY;
    if (x + 220 > window.innerWidth) x = window.innerWidth - 230;
    if (y + 260 > window.innerHeight) y = window.innerHeight - 270;
    menu.style.left = x + "px";
    menu.style.top  = y + "px";
  },

  close() {
    var menu = document.getElementById("context-menu");
    if (menu) menu.classList.add("hidden");
  },

  action(type) {
    this.close();
    var song = this.currentSong || State.queue[this.songIndex] || State.currentSong;
    if (!song) return;
    switch (type) {
      case "play":
        Player.playSong(song);
        break;
      case "queue":
        State.addToQueue(song);
        UI.renderQueue();
        UI.showToast("Added to queue: " + song.title, "fas fa-list-ul", "green");
        break;
      case "like":
        State.toggleLike(song.id);
        UI.updateLikeBtn(State.liked.has(song.id));
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
        if (navigator.share) {
          navigator.share({ title: song.title, text: song.title + " by " + song.artist, url: song.itunesUrl || location.href });
        } else {
          navigator.clipboard.writeText(song.itunesUrl || location.href).then(function() {
            UI.showToast("Link copied! 📋", "fas fa-copy", "green");
          });
        }
        break;
      case "itunes":
        window.open(song.itunesUrl, "_blank");
        break;
      case "remove":
        State.removeFromQueue(this.songIndex);
        UI.renderQueue();
        UI.showToast("Removed from queue", "fas fa-trash", "red");
        break;
    }
  },
};

document.addEventListener("click",   function()  { ContextMenu.close(); });
document.addEventListener("keydown", function(e) { if (e.key === "Escape") ContextMenu.close(); });

const Search = {
  debounceTimer: null,
  currentQuery:  "",

  async handleInput(value) {
    var query = value.trim();
    var clearBtn = document.querySelector(".search-clear");
    if (clearBtn) clearBtn.style.display = query ? "block" : "none";
    clearTimeout(this.debounceTimer);
    if (!query) { UI.navigateTo("home"); return; }
    UI.navigateTo("search");
    this.currentQuery = query;
    this.debounceTimer = setTimeout(function() { Search.execute(query); }, 400);
  },

  async execute(query) {
    var resultsSection = document.getElementById("search-results");
    var categories     = document.getElementById("search-categories");
    if (resultsSection) resultsSection.style.display = "block";
    if (categories)     categories.style.display     = "none";

    var cardsEl = document.getElementById("search-cards");
    var listEl  = document.getElementById("search-songs");
    if (cardsEl) cardsEl.innerHTML = UI.renderSkeletonCards(6);
    if (listEl)  listEl.innerHTML  = UI.renderSkeletonRows(5);

    var songs = await API.search(query, 20);

    if (songs.length === 0) {
      if (cardsEl) cardsEl.innerHTML = "";
      if (listEl) {
        listEl.innerHTML =
          '<div class="no-results">' +
            '<i class="fas fa-search"></i>' +
            '<h3>No results for "' + UI.escHtml(query) + '"</h3>' +
            '<p>Try different keywords or check spelling</p>' +
          '</div>';
      }
      return;
    }

    State.queue = songs;
    if (cardsEl) cardsEl.innerHTML = songs.slice(0, 6).map(function(s, i) { return UI.renderCard(s, i, songs); }).join("");
    if (listEl)  listEl.innerHTML  = songs.slice(0, 15).map(function(s, i) { return UI.renderSongRow(s, i); }).join("");
  },

  clear() {
    document.getElementById("search-input").value = "";
    var clearBtn = document.querySelector(".search-clear");
    if (clearBtn) clearBtn.style.display = "none";
    document.getElementById("search-results").style.display  = "none";
    document.getElementById("search-categories").style.display = "";
    UI.navigateTo("home");
  },
};