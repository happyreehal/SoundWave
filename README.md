Markdown# 🎵 SoundWave

A highly responsive, modern, and completely ad-free full-stack music streaming web application. It features a robust custom UI connected to a private Node.js/Express backend capable of dynamically fetching and routing secure audio streams from Saavn and Audius APIs without third-party disruptions.

## 🚀 Live Demo
🎉 The frontend web player application is fully deployed and live on the internet:
🔗 [Launch SoundWave Player](https://happyreehal.github.io/SoundWave)[cite: 1]

---

## ✅ What You Need First

Install these on your computer before running the project (one-time setup only):
| Tool | Download Link |
| :--- | :--- |
| **Node.js** | https://nodejs.org → Download the stable LTS version |
| **Git** | https://git-scm.com/downloads → Required for version control |
| **VS Code** | https://code.visualstudio.com → Recommended code editor |

---

## 🚀 Step-by-Step Setup & Installation

Follow these exact steps to get both the backend parsing server and the frontend music player running on your local machine:

### STEP 1 — Download the Code
Make sure you have both project folders downloaded into a common workspace directory on your desktop:
```text
Desktop/
├── soundwave-backend/      # Custom Express streaming backend
└── webdite/                # Core frontend user interface
STEP 2 — Initialize and Run the Backend API ServerOpen a terminal or command prompt window.Navigate directly into your backend project directory:Bash   cd C:\Users\happy\Desktop\soundwave-backend
Install all the core architecture dependencies forcefully:Bash   npm install express@4 cors dotenv axios
Start the Node.js production streaming microservice:Bash   npm start
You should see a clean interactive terminal console box indicating:🎵 SoundWave Pro — http://localhost:3000STEP 3 — Initialize and Run the Frontend UI WebsiteOpen a completely new secondary terminal window (do not close the backend terminal!).Head into the main web assets directory:Bash   cd C:\Users\happy\Desktop\webdite
Install the application dependencies:Bash   npm install
Launch your local developer tracking server:Bash   npm run dev
(Alternatively, since it uses native frontend resources, you can simply go to the folder and double-click index.html to load the interface instantly!)  📁 Complete Workspace Directory Tree1. Frontend Architecture (WEBDITE)Plaintextwebdite/
├── css/
│   ├── animations.css     # UI transition mechanics
│   ├── base.css           # Global resets and root variables
│   ├── components.css     # Buttons, input fields, and modular elements
│   ├── layout.css         # Grid and Flexbox structural definitions
│   └── player.css         # Audio controls, player interface layout
├── js/
│   ├── api.js             # Dispatches fetch requests to the local backend proxy
│   ├── app.js             # Standard entry script initialization
│   ├── features.js        # Core app feature handlers
│   ├── firebase.js        # Configures real-time cloud data tracking
│   ├── player.js          # Direct HTML5 media playback stream controls[cite: 1]
│   ├── state.js           # Keeps active app state variables synchronized[cite: 1]
│   └── ui.js              # Renders search results and list views onto the DOM[cite: 1]
├── node_modules/          # Local frontend tracking packages[cite: 1]
├── .gitignore             # Optimizes tracked files criteria
├── index.html             # The primary single-page master layout application[cite: 1]
├── package-lock.json      # Hard-locks precise module versions
├── package.json           # Scripts and system package properties[cite: 1]
├── server.js              # Basic application local test script[cite: 1]
└── vercel.json            # Deployment instructions for Vercel[cite: 1]
2. Backend Routing Architecture (SOUNDWAVE-BACKEND)[cite: 1]Plaintextsoundwave-backend/
├── api/
│   ├── audius.js          # Processes Audius stream resolution logic[cite: 1]
│   ├── health.js          # Basic endpoint tracking script[cite: 1]
│   ├── saavn.js           # Handles Saavn meta searches and audio link queries[cite: 1]
│   └── search.js          # Routes search queries across modules[cite: 1]
├── node_modules/          # Engine packages and frameworks[cite: 1]
├── .vercelignore          # Rules for skipping targeted files during build
├── package-lock.json      # System fixed version dependencies list
├── package.json           # Server configuration scripts and dependencies[cite: 1]
├── server.js              # Production cluster startup code[cite: 1]
└── vercel.json            # Handles configurations for live API routing endpoints[cite: 1]
🎮 How to Use the App🔍 Discovery & Search: Type any track or artist inside the search bar. The client application utilizes js/api.js to shoot requests to the backend server dynamically[cite: 1].🛡️ Content Proxying: The backend checks the input parameters, scrapes links safely from external music nodes, calculates quality matching scores with minScore, and routes raw secure stream URLs back to the client side.🎵 Fluid Local Playback: The incoming streaming track is processed natively by js/player.js without interruptions, tracking timelines, or loading third-party script trackers[cite: 1].❓ Common Problems & Troubleshooting📌 Error: Cannot find module 'express' or 'cors'Reason: The computer has not compiled your node environment packages locally.Fix: Run npm install express@4 cors dotenv axios inside your target folder to download the dependencies directly.📌 Error: ENOENT: no such file or directory, stat '...\index.html'Reason: You opened localhost:3000 directly in your browser. The backend only provides processing APIs and data parameters; it does not host a static web layout page.Fix: Keep the backend server running in the background, and open your frontend layout by launching index.html inside the webdite workspace folder[cite: 1].📌 PathError: Missing parameter name at index 1: *Reason: Express v5 has strict guidelines regarding wildcards.Fix: Run npm install express@4 to bind standard robust routing patterns securely.🛠️ Unified Full-Stack TechnologiesUI Layer: HTML5 Semantic Structure, Custom Mobile-Responsive CSS3 Layouts[cite: 1].Client Control Engine: Vanilla ES6+ JavaScript, Native Web Audio API, Firebase SDK Core[cite: 1].Backend Framework: Node.js Environment, Express.js Middleware Router Engine[cite: 1].Network Handlers: Axios HTTP Stream Resolution.Cloud Infrastructure: Vercel Hosting Engine, GitHub Pages Static Deployment Pipelines[cite: 1].📝 LicenseMIT — completely free to distribute, learn from, and scale across custom portfolios.
