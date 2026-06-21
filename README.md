# BigQuery Release Notes Explorer

An interactive, premium web application dashboard designed to track, filter, and analyze Google Cloud BigQuery Release Notes in real time. 

Built with a **Python Flask** backend and a **vanilla HTML5, CSS3, and JavaScript** frontend, the app provides a highly polished visual interface featuring glassmorphic designs, responsive layouts, and local state management.

---

## 🌟 Key Features

### 📡 Smart Feed Parsing & Caching
* **RSS/Atom Feed Sync**: Automatically fetches data directly from the official Google Cloud BigQuery Release Notes feed (`https://docs.cloud.google.com/feeds/bigquery-release-notes.xml`).
* **Optimized Local Caching**: Employs a file-based JSON cache on the server side with a 10-minute time-to-live (TTL) to guarantee quick page loading times and prevent rate limits.
* **Manual Cache Bypass**: Features a manual refresh button with a spinner animation that forces the server to fetch a fresh version of the feed and update the local cache immediately.
* **Offline Resiliency**: Automatically falls back to the last successfully cached copy if Google's feed server is unreachable.

### 📊 Interactive Analytics Dashboard
* Parses raw HTML descriptions on the client side using a lightweight `DOMParser` to identify update classifications (e.g., `Feature`, `Announcement`, `Issue`, `Deprecated`, `Beta`).
* Displays a live dashboard indicating:
  * Total number of releases loaded.
  * Count of new features introduced.
  * General announcements count.
  * Outstanding alerts, issues, and deprecations count.

### 🔍 Real-Time Search & Filtering
* **Keyword Search**: Instant client-side search indexing matching keywords inside titles and description paragraphs.
* **Category Filters**: Dynamic checkboxes representing each discovered update type.
* **Timeframe Filters**: Radio button selectors filtering notes from the last 7, 30, or 90 days.
* **Preference Filters**: Toggles to view *Bookmarked only* or *Unread only* notes.
* **Sorting**: Instant dropdown to switch between *Newest First* and *Oldest First*.

### 💾 Local Preferences Storage
* **Bookmarks**: Select updates can be pinned/starred. State is stored locally via `localStorage` and persists across sessions.
* **Read/Unread Tracker**: Tracks which notes have been viewed. Unread items display a glowing blue dot. Clicking a card marks it as read, and a bulk "Mark all read" button is available.

### 🐦 Social Integration & Sharing
* **Twitter / X Web Intent**: Generates pre-formatted tweet summaries including title, category tags, truncated description snippets (under 280 characters), and direct links to the official Google documentation.
* **Clipboard Sharing**: A copy-link button retrieves the direct anchor link of the specific update and copies it to the user's clipboard.

---

## 🎨 Visual Design (CSS)
* **Glassmorphism**: Translucent panels (`backdrop-filter: blur()`), fine-line borders, and custom scrollbars.
* **Ambient Glow Backgrounds**: Two animated glowing spheres drift slowly in the background to add depth.
* **Dark / Light Modes**: A smooth CSS variables-based transition between rich dark and clean slate-light themes, respecting both user toggles and system preferences.
* **Skeleton Loaders**: Renders placeholder cards during initial asynchronous API calls to prevent layout shifting.

---

## 📁 Project Structure

```
Ildefons-Miau-event-talks-app/
│
├── app.py                 # Flask server (routing, fetching, parser proxy & cache manager)
├── requirements.txt       # Python dependencies (Flask, requests, feedparser)
├── .gitignore             # Configured ignores (virtual environments, cache files, system files)
│
├── templates/
│   └── index.html         # Main dashboard markup, dynamic icons, and filter structures
│
└── static/
    ├── app.js             # Client engine (fetch endpoints, filtering, DOM builder, local storage)
    └── style.css          # Design token styles, animations, variables, and responsive layout
```

---

## 🚀 Installation & Local Run

### Prerequisites
* Python 3.8 or higher installed on your system.

### Setup Instructions

1. **Clone the repository**:
   ```bash
   git clone https://github.com/maciej-janowicz/Ildefons-Miau-event-talks-app.git
   cd Ildefons-Miau-event-talks-app
   ```

2. **Create and activate a virtual environment**:
   ```bash
   python3 -m venv .venv
   
   # On macOS/Linux:
   source .venv/bin/activate
   
   # On Windows (cmd):
   .venv\Scripts\activate.bat
   
   # On Windows (PowerShell):
   .venv\Scripts\Activate.ps1
   ```

3. **Install python packages**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Launch the web application**:
   ```bash
   python app.py
   ```

5. **Open in browser**:
   Navigate to [http://127.0.0.1:5000](http://127.0.0.1:5000) inside your web browser.

---

## 🛠️ Built With
* **Backend**: [Python Flask](https://flask.palletsprojects.com/), [feedparser](https://github.com/kurtmckee/feedparser), [requests](https://requests.readthedocs.io/)
* **Frontend**: Vanilla HTML5, CSS3 Variables, ES6 JavaScript
* **Icons**: Built-in inline custom SVGs
* **Fonts**: Google Fonts ([Outfit](https://fonts.google.com/specimen/Outfit) & [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono))
