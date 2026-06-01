const express = require("express");
const cors    = require("cors");
const path    = require("path");
const fetch   = require("node-fetch");

const app  = express();
const PORT = 3000;

// ✅ COOP FIX - Firebase Google Popup ke liye ZAROORI
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
  next();
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

async function fetchWithTimeout(url, options, ms) {
  options = options || {};
  ms = ms || 10000;
  var controller = new AbortController();
  var timer = setTimeout(function() { controller.abort(); }, ms);
  try {
    var res = await fetch(url, Object.assign({}, options, { signal: controller.signal }));
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function saavnSearch(query, limit) {
  limit = limit || 10;
  var APIS = [
    "https://saavnapi-nine.vercel.app/result/?query=" + encodeURIComponent(query),
    "https://jiosaavn-api-privatecvc2.vercel.app/search/songs?query=" + encodeURIComponent(query) + "&page=1&limit=" + limit,
    "https://saavn.dev/api/search/songs?query=" + encodeURIComponent(query) + "&page=1&limit=" + limit,
  ];

  for (var i = 0; i < APIS.length; i++) {
    var apiUrl = APIS[i];
    try {
      console.log("   Trying: " + apiUrl.substring(0, 60) + "...");
      var res = await fetchWithTimeout(apiUrl, { headers: { "User-Agent": "Mozilla/5.0" } }, 8000);
      if (!res.ok) continue;
      var data = await res.json();

      if (Array.isArray(data)) {
        var results = data.map(function(s) {
          return {
            id:     s.id,
            name:   s.song   || s.name   || "",
            artist: s.singers || s.artist || s.primaryArtists || "",
            album:  s.album  || "",
            url:    s.media_url || s.url  || null,
            duration: s.duration || 0,
          };
        }).filter(function(s) { return s.name && s.url; });
        if (results.length > 0) {
          console.log("   API1 returned " + results.length + " results");
          return results;
        }
      }

      var songs = (data.data && data.data.results) || data.results || [];
      if (songs.length > 0) {
        var results = songs.map(function(s) {
          var url = null;
          if (Array.isArray(s.downloadUrl)) {
            var best = s.downloadUrl.find(function(d) { return d.quality === "320kbps"; }) ||
                       s.downloadUrl.find(function(d) { return d.quality === "160kbps"; }) ||
                       s.downloadUrl[s.downloadUrl.length - 1];
            url = best && best.url ? best.url : null;
          } else {
            url = s.downloadUrl || s.url || null;
          }
          return {
            id:     s.id,
            name:   s.name   || s.song || "",
            artist: (Array.isArray(s.artists && s.artists.primary)
                      ? s.artists.primary.map(function(a) { return a.name; }).join(", ")
                      : s.primaryArtists || s.singers || ""),
            album:  (s.album && s.album.name) || s.album || "", // ✅ album field
            url:    url,
            duration: s.duration || 0,
          };
        }).filter(function(s) { return s.name && s.url; });
        if (results.length > 0) {
          console.log("   API2/3 returned " + results.length + " results");
          return results;
        }
      }
    } catch (e) {
      console.log("   API failed: " + e.message);
      continue;
    }
  }
  return [];
}

function clean(s) {
  s = s || "";
  return s.toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\b(official|audio|video|lyrics|feat|ft|full|hd|remix|cover|live|from)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ✅ Album number fix added
function bestMatch(list, title, artist, album) {
  var tT   = clean(title);
  var tA   = clean(artist || "");
  var tAl  = clean(album  || "");

  // (From "...") hatao title se
  var tTMain = tT.replace(/\(from[^)]*\)/gi, "").trim();

  // Album number nikalo - "Rabb Da Radio 2" → "2"
  var albumNum = (tAl.match(/\d+/) || [])[0] || "";

  var scored = list.map(function(r) {
    var rT  = clean(r.name   || "");
    var rA  = clean(r.artist || "");
    var rAl = clean(r.album  || "");
    var sc  = 0;

    var rTMain = rT.replace(/\(from[^)]*\)/gi, "").trim();

    // ── Title Score ──────────────────────────────
    if (rTMain === tTMain)                  sc += 100;
    else if (rT === tT)                     sc += 100;
    else if (rT.indexOf(tTMain) !== -1)     sc += 70;
    else if (tTMain.indexOf(rTMain) !== -1) sc += 50;
    else {
      var tw = tTMain.split(" ").filter(function(w) { return w.length > 2; });
      var rw = rTMain.split(" ").filter(function(w) { return w.length > 2; });
      var matches = tw.filter(function(w) { return rw.indexOf(w) !== -1; });
      sc += matches.length * 15;
      // Half se kam words match → penalty
      if (matches.length < tw.length / 2) sc -= 25;
    }

    // ── Artist Score ─────────────────────────────
    if (tA) {
      if (rA === tA)                   sc += 50;
      else if (rA.indexOf(tA) !== -1)  sc += 35;
      else if (tA.indexOf(rA) !== -1)  sc += 25;
      else {
        var aw  = tA.split(" ").filter(function(w) { return w.length > 2; });
        var rw2 = rA.split(" ").filter(function(w) { return w.length > 2; });
        sc += aw.filter(function(w) { return rw2.indexOf(w) !== -1; }).length * 10;
      }
    }

    // ── Album Number Score ────────────────────────
    // ✅ "Rabb Da Radio 2" vs "Rabb Da Radio 3" fix
    if (albumNum) {
      var rAlNum = (rAl.match(/\d+/) || [])[0] || "";
      var rTNum  = (rT.match(/\d+/)  || [])[0] || "";

      if (rAlNum === albumNum || rTNum === albumNum) {
        sc += 40;  // ✅ Sahi album number - bonus
      } else if (
        (rAlNum && rAlNum !== albumNum) ||
        (rTNum  && rTNum  !== albumNum)
      ) {
        sc -= 50;  // ❌ Galat album number - heavy penalty
      }
    }

    return { r: r, sc: sc };
  });

  scored.sort(function(a, b) { return b.sc - a.sc; });

  // Debug log
  console.log("   Top 3 matches:");
  scored.slice(0, 3).forEach(function(s) {
    console.log("     \"" + s.r.name + "\" | artist=\"" + s.r.artist + "\" | sc=" + s.sc);
  });

  return scored[0] || null;
}

// ✅ Album param added
app.get("/api/saavn", async function(req, res) {
  var title  = req.query.title;
  var artist = req.query.artist;
  var album  = req.query.album || ""; // ✅ album add kiya

  if (!title) return res.status(400).json({ error: "title required" });
  console.log("\n🎵 Saavn: \"" + title + "\" — " + (artist || "unknown") + " | Album: \"" + album + "\"");

  try {
    // ✅ Search mein album bhi add karo
    var q = (title + " " + (artist || "") + " " + album).trim();
    var results = await saavnSearch(q);
    console.log("   Found " + results.length + " results");

    if (!results.length) {
      return res.json({ success: false, url: null, reason: "No results from any API" });
    }

    // ✅ album pass karo bestMatch mein
    var match = bestMatch(results, title, artist, album);

    if (!match || match.sc < 60) { // ✅ 30 se 60 kiya
      console.log("   ❌ Score too low: " + (match ? match.sc : 0));
      return res.json({ success: false, url: null, reason: "No good match" });
    }

    var song = match.r;
    var audioUrl = song.url.replace(/^http:\/\//i, "https://");
    console.log("   ✅ \"" + song.name + "\" score=" + match.sc);
    console.log("   URL: " + audioUrl.substring(0, 70) + "...");
    res.json({
      success: true,
      url:     audioUrl,
      matched: song.name,
      artist:  song.artist,
      score:   match.sc,
    });
  } catch (e) {
    console.error("   ❌ Saavn error: " + e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/audius", async function(req, res) {
  var title  = req.query.title;
  var artist = req.query.artist;
  if (!title) return res.status(400).json({ error: "title required" });

  var NODES = [
    "https://discoveryprovider.audius.co",
    "https://discoveryprovider2.audius.co",
    "https://discoveryprovider3.audius.co",
  ];

  function cleanStr(s) {
    s = s || "";
    return s.toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .replace(/\b(official|audio|video|lyrics|feat|ft|featuring|hd|remix|cover|live|version|acoustic)\b/g, "")
      .replace(/\s+/g, " ").trim();
  }

  var tT = cleanStr(title);
  var tA = cleanStr(artist || "");

  for (var i = 0; i < NODES.length; i++) {
    var node = NODES[i];
    try {
      var searchRes = await fetchWithTimeout(
        node + "/v1/tracks/search?query=" + encodeURIComponent(title + " " + (artist || "")) + "&limit=10&app_name=SoundWavePro",
        {}, 6000
      );
      if (!searchRes.ok) continue;
      var data = await searchRes.json();
      var tracks = (data.data) || [];
      if (!tracks.length) continue;

      var scored = tracks.map(function(t) {
        var iT    = cleanStr(t.title || "");
        var iA    = cleanStr(t.user && t.user.name || "");
        var score = 0;
        if (iT === tT)                  score += 100;
        else if (iT.indexOf(tT) !== -1) score += 70;
        else if (tT.indexOf(iT) !== -1) score += 50;
        else {
          var tw = tT.split(" ").filter(function(w) { return w.length > 2; });
          var iw = iT.split(" ").filter(function(w) { return w.length > 2; });
          score += tw.filter(function(w) { return iw.indexOf(w) !== -1; }).length * 15;
        }
        if (iA === tA)                  score += 50;
        else if (iA.indexOf(tA) !== -1) score += 35;
        else if (tA.indexOf(iA) !== -1) score += 25;
        return { t: t, score: score };
      });

      scored.sort(function(a, b) { return b.score - a.score; });
      var best = scored[0];
      if (!best || best.score < 50) continue;

      var streamUrl = node + "/v1/tracks/" + best.t.id + "/stream?app_name=SoundWavePro";
      console.log("   ✅ Audius: \"" + best.t.title + "\" score=" + best.score);
      return res.json({ success: true, url: streamUrl, matched: best.t.title });
    } catch (e) { continue; }
  }
  res.json({ success: false, url: null, reason: "Not found on Audius" });
});

app.get("/api/search", async function(req, res) {
  var q     = req.query.q;
  var limit = req.query.limit || 20;
  if (!q) return res.status(400).json({ error: "q required" });
  try {
    var url  = "https://itunes.apple.com/search?term=" + encodeURIComponent(q) + "&media=music&entity=song&limit=" + limit;
    var resp = await fetchWithTimeout(url, {}, 8000);
    var data = await resp.json();
    var results = (data.results || []).filter(function(t) {
      return t.trackId && t.trackName;
    }).map(function(t) {
      var art = (t.artworkUrl100 || "")
        .replace("100x100bb", "600x600bb")
        .replace("100x100", "600x600");
      return {
        id:          String(t.trackId),
        title:       t.trackName        || "Unknown",
        artist:      t.artistName       || "Unknown",
        album:       t.collectionName   || "Unknown",
        duration:    Math.round((t.trackTimeMillis || 0) / 1000),
        previewUrl:  t.previewUrl       || null,
        artwork:     art,
        genre:       t.primaryGenreName || "Music",
        explicit:    t.trackExplicitness === "explicit",
        itunesUrl:   t.trackViewUrl     || "#",
        source:      "itunes",
      };
    });
    console.log("iTunes: " + results.length + " for \"" + q + "\"");
    res.json({ success: true, results: results });
  } catch (e) {
    res.json({ success: false, results: [], error: e.message });
  }
});

app.get("/api/health", function(_, res) {
  res.json({ status: "OK", port: PORT });
});

app.get("*", function(req, res) {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, function() {
  console.log("\n╔══════════════════════════════════╗");
  console.log("║  🎵 SoundWave Pro               ║");
  console.log("║  http://localhost:" + PORT + "           ║");
  console.log("╚══════════════════════════════════╝");
}).on("error", function(e) {
  if (e.code === "EADDRINUSE") {
    console.log("\n❌ Port " + PORT + " busy! Run: npx kill-port " + PORT + "\n");
    process.exit(1);
  }
});