/**
 * BigQuery Release Notes Explorer - Client Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    // State management
    let releases = [];
    let filteredReleases = [];
    let activeCategories = new Set();
    let bookmarkedIds = new Set(JSON.parse(localStorage.getItem('bq_bookmarks') || '[]'));
    let readIds = new Set(JSON.parse(localStorage.getItem('bq_read') || '[]'));
    
    // Cache UI elements
    const releasesStack = document.getElementById('releases-stack');
    const emptyState = document.getElementById('empty-state');
    const resetFiltersBtn = document.getElementById('reset-filters-btn');
    const refreshBtn = document.getElementById('refresh-btn');
    const cacheBadge = document.getElementById('cache-badge');
    
    // Filter controls
    const searchInput = document.getElementById('search-input');
    const categoryFiltersContainer = document.getElementById('category-filters-container');
    const timeframeRadios = document.querySelectorAll('input[name="timeframe"]');
    const bookmarkFilter = document.getElementById('bookmark-filter');
    const unreadFilter = document.getElementById('unread-filter');
    const sortSelect = document.getElementById('sort-select');
    const resultsCount = document.getElementById('results-count');
    
    // Stats elements
    const valTotal = document.getElementById('val-total');
    const valFeatures = document.getElementById('val-features');
    const valAnnouncements = document.getElementById('val-announcements');
    const valIssues = document.getElementById('val-issues');
    const bookmarkCountBadge = document.getElementById('bookmark-count');
    const unreadCountBadge = document.getElementById('unread-count');
    const markAllReadBtn = document.getElementById('mark-all-read');
    
    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    
    // ==========================================
    // Theme Management
    // ==========================================
    function initTheme() {
        const savedTheme = localStorage.getItem('theme');
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        if (savedTheme === 'light' || (!savedTheme && !systemPrefersDark)) {
            document.documentElement.setAttribute('data-theme', 'light');
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
    }
    
    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        showToast(`Switched to ${newTheme} mode`, 'info');
    });

    // ==========================================
    // Fetch and Load Data
    // ==========================================
    async function loadData(forceRefresh = false) {
        setLoadingState(true);
        const url = forceRefresh ? '/api/releases?refresh=true' : '/api/releases';
        
        try {
            // Append random param to bypass browser cache on manual refresh
            const fetchUrl = forceRefresh ? `${url}&t=${Date.now()}` : url;
            const response = await fetch(fetchUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.status === 'success') {
                releases = data.releases.map(item => {
                    const parsedCategories = extractCategoriesFromHtml(item.content);
                    return {
                        ...item,
                        categories: parsedCategories,
                        parsedDate: new Date(item.updated || parseDateFromTitle(item.title))
                    };
                });
                
                // Show cache badge if applicable
                if (data.cached) {
                    cacheBadge.classList.remove('hidden');
                } else {
                    cacheBadge.classList.add('hidden');
                    if (forceRefresh) {
                        showToast('Feed refreshed successfully', 'success');
                    }
                }
                
                // Build dynamic sidebar categories and populate state
                buildCategoryFilterUI();
                updateStats();
                applyFilters();
            } else {
                throw new Error(data.message || 'Unknown API error');
            }
        } catch (error) {
            console.error('Failed to load release notes:', error);
            showToast(`Error: ${error.message}. Serving fallback interface.`, 'error');
            renderErrorState(error.message);
        } finally {
            setLoadingState(false);
        }
    }

    // Parse helper since some updated dates are missing or plain text
    function parseDateFromTitle(title) {
        // Expected format: "June 17, 2026"
        try {
            return Date.parse(title);
        } catch(e) {
            return Date.now();
        }
    }

    // Categorization logic based on h3 headers inside content
    function extractCategoriesFromHtml(contentHtml) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(contentHtml, 'text/html');
        const h3Headers = doc.querySelectorAll('h3');
        const cats = [];
        
        h3Headers.forEach(header => {
            const label = header.textContent.trim();
            if (label) cats.push(label);
        });
        
        if (cats.length === 0) {
            // Check content keywords if no header
            const lowerContent = contentHtml.toLowerCase();
            if (lowerContent.includes('announcement')) cats.push('Announcement');
            else if (lowerContent.includes('deprecat')) cats.push('Deprecated');
            else if (lowerContent.includes('issue') || lowerContent.includes('bug')) cats.push('Issue');
            else if (lowerContent.includes('feature')) cats.push('Feature');
            else cats.push('General');
        }
        
        return [...new Set(cats)]; // Unique categories
    }

    // ==========================================
    // Filter & Search Operations
    // ==========================================
    function applyFilters() {
        const searchQuery = searchInput.value.toLowerCase().trim();
        const selectedTimeframe = document.querySelector('input[name="timeframe"]:checked').value;
        const showBookmarksOnly = bookmarkFilter.checked;
        const showUnreadOnly = unreadFilter.checked;
        
        // Get currently checked categories
        const checkedCategories = [];
        document.querySelectorAll('.category-filter-checkbox:checked').forEach(cb => {
            checkedCategories.push(cb.value);
        });

        filteredReleases = releases.filter(release => {
            // Search text filter
            const matchesSearch = !searchQuery || 
                release.title.toLowerCase().includes(searchQuery) || 
                release.content.toLowerCase().includes(searchQuery);
                
            // Categories filter
            const matchesCategory = checkedCategories.length === 0 || 
                release.categories.some(cat => checkedCategories.includes(cat));
                
            // Timeframe filter
            let matchesTimeframe = true;
            if (selectedTimeframe !== 'all') {
                const limitDays = parseInt(selectedTimeframe);
                const limitDate = new Date();
                limitDate.setDate(limitDate.getDate() - limitDays);
                matchesTimeframe = release.parsedDate >= limitDate;
            }
            
            // Preferences filters
            const matchesBookmark = !showBookmarksOnly || bookmarkedIds.has(release.id);
            const matchesUnread = !showUnreadOnly || !readIds.has(release.id);
            
            return matchesSearch && matchesCategory && matchesTimeframe && matchesBookmark && matchesUnread;
        });

        // Sorting
        const sortBy = sortSelect.value;
        filteredReleases.sort((a, b) => {
            return sortBy === 'newest' ? b.parsedDate - a.parsedDate : a.parsedDate - b.parsedDate;
        });

        renderFeed();
        updateResultsCount();
    }

    // ==========================================
    // UI Rendering
    // ==========================================
    function setLoadingState(isLoading) {
        if (isLoading) {
            refreshBtn.querySelector('svg').classList.add('spinning');
            releasesStack.innerHTML = `
                <div class="skeleton-card">
                    <div class="skeleton-title"></div>
                    <div class="skeleton-badges"><div class="skeleton-badge"></div><div class="skeleton-badge"></div></div>
                    <div class="skeleton-line"></div>
                    <div class="skeleton-line"></div>
                    <div class="skeleton-line short"></div>
                </div>
                <div class="skeleton-card">
                    <div class="skeleton-title"></div>
                    <div class="skeleton-badges"><div class="skeleton-badge"></div></div>
                    <div class="skeleton-line"></div>
                    <div class="skeleton-line"></div>
                </div>
            `;
            emptyState.classList.add('hidden');
        } else {
            refreshBtn.querySelector('svg').classList.remove('spinning');
        }
    }

    function buildCategoryFilterUI() {
        // Collect all categories and counts
        const catCounts = {};
        releases.forEach(r => {
            r.categories.forEach(cat => {
                catCounts[cat] = (catCounts[cat] || 0) + 1;
            });
        });

        // Build HTML
        categoryFiltersContainer.innerHTML = '';
        const sortedCats = Object.keys(catCounts).sort();
        
        sortedCats.forEach(cat => {
            const isChecked = activeCategories.has(cat);
            const labelId = `cat-cb-${cat.replace(/\s+/g, '-').toLowerCase()}`;
            
            const checkboxEl = document.createElement('label');
            checkboxEl.className = 'filter-checkbox';
            checkboxEl.innerHTML = `
                <span class="checkbox-label">
                    <input type="checkbox" class="category-filter-checkbox" value="${cat}" id="${labelId}" ${isChecked ? 'checked' : ''}>
                    <span>${cat}</span>
                </span>
                <span class="count-badge">${catCounts[cat]}</span>
            `;
            
            // Event listener
            checkboxEl.querySelector('input').addEventListener('change', (e) => {
                if (e.target.checked) {
                    activeCategories.add(cat);
                } else {
                    activeCategories.delete(cat);
                }
                applyFilters();
            });
            
            categoryFiltersContainer.appendChild(checkboxEl);
        });
    }

    function renderFeed() {
        if (filteredReleases.length === 0) {
            releasesStack.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        releasesStack.innerHTML = '';
        
        filteredReleases.forEach(release => {
            const isBookmarked = bookmarkedIds.has(release.id);
            const isRead = readIds.has(release.id);
            
            const card = document.createElement('article');
            card.className = `release-card ${isBookmarked ? 'bookmarked' : ''} ${!isRead ? 'unread' : ''}`;
            card.dataset.id = release.id;
            
            // Format dates
            const relativeTimeStr = getRelativeTime(release.parsedDate);
            const formattedDateStr = release.parsedDate.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            // Badge tags
            const badgesHtml = release.categories.map(cat => {
                const cls = getCategoryClass(cat);
                return `<span class="badge-tag ${cls}">${cat}</span>`;
            }).join('');

            card.innerHTML = `
                <div class="card-header-row">
                    <div class="card-title-group">
                        <h2>${release.title}</h2>
                        <div class="card-meta">
                            <time datetime="${release.parsedDate.toISOString()}">${formattedDateStr}</time>
                            <span class="dot"></span>
                            <span>${relativeTimeStr}</span>
                        </div>
                    </div>
                </div>
                
                <div class="card-badges">
                    ${badgesHtml}
                </div>
                
                <div class="card-body">
                    ${release.content}
                </div>
                
                <div class="card-actions">
                    <div class="card-action-left">
                        <button class="btn-icon btn-star ${isBookmarked ? 'active' : ''}" title="${isBookmarked ? 'Remove Bookmark' : 'Bookmark Update'}" aria-label="Bookmark">
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="${isBookmarked ? 'currentColor' : 'none'}" stroke-linecap="round" stroke-linejoin="round">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                            </svg>
                        </button>
                        
                        <button class="btn-icon btn-read" title="${isRead ? 'Mark as Unread' : 'Mark as Read'}" aria-label="Read status">
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                ${isRead 
                                    ? `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>`
                                    : `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>`
                                }
                            </svg>
                        </button>
                    </div>
                    
                    <div class="card-action-right">
                        <button class="btn-icon btn-tweet" title="Share on X (Twitter)" aria-label="Share on X">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
                            </svg>
                        </button>

                        <button class="btn-icon btn-share" title="Copy shareable link" aria-label="Share update">
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                            </svg>
                        </button>
                        
                        <a href="${release.link}" target="_blank" rel="noopener noreferrer" class="btn-secondary" title="View official GCP Docs documentation page">
                            <span>Official Docs</span>
                            <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="7" y1="17" x2="17" y2="7"></line>
                                <polyline points="7 7 17 7 17 17"></polyline>
                            </svg>
                        </a>
                    </div>
                </div>
            `;
            
            // Wire card event actions
            card.querySelector('.btn-star').addEventListener('click', (e) => {
                e.stopPropagation();
                toggleBookmark(release.id);
            });
            
            card.querySelector('.btn-read').addEventListener('click', (e) => {
                e.stopPropagation();
                toggleRead(release.id);
            });
            
            card.querySelector('.btn-share').addEventListener('click', (e) => {
                e.stopPropagation();
                copyToClipboard(release.link || window.location.href);
            });

            card.querySelector('.btn-tweet').addEventListener('click', (e) => {
                e.stopPropagation();
                tweetRelease(release);
            });
            
            // Clicking card background automatically marks it as read
            card.addEventListener('click', () => {
                if (!readIds.has(release.id)) {
                    toggleRead(release.id);
                }
            });

            releasesStack.appendChild(card);
        });
    }

    function getCategoryClass(cat) {
        const c = cat.toLowerCase();
        if (c.includes('feature')) return 'feature';
        if (c.includes('announcement')) return 'announcement';
        if (c.includes('issue') || c.includes('alert') || c.includes('security')) return 'issue';
        if (c.includes('deprecat')) return 'deprecated';
        return 'general';
    }

    function getRelativeTime(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) {
            const weeks = Math.floor(diffDays / 7);
            return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
        }
        
        const months = Math.floor(diffDays / 30);
        return `${months} ${months === 1 ? 'month' : 'months'} ago`;
    }

    function renderErrorState(message) {
        releasesStack.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon" style="color: var(--accent-issue); border-color: var(--accent-issue);">
                    <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                </div>
                <h3>Failed to fetch release notes</h3>
                <p>${message || 'An error occurred while calling the Flask API.'}</p>
                <button onclick="window.location.reload()" class="primary-btn">Retry Fetch</button>
            </div>
        `;
    }

    // ==========================================
    // Interactive Preferences Storage Actions
    // ==========================================
    function toggleBookmark(id) {
        if (bookmarkedIds.has(id)) {
            bookmarkedIds.delete(id);
            showToast('Bookmark removed', 'info');
        } else {
            bookmarkedIds.add(id);
            showToast('Update bookmarked', 'success');
        }
        
        localStorage.setItem('bq_bookmarks', JSON.stringify([...bookmarkedIds]));
        updateStats();
        applyFilters();
    }

    function toggleRead(id) {
        if (readIds.has(id)) {
            readIds.delete(id);
        } else {
            readIds.add(id);
        }
        
        localStorage.setItem('bq_read', JSON.stringify([...readIds]));
        updateStats();
        applyFilters();
    }

    function markAllRead() {
        const visibleIds = filteredReleases.map(r => r.id);
        let updatedCount = 0;
        
        visibleIds.forEach(id => {
            if (!readIds.has(id)) {
                readIds.add(id);
                updatedCount++;
            }
        });
        
        if (updatedCount > 0) {
            localStorage.setItem('bq_read', JSON.stringify([...readIds]));
            showToast(`Marked ${updatedCount} updates as read`, 'success');
            updateStats();
            applyFilters();
        } else {
            showToast('All visible updates are already read', 'info');
        }
    }

    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Link copied to clipboard', 'success');
        }).catch(err => {
            console.error('Clipboard copy failed:', err);
            showToast('Failed to copy link', 'error');
        });
    }

    function tweetRelease(release) {
        // Parse HTML to extract plain text
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = release.content;
        
        // Remove headers
        const h3s = tempDiv.querySelectorAll('h3');
        h3s.forEach(h3 => h3.remove());
        
        const plainText = tempDiv.textContent || tempDiv.innerText || "";
        const cleanText = plainText.replace(/\s+/g, ' ').trim();
        
        // Build categories snippet
        const categoriesText = release.categories.map(c => `[${c}]`).join(' ');
        
        // Construct X (Twitter) text structure
        const introText = `Google BigQuery Release (${release.title}) ${categoriesText}: `;
        const hashTags = ` #BigQuery #GoogleCloud`;
        
        // Twitter limit is 280. URLs count as 23.
        const maxContentLength = 280 - 23 - introText.length - hashTags.length - 2; // room for spaces
        
        let contentSnippet = cleanText;
        if (contentSnippet.length > maxContentLength) {
            contentSnippet = contentSnippet.substring(0, maxContentLength - 3) + '...';
        }
        
        const tweetText = `${introText}${contentSnippet}${hashTags}`;
        const tweetIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(release.link)}`;
        
        window.open(tweetIntentUrl, '_blank', 'noopener,noreferrer');
        showToast('Opening Twitter / X share dialog...', 'success');
    }

    // ==========================================
    // Counters & Metrics Updating
    // ==========================================
    function updateStats() {
        // Counts
        const total = releases.length;
        let features = 0;
        let announcements = 0;
        let issues = 0;
        
        releases.forEach(r => {
            const hasFeature = r.categories.some(cat => cat.toLowerCase().includes('feature'));
            const hasAnnouncement = r.categories.some(cat => cat.toLowerCase().includes('announcement'));
            const hasIssue = r.categories.some(cat => 
                cat.toLowerCase().includes('issue') || 
                cat.toLowerCase().includes('alert') || 
                cat.toLowerCase().includes('deprecat')
            );
            
            if (hasFeature) features++;
            if (hasAnnouncement) announcements++;
            if (hasIssue) issues++;
        });

        // Set text
        valTotal.textContent = total || '0';
        valFeatures.textContent = features || '0';
        valAnnouncements.textContent = announcements || '0';
        valIssues.textContent = issues || '0';
        
        // Count unread that exist in feed
        let currentUnread = 0;
        releases.forEach(r => {
            if (!readIds.has(r.id)) currentUnread++;
        });

        bookmarkCountBadge.textContent = bookmarkedIds.size;
        unreadCountBadge.textContent = currentUnread;
    }

    function updateResultsCount() {
        resultsCount.textContent = `Showing ${filteredReleases.length} of ${releases.length} releases`;
    }

    function resetFilters() {
        searchInput.value = '';
        document.querySelector('input[name="timeframe"][value="all"]').checked = true;
        bookmarkFilter.checked = false;
        unreadFilter.checked = false;
        activeCategories.clear();
        
        // Uncheck checkboxes
        document.querySelectorAll('.category-filter-checkbox').forEach(cb => {
            cb.checked = false;
        });
        
        applyFilters();
        showToast('Filters reset', 'info');
    }

    // ==========================================
    // Toast Notification System
    // ==========================================
    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const typeIcon = type === 'success' 
            ? `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>`
            : `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;

        toast.innerHTML = `
            ${typeIcon}
            <span>${message}</span>
        `;
        
        container.appendChild(toast);
        
        // Auto dismiss after 3 seconds
        setTimeout(() => {
            toast.classList.add('hiding');
            toast.addEventListener('animationend', () => {
                toast.remove();
            });
        }, 3000);
    }

    // ==========================================
    // Attach Global Event Listeners
    // ==========================================
    searchInput.addEventListener('input', applyFilters);
    sortSelect.addEventListener('change', applyFilters);
    bookmarkFilter.addEventListener('change', applyFilters);
    unreadFilter.addEventListener('change', applyFilters);
    markAllReadBtn.addEventListener('click', markAllRead);
    resetFiltersBtn.addEventListener('click', resetFilters);
    
    timeframeRadios.forEach(radio => {
        radio.addEventListener('change', applyFilters);
    });
    
    refreshBtn.addEventListener('click', () => {
        loadData(true);
    });

    // Start initialization
    initTheme();
    loadData();
});
