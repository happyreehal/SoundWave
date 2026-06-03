/* ============================================================
   PLAYER.JS — Audio Engine
   + Auto-continue, Smart queue, Haptic, Stats
============================================================ */
const Player = {
  audio: new Audio(),
  progressDragging: false,
  volumeDragging: false,
  progressTimer: null,
  listenTimer: null,
  sessionTimer: null,
  _currentLoadId: 0,
  _lastTrackedSongId: null,

  /* ═══════════════════════════════════════════════════════
     INIT
  ═══════════════════════════════════════════════════════ */
  init() {
    this.audio.volume = State.volume;
    this.audio.crossOrigin = "anonymous";
    this.audio.preload = "auto";
    this.bindAudioEvents();
    this.bindUIEvents();
    this.startProgressLoop();
    this.startListenTracker();
    this.startSessionSaver();
    UI.updateVolumeUI(State.volume);
    this.setupMediaSession();
  },

  /* ═══════════════════════════════════════════════════════
     HAPTIC FEEDBACK (mobile vibration)
  ═══════════════════════════════════════════════════════ */
  haptic(pattern = 10) {
    if ("vibrate" in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {}
    }
  },

  /* ═══════════════════════════════════════════════════════
     MEDIA SESSION (Dynamic Island, Lock Screen)
  ═══════════════════════════════════════════════════════ */
  setupMediaSession() {
    if (!("mediaSession" in navigator)) return;

    navigator.mediaSession.setActionHandler("play",          () => this.togglePlay());
    navigator.mediaSession.setActionHandler("pause",         () => this.togglePlay());
    navigator.mediaSession.setActionHandler("nexttrack",     () => this.next());
    navigator.mediaSession.setActionHandler("previoustrack", () => this.prev());

    try {
      navigator.mediaSession.setActionHandler("seekbackward", (details) => {
        const skip = details.seekOffset || 10;
        this.audio.currentTime = Math.max(this.audio.currentTime - skip, 0);
      });
      navigator.mediaSession.setActionHandler("seekforward", (details) => {
        const skip = details.seekOffset || 10;
        this.audio.currentTime = Math.min(this.audio.currentTime + skip, this.audio.duration);
      });
      navigator.mediaSession.setActionHandler("seekto", (details) => {
        if (details.seekTime !== undefined) {
          this.audio.currentTime = details.seekTime;
        }
      });
    } catch (e) {}

    console.log("✅ Media Session active");
  },

  updateMediaSession(song) {
    if (!("mediaSession" in navigator) || !song) return;

    const artwork = song.artwork || "";
    const artworks = artwork ? [
      { src: artwork, sizes: "96x96",   type: "image/jpeg" },
      { src: artwork, sizes: "128x128", type: "image/jpeg" },
      { src: artwork, sizes: "192x192", type: "image/jpeg" },
      { src: artwork, sizes: "256x256", type: "image/jpeg" },
      { src: artwork, sizes: "384x384", type: "image/jpeg" },
      { src: artwork, sizes: "512x512", type: "image/jpeg" },
    ] : [];

    navigator.mediaSession.metadata = new MediaMetadata({
      title:  song.title  || "Unknown",
      artist: song.artist || "Unknown",
      album:  song.album  || "SoundWave Pro",
      artwork: artworks,
    });
  },

  updateMediaSessionState(playing) {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = playing ? "playing" : "paused";

    if (this.audio.duration && !isNaN(this.audio.duration)) {
      try {
        navigator.mediaSession.setPositionState({
          duration:     this.audio.duration,
          playbackRate: this.audio.playbackRate,
          position:     this.audio.currentTime,
        });
      } catch (e) {}
    }
  },

  /* ═══════════════════════════════════════════════════════
     AUDIO EVENTS
  ═══════════════════════════════════════════════════════ */
  bindAudioEvents() {
    const self = this;
    const a = this.audio;

    a.addEventListener("timeupdate", () => {
      if (self.progressDragging) return;
      State.currentTime = isNaN(a.currentTime) ? 0 : a.currentTime;
      State.duration    = isNaN(a.duration)    ? 0 : a.duration;
      self.updateAllProgress();
      Lyrics.highlightLine(State.currentTime);
    });

    a.addEventListener("loadedmetadata", () => {
      State.duration = isNaN(a.duration) ? 0 : a.duration;
      self.updateDurationLabel(State.duration);
      self.updateMediaSessionState(State.isPlaying);
    });

    a.addEventListener("ended", () => self.onEnded());

    a.addEventListener("waiting", () => self.showSpinner());
    a.addEventListener("playing", () => {
      self.hideSpinner();
      State.isPlaying = true;
      self.setPlayUI(true);
      self.updateMediaSessionState(true);
    });
    a.addEventListener("canplay", () => self.hideSpinner());
    a.addEventListener("play", () => {
      State.isPlaying = true;
      self.setPlayUI(true);
      self.hideSpinner();
      self.updateMediaSessionState(true);
    });
    a.addEventListener("pause", () => {
      State.isPlaying = false;
      self.setPlayUI(false);
      self.updateMediaSessionState(false);
    });

    a.addEventListener("error", () => {
      if (!a.src || a.src === window.location.href) return;
      if (a.error && a.error.code === MediaError.MEDIA_ERR_ABORTED) return;
      console.warn("Audio error:", a.error ? a.error.code : "unknown");
      self.hideSpinner();
      State.isPlaying = false;
      self.setPlayUI(false);
    });
  },

  /* ═══════════════════════════════════════════════════════
     PROGRESS LOOP (visual updates)
  ═══════════════════════════════════════════════════════ */
  startProgressLoop() {
    clearInterval(this.progressTimer);
    this.progressTimer = setInterval(() => {
      if (this.progressDragging) return;
      const cur = isNaN(this.audio.currentTime) ? 0 : this.audio.currentTime;
      const dur = isNaN(this.audio.duration)    ? 0 : this.audio.duration;
      if (dur > 0) {
        State.currentTime = cur;
        State.duration    = dur;
        this.updateAllProgress();
      }
    }, 300);
  },

  /* ═══════════════════════════════════════════════════════
     LISTEN TRACKER (for stats)
  ═══════════════════════════════════════════════════════ */
  startListenTracker() {
    clearInterval(this.listenTimer);
    this.listenTimer = setInterval(() => {
      if (State.isPlaying && State.currentSong) {
        State.trackListening(1);

        // Track song play (once per song, when 30 seconds played)
        if (this.audio.currentTime > 30 && this._lastTrackedSongId !== State.currentSong.id) {
          State.trackSongPlay(State.currentSong);
          this._lastTrackedSongId = State.currentSong.id;
        }
      }
    }, 1000);
  },

  /* ═══════════════════════════════════════════════════════
     SESSION SAVER (auto-continue)
  ═══════════════════════════════════════════════════════ */
  startSessionSaver() {
    clearInterval(this.sessionTimer);
    this.sessionTimer = setInterval(() => {
      if (State.currentSong && this.audio.currentTime > 5) {
        State.saveSession();
      }
    }, 5000);
  },

  /* ═══════════════════════════════════════════════════════
     UPDATE PROGRESS UI
  ═══════════════════════════════════════════════════════ */
  updateAllProgress() {
    const cur = State.currentTime || 0;
    const dur = State.duration || 0;
    const pct = dur > 0 ? Math.min((cur / dur) * 100, 100) : 0;

    document.querySelectorAll(".progress-fill").forEach(el => {
      el.style.width = pct.toFixed(2) + "%";
    });

    // Mini progress bar
    const miniFill = document.querySelector(".mini-progress-fill");
    if (miniFill) miniFill.style.width = pct.toFixed(2) + "%";

    document.querySelectorAll(".time-lbl.current").forEach(el => {
      el.textContent = UI.formatTime(cur);
    });
    if (dur > 0) {
      document.querySelectorAll(".time-lbl.total").forEach(el => {
        el.textContent = UI.formatTime(dur);
      });
    }
  },

  updateDurationLabel(dur) {
    document.querySelectorAll(".time-lbl.total").forEach(el => {
      el.textContent = UI.formatTime(dur);
    });
  },

  showSpinner() {
    document.querySelectorAll(".play-btn").forEach(btn => {
      btn.innerHTML =
        '<div style="width:16px;height:16px;border:2.5px solid rgba(0,0,0,0.15);border-top-color:#000;border-radius:50%;animation:spin 0.7s linear infinite;"></div>';
    });
  },

  hideSpinner() {
    this.setPlayUI(State.isPlaying);
  },

  /* ═══════════════════════════════════════════════════════
     UI EVENT BINDINGS
  ═══════════════════════════════════════════════════════ */
  bindUIEvents() {
    const self = this;

    document.addEventListener("click", (e) => {
      if (e.target.closest(".play-btn")) {
        e.preventDefault();
        e.stopPropagation();
        self.haptic(8);
        self.togglePlay();
      }
    });

    const btnNext    = document.getElementById("btn-next");
    const btnPrev    = document.getElementById("btn-prev");
    const btnShuffle = document.getElementById("btn-shuffle");
    const btnRepeat  = document.getElementById("btn-repeat");

    if (btnNext)    btnNext.addEventListener("click", (e) => { e.stopPropagation(); self.haptic(8); self.next(); });
    if (btnPrev)    btnPrev.addEventListener("click", (e) => { e.stopPropagation(); self.haptic(8); self.prev(); });
    if (btnShuffle) btnShuffle.addEventListener("click", () => { self.haptic(8); self.toggleShuffle(); });
    if (btnRepeat)  btnRepeat.addEventListener("click", () => { self.haptic(8); self.toggleRepeat(); });

    this.setupProgressBar();
    this.setupVolumeBar();

    document.querySelectorAll(".vol-icon").forEach(el => {
      el.addEventListener("click", () => self.toggleMute());
    });

    document.addEventListener("click", (e) => {
      if (e.target.closest(".like-btn")) {
        self.haptic([10, 50, 10]);
        self.toggleLike();
      }
    });
  },

  /* ═══════════════════════════════════════════════════════
     PROGRESS BAR
  ═══════════════════════════════════════════════════════ */
  setupProgressBar() {
    const self = this;
    const tracks = document.querySelectorAll(".progress-track");

    tracks.forEach(track => {
      track.addEventListener("click", (e) => {
        if (!self.progressDragging) self.seekFromEvent(e);
      });
      track.addEventListener("mousedown", (e) => {
        self.progressDragging = true;
        self.seekFromEvent(e, true);
        e.preventDefault();
      });

      track.addEventListener("touchstart", (e) => {
        self.progressDragging = true;
        self.seekFromTouch(e, true);
        e.preventDefault();
      }, { passive: false });

      track.addEventListener("touchmove", (e) => {
        if (!self.progressDragging) return;
        self.seekFromTouch(e, true);
        e.preventDefault();
      }, { passive: false });

      track.addEventListener("touchend", (e) => {
        if (!self.progressDragging) return;
        self.progressDragging = false;
        self.seekFromTouch(e);
      });

      track.addEventListener("mousemove", (e) => {
        const rect = track.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const tip = track.querySelector(".progress-tooltip");
        if (tip) {
          tip.textContent = UI.formatTime(pct * (State.duration || 0));
          tip.style.left = (pct * 100) + "%";
          tip.style.opacity = "1";
        }
      });

      track.addEventListener("mouseleave", () => {
        const tip = track.querySelector(".progress-tooltip");
        if (tip) tip.style.opacity = "0";
      });
    });

    document.addEventListener("mousemove", (e) => {
      if (!self.progressDragging) return;
      const track = document.querySelector(".progress-track");
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const time = pct * (State.duration || 0);
      document.querySelectorAll(".progress-fill").forEach(el => { el.style.width = (pct * 100) + "%"; });
      document.querySelectorAll(".time-lbl.current").forEach(el => { el.textContent = UI.formatTime(time); });
    });

    document.addEventListener("mouseup", (e) => {
      if (!self.progressDragging) return;
      self.progressDragging = false;
      self.seekFromEvent(e);
    });
  },

  seekFromTouch(e, previewOnly) {
    const track = e.currentTarget || document.querySelector(".progress-track");
    if (!track) return;
    const touch = e.touches ? e.touches[0] : (e.changedTouches ? e.changedTouches[0] : null);
    if (!touch) return;
    const rect = track.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
    const time = pct * (State.duration || 0);
    document.querySelectorAll(".progress-fill").forEach(el => { el.style.width = (pct * 100) + "%"; });
    document.querySelectorAll(".time-lbl.current").forEach(el => { el.textContent = UI.formatTime(time); });
    if (!previewOnly && State.duration > 0) {
      this.audio.currentTime = time;
      State.currentTime = time;
    }
  },

  seekFromEvent(e, previewOnly) {
    const track = e.currentTarget || e.target.closest(".progress-track");
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const time = pct * (State.duration || 0);
    document.querySelectorAll(".progress-fill").forEach(el => { el.style.width = (pct * 100) + "%"; });
    document.querySelectorAll(".time-lbl.current").forEach(el => { el.textContent = UI.formatTime(time); });
    if (!previewOnly && State.duration > 0) {
      this.audio.currentTime = time;
      State.currentTime = time;
    }
  },

  seekClick(e) {
    const track = e.currentTarget || e.target.closest(".progress-track");
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const time = pct * (State.duration || 0);
    if (State.duration > 0) {
      this.audio.currentTime = time;
      State.currentTime = time;
    }
  },

  /* ═══════════════════════════════════════════════════════
     VOLUME
  ═══════════════════════════════════════════════════════ */
  setupVolumeBar() {
    const self = this;
    const track = document.querySelector(".vol-track");
    if (!track) return;
    track.addEventListener("click", (e) => self.setVolumeFromEvent(e));
    track.addEventListener("mousedown", (e) => {
      self.volumeDragging = true;
      self.setVolumeFromEvent(e);
      e.preventDefault();
    });
    document.addEventListener("mousemove", (e) => {
      if (!self.volumeDragging) return;
      self.setVolumeFromEvent(e);
    });
    document.addEventListener("mouseup", () => { self.volumeDragging = false; });
  },

  setVolumeFromEvent(e) {
    const track = document.querySelector(".vol-track");
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    this.setVolume(pct);
  },

  setVolume(pct) {
    State.volume = pct;
    this.audio.volume = Math.max(0, Math.min(1, pct));
    State.isMuted = pct === 0;
    this.updateVolumeUI(pct);
    State.save();
  },

  toggleMute() {
    if (State.isMuted || State.volume === 0) {
      const vol = State.prevVolume > 0 ? State.prevVolume : 0.7;
      this.setVolume(vol);
      State.isMuted = false;
    } else {
      State.prevVolume = State.volume;
      this.setVolume(0);
      State.isMuted = true;
    }
  },

  updateVolumeUI(pct) {
    document.querySelectorAll(".vol-fill").forEach(el => { el.style.width = (pct * 100) + "%"; });
    document.querySelectorAll(".vol-icon i").forEach(icon => {
      if (pct === 0)      icon.className = "fas fa-volume-mute";
      else if (pct < 0.5) icon.className = "fas fa-volume-down";
      else                icon.className = "fas fa-volume-up";
    });
  },

  /* ═══════════════════════════════════════════════════════
     PLAY FROM REGISTRY (bug-fix helper)
     Always plays the correct song by ID
  ═══════════════════════════════════════════════════════ */
  playFromRegistry(songId) {
    const song = window.__songRegistry["s_" + songId];
    if (song) {
      this.playSong(song);
    } else {
      console.warn("Song not found in registry:", songId);
    }
  },

  /* ═══════════════════════════════════════════════════════
     PLAY SONG (main)
  ═══════════════════════════════════════════════════════ */
  async playSong(song, queueSongs) {
    if (!song) return;
    const loadId = ++this._currentLoadId;
    this._lastTrackedSongId = null; // Reset stats tracker

    if (queueSongs && queueSongs.length > 0) {
      State.queue = queueSongs;
      State.queueIndex = queueSongs.findIndex(s => s.id === song.id);
      if (State.queueIndex === -1) State.queueIndex = 0;
    } else {
      const idx = State.queue.findIndex(s => s.id === song.id);
      if (idx !== -1) State.queueIndex = idx;
      else {
        State.queue.push(song);
        State.queueIndex = State.queue.length - 1;
      }
    }

    this.audio.pause();
    this.audio.src = "";
    State.currentTime = 0;
    State.duration = 0;
    State.isPlaying = false;
    this.updateAllProgress();
    this.setPlayUI(false);
    this.showSpinner();

    UI.updateNowPlaying(song);
    State.addToRecent(song);
    UI.renderQueue();
    Lyrics.updateForSong(song);
    UI.updatePlayerBgColor(song);

    this.updateMediaSession(song);

    const url = await API.getPlayableUrl(song);
    if (loadId !== this._currentLoadId) return;

    if (!url) {
      this.hideSpinner();
      UI.showToast("No audio source found", "fas fa-exclamation-triangle", "yellow");
      return;
    }

    this.audio.src = url;
    this.audio.load();

    await new Promise((resolve) => {
      const onReady = () => {
        this.audio.removeEventListener("canplaythrough", onReady);
        this.audio.removeEventListener("error", onReady);
        resolve();
      };
      this.audio.addEventListener("canplaythrough", onReady, { once: true });
      this.audio.addEventListener("error", onReady, { once: true });
      setTimeout(resolve, 8000);
    });

    if (loadId !== this._currentLoadId) return;

    this.hideSpinner();

    try {
      const promise = this.audio.play();
      if (promise !== undefined) await promise;
      State.isPlaying = true;
      this.setPlayUI(true);
      this.updateMediaSessionState(true);
      console.log("▶ Playing:", song.title);
      UI.showToast("♪  " + song.title, "fas fa-music", "green");

      // Save session for auto-continue
      State.saveSession();
    } catch (err) {
      console.warn("Play error:", err.name, err.message);
      this.hideSpinner();
      if (err.name === "NotAllowedError") {
        State.isPlaying = false;
        this.setPlayUI(false);
        UI.showToast("Tap ▶ to start playing", "fas fa-hand-pointer", "yellow");
      } else if (err.name === "AbortError") {
        // ignore
      } else {
        UI.showToast("Could not play — Try next", "fas fa-exclamation", "red");
      }
    }
  },

  /* ═══════════════════════════════════════════════════════
     RESTORE LAST SESSION (auto-continue on refresh)
  ═══════════════════════════════════════════════════════ */
  async restoreSession() {
    const session = State.lastSession || State.loadSession();
    if (!session || !session.song) return false;

    console.log("📻 Restoring last session:", session.song.title);

    // Restore queue
    if (session.queue && session.queue.length > 0) {
      State.queue = session.queue;
      State.queueIndex = session.queueIndex || 0;
    }

    // Update UI but DON'T auto-play (browsers block autoplay)
    UI.updateNowPlaying(session.song);
    UI.renderQueue();
    Lyrics.updateForSong(session.song);
    UI.updatePlayerBgColor(session.song);
    this.updateMediaSession(session.song);

    // Set audio source (will need user interaction to play)
    try {
      const url = await API.getPlayableUrl(session.song);
      if (url) {
        this.audio.src = url;
        this.audio.load();

        // Try to seek to last position when metadata loads
        this.audio.addEventListener("loadedmetadata", () => {
          if (session.currentTime > 5) {
            this.audio.currentTime = session.currentTime;
            State.currentTime = session.currentTime;
            this.updateAllProgress();
          }
        }, { once: true });

        UI.showToast("📻 Tap play to continue", "fas fa-music", "blue");
        return true;
      }
    } catch (e) {
      console.warn("Restore failed:", e.message);
    }
    return false;
  },

  /* ═══════════════════════════════════════════════════════
     TOGGLE PLAY/PAUSE
  ═══════════════════════════════════════════════════════ */
  async togglePlay() {
    if (!State.currentSong) {
      if (State.queue.length > 0) await this.playSong(State.queue[0]);
      return;
    }
    if (State.isPlaying) {
      this.audio.pause();
    } else {
      if (!this.audio.src || this.audio.src === window.location.href) {
        await this.playSong(State.currentSong);
        return;
      }
      try {
        const promise = this.audio.play();
        if (promise !== undefined) await promise;
      } catch (err) {
        console.warn("Resume error:", err.message);
        if (err.name === "NotAllowedError") {
          UI.showToast("Tap anywhere first", "fas fa-hand-pointer", "yellow");
        }
      }
    }
  },

  /* ═══════════════════════════════════════════════════════
     NEXT / PREV
  ═══════════════════════════════════════════════════════ */
  next() {
    if (State.queue.length === 0) return;
    let nextIdx;
    if (State.isShuffle) {
      do { nextIdx = Math.floor(Math.random() * State.queue.length); }
      while (nextIdx === State.queueIndex && State.queue.length > 1);
    } else {
      nextIdx = (State.queueIndex + 1) % State.queue.length;
    }
    State.queueIndex = nextIdx;
    this.playSong(State.queue[nextIdx]);
  },

  prev() {
    if (State.queue.length === 0) return;
    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
      State.currentTime = 0;
      this.updateAllProgress();
      return;
    }
    const prevIdx = (State.queueIndex - 1 + State.queue.length) % State.queue.length;
    State.queueIndex = prevIdx;
    this.playSong(State.queue[prevIdx]);
  },

  /* ═══════════════════════════════════════════════════════
     ON ENDED (with smart queue auto-continue)
  ═══════════════════════════════════════════════════════ */
  async onEnded() {
    // Sleep timer "end of song" check
    if (State.sleepEndOfSong) {
      State.sleepEndOfSong = false;
      State.isPlaying = false;
      this.setPlayUI(false);
      UI.showToast("Sleep timer ended 😴", "fas fa-moon", "blue");
      return;
    }

    if (State.repeatMode === 2) {
      this.audio.currentTime = 0;
      this.audio.play().catch(() => {});
    } else if (State.repeatMode === 1) {
      this.next();
    } else {
      if (State.queueIndex + 1 < State.queue.length) {
        this.next();
      } else {
        // ✅ Smart queue: Auto-add similar songs when queue ends
        await this.autoExtendQueue();
      }
    }
  },

  /* Smart queue extension — adds similar songs */
  async autoExtendQueue() {
    if (!State.currentSong) {
      State.isPlaying = false;
      this.setPlayUI(false);
      return;
    }

    UI.showToast("Finding similar songs...", "fas fa-magic", "blue");

    try {
      const genre = State.currentSong.genre || "popular";
      const moreSongs = await API.search(genre + " hits", 10);

      if (moreSongs && moreSongs.length > 0) {
        // Filter out duplicates
        const existing = new Set(State.queue.map(s => s.id));
        const newSongs = moreSongs.filter(s => !existing.has(s.id));

        if (newSongs.length > 0) {
          State.queue = [...State.queue, ...newSongs];
          UI.renderQueue();
          this.next();
          return;
        }
      }
    } catch (e) {
      console.warn("Auto extend failed:", e.message);
    }

    State.isPlaying = false;
    this.setPlayUI(false);
    UI.showToast("Queue finished 🎵", "fas fa-check", "green");
  },

  /* ═══════════════════════════════════════════════════════
     SHUFFLE / REPEAT / LIKE
  ═══════════════════════════════════════════════════════ */
  toggleShuffle() {
    State.isShuffle = !State.isShuffle;
    document.querySelectorAll("#btn-shuffle, #fs-shuffle").forEach(btn => {
      if (btn) btn.classList.toggle("active", State.isShuffle);
    });
    UI.showToast(State.isShuffle ? "Shuffle On 🔀" : "Shuffle Off", "fas fa-random", "blue");
  },

  toggleRepeat() {
    State.repeatMode = (State.repeatMode + 1) % 3;
    const modes = [
      { icon: "fa-redo",     label: "Repeat Off",      active: false },
      { icon: "fa-redo",     label: "Repeat All 🔁",   active: true  },
      { icon: "fa-redo-alt", label: "Repeat One 🔂",   active: true  },
    ];
    const m = modes[State.repeatMode];
    document.querySelectorAll("#btn-repeat, #fs-repeat").forEach(btn => {
      if (!btn) return;
      btn.classList.toggle("active", m.active);
      btn.innerHTML = '<i class="fas ' + m.icon + '"></i>';
    });
    UI.showToast(m.label, "fas fa-redo", "blue");
  },

  toggleLike() {
    if (!State.currentSong) return;
    const id = State.currentSong.id;
    State.toggleLike(id);
    const liked = State.liked.has(id);
    UI.updateLikeBtn(liked);
    UI.refreshSongHeart(id);
    UI.showToast(
      liked ? "Added to Liked Songs 💚" : "Removed from Liked Songs",
      "fas fa-heart",
      liked ? "green" : "red"
    );
  },

  setPlayUI(playing) {
    document.querySelectorAll(".play-btn").forEach(btn => {
      if (!btn) return;
      btn.innerHTML = '<i class="fas ' + (playing ? "fa-pause" : "fa-play") + '"></i>';
      btn.classList.toggle("playing", playing);
    });
    const viz = document.querySelector(".mini-visualizer");
    if (viz) viz.style.display = playing ? "flex" : "none";
    if (State.currentSong) {
      document.title = (playing ? "▶ " : "⏸ ") + State.currentSong.title + " — SoundWave Pro";
    }
  },
};