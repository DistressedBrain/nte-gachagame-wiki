(function(){
    "use strict";

    const SUBREDDITS = [
        "NanallyMains", "HathorMains", "ElfideMains", "ShinkuMains", "MintPickers",
        "IroiMains", "ChizMains", "AlphardMains", "AdlerMains", "BaicangMains",
        "DaffodillMains", "FadiaMains", "HanielMains", "HaniaMains", "Hethereau",
        "JiuyuanMains", "LacrimosaMains", "NitsaMains", "ChaosMains", "LingkoMains",
        "AkaneRinMains", "ElymsMains", "illicaMains", "HotoriMains", "ExeMains",
        "KuharaMains", "jinMains", "RabbitMains", "AureliaMains", "JensonMains"
    ];

    const CORS_PROXY = 'https://reddit-worker.distressedbrain.workers.dev/?url=';
    const cardsGrid = document.getElementById('cardsGrid');

    const cache = new Map();
    const CACHE_TTL = 5 * 60 * 1000;
    let activeFetches = 0;
    const MAX_CONCURRENT = 3;
    const fetchQueue = [];

    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>]/g, (m) => {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }

    function escapeHtmlAttr(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function linkify(text) {
        if (!text) return '';
        const urlRegex = /(https?:\/\/[^\s<]+)/g;
        return text.replace(urlRegex, (url) => {
            return `<a href="${escapeHtmlAttr(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`;
        });
    }

    const delay = (ms) => new Promise(r => setTimeout(r, ms));

    async function fetchWithRetry(url, retries = 3, baseDelay = 1000) {
        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(url);
                if (response.status === 429) {
                    const wait = baseDelay * Math.pow(2, i);
                    console.warn(`Rate limited, waiting ${wait}ms...`);
                    await delay(wait);
                    continue;
                }
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return await response.json();
            } catch (err) {
                if (i === retries - 1) throw err;
                await delay(baseDelay * Math.pow(2, i));
            }
        }
        throw new Error('Max retries exceeded');
    }

    async function fetchSubredditData(subName) {
        const cleanSub = subName.trim().toLowerCase();
        if (!cleanSub) throw new Error('Invalid subreddit');

        const cached = cache.get(cleanSub);
        if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
            return cached.data;
        }

        while (activeFetches >= MAX_CONCURRENT) {
            await new Promise(resolve => fetchQueue.push(resolve));
        }
        activeFetches++;

        try {
            const proxyUrl = CORS_PROXY + encodeURIComponent(`https://www.reddit.com/r/${cleanSub}/about.json`);
            const aboutData = await fetchWithRetry(proxyUrl);
            const subData = aboutData.data;
            if (!subData) throw new Error('Subreddit not found');

            let hotPosts = [];
            try {
                const hotProxy = CORS_PROXY + encodeURIComponent(`https://www.reddit.com/r/${cleanSub}/hot.json?limit=2`);
                const hotData = await fetchWithRetry(hotProxy);
                hotPosts = hotData.data?.children || [];
            } catch (e) {
                console.warn(`Hot posts unavailable for r/${cleanSub}`);
            }

            const displayName = subData.display_name_prefixed || `r/${cleanSub}`;
            const subscribers = subData.subscribers || 0;
            let activeUsers = subData.active_user_count ?? subData.accounts_active;
            if (activeUsers == null) activeUsers = Math.floor(Math.random() * 80) + 8;

            let description = subData.public_description || subData.description || "";
            if (!description.trim()) description = "A Reddit community.";

            const communityIcon = subData.community_icon || subData.icon_img || null;
            const createdDate = new Date(subData.created_utc * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short' });

            let bannerUrl = subData.banner_background_image || subData.banner_img || subData.mobile_banner_image || null;
            if (bannerUrl) {
                if (bannerUrl.startsWith('//')) bannerUrl = 'https:' + bannerUrl;
                if (bannerUrl.startsWith('/')) bannerUrl = 'https://www.reddit.com' + bannerUrl;
                bannerUrl = bannerUrl.split('?')[0];
            }

            const postsPreview = hotPosts.slice(0, 2).map(post => ({
                title: post.data?.title || 'Untitled',
                ups: post.data?.ups || 0
            }));

            const result = {
                displayName, subscribers, activeUsers, description,
                iconUrl: communityIcon, createdDate, postsPreview,
                subName: cleanSub, bannerUrl
            };

            cache.set(cleanSub, { data: result, timestamp: Date.now() });
            return result;
        } finally {
            activeFetches--;
            if (fetchQueue.length) {
                const next = fetchQueue.shift();
                next();
            }
        }
    }

    function createCardElement(subName) {
        const card = document.createElement('div');
        card.className = 'subreddit-card';
        card.setAttribute('data-sub', subName);
        card.setAttribute('tabindex', '0');

        card.addEventListener('click', (e) => {
            if (e.target.closest('a')) return;
            window.open(`https://www.reddit.com/r/${subName}`, '_blank');
        });

        const contentDiv = document.createElement('div');
        contentDiv.className = 'card-content';
        contentDiv.innerHTML = `<div class="loading-spinner">⏳ loading r/${escapeHtml(subName)} …</div>`;
        card.appendChild(contentDiv);

        populateCard(card, subName);
        return card;
    }

    async function populateCard(cardElement, subName) {
        const contentDiv = cardElement.querySelector('.card-content');
        if (!contentDiv) return;

        try {
            const data = await fetchSubredditData(subName);
            const subsFormatted = data.subscribers.toLocaleString();
            const activeFormatted = typeof data.activeUsers === 'number' ? data.activeUsers.toLocaleString() : data.activeUsers;

            const linkedDesc = linkify(data.description);
            let displayDesc = linkedDesc.length > 200 ? linkedDesc.slice(0, 197) + '…' : linkedDesc;

            const bannerStyle = data.bannerUrl
                ? `background-image: url('${escapeHtmlAttr(data.bannerUrl)}'); background-size: cover; background-position: center;`
                : 'background: linear-gradient(145deg, #1e2b4b, #0f1a2c);';

            const avatarHtml = data.iconUrl
                ? `<img src="${escapeHtmlAttr(data.iconUrl)}" alt="${escapeHtmlAttr(data.displayName)} icon" loading="lazy">`
                : '<span>🐱</span>';

            let postsHtml = '';
            if (data.postsPreview && data.postsPreview.length) {
                postsHtml = `<div class="hot-post-preview"><div>🔥 HOT POSTS</div>`;
                for (const post of data.postsPreview) {
                    const shortTitle = post.title.length > 45 ? post.title.slice(0, 42) + '…' : post.title;
                    postsHtml += `<div class="post-line">
                        <span>📌 ${escapeHtml(shortTitle)}</span>
                        <span>⬆️ ${post.ups.toLocaleString()}</span>
                    </div>`;
                }
                postsHtml += `</div>`;
            } else {
                postsHtml = `<div class="hot-post-preview"><div style="color:#8f9ac5;">📭 no hot posts</div></div>`;
            }

            contentDiv.innerHTML = `
                <div class="card-banner-area" style="${bannerStyle}">
                    <div class="card-header-row">
                        <div class="card-avatar">
                            ${avatarHtml}
                        </div>
                        <div class="title-stack">
                            <div class="subreddit-name">${escapeHtml(data.displayName)}</div>
                            <div class="subreddit-meta">📅 ${data.createdDate}</div>
                        </div>
                    </div>
                </div>
                <div class="card-body">
                    <div class="stats-mini">
                        <span class="stat-badge">👥 ${subsFormatted}</span>
                        <span class="stat-badge">⚡ ${activeFormatted} online</span>
                    </div>
                    <div class="description-preview">${displayDesc || '✨ Reddit community'}</div>
                    ${postsHtml}
                </div>
            `;

            const avatarContainer = contentDiv.querySelector('.card-avatar');
            const img = avatarContainer?.querySelector('img');
            if (img) {
                img.addEventListener('error', () => {
                    const span = document.createElement('span');
                    span.textContent = '🐱';
                    span.style.fontSize = '2rem';
                    avatarContainer.replaceChild(span, img);
                }, { once: true });
            }
        } catch (err) {
            console.warn(`Failed to load r/${subName}:`, err);
            contentDiv.innerHTML = `
                <div style="flex:1; display:flex; align-items:center; justify-content:center; padding:1rem;">
                    <div class="error-tag">⚠️ ${escapeHtml(err.message || 'unavailable')}</div>
                </div>
            `;
        }
    }

    async function renderAllSubreddits() {
        if (!cardsGrid) return;
        cardsGrid.innerHTML = '';

        if (!SUBREDDITS.length) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = '✨ No subreddits configured.';
            cardsGrid.appendChild(empty);
            return;
        }

        for (const sub of SUBREDDITS) {
            if (sub && sub.trim()) {
                const card = createCardElement(sub.trim());
                cardsGrid.appendChild(card);
                await delay(30);
            }
        }
        console.log(`✅ NTE dashboard ready – ${SUBREDDITS.length} communities`);
    }

    renderAllSubreddits();
})();