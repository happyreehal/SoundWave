/* ============================================================
   UI.JS — Fixed Version
   Fix: renderCard / renderSongRow onclick no longer embeds
        raw JSON in HTML attributes (quote-breaking bug).
        Songs stored in window.__songRegistry, referenced by key.
============================================================ */

// Global song registry — avoids JSON-in-onclick quote issues
window.__songRegistry = {};

const UI = {

  // ── Toast ────────────────────────────────────────────────
  showToast(msg, icon = "fas fa-info-circle", type = "blue") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast     = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `<i class="${icon} toast-icon ${type}"></i><span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add("removing");
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  // ── Format Time ──────────────────────────────────────────
  formatTime(sec = 0) {
    const s = Math.floor(sec);
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  },

  // ── Navigate ─────────────────────────────────────────────
  navigateTo(page) {
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    const target = document.getElementById(`page-${page}`);
    if (target) target.classList.add("active");
    State.currentPage = page;

    document.querySelectorAll(".nav-item").forEach(n => {
      n.classList.toggle("active", n.dataset.page === page);
    });

    document.getElementById("content-area").scrollTop = 0;
  },

  // ── Now Playing Update ───────────────────────────────────
  updateNowPlaying(song) {
    const artEl    = document.querySelector(".now-playing-art");
    const titleEl  = document.querySelector(".np-title");
    const artistEl = document.querySelector(".np-artist");

    if (artEl) {
      artEl.innerHTML = song.artwork
        ? `<img src="${song.artwork}" alt="${this.escHtml(song.title)}" onerror="this.parentElement.innerHTML='<div class=art-placeholder>🎵</div>'">`
        : `<div class="art-placeholder">🎵</div>`;
    }

    if (titleEl)  titleEl.textContent  = song.title;
    if (artistEl) artistEl.textContent = song.artist;

    if (song.duration) this.updateDuration(song.duration);

    const fill = document.querySelector(".progress-fill");
    if (fill) fill.style.width = "0%";

    const curEl = document.querySelector(".time-lbl.current");
    if (curEl) curEl.textContent = "0:00";

    this.updateLikeBtn(State.liked.has(song.id));

    // Fullscreen
    const fsTitle  = document.querySelector(".fs-title");
    const fsArtist = document.querySelector(".fs-artist");
    const fsArt    = document.querySelector(".fs-art");
    const fsBg     = document.querySelector(".fs-blur-art");
    if (fsTitle)  fsTitle.textContent  = song.title;
    if (fsArtist) fsArtist.textContent = song.artist;
    if (fsArt && song.artwork)
      fsArt.innerHTML = `<img src="${song.artwork}" alt="${this.escHtml(song.title)}">`;
    if (fsBg && song.artwork)
      fsBg.style.backgroundImage = `url(${song.artwork})`;

    document.title = `${song.title} — SoundWave Pro`;
  },

  updateDuration(sec) {
    const el = document.querySelector(".time-lbl.total");
    if (el) el.textContent = this.formatTime(sec);
  },

  // ── Play State ───────────────────────────────────────────
  setPlayState(playing) {
    document.querySelectorAll(".play-btn").forEach(btn => {
      btn.innerHTML = `<i class="fas ${playing ? "fa-pause" : "fa-play"}"></i>`;
      btn.classList.toggle("playing", playing);
    });
    const viz = document.querySelector(".mini-visualizer");
    if (viz) viz.style.display = playing ? "flex" : "none";
  },

  // ── Volume UI ────────────────────────────────────────────
  updateVolumeUI(pct) {
    const fill = document.querySelector(".vol-fill");
    if (fill) fill.style.width = (pct * 100) + "%";
    const icon = document.querySelector(".vol-icon i");
    if (!icon) return;
    if (pct === 0)       icon.className = "fas fa-volume-mute";
    else if (pct < 0.5)  icon.className = "fas fa-volume-down";
    else                 icon.className = "fas fa-volume-up";
  },

  // ── Like Button ──────────────────────────────────────────
  updateLikeBtn(liked) {
    document.querySelectorAll(".like-btn, #btn-like").forEach(btn => {
      btn.innerHTML   = `<i class="${liked ? "fas" : "far"} fa-heart"></i>`;
      btn.style.color = liked ? "var(--accent)" : "";
    });
  },

  // ── Player Background Color ──────────────────────────────
  updatePlayerBgColor(song) {
    const bar = document.getElementById("player-bar");
    if (!bar || !song.artwork) return;
    const colors = {
      "Pop":        "#e74c3c22", "Hip-Hop":    "#f39c1222",
      "R&B":        "#9b59b622", "Rock":       "#2c3e5022",
      "Electronic": "#3498db22", "K-Pop":      "#e91e6322",
      "Jazz":       "#79554822", "Classical":  "#607d8b22",
      "Indie":      "#27ae6022",
    };
    const color = colors[song.genre] || "rgba(29,185,84,0.1)";
    bar.style.background     = `linear-gradient(to right, ${color}, transparent)`;
    bar.style.borderTopColor = color.replace("22", "44");
  },

  /* ──────────────────────────────────────────────────────
     REGISTER SONG — stores song in registry, returns key
     Used by renderCard / renderSongRow to avoid embedding
     raw JSON in HTML onclick attributes (quote-break fix)
  ────────────────────────────────────────────────────── */
  _registerSong(song) {
    const key = "s_" + song.id;
    window.__songRegistry[key] = song;
    return key;
  },

  // ── Render Song Card ─────────────────────────────────────
  renderCard(song, index, songs) {
    // Register all songs in the list for context menu too
    if (songs) songs.forEach(s => this._registerSong(s));
    const key   = this._registerSong(song);
    const liked = State.liked.has(song.id);

    return `
      <div class="card stagger-item"
           onclick="Player.playSong(window.__songRegistry['${key}'])"
           oncontextmenu="ContextMenu.open(event, ${index})"
           data-id="${song.id}">
        <div class="card-thumb">
          ${song.artwork
            ? `<img src="${song.artwork}" alt="${this.escHtml(song.title)}" loading="lazy">`
            : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:40px;background:var(--bg-elevated)">🎵</div>`
          }
          ${song.explicit ? `<div class="card-badge">E</div>` : ""}
        </div>
        <div class="card-title">${this.escHtml(song.title)}</div>
        <div class="card-sub">${this.escHtml(song.artist)}</div>
        <button class="card-play"
                onclick="event.stopPropagation(); Player.playSong(window.__songRegistry['${key}'])">
          <i class="fas fa-play"></i>
        </button>
      </div>
    `;
  },

  // ── Render Song Row ──────────────────────────────────────
  renderSongRow(song, index) {
    const key    = this._registerSong(song);
    const liked  = State.liked.has(song.id);
    const active = State.currentSong?.id === song.id;

    return `
      <div class="song-row ${active ? "active" : ""}"
           onclick="Player.playSong(window.__songRegistry['${key}'])"
           oncontextmenu="ContextMenu.open(event, ${index})"
           data-id="${song.id}">
        <div class="song-num">
          <span class="song-num-text">${index + 1}</span>
          <span class="song-play-btn"><i class="fas ${active ? "fa-pause" : "fa-play"}"></i></span>
        </div>
        <div class="song-info">
          <div class="song-thumb">
            ${song.artwork
              ? `<img src="${song.artwork}" alt="${this.escHtml(song.title)}" loading="lazy">`
              : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:16px;background:var(--bg-elevated)">🎵</div>`
            }
          </div>
          <div>
            <div class="song-name">${this.escHtml(song.title)}</div>
            <div class="song-artist">${this.escHtml(song.artist)}</div>
          </div>
        </div>
        <div class="song-album secondary truncate">${this.escHtml(song.album || "")}</div>
        <div class="song-duration">${this.formatTime(song.duration)}</div>
        <div class="song-heart ${liked ? "liked" : ""}"
             onclick="event.stopPropagation();
                      State.toggleLike('${song.id}');
                      this.classList.toggle('liked', State.liked.has('${song.id}'));
                      this.innerHTML = State.liked.has('${song.id}')
                        ? '<i class=\\'fas fa-heart\\'></i>'
                        : '<i class=\\'far fa-heart\\'></i>'">
          <i class="${liked ? "fas" : "far"} fa-heart"></i>
        </div>
      </div>
    `;
  },

  // ── Render Queue ─────────────────────────────────────────
  renderQueue() {
    const scroll = document.querySelector(".queue-scroll");
    if (!scroll) return;

    if (State.queue.length === 0) {
      scroll.innerHTML = `
        <div style="text-align:center;padding:40px 16px;color:var(--text-muted);">
          <i class="fas fa-list" style="font-size:32px;margin-bottom:12px;display:block;"></i>
          Queue is empty
        </div>`;
      return;
    }

    const current  = State.currentSong;
    const upcoming = State.queue.slice(State.queueIndex + 1, State.queueIndex + 9);
    let html = "";

    if (current) {
      html += `<div class="queue-label">Now Playing</div>`;
      html += `
        <div class="queue-item now">
          <div class="q-thumb">
            ${current.artwork ? `<img src="${current.artwork}" loading="lazy">` : ""}
          </div>
          <div class="q-info">
            <div class="q-title">${this.escHtml(current.title)}</div>
            <div class="q-artist">${this.escHtml(current.artist)}</div>
          </div>
          <div class="q-dur">${this.formatTime(current.duration)}</div>
        </div>
      `;
    }

    if (upcoming.length > 0) {
      html += `<div class="queue-label" style="margin-top:12px;">Up Next</div>`;
      upcoming.forEach((s, i) => {
        const realIdx = State.queueIndex + 1 + i;
        html += `
          <div class="queue-item"
               onclick="Player.playSong(State.queue[${realIdx}])">
            <div class="q-thumb">
              ${s.artwork ? `<img src="${s.artwork}" loading="lazy">` : ""}
            </div>
            <div class="q-info">
              <div class="q-title">${this.escHtml(s.title)}</div>
              <div class="q-artist">${this.escHtml(s.artist)}</div>
            </div>
            <div class="q-dur">${this.formatTime(s.duration)}</div>
          </div>
        `;
      });
    }

    scroll.innerHTML = html;
  },

  // ── Skeleton Cards ───────────────────────────────────────
  renderSkeletonCards(count = 6) {
    return Array.from({ length: count }, () => `
      <div class="card">
        <div class="card-thumb skeleton" style="aspect-ratio:1;border-radius:var(--r-md);"></div>
        <div class="skeleton" style="height:14px;width:80%;margin:12px 0 6px;border-radius:4px;"></div>
        <div class="skeleton" style="height:12px;width:60%;border-radius:4px;"></div>
      </div>
    `).join("");
  },

  renderSkeletonRows(count = 5) {
    return Array.from({ length: count }, () => `
      <div class="song-row">
        <div class="skeleton" style="width:24px;height:14px;border-radius:4px;"></div>
        <div style="display:flex;align-items:center;gap:12px;">
          <div class="skeleton" style="width:40px;height:40px;border-radius:6px;flex-shrink:0;"></div>
          <div>
            <div class="skeleton" style="height:13px;width:140px;border-radius:4px;margin-bottom:6px;"></div>
            <div class="skeleton" style="height:11px;width:90px;border-radius:4px;"></div>
          </div>
        </div>
        <div class="skeleton" style="height:13px;width:100px;border-radius:4px;"></div>
        <div class="skeleton" style="height:13px;width:36px;border-radius:4px;"></div>
        <div></div>
      </div>
    `).join("");
  },

  // ── Mini Progress ────────────────────────────────────────
  updateMiniProgress() {
    const fill = document.querySelector(".mini-prog-fill");
    if (!fill || !State.duration) return;
    fill.style.width = ((State.currentTime / State.duration) * 100) + "%";
  },

  // ── Fullscreen ───────────────────────────────────────────
  openFullscreen() {
    document.getElementById("fullscreen-player")?.classList.add("open");
  },

  closeFullscreen() {
    document.getElementById("fullscreen-player")?.classList.remove("open");
  },

  // ── Escape HTML ──────────────────────────────────────────
  escHtml(str = "") {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  },

  // ── Switch Right Panel ───────────────────────────────────
  switchRightPanel(name) {
    document.querySelectorAll(".right-tab").forEach(t =>
      t.classList.toggle("active", t.dataset.panel === name)
    );
    document.querySelectorAll(".right-panel").forEach(p =>
      p.classList.toggle("active", p.id === `panel-${name}`)
    );
    State.rightPanel = name;
    if (name === "queue") this.renderQueue();
  },
};
