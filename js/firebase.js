/* ============================================================
   FIREBASE — Auth + Firestore
   User isolation + Stats sync + Welcome flow
============================================================ */
const firebaseConfig = {
  apiKey:            "AIzaSyBu1HZPsFGBkU67tKczcsTwYCr80jJntBo",
  authDomain:        "soundwave-pro-app.firebaseapp.com",
  projectId:         "soundwave-pro-app",
  storageBucket:     "soundwave-pro-app.firebasestorage.app",
  messagingSenderId: "275337507787",
  appId:             "1:275337507787:web:769527c3d4cb803f467c4e",
  measurementId:     "G-VBZSCZ3TT2"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

const FB = {
  _signingIn:      false,
  _saveInProgress: false,
  _isFirstLogin:   false,

  /* ═══════════════════════════════════════════════════════
     SIGN IN
  ═══════════════════════════════════════════════════════ */
  async signIn() {
    if (this._signingIn) return;
    this._signingIn = true;

    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      const result = await auth.signInWithPopup(provider);
      console.log("✅ Signed in:", result.user.displayName);

      // Detect first login (new user)
      this._isFirstLogin = result.additionalUserInfo?.isNewUser || false;
    } catch (e) {
      if (
        e.code === 'auth/cancelled-popup-request' ||
        e.code === 'auth/popup-closed-by-user'
      ) {
        console.log("Popup closed by user");
      } else {
        console.error("Sign in error:", e);
        if (typeof UI !== "undefined") {
          UI.showToast("Sign in failed. Try again.", "fas fa-exclamation-circle", "red");
        }
      }
    } finally {
      this._signingIn = false;
    }
  },

  /* ═══════════════════════════════════════════════════════
     SIGN OUT — Clear everything
  ═══════════════════════════════════════════════════════ */
  async signOut() {
    try {
      // Save current data first
      if (auth.currentUser) {
        await this.saveUserData();
      }

      await auth.signOut();

      // Clear state
      State.clearUserData();
      State.clearSession();
      State.currentUser = null;
      State.isGuest = false;

      // Clear ALL sw_data_* keys from localStorage
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith("sw_data_") || key.startsWith("sw_session_"))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));

      // Clear song registry
      window.__songRegistry = {};

      if (typeof UI !== "undefined") {
        UI.showToast("Signed out", "fas fa-sign-out-alt", "blue");
      }

      setTimeout(() => location.reload(), 800);
    } catch (e) {
      console.error("Sign out error:", e);
    }
  },

  /* ═══════════════════════════════════════════════════════
     SAVE TO FIRESTORE
  ═══════════════════════════════════════════════════════ */
  async saveUserData() {
    const user = auth.currentUser;
    if (!user || this._saveInProgress) return;
    this._saveInProgress = true;

    try {
      // Build liked songs data
      const likedSongsData = [...State.liked].map(id => {
        const song =
          (window.__songRegistry && window.__songRegistry["s_" + id]) ||
          State.recentlyPlayed.find(s => s.id === id) ||
          State.queue.find(s => s.id === id);

        return song ? {
          id:         song.id,
          title:      song.title,
          artist:     song.artist,
          album:      song.album || "",
          duration:   song.duration || 0,
          artwork:    song.artwork || "",
          previewUrl: song.previewUrl || null,
          genre:      song.genre || "Music",
        } : { id };
      });

      await db.collection("users").doc(user.uid).set({
        liked:              [...State.liked],
        likedSongs:         likedSongsData,
        playlists:          State.playlists,
        recentlyPlayed:     State.recentlyPlayed.slice(0, 30),
        searchHistory:      State.searchHistory.slice(0, 20),
        volume:             State.volume,
        totalListenSeconds: State.totalListenSeconds,
        songPlayCounts:     State.songPlayCounts,
        artistPlayCounts:   State.artistPlayCounts,
        genrePlayCounts:    State.genrePlayCounts,
        updatedAt:          firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      console.log("☁️ Synced to cloud:", user.displayName || user.uid);
    } catch (e) {
      console.error("Save error:", e);
    } finally {
      this._saveInProgress = false;
    }
  },

  /* ═══════════════════════════════════════════════════════
     LOAD FROM FIRESTORE
  ═══════════════════════════════════════════════════════ */
  async loadUserData() {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const snap = await db.collection("users").doc(user.uid).get();
      if (!snap.exists) {
        console.log("New user — no cloud data");
        return;
      }

      const data = snap.data();

      // Clean slate
      State.clearUserData();

      // Load from cloud
      if (data.liked)              State.liked              = new Set(data.liked);
      if (data.playlists)          State.playlists          = data.playlists;
      if (data.recentlyPlayed)     State.recentlyPlayed     = data.recentlyPlayed;
      if (data.searchHistory)      State.searchHistory      = data.searchHistory;
      if (typeof data.volume === "number") State.volume     = data.volume;
      if (data.totalListenSeconds) State.totalListenSeconds = data.totalListenSeconds;
      if (data.songPlayCounts)     State.songPlayCounts     = data.songPlayCounts;
      if (data.artistPlayCounts)   State.artistPlayCounts   = data.artistPlayCounts;
      if (data.genrePlayCounts)    State.genrePlayCounts    = data.genrePlayCounts;

      // Restore song registry from liked songs
      if (data.likedSongs && Array.isArray(data.likedSongs)) {
        if (!window.__songRegistry) window.__songRegistry = {};
        data.likedSongs.forEach(song => {
          if (song.id && song.title) {
            window.__songRegistry["s_" + song.id] = song;
          }
        });
      }

      // Also restore from recentlyPlayed
      if (Array.isArray(State.recentlyPlayed)) {
        State.recentlyPlayed.forEach(song => {
          if (song.id && song.title) {
            window.__songRegistry["s_" + song.id] = song;
          }
        });
      }

      // Restore playlist songs to registry too
      State.playlists.forEach(pl => {
        if (pl.songs) {
          pl.songs.forEach(song => {
            if (song.id && song.title) {
              window.__songRegistry["s_" + song.id] = song;
            }
          });
        }
      });

      // Save loaded data to user-specific localStorage
      State.save();

      console.log("☁️ Cloud loaded:", user.displayName || user.uid);

      // Refresh UI
      setTimeout(() => {
        if (typeof UI !== "undefined") {
          if (State.currentPage === "library") UI.renderLibrary();
          UI.renderSidebarLibrary();
        }
      }, 300);
    } catch (e) {
      console.error("Load error:", e);
    }
  },

  /* ═══════════════════════════════════════════════════════
     AUTH STATE LISTENER
  ═══════════════════════════════════════════════════════ */
  init() {
    auth.onAuthStateChanged(async (user) => {
      if (user) {
        // ✅ Clear any previous user's data first
        State.clearUserData();
        State.clearSession();

        // ✅ Clear OTHER users' localStorage (keep only this user's data)
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (
            key &&
            (key.startsWith("sw_data_") || key.startsWith("sw_session_")) &&
            !key.endsWith(user.uid)
          ) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));

        // Clear song registry
        window.__songRegistry = {};

        // Set current user
        State.currentUser = user;
        State.isGuest = false;

        // Load user's data (localStorage first, then Firebase)
        State.load();
        await this.loadUserData();

        // Update UI
        this.updateLoginUI(user);

        // Show welcome animation + app
        App.showWelcomeAndApp(user, this._isFirstLogin);
        this._isFirstLogin = false;
      } else {
        this.updateLoginUI(null);
      }
    });
  },

  /* ═══════════════════════════════════════════════════════
     UPDATE AVATAR
  ═══════════════════════════════════════════════════════ */
  updateLoginUI(user) {
    const avatarBtn  = document.getElementById("user-avatar-btn");
    const avatarText = document.getElementById("user-avatar-text");
    const menuName   = document.getElementById("user-menu-name");
    if (!avatarBtn) return;

    if (user) {
      const displayName = user.displayName || "User";
      const initials = displayName
        .split(" ")
        .map(n => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase();

      if (user.photoURL) {
  // ✅ Use referrerpolicy to fix Google photo CORS
  avatarBtn.innerHTML =
    '<img src="' + user.photoURL + '" alt="' + UI.escHtml(displayName) +
    '" referrerpolicy="no-referrer" crossorigin="anonymous" ' +
    'style="width:100%;height:100%;border-radius:50%;object-fit:cover;" ' +
    'onerror="this.outerHTML=\'<span style=font-weight:700;font-size:13px;>' + initials + '</span>\'">' +
    '<div id="user-menu" class="hidden user-menu">' +
      '<div class="user-menu-name" id="user-menu-name">' + UI.escHtml(displayName) + '</div>' +
      '<div class="ctx-item" onclick="openModal(\'modal-stats\')"><i class="fas fa-chart-line"></i> Your Stats</div>' +
      '<div class="ctx-item" onclick="FB.signOut()"><i class="fas fa-sign-out-alt"></i> Sign Out</div>' +
    '</div>';
} else {
  if (avatarText) avatarText.textContent = initials;
}
      avatarBtn.title = displayName;
      if (menuName) menuName.textContent = displayName;
    } else {
      if (avatarText) avatarText.textContent = "G";
      avatarBtn.title = "Guest";
      if (menuName) menuName.textContent = "Guest";
    }
  },

  /* ═══════════════════════════════════════════════════════
     USER MENU TOGGLE
  ═══════════════════════════════════════════════════════ */
  toggleUserMenu() {
    const menu = document.getElementById("user-menu");
    if (!menu) return;
    menu.classList.toggle("hidden");

    if (!menu.classList.contains("hidden")) {
      setTimeout(() => {
        const handler = (e) => {
          if (
            !menu.contains(e.target) &&
            e.target !== document.getElementById("user-avatar-btn")
          ) {
            menu.classList.add("hidden");
            document.removeEventListener("click", handler);
          }
        };
        document.addEventListener("click", handler);
      }, 10);
    }
  },
};