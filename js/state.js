/* ============================================================
   STATE — Single Source of Truth
   + Auto-continue, Stats, Language detection, Smart playlists
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

  // Queue context
  _isPlaylistMode: false,
  _searchContext:  null,

  // User data
  liked:          new Set(),
  playlists:      [],
  recentlyPlayed: [],
  searchHistory:  [],

  // Stats
  totalListenSeconds: 0,
  songPlayCounts:     {},
  artistPlayCounts:   {},
  genrePlayCounts:    {},

  // Auto-continue
  lastSession: null,

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
  _saveTimer:        null,
  _sessionSaveTimer: null,

  get currentSong() {
    return this.queue[this.queueIndex] || null;
  },

  /* ═══════════════════════════════════════════════════════
     LANGUAGE DETECTION — Artist database
  ═══════════════════════════════════════════════════════ */
  _ARTIST_LANGUAGE_DB: {
    punjabi: [
      "diljit dosanjh", "sidhu moose wala", "ap dhillon", "karan aujla",
      "nirvair pannu", "sharry mann", "ammy virk", "jassie gill",
      "babbu maan", "gippy grewal", "jasmine sandlas", "nimrat khaira",
      "shubh", "imran khan", "miss pooja", "manmohan waris",
      "harbhajan mann", "satinder sartaj", "ranjit bawa", "kulwinder billa",
      "kambi", "garry sandhu", "ninja", "parmish verma",
      "amrit maan", "mankirt aulakh", "elly mangat", "guru randhawa",
      "yo yo honey singh", "j star", "kaur b", "noor chahal",
      "deol harman", "tarsem jassar", "mandy takhar", "jass manak",
      "sidhu", "moosewala", "honey singh"
    ],
    hindi: [
      "arijit singh", "atif aslam", "shreya ghoshal", "sonu nigam",
      "neha kakkar", "armaan malik", "a.r. rahman", "ar rahman",
      "pritam", "vishal shekhar", "vishal-shekhar", "shankar mahadevan",
      "kishore kumar", "lata mangeshkar", "asha bhosle", "mohammed rafi",
      "kumar sanu", "udit narayan", "alka yagnik", "kk",
      "mohit chauhan", "papon", "rahat fateh ali khan", "ankit tiwari",
      "jubin nautiyal", "darshan raval", "tony kakkar", "sunidhi chauhan",
      "shaan", "monali thakur", "amit trivedi", "salim sulaiman",
      "tulsi kumar", "palak muchhal", "asees kaur", "dhvani bhanushali",
      "badshah", "raftaar", "ikka", "divine", "naezy",
      "anuv jain", "prateek kuhad", "the local train", "amit mishra"
    ],
    english: [
      "taylor swift", "ed sheeran", "drake", "the weeknd",
      "justin bieber", "billie eilish", "post malone", "ariana grande",
      "dua lipa", "harry styles", "olivia rodrigo", "bruno mars",
      "adele", "rihanna", "beyonce", "katy perry",
      "imagine dragons", "coldplay", "maroon 5", "one direction",
      "shawn mendes", "charlie puth", "sam smith", "lewis capaldi",
      "selena gomez", "miley cyrus", "demi lovato", "kendrick lamar",
      "travis scott", "lil nas x", "doja cat", "sza",
      "the chainsmokers", "calvin harris", "david guetta", "marshmello",
      "alan walker", "kygo", "zedd", "chris brown",
      "eminem", "kanye west", "jay-z", "linkin park",
      "metallica", "arctic monkeys", "tame impala", "the beatles",
      "queen", "elvis presley", "michael jackson", "madonna",
      "lana del rey", "lorde", "halsey", "camila cabello",
      "tyla", "sza", "j cole", "21 savage"
    ],
  },

  detectLanguage(song) {
    if (!song) return null;

    const artist = (song.artist || "").toLowerCase().trim();
    const genre  = (song.genre  || "").toLowerCase().trim();
    const album  = (song.album  || "").toLowerCase().trim();

    // Layer 1: Artist database (most reliable)
    for (const lang in this._ARTIST_LANGUAGE_DB) {
      for (const dbArtist of this._ARTIST_LANGUAGE_DB[lang]) {
        if (artist.includes(dbArtist)) {
          return lang;
        }
      }
    }

    // Layer 2: Genre hints
    if (genre.includes("bollywood") || genre.includes("hindi")) return "hindi";
    if (genre.includes("punjabi")) return "punjabi";
    if (genre.includes("k-pop"))   return "korean";
    if (genre.includes("latin"))   return "latin";

    // Layer 3: Album/artist keyword hints
    const punjabiKeywords = ["punjabi", "desi", "pind"];
    const hindiKeywords   = ["bollywood", "filmy", "hindi"];

    for (const kw of punjabiKeywords) {
      if (album.includes(kw) || artist.includes(kw)) return "punjabi";
    }
    for (const kw of hindiKeywords) {
      if (album.includes(kw) || artist.includes(kw)) return "hindi";
    }

    // Layer 4: World/Worldwide genre → likely Indian
    if (genre === "world" || genre === "worldwide" || genre === "indian pop") {
      return "indian";
    }

    return null; // unknown — default English
  },

  getLanguageSearchSuffix(language) {
    const map = {
      punjabi: "punjabi hits",
      hindi:   "bollywood hindi songs",
      indian:  "bollywood punjabi hits",
      english: "english pop hits",
      korean:  "kpop hits",
      latin:   "latin hits",
    };
    return map[language] || null;
  },

  /* ═══════════════════════════════════════════════════════
     STORAGE KEYS (user-specific)
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

  /* Session for auto-continue */
  saveSession() {
    try {
      if (!this.currentSong) return;
      const session = {
        song:        this.currentSong,
        currentTime: this.currentTime,
        queue:       this.queue.slice(0, 50),
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
    this._isPlaylistMode    = false;
    this._searchContext     = null;
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
    if (this.totalListenSeconds % 30 < 1) {
      this.save();
    }
  },

  trackSongPlay(song) {
    if (!song || !song.id) return;

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

    if (song.artist) {
      const artists = song.artist.split(/[,&]/).map(a => a.trim()).filter(Boolean);
      artists.forEach(artist => {
        this.artistPlayCounts[artist] = (this.artistPlayCounts[artist] || 0) + 1;
      });
    }

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

  /* ═══════════════════════════════════════════════════════
     SMART PLAYLISTS
  ═══════════════════════════════════════════════════════ */
  getRecentlyLiked() {
    const recentLikedIds = [...this.liked].slice(-20).reverse();
    return recentLikedIds
      .map(id => window.__songRegistry["s_" + id])
      .filter(Boolean);
  },

  getMostPlayedSongs(limit = 20) {
    return Object.entries(this.songPlayCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, limit)
      .map(([id, data]) => {
        return window.__songRegistry["s_" + id] || {
          id,
          title: data.title,
          artist: data.artist,
          artwork: data.artwork,
          duration: 0,
        };
      })
      .filter(s => s && s.title);
  },

  getTopArtistForRecommendations() {
    const top = this.getTopArtists(1);
    return top.length > 0 ? top[0].name : null;
  },
};

// Initial load (guest data, overridden on login)
State.load();