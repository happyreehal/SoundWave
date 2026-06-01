/* ============================================================
   PLAYER.JS — Fixed Version
   Fixes: Loading spinner, play/pause sync, error handling
============================================================ */
const Player = {
  audio: new Audio(),
  progressDragging: false,
  volumeDragging: false,
  progressTimer: null,
  _currentLoadId: 0,

  init() {
    this.audio.volume = State.volume;
    this.audio.crossOrigin = "anonymous";
    this.audio.preload = "auto";
    this.bindAudioEvents();
    this.bindUIEvents();
    this.startProgressLoop();
    UI.updateVolumeUI(State.volume);
  },

  bindAudioEvents() {
    var self = this;
    var a = this.audio;

    a.addEventListener("timeupdate", function() {
      if (self.progressDragging) return;
      State.currentTime = isNaN(a.currentTime) ? 0 : a.currentTime;
      State.duration = isNaN(a.duration) ? 0 : a.duration;
      self.updateAllProgress();
      Lyrics.highlightLine(State.currentTime);
    });

    a.addEventListener("loadedmetadata", function() {
      State.duration = isNaN(a.duration) ? 0 : a.duration;
      self.updateDurationLabel(State.duration);
    });

    a.addEventListener("ended", function() { self.onEnded(); });

    a.addEventListener("waiting", function() { self.showSpinner(); });
    a.addEventListener("playing", function() { self.hideSpinner(); State.isPlaying = true; self.setPlayUI(true); });
    a.addEventListener("canplay", function() { self.hideSpinner(); });
    a.addEventListener("play", function() { State.isPlaying = true; self.setPlayUI(true); self.hideSpinner(); });
    a.addEventListener("pause", function() { State.isPlaying = false; self.setPlayUI(false); });

    a.addEventListener("error", function() {
      if (!a.src || a.src === window.location.href) return;
      if (a.error && a.error.code === MediaError.MEDIA_ERR_ABORTED) return;
      console.warn("Audio error code:", a.error ? a.error.code : "unknown");
      self.hideSpinner();
      State.isPlaying = false;
      self.setPlayUI(false);
    });
  },

  startProgressLoop() {
    clearInterval(this.progressTimer);
    var self = this;
    this.progressTimer = setInterval(function() {
      if (self.progressDragging) return;
      var cur = isNaN(self.audio.currentTime) ? 0 : self.audio.currentTime;
      var dur = isNaN(self.audio.duration) ? 0 : self.audio.duration;
      if (dur > 0) {
        State.currentTime = cur;
        State.duration = dur;
        self.updateAllProgress();
      }
    }, 300);
  },

  updateAllProgress() {
    var cur = State.currentTime || 0;
    var dur = State.duration || 0;
    var pct = dur > 0 ? Math.min((cur / dur) * 100, 100) : 0;
    document.querySelectorAll(".progress-fill").forEach(function(el) { el.style.width = pct.toFixed(2) + "%"; });
    document.querySelectorAll(".time-lbl.current").forEach(function(el) { el.textContent = UI.formatTime(cur); });
    if (dur > 0) {
      document.querySelectorAll(".time-lbl.total").forEach(function(el) { el.textContent = UI.formatTime(dur); });
    }
  },

  updateDurationLabel(dur) {
    document.querySelectorAll(".time-lbl.total").forEach(function(el) { el.textContent = UI.formatTime(dur); });
  },

  showSpinner() {
    document.querySelectorAll(".play-btn").forEach(function(btn) {
      btn.innerHTML = '<div style="width:16px;height:16px;border:2.5px solid rgba(0,0,0,0.15);border-top-color:#000;border-radius:50%;animation:spin 0.7s linear infinite;"></div>';
    });
  },

  hideSpinner() {
    this.setPlayUI(State.isPlaying);
  },

  setLoadingUI(loading) {
    if (loading) this.showSpinner();
    else this.hideSpinner();
  },

  bindUIEvents() {
    var self = this;
    document.addEventListener("click", function(e) {
      if (e.target.closest(".play-btn")) {
        e.preventDefault();
        e.stopPropagation();
        self.togglePlay();
      }
    });

    var btnNext = document.getElementById("btn-next");
    var btnPrev = document.getElementById("btn-prev");
    var btnShuffle = document.getElementById("btn-shuffle");
    var btnRepeat = document.getElementById("btn-repeat");

    if (btnNext) btnNext.addEventListener("click", function(e) { e.stopPropagation(); self.next(); });
    if (btnPrev) btnPrev.addEventListener("click", function(e) { e.stopPropagation(); self.prev(); });
    if (btnShuffle) btnShuffle.addEventListener("click", function() { self.toggleShuffle(); });
    if (btnRepeat) btnRepeat.addEventListener("click", function() { self.toggleRepeat(); });

    this.setupProgressBar();
    this.setupVolumeBar();

    document.querySelectorAll(".vol-icon").forEach(function(el) {
      el.addEventListener("click", function() { self.toggleMute(); });
    });
    document.addEventListener("click", function(e) {
      if (e.target.closest(".like-btn")) self.toggleLike();
    });

    var npArt = document.querySelector(".now-playing-art");
    var fsClose = document.querySelector(".fs-close");
    if (npArt) npArt.addEventListener("click", function() { UI.openFullscreen(); });
    if (fsClose) fsClose.addEventListener("click", function() { UI.closeFullscreen(); });
  },

  setupProgressBar() {
    var self = this;
    var track = document.querySelector(".progress-track");
    if (!track) return;

    track.addEventListener("click", function(e) { if (!self.progressDragging) self.seekFromEvent(e); });
    track.addEventListener("mousedown", function(e) { self.progressDragging = true; self.seekFromEvent(e, true); e.preventDefault(); });

    document.addEventListener("mousemove", function(e) {
      if (!self.progressDragging) return;
      var rect = track.getBoundingClientRect();
      var pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      var time = pct * (State.duration || 0);
      document.querySelectorAll(".progress-fill").forEach(function(el) { el.style.width = (pct * 100) + "%"; });
      document.querySelectorAll(".time-lbl.current").forEach(function(el) { el.textContent = UI.formatTime(time); });
    });

    document.addEventListener("mouseup", function(e) {
      if (!self.progressDragging) return;
      self.progressDragging = false;
      self.seekFromEvent(e);
    });

    track.addEventListener("touchstart", function(e) { self.progressDragging = true; self.seekFromTouch(e, true); e.preventDefault(); }, { passive: false });
    track.addEventListener("touchmove", function(e) { if (!self.progressDragging) return; self.seekFromTouch(e, true); e.preventDefault(); }, { passive: false });
    track.addEventListener("touchend", function(e) { if (!self.progressDragging) return; self.progressDragging = false; self.seekFromTouch(e); });

    track.addEventListener("mousemove", function(e) {
      var rect = track.getBoundingClientRect();
      var pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      var tip = track.querySelector(".progress-tooltip");
      if (tip) {
        tip.textContent = UI.formatTime(pct * (State.duration || 0));
        tip.style.left = (pct * 100) + "%";
        tip.style.opacity = "1";
      }
    });
    track.addEventListener("mouseleave", function() {
      var tip = track.querySelector(".progress-tooltip");
      if (tip) tip.style.opacity = "0";
    });
  },

  seekFromTouch(e, previewOnly) {
    var track = document.querySelector(".progress-track");
    if (!track) return;
    var touch = e.touches ? e.touches[0] : (e.changedTouches ? e.changedTouches[0] : null);
    if (!touch) return;
    var rect = track.getBoundingClientRect();
    var pct = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
    var time = pct * (State.duration || 0);
    document.querySelectorAll(".progress-fill").forEach(function(el) { el.style.width = (pct * 100) + "%"; });
    document.querySelectorAll(".time-lbl.current").forEach(function(el) { el.textContent = UI.formatTime(time); });
    if (!previewOnly && State.duration > 0) { this.audio.currentTime = time; State.currentTime = time; }
  },

  seekFromEvent(e, previewOnly) {
    var track = e.currentTarget || e.target.closest(".progress-track");
    if (!track) return;
    var rect = track.getBoundingClientRect();
    var pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    var time = pct * (State.duration || 0);
    document.querySelectorAll(".progress-fill").forEach(function(el) { el.style.width = (pct * 100) + "%"; });
    document.querySelectorAll(".time-lbl.current").forEach(function(el) { el.textContent = UI.formatTime(time); });
    if (!previewOnly && State.duration > 0) { this.audio.currentTime = time; State.currentTime = time; }
  },

  seekClick(e) {
    var track = e.currentTarget || e.target.closest(".progress-track");
    if (!track) return;
    var rect = track.getBoundingClientRect();
    var pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    var time = pct * (State.duration || 0);
    document.querySelectorAll(".progress-fill").forEach(function(el) { el.style.width = (pct * 100) + "%"; });
    document.querySelectorAll(".time-lbl.current").forEach(function(el) { el.textContent = UI.formatTime(time); });
    if (State.duration > 0) { this.audio.currentTime = time; State.currentTime = time; }
  },

  setupVolumeBar() {
    var self = this;
    var track = document.querySelector(".vol-track");
    if (!track) return;
    track.addEventListener("click", function(e) { self.setVolumeFromEvent(e); });
    track.addEventListener("mousedown", function(e) { self.volumeDragging = true; self.setVolumeFromEvent(e); e.preventDefault(); });
    document.addEventListener("mousemove", function(e) { if (!self.volumeDragging) return; self.setVolumeFromEvent(e); });
    document.addEventListener("mouseup", function() { self.volumeDragging = false; });
  },

  setVolumeFromEvent(e) {
    var track = document.querySelector(".vol-track");
    if (!track) return;
    var rect = track.getBoundingClientRect();
    var pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    this.setVolume(pct);
  },

  async playSong(song, queueSongs) {
    if (!song) return;
    var loadId = ++this._currentLoadId;

    if (queueSongs && queueSongs.length > 0) {
      State.queue = queueSongs;
      State.queueIndex = queueSongs.findIndex(function(s) { return s.id === song.id; });
      if (State.queueIndex === -1) State.queueIndex = 0;
    } else {
      var idx = State.queue.findIndex(function(s) { return s.id === song.id; });
      if (idx !== -1) State.queueIndex = idx;
      else { State.queue.push(song); State.queueIndex = State.queue.length - 1; }
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

    var url = await API.getPlayableUrl(song);
    if (loadId !== this._currentLoadId) { console.log("Song changed — cancelling stale request"); return; }

    if (!url) {
      this.hideSpinner();
      UI.showToast("No audio source found — Try another song", "fas fa-exclamation-triangle", "yellow");
      return;
    }

    console.log("Loading audio:", url.substring(0, 70) + "...");
    this.audio.src = url;
    this.audio.load();

    await new Promise(function(resolve) {
      var onReady = function() {
        this.audio.removeEventListener("canplaythrough", onReady);
        this.audio.removeEventListener("error", onReady);
        resolve();
      }.bind(this);
      this.audio.addEventListener("canplaythrough", onReady, { once: true });
      this.audio.addEventListener("error", onReady, { once: true });
      setTimeout(resolve, 8000);
    }.bind(this));

    if (loadId !== this._currentLoadId) { console.log("Song changed during load — aborting"); return; }

    this.hideSpinner();

    try {
      var promise = this.audio.play();
      if (promise !== undefined) await promise;
      State.isPlaying = true;
      this.setPlayUI(true);
      console.log("Playing:", song.title);
      UI.showToast("♪  " + song.title + "  —  " + song.artist, "fas fa-music", "green");
    } catch (err) {
      console.warn("Play error:", err.name, err.message);
      this.hideSpinner();
      if (err.name === "NotAllowedError") {
        State.isPlaying = false;
        this.setPlayUI(false);
        UI.showToast("Click ▶ button to start playing", "fas fa-hand-pointer", "yellow");
      } else if (err.name === "AbortError") {
        console.log("Aborted — new song loading");
      } else {
        UI.showToast("Could not play — Try next song", "fas fa-exclamation", "red");
      }
    }
  },

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
        var promise = this.audio.play();
        if (promise !== undefined) await promise;
      } catch (err) {
        console.warn("Resume error:", err.message);
        if (err.name === "NotAllowedError") {
          UI.showToast("Click anywhere first then try again", "fas fa-hand-pointer", "yellow");
        }
      }
    }
  },

  next() {
    if (State.queue.length === 0) return;
    var nextIdx;
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
    var prevIdx = (State.queueIndex - 1 + State.queue.length) % State.queue.length;
    State.queueIndex = prevIdx;
    this.playSong(State.queue[prevIdx]);
  },

  onEnded() {
    if (State.repeatMode === 2) {
      this.audio.currentTime = 0;
      this.audio.play().catch(function() {});
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

  setVolume(pct) {
    State.volume = pct;
    this.audio.volume = Math.max(0, Math.min(1, pct));
    State.isMuted = pct === 0;
    this.updateVolumeUI(pct);
    State.save();
  },

  toggleMute() {
    if (State.isMuted || State.volume === 0) {
      var vol = State.prevVolume > 0 ? State.prevVolume : 0.7;
      this.setVolume(vol);
      State.isMuted = false;
    } else {
      State.prevVolume = State.volume;
      this.setVolume(0);
      State.isMuted = true;
    }
  },

  updateVolumeUI(pct) {
    document.querySelectorAll(".vol-fill").forEach(function(el) { el.style.width = (pct * 100) + "%"; });
    document.querySelectorAll(".vol-icon i").forEach(function(icon) {
      if (pct === 0) icon.className = "fas fa-volume-mute";
      else if (pct < 0.5) icon.className = "fas fa-volume-down";
      else icon.className = "fas fa-volume-up";
    });
  },

  toggleShuffle() {
    State.isShuffle = !State.isShuffle;
    document.querySelectorAll("#btn-shuffle").forEach(function(btn) {
      if (btn) btn.classList.toggle("active", State.isShuffle);
    });
    UI.showToast(State.isShuffle ? "Shuffle On 🔀" : "Shuffle Off", "fas fa-random", "blue");
  },

  toggleRepeat() {
    State.repeatMode = (State.repeatMode + 1) % 3;
    var modes = [
      { icon: "fa-redo", label: "Repeat Off", active: false },
      { icon: "fa-redo", label: "Repeat All 🔁", active: true },
      { icon: "fa-redo-alt", label: "Repeat One 🔂", active: true },
    ];
    var m = modes[State.repeatMode];
    document.querySelectorAll("#btn-repeat, #fs-repeat").forEach(function(btn) {
      if (!btn) return;
      btn.classList.toggle("active", m.active);
      btn.innerHTML = '<i class="fas ' + m.icon + '"></i>';
    });
    UI.showToast(m.label, "fas fa-redo", "blue");
  },

  toggleLike() {
    if (!State.currentSong) return;
    var id = State.currentSong.id;
    State.toggleLike(id);
    var liked = State.liked.has(id);
    UI.updateLikeBtn(liked);
    UI.showToast(liked ? "Added to Liked Songs 💚" : "Removed from Liked Songs", "fas fa-heart", liked ? "green" : "red");
  },

  setPlayUI(playing) {
    document.querySelectorAll(".play-btn").forEach(function(btn) {
      if (!btn) return;
      btn.innerHTML = '<i class="fas ' + (playing ? "fa-pause" : "fa-play") + '"></i>';
      btn.classList.toggle("playing", playing);
    });
    var viz = document.querySelector(".mini-visualizer");
    if (viz) viz.style.display = playing ? "flex" : "none";
    if (State.currentSong) {
      document.title = (playing ? "▶ " : "⏸ ") + State.currentSong.title + " — SoundWave Pro";
    }
  },
};