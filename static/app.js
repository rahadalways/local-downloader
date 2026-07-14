document.addEventListener('DOMContentLoaded', () => {
    // Theme Switcher Elements
    const body = document.body;
    const btnThemeToggle = document.getElementById('btn-theme-toggle');

    // Sidebar & View Navigation Elements
    const menuHome = document.getElementById('menu-home');
    const menuDownloads = document.getElementById('menu-downloads');
    const menuHistory = document.getElementById('menu-history');
    const menuSettings = document.getElementById('menu-settings');
    const menuHelp = document.getElementById('menu-help');

    // Section views (Home/Downloads/History views inside main flow)
    const contentHeadingTitle = document.querySelector('.content-heading h1');
    const contentHeadingSub = document.querySelector('.content-heading p');
    const downloadInputCard = document.querySelector('.download-input-card');
    const platformIndicators = document.querySelector('.platform-indicators');
    const statsSection = document.querySelector('.stats-section');
    const activityHeaderTitle = document.querySelector('.activity-header h2');
    const btnClearHistoryUI = document.getElementById('btn-clear-history-ui');

    // Input elements
    const inputUrl = document.getElementById('input-url');
    const btnClearUrl = document.getElementById('btn-clear-url');
    const btnAddQueue = document.getElementById('btn-add-queue');
    const inputSearchDownloads = document.getElementById('input-search-downloads');

    // Platform Pills
    const pillYoutube = document.getElementById('pill-youtube');
    const pillFacebook = document.getElementById('pill-facebook');
    const pillInstagram = document.getElementById('pill-instagram');
    const pillTiktok = document.getElementById('pill-tiktok');

    // Loader & Errors
    const analyzeLoader = document.getElementById('analyze-loader');
    const analyzeError = document.getElementById('analyze-error');
    const errorText = document.getElementById('error-text');
    const btnCloseError = document.getElementById('btn-close-error');

    // Result Preview Card Elements
    const analyzeResultCard = document.getElementById('analyze-result-card');
    const previewThumbnail = document.getElementById('preview-thumbnail');
    const previewDuration = document.getElementById('preview-duration');
    const previewTitle = document.getElementById('preview-title');
    const previewPlatform = document.getElementById('preview-platform');
    const previewAuthor = document.getElementById('preview-author');
    const btnClosePreview = document.getElementById('btn-close-preview');
    const formatOptionsGrid = document.getElementById('format-options-grid');

    // Lists
    const activityList = document.getElementById('activity-list');

    // Modals
    const settingsModal = document.getElementById('settings-modal');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const btnSaveSettings = document.getElementById('btn-save-settings');
    const settingsMessage = document.getElementById('settings-message');

    const helpModal = document.getElementById('help-modal');
    const btnCloseHelp = document.getElementById('btn-close-help');

    // Config Input elements inside modal
    const inputDownloadDir = document.getElementById('input-download-dir');
    const selectBrowserCookies = document.getElementById('select-browser-cookies');
    const selectDefaultQuality = document.getElementById('select-default-quality');
    const inputBrowserProxy = document.getElementById('input-browser-proxy');
    const btnUpdateEngine = document.getElementById('btn-update-engine');
    const engineUpdateText = document.getElementById('engine-update-text');

    // Stats and Status elements
    const statSpeed = document.getElementById('stat-speed');
    const statSpeedSub = document.getElementById('stat-speed-sub');
    const statFiles = document.getElementById('stat-files');
    const statSizeSub = document.getElementById('stat-size-sub');
    const statusStorage = document.getElementById('status-storage');
    const statusEngine = document.getElementById('status-engine');

    // State Variables
    let currentTab = 'home'; // 'home', 'downloads', 'history'
    let searchQuery = '';
    let defaultQuality = 'best';
    let localDownloads = [];
    let localHistory = [];
    let pollingInterval = null;

    // Platform UI details mappings
    const platformDetails = {
        youtube: { name: 'YouTube', icon: 'fa-brands fa-youtube', pill: pillYoutube, class: 'detected-youtube' },
        facebook: { name: 'Facebook', icon: 'fa-brands fa-facebook', pill: pillFacebook, class: 'detected-facebook' },
        instagram: { name: 'Instagram', icon: 'fa-brands fa-instagram', pill: pillInstagram, class: 'detected-instagram' },
        tiktok: { name: 'TikTok', icon: 'fa-brands fa-tiktok', pill: pillTiktok, class: 'detected-tiktok' },
        generic: { name: 'Media Link', icon: 'fa-solid fa-circle-play', pill: null, class: null }
    };

    // Initialize Theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
        body.classList.add('dark-theme');
        body.classList.remove('light-theme');
        btnThemeToggle.innerHTML = '<i class="fa-regular fa-sun"></i>';
    } else {
        body.classList.add('light-theme');
        body.classList.remove('dark-theme');
        btnThemeToggle.innerHTML = '<i class="fa-regular fa-moon"></i>';
    }

    // Toggle Theme Click Action
    btnThemeToggle.addEventListener('click', () => {
        if (body.classList.contains('dark-theme')) {
            body.classList.remove('dark-theme');
            body.classList.add('light-theme');
            localStorage.setItem('theme', 'light');
            btnThemeToggle.innerHTML = '<i class="fa-regular fa-moon"></i>';
        } else {
            body.classList.remove('light-theme');
            body.classList.add('dark-theme');
            localStorage.setItem('theme', 'dark');
            btnThemeToggle.innerHTML = '<i class="fa-regular fa-sun"></i>';
        }
    });

    // Sidebar View Navigation Click Listeners
    menuHome.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab('home');
    });

    menuDownloads.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab('downloads');
    });

    menuHistory.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab('history');
    });

    menuSettings.addEventListener('click', (e) => {
        e.preventDefault();
        settingsModal.classList.remove('hidden');
        fetchConfig();
    });

    menuHelp.addEventListener('click', (e) => {
        e.preventDefault();
        helpModal.classList.remove('hidden');
    });

    // Close Modals
    btnCloseModal.addEventListener('click', () => {
        settingsModal.classList.add('hidden');
        settingsMessage.classList.add('hidden');
    });

    btnCloseHelp.addEventListener('click', () => {
        helpModal.classList.add('hidden');
    });

    // Close modal when clicking outside content
    window.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.classList.add('hidden');
            settingsMessage.classList.add('hidden');
        }
        if (e.target === helpModal) {
            helpModal.classList.add('hidden');
        }
    });

    // Input handlers
    inputUrl.addEventListener('input', handleUrlInput);
    btnClearUrl.addEventListener('click', () => {
        inputUrl.value = '';
        handleUrlInput();
    });
    
    // Add to queue button action
    btnAddQueue.addEventListener('click', addToQueue);
    inputUrl.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addToQueue();
        }
    });

    // Search downloads bar action
    inputSearchDownloads.addEventListener('input', () => {
        searchQuery = inputSearchDownloads.value.trim().toLowerCase();
        renderActivityList();
    });

    // Close Error Banner
    btnCloseError.addEventListener('click', () => {
        analyzeError.classList.add('hidden');
    });

    // Close Preview Card
    btnClosePreview.addEventListener('click', () => {
        analyzeResultCard.classList.add('hidden');
    });

    // Settings actions
    btnSaveSettings.addEventListener('click', saveConfig);
    btnUpdateEngine.addEventListener('click', startEngineUpdate);

    // View Swapper logic
    function switchTab(tabName) {
        currentTab = tabName;

        // Reset sidebar active indicators
        menuHome.classList.remove('active');
        menuDownloads.classList.remove('active');
        menuHistory.classList.remove('active');

        if (tabName === 'home') {
            menuHome.classList.add('active');
            contentHeadingTitle.textContent = 'New Download';
            contentHeadingSub.textContent = 'Enter a video URL to start processing your content in high resolution.';
            downloadInputCard.classList.remove('hidden');
            platformIndicators.classList.remove('hidden');
            statsSection.classList.remove('hidden');
            activityHeaderTitle.textContent = 'Recent Activity';
            btnClearHistoryUI.classList.remove('hidden');
        } else if (tabName === 'downloads') {
            menuDownloads.classList.add('active');
            contentHeadingTitle.textContent = 'Active Downloads';
            contentHeadingSub.textContent = 'Monitor current active media downloads speed and progress.';
            downloadInputCard.classList.add('hidden');
            platformIndicators.classList.add('hidden');
            statsSection.classList.add('hidden');
            activityHeaderTitle.textContent = 'Running Processes';
            btnClearHistoryUI.classList.add('hidden');
        } else if (tabName === 'history') {
            menuHistory.classList.add('active');
            contentHeadingTitle.textContent = 'Completed History';
            contentHeadingSub.textContent = 'Access local media downloads history and files instantly.';
            downloadInputCard.classList.add('hidden');
            platformIndicators.classList.add('hidden');
            statsSection.classList.add('hidden');
            activityHeaderTitle.textContent = 'Download Log';
            btnClearHistoryUI.classList.remove('hidden');
        }

        renderActivityList();
    }

    // URL Detection and Highlight Platform Indicators
    function handleUrlInput() {
        const url = inputUrl.value.trim();
        
        if (url.length > 0) {
            btnClearUrl.classList.remove('hidden');
        } else {
            btnClearUrl.classList.add('hidden');
        }

        // Reset pill indicator classes
        pillYoutube.className = 'platform-pill';
        pillFacebook.className = 'platform-pill';
        pillInstagram.className = 'platform-pill';
        pillTiktok.className = 'platform-pill';

        const platform = detectPlatform(url);
        if (platform && platformDetails[platform] && platformDetails[platform].pill) {
            platformDetails[platform].pill.classList.add(platformDetails[platform].class);
        }
    }

    function detectPlatform(url) {
        if (!url) return null;
        const lowUrl = url.toLowerCase();
        if (lowUrl.includes('youtube.com') || lowUrl.includes('youtu.be')) return 'youtube';
        if (lowUrl.includes('facebook.com') || lowUrl.includes('fb.watch') || lowUrl.includes('fb.com')) return 'facebook';
        if (lowUrl.includes('instagram.com')) return 'instagram';
        if (lowUrl.includes('tiktok.com')) return 'tiktok';
        return 'generic';
    }

    // Fetch local configurations
    async function fetchConfig() {
        try {
            const res = await fetch('/api/config');
            if (res.ok) {
                const data = await res.json();
                inputDownloadDir.value = data.download_dir;
                selectBrowserCookies.value = data.browser_cookies || 'none';
                selectDefaultQuality.value = data.default_quality || 'best';
                inputBrowserProxy.value = data.browser_proxy || '';
                defaultQuality = data.default_quality || 'best';
            }
        } catch (err) {
            console.error('Error fetching config:', err);
        }
    }

    // Save configurations
    async function saveConfig() {
        const path = inputDownloadDir.value.trim();
        const cookies = selectBrowserCookies.value;
        const quality = selectDefaultQuality.value;
        const proxy = inputBrowserProxy.value.trim();

        if (!path) {
            showSettingsMessage('Download directory path is required', 'error');
            return;
        }

        try {
            btnSaveSettings.disabled = true;
            btnSaveSettings.textContent = 'Saving...';

            const res = await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    download_dir: path,
                    browser_cookies: cookies,
                    browser_proxy: proxy,
                    default_quality: quality
                })
            });

            const data = await res.json();
            if (res.ok) {
                defaultQuality = quality;
                showSettingsMessage('Settings saved successfully!', 'success');
                fetchStats();
                setTimeout(() => {
                    settingsModal.classList.add('hidden');
                    settingsMessage.classList.add('hidden');
                }, 1000);
            } else {
                showSettingsMessage(data.detail || 'Failed to save settings', 'error');
            }
        } catch (err) {
            showSettingsMessage('Error connecting to server', 'error');
        } finally {
            btnSaveSettings.disabled = false;
            btnSaveSettings.textContent = 'Save Settings';
        }
    }

    function showSettingsMessage(msg, type) {
        settingsMessage.textContent = msg;
        settingsMessage.className = `settings-message ${type}`;
        settingsMessage.classList.remove('hidden');
    }

    // Update yt-dlp Engine
    async function startEngineUpdate() {
        try {
            btnUpdateEngine.disabled = true;
            btnUpdateEngine.innerHTML = '<i class="fa-solid fa-arrows-rotate animate-spin"></i> Updating...';
            engineUpdateText.style.display = 'block';
            engineUpdateText.textContent = 'Sending update request...';
            engineUpdateText.style.color = 'var(--text-secondary)';

            const res = await fetch('/api/update-engine', { method: 'POST' });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || "Failed to start update");
            }

            statusEngine.innerHTML = '<i class="fa-solid fa-circle-info animate-bounce"></i> ENGINE: UPDATING';

            // Poll update state status
            const pollTimer = setInterval(async () => {
                try {
                    const statusRes = await fetch('/api/update-status');
                    if (statusRes.ok) {
                        const state = await statusRes.json();
                        if (state.status === 'success') {
                            clearInterval(pollTimer);
                            engineUpdateText.textContent = "Engine updated successfully!";
                            engineUpdateText.style.color = "var(--success-color)";
                            btnUpdateEngine.disabled = false;
                            btnUpdateEngine.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Update Downloader Engine';
                            statusEngine.innerHTML = '<i class="fa-solid fa-circle-info"></i> ENGINE: READY';
                        } else if (state.status === 'error') {
                            clearInterval(pollTimer);
                            engineUpdateText.textContent = "Update failed: " + state.error;
                            engineUpdateText.style.color = "var(--error-color)";
                            btnUpdateEngine.disabled = false;
                            btnUpdateEngine.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Update Downloader Engine';
                            statusEngine.innerHTML = '<i class="fa-solid fa-circle-info"></i> ENGINE: ERROR';
                        } else {
                            engineUpdateText.textContent = "Downloading binaries, please wait...";
                        }
                    }
                } catch (err) {
                    console.error("Error polling engine status:", err);
                }
            }, 1500);
        } catch (err) {
            engineUpdateText.textContent = "Error: " + err.message;
            engineUpdateText.style.color = "var(--error-color)";
            btnUpdateEngine.disabled = false;
            btnUpdateEngine.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Update Downloader Engine';
            statusEngine.innerHTML = '<i class="fa-solid fa-circle-info"></i> ENGINE: ERROR';
        }
    }

    // Add to downloads Queue Action
    async function addToQueue() {
        const url = inputUrl.value.trim();
        if (!url) return;

        // Clear error box and previous preview
        analyzeError.classList.add('hidden');
        analyzeResultCard.classList.add('hidden');

        // Show Loader
        analyzeLoader.classList.remove('hidden');
        btnAddQueue.disabled = true;
        btnAddQueue.innerHTML = '<i class="fa-solid fa-circle-notch animate-spin"></i> Processing';

        try {
            // Step 1: Run link analysis
            const res = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: url })
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.detail || 'Analysis failed. Make sure the video is public.');
            }

            // Step 2: Render results in preview panel instead of starting download immediately
            previewThumbnail.src = data.thumbnail || 'https://placehold.co/600x400/1e293b/e2e8f0?text=No+Thumbnail';
            previewDuration.textContent = data.duration || '00:00';
            previewTitle.textContent = data.title || 'Unknown Title';
            
            // Map platform icons
            const pInfo = platformDetails[data.platform] || platformDetails['generic'];
            previewPlatform.innerHTML = `<i class="${pInfo.icon}"></i> ${pInfo.name}`;
            previewAuthor.innerHTML = `<i class="fa-regular fa-user"></i> ${data.uploader || 'Channel'}`;

            // Populate options grid
            formatOptionsGrid.innerHTML = '';
            if (data.formats && data.formats.length > 0) {
                data.formats.forEach(f => {
                    const btn = document.createElement('button');
                    btn.className = 'btn-format-option';
                    btn.innerHTML = `
                        <span><i class="${f.icon}"></i> &nbsp;${f.label}</span>
                        <span class="format-option-size">${f.size}</span>
                    `;
                    btn.addEventListener('click', async () => {
                        // Show download start loading on the option button
                        btn.disabled = true;
                        btn.innerHTML = `
                            <span><i class="fa-solid fa-circle-notch animate-spin"></i> &nbsp;Adding to queue...</span>
                            <span class="format-option-size">${f.size}</span>
                        `;
                        try {
                            const dlRes = await fetch('/api/download', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    url: url,
                                    format_select: f.format_id
                                })
                            });

                            if (!dlRes.ok) {
                                const dlData = await dlRes.json();
                                throw new Error(dlData.detail || 'Failed to start download.');
                            }

                            // Clear input, hide preview
                            inputUrl.value = '';
                            handleUrlInput();
                            analyzeResultCard.classList.add('hidden');

                            // Redirect to downloads tab
                            await fetchAllData();
                            switchTab('downloads');
                        } catch (dlErr) {
                            alert(dlErr.message);
                            btn.disabled = false;
                            btn.innerHTML = `
                                <span><i class="${f.icon}"></i> &nbsp;${f.label}</span>
                                <span class="format-option-size">${f.size}</span>
                            `;
                        }
                    });
                    formatOptionsGrid.appendChild(btn);
                });
            } else {
                formatOptionsGrid.innerHTML = '<p style="font-size: 0.85rem; color: var(--text-muted);">No format options available for this link.</p>';
            }

            // Display result preview card
            analyzeResultCard.classList.remove('hidden');

        } catch (err) {
            errorText.textContent = err.message;
            analyzeError.classList.remove('hidden');
        } finally {
            analyzeLoader.classList.add('hidden');
            btnAddQueue.disabled = false;
            btnAddQueue.innerHTML = 'Add to Queue <i class="fa-solid fa-circle-plus"></i>';
        }
    }

    // Fetch Stats & disk space metrics
    async function fetchStats() {
        try {
            const res = await fetch('/api/stats');
            if (res.ok) {
                const data = await res.json();
                statusStorage.innerHTML = `<i class="fa-solid fa-hard-drive"></i> ${data.storage_text}`;
                statFiles.textContent = data.total_files;
                statSizeSub.textContent = data.total_size_saved;
            }
        } catch (err) {
            console.error('Error fetching stats:', err);
        }
    }

    // Refresh downloads and history state data
    async function fetchAllData() {
        try {
            // Fetch Active Downloads
            const dlRes = await fetch('/api/downloads');
            if (dlRes.ok) {
                localDownloads = await dlRes.json();
            }

            // Fetch History list
            const histRes = await fetch('/api/history');
            if (histRes.ok) {
                localHistory = await histRes.json();
            }

            // Calculate current cumulative speed for stats panel
            let activeSpeedBytes = 0;
            let downloadingCount = 0;
            localDownloads.forEach(dl => {
                if (dl.status === 'downloading' && dl.speed) {
                    downloadingCount++;
                    // Speed format "X.XX MB/s" or "X.XX KB/s"
                    const speedParts = dl.speed.trim().split(' ');
                    if (speedParts.length === 2) {
                        const val = parseFloat(speedParts[0]);
                        const unit = speedParts[1].toLowerCase();
                        if (unit.includes('mb')) {
                            activeSpeedBytes += val * 1024 * 1024;
                        } else if (unit.includes('kb')) {
                            activeSpeedBytes += val * 1024;
                        }
                    }
                }
            });

            if (downloadingCount > 0 && activeSpeedBytes > 0) {
                // Convert bytes to MB/s
                const mbSpeed = (activeSpeedBytes / (1024 * 1024)).toFixed(1);
                statSpeed.textContent = `${mbSpeed} MB/s`;
                statSpeedSub.textContent = `Downloading ${downloadingCount} media file(s)`;
            } else {
                statSpeed.textContent = 'Uncapped';
                statSpeedSub.textContent = 'Local gigabit download enabled';
            }

            renderActivityList();
        } catch (err) {
            console.error('Error updating state lists:', err);
        }
    }

    // Render activity cards
    function renderActivityList() {
        activityList.innerHTML = '';
        let filteredItems = [];

        if (currentTab === 'home') {
            // Show both active downloads and history, filtered by search
            filteredItems = [...localDownloads, ...localHistory];
        } else if (currentTab === 'downloads') {
            filteredItems = [...localDownloads];
        } else if (currentTab === 'history') {
            filteredItems = [...localHistory];
        }

        // Apply Search filter if input contains query
        if (searchQuery) {
            filteredItems = filteredItems.filter(item => 
                (item.title && item.title.toLowerCase().includes(searchQuery)) ||
                (item.url && item.url.toLowerCase().includes(searchQuery))
            );
        }

        if (filteredItems.length === 0) {
            activityList.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-download"></i>
                    <p>${searchQuery ? 'No matching downloads found.' : 'No activity logs to show here.'}</p>
                </div>
            `;
            btnClearHistoryUI.classList.add('hidden');
            return;
        }

        // Show clear all button under history or home only if items exist
        if ((currentTab === 'home' || currentTab === 'history') && localHistory.length > 0) {
            btnClearHistoryUI.classList.remove('hidden');
        } else {
            btnClearHistoryUI.classList.add('hidden');
        }

        filteredItems.forEach(item => {
            const card = createActivityCard(item);
            activityList.appendChild(card);
        });
    }

    // Create single download card matching reference UI
    function createActivityCard(item) {
        const card = document.createElement('div');
        card.className = 'download-activity-card animate-scale-in';

        const platformKey = (item.platform && item.platform in platformDetails) ? item.platform : 'generic';
        const isHistory = !item.download_id; // Only active downloads have download_id
        
        let progressVal = 0;
        let statusText = 'Processing...';

        if (!isHistory) {
            // Process status variables for active downloads
            progressVal = item.progress_percent || 0;
            if (item.status === 'downloading') {
                statusText = `Downloading • ${item.speed || '0 KB/s'}`;
            } else if (item.status === 'paused') {
                statusText = 'Paused';
            } else if (item.status === 'merging') {
                statusText = 'Merging video & audio (FFmpeg)...';
                progressVal = 99;
            } else if (item.status === 'completed') {
                statusText = 'Completed';
            } else if (item.status === 'failed') {
                statusText = 'Failed: ' + (item.error || 'Unknown error');
            }
        } else {
            statusText = item.status === 'completed' ? 'Completed' : `Failed: ${item.error || 'Unknown error'}`;
        }

        const formatSelect = (item.format_select || 'best').toUpperCase();
        const durationDisplay = item.duration || '00:00';

        card.innerHTML = `
            <div class="card-thumb">
                <img src="${item.thumbnail || 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=150'}" alt="Thumbnail" onerror="this.src='https://placehold.co/150x85?text=Video'">
                <div class="card-duration-badge">${durationDisplay}</div>
            </div>
            <div class="card-info">
                <h3 class="card-title" title="${item.title || 'Processing video...'}">${item.title || 'Processing video...'}</h3>
                <div class="card-subtext">
                    <span style="color: var(--brand-color); font-weight:700;"><i class="${platformDetails[platformKey].icon}"></i> ${platformDetails[platformKey].name}</span>
                    &nbsp;•&nbsp; ${item.total_size || 'Unknown size'} &nbsp;•&nbsp; ${formatSelect}
                    ${!isHistory ? `&nbsp;•&nbsp; <span style="font-weight: 700; color: var(--brand-color);">${statusText}</span>` : ''}
                </div>
            </div>
            ${!isHistory ? `
                <!-- Progress bar and active stats -->
                <div class="card-progress-stats">
                    ${item.status === 'downloading' ? `<span>${progressVal}% • ${item.eta || '--:--'} left</span>` : `<span>${statusText}</span>`}
                </div>
                <div class="card-action-icons">
                    ${item.status === 'downloading' ? `
                        <button class="card-action-btn btn-pause" title="Pause Download">
                            <i class="fa-solid fa-pause"></i>
                        </button>
                    ` : item.status === 'paused' ? `
                        <button class="card-action-btn btn-resume" title="Resume Download">
                            <i class="fa-solid fa-play"></i>
                        </button>
                    ` : ''}
                    <button class="card-action-btn btn-cancel" title="Cancel & Delete">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <div class="card-progress-bar-container">
                    <div class="card-progress-bar" style="width: ${progressVal}%; ${item.status === 'paused' ? 'background-color: var(--text-muted);' : ''}"></div>
                </div>
            ` : `
                <!-- Completed History file actions -->
                <div class="card-action-icons">
                    ${item.status === 'completed' ? `
                        <button class="btn-open-file btn-play" title="Open and play video file">OPEN FILE</button>
                        <button class="card-action-btn btn-folder" title="Show in folder">
                            <i class="fa-regular fa-folder"></i>
                        </button>
                    ` : ''}
                    <button class="card-action-btn btn-delete" title="Delete from Log">
                        <i class="fa-regular fa-trash-can"></i>
                    </button>
                </div>
            `}
        `;

        // Event Attachments
        if (!isHistory) {
            const btnPause = card.querySelector('.btn-pause');
            const btnResume = card.querySelector('.btn-resume');
            const btnCancel = card.querySelector('.btn-cancel');

            if (btnPause) {
                btnPause.addEventListener('click', () => pauseDownload(item.download_id));
            }
            if (btnResume) {
                btnResume.addEventListener('click', () => resumeDownload(item.download_id));
            }
            if (btnCancel) {
                btnCancel.addEventListener('click', () => cancelDownload(item.download_id));
            }
        } else {
            const btnPlay = card.querySelector('.btn-play');
            const btnFolder = card.querySelector('.btn-folder');
            const btnDelete = card.querySelector('.btn-delete');

            if (btnPlay) {
                btnPlay.addEventListener('click', () => openFolder(item.filepath, 'open'));
            }
            if (btnFolder) {
                btnFolder.addEventListener('click', () => openFolder(item.filepath, 'select'));
            }
            if (btnDelete) {
                btnDelete.addEventListener('click', () => deleteHistoryItem(item.id));
            }
        }

        return card;
    }

    // Active Downloads Controller API Handlers
    async function pauseDownload(downloadId) {
        try {
            await fetch(`/api/pause/${downloadId}`, { method: 'POST' });
            fetchAllData();
        } catch (err) {
            console.error('Error pausing download:', err);
        }
    }

    async function resumeDownload(downloadId) {
        try {
            await fetch(`/api/resume/${downloadId}`, { method: 'POST' });
            fetchAllData();
        } catch (err) {
            console.error('Error resuming download:', err);
        }
    }

    async function cancelDownload(downloadId) {
        try {
            await fetch(`/api/cancel/${downloadId}`, { method: 'POST' });
            fetchAllData();
            fetchStats();
        } catch (err) {
            console.error('Error canceling download:', err);
        }
    }

    // Open local file or folder via Python API
    async function openFolder(filepath, action) {
        try {
            await fetch('/api/open-folder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filepath, action })
            });
        } catch (err) {
            console.error('Error opening local file:', err);
        }
    }

    // Delete single item from history log file
    async function deleteHistoryItem(id) {
        try {
            const res = await fetch(`/api/history/${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchAllData();
                fetchStats();
            }
        } catch (err) {
            console.error('Error deleting history item:', err);
        }
    }

    // Clear whole history log file
    btnClearHistoryUI.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to clear all download logs?')) return;
        try {
            const res = await fetch('/api/history', { method: 'DELETE' });
            if (res.ok) {
                fetchAllData();
                fetchStats();
            }
        } catch (err) {
            console.error('Error clearing history:', err);
        }
    });

    // Start background status polling
    function startStatusPolling() {
        if (pollingInterval) clearInterval(pollingInterval);
        
        // Poll every 1.5 seconds to refresh progress and stats
        pollingInterval = setInterval(() => {
            fetchAllData();
            fetchStats();
        }, 1500);
    }

    // Intercept clicks on external links to open them in the system's default browser
    document.addEventListener('click', (e) => {
        const extLink = e.target.closest('.external-link');
        if (extLink) {
            e.preventDefault();
            const url = extLink.href;
            fetch('/api/open-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: url })
            }).catch(err => console.error('Error opening external link:', err));
        }
    });

    // Page Initializations
    fetchConfig();
    fetchAllData();
    fetchStats();
    startStatusPolling();
});
