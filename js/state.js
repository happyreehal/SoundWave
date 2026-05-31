/* ============================================================
   STATE — Single Source of Truth
============================================================ */
const State = {
  // Player
  queue:          [],
  queueIndex:     -1,
  isPlaying:      false,
  isShuffle:      false,
  repeatMode:     0,      // 0=off 1=all 2=one
  volume:         0.7,
  isMuted:        false,
  prevVolume:     0.7,
  currentTime:    0,
  duration:       0,
  isLoading:      false,

  // Library
  liked:          new Set(),
  playlists:      [],
  recentlyPlayed: [],

  // UI
  currentPage:    "home",
  rightPanel:     "queue",

  // Features
  sleepTimer:     null,
  sleepRemaining: 0,
  eqValues:       [0,0,0,0,0,0,0,0,0,0],
  crossfade:      false,

  // Getters
  get currentSong() {
    return this.queue[this.queueIndex] || null;
  },

  // Actions
  toggleLike(id) {
    if (this.liked.has(id)) this.liked.delete(id);
    else                    this.liked.add(id);
  },

  addToRecent(song) {
    this.recentlyPlayed = [
      song,
      ...this.recentlyPlayed.filter(s => s.id !== song.id)
    ].slice(0, 20);
  },

  addToQueue(song) {
    this.queue.push(song);
  },

  removeFromQueue(index) {
    this.queue.splice(index, 1);
    if (index < this.queueIndex) this.queueIndex--;
  },
};