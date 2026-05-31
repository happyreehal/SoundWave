/* ============================================================
   PLAYER.JS — Fixed Version
   Fixes: setLoadingUI(false) bug, spinner never clearing,
          play/pause state after load
============================================================ */
const Player = {
  audio:            new Audio(),
  progressDragging: false,
  volumeDragging:   false,
  progressTimer:    null,
  _currentLoadId:   0,

  /* ──────────────────────────────────────────────────────
     INIT
  ────────────────────────────────────────────────────── */
  init() {
    this.audio.volume      = State.volume;
    this.audio.crossOrigin = "anonymous";
    this.audio.preload     = "auto";
    this.bindAudioEvents();
    this.bindUIEvents();
    this.startProgressLoop();
  },

  /* ──────────────────────────────────────────────────────
     AUDIO EVENTS
  ────────────────────────────────────────────────────── */
  bindAudioEvents() {
    const a = this.audio;

    a.addEventListener("timeupdate", () => {
      if (this.progressDragging) return;
      State.currentTime = isNaN(a.currentTime) ? 0 : a.currentTime;
      State.duration    = isNaN(a.duration)    ? 0 : a.duration;
      this.updateAllProgress();
      Lyrics.highlightLine(State.currentTime);
    });

    a.addEventListener("loadedmetadata", () => {
      State.duration = isNaN(a.duration) ? 0 : a.duration;
      this.updateDurationLabel(State.duration);
    });

    a.addEventListener("ended", () => {
      this.onEnded();
    });

    a.addEventListener("waiting", () => {
      this.showSpinner();
    });

    a.addEventListener("playing", () => {
      this.hideSpinner();
      State.isPlaying = true;
      this.setPlayUI(true);
    });

    a.addEventListener("canplay", () => {
      this.hideSpinner();
    });

    a.addEventListener("error", () => {
      if (!a.src || a.src === window.location.href) return;
      if (a.error?.code === MediaError.MEDIA_ERR_ABORTED) return;
      console.warn("Audio error code:", a.error?.code);
      this.hideSpinner();
      State.isPlaying = false;
      this.setPlayUI(false);
    });

    a.addEventListener("play", () => {
      State.isPlaying = true;
      this.setPlayUI(true);
      this.hideSpinner();
    });

    a.addEventListener("pause", () => {
      State.isPlaying = false;
      this.setPlayUI(false);
    });
  },

  /* ──────────────────────────────────────────────────────
     PROGRESS LOOP — every 300ms
  ────────────────────────────────────────────────────── */
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

  /* ──────────────────────────────────────────────────────
     UPDATE PROGRESS UI
  ────────────────────────────────────────────────────── */
  updateAllProgress() {
    const cur = State.currentTime || 0;
    const dur = State.duration    || 0;
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

  /* ──────────────────────────────────────────────────────
     SPINNER HELPERS — FIXED
     Old setLoadingUI(false) had early return bug —
     spinner would never clear. Now split into two methods.
  ────────────────────────────────────────────────────── */
  showSpinner() {
    document.querySelectorAll(".play-btn").forEach(btn => {
      if (!btn) return;
      btn.innerHTML = `
        <div style="
          width:16px;height:16px;
          border:2.5px solid rgba(0,0,0,0.15);
          border-top-color:#000;
          border-radius:50%;
          animation:spin 0.7s linear infinite;">
        </div>`;
    });
  },

  hideSpinner() {
    // Restore correct icon based on current play state
    this.setPlayUI(State.isPlaying);
  },

  // Kept for any legacy calls
  setLoadingUI(loading) {
    if (loading) this.showSpinner();
    else         this.hideSpinner();
  },

  /* ──────────────────────────────────────────────────────
     BIND UI EVENTS
  ────────────────────────────────────────────────────── */
  bindUIEvents() {
    document.addEventListener("click", (e) => {
      if (e.target.closest(".play-btn")) {
        e.preventDefault();
        e.stopPropagation();
        this.togglePlay();
      }
    });

    document.getElementById("btn-next")
      ?.addEventListener("click", (e) => { e.stopPropagation(); this.next(); });

    document.getElementById("btn-prev")
      ?.addEventListener("click", (e) => { e.stopPropagation(); this.prev(); });

    document.getElementById("btn-shuffle")
      ?.addEventListener("click", () => this.toggleShuffle());

    document.getElementById("btn-repeat")
      ?.addEventListener("click", () => this.toggleRepeat());

    this.setupProgressBar();
    this.setupVolumeBar();

    document.querySelectorAll(".vol-icon").forEach(el => {
      el.addEventListener("click", () => this.toggleMute());
    });

    document.addEventListener("click", (e) => {
      if (e.target.closest(".like-btn")) this.toggleLike();
    });

    document.querySelector(".now-playing-art")
      ?.addEventListener("click", () => UI.openFullscreen());

    document.querySelector(".fs-close")
      ?.addEventListener("click", () => UI.closeFullscreen());
  },

  /* ──────────────────────────────────────────────────────
     PROGRESS BAR
  ────────────────────────────────────────────────────── */
  setupProgressBar() {
    const track = document.querySelector(".progress-track");
    if (!track) return;

    // Mouse events
    track.addEventListener("click", (e) => {
      if (!this.progressDragging) this.seekFromEvent(e);
    });

    track.addEventListener("mousedown", (e) => {
      this.progressDragging = true;
      this.seekFromEvent(e, true);
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!this.progressDragging) return;
      const rect = track.getBoundingClientRect();
      const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const time = pct * (State.duration || 0);
      document.querySelectorAll(".progress-fill").forEach(el => {
        el.style.width = (pct * 100) + "%";
      });
      document.querySelectorAll(".time-lbl.current").forEach(el => {
        el.textContent = UI.formatTime(time);
      });
    });

    document.addEventListener("mouseup", (e) => {
      if (!this.progressDragging) return;
      this.progressDragging = false;
      this.seekFromEvent(e);
    });

    // Touch events (mobile)
    track.addEventListener("touchstart", (e) => {
      this.progressDragging = true;
      this.seekFromTouch(e, true);
      e.preventDefault();
    }, { passive: false });

    track.addEventListener("touchmove", (e) => {
      if (!this.progressDragging) return;
      this.seekFromTouch(e, true);
      e.preventDefault();
    }, { passive: false });

    track.addEventListener("touchend", (e) => {
      if (!this.progressDragging) return;
      this.progressDragging = false;
      this.seekFromTouch(e);
    });

    track.addEventListener("mousemove", (e) => {
      const rect = track.getBoundingClientRect();
      const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const tip  = track.querySelector(".progress-tooltip");
      if (tip) {
        tip.textContent   = UI.formatTime(pct * (State.duration || 0));
        tip.style.left    = (pct * 100) + "%";
        tip.style.opacity = "1";
      }
    });

    track.addEventListener("mouseleave", () => {
      const tip = track.querySelector(".progress-tooltip");
      if (tip) tip.style.opacity = "0";
    });
  },

  seekFromTouch(e, previewOnly = false) {
    const track = document.querySelector(".progress-track");
    if (!track) return;
    const touch = e.touches?.[0] || e.changedTouches?.[0];
    if (!touch) return;
    const rect = track.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
    const time = pct * (State.duration || 0);

    document.querySelectorAll(".progress-fill").forEach(el => {
      el.style.width = (pct * 100) + "%";
    });
    document.querySelectorAll(".time-lbl.current").forEach(el => {
      el.textContent = UI.formatTime(time);
    });

    if (!previewOnly && State.duration > 0) {
      this.audio.currentTime = time;
      State.currentTime      = time;
    }
  },
seekClick(e) {
    const track = e.currentTarget || e.target.closest(".progress-track");
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const time = pct * (State.duration || 0);
    document.querySelectorAll(".progress-fill").forEach(el => {
      el.style.width = (pct * 100) + "%";
    });
    document.querySelectorAll(".time-lbl.current").forEach(el => {
      el.textContent = UI.formatTime(time);
    });
    if (State.duration > 0) {
      this.audio.currentTime = time;
      State.currentTime = time;
    }
  },

  /* ──────────────────────────────────────────────────────
     VOLUME BAR
  ────────────────────────────────────────────────────── */
  setupVolumeBar() {
    const track = document.querySelector(".vol-track");
    if (!track) return;

    track.addEventListener("click", (e) => this.setVolumeFromEvent(e));

    track.addEventListener("mousedown", (e) => {
      this.volumeDragging = true;
      this.setVolumeFromEvent(e);
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!this.volumeDragging) return;
      this.setVolumeFromEvent(e);
    });

    document.addEventListener("mouseup", () => {
      this.volumeDragging = false;
    });
  },

  setVolumeFromEvent(e) {
    const track = document.querySelector(".vol-track");
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    this.setVolume(pct);
  },

  /* ──────────────────────────────────────────────────────
     PLAY SONG — main function
  ────────────────────────────────────────────────────── */
  async playSong(song, queueSongs = null) {
    if (!song) return;

    const loadId = ++this._currentLoadId;

    // Update queue
    if (queueSongs && queueSongs.length > 0) {
      State.queue      = queueSongs;
      State.queueIndex = queueSongs.findIndex(s => s.id === song.id);
      if (State.queueIndex === -1) State.queueIndex = 0;
    } else {
      const idx = State.queue.findIndex(s => s.id === song.id);
      if (idx !== -1) {
        State.queueIndex = idx;
      } else {
        State.queue.push(song);
        State.queueIndex = State.queue.length - 1;
      }
    }

    // Stop current audio
    this.audio.pause();
    this.audio.src = "";

    // Reset state
    State.currentTime = 0;
    State.duration    = 0;
    State.isPlaying   = false;
    this.updateAllProgress();
    this.setPlayUI(false);
    this.showSpinner();

    // Update UI immediately
    UI.updateNowPlaying(song);
    State.addToRecent(song);
    UI.renderQueue();
    Lyrics.updateForSong(song);
    UI.updatePlayerBgColor(song);

    // Get stream URL
    const url = await API.getPlayableUrl(song);

    // Stale check — user may have clicked another song
    if (loadId !== this._currentLoadId) {
      console.log("Song changed — cancelling stale request");
      return;
    }

    if (!url) {
      this.hideSpinner();
      UI.showToast(
        "No audio source found — Try another song",
        "fas fa-exclamation-triangle",
        "yellow"
      );
      return;
    }

    console.log("Loading audio:", url.substring(0, 70) + "...");
    this.audio.src = url;
    this.audio.load();

    // Wait for audio ready (max 8s)
    await new Promise((resolve) => {
      const onReady = () => {
        this.audio.removeEventListener("canplaythrough", onReady);
        this.audio.removeEventListener("error",          onReady);
        resolve();
      };
      this.audio.addEventListener("canplaythrough", onReady, { once: true });
      this.audio.addEventListener("error",          onReady, { once: true });
      setTimeout(resolve, 8000);
    });

    // Final stale check
    if (loadId !== this._currentLoadId) {
      console.log("Song changed during load — aborting");
      return;
    }

    this.hideSpinner();

    // Play
    try {
      const promise = this.audio.play();
      if (promise !== undefined) await promise;

      State.isPlaying = true;
      this.setPlayUI(true);

      console.log("✅ Playing:", song.title);
      UI.showToast(
        "♪  " + song.title + "  —  " + song.artist,
        "fas fa-music",
        "green"
      );

    } catch (err) {
      console.warn("Play error:", err.name, err.message);
      this.hideSpinner();

      if (err.name === "NotAllowedError") {
        State.isPlaying = false;
        this.setPlayUI(false);
        UI.showToast(
          "Click ▶ button to start playing",
          "fas fa-hand-pointer",
          "yellow"
        );
      } else if (err.name === "AbortError") {
        console.log("Aborted — new song loading");
      } else {
        UI.showToast(
          "Could not play — Try next song",
          "fas fa-exclamation",
          "red"
        );
      }
    }
  },

  /* ──────────────────────────────────────────────────────
     TOGGLE PLAY / PAUSE
  ────────────────────────────────────────────────────── */
  async togglePlay() {
    if (!State.currentSong) {
      if (State.queue.length > 0) {
        await this.playSong(State.queue[0]);
      }
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
          UI.showToast(
            "Click anywhere first then try again",
            "fas fa-hand-pointer",
            "yellow"
          );
        }
      }
    }
  },

  /* ──────────────────────────────────────────────────────
     NEXT / PREV
  ────────────────────────────────────────────────────── */
  next() {
    if (State.queue.length === 0) return;
    let nextIdx;
    if (State.isShuffle) {
      do {
        nextIdx = Math.floor(Math.random() * State.queue.length);
      } while (nextIdx === State.queueIndex && State.queue.length > 1);
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
      State.currentTime      = 0;
      this.updateAllProgress();
      return;
    }
    const prevIdx = (State.queueIndex - 1 + State.queue.length) % State.queue.length;
    State.queueIndex = prevIdx;
    this.playSong(State.queue[prevIdx]);
  },

  /* ──────────────────────────────────────────────────────
     ON SONG ENDED
  ────────────────────────────────────────────────────── */
  onEnded() {
    if (State.repeatMode === 2) {
      this.audio.currentTime = 0;
      this.audio.play().catch(() => {});
    } else if (State.repeatMode === 1) {
      this.next();
    } else {
      if (State.queueIndex + 1 < State.queue.length) {
        this.next();
      } else {
        State.isPlaying = false;
        this.setPlayUI(false);
        UI.showToast("Queue finished 🎵", "fas fa-check", "green");
      }
    }
  },

  /* ──────────────────────────────────────────────────────
     VOLUME
  ────────────────────────────────────────────────────── */
  setVolume(pct) {
    State.volume      = pct;
    this.audio.volume = Math.max(0, Math.min(1, pct));
    State.isMuted     = pct === 0;
    this.updateVolumeUI(pct);
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
    document.querySelectorAll(".vol-fill").forEach(el => {
      el.style.width = (pct * 100) + "%";
    });
    document.querySelectorAll(".vol-icon i").forEach(icon => {
      icon.className =
        pct === 0   ? "fas fa-volume-mute" :
        pct < 0.5   ? "fas fa-volume-down" :
                      "fas fa-volume-up";
    });
  },

  /* ──────────────────────────────────────────────────────
     SHUFFLE & REPEAT
  ────────────────────────────────────────────────────── */
  toggleShuffle() {
    State.isShuffle = !State.isShuffle;
    document.querySelectorAll("#btn-shuffle").forEach(btn => {
      btn?.classList.toggle("active", State.isShuffle);
    });
    UI.showToast(
      State.isShuffle ? "Shuffle On 🔀" : "Shuffle Off",
      "fas fa-random",
      "blue"
    );
  },

  toggleRepeat() {
    State.repeatMode = (State.repeatMode + 1) % 3;
    const modes = [
      { icon: "fa-redo",     label: "Repeat Off",    active: false },
      { icon: "fa-redo",     label: "Repeat All 🔁", active: true  },
      { icon: "fa-redo-alt", label: "Repeat One 🔂", active: true  },
    ];
    const m = modes[State.repeatMode];
    document.querySelectorAll("#btn-repeat").forEach(btn => {
      if (!btn) return;
      btn.classList.toggle("active", m.active);
      btn.innerHTML = `<i class="fas ${m.icon}"></i>`;
    });
    UI.showToast(m.label, "fas fa-redo", "blue");
  },

  /* ──────────────────────────────────────────────────────
     LIKE
  ────────────────────────────────────────────────────── */
  toggleLike() {
    if (!State.currentSong) return;
    const id = State.currentSong.id;
    if (State.liked.has(id)) State.liked.delete(id);
    else                     State.liked.add(id);
    const liked = State.liked.has(id);
    UI.updateLikeBtn(liked);
    UI.showToast(
      liked ? "Added to Liked Songs 💚" : "Removed from Liked Songs",
      "fas fa-heart",
      liked ? "green" : "red"
    );
  },

  /* ──────────────────────────────────────────────────────
     UI SETTERS
  ────────────────────────────────────────────────────── */
  setPlayUI(playing) {
    document.querySelectorAll(".play-btn").forEach(btn => {
      if (!btn) return;
      btn.innerHTML = `<i class="fas ${playing ? "fa-pause" : "fa-play"}"></i>`;
      btn.classList.toggle("playing", playing);
    });

    const viz = document.querySelector(".mini-visualizer");
    if (viz) viz.style.display = playing ? "flex" : "none";

    if (State.currentSong) {
      document.title = playing
        ? `▶ ${State.currentSong.title} — SoundWave Pro`
        : `⏸ ${State.currentSong.title} — SoundWave Pro`;
    }
  },
};
