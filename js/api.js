/* ============================================================
   API.JS — iTunes + Saavn + Audius + LRCLIB + Color extraction
   + Country hint + Retry logic + URL cache for 30sec preview fix
============================================================ */
const API = {
  ITUNES_BASE: "https://itunes.apple.com",
  LYRICS_BASE: "https://lrclib.net/api",

  _cache:        new Map(),
  _cacheExpiry:  5 * 60 * 1000,

  // ✅ URL cache (persistent, longer expiry — saves API calls)
  _urlCache:     new Map(),
  _urlCacheExpiry: 60 * 60 * 1000,  // 1 hour

  // ✅ Throttle to avoid rate limits
  _lastSaavnCall: 0,
  _saavnDelay:    400,  // ms gap between Saavn calls

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
     Helpers
  ═══════════════════════════════════════════════════════ */
  _fetchJsonWithTimeout(url, ms = 12000) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), ms);
    return fetch(url, { signal: controller.signal })
      .then(r => r.json())
      .finally(() => clearTimeout(t));
  },

  _getPrimaryArtist(artistStr) {
    if (!artistStr) return "";
    return artistStr
      .split(/[,&]| feat\.?| ft\.?| featuring | with /i)[0]
      .trim();
  },

  _cleanTitle(title) {
    if (!title) return "";
    return title
      .replace(/\(feat[^)]*\)/gi, "")
      .replace(/\(ft[^)]*\)/gi, "")
      .replace(/\(featuring[^)]*\)/gi, "")
      .replace(/\(with[^)]*\)/gi, "")
      .replace(/\s+feat\.?\s+.*/i, "")
      .replace(/\s+ft\.?\s+.*/i, "")
      .trim();
  },

  _isIndianQuery(q) {
    if (!q) return false;
    return /\b(punjabi|hindi|bollywood|desi|indian|sufi|bhojpuri|tamil|telugu|kannada|marathi|gujarati|bengali|qawwali|ghazal|filmi)\b/i.test(q);
  },

  // ✅ Throttle helper — wait if last Saavn call was too recent
  async _throttleSaavn() {
    const now = Date.now();
    const elapsed = now - this._lastSaavnCall;
    if (elapsed < this._saavnDelay) {
      await new Promise(r => setTimeout(r, this._saavnDelay - elapsed));
    }
    this._lastSaavnCall = Date.now();
  },

  // ✅ URL cache helpers
  _getCachedUrl(songId) {
    const cached = this._urlCache.get(songId);
    if (cached && Date.now() - cached.time < this._urlCacheExpiry) {
      return cached.url;
    }
    return null;
  },

  _setCachedUrl(songId, url) {
    this._urlCache.set(songId, { url, time: Date.now() });
    // Keep cache size manageable
    if (this._urlCache.size > 100) {
      const oldest = [...this._urlCache.entries()].sort((a, b) => a[1].time - b[1].time)[0];
      if (oldest) this._urlCache.delete(oldest[0]);
    }
  },

  /* ═══════════════════════════════════════════════════════
     SEARCH — with country hint
  ═══════════════════════════════════════════════════════ */
  async search(query, limit = 20) {
    if (!query || !query.trim()) return [];

    const cacheKey = query.toLowerCase().trim() + "_" + limit;
    const cached = this._cache.get(cacheKey);
    if (cached && Date.now() - cached.time < this._cacheExpiry) {
      return cached.data;
    }

    try {
      const queries = [
        query.trim(),
        query.trim().split(" ").slice(0, 3).join(" "),
      ];

      let allResults = [];
      const seen = new Set();

      for (const q of queries) {
        if (!q || allResults.length >= limit) break;

        const country = this._isIndianQuery(q) ? "in" : "us";

        const url = this.SERVER
          ? this.SERVER + "/api/search?q=" + encodeURIComponent(q) + "&limit=" + limit
          : this.ITUNES_BASE + "/search?term=" + encodeURIComponent(q) +
            "&media=music&entity=song&limit=" + limit +
            "&country=" + country;

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
     SEARCH SUGGESTIONS
  ═══════════════════════════════════════════════════════ */
  async searchSuggestions(query, limit = 6) {
    if (!query || query.trim().length < 2) return [];

    const cacheKey = "sug_" + query.toLowerCase().trim();
    const cached = this._cache.get(cacheKey);
    if (cached && Date.now() - cached.time < this._cacheExpiry) {
      return cached.data;
    }

    try {
      const country = this._isIndianQuery(query) ? "in" : "us";

      const url = this.SERVER
        ? this.SERVER + "/api/search?q=" + encodeURIComponent(query) + "&limit=" + limit
        : this.ITUNES_BASE + "/search?term=" + encodeURIComponent(query) +
          "&media=music&entity=song&limit=" + limit +
          "&country=" + country;

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
     "DID YOU MEAN?"
  ═══════════════════════════════════════════════════════ */
  async getDidYouMean(query, gotResults) {
    if (!query || gotResults > 5) return null;

    const firstWord = query.trim().split(" ")[0];
    if (firstWord.length < 3) return null;

    try {
      const results = await this.searchSuggestions(firstWord, 3);
      if (results && results.length > 0) {
        const artistName = results[0].artist;
        if (artistName && artistName.toLowerCase() !== query.toLowerCase()) {
          return this._getPrimaryArtist(artistName);
        }
      }
    } catch (e) {}
    return null;
  },

  /* ═══════════════════════════════════════════════════════
     GET PLAYABLE URL — with cache + retry
  ═══════════════════════════════════════════════════════ */
  async getPlayableUrl(song) {
    if (!song) return null;

    // ✅ Check URL cache first
    const cachedUrl = this._getCachedUrl(song.id);
    if (cachedUrl) {
      console.log("⚡ Cached URL hit:", song.title);
      return cachedUrl;
    }

    console.log("🔍 Finding:", song.title, "-", song.artist);

    // ✅ Try Saavn with retry (3 attempts)
    if (this.SERVER) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        const url = await this.getSaavnFromServer(song, attempt);
        if (url) {
          console.log("✅ JioSaavn match (attempt " + attempt + ")");
          this._setCachedUrl(song.id, url);
          return url;
        }
        // Wait before retry (exponential backoff)
        if (attempt < 3) {
          const waitMs = 500 * attempt;
          console.log("   Retrying Saavn in " + waitMs + "ms...");
          await new Promise(r => setTimeout(r, waitMs));
        }
      }
    }

    // Audius fallback
    if (this.SERVER) {
      const url = await this.getAudiusFromServer(song);
      if (url) {
        console.log("✅ Audius (server)");
        this._setCachedUrl(song.id, url);
        return url;
      }
    }

    if (!this.SERVER) {
      const url = await this.getAudiusDirect(song);
      if (url) {
        console.log("✅ Audius (direct)");
        this._setCachedUrl(song.id, url);
        return url;
      }
    }

    // Last resort: iTunes 30sec preview
    if (song.previewUrl) {
      console.log("⚠️ iTunes 30sec preview (Saavn rate limited or song not on Saavn)");
      if (typeof UI !== "undefined") {
        UI.showToast("30sec preview — Saavn rate limited", "fas fa-info-circle", "yellow");
      }
      return song.previewUrl;
    }

    console.warn("❌ No source found:", song.title);
    return null;
  },

  /* ✅ Saavn with throttle + better error handling */
  async getSaavnFromServer(song, attempt = 1) {
    try {
      // Throttle: wait if last call was too recent
      await this._throttleSaavn();

      const primaryArtist = this._getPrimaryArtist(song.artist || "");
      const cleanTitle    = this._cleanTitle(song.title || "");

      console.log("   Saavn try #" + attempt + ":", cleanTitle, "—", primaryArtist);

      const url =
        this.SERVER + "/api/saavn?" +
        "title=" + encodeURIComponent(cleanTitle) +
        "&artist=" + encodeURIComponent(primaryArtist) +
        "&album=" + encodeURIComponent(song.album || "");

      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });

      // ✅ Handle rate limit specifically
      if (res.status === 429) {
        console.warn("   ⚠️ Saavn rate limited (429) — backing off");
        await new Promise(r => setTimeout(r, 1000 * attempt));
        return null;
      }

      if (!res.ok) {
        console.warn("   Saavn HTTP error:", res.status);
        return null;
      }

      const data = await res.json();

      if (data && data.success && data.url) {
        console.log("   Saavn matched:", data.matched, "by", data.artist, "(score:" + data.score + ")");
        return data.url;
      }

      // Log the reason for debugging
      if (data && data.reason) {
        console.log("   Saavn no match:", data.reason);
      }
      return null;
    } catch (e) {
      console.warn("   Saavn error (attempt " + attempt + "):", e.message);
      return null;
    }
  },

  async getAudiusFromServer(song) {
    try {
      const primaryArtist = this._getPrimaryArtist(song.artist || "");
      const cleanTitle    = this._cleanTitle(song.title || "");

      const url =
        this.SERVER + "/api/audius?title=" + encodeURIComponent(cleanTitle) +
        "&artist=" + encodeURIComponent(primaryArtist);

      const data = await this._fetchJsonWithTimeout(url, 12000);

      if (data && data.success && data.url) {
        return data.url;
      }
      return null;
    } catch (e) {
      console.warn("Audius error:", e.message);
      return null;
    }
  },

  async getAudiusDirect(song) {
    const primaryArtist = this._getPrimaryArtist(song.artist || "");
    const cleanTitle    = this._cleanTitle(song.title || "");
    const query = cleanTitle + " " + primaryArtist;

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
          tracks, cleanTitle, primaryArtist,
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
     LYRICS — LRCLIB
  ═══════════════════════════════════════════════════════ */
  async getLyrics(song) {
    if (!song) return null;

    const primaryArtist = this._getPrimaryArtist(song.artist || "");
    const cleanTitle    = this._cleanTitle(song.title || "");

    try {
      const url1 = this.LYRICS_BASE + "/get?" +
        "track_name="   + encodeURIComponent(cleanTitle) +
        "&artist_name=" + encodeURIComponent(primaryArtist) +
        "&album_name="  + encodeURIComponent(song.album || "");
      const res1 = await fetch(url1, { signal: AbortSignal.timeout(15000) });
      if (res1.ok) {
        const data = await res1.json();
        if (data.syncedLyrics) return this.parseSyncedLyrics(data.syncedLyrics);
        if (data.plainLyrics)  return this.parsePlainLyrics(data.plainLyrics, song.duration || 200);
      }

      const url2 = this.LYRICS_BASE + "/get?" +
        "track_name="   + encodeURIComponent(cleanTitle) +
        "&artist_name=" + encodeURIComponent(primaryArtist);
      const res2 = await fetch(url2, { signal: AbortSignal.timeout(15000) });
      if (res2.ok) {
        const data = await res2.json();
        if (data.syncedLyrics) return this.parseSyncedLyrics(data.syncedLyrics);
        if (data.plainLyrics)  return this.parsePlainLyrics(data.plainLyrics, song.duration || 200);
      }

      const url3 = this.LYRICS_BASE + "/search?" +
        "track_name="   + encodeURIComponent(cleanTitle) +
        "&artist_name=" + encodeURIComponent(primaryArtist);
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
     MATCH HELPER
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
     COLOR EXTRACTION
  ═══════════════════════════════════════════════════════ */
  async extractColor(imageUrl) {
    if (!imageUrl) return null;

    const cacheKey = "color_" + imageUrl;
    const cached = this._cache.get(cacheKey);
    if (cached) return cached.data;

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";

      const timer = setTimeout(() => resolve(null), 4000);

      img.onload = () => {
        clearTimeout(timer);
        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          canvas.width = 50;
          canvas.height = 50;
          ctx.drawImage(img, 0, 0, 50, 50);

          const pixels = ctx.getImageData(0, 0, 50, 50).data;
          let r = 0, g = 0, b = 0, count = 0;

          for (let i = 0; i < pixels.length; i += 16) {
            const pr = pixels[i];
            const pg = pixels[i + 1];
            const pb = pixels[i + 2];
            const pa = pixels[i + 3];
            if (pa < 200) continue;
            const brightness = (pr + pg + pb) / 3;
            if (brightness < 30 || brightness > 230) continue;

            r += pr;
            g += pg;
            b += pb;
            count++;
          }

          if (count === 0) {
            resolve(null);
            return;
          }

          r = Math.round(r / count);
          g = Math.round(g / count);
          b = Math.round(b / count);

          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          if (max - min < 30) {
            const dominant = r >= g && r >= b ? 'r' : (g >= b ? 'g' : 'b');
            if (dominant === 'r') r = Math.min(255, r + 40);
            else if (dominant === 'g') g = Math.min(255, g + 40);
            else b = Math.min(255, b + 40);
          }

          const color = `rgb(${r}, ${g}, ${b})`;
          this._cache.set(cacheKey, { data: color, time: Date.now() });
          resolve(color);
        } catch (e) {
          console.warn("Color extract error:", e.message);
          resolve(null);
        }
      };

      img.onerror = () => {
        clearTimeout(timer);
        resolve(null);
      };

      img.src = imageUrl;
    });
  },

  /* ═══════════════════════════════════════════════════════
     CHARTS
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
    console.log("Mode:", this.SERVER ? "Backend (Full songs)" : "Browser only");
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