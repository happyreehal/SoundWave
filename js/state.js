/* ============================================================
   STATE — Single Source of Truth (Fixed)
   Added: playlists, user-specific data isolation
============================================================ */
const State = {
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
  liked:          new Set(),
  playlists:      [],
  recentlyPlayed: [],
  currentPage:    "home",
  rightPanel:     "queue",
  sleepTimer:     null,
  sleepRemaining: 0,
  eqValues:       [0,0,0,0,0,0,0,0,0,0],
  crossfade:      false,
  currentUser:    null,
  isGuest:        false,

  get currentSong() {
    return this.queue[this.queueIndex] || null;
  },

  save() {
    try {
      const data = {
        liked: [...this.liked],
        playlists: this.playlists,
        recentlyPlayed: this.recentlyPlayed,
        volume: this.volume,
      };
      localStorage.setItem("sw_data", JSON.stringify(data));
    } catch(e) {}
  },

  load() {
    try {
      const raw = localStorage.getItem("sw_data");
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.liked)          this.liked          = new Set(data.liked);
      if (data.playlists)      this.playlists      = data.playlists;
      if (data.recentlyPlayed) this.recentlyPlayed = data.recentlyPlayed;
      if (data.volume)         this.volume         = data.volume;
    } catch(e) {}
  },

  createPlaylist(name) {
    const id = "pl_" + Date.now();
    const playlist = { id, name, songs: [], createdAt: new Date().toISOString() };
    this.playlists.push(playlist);
    this.save();
    return playlist;
  },

  deletePlaylist(id) {
    this.playlists = this.playlists.filter(p => p.id !== id);
    this.save();
  },

  addToPlaylist(playlistId, song) {
    const pl = this.playlists.find(p => p.id === playlistId);
    if (!pl) return false;
    if (!pl.songs.find(s => s.id === song.id)) {
      pl.songs.push(song);
      this.save();
    }
    return true;
  },

  removeFromPlaylist(playlistId, songId) {
    const pl = this.playlists.find(p => p.id === playlistId);
    if (!pl) return;
    pl.songs = pl.songs.filter(s => s.id !== songId);
    this.save();
  },

  toggleLike(id) {
    if (this.liked.has(id)) this.liked.delete(id);
    else                    this.liked.add(id);
    this.save();
    if (this.currentUser && !this.isGuest) {
      FB.saveUserData();
    }
  },

  addToRecent(song) {
    this.recentlyPlayed = [song, ...this.recentlyPlayed.filter(s => s.id !== song.id)].slice(0, 20);
    this.save();
  },

  addToQueue(song) {
    this.queue.push(song);
  },

  removeFromQueue(index) {
    this.queue.splice(index, 1);
    if (index < this.queueIndex) this.queueIndex--;
  },
};

State.load();