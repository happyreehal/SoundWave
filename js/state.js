/* ============================================================
   STATE — Single Source of Truth
   Fixed: User isolation, playlists save, search history
============================================================ */
const State = {
  // Playback
  queue:          [],
  queueIndex:     -1,
  isPlaying:      false,
  isShuffle:      false,
  repeatMode:     0,        // 0=off, 1=all, 2=one
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

  // UI
  currentPage:    "home",
  rightPanel:     "queue",

  // Features
  sleepTimer:     null,
  sleepRemaining: 0,
  eqValues:       [0,0,0,0,0,0,0,0,0,0],
  crossfade:      false,

  // Auth
  currentUser:    null,
  isGuest:        false,

  /* ═══════════════════════════════════════════════════════
     COMPUTED
  ═══════════════════════════════════════════════════════ */
  get currentSong() {
    return this.queue[this.queueIndex] || null;
  },

  /* ═══════════════════════════════════════════════════════
     STORAGE KEY (user-specific)
     - Logged in user: sw_data_<uid>
     - Guest: sw_data_guest
  ═══════════════════════════════════════════════════════ */
  _getStorageKey() {
    if (this.currentUser && this.currentUser.uid) {
      return "sw_data_" + this.currentUser.uid;
    }
    return "sw_data_guest";
  },

  /* ═══════════════════════════════════════════════════════
     SAVE TO LOCALSTORAGE + FIREBASE (if logged in)
  ═══════════════════════════════════════════════════════ */
  save() {
    try {
      const data = {
        liked:          [...this.liked],
        playlists:      this.playlists,
        recentlyPlayed: this.recentlyPlayed.slice(0, 30),
        searchHistory:  this.searchHistory.slice(0, 20),
        volume:         this.volume,
      };
      localStorage.setItem(this._getStorageKey(), JSON.stringify(data));

      // ✅ Auto-sync to Firebase (debounced)
      if (this.currentUser && !this.isGuest && typeof FB !== "undefined") {
        if (this._saveTimer) clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => {
          FB.saveUserData();
        }, 800);
      }
    } catch (e) {
      console.warn("State save error:", e.message);
    }
  },

  /* ═══════════════════════════════════════════════════════
     LOAD FROM LOCALSTORAGE
  ═══════════════════════════════════════════════════════ */
  load() {
    try {
      const raw = localStorage.getItem(this._getStorageKey());
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.liked)          this.liked          = new Set(data.liked);
      if (data.playlists)      this.playlists      = data.playlists;
      if (data.recentlyPlayed) this.recentlyPlayed = data.recentlyPlayed;
      if (data.searchHistory)  this.searchHistory  = data.searchHistory;
      if (typeof data.volume === "number") this.volume = data.volume;
    } catch (e) {
      console.warn("State load error:", e.message);
    }
  },

  /* ═══════════════════════════════════════════════════════
     CLEAR ALL USER DATA (on logout / user switch)
  ═══════════════════════════════════════════════════════ */
  clearUserData() {
    this.liked          = new Set();
    this.playlists      = [];
    this.recentlyPlayed = [];
    this.searchHistory  = [];
    this.queue          = [];
    this.queueIndex     = -1;
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
      cover: null,         // auto-set from first song
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
    if (pl.songs.find(s => s.id === song.id)) return false; // already exists
    pl.songs.push(song);

    // Auto-set cover from first song
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

    // Update cover if removed song was the cover
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
    this.recentlyPlayed = [
      song,
      ...this.recentlyPlayed.filter(s => s.id !== song.id)
    ].slice(0, 30);
    this.save();
  },

  /* ═══════════════════════════════════════════════════════
     SEARCH HISTORY
  ═══════════════════════════════════════════════════════ */
  addToSearchHistory(query) {
    if (!query || !query.trim()) return;
    const q = query.trim().toLowerCase();
    this.searchHistory = [
      query.trim(),
      ...this.searchHistory.filter(s => s.toLowerCase() !== q)
    ].slice(0, 20);
    this.save();
  },

  clearSearchHistory() {
    this.searchHistory = [];
    this.save();
  },

  /* ═══════════════════════════════════════════════════════
     QUEUE MANAGEMENT
  ═══════════════════════════════════════════════════════ */
  addToQueue(song) {
    this.queue.push(song);
  },

  removeFromQueue(index) {
    this.queue.splice(index, 1);
    if (index < this.queueIndex) this.queueIndex--;
  },
};

// Initial load (will load guest data if no user logged in yet)
State.load();