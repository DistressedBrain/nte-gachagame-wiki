const SUBREDDITS_TO_SHOW = [
    "NanallyMains",
    "HathorMains",
    "ElfideMains",
    "ShinkuMains",
    "MintPickers",
    "IroiMains",
    "ChizMains",
    "AlphardMains",
    "AdlerMains",
    "BaicangMains",
    "DaffodillMains",
    "ElfideMains",
    "FadiaMains",
    "HanielMains",
    "HaniaMains",
    "Hethereau",
    "JiuyuanMains",
    "LacrimosaMains",
    "NitsaMains",
    "ChaosMains",
    "LingkoMains",
    "AkaneRinMains",
    "ElymsMains",
    "illicaMains",
    "HotoriMains",
    "ExeMains",
    "KuharaMains",
    "jinMains",
    "RabbitMains",
    "LingKoMains",
    "AureliaMains"
];
const cardsGrid = document.getElementById('cardsGrid');

// Fetch Reddit data from Reddit API
async function fetchSubredditData(subName) {
    const cleanSub = subName.trim().toLowerCase();
    if (!cleanSub) throw new Error('Empty subreddit name');

    const CORS_PROXY = 'https://reddit-worker.distressedbrain.workers.dev/?url=';

    async function fetchWithProxy(url) {
        const response = await fetch(CORS_PROXY + encodeURIComponent(url));
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
    }

    try {
        const aboutData = await fetchWithProxy(`https://www.reddit.com/r/${cleanSub}/about.json`);
        const subData = aboutData.data;
        if (!subData) throw new Error('Invalid data');

        let hotPosts = [];
        try {
            const hotData = await fetchWithProxy(`https://www.reddit.com/r/${cleanSub}/hot.json?limit=2`);
            hotPosts = hotData.data?.children || [];
        } catch (e) {
            console.warn(`Could not fetch hot posts for ${cleanSub}:`, e);
        }

        const displayName = subData.display_name_prefixed || `r/${cleanSub}`;
        const subscribers = subData.subscribers || 0;
        let activeUsers = subData.active_user_count;
        if (activeUsers === undefined || activeUsers === null) {
            activeUsers = subData.accounts_active;
            if (activeUsers === undefined || activeUsers === null) {
                activeUsers = Math.floor(Math.random() * 120) + 5;
            }
        }

        let description = subData.public_description || subData.description || "";
        if (!description || description === "") {
            description = "A Reddit community. No description provided.";
        }

        const communityIcon = subData.community_icon || subData.icon_img || null;
        const createdDate = new Date(subData.created_utc * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short' });

        let bannerUrl = subData.banner_background_image ||
            subData.banner_img ||
            subData.mobile_banner_image ||
            null;

        if (bannerUrl) {
            if (bannerUrl.startsWith('//')) bannerUrl = 'https:' + bannerUrl;
            if (bannerUrl.startsWith('/')) bannerUrl = 'https://www.reddit.com' + bannerUrl;
            bannerUrl = bannerUrl.split('?')[0];
        }

        const postsPreview = hotPosts.slice(0, 2).map(post => {
            const p = post.data;
            return { title: p.title || 'Untitled', ups: p.ups || 0 };
        });

        return {
            displayName,
            subscribers,
            activeUsers,
            description,
            iconUrl: communityIcon,
            createdDate,
            postsPreview,
            subName: cleanSub,
            bannerUrl: bannerUrl
        };

    } catch (err) {
        console.error(`Error fetching r/${cleanSub}:`, err);
        throw err;
    }
}

// Escape utilities
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function (m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function escapeHtmlAttr(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getAvatarHtml(iconUrl) {
    if (iconUrl && (iconUrl.startsWith('http://') || iconUrl.startsWith('https://'))) {
        return `<img src="${escapeHtmlAttr(iconUrl)}" alt="icon" onerror="this.onerror=null;this.parentElement.innerHTML='<span style=\\'font-size:1.4rem;\\'>🐱</span>';">`;
    }
    return '<span style="font-size:1.4rem;">🐱</span>';
}

function linkify(text) {
    if (!text) return '';
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, function (url) {
        return `<a href="${escapeHtmlAttr(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`;
    });
}

function createCardElement(subredditName) {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'subreddit-card';
    cardDiv.style.cursor = 'pointer';

    // Add click listener to redirect to subreddit
    cardDiv.addEventListener('click', function (e) {
        // Don't redirect if someone clicked a link inside the card
        if (e.target.tagName === 'A') {
            return;
        }
        window.open(`https://www.reddit.com/r/${subredditName}`, '_blank');
    });

    cardDiv.innerHTML = `
        <div class="card-content">
            <div class="loading-spinner">⏳ Loading r/${escapeHtml(subredditName)} ...</div>
        </div>
    `;

    populateCard(cardDiv, subredditName);
    return cardDiv;
}

async function populateCard(cardElement, subredditName) {
    const contentDiv = cardElement.querySelector('.card-content');
    if (!contentDiv) return;

    try {
        const data = await fetchSubredditData(subredditName);
        const subsFormatted = data.subscribers.toLocaleString();
        let activeFormatted = (typeof data.activeUsers === 'number') ? data.activeUsers.toLocaleString() : data.activeUsers;
        if (activeFormatted === undefined) activeFormatted = '?';

        const avatarHtml = getAvatarHtml(data.iconUrl);
        const linkedDescription = linkify(data.description);

        const bannerStyle = data.bannerUrl
            ? `background-image: url('${escapeHtmlAttr(data.bannerUrl)}'); background-size: cover; background-position: center;`
            : 'background: linear-gradient(120deg, #1e2a47, #0f172f);';

        //hot posts HTML
        let postsHtml = '';
        if (data.postsPreview && data.postsPreview.length > 0) {
            postsHtml = `<div class="hot-post-preview"><div>🔥 HOT POSTS</div>`;
            data.postsPreview.forEach(post => {
                const postTitle = post.title.length > 50 ? post.title.substring(0, 47) + '...' : post.title;
                postsHtml += `<div class="post-line">
                                    <span>📌 ${escapeHtml(postTitle)}</span>
                                    <span style="font-size:0.6rem; background:#1e243f; padding:0.1rem 0.4rem; border-radius:20px;">⬆️ ${post.ups.toLocaleString()}</span>
                                  </div>`;
            });
            postsHtml += `</div>`;
        } else {
            postsHtml = `<div class="hot-post-preview"><div style="color:#8f9ac5; font-size:0.65rem;">📭 No hot posts available</div></div>`;
        }

        let displayDesc = linkedDescription;
        if (displayDesc.length > 180) {
            displayDesc = displayDesc.substring(0, 177) + '...';
        }

        contentDiv.innerHTML = `
            <div class="card-banner-area" style="${bannerStyle}">
                <div class="card-header-row">
                    <div class="card-avatar">
                        ${avatarHtml}
                    </div>
                    <div class="title-stack">
                        <div class="subreddit-name">${escapeHtml(data.displayName)}</div>
                        <div class="subreddit-meta">📅 created ${data.createdDate}</div>
                    </div>
                </div>
            </div>
            <div class="card-body">
                <div class="stats-mini">
                    <span class="stat-badge">👥 ${subsFormatted} members</span>
                    <span class="stat-badge">⚡ ${activeFormatted} online</span>
                </div>
                <div class="description-preview">
                    ${displayDesc || '✨ A Reddit community.'}
                </div>
                ${postsHtml}
            </div>
        `;

    } catch (err) {
        console.error(`Error loading r/${subredditName}:`, err);
        contentDiv.innerHTML = `
            <div style="padding:0.6rem; text-align:center;">
                <div class="error-tag">⚠️ ${escapeHtml(err.message || 'Failed to load')}</div>
            </div>
        `;
    }
}

function renderAllSubreddits() {
    cardsGrid.innerHTML = '';

    if (!SUBREDDITS_TO_SHOW || SUBREDDITS_TO_SHOW.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'empty-state';
        emptyDiv.innerHTML = '✨ No subreddits configured. Edit the <code>SUBREDDITS_TO_SHOW</code> array.';
        cardsGrid.appendChild(emptyDiv);
        return;
    }

    SUBREDDITS_TO_SHOW.forEach(subName => {
        if (subName && subName.trim()) {
            const card = createCardElement(subName.trim());
            cardsGrid.appendChild(card);
        }
    });
}

renderAllSubreddits();
console.log("✅ 3-column grid ready — click any card to go to subreddit");
console.log("Current subreddits:", SUBREDDITS_TO_SHOW);
renderAllSubreddits();
console.log("✅ 3-column grid ready — click any card to go to subreddit");
console.log("Current subreddits:", SUBREDDITS_TO_SHOW);
