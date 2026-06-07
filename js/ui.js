/* ============================================================
   UI.JS — Rendering, Navigation, Display Logic
   + Mini player auto-hide (body class)
   + Vinyl spin trigger when playing
============================================================ */

window.__songRegistry = window.__songRegistry || {};

const UI = {

  /* ═══════════════════════════════════════════════════════
     TOAST
  ═══════════════════════════════════════════════════════ */
  showToast(msg, icon, type) {
    icon = icon || "fas fa-info-circle";
    type = type || "blue";
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML =
      '<i class="' + icon + ' toast-icon ' + type + '"></i><span>' + msg + "</span>";
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add("removing");
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  /* ═══════════════════════════════════════════════════════
     UTILITIES
  ═══════════════════════════════════════════════════════ */
  formatTime(sec) {
    sec = sec || 0;
    const s = Math.floor(sec);
    return Math.floor(s / 60) + ":" + (s % 60).toString().padStart(2, "0");
  },

  escHtml(str) {
    str = str || "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  },

  isMobile() {
    return window.matchMedia("(max-width: 900px)").matches;
  },

  getGreeting() {
    const h = new Date().getHours();
    if (h < 12)  return "Good Morning";
    if (h < 17)  return "Good Afternoon";
    if (h < 21)  return "Good Evening";
    return "Good Night";
  },

  /* ═══════════════════════════════════════════════════════
     NAVIGATION
  ═══════════════════════════════════════════════════════ */
  navigate(page) {
    this.closeFullscreen();
    this.navigateTo(page);

    if (page === "library") this.renderLibrary();
    if (page === "search") {
      const si = document.getElementById("search-input");
      if (si && !this.isMobile()) si.focus();
    }

    document.querySelectorAll(".mob-nav-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.page === page);
    });
  },

  navigateTo(page) {
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    const target = document.getElementById("page-" + page);
    if (target) target.classList.add("active");

    State.currentPage = page;

    document.querySelectorAll(".nav-item").forEach(n => {
      n.classList.toggle("active", n.dataset.page === page);
    });

    const ca = document.getElementById("content-area");
    if (ca) ca.scrollTo({ top: 0, behavior: "smooth" });
  },

  /* ═══════════════════════════════════════════════════════
     NOW PLAYING + Color adaptive + Vinyl spin
  ═══════════════════════════════════════════════════════ */
  async updateNowPlaying(song) {
    if (!song) return;

    // ✅ Show mini player (body class)
    document.body.classList.remove("no-song");
    document.body.classList.add("has-song");

    const artEl    = document.querySelector(".now-playing-art");
    const titleEl  = document.querySelector(".np-title");
    const artistEl = document.querySelector(".np-artist");

    if (artEl) {
      if (song.artwork) {
        artEl.innerHTML =
          '<img src="' + song.artwork + '" alt="' + this.escHtml(song.title) +
          '" onerror="this.onerror=null;this.parentElement.innerHTML=\'<div class=art-placeholder>🎵</div>\'" loading="eager">';
      } else {
        artEl.innerHTML = '<div class="art-placeholder">🎵</div>';
      }
    }

    // Add liked star to now playing art
    if (artEl && State.liked.has(song.id)) {
      const existingStar = artEl.querySelector('.liked-star');
      if (!existingStar) {
        const star = document.createElement('div');
        star.className = 'liked-star';
        star.innerHTML = '<i class="fas fa-heart"></i>';
        artEl.appendChild(star);
      }
    } else if (artEl) {
      const existingStar = artEl.querySelector('.liked-star');
      if (existingStar) existingStar.remove();
    }

    // Also add to fullscreen art
    const fsArtEl = document.querySelector(".fs-art");
    if (fsArtEl && State.liked.has(song.id)) {
      const existingStar = fsArtEl.querySelector('.liked-star');
      if (!existingStar) {
        const star = document.createElement('div');
        star.className = 'liked-star';
        star.innerHTML = '<i class="fas fa-heart"></i>';
        fsArtEl.appendChild(star);
      }
    } else if (fsArtEl) {
      const existingStar = fsArtEl.querySelector('.liked-star');
      if (existingStar) existingStar.remove();
    }

    if (titleEl)  titleEl.textContent  = song.title;
    if (artistEl) {
      artistEl.textContent = song.artist;
      artistEl.style.cursor = "pointer";
      artistEl.onclick = (e) => {
        e.stopPropagation();
        ArtistPage.open(song.artist);
      };
    }

    if (song.duration) this.updateDuration(song.duration);

    const fill = document.querySelector(".progress-fill");
    if (fill) fill.style.width = "0%";
    const curEl = document.querySelector(".time-lbl.current");
    if (curEl) curEl.textContent = "0:00";

    const miniFill = document.querySelector(".mini-progress-fill");
    if (miniFill) miniFill.style.width = "0%";

    this.updateLikeBtn(State.liked.has(song.id));

    // Fullscreen
    const fsTitle  = document.querySelector(".fs-title");
    const fsArtist = document.querySelector(".fs-artist");
    const fsArt    = document.querySelector(".fs-art");
    const fsBg     = document.querySelector(".fs-blur-art");

    if (fsTitle) fsTitle.textContent = song.title;
    if (fsArtist) {
      fsArtist.textContent = song.artist;
      fsArtist.style.cursor = "pointer";
      fsArtist.onclick = () => {
        UI.closeFullscreen();
        ArtistPage.open(song.artist);
      };
    }

    if (fsArt && song.artwork) {
      fsArt.innerHTML =
        '<img src="' + song.artwork + '" alt="' + this.escHtml(song.title) +
        '" onerror="this.onerror=null;this.parentElement.innerHTML=\'<div style=width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:80px;background:var(--bg-elevated)>🎵</div>\'">';
    }
    if (fsBg && song.artwork) fsBg.style.backgroundImage = "url(" + song.artwork + ")";

    document.title = song.title + " — SoundWave Pro";

    // Color-adaptive background
    if (song.artwork) {
      this.applyAdaptiveColor(song.artwork);
    }
  },

  /* Extract & apply color to fullscreen */
  async applyAdaptiveColor(artworkUrl) {
    try {
      const color = await API.extractColor(artworkUrl);
      if (color) {
        document.documentElement.style.setProperty('--dynamic-color', color);
        const fsBg = document.querySelector('.fs-bg');
        if (fsBg) {
          fsBg.classList.add('color-tint');
          fsBg.style.background = `linear-gradient(180deg, ${color} 0%, rgba(0,0,0,0.85) 60%, #000 100%)`;
        }
      }
    } catch (e) {
      console.warn("Color adapt failed:", e.message);
    }
  },

  updateDuration(sec) {
    document.querySelectorAll(".time-lbl.total").forEach(el => {
      el.textContent = this.formatTime(sec);
    });
  },

  /* ═══════════════════════════════════════════════════════
     PLAY STATE + Vinyl spin trigger
  ═══════════════════════════════════════════════════════ */
  setPlayState(playing) {
    document.querySelectorAll(".play-btn").forEach(btn => {
      btn.innerHTML = '<i class="fas ' + (playing ? "fa-pause" : "fa-play") + '"></i>';
      btn.classList.toggle("playing", playing);
    });
    const viz = document.querySelector(".mini-visualizer");
    if (viz) viz.style.display = playing ? "flex" : "none";

    // ✅ Vinyl spin toggle on fullscreen art
    const fsArt = document.querySelector(".fs-art");
    if (fsArt) {
      fsArt.classList.toggle("spinning", playing);
    }
  },

  updateVolumeUI(pct) {
    document.querySelectorAll(".vol-fill").forEach(el => {
      el.style.width = (pct * 100) + "%";
    });
    document.querySelectorAll(".vol-icon i").forEach(icon => {
      if (pct === 0)      icon.className = "fas fa-volume-mute";
      else if (pct < 0.5) icon.className = "fas fa-volume-down";
      else                icon.className = "fas fa-volume-up";
    });
  },

  updateLikeBtn(liked) {
    document.querySelectorAll(".like-btn, #btn-like").forEach(btn => {
      btn.innerHTML = '<i class="' + (liked ? "fas" : "far") + ' fa-heart"></i>';
      btn.style.color = liked ? "var(--accent)" : "";
      btn.classList.toggle("liked", liked);
    });
  },

  updatePlayerBgColor(song) {
    const bar = document.getElementById("player-bar");
    if (!bar || !song) return;
    if (this.isMobile()) {
      bar.style.background = "rgba(28,28,28,0.96)";
      return;
    }
    const colors = {
      Pop:        "#e74c3c22",
      "Hip-Hop":  "#f39c1222",
      "R&B":      "#9b59b622",
      Rock:       "#2c3e5022",
      Electronic: "#3498db22",
      "K-Pop":    "#e91e6322",
      Jazz:       "#79554822",
      Classical:  "#607d8b22",
      Indie:      "#27ae6022",
    };
    const color = colors[song.genre] || "rgba(29,185,84,0.1)";
    bar.style.background = "linear-gradient(to right, " + color + ", transparent)";
  },

  _registerSong(song) {
    const key = "s_" + song.id;
    window.__songRegistry[key] = song;
    return key;
  },

  /* ═══════════════════════════════════════════════════════
     RENDER CARD
  ═══════════════════════════════════════════════════════ */
  renderCard(song, index, songs) {
    if (songs) songs.forEach(s => UI._registerSong(s));
    this._registerSong(song);

    return (
      '<div class="card stagger-item" ' +
      'onclick="Player.playFromRegistry(\'' + song.id + '\')" ' +
      'oncontextmenu="ContextMenu.openForSong(event, \'' + song.id + '\')" ' +
      'data-id="' + song.id + '">' +
        '<div class="card-thumb">' +
        (song.artwork
          ? '<img src="' + song.artwork + '" alt="' + this.escHtml(song.title) +
            '" onerror="this.onerror=null;this.parentElement.innerHTML=\'<div style=width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:40px;background:var(--bg-elevated)>🎵</div>\'" loading="lazy">'
          : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:40px;background:var(--bg-elevated)">🎵</div>') +
        (song.explicit ? '<div class="card-badge">E</div>' : "") +
        (State.liked.has(song.id) ? '<div class="liked-star"><i class="fas fa-heart"></i></div>' : "") +
        '</div>' +
        '<div class="card-title">' + this.escHtml(song.title) + '</div>' +
        '<div class="card-sub" onclick="event.stopPropagation(); ArtistPage.open(\'' + this.escHtml(song.artist).replace(/'/g, "\\'") + '\')" style="cursor:pointer;" title="View artist">' + this.escHtml(song.artist) + "</div>" +
        '<button class="card-play" onclick="event.stopPropagation(); Player.playFromRegistry(\'' + song.id + '\')">' +
          '<i class="fas fa-play"></i>' +
        '</button>' +
      '</div>'
    );
  },

  /* ═══════════════════════════════════════════════════════
     RENDER PLAYLIST CARD
  ═══════════════════════════════════════════════════════ */
  renderPlaylistCard(pl) {
    const coverClass = pl.coverGradient || "gradient-1";
    const coverHtml = pl.cover
      ? '<img src="' + pl.cover + '" alt="' + this.escHtml(pl.name) + '" loading="lazy">'
      : '<div style="font-size:48px;">📁</div>';

    return (
      '<div class="playlist-card stagger-item" onclick="PlaylistManager.openPlaylist(\'' + pl.id + '\')">' +
        '<div class="playlist-cover ' + coverClass + '">' + coverHtml + '</div>' +
        '<div class="card-title">' + this.escHtml(pl.name) + '</div>' +
        '<div class="card-sub">' + pl.songs.length + ' song' + (pl.songs.length !== 1 ? 's' : '') + '</div>' +
        '<button class="card-play" onclick="event.stopPropagation(); PlaylistManager.playPlaylist(\'' + pl.id + '\')">' +
          '<i class="fas fa-play"></i>' +
        '</button>' +
      '</div>'
    );
  },

  /* ═══════════════════════════════════════════════════════
     RENDER SONG ROW
  ═══════════════════════════════════════════════════════ */
  renderSongRow(song, index) {
    this._registerSong(song);
    const liked  = State.liked.has(song.id);
    const active = State.currentSong && State.currentSong.id === song.id;

    return (
      '<div class="song-row ' + (active ? "active" : "") + '" ' +
      'onclick="Player.playFromRegistry(\'' + song.id + '\')" ' +
      'oncontextmenu="ContextMenu.openForSong(event, \'' + song.id + '\')" ' +
      'data-id="' + song.id + '">' +
        '<div class="song-num">' +
          '<span class="song-num-text">' + (index + 1) + '</span>' +
          '<span class="song-play-btn"><i class="fas ' + (active ? "fa-pause" : "fa-play") + '"></i></span>' +
        '</div>' +
        '<div class="song-info">' +
          '<div class="song-thumb">' +
          (song.artwork
            ? '<img src="' + song.artwork + '" alt="" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML=\'<div style=width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:16px;background:var(--bg-elevated)>🎵</div>\'">'
            : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:16px;background:var(--bg-elevated)">🎵</div>') +
          '</div>' +
          '<div>' +
            '<div class="song-name">' + this.escHtml(song.title) + '</div>' +
            '<div class="song-artist" onclick="event.stopPropagation(); ArtistPage.open(\'' + this.escHtml(song.artist).replace(/'/g, "\\'") + '\')" style="cursor:pointer;">' + this.escHtml(song.artist) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="song-album secondary truncate">' + this.escHtml(song.album || "") + '</div>' +
        '<div class="song-duration">' + this.formatTime(song.duration) + '</div>' +
        '<div class="song-heart ' + (liked ? "liked" : "") + '" ' +
        'onclick="event.stopPropagation(); State.toggleLike(\'' + song.id + '\'); UI.refreshSongHeart(\'' + song.id + '\');">' +
          '<i class="' + (liked ? "fas" : "far") + ' fa-heart"></i>' +
        '</div>' +
      '</div>'
    );
  },

  refreshSongHeart(songId) {
    const liked = State.liked.has(songId);

    document.querySelectorAll('[data-id="' + songId + '"] .song-heart').forEach(el => {
      el.classList.toggle("liked", liked);
      el.innerHTML = '<i class="' + (liked ? "fas" : "far") + ' fa-heart"></i>';
    });

    document.querySelectorAll('.card[data-id="' + songId + '"] .card-thumb').forEach(thumb => {
      let star = thumb.querySelector('.liked-star');
      if (liked && !star) {
        star = document.createElement('div');
        star.className = 'liked-star';
        star.innerHTML = '<i class="fas fa-heart"></i>';
        thumb.appendChild(star);
      } else if (!liked && star) {
        star.remove();
      }
    });

    if (State.currentSong && State.currentSong.id === songId) {
      this.updateLikeBtn(liked);

      const artEl = document.querySelector(".now-playing-art");
      const fsArtEl = document.querySelector(".fs-art");
      [artEl, fsArtEl].forEach(el => {
        if (!el) return;
        let star = el.querySelector('.liked-star');
        if (liked && !star) {
          star = document.createElement('div');
          star.className = 'liked-star';
          star.innerHTML = '<i class="fas fa-heart"></i>';
          el.appendChild(star);
        } else if (!liked && star) {
          star.remove();
        }
      });
    }
  },

  /* ═══════════════════════════════════════════════════════
     RENDER QUEUE
  ═══════════════════════════════════════════════════════ */
  renderQueue() {
    const scroll = document.querySelector(".queue-scroll");
    const fsList = document.getElementById("fs-queue-list");

    if (State.queue.length === 0) {
      const emptyHtml =
        '<div style="text-align:center;padding:40px 16px;color:var(--text-muted);">' +
        '<i class="fas fa-list" style="font-size:32px;margin-bottom:12px;display:block;"></i>' +
        'Queue is empty</div>';
      if (scroll) scroll.innerHTML = emptyHtml;
      if (fsList) fsList.innerHTML = emptyHtml;
      return;
    }

    const current = State.currentSong;
    const upcoming = State.queue.slice(State.queueIndex + 1, State.queueIndex + 30);
    let html = "";

    if (current) {
      html += '<div class="queue-label">Now Playing</div>';
      html += this._queueItemHtml(current, -1, true);
    }

    if (upcoming.length > 0) {
      html += '<div class="queue-label" style="margin-top:12px;">Up Next</div>';
      upcoming.forEach((s, i) => {
        const realIdx = State.queueIndex + 1 + i;
        html += this._queueItemHtml(s, realIdx, false);
      });
    }

    if (scroll) scroll.innerHTML = html;
    if (fsList) fsList.innerHTML = html;

    const countEl = document.getElementById("fs-queue-count");
    if (countEl) {
      const total = State.queue.length;
      countEl.textContent = total + " song" + (total !== 1 ? "s" : "") + " in queue";
    }
  },

  _queueItemHtml(song, idx, isNow) {
    const onClick = isNow ? "" : 'onclick="Player.playSong(State.queue[' + idx + '])"';
    return (
      '<div class="queue-item ' + (isNow ? "now" : "") + '" ' + onClick + '>' +
        '<div class="q-thumb">' +
        (song.artwork
          ? '<img src="' + song.artwork + '" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML=\'<div style=width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:18px;background:var(--bg-elevated)>🎵</div>\'">'
          : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:18px;background:var(--bg-elevated)">🎵</div>') +
        '</div>' +
        '<div class="q-info">' +
          '<div class="q-title">' + this.escHtml(song.title) + '</div>' +
          '<div class="q-artist">' + this.escHtml(song.artist) + '</div>' +
        '</div>' +
        '<div class="q-dur">' + this.formatTime(song.duration) + '</div>' +
      '</div>'
    );
  },

  /* ═══════════════════════════════════════════════════════
     LIBRARY
  ═══════════════════════════════════════════════════════ */
  renderLibrary() {
    const page = document.getElementById("page-library");
    if (!page) return;

    const liked     = [...State.liked];
    const playlists = State.playlists;
    const hasStats  = Object.keys(State.songPlayCounts).length > 0;
    const hasLiked  = State.liked.size > 0;

    let html =
      '<div class="section-header">' +
        '<div>' +
          '<div class="section-title">Your Library</div>' +
          '<div class="section-sub">' + liked.length + ' liked · ' + playlists.length + ' playlists</div>' +
        '</div>' +
        '<button class="see-all" onclick="openModal(\'modal-playlist\')" style="display:flex;align-items:center;gap:6px;">' +
          '<i class="fas fa-plus"></i> New Playlist' +
        '</button>' +
      '</div>';

    if (hasStats || hasLiked) {
      html +=
        '<div class="section-header" style="margin-top:24px;">' +
          '<div><div class="section-title" style="font-size:18px;">✨ Smart Playlists</div></div>' +
        '</div>' +
        '<div class="cards-grid">';

      if (hasLiked) {
        html +=
          '<div class="playlist-card stagger-item" onclick="PlaylistManager.openSmartPlaylist(\'recent-liked\')">' +
            '<div class="playlist-cover gradient-1" style="font-size:48px;">💚</div>' +
            '<div class="card-title">Recently Loved</div>' +
            '<div class="card-sub">Your latest favorites</div>' +
            '<button class="card-play" onclick="event.stopPropagation(); PlaylistManager.playRecentlyLiked()">' +
              '<i class="fas fa-play"></i>' +
            '</button>' +
          '</div>';
      }

      if (hasStats) {
        html +=
          '<div class="playlist-card stagger-item" onclick="PlaylistManager.openSmartPlaylist(\'most-played\')">' +
            '<div class="playlist-cover gradient-3" style="font-size:48px;">🔥</div>' +
            '<div class="card-title">Most Played</div>' +
            '<div class="card-sub">Your top tracks</div>' +
            '<button class="card-play" onclick="event.stopPropagation(); PlaylistManager.playMostPlayed()">' +
              '<i class="fas fa-play"></i>' +
            '</button>' +
          '</div>' +
          '<div class="playlist-card stagger-item" onclick="PlaylistManager.openSmartPlaylist(\'made-for-you\')">' +
            '<div class="playlist-cover gradient-6" style="font-size:48px;">✨</div>' +
            '<div class="card-title">Made For You</div>' +
            '<div class="card-sub">Personalized mix</div>' +
            '<button class="card-play" onclick="event.stopPropagation(); PlaylistManager.playMadeForYou()">' +
              '<i class="fas fa-play"></i>' +
            '</button>' +
          '</div>';
      }

      html += '</div>';
    }

    if (playlists.length > 0) {
      html +=
        '<div class="section-header" style="margin-top:24px;">' +
          '<div><div class="section-title" style="font-size:18px;">📁 Your Playlists</div></div>' +
        '</div>';
      html += '<div class="cards-grid">';
      playlists.forEach(pl => {
        html += this.renderPlaylistCard(pl);
      });
      html += "</div>";
    }

    if (liked.length === 0 && playlists.length === 0) {
      html +=
        '<div class="empty-state" style="margin-top:40px;">' +
          '<i class="fas fa-heart empty-icon"></i>' +
          '<h3>Your library is empty</h3>' +
          '<p>Like songs and create playlists to see them here</p>' +
          '<button class="empty-state-action" onclick="UI.navigate(\'home\')">' +
            '<i class="fas fa-music"></i> Browse Music' +
          '</button>' +
        '</div>';
      page.innerHTML = html;
      return;
    }

    if (liked.length === 0) {
      page.innerHTML = html;
      return;
    }

    html +=
      '<div class="section-header" style="margin-top:24px;">' +
        '<div><div class="section-title" style="font-size:18px;">❤️ Liked Songs</div></div>' +
        '<button class="see-all" onclick="PlaylistManager.playLikedSongs()">' +
          '<i class="fas fa-play"></i> Play All' +
        '</button>' +
      '</div>';

    const likedSongs = liked
      .map(id => window.__songRegistry["s_" + id])
      .filter(Boolean);

    if (likedSongs.length < liked.length) {
      html += '<div style="text-align:center;padding:20px;"><div class="spinner" style="margin:0 auto 12px;"></div>Loading your songs...</div>';
      page.innerHTML = html;

      const missingIds = liked.filter(id => !window.__songRegistry["s_" + id]);
      Promise.all(missingIds.map(id =>
        fetch("https://itunes.apple.com/lookup?id=" + id)
          .then(res => res.json())
          .then(json => {
            if (json.results && json.results[0]) {
              const t = json.results[0];
              const art = (t.artworkUrl100 || "").replace("100x100bb", "600x600bb");
              window.__songRegistry["s_" + id] = {
                id:         String(t.trackId),
                title:      t.trackName       || "Unknown",
                artist:     t.artistName      || "Unknown",
                album:      t.collectionName  || "Unknown",
                duration:   Math.round((t.trackTimeMillis || 0) / 1000),
                previewUrl: t.previewUrl      || null,
                artwork:    art,
                genre:      t.primaryGenreName || "Music",
                source:     "itunes",
              };
            }
          })
          .catch(() => {})
      )).then(() => UI.renderLibrary());

      return;
    }

    html +=
      '<div class="song-list">' +
        '<div class="song-list-head"><span>#</span><span>Title</span><span>Album</span><span><i class="fas fa-clock"></i></span><span></span></div>';

    likedSongs.forEach((s, i) => {
      html += UI.renderSongRow(s, i);
    });

    html += "</div>";
    page.innerHTML = html;
  },

  /* ═══════════════════════════════════════════════════════
     SIDEBAR LIBRARY
  ═══════════════════════════════════════════════════════ */
  renderSidebarLibrary(songs) {
    songs = songs || [];
    const container = document.getElementById("sidebar-library-container");
    if (!container) return;

    const liked = [...State.liked];
    const allItems = [];

    State.playlists.forEach(pl => {
      allItems.push({
        type: "playlist",
        id: pl.id,
        name: pl.name,
        sub: pl.songs.length + " songs",
        artwork: pl.cover,
        gradient: pl.coverGradient,
      });
    });

    [...songs].forEach(s => {
      if (!allItems.find(i => i.type === "song" && i.id === s.id)) {
        allItems.push({
          type: "song",
          id: s.id,
          name: s.title,
          sub: s.artist,
          artwork: s.artwork,
          songRef: s,
        });
      }
    });

    liked.forEach(id => {
      const song = window.__songRegistry["s_" + id];
      if (song && !allItems.find(i => i.type === "song" && i.id === song.id)) {
        allItems.push({
          type: "song",
          id: song.id,
          name: song.title,
          sub: song.artist,
          artwork: song.artwork,
          songRef: song,
        });
      }
    });

    if (allItems.length === 0) {
      container.innerHTML =
        '<div class="library-header">' +
          '<span class="library-title">Your Library</span>' +
          '<button class="library-add-btn" onclick="openModal(\'modal-playlist\')" title="Create Playlist"><i class="fas fa-plus"></i></button>' +
        '</div>' +
        '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px;">' +
          '<i class="fas fa-music" style="font-size:24px;margin-bottom:8px;display:block;"></i>Play some music!' +
        '</div>';
      return;
    }

    let html =
      '<div class="library-header">' +
        '<span class="library-title">Your Library</span>' +
        '<button class="library-add-btn" onclick="openModal(\'modal-playlist\')" title="Create Playlist"><i class="fas fa-plus"></i></button>' +
      '</div>';

    allItems.slice(0, 20).forEach(item => {
      if (item.type === "playlist") {
        const grad = item.gradient || "gradient-1";
        const cov = item.artwork
          ? '<img src="' + item.artwork + '" alt="" loading="lazy">'
          : '📁';
        html +=
          '<div class="library-item" onclick="PlaylistManager.openPlaylist(\'' + item.id + '\')">' +
            '<div class="library-thumb playlist-cover ' + grad + '">' + cov + '</div>' +
            '<div class="library-item-info">' +
              '<div class="library-item-name">' + UI.escHtml(item.name) + '</div>' +
              '<div class="library-item-sub">' + UI.escHtml(item.sub) + '</div>' +
            '</div>' +
          '</div>';
      } else {
        UI._registerSong(item.songRef);
        html +=
          '<div class="library-item" onclick="Player.playFromRegistry(\'' + item.id + '\')">' +
            '<div class="library-thumb">' +
            (item.artwork
              ? '<img src="' + item.artwork + '" alt="" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML=\'<div style=width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:18px;background:var(--bg-elevated)>🎵</div>\'">'
              : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:18px;background:var(--bg-elevated)">🎵</div>') +
            '</div>' +
            '<div class="library-item-info">' +
              '<div class="library-item-name">' + UI.escHtml(item.name) + '</div>' +
              '<div class="library-item-sub">' + UI.escHtml(item.sub) + '</div>' +
            '</div>' +
          '</div>';
      }
    });

    container.innerHTML = html;
  },

  /* ═══════════════════════════════════════════════════════
     LISTENING STATS
  ═══════════════════════════════════════════════════════ */
  renderStats() {
    const container = document.getElementById("stats-content");
    if (!container) return;

    const time = State.getTotalListenTime();
    const topSongs   = State.getTopSongs(5);
    const topArtists = State.getTopArtists(5);
    const topGenres  = State.getTopGenres(3);
    const totalSongs = Object.keys(State.songPlayCounts).length;

    let html =
      '<div class="stats-grid">' +
        '<div class="stat-card">' +
          '<i class="fas fa-clock stat-icon"></i>' +
          '<div class="stat-value">' + (time.hours > 0 ? time.hours + 'h ' : '') + time.minutes + 'm</div>' +
          '<div class="stat-label">Total Time</div>' +
        '</div>' +
        '<div class="stat-card">' +
          '<i class="fas fa-music stat-icon"></i>' +
          '<div class="stat-value">' + totalSongs + '</div>' +
          '<div class="stat-label">Unique Songs</div>' +
        '</div>' +
        '<div class="stat-card">' +
          '<i class="fas fa-heart stat-icon"></i>' +
          '<div class="stat-value">' + State.liked.size + '</div>' +
          '<div class="stat-label">Liked Songs</div>' +
        '</div>' +
        '<div class="stat-card">' +
          '<i class="fas fa-list-ul stat-icon"></i>' +
          '<div class="stat-value">' + State.playlists.length + '</div>' +
          '<div class="stat-label">Playlists</div>' +
        '</div>' +
      '</div>';

    if (topSongs.length > 0) {
      html += '<div class="stat-list">';
      html += '<div class="stat-list-header">🔥 Most Played Songs</div>';
      topSongs.forEach((s, i) => {
        html +=
          '<div class="stat-list-item">' +
            '<div class="stat-list-rank">' + (i + 1) + '</div>' +
            '<div class="stat-list-name">' + UI.escHtml(s.title) + ' — <span style="opacity:0.6;">' + UI.escHtml(s.artist) + '</span></div>' +
            '<div class="stat-list-count">' + s.count + 'x</div>' +
          '</div>';
      });
      html += '</div>';
    }

    if (topArtists.length > 0) {
      html += '<div class="stat-list">';
      html += '<div class="stat-list-header">🎤 Top Artists</div>';
      topArtists.forEach((a, i) => {
        html +=
          '<div class="stat-list-item">' +
            '<div class="stat-list-rank">' + (i + 1) + '</div>' +
            '<div class="stat-list-name">' + UI.escHtml(a.name) + '</div>' +
            '<div class="stat-list-count">' + a.count + ' plays</div>' +
          '</div>';
      });
      html += '</div>';
    }

    if (topGenres.length > 0) {
      html += '<div class="stat-list">';
      html += '<div class="stat-list-header">🎵 Favorite Genres</div>';
      topGenres.forEach((g, i) => {
        html +=
          '<div class="stat-list-item">' +
            '<div class="stat-list-rank">' + (i + 1) + '</div>' +
            '<div class="stat-list-name">' + UI.escHtml(g.name) + '</div>' +
            '<div class="stat-list-count">' + g.count + ' plays</div>' +
          '</div>';
      });
      html += '</div>';
    }

    if (totalSongs === 0) {
      html =
        '<div class="empty-state">' +
          '<i class="fas fa-chart-line empty-icon"></i>' +
          '<h3>No stats yet</h3>' +
          '<p>Start listening to music to see your stats here!</p>' +
        '</div>';
    }

    container.innerHTML = html;
  },

  /* ═══════════════════════════════════════════════════════
     SKELETON LOADERS
  ═══════════════════════════════════════════════════════ */
  renderSkeletonCards(count) {
    count = count || 6;
    return Array.from({ length: count }, () =>
      '<div class="card">' +
      '<div class="card-thumb skeleton" style="aspect-ratio:1;border-radius:var(--r-md);"></div>' +
      '<div class="skeleton" style="height:14px;width:80%;margin:12px 0 6px;border-radius:4px;"></div>' +
      '<div class="skeleton" style="height:12px;width:60%;border-radius:4px;"></div>' +
      '</div>'
    ).join("");
  },

  renderSkeletonRows(count) {
    count = count || 5;
    return Array.from({ length: count }, () =>
      '<div class="song-row">' +
      '<div class="skeleton" style="width:24px;height:14px;border-radius:4px;"></div>' +
      '<div style="display:flex;align-items:center;gap:12px;">' +
        '<div class="skeleton" style="width:40px;height:40px;border-radius:6px;flex-shrink:0;"></div>' +
        '<div>' +
          '<div class="skeleton" style="height:13px;width:140px;border-radius:4px;margin-bottom:6px;"></div>' +
          '<div class="skeleton" style="height:11px;width:90px;border-radius:4px;"></div>' +
        '</div>' +
      '</div>' +
      '<div class="skeleton" style="height:13px;width:100px;border-radius:4px;"></div>' +
      '<div class="skeleton" style="height:13px;width:36px;border-radius:4px;"></div>' +
      '<div></div>' +
      '</div>'
    ).join("");
  },

  /* ═══════════════════════════════════════════════════════
     FULLSCREEN PLAYER
  ═══════════════════════════════════════════════════════ */
  openFullscreen() {
    const el = document.getElementById("fullscreen-player");
    if (!el) return;
    el.classList.add("open");
    document.body.classList.add("fs-open");

    document.querySelectorAll(".mob-nav-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.page === "player");
    });
  },

  closeFullscreen() {
    const el = document.getElementById("fullscreen-player");
    if (el) el.classList.remove("open");
    document.body.classList.remove("fs-open");
    this.closeFsLyrics();
    this.closeFsQueue();
  },

  openFsLyrics() {
    const fs = document.getElementById("fullscreen-player");
    if (fs && !fs.classList.contains("open")) this.openFullscreen();

    const panel = document.getElementById("fs-lyrics");
    if (!panel) return;

    const song = State.currentSong;
    const t2 = document.getElementById("fs-lyrics-title");
    const a2 = document.getElementById("fs-lyrics-artist");
    if (t2) t2.textContent = song ? song.title : "Lyrics";
    if (a2) a2.textContent = song ? song.artist : "—";

    const src = document.getElementById("lyrics-lines");
    const dst = document.getElementById("fs-lyrics-lines");
    if (src && dst) dst.innerHTML = src.innerHTML;

    panel.classList.remove("hidden");

    if (typeof Lyrics !== "undefined") {
      Lyrics.highlightLine(State.currentTime || 0);
    }
  },

  closeFsLyrics() {
    const panel = document.getElementById("fs-lyrics");
    if (panel) panel.classList.add("hidden");
  },

  openFsQueue() {
    const fs = document.getElementById("fullscreen-player");
    if (fs && !fs.classList.contains("open")) this.openFullscreen();

    const panel = document.getElementById("fs-queue");
    if (!panel) return;

    this.renderQueue();
    panel.classList.remove("hidden");
  },

  closeFsQueue() {
    const panel = document.getElementById("fs-queue");
    if (panel) panel.classList.add("hidden");
  },

  /* ═══════════════════════════════════════════════════════
     RIGHT PANEL SWITCH
  ═══════════════════════════════════════════════════════ */
  switchRightPanel(name) {
    if (this.isMobile()) {
      if (name === "lyrics") return this.openFsLyrics();
      if (name === "queue")  return this.openFsQueue();
    }

    document.querySelectorAll(".right-tab").forEach(t => {
      t.classList.toggle("active", t.dataset.panel === name);
    });
    document.querySelectorAll(".right-panel").forEach(p => {
      p.classList.toggle("active", p.id === "panel-" + name);
    });

    State.rightPanel = name;
    if (name === "queue") UI.renderQueue();
  },

  /* ═══════════════════════════════════════════════════════
     SHARE
  ═══════════════════════════════════════════════════════ */
  showShare(url, title) {
    const linkInput = document.getElementById("share-link");
    if (linkInput) linkInput.value = url;
    openModal("modal-share");
  },

  copyShareLink() {
    const linkInput = document.getElementById("share-link");
    if (!linkInput) return;
    linkInput.select();
    navigator.clipboard.writeText(linkInput.value).then(() => {
      UI.showToast("Link copied!", "fas fa-check", "green");
      closeModal("modal-share");
    });
  },
};

/* ═══════════════════════════════════════════════════════
   INITIAL STATE — Hide mini player until song plays
═══════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  if (!State.currentSong) {
    document.body.classList.add("no-song");
  }
});