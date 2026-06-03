/* ============================================================
   FIREBASE — Auth + Firestore
   Fixed: User isolation, proper save/load, welcome animation
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
  _signingIn: false,
  _saveInProgress: false,

  /* ═══════════════════════════════════════════════════════
     SIGN IN (Google Popup)
  ═══════════════════════════════════════════════════════ */
  async signIn() {
    if (this._signingIn) return;
    this._signingIn = true;

    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      const result = await auth.signInWithPopup(provider);
      console.log("✅ Signed in:", result.user.displayName);
    } catch (e) {
      if (
        e.code === 'auth/cancelled-popup-request' ||
        e.code === 'auth/popup-closed-by-user'
      ) {
        console.log("Popup closed by user — OK");
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
      // Save current data before signing out
      if (auth.currentUser) {
        await this.saveUserData();
      }

      await auth.signOut();

      // ✅ Clear all user data
      State.clearUserData();
      State.currentUser = null;
      State.isGuest = false;

      // ✅ Clear localStorage of this user
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("sw_data_")) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));

      if (typeof UI !== "undefined") {
        UI.showToast("Signed out successfully", "fas fa-sign-out-alt", "blue");
      }

      setTimeout(() => location.reload(), 800);
    } catch (e) {
      console.error("Sign out error:", e);
    }
  },

  /* ═══════════════════════════════════════════════════════
     SAVE USER DATA TO FIRESTORE
  ═══════════════════════════════════════════════════════ */
  async saveUserData() {
    const user = auth.currentUser;
    if (!user || this._saveInProgress) return;
    this._saveInProgress = true;

    try {
      // Build liked songs data (full song info, not just IDs)
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
        liked:          [...State.liked],
        likedSongs:     likedSongsData,
        playlists:      State.playlists,
        recentlyPlayed: State.recentlyPlayed.slice(0, 30),
        searchHistory:  State.searchHistory.slice(0, 20),
        volume:         State.volume,
        updatedAt:      firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      console.log("☁️ Saved to cloud for", user.displayName || user.uid);
    } catch (e) {
      console.error("Save error:", e);
    } finally {
      this._saveInProgress = false;
    }
  },

  /* ═══════════════════════════════════════════════════════
     LOAD USER DATA FROM FIRESTORE
  ═══════════════════════════════════════════════════════ */
  async loadUserData() {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const snap = await db.collection("users").doc(user.uid).get();
      if (!snap.exists) {
        console.log("New user — no cloud data yet");
        return;
      }

      const data = snap.data();

      // Reset state first (clean slate)
      State.clearUserData();

      // Load from cloud
      if (data.liked)          State.liked          = new Set(data.liked);
      if (data.playlists)      State.playlists      = data.playlists;
      if (data.recentlyPlayed) State.recentlyPlayed = data.recentlyPlayed;
      if (data.searchHistory)  State.searchHistory  = data.searchHistory;
      if (typeof data.volume === "number") State.volume = data.volume;

      // Re-register liked songs in window registry
      if (data.likedSongs && Array.isArray(data.likedSongs)) {
        data.likedSongs.forEach(song => {
          if (song.id && song.title) {
            if (!window.__songRegistry) window.__songRegistry = {};
            window.__songRegistry["s_" + song.id] = song;
          }
        });
      }

      // Save loaded data to user-specific localStorage
      State.save();

      console.log("☁️ Cloud data loaded for", user.displayName || user.uid);

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
        // ✅ Clear previous user's data first
        State.clearUserData();

        // ✅ Clear old localStorage (any previous user)
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith("sw_data_") && key !== "sw_data_" + user.uid) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));

        // Set current user
        State.currentUser = user;
        State.isGuest = false;

        // Load this user's data (from localStorage first, then Firebase)
        State.load();
        await this.loadUserData();

        this.updateLoginUI(user);

        // Show welcome animation, then app
        App.showWelcomeAndApp(user);
      } else {
        this.updateLoginUI(null);
      }
    });
  },

  /* ═══════════════════════════════════════════════════════
     UPDATE AVATAR / MENU UI
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
        avatarBtn.innerHTML =
          '<img src="' + user.photoURL +
          '" alt="' + UI.escHtml(displayName) +
          '" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">' +
          '<div id="user-menu" class="hidden user-menu">' +
            '<div class="user-menu-name" id="user-menu-name">' + UI.escHtml(displayName) + '</div>' +
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