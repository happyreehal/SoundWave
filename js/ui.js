/* ============================================================
   UI.JS — Fixed Version
   Fixes: Image loading, playlist support, library rendering
   + Mobile Lyrics Overlay support (fs-lyrics)
============================================================ */

window.__songRegistry = {};

const UI = {
  showToast(msg, icon, type) {
    icon = icon || "fas fa-info-circle";
    type = type || "blue";
    var container = document.getElementById("toast-container");
    if (!container) return;
    var toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML =
      '<i class="' + icon + ' toast-icon ' + type + '"></i><span>' + msg + "</span>";
    container.appendChild(toast);
    setTimeout(function () {
      toast.classList.add("removing");
      setTimeout(function () {
        toast.remove();
      }, 300);
    }, 3000);
  },

  formatTime(sec) {
    sec = sec || 0;
    var s = Math.floor(sec);
    return Math.floor(s / 60) + ":" + (s % 60).toString().padStart(2, "0");
  },

  navigateTo(page) {
    document.querySelectorAll(".page").forEach(function (p) {
      p.classList.remove("active");
    });
    var target = document.getElementById("page-" + page);
    if (target) target.classList.add("active");

    State.currentPage = page;

    document.querySelectorAll(".nav-item").forEach(function (n) {
      n.classList.toggle("active", n.dataset.page === page);
    });

    var ca = document.getElementById("content-area");
    if (ca) ca.scrollTo({ top: 0, behavior: "smooth" });
  },

  navigate(page) {
    this.navigateTo(page);
    if (page === "library") this.renderLibrary();
    document.querySelectorAll(".mob-nav-btn").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.page === page);
    });
  },

  updateNowPlaying(song) {
    var artEl = document.querySelector(".now-playing-art");
    var titleEl = document.querySelector(".np-title");
    var artistEl = document.querySelector(".np-artist");

    if (artEl) {
      if (song.artwork) {
        artEl.innerHTML =
          '<img src="' +
          song.artwork +
          '" alt="' +
          this.escHtml(song.title) +
          '" onerror="this.onerror=null;this.parentElement.innerHTML=\'<div class=\\\'art-placeholder\\\'>🎵</div>\'" loading="eager">';
      } else {
        artEl.innerHTML = '<div class="art-placeholder">🎵</div>';
      }
    }

    if (titleEl) titleEl.textContent = song.title;
    if (artistEl) artistEl.textContent = song.artist;
    if (song.duration) this.updateDuration(song.duration);

    var fill = document.querySelector(".progress-fill");
    if (fill) fill.style.width = "0%";
    var curEl = document.querySelector(".time-lbl.current");
    if (curEl) curEl.textContent = "0:00";

    this.updateLikeBtn(State.liked.has(song.id));

    // Fullscreen player meta
    var fsTitle = document.querySelector(".fs-title");
    var fsArtist = document.querySelector(".fs-artist");
    var fsArt = document.querySelector(".fs-art");
    var fsBg = document.querySelector(".fs-blur-art");

    if (fsTitle) fsTitle.textContent = song.title;
    if (fsArtist) fsArtist.textContent = song.artist;

    if (fsArt && song.artwork) {
      fsArt.innerHTML =
        '<img src="' +
        song.artwork +
        '" alt="' +
        this.escHtml(song.title) +
        '" onerror="this.onerror=null;this.parentElement.innerHTML=\'<div style=width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:80px;background:var(--bg-elevated)>🎵</div>\'">';
    }
    if (fsBg && song.artwork) fsBg.style.backgroundImage = "url(" + song.artwork + ")";

    document.title = song.title + " — SoundWave Pro";
  },

  updateDuration(sec) {
    var el = document.querySelector(".time-lbl.total");
    if (el) el.textContent = this.formatTime(sec);
  },

  setPlayState(playing) {
    document.querySelectorAll(".play-btn").forEach(function (btn) {
      btn.innerHTML =
        '<i class="fas ' + (playing ? "fa-pause" : "fa-play") + '"></i>';
      btn.classList.toggle("playing", playing);
    });
    var viz = document.querySelector(".mini-visualizer");
    if (viz) viz.style.display = playing ? "flex" : "none";
  },

  updateVolumeUI(pct) {
    var fill = document.querySelector(".vol-fill");
    if (fill) fill.style.width = pct * 100 + "%";
    var icon = document.querySelector(".vol-icon i");
    if (!icon) return;

    if (pct === 0) icon.className = "fas fa-volume-mute";
    else if (pct < 0.5) icon.className = "fas fa-volume-down";
    else icon.className = "fas fa-volume-up";
  },

  updateLikeBtn(liked) {
    document.querySelectorAll(".like-btn, #btn-like").forEach(function (btn) {
      btn.innerHTML =
        '<i class="' + (liked ? "fas" : "far") + ' fa-heart"></i>';
      btn.style.color = liked ? "var(--accent)" : "";
    });
  },

  updatePlayerBgColor(song) {
    var bar = document.getElementById("player-bar");
    if (!bar || !song || !song.artwork) return;

    var colors = {
      Pop: "#e74c3c22",
      "Hip-Hop": "#f39c1222",
      "R&B": "#9b59b622",
      Rock: "#2c3e5022",
      Electronic: "#3498db22",
      "K-Pop": "#e91e6322",
      Jazz: "#79554822",
      Classical: "#607d8b22",
      Indie: "#27ae6022",
    };

    var color = colors[song.genre] || "rgba(29,185,84,0.1)";
    bar.style.background = "linear-gradient(to right, " + color + ", transparent)";
    bar.style.borderTopColor = color.replace("22", "44");
  },

  _registerSong(song) {
    var key = "s_" + song.id;
    window.__songRegistry[key] = song;
    return key;
  },
    renderCard(song, index, songs) {
    if (songs) songs.forEach(function (s) { UI._registerSong(s); });
    this._registerSong(song);

    return (
      '<div class="card stagger-item" onclick="Player.playSong(window.__songRegistry[\'s_' +
      song.id +
      '\'])" oncontextmenu="ContextMenu.open(event, ' +
      index +
      ')" data-id="' +
      song.id +
      '">' +
      '<div class="card-thumb">' +
      (song.artwork
        ? '<img src="' +
          song.artwork +
          '" alt="' +
          this.escHtml(song.title) +
          '" onerror="this.onerror=null;this.parentElement.innerHTML=\'<div style=width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:40px;background:var(--bg-elevated)>🎵</div>\'" loading="lazy">'
        : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:40px;background:var(--bg-elevated)">🎵</div>') +
      (song.explicit ? '<div class="card-badge">E</div>' : "") +
      "</div>" +
      '<div class="card-title">' +
      this.escHtml(song.title) +
      "</div>" +
      '<div class="card-sub">' +
      this.escHtml(song.artist) +
      "</div>" +
      '<button class="card-play" onclick="event.stopPropagation(); Player.playSong(window.__songRegistry[\'s_' +
      song.id +
      '\'])">' +
      '<i class="fas fa-play"></i>' +
      "</button>" +
      "</div>"
    );
  },

  renderSongRow(song, index) {
    this._registerSong(song);
    var liked = State.liked.has(song.id);
    var active = State.currentSong && State.currentSong.id === song.id;

    return (
      '<div class="song-row ' +
      (active ? "active" : "") +
      '" onclick="Player.playSong(window.__songRegistry[\'s_' +
      song.id +
      '\'])" oncontextmenu="ContextMenu.open(event, ' +
      index +
      ')" data-id="' +
      song.id +
      '">' +
      '<div class="song-num">' +
      '<span class="song-num-text">' +
      (index + 1) +
      "</span>" +
      '<span class="song-play-btn"><i class="fas ' +
      (active ? "fa-pause" : "fa-play") +
      '"></i></span>' +
      "</div>" +
      '<div class="song-info">' +
      '<div class="song-thumb">' +
      (song.artwork
        ? '<img src="' +
          song.artwork +
          '" alt="" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML=\'<div style=width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:16px;background:var(--bg-elevated)>🎵</div>\'">'
        : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:16px;background:var(--bg-elevated)">🎵</div>') +
      "</div>" +
      "<div>" +
      '<div class="song-name">' +
      this.escHtml(song.title) +
      "</div>" +
      '<div class="song-artist">' +
      this.escHtml(song.artist) +
      "</div>" +
      "</div>" +
      "</div>" +
      '<div class="song-album secondary truncate">' +
      this.escHtml(song.album || "") +
      "</div>" +
      '<div class="song-duration">' +
      this.formatTime(song.duration) +
      "</div>" +
      '<div class="song-heart ' +
      (liked ? "liked" : "") +
      '" onclick="event.stopPropagation(); State.toggleLike(\'' +
      song.id +
      '\'); this.classList.toggle(\'liked\', State.liked.has(\'' +
      song.id +
      '\')); this.innerHTML = State.liked.has(\'' +
      song.id +
      '\') ? \'<i class=\\\'fas fa-heart\\\'></i>\' : \'<i class=\\\'far fa-heart\\\'></i>\'">' +
      '<i class="' +
      (liked ? "fas" : "far") +
      ' fa-heart"></i>' +
      "</div>" +
      "</div>"
    );
  },

  renderQueue() {
    var scroll = document.querySelector(".queue-scroll");
    if (!scroll) return;

    if (State.queue.length === 0) {
      scroll.innerHTML =
        '<div style="text-align:center;padding:40px 16px;color:var(--text-muted);"><i class="fas fa-list" style="font-size:32px;margin-bottom:12px;display:block;"></i>Queue is empty</div>';
      return;
    }

    var current = State.currentSong;
    var upcoming = State.queue.slice(State.queueIndex + 1, State.queueIndex + 9);
    var html = "";

    if (current) {
      html += '<div class="queue-label">Now Playing</div>';
      html +=
        '<div class="queue-item now">' +
        '<div class="q-thumb">' +
        (current.artwork
          ? '<img src="' +
            current.artwork +
            '" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML=\'<div style=width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:18px;background:var(--bg-elevated)>🎵</div>\'">'
          : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:18px;background:var(--bg-elevated)">🎵</div>') +
        "</div>" +
        '<div class="q-info">' +
        '<div class="q-title">' +
        this.escHtml(current.title) +
        "</div>" +
        '<div class="q-artist">' +
        this.escHtml(current.artist) +
        "</div>" +
        "</div>" +
        '<div class="q-dur">' +
        this.formatTime(current.duration) +
        "</div>" +
        "</div>";
    }

    if (upcoming.length > 0) {
      html += '<div class="queue-label" style="margin-top:12px;">Up Next</div>';
      upcoming.forEach(function (s, i) {
        var realIdx = State.queueIndex + 1 + i;
        html +=
          '<div class="queue-item" onclick="Player.playSong(State.queue[' +
          realIdx +
          '])">' +
          '<div class="q-thumb">' +
          (s.artwork
            ? '<img src="' +
              s.artwork +
              '" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML=\'<div style=width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:18px;background:var(--bg-elevated)>🎵</div>\'">'
            : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:18px;background:var(--bg-elevated)">🎵</div>') +
          "</div>" +
          '<div class="q-info">' +
          '<div class="q-title">' +
          UI.escHtml(s.title) +
          "</div>" +
          '<div class="q-artist">' +
          UI.escHtml(s.artist) +
          "</div>" +
          "</div>" +
          '<div class="q-dur">' +
          UI.formatTime(s.duration) +
          "</div>" +
          "</div>";
      });
    }

    scroll.innerHTML = html;
  },

  renderLibrary() {
    var page = document.getElementById("page-library");
    if (!page) return;

    var liked = [...State.liked];
    var playlists = State.playlists;

    var html =
      '<div class="section-header">' +
      "<div>" +
      '<div class="section-title">Your Library</div>' +
      '<div class="section-sub">' +
      liked.length +
      " liked songs · " +
      playlists.length +
      " playlists</div>" +
      "</div>" +
      '<button class="see-all" onclick="openModal(\'modal-playlist\')" style="display:flex;align-items:center;gap:6px;">' +
      '<i class="fas fa-plus"></i> New Playlist' +
      "</button>" +
      "</div>";

    if (playlists.length > 0) {
      html +=
        '<div class="section-header" style="margin-top:24px;"><div><div class="section-title" style="font-size:18px;">📁 Your Playlists</div></div></div>';
      html += '<div class="cards-grid">';
      playlists.forEach(function (pl) {
        html +=
          '<div class="card" onclick="PlaylistManager.openPlaylist(\'' +
          pl.id +
          '\')" style="cursor:pointer;">' +
          '<div class="card-thumb" style="background:linear-gradient(135deg,#1db95433,#1db95411);display:flex;align-items:center;justify-content:center;font-size:48px;">📁</div>' +
          '<div class="card-title">' +
          UI.escHtml(pl.name) +
          "</div>" +
          '<div class="card-sub">' +
          pl.songs.length +
          " songs</div>" +
          '<button class="card-play" onclick="event.stopPropagation(); PlaylistManager.playPlaylist(\'' +
          pl.id +
          '\')"><i class="fas fa-play"></i></button>' +
          "</div>";
      });
      html += "</div>";
    }

    if (liked.length === 0) {
      html +=
        '<div class="no-results" style="margin-top:20px;"><i class="fas fa-heart"></i><h3>No liked songs yet</h3><p>Like songs to see them here</p></div>';
      page.innerHTML = html;
      return;
    }

    html +=
      '<div class="section-header" style="margin-top:24px;"><div><div class="section-title" style="font-size:18px;">❤️ Liked Songs</div></div></div>';

    var likedSongs = liked
      .map(function (id) { return window.__songRegistry["s_" + id]; })
      .filter(Boolean);

    // If missing, try to fetch basic info from iTunes lookup
    if (likedSongs.length < liked.length) {
      html +=
        '<div style="text-align:center;padding:20px;"><div class="spinner" style="margin:0 auto 12px;"></div>Loading your songs...</div>';
      page.innerHTML = html;

      var missingIds = liked.filter(function (id) { return !window.__songRegistry["s_" + id]; });

      Promise.all(
        missingIds.map(function (id) {
          return fetch("https://itunes.apple.com/lookup?id=" + id)
            .then(function (res) { return res.json(); })
            .then(function (json) {
              if (json.results && json.results[0]) {
                var t = json.results[0];
                var art = (t.artworkUrl100 || "").replace("100x100bb", "600x600bb");
                window.__songRegistry["s_" + id] = {
                  id: String(t.trackId),
                  title: t.trackName || "Unknown",
                  artist: t.artistName || "Unknown",
                  album: t.collectionName || "Unknown",
                  duration: Math.round((t.trackTimeMillis || 0) / 1000),
                  previewUrl: t.previewUrl || null,
                  artwork: art,
                  genre: t.primaryGenreName || "Music",
                  source: "itunes",
                };
              }
            })
            .catch(function () {});
        })
      ).then(function () {
        UI.renderLibrary();
      });

      return;
    }

    html +=
      '<div class="song-list">' +
      '<div class="song-list-head"><span>#</span><span>Title</span><span>Album</span><span><i class="fas fa-clock"></i></span><span></span></div>';

    likedSongs.forEach(function (s, i) {
      html += UI.renderSongRow(s, i);
    });

    html += "</div>";
    page.innerHTML = html;
  },
    renderSidebarLibrary(songs) {
    songs = songs || [];
    var container = document.getElementById("sidebar-library-container");
    if (!container) return;

    var liked = [...State.liked];
    var allSongs = [...songs];

    liked.forEach(function (id) {
      var song = window.__songRegistry["s_" + id];
      if (song && !allSongs.find(function (s) { return s.id === song.id; })) {
        allSongs.push(song);
      }
    });

    if (allSongs.length === 0) {
      container.innerHTML =
        '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px;"><i class="fas fa-music" style="font-size:24px;margin-bottom:8px;display:block;"></i>Play some music!</div>';
      return;
    }

    container.innerHTML =
      '<div class="library-header">' +
      '<span class="library-title">Your Library</span>' +
      '<button class="library-add-btn" onclick="openModal(\'modal-playlist\')" title="Create Playlist"><i class="fas fa-plus"></i></button>' +
      "</div>" +
      allSongs
        .slice(0, 15)
        .map(function (s) {
          UI._registerSong(s);
          return (
            '<div class="library-item" onclick="Player.playSong(window.__songRegistry[\'s_' +
            s.id +
            '\'])">' +
            '<div class="library-thumb">' +
            (s.artwork
              ? '<img src="' +
                s.artwork +
                '" alt="" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML=\'<div style=width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:18px;background:var(--bg-elevated)>🎵</div>\'">'
              : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:18px;background:var(--bg-elevated)">🎵</div>') +
            "</div>" +
            '<div class="library-item-info">' +
            '<div class="library-item-name">' +
            UI.escHtml(s.title) +
            "</div>" +
            '<div class="library-item-sub">' +
            UI.escHtml(s.artist) +
            "</div>" +
            "</div>" +
            "</div>"
          );
        })
        .join("");
  },

  renderSkeletonCards(count) {
    count = count || 6;
    return Array.from({ length: count }, function () {
      return (
        '<div class="card">' +
        '<div class="card-thumb skeleton" style="aspect-ratio:1;border-radius:var(--r-md);"></div>' +
        '<div class="skeleton" style="height:14px;width:80%;margin:12px 0 6px;border-radius:4px;"></div>' +
        '<div class="skeleton" style="height:12px;width:60%;border-radius:4px;"></div>' +
        "</div>"
      );
    }).join("");
  },

  renderSkeletonRows(count) {
    count = count || 5;
    return Array.from({ length: count }, function () {
      return (
        '<div class="song-row">' +
        '<div class="skeleton" style="width:24px;height:14px;border-radius:4px;"></div>' +
        '<div style="display:flex;align-items:center;gap:12px;">' +
        '<div class="skeleton" style="width:40px;height:40px;border-radius:6px;flex-shrink:0;"></div>' +
        "<div>" +
        '<div class="skeleton" style="height:13px;width:140px;border-radius:4px;margin-bottom:6px;"></div>' +
        '<div class="skeleton" style="height:11px;width:90px;border-radius:4px;"></div>' +
        "</div>" +
        "</div>" +
        '<div class="skeleton" style="height:13px;width:100px;border-radius:4px;"></div>' +
        '<div class="skeleton" style="height:13px;width:36px;border-radius:4px;"></div>' +
        "<div></div>" +
        "</div>"
      );
    }).join("");
  },

  openFullscreen() {
    var el = document.getElementById("fullscreen-player");
    if (el) el.classList.add("open");
  },

  closeFullscreen() {
    var el = document.getElementById("fullscreen-player");
    if (el) el.classList.remove("open");
    // also close lyrics overlay if open
    this.closeFsLyrics();
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

  /* ============================
     Mobile Lyrics Overlay
  ============================ */
  isMobile() {
    return window.matchMedia("(max-width: 900px)").matches;
  },

  openFsLyrics() {
  // Ensure fullscreen open
  var fs = document.getElementById("fullscreen-player");
  if (fs && !fs.classList.contains("open")) fs.classList.add("open");

  var panel = document.getElementById("fs-lyrics");
  if (!panel) {
    console.warn("fs-lyrics not found. Ensure #fs-lyrics is inside #fullscreen-player in index.html");
    return;
  }

  var song = State.currentSong;
  var t2 = document.getElementById("fs-lyrics-title");
  var a2 = document.getElementById("fs-lyrics-artist");
  if (t2) t2.textContent = song ? song.title : "Lyrics";
  if (a2) a2.textContent = song ? song.artist : "—";

  // Copy already rendered lyrics from right panel
  var src = document.getElementById("lyrics-lines");
  var dst = document.getElementById("fs-lyrics-lines");
  if (src && dst) dst.innerHTML = src.innerHTML;

  panel.classList.remove("hidden");

  // ✅ apply current highlight immediately (better sync)
  if (typeof Lyrics !== "undefined") {
    Lyrics.highlightLine(State.currentTime || 0);
  }
},


  closeFsLyrics() {
    var panel = document.getElementById("fs-lyrics");
    if (panel) panel.classList.add("hidden");
  },

  switchRightPanel(name) {
    // ✅ Mobile: lyrics overlay
    if (name === "lyrics" && this.isMobile()) {
      this.openFsLyrics();
      return;
    }

    document.querySelectorAll(".right-tab").forEach(function (t) {
      t.classList.toggle("active", t.dataset.panel === name);
    });
    document.querySelectorAll(".right-panel").forEach(function (p) {
      p.classList.toggle("active", p.id === "panel-" + name);
    });

    State.rightPanel = name;
    if (name === "queue") UI.renderQueue();
  },
};