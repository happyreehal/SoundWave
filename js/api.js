/* ============================================================
   API.JS — Fixed Version
   Fixes: Audius CORS via server proxy, chart songs previewUrl,
          getPlayableUrl fallback chain
============================================================ */
const API = {

  ITUNES_BASE: "https://itunes.apple.com",

  // Detect if Node server is running (port 3000)
  SERVER: window.location.hostname === "happyreehal.github.io"
    ? "https://soundwave-backend-ivory.vercel.app"
    : window.location.port === "3000"
      ? "http://localhost:3000"
      : null,

  // Fallback direct Audius nodes (used only when no server)
  AUDIUS_NODES: [
    "https://discoveryprovider.audius.co",
    "https://discoveryprovider2.audius.co",
    "https://discoveryprovider3.audius.co",
  ],

  /* ──────────────────────────────────────────────────────
     MAIN SEARCH
  ────────────────────────────────────────────────────── */
  async search(query, limit = 20) {
    if (!query?.trim()) return [];
    try {
      const url = this.SERVER
        ? `${this.SERVER}/api/search?q=${encodeURIComponent(query)}&limit=${limit}`
        : `${this.ITUNES_BASE}/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=${limit}`;

      const res  = await fetch(url);
      const data = await res.json();

      if (this.SERVER && data.results) {
        return data.results;
      }

      // Direct iTunes (no server)
      return (data.results || [])
        .filter(t => t.trackId && t.trackName)
        .map(t => this.formatItunesTrack(t));

    } catch (e) {
      console.error("Search failed:", e.message);
      return [];
    }
  },

  /* ──────────────────────────────────────────────────────
     GET PLAYABLE URL — priority chain
     1. JioSaavn via Node server (full song)
     2. Audius via Node server proxy (full song, avoids CORS)
     3. Audius direct from browser (fallback)
     4. iTunes 30-sec preview
  ────────────────────────────────────────────────────── */
  async getPlayableUrl(song) {
    if (!song) return null;
    console.log(`🎵 Finding: "${song.title}" — ${song.artist}`);

    // 1. JioSaavn via server
    if (this.SERVER) {
      const url = await this.getSaavnFromServer(song);
      if (url) { console.log("✅ JioSaavn full song!"); return url; }
    }

    // 2. Audius via server proxy (no CORS issues)
    if (this.SERVER) {
      const url = await this.getAudiusFromServer(song);
      if (url) { console.log("✅ Audius via server!"); return url; }
    }

    // 3. Audius direct from browser (when no server)
    if (!this.SERVER) {
      const url = await this.getAudiusDirect(song);
      if (url) { console.log("✅ Audius direct!"); return url; }
    }

    // 4. iTunes 30-sec preview
    if (song.previewUrl) {
      console.log("⚠️ iTunes 30sec preview only");
      UI.showToast(
        "30sec preview — Run: node server.js for full songs",
        "fas fa-info-circle",
        "yellow"
      );
      return song.previewUrl;
    }

    console.warn("❌ No audio source found for:", song.title);
    return null;
  },

  /* ──────────────────────────────────────────────────────
     JIOSAAVN VIA NODE SERVER
  ────────────────────────────────────────────────────── */
  async getSaavnFromServer(song) {
    try {
      const res = await fetch(
        `${this.SERVER}/api/saavn/stream` +
        `?title=${encodeURIComponent(song.title)}` +
        `&artist=${encodeURIComponent(song.artist)}`,
        { signal: AbortSignal.timeout(12000) }
      );
      const data = await res.json();
      if (data.success && data.url) {
        console.log(`JioSaavn matched: "${data.matched}" (score:${data.score})`);
        return data.url;
      }
      return null;
    } catch (e) {
      console.warn("Saavn server error:", e.message);
      return null;
    }
  },

  /* ──────────────────────────────────────────────────────
     AUDIUS VIA SERVER PROXY (fixes CORS)
  ────────────────────────────────────────────────────── */
  async getAudiusFromServer(song) {
    try {
      const res = await fetch(
        `${this.SERVER}/api/audius/stream` +
        `?title=${encodeURIComponent(song.title)}` +
        `&artist=${encodeURIComponent(song.artist)}`,
        { signal: AbortSignal.timeout(10000) }
      );
      const data = await res.json();
      if (data.success && data.url) {
        console.log(`Audius matched: "${data.matched}"`);
        return data.url;
      }
      return null;
    } catch (e) {
      console.warn("Audius server error:", e.message);
      return null;
    }
  },

  /* ──────────────────────────────────────────────────────
     AUDIUS DIRECT (browser, no server — fallback only)
  ────────────────────────────────────────────────────── */
  async getAudiusDirect(song) {
    const query = `${song.title} ${song.artist}`;

    for (const node of this.AUDIUS_NODES) {
      try {
        const res = await fetch(
          `${node}/v1/tracks/search` +
          `?query=${encodeURIComponent(query)}` +
          `&limit=10&app_name=SoundWavePro`,
          { signal: AbortSignal.timeout(5000) }
        );

        if (!res.ok) continue;
        const data   = await res.json();
        const tracks = data?.data || [];
        if (!tracks.length) continue;

        const match = this.findBestMatch(
          tracks, song.title, song.artist,
          t => t.title,
          t => t.user?.name
        );

        if (!match) continue;

        console.log(`Audius direct: "${match.title}" by "${match.user?.name}"`);
        return `${node}/v1/tracks/${match.id}/stream?app_name=SoundWavePro`;

      } catch (e) { continue; }
    }
    return null;
  },

  /* ──────────────────────────────────────────────────────
     FIND BEST MATCH
  ────────────────────────────────────────────────────── */
  findBestMatch(items, title, artist, getTitle, getArtist) {
    const tT = this.clean(title);
    const tA = this.clean(artist);

    const scored = items.map(item => {
      const iT = this.clean(getTitle(item)  || "");
      const iA = this.clean(getArtist(item) || "");
      let score = 0;

      if (iT === tT)            score += 100;
      else if (iT.includes(tT)) score += 70;
      else if (tT.includes(iT)) score += 50;
      else {
        const tw = tT.split(" ").filter(w => w.length > 2);
        const iw = iT.split(" ").filter(w => w.length > 2);
        score += tw.filter(w => iw.includes(w)).length * 15;
      }

      if (iA === tA)            score += 50;
      else if (iA.includes(tA)) score += 35;
      else if (tA.includes(iA)) score += 25;

      return { item, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];
    return best?.score >= 50 ? best.item : null;
  },

  /* ──────────────────────────────────────────────────────
     CLEAN STRING
  ────────────────────────────────────────────────────── */
  clean(str = "") {
    return str
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .replace(/\b(official|audio|video|lyrics|feat|ft|featuring|hd|remix|cover|live|version|acoustic)\b/g, "")
      .replace(/\s+/g, " ")
      .trim();
  },

  /* ──────────────────────────────────────────────────────
     FORMAT ITUNES TRACK
  ────────────────────────────────────────────────────── */
  formatItunesTrack(t) {
    const art = (t.artworkUrl100 || "")
      .replace("100x100bb", "600x600bb")
      .replace("100x100",   "600x600");

    return {
      id:         String(t.trackId),
      title:      t.trackName        || "Unknown",
      artist:     t.artistName       || "Unknown",
      album:      t.collectionName   || "Unknown",
      duration:   Math.round((t.trackTimeMillis || 0) / 1000),
      previewUrl: t.previewUrl       || null,
      artwork:    art,
      genre:      t.primaryGenreName || "Music",
      explicit:   t.trackExplicitness === "explicit",
      itunesUrl:  t.trackViewUrl     || "#",
      source:     "itunes",
    };
  },

  /* ──────────────────────────────────────────────────────
     GET CHARTS — fixed: fetch real iTunes track data
     so previewUrl and id are always valid
  ────────────────────────────────────────────────────── */
  async getCharts(limit = 20) {
    try {
      // Use iTunes search for "top hits" — returns full track objects
      // including previewUrl and proper trackId
      const songs = await this.search("top hits 2024", limit);
      if (songs.length > 0) return songs;
      return await this.search("popular songs", limit);
    } catch (e) {
      return [];
    }
  },

  /* ──────────────────────────────────────────────────────
     TEST CONNECTION
  ────────────────────────────────────────────────────── */
  async testConnection() {
    console.log("🧪 Testing connections...");
    console.log("Mode:", this.SERVER
      ? "✅ Node.js Server (Full songs)"
      : "⚠️ Browser only (30sec previews)"
    );

    if (this.SERVER) {
      try {
        const r = await fetch(`${this.SERVER}/api/health`);
        const d = await r.json();
        console.log("✅ Server:", d.status);
      } catch (e) {
        console.log("❌ Server: Not running");
      }
    }

    for (const node of this.AUDIUS_NODES) {
      try {
        const r = await fetch(
          `${node}/v1/tracks/search?query=test&limit=1&app_name=test`,
          { signal: AbortSignal.timeout(4000) }
        );
        const d = await r.json();
        const n = node.split("//")[1].split(".")[0];
        console.log(d.data?.length ? "✅" : "⚠️", `Audius(${n})`);
      } catch (e) {
        const n = node.split("//")[1].split(".")[0];
        console.log(`❌ Audius(${n})`);
      }
    }
  },
};
