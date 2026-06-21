import os
import time
import json
import requests
import feedparser
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
CACHE_FILE = "feed_cache.json"
CACHE_DURATION = 600  # 10 minutes

def get_release_notes(force_refresh=False):
    now = time.time()
    
    # Check if cache is fresh
    if not force_refresh and os.path.exists(CACHE_FILE):
        mtime = os.path.getmtime(CACHE_FILE)
        if now - mtime < CACHE_DURATION:
            try:
                with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                    return json.load(f), True
            except Exception as e:
                app.logger.warning(f"Failed to read cache file: {e}")

    # Fetch new feed data
    try:
        app.logger.info(f"Fetching fresh feed from {FEED_URL}")
        headers = {
            'User-Agent': 'BigQueryReleaseNotesViewer/1.0 (Flask Web App; Python)'
        }
        response = requests.get(FEED_URL, headers=headers, timeout=15)
        response.raise_for_status()
        
        feed = feedparser.parse(response.content)
        
        releases = []
        for entry in feed.entries:
            # Atom content can be in 'content' or 'summary'
            content_html = ""
            if 'content' in entry and len(entry.content) > 0:
                content_html = entry.content[0].value
            elif 'summary' in entry:
                content_html = entry.summary
                
            releases.append({
                'id': entry.get('id', ''),
                'title': entry.get('title', ''),
                'updated': entry.get('updated', ''),
                'link': entry.get('link', ''),
                'content': content_html
            })
            
        # Write to cache
        try:
            with open(CACHE_FILE, 'w', encoding='utf-8') as f:
                json.dump(releases, f, indent=2, ensure_ascii=False)
        except Exception as e:
            app.logger.error(f"Failed to write cache file: {e}")
            
        return releases, False
    except Exception as e:
        app.logger.error(f"Failed to fetch feed: {e}")
        # Try to fallback to cached version even if expired
        if os.path.exists(CACHE_FILE):
            try:
                app.logger.info("Serving expired cache as fallback")
                with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                    return json.load(f), True
            except Exception as read_err:
                app.logger.error(f"Failed to read expired cache: {read_err}")
        raise e

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def api_releases():
    try:
        force_refresh = request.args.get('refresh', 'false').lower() == 'true'
        releases, is_cached = get_release_notes(force_refresh=force_refresh)
        return jsonify({
            'status': 'success',
            'cached': is_cached,
            'count': len(releases),
            'releases': releases
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.after_request
def add_security_headers(response):
    response.headers['Content-Security-Policy'] = (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data:; "
        "connect-src 'self'; "
        "frame-ancestors 'none'; "
        "base-uri 'self';"
    )
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    return response

if __name__ == '__main__':
    # Run locally bound to localhost to secure the Werkzeug interactive debugger
    app.run(host='127.0.0.1', port=5000, debug=True)
