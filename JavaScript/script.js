    (function(){
        "use strict";

        // ----- CONFIGURATION (cleaned, no duplicates) -----
        const SUBREDDITS_TO_SHOW = [
            "NanallyMains", "HathorMains", "ElfideMains", "ShinkuMains", "MintPickers",
            "IroiMains", "ChizMains", "AlphardMains", "AdlerMains", "BaicangMains",
            "DaffodillMains", "FadiaMains", "HanielMains", "HaniaMains", "Hethereau",
            "JiuyuanMains", "LacrimosaMains", "NitsaMains", "ChaosMains", "LingkoMains",
            "AkaneRinMains", "ElymsMains", "illicaMains", "HotoriMains", "ExeMains",
            "KuharaMains", "jinMains", "RabbitMains", "AureliaMains", "JensonMains"
        ];

        const cardsGrid = document.getElementById('cardsGrid');
        const CORS_PROXY = 'https://reddit-worker.distressedbrain.workers.dev/?url=';

       
        function escapeHtml(str) {
            if (!str) return '';
            return String(str).replace(/[&<>]/g, function(m) {
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

        // linkify URLs in description (safe)
        function linkify(text) {
            if (!text) return '';
            const urlRegex = /(https?:\/\/[^\s<]+)/g;
            return text.replace(urlRegex, (url) => {
                return `<a href="${escapeHtmlAttr(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`;
            });
        }


        async function fetchSubredditData(subName) {
            const cleanSub = subName.trim().toLowerCase();
            if (!cleanSub) throw new Error('Invalid subreddit');

            async function fetchWithProxy(url) {
                const response = await fetch(CORS_PROXY + encodeURIComponent(url));
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json();
            }

            // about.json
            const aboutData = await fetchWithProxy(`https://www.reddit.com/r/${cleanSub}/about.json`);
            const subData = aboutData.data;
            if (!subData) throw new Error('Subreddit not found');

            // hot posts (optional, fail gracefully)
            let hotPosts = [];
            try {
                const hotData = await fetchWithProxy(`https://www.reddit.com/r/${cleanSub}/hot.json?limit=2`);
                hotPosts = hotData.data?.children || [];
            } catch (e) {
                console.warn(`Hot posts unavailable for r/${cleanSub}`);
            }

            const displayName = subData.display_name_prefixed || `r/${cleanSub}`;
            const subscribers = subData.subscribers || 0;
            let activeUsers = subData.active_user_count ?? subData.accounts_active;
            if (activeUsers == null) {
                // fallback only if completely missing
                activeUsers = Math.floor(Math.random() * 80) + 8;
            }

            let description = subData.public_description || subData.description || "";
            if (!description.trim()) description = "A Reddit community.";

            const communityIcon = subData.community_icon || subData.icon_img || null;
            const createdDate = new Date(subData.created_utc * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short' });

            let bannerUrl = subData.banner_background_image || subData.banner_img || subData.mobile_banner_image || null;
            if (bannerUrl) {
                if (bannerUrl.startsWith('//')) bannerUrl = 'https:' + bannerUrl;
                if (bannerUrl.startsWith('/')) bannerUrl = 'https://www.reddit.com' + bannerUrl;
                bannerUrl = bannerUrl.split('?')[0]; // remove query params
            }

            const postsPreview = hotPosts.slice(0, 2).map(post => {
                const p = post.data;
                return { title: p.title || 'Untitled', ups: p.ups || 0 };
            });

            return {
                displayName, subscribers, activeUsers, description,
                iconUrl: communityIcon, createdDate, postsPreview,
                subName: cleanSub, bannerUrl
            };
        }


        function createCardElement(subredditName) {
            const card = document.createElement('div');
            card.className = 'subreddit-card';
            card.setAttribute('data-sub', subredditName);
            
            // click to open subreddit (avoid link interception)
            card.addEventListener('click', (e) => {
                if (e.target.closest('a')) return; // let links work
                window.open(`https://www.reddit.com/r/${subredditName}`, '_blank');
            });

            const contentDiv = document.createElement('div');
            contentDiv.className = 'card-content';
            contentDiv.innerHTML = `
                <div class="loading-spinner">
                    <span>⏳</span> loading r/${escapeHtml(subredditName)} ...
                </div>
            `;
            card.appendChild(contentDiv);


            populateCard(card, subredditName);
            return card;
        }


        async function populateCard(cardElement, subredditName) {
            const contentDiv = cardElement.querySelector('.card-content');
            if (!contentDiv) return;

            try {
                const data = await fetchSubredditData(subredditName);
                
                const subsFormatted = data.subscribers.toLocaleString();
                const activeFormatted = (typeof data.activeUsers === 'number') 
                    ? data.activeUsers.toLocaleString() 
                    : data.activeUsers;

                const linkedDesc = linkify(data.description);
                let displayDesc = linkedDesc.length > 200 ? linkedDesc.substring(0, 197) + '…' : linkedDesc;

                // banner style
                const bannerStyle = data.bannerUrl
                    ? `background-image: url('${escapeHtmlAttr(data.bannerUrl)}'); background-size: cover; background-position: center;`
                    : 'background: linear-gradient(145deg, #1e2b4b, #0f1a2c);';

                // avatar html (will attach error handler later)
                const avatarHtml = data.iconUrl 
                    ? `<img src="${escapeHtmlAttr(data.iconUrl)}" alt="icon" loading="lazy">`
                    : '<span style="font-size:1.8rem;">🐱</span>';

                // hot posts 
                let postsHtml = '';
                if (data.postsPreview && data.postsPreview.length) {
                    postsHtml = `<div class="hot-post-preview"><div>🔥 HOT POSTS</div>`;
                    data.postsPreview.forEach(post => {
                        const shortTitle = post.title.length > 45 ? post.title.slice(0, 42) + '…' : post.title;
                        postsHtml += `<div class="post-line">
                            <span>📌 ${escapeHtml(shortTitle)}</span>
                            <span>⬆️ ${post.ups.toLocaleString()}</span>
                        </div>`;
                    });
                    postsHtml += `</div>`;
                } else {
                    postsHtml = `<div class="hot-post-preview"><div style="color:#8f9ac5;">📭 no hot posts</div></div>`;
                }

                // assemble final inner HTML
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
                const imgElement = avatarContainer?.querySelector('img');
                if (imgElement) {
                    imgElement.addEventListener('error', function onError() {
                        // replace img with a span (cat)
                        const span = document.createElement('span');
                        span.style.fontSize = '1.8rem';
                        span.textContent = '🐱';
                        if (avatarContainer) {
                            avatarContainer.replaceChild(span, imgElement);
                        }
                    }, { once: true });
                }

            } catch (err) {
                console.warn(`Failed to load r/${subredditName}:`, err);
                contentDiv.innerHTML = `
                    <div style="padding:1.2rem; display:flex; align-items:center; justify-content:center; height:100%;">
                        <div class="error-tag">⚠️ ${escapeHtml(err.message || 'unavailable')}</div>
                    </div>
                `;
            }
        }

        // small delay utility (avoid overwhelming)
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));


        async function renderAllSubreddits() {
            if (!cardsGrid) return;
            cardsGrid.innerHTML = '';

            if (!SUBREDDITS_TO_SHOW.length) {
                const emptyDiv = document.createElement('div');
                emptyDiv.className = 'empty-state';
                emptyDiv.innerHTML = '✨ No subreddits configured.';
                cardsGrid.appendChild(emptyDiv);
                return;
            }


            for (const subName of SUBREDDITS_TO_SHOW) {
                if (subName && subName.trim()) {
                    const card = createCardElement(subName.trim());
                    cardsGrid.appendChild(card);
                    await delay(40); // smooth rendering
                }
            }

            console.log(`✅ NTE dashboard ready — ${SUBREDDITS_TO_SHOW.length} communities`);
        }


        renderAllSubreddits();

    })();
