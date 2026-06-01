/* ============================================================
   FIREBASE — Auth + Firestore (Fixed)
   Now: user-specific data, proper save/load per UID
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

  // ✅ Guard variable - double popup rokne ke liye
  _signingIn: false,

  async signIn() {
    // ✅ Agar already sign in ho raha hai toh return karo
    if (this._signingIn) return;
    this._signingIn = true;

    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const result = await auth.signInWithPopup(provider);
      console.log("Signed in:", result.user.displayName);
    } catch (e) {
      // ✅ Yeh errors normal hain - ignore karo
      if (
        e.code === 'auth/cancelled-popup-request' ||
        e.code === 'auth/popup-closed-by-user'
      ) {
        console.log("Popup closed by user - OK");
      } else {
        console.error("Sign in error:", e);
        UI.showToast("Sign in failed. Try again.", "fas fa-exclamation-circle", "red");
      }
    } finally {
      // ✅ Hamesha guard reset karo
      this._signingIn = false;
    }
  },

  async signOut() {
    try {
      await auth.signOut();
      State.currentUser = null;
      State.isGuest = false;
      State.liked = new Set();
      State.playlists = [];
      State.recentlyPlayed = [];
      localStorage.removeItem("sw_data");
      UI.showToast("Signed out successfully", "fas fa-sign-out-alt", "blue");
      setTimeout(() => location.reload(), 800);
    } catch (e) {
      console.error("Sign out error:", e);
    }
  },

  async saveUserData() {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const likedSongsData = [...State.liked].map(id => {
        const song = window.__songRegistry["s_" + id]
                  || State.recentlyPlayed.find(s => s.id === id)
                  || State.queue.find(s => s.id === id);
        return song ? {
          id: song.id, title: song.title, artist: song.artist,
          album: song.album || "", duration: song.duration || 0,
          artwork: song.artwork || "", previewUrl: song.previewUrl || null,
          genre: song.genre || "Music",
        } : { id };
      });

      await db.collection("users").doc(user.uid).set({
        liked: [...State.liked],
        likedSongs: likedSongsData,
        playlists: State.playlists,
        recentlyPlayed: State.recentlyPlayed.slice(0, 20),
        volume: State.volume,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      console.log("Saved to cloud for", user.uid);
    } catch (e) {
      console.error("Save error:", e);
    }
  },

  async loadUserData() {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const snap = await db.collection("users").doc(user.uid).get();
      if (snap.exists) {
        const data = snap.data();
        if (data.liked)          State.liked          = new Set(data.liked);
        if (data.playlists)      State.playlists      = data.playlists;
        if (data.recentlyPlayed) State.recentlyPlayed = data.recentlyPlayed;
        if (data.volume)         State.volume         = data.volume;
        console.log("Cloud data loaded for", user.displayName || user.uid);

        if (data.likedSongs && data.likedSongs.length > 0) {
          data.likedSongs.forEach(song => {
            if (song.id) window.__songRegistry["s_" + song.id] = song;
          });
        }
        setTimeout(() => {
          if (typeof UI !== "undefined") {
            UI.renderLibrary();
            UI.renderSidebarLibrary();
          }
        }, 300);
      }
    } catch (e) {
      console.error("Load error:", e);
    }
  },

  init() {
    auth.onAuthStateChanged(async (user) => {
      if (user) {
        State.currentUser = user;
        State.isGuest = false;
        await this.loadUserData();
        this.updateLoginUI(user);
        App.showApp();
        UI.showToast(
          "Welcome back, " + (user.displayName || 'User') + "! 🎵",
          "fas fa-user",
          "green"
        );
        if (State.currentPage === "library") UI.renderLibrary();
      } else {
        this.updateLoginUI(null);
      }
    });
  },

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
          '" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">';
      } else {
        avatarText.textContent = initials;
      }
      avatarBtn.title = displayName;
      if (menuName) menuName.textContent = displayName;
    } else {
      avatarText.textContent = "G";
      avatarBtn.title = "Guest";
      if (menuName) menuName.textContent = "Guest";
    }
  },

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

const _origToggleLike = State.toggleLike.bind(State);
State.toggleLike = function(id) {
  _origToggleLike(id);
  document.querySelectorAll('.song-heart, .like-btn').forEach(btn => {
    const songId = btn.closest('[data-id]')?.dataset.id;
    if (songId === id) {
      const liked = State.liked.has(id);
      btn.classList.toggle('liked', liked);
      btn.innerHTML =
        '<i class="' + (liked ? 'fas' : 'far') + ' fa-heart"></i>';
      btn.style.color = liked ? 'var(--accent)' : '';
    }
  });
};