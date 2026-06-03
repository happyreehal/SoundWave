/* ============================================================
   PLAYER.JS — Audio Engine
   Added: Media Session API (Dynamic Island, Lock screen, Notifications)
============================================================ */
const Player = {
  audio: new Audio(),
  progressDragging: false,
  volumeDragging: false,
  progressTimer: null,
  _currentLoadId: 0,

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
    UI.updateVolumeUI(State.volume);
    this.setupMediaSession();
  },

  /* ═══════════════════════════════════════════════════════
     MEDIA SESSION API — Dynamic Island, Lock screen, Notifications
  ═══════════════════════════════════════════════════════ */
  setupMediaSession() {
    if (!("mediaSession" in navigator)) {
      console.log("Media Session API not supported");
      return;
    }

    navigator.mediaSession.setActionHandler("play", () => this.togglePlay());
    navigator.mediaSession.setActionHandler("pause", () => this.togglePlay());
    navigator.mediaSession.setActionHandler("nexttrack", () => this.next());
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
    } catch (e) {
      console.log("Some media session actions not supported");
    }

    console.log("✅ Media Session API active (Dynamic Island, Lock screen ready)");
  },

  /* Update Media Session metadata when song changes */
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
      title:  song.title  || "Unknown Title",
      artist: song.artist || "Unknown Artist",
      album:  song.album  || "SoundWave Pro",
      artwork: artworks,
    });
  },

  /* Update playback state for Media Session */
  updateMediaSessionState(playing) {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = playing ? "playing" : "paused";

    // Update position state (for scrubbing on lock screen)
    if (this.audio.duration && !isNaN(this.audio.duration)) {
      try {
        navigator.mediaSession.setPositionState({
          duration: this.audio.duration,
          playbackRate: this.audio.playbackRate,
          position: this.audio.currentTime,
        });
      } catch (e) { /* ignore */ }
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

    a.addEventListener("ended",   () => self.onEnded());
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

  updateAllProgress() {
    const cur = State.currentTime || 0;
    const dur = State.duration || 0;
    const pct = dur > 0 ? Math.min((cur / dur) * 100, 100) : 0;
    document.querySelectorAll(".progress-fill").forEach(el => {
      el.style.width = pct.toFixed(2) + "%";
    });
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
     UI EVENTS
  ═══════════════════════════════════════════════════════ */
  bindUIEvents() {
    const self = this;

    // Play button (delegated)
    document.addEventListener("click", (e) => {
      if (e.target.closest(".play-btn")) {
        e.preventDefault();
        e.stopPropagation();
        self.togglePlay();
      }
    });

    // Control buttons
    const btnNext    = document.getElementById("btn-next");
    const btnPrev    = document.getElementById("btn-prev");
    const btnShuffle = document.getElementById("btn-shuffle");
    const btnRepeat  = document.getElementById("btn-repeat");

    if (btnNext)    btnNext.addEventListener("click", (e) => { e.stopPropagation(); self.next(); });
    if (btnPrev)    btnPrev.addEventListener("click", (e) => { e.stopPropagation(); self.prev(); });
    if (btnShuffle) btnShuffle.addEventListener("click", () => self.toggleShuffle());
    if (btnRepeat)  btnRepeat.addEventListener("click", () => self.toggleRepeat());

    this.setupProgressBar();
    this.setupVolumeBar();

    document.querySelectorAll(".vol-icon").forEach(el => {
      el.addEventListener("click", () => self.toggleMute());
    });

    document.addEventListener("click", (e) => {
      if (e.target.closest(".like-btn")) self.toggleLike();
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
     PLAY SONG
  ═══════════════════════════════════════════════════════ */
  async playSong(song, queueSongs) {
    if (!song) return;
    const loadId = ++this._currentLoadId;

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

    // ✅ Update Media Session metadata (Dynamic Island, lock screen)
    this.updateMediaSession(song);

    const url = await API.getPlayableUrl(song);
    if (loadId !== this._currentLoadId) {
      console.log("Song changed — cancelling stale request");
      return;
    }

    if (!url) {
      this.hideSpinner();
      UI.showToast("No audio source found", "fas fa-exclamation-triangle", "yellow");
      return;
    }

    console.log("Loading audio:", url.substring(0, 70) + "...");
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

    if (loadId !== this._currentLoadId) {
      console.log("Song changed during load — aborting");
      return;
    }

    this.hideSpinner();

    try {
      const promise = this.audio.play();
      if (promise !== undefined) await promise;
      State.isPlaying = true;
      this.setPlayUI(true);
      this.updateMediaSessionState(true);
      console.log("▶ Playing:", song.title);
      UI.showToast("♪  " + song.title, "fas fa-music", "green");
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
     CONTROLS
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

  onEnded() {
    if (State.repeatMode === 2) {
      this.audio.currentTime = 0;
      this.audio.play().catch(() => {});
    } else if (State.repeatMode === 1) {
      this.next();
    } else {
      if (State.queueIndex + 1 < State.queue.length) this.next();
      else {
        State.isPlaying = false;
        this.setPlayUI(false);
        UI.showToast("Queue finished 🎵", "fas fa-check", "green");
      }
    }
  },

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