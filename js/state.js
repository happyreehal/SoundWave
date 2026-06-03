/* ============================================================
   STATE — Single Source of Truth
   + Auto-continue playback, Listening stats
============================================================ */
const State = {
  // Playback
  queue:          [],
  queueIndex:     -1,
  isPlaying:      false,
  isShuffle:      false,
  repeatMode:     0,
  volume:         0.7,
  isMuted:        false,
  prevVolume:     0.7,
  currentTime:    0,
  duration:       0,
  isLoading:      false,

  // User data
  liked:          new Set(),
  playlists:      [],
  recentlyPlayed: [],
  searchHistory:  [],

  // Stats
  totalListenSeconds: 0,
  songPlayCounts:     {},  // { songId: { count, title, artist, artwork, lastPlayed } }
  artistPlayCounts:   {},  // { artistName: count }
  genrePlayCounts:    {},  // { genre: count }

  // Auto-continue
  lastSession: null,  // { song, currentTime, queue, queueIndex }

  // UI
  currentPage:    "home",
  rightPanel:     "queue",

  // Features
  sleepTimer:     null,
  sleepRemaining: 0,
  sleepEndOfSong: false,
  eqValues:       [0,0,0,0,0,0,0,0,0,0],

  // Auth
  currentUser:    null,
  isGuest:        false,

  // Internal
  _saveTimer: null,
  _sessionSaveTimer: null,

  get currentSong() {
    return this.queue[this.queueIndex] || null;
  },

  /* ═══════════════════════════════════════════════════════
     STORAGE KEYS
  ═══════════════════════════════════════════════════════ */
  _getStorageKey() {
    if (this.currentUser && this.currentUser.uid) {
      return "sw_data_" + this.currentUser.uid;
    }
    return "sw_data_guest";
  },

  _getSessionKey() {
    if (this.currentUser && this.currentUser.uid) {
      return "sw_session_" + this.currentUser.uid;
    }
    return "sw_session_guest";
  },

  /* ═══════════════════════════════════════════════════════
     SAVE
  ═══════════════════════════════════════════════════════ */
  save() {
    try {
      const data = {
        liked:              [...this.liked],
        playlists:          this.playlists,
        recentlyPlayed:     this.recentlyPlayed.slice(0, 30),
        searchHistory:      this.searchHistory.slice(0, 20),
        volume:             this.volume,
        totalListenSeconds: this.totalListenSeconds,
        songPlayCounts:     this.songPlayCounts,
        artistPlayCounts:   this.artistPlayCounts,
        genrePlayCounts:    this.genrePlayCounts,
      };
      localStorage.setItem(this._getStorageKey(), JSON.stringify(data));

      // Firebase sync (debounced)
      if (this.currentUser && !this.isGuest && typeof FB !== "undefined") {
        if (this._saveTimer) clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => {
          FB.saveUserData();
        }, 1000);
      }
    } catch (e) {
      console.warn("State save error:", e.message);
    }
  },

  /* Save current session for auto-continue */
  saveSession() {
    try {
      if (!this.currentSong) return;
      const session = {
        song:        this.currentSong,
        currentTime: this.currentTime,
        queue:       this.queue.slice(0, 50),  // limit
        queueIndex:  this.queueIndex,
        timestamp:   Date.now(),
      };
      localStorage.setItem(this._getSessionKey(), JSON.stringify(session));
    } catch (e) {
      console.warn("Session save error:", e.message);
    }
  },

  loadSession() {
    try {
      const raw = localStorage.getItem(this._getSessionKey());
      if (!raw) return null;
      const session = JSON.parse(raw);
      // Don't restore if older than 24 hours
      if (Date.now() - session.timestamp > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(this._getSessionKey());
        return null;
      }
      this.lastSession = session;
      return session;
    } catch (e) {
      return null;
    }
  },

  clearSession() {
    localStorage.removeItem(this._getSessionKey());
    this.lastSession = null;
  },

  /* ═══════════════════════════════════════════════════════
     LOAD
  ═══════════════════════════════════════════════════════ */
  load() {
    try {
      const raw = localStorage.getItem(this._getStorageKey());
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.liked)              this.liked              = new Set(data.liked);
      if (data.playlists)          this.playlists          = data.playlists;
      if (data.recentlyPlayed)     this.recentlyPlayed     = data.recentlyPlayed;
      if (data.searchHistory)      this.searchHistory      = data.searchHistory;
      if (typeof data.volume === "number") this.volume     = data.volume;
      if (data.totalListenSeconds) this.totalListenSeconds = data.totalListenSeconds;
      if (data.songPlayCounts)     this.songPlayCounts     = data.songPlayCounts;
      if (data.artistPlayCounts)   this.artistPlayCounts   = data.artistPlayCounts;
      if (data.genrePlayCounts)    this.genrePlayCounts    = data.genrePlayCounts;

      // Load session
      this.loadSession();
    } catch (e) {
      console.warn("State load error:", e.message);
    }
  },

  /* ═══════════════════════════════════════════════════════
     CLEAR USER DATA (on logout)
  ═══════════════════════════════════════════════════════ */
  clearUserData() {
    this.liked              = new Set();
    this.playlists          = [];
    this.recentlyPlayed     = [];
    this.searchHistory      = [];
    this.totalListenSeconds = 0;
    this.songPlayCounts     = {};
    this.artistPlayCounts   = {};
    this.genrePlayCounts    = {};
    this.queue              = [];
    this.queueIndex         = -1;
    this.lastSession        = null;
  },

  /* ═══════════════════════════════════════════════════════
     PLAYLIST MANAGEMENT
  ═══════════════════════════════════════════════════════ */
  createPlaylist(name) {
    const id = "pl_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
    const playlist = {
      id,
      name,
      songs: [],
      cover: null,
      coverGradient: this._randomGradient(),
      createdAt: new Date().toISOString(),
    };
    this.playlists.push(playlist);
    this.save();
    return playlist;
  },

  deletePlaylist(id) {
    this.playlists = this.playlists.filter(p => p.id !== id);
    this.save();
  },

  renamePlaylist(id, newName) {
    const pl = this.playlists.find(p => p.id === id);
    if (!pl) return false;
    pl.name = newName;
    this.save();
    return true;
  },

  addToPlaylist(playlistId, song) {
    const pl = this.playlists.find(p => p.id === playlistId);
    if (!pl) return false;
    if (pl.songs.find(s => s.id === song.id)) return false;

    // ✅ Store full song object (deep copy)
    pl.songs.push({
      id:         song.id,
      title:      song.title,
      artist:     song.artist,
      album:      song.album || "",
      duration:   song.duration || 0,
      artwork:    song.artwork || "",
      previewUrl: song.previewUrl || null,
      genre:      song.genre || "Music",
      itunesUrl:  song.itunesUrl || "",
      source:     song.source || "itunes",
    });

    if (!pl.cover && song.artwork) {
      pl.cover = song.artwork;
    }
    this.save();
    return true;
  },

  removeFromPlaylist(playlistId, songId) {
    const pl = this.playlists.find(p => p.id === playlistId);
    if (!pl) return;
    pl.songs = pl.songs.filter(s => s.id !== songId);

    if (pl.songs.length > 0 && pl.songs[0].artwork) {
      pl.cover = pl.songs[0].artwork;
    } else if (pl.songs.length === 0) {
      pl.cover = null;
    }
    this.save();
  },

  _randomGradient() {
    const n = Math.floor(Math.random() * 6) + 1;
    return "gradient-" + n;
  },

  /* ═══════════════════════════════════════════════════════
     LIKED SONGS
  ═══════════════════════════════════════════════════════ */
  toggleLike(id) {
    if (this.liked.has(id)) this.liked.delete(id);
    else                    this.liked.add(id);
    this.save();
  },

  /* ═══════════════════════════════════════════════════════
     RECENTLY PLAYED
  ═══════════════════════════════════════════════════════ */
  addToRecent(song) {
    if (!song || !song.id) return;
    // Store full deep copy
    const songCopy = {
      id:         song.id,
      title:      song.title,
      artist:     song.artist,
      album:      song.album || "",
      duration:   song.duration || 0,
      artwork:    song.artwork || "",
      previewUrl: song.previewUrl || null,
      genre:      song.genre || "Music",
      itunesUrl:  song.itunesUrl || "",
      source:     song.source || "itunes",
    };
    this.recentlyPlayed = [
      songCopy,
      ...this.recentlyPlayed.filter(s => s.id !== song.id)
    ].slice(0, 30);
    this.save();
  },

  /* ═══════════════════════════════════════════════════════
     SEARCH HISTORY
  ═══════════════════════════════════════════════════════ */
  addToSearchHistory(query) {
    if (!query || !query.trim()) return;
    const q = query.trim();
    this.searchHistory = [
      q,
      ...this.searchHistory.filter(s => s.toLowerCase() !== q.toLowerCase())
    ].slice(0, 20);
    this.save();
  },

  clearSearchHistory() {
    this.searchHistory = [];
    this.save();
  },

  /* ═══════════════════════════════════════════════════════
     QUEUE
  ═══════════════════════════════════════════════════════ */
  addToQueue(song) {
    this.queue.push(song);
  },

  removeFromQueue(index) {
    this.queue.splice(index, 1);
    if (index < this.queueIndex) this.queueIndex--;
  },

  /* ═══════════════════════════════════════════════════════
     LISTENING STATS
  ═══════════════════════════════════════════════════════ */
  trackListening(seconds) {
    this.totalListenSeconds += seconds;
    // Save less frequently (every 30 seconds)
    if (this.totalListenSeconds % 30 < 1) {
      this.save();
    }
  },

  trackSongPlay(song) {
    if (!song || !song.id) return;

    // Song count
    if (!this.songPlayCounts[song.id]) {
      this.songPlayCounts[song.id] = {
        count:      0,
        title:      song.title,
        artist:     song.artist,
        artwork:    song.artwork,
        lastPlayed: Date.now(),
      };
    }
    this.songPlayCounts[song.id].count++;
    this.songPlayCounts[song.id].lastPlayed = Date.now();

    // Artist count
    if (song.artist) {
      const artists = song.artist.split(/[,&]/).map(a => a.trim()).filter(Boolean);
      artists.forEach(artist => {
        this.artistPlayCounts[artist] = (this.artistPlayCounts[artist] || 0) + 1;
      });
    }

    // Genre count
    if (song.genre) {
      this.genrePlayCounts[song.genre] = (this.genrePlayCounts[song.genre] || 0) + 1;
    }

    this.save();
  },

  /* Get top stats */
  getTopSongs(limit = 5) {
    return Object.entries(this.songPlayCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, limit)
      .map(([id, data]) => ({ id, ...data }));
  },

  getTopArtists(limit = 5) {
    return Object.entries(this.artistPlayCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([name, count]) => ({ name, count }));
  },

  getTopGenres(limit = 3) {
    return Object.entries(this.genrePlayCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([name, count]) => ({ name, count }));
  },

  getTotalListenTime() {
    const sec = this.totalListenSeconds;
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    return { hours, minutes, totalSeconds: sec };
  },
};

// Initial load (guest data, will be overridden on login)
State.load();