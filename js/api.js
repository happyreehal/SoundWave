/* ============================================================
   API.JS — iTunes + Saavn + Audius + LRCLIB
   Fixed: Fuzzy search, suggestions, better matching
============================================================ */
const API = {
  ITUNES_BASE: "https://itunes.apple.com",
  LYRICS_BASE: "https://lrclib.net/api",

  _cache:        new Map(),
  _cacheExpiry:  5 * 60 * 1000,

  SERVER:
    window.location.hostname === "happyreehal.github.io"
      ? "https://soundwave-backend-ivory.vercel.app"
      : window.location.hostname === "sound-wave-peach.vercel.app"
        ? "https://soundwave-backend-ivory.vercel.app"
        : window.location.port === "3000"
          ? "http://localhost:3000"
          : "https://soundwave-backend-ivory.vercel.app",

  AUDIUS_NODES: [
    "https://discoveryprovider.audius.co",
    "https://discoveryprovider2.audius.co",
    "https://discoveryprovider3.audius.co",
  ],

  /* ═══════════════════════════════════════════════════════
     Fetch helper with timeout
  ═══════════════════════════════════════════════════════ */
  _fetchJsonWithTimeout(url, ms = 12000) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), ms);
    return fetch(url, { signal: controller.signal })
      .then(r => r.json())
      .finally(() => clearTimeout(t));
  },

  /* ═══════════════════════════════════════════════════════
     SEARCH — iTunes (with fuzzy + suggestions support)
  ═══════════════════════════════════════════════════════ */
  async search(query, limit = 20) {
    if (!query || !query.trim()) return [];

    const cacheKey = query.toLowerCase().trim() + "_" + limit;
    const cached = this._cache.get(cacheKey);
    if (cached && Date.now() - cached.time < this._cacheExpiry) {
      console.log("Cache hit:", query);
      return cached.data;
    }

    try {
      // ✅ Try multiple query variations for better results
      const queries = [
        query.trim(),
        query.trim().split(" ").slice(0, 3).join(" "), // first 3 words
      ];

      let allResults = [];
      const seen = new Set();

      for (const q of queries) {
        if (!q || allResults.length >= limit) break;

        const url = this.SERVER
          ? this.SERVER + "/api/search?q=" + encodeURIComponent(q) + "&limit=" + limit
          : this.ITUNES_BASE + "/search?term=" + encodeURIComponent(q) +
            "&media=music&entity=song&limit=" + limit;

        const res = await fetch(url);
        const data = await res.json();

        let results;
        if (this.SERVER && data.results) {
          results = data.results;
        } else {
          results = (data.results || [])
            .filter(t => t.trackId && t.trackName)
            .map(t => API.formatItunesTrack(t));
        }

        // Dedupe
        for (const r of results) {
          if (!seen.has(r.id)) {
            seen.add(r.id);
            allResults.push(r);
          }
        }

        if (allResults.length >= 10) break;
      }

      this._cache.set(cacheKey, { data: allResults, time: Date.now() });
      return allResults;
    } catch (e) {
      console.error("Search failed:", e.message);
      return [];
    }
  },

  /* ═══════════════════════════════════════════════════════
     SEARCH SUGGESTIONS — for autocomplete dropdown
     Returns lighter results faster
  ═══════════════════════════════════════════════════════ */
  async searchSuggestions(query, limit = 6) {
    if (!query || query.trim().length < 2) return [];

    const cacheKey = "sug_" + query.toLowerCase().trim();
    const cached = this._cache.get(cacheKey);
    if (cached && Date.now() - cached.time < this._cacheExpiry) {
      return cached.data;
    }

    try {
      const url = this.SERVER
        ? this.SERVER + "/api/search?q=" + encodeURIComponent(query) + "&limit=" + limit
        : this.ITUNES_BASE + "/search?term=" + encodeURIComponent(query) +
          "&media=music&entity=song&limit=" + limit;

      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      const data = await res.json();

      let results;
      if (this.SERVER && data.results) {
        results = data.results.slice(0, limit);
      } else {
        results = (data.results || [])
          .filter(t => t.trackId && t.trackName)
          .map(t => API.formatItunesTrack(t))
          .slice(0, limit);
      }

      this._cache.set(cacheKey, { data: results, time: Date.now() });
      return results;
    } catch (e) {
      console.warn("Suggestions failed:", e.message);
      return [];
    }
  },

  /* ═══════════════════════════════════════════════════════
     GET PLAYABLE URL — Saavn → Audius → iTunes preview
  ═══════════════════════════════════════════════════════ */
  async getPlayableUrl(song) {
    if (!song) return null;
    console.log("🔍 Finding:", song.title, "-", song.artist);

    // 1. JioSaavn (full songs, best for Indian + global)
    if (this.SERVER) {
      const url = await this.getSaavnFromServer(song);
      if (url) { console.log("✅ JioSaavn full song!"); return url; }
    }

    // 2. Audius (fallback)
    if (this.SERVER) {
      const url = await this.getAudiusFromServer(song);
      if (url) { console.log("✅ Audius via server!"); return url; }
    }

    if (!this.SERVER) {
      const url = await this.getAudiusDirect(song);
      if (url) { console.log("✅ Audius direct!"); return url; }
    }

    // 3. iTunes 30sec preview (last resort)
    if (song.previewUrl) {
      console.log("⚠️ iTunes 30sec preview only");
      if (typeof UI !== "undefined") {
        UI.showToast("30sec preview only", "fas fa-info-circle", "yellow");
      }
      return song.previewUrl;
    }

    console.warn("❌ No audio source found:", song.title);
    return null;
  },

  /* ═══════════════════════════════════════════════════════
     SAAVN via backend
  ═══════════════════════════════════════════════════════ */
  async getSaavnFromServer(song) {
    try {
      const url =
        this.SERVER + "/api/saavn?" +
        "title=" + encodeURIComponent(song.title) +
        "&artist=" + encodeURIComponent(song.artist || "") +
        "&album=" + encodeURIComponent(song.album || "");

      const data = await this._fetchJsonWithTimeout(url, 15000);

      if (data && data.success && data.url) {
        console.log("🎵 Saavn matched:", data.matched, "(sc:" + data.score + ")");
        return data.url;
      }
      return null;
    } catch (e) {
      console.warn("Saavn error:", e.message);
      return null;
    }
  },

  /* ═══════════════════════════════════════════════════════
     AUDIUS via backend
  ═══════════════════════════════════════════════════════ */
  async getAudiusFromServer(song) {
    try {
      const url =
        this.SERVER + "/api/audius?title=" + encodeURIComponent(song.title) +
        "&artist=" + encodeURIComponent(song.artist || "");

      const data = await this._fetchJsonWithTimeout(url, 12000);

      if (data && data.success && data.url) {
        console.log("🎵 Audius matched:", data.matched);
        return data.url;
      }
      return null;
    } catch (e) {
      console.warn("Audius error:", e.message);
      return null;
    }
  },

  /* ═══════════════════════════════════════════════════════
     AUDIUS direct (browser fallback if no server)
  ═══════════════════════════════════════════════════════ */
  async getAudiusDirect(song) {
    const query = song.title + " " + song.artist;
    for (const node of this.AUDIUS_NODES) {
      try {
        const res = await fetch(
          node + "/v1/tracks/search?query=" + encodeURIComponent(query) +
          "&limit=10&app_name=SoundWavePro",
          { signal: AbortSignal.timeout(5000) }
        );
        if (!res.ok) continue;
        const data = await res.json();
        const tracks = data.data || [];
        if (!tracks.length) continue;

        const match = this.findBestMatch(
          tracks, song.title, song.artist,
          t => t.title,
          t => t.user && t.user.name
        );
        if (!match) continue;
        return node + "/v1/tracks/" + match.id + "/stream?app_name=SoundWavePro";
      } catch (e) { continue; }
    }
    return null;
  },

  /* ═══════════════════════════════════════════════════════
     LYRICS — LRCLIB (3 strategies + 15s timeout)
  ═══════════════════════════════════════════════════════ */
  async getLyrics(song) {
    if (!song) return null;

    try {
      // Strategy 1: title + artist + album
      const url1 = this.LYRICS_BASE + "/get?" +
        "track_name="   + encodeURIComponent(song.title) +
        "&artist_name=" + encodeURIComponent(song.artist) +
        "&album_name="  + encodeURIComponent(song.album || "");
      const res1 = await fetch(url1, { signal: AbortSignal.timeout(15000) });
      if (res1.ok) {
        const data = await res1.json();
        if (data.syncedLyrics) return this.parseSyncedLyrics(data.syncedLyrics);
        if (data.plainLyrics)  return this.parsePlainLyrics(data.plainLyrics, song.duration || 200);
      }

      // Strategy 2: title + artist only
      const url2 = this.LYRICS_BASE + "/get?" +
        "track_name="   + encodeURIComponent(song.title) +
        "&artist_name=" + encodeURIComponent(song.artist);
      const res2 = await fetch(url2, { signal: AbortSignal.timeout(15000) });
      if (res2.ok) {
        const data = await res2.json();
        if (data.syncedLyrics) return this.parseSyncedLyrics(data.syncedLyrics);
        if (data.plainLyrics)  return this.parsePlainLyrics(data.plainLyrics, song.duration || 200);
      }

      // Strategy 3: search endpoint
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

  parseSyncedLyrics(text) {
    const lines = [];
    const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const time = parseInt(match[1]) * 60 + parseInt(match[2]);
      const txt  = match[4].trim();
      if (txt) lines.push({ time, text: txt });
    }
    return lines.length > 0 ? lines : null;
  },

  parsePlainLyrics(text, duration) {
    const lines = text.split("\n").filter(l => l.trim());
    const timePerLine = duration / lines.length;
    return lines.map((line, i) => ({
      time: Math.round(i * timePerLine),
      text: line.trim(),
    }));
  },

  /* ═══════════════════════════════════════════════════════
     MATCH HELPER (with fuzzy fallback)
  ═══════════════════════════════════════════════════════ */
  findBestMatch(items, title, artist, getTitle, getArtist) {
    const tT = this.clean(title);
    const tA = this.clean(artist);

    const scored = items.map(item => {
      const iT = API.clean(getTitle(item)  || "");
      const iA = API.clean(getArtist(item) || "");
      let score = 0;

      if (iT === tT)               score += 100;
      else if (iT.indexOf(tT) !== -1) score += 70;
      else if (tT.indexOf(iT) !== -1) score += 50;
      else {
        const tw = tT.split(" ").filter(w => w.length > 2);
        const iw = iT.split(" ").filter(w => w.length > 2);
        score += tw.filter(w => iw.indexOf(w) !== -1).length * 15;
      }

      if (iA === tA)               score += 50;
      else if (iA.indexOf(tA) !== -1) score += 35;
      else if (tA.indexOf(iA) !== -1) score += 25;

      return { item, score };
    });

    scored.sort((a, b) => b.score - a.score);
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

  /* ═══════════════════════════════════════════════════════
     CHARTS (for home page sections)
  ═══════════════════════════════════════════════════════ */
  async getCharts(limit = 20) {
    try {
      const songs = await this.search("top hits 2024", limit);
      if (songs.length > 0) return songs;
      return await this.search("popular songs", limit);
    } catch (e) {
      return [];
    }
  },

  /* ═══════════════════════════════════════════════════════
     CONNECTION TEST
  ═══════════════════════════════════════════════════════ */
  async testConnection() {
    console.log("Testing connections...");
    console.log("Mode:", this.SERVER ? "Backend (Full songs)" : "Browser only (30sec previews)");
    console.log("SERVER URL:", this.SERVER);
    if (this.SERVER) {
      try {
        const r = await fetch(this.SERVER + "/api/health");
        const d = await r.json();
        console.log("Server:", d.status);
      } catch (e) {
        console.log("Server: Not reachable -", e.message);
      }
    }
  },
};