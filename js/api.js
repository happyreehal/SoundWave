/* ============================================================
   API.JS — Fixed Version
   Fixes: Image loading, caching, real lyrics from LRCLIB
============================================================ */
const API = {
  ITUNES_BASE: "https://itunes.apple.com",
  LYRICS_BASE: "https://lrclib.net/api",
  _cache: new Map(),
  _cacheExpiry: 5 * 60 * 1000,

  SERVER: window.location.hostname === "happyreehal.github.io"
    ? "https://soundwave-backend-ivory.vercel.app"
    : window.location.hostname === "sound-wave-peach.vercel.app"
      ? "https://soundwave-backend-ivory.vercel.app"
      : window.location.port === "3000"
        ? "http://localhost:3000"
        : null,

  AUDIUS_NODES: [
    "https://discoveryprovider.audius.co",
    "https://discoveryprovider2.audius.co",
    "https://discoveryprovider3.audius.co",
  ],

  async search(query, limit) {
    limit = limit || 20;
    if (!query || !query.trim()) return [];
    const cacheKey = query.toLowerCase().trim() + "_" + limit;
    const cached = this._cache.get(cacheKey);
    if (cached && Date.now() - cached.time < this._cacheExpiry) {
      console.log("Cache hit:", query);
      return cached.data;
    }
    try {
      const url = this.SERVER
        ? this.SERVER + "/api/search?q=" + encodeURIComponent(query) + "&limit=" + limit
        : this.ITUNES_BASE + "/search?term=" + encodeURIComponent(query) + "&media=music&entity=song&limit=" + limit;
      const res  = await fetch(url);
      const data = await res.json();
      let results;
      if (this.SERVER && data.results) {
        results = data.results;
      } else {
        results = (data.results || []).filter(function(t) {
          return t.trackId && t.trackName;
        }).map(function(t) {
          return API.formatItunesTrack(t);
        });
      }
      this._cache.set(cacheKey, { data: results, time: Date.now() });
      return results;
    } catch (e) {
      console.error("Search failed:", e.message);
      return [];
    }
  },

  async getPlayableUrl(song) {
    if (!song) return null;
    console.log("Finding:", song.title, "-", song.artist);
    if (this.SERVER) {
      const url = await this.getSaavnFromServer(song);
      if (url) { console.log("JioSaavn full song!"); return url; }
    }
    if (this.SERVER) {
      const url = await this.getAudiusFromServer(song);
      if (url) { console.log("Audius via server!"); return url; }
    }
    if (!this.SERVER) {
      const url = await this.getAudiusDirect(song);
      if (url) { console.log("Audius direct!"); return url; }
    }
    if (song.previewUrl) {
      console.log("iTunes 30sec preview only");
      UI.showToast("30sec preview — Run: node server.js for full songs", "fas fa-info-circle", "yellow");
      return song.previewUrl;
    }
    console.warn("No audio source found for:", song.title);
    return null;
  },

  async getSaavnFromServer(song) {
    try {
      const res = await fetch(
        this.SERVER + "/api/saavn?" +
          "title="   + encodeURIComponent(song.title)      +
          "&artist=" + encodeURIComponent(song.artist || "") +
          "&album="  + encodeURIComponent(song.album  || ""),
        { signal: AbortSignal.timeout(12000) }
      );
      const data = await res.json();
      if (data.success && data.url) {
        console.log("JioSaavn matched:", data.matched, "(score:" + data.score + ")");
        return data.url;
      }
      return null;
    } catch (e) {
      console.warn("Saavn server error:", e.message);
      return null;
    }
  },

  async getAudiusFromServer(song) {
    try {
      const res = await fetch(
        this.SERVER + "/api/audius?" +
          "title="   + encodeURIComponent(song.title)      +
          "&artist=" + encodeURIComponent(song.artist || ""),
        { signal: AbortSignal.timeout(10000) }
      );
      const data = await res.json();
      if (data.success && data.url) {
        console.log("Audius matched:", data.matched);
        return data.url;
      }
      return null;
    } catch (e) {
      console.warn("Audius server error:", e.message);
      return null;
    }
  },

  async getAudiusDirect(song) {
    const query = song.title + " " + song.artist;
    for (let i = 0; i < this.AUDIUS_NODES.length; i++) {
      const node = this.AUDIUS_NODES[i];
      try {
        const res = await fetch(
          node + "/v1/tracks/search?query=" + encodeURIComponent(query) + "&limit=10&app_name=SoundWavePro",
          { signal: AbortSignal.timeout(5000) }
        );
        if (!res.ok) continue;
        const data   = await res.json();
        const tracks = data.data || [];
        if (!tracks.length) continue;
        const match = this.findBestMatch(
          tracks, song.title, song.artist,
          function(t) { return t.title; },
          function(t) { return t.user && t.user.name; }
        );
        if (!match) continue;
        console.log("Audius direct:", match.title, "by", (match.user && match.user.name));
        return node + "/v1/tracks/" + match.id + "/stream?app_name=SoundWavePro";
      } catch (e) { continue; }
    }
    return null;
  },

  // ✅ FIXED: 3 strategies + 15sec timeout
  async getLyrics(song) {
    if (!song) return null;
    try {
      // ✅ Strategy 1: Title + Artist + Album
      const url1 = this.LYRICS_BASE + "/get?" +
        "track_name="   + encodeURIComponent(song.title)      +
        "&artist_name=" + encodeURIComponent(song.artist)     +
        "&album_name="  + encodeURIComponent(song.album || "");
      const res1 = await fetch(url1, { signal: AbortSignal.timeout(15000) });
      if (res1.ok) {
        const data = await res1.json();
        if (data.syncedLyrics) return this.parseSyncedLyrics(data.syncedLyrics);
        if (data.plainLyrics)  return this.parsePlainLyrics(data.plainLyrics, song.duration || 200);
      }

      // ✅ Strategy 2: Title + Artist only
      const url2 = this.LYRICS_BASE + "/get?" +
        "track_name="   + encodeURIComponent(song.title) +
        "&artist_name=" + encodeURIComponent(song.artist);
      const res2 = await fetch(url2, { signal: AbortSignal.timeout(15000) });
      if (res2.ok) {
        const data = await res2.json();
        if (data.syncedLyrics) return this.parseSyncedLyrics(data.syncedLyrics);
        if (data.plainLyrics)  return this.parsePlainLyrics(data.plainLyrics, song.duration || 200);
      }

      // ✅ Strategy 3: Search endpoint
      const url3 = this.LYRICS_BASE + "/search?" +
        "track_name="   + encodeURIComponent(song.title) +
        "&artist_name=" + encodeURIComponent(song.artist);
      const res3 = await fetch(url3, { signal: AbortSignal.timeout(15000) });
      if (res3.ok) {
        const results = await res3.json();
        if (results && results.length > 0) {
          const detail = await fetch(
            this.LYRICS_BASE + "/get/" + results[0].id,
            { signal: AbortSignal.timeout(15000) }
          );
          if (detail.ok) {
            const data = await detail.json();
            if (data.syncedLyrics) return this.parseSyncedLyrics(data.syncedLyrics);
            if (data.plainLyrics)  return this.parsePlainLyrics(data.plainLyrics, song.duration || 200);
          }
        }
      }

      return null;
    } catch (e) {
      console.warn("Lyrics fetch failed:", e.message);
      return null;
    }
  },

  // ✅ FIXED: Correct regex + empty lines skip
  parseSyncedLyrics(text) {
    const lines = [];
    const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const time = parseInt(match[1]) * 60 + parseInt(match[2]);
      const txt  = match[4].trim();
      if (txt) lines.push({ time, text: txt }); // ✅ Empty lines skip
    }
    return lines.length > 0 ? lines : null;
  },

  parsePlainLyrics(text, duration) {
    const lines = text.split("\n").filter(function(l) { return l.trim(); });
    const timePerLine = duration / lines.length;
    return lines.map(function(line, i) {
      return { time: Math.round(i * timePerLine), text: line.trim() };
    });
  },

  findBestMatch(items, title, artist, getTitle, getArtist) {
    const tT = this.clean(title);
    const tA = this.clean(artist);
    const scored = items.map(function(item) {
      const iT = API.clean(getTitle(item)  || "");
      const iA = API.clean(getArtist(item) || "");
      let score = 0;
      if (iT === tT)               score += 100;
      else if (iT.indexOf(tT) !== -1) score += 70;
      else if (tT.indexOf(iT) !== -1) score += 50;
      else {
        const tw = tT.split(" ").filter(function(w) { return w.length > 2; });
        const iw = iT.split(" ").filter(function(w) { return w.length > 2; });
        score += tw.filter(function(w) { return iw.indexOf(w) !== -1; }).length * 15;
      }
      if (iA === tA)               score += 50;
      else if (iA.indexOf(tA) !== -1) score += 35;
      else if (tA.indexOf(iA) !== -1) score += 25;
      return { item: item, score: score };
    });
    scored.sort(function(a, b) { return b.score - a.score; });
    const best = scored[0];
    return best && best.score >= 50 ? best.item : null;
  },

  clean(str) {
    str = str || "";
    return str.toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .replace(/\b(official|audio|video|lyrics|feat|ft|featuring|hd|remix|cover|live|version|acoustic)\b/g, "")
      .replace(/\s+/g, " ")
      .trim();
  },

  formatItunesTrack(t) {
    const art = (t.artworkUrl100 || "")
      .replace("100x100bb", "600x600bb")
      .replace("100x100",   "600x600");
    return {
      id:         String(t.trackId),
      title:      t.trackName         || "Unknown",
      artist:     t.artistName        || "Unknown",
      album:      t.collectionName    || "Unknown",
      duration:   Math.round((t.trackTimeMillis || 0) / 1000),
      previewUrl: t.previewUrl        || null,
      artwork:    art,
      genre:      t.primaryGenreName  || "Music",
      explicit:   t.trackExplicitness === "explicit",
      itunesUrl:  t.trackViewUrl      || "#",
      source:     "itunes",
    };
  },

  async getCharts(limit) {
    limit = limit || 20;
    try {
      const songs = await this.search("top hits 2024", limit);
      if (songs.length > 0) return songs;
      return await this.search("popular songs", limit);
    } catch (e) {
      return [];
    }
  },

  async testConnection() {
    console.log("Testing connections...");
    console.log("Mode:", this.SERVER ? "Node.js Server (Full songs)" : "Browser only (30sec previews)");
    console.log("SERVER URL:", this.SERVER);
    if (this.SERVER) {
      try {
        const r = await fetch(this.SERVER + "/api/health");
        const d = await r.json();
        console.log("Server:", d.status);
      } catch (e) {
        console.log("Server: Not running -", e.message);
      }
    }
  },
};