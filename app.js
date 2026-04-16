const CONFIG = {
    BASE_URL: (window.API_HOST || window.location.origin) + '/api',
    LANG: (localStorage.getItem('app_lang') || 'en').toLowerCase(), 
    KEY: 'dramabox'
};

const REQUEST_OPTIONS = {
    headers: {
        'x-api-key': CONFIG.KEY,
        'Content-Type': 'application/json',
		'Accept-Encoding': 'gzip, deflate, br'
    },
    priority: 'high'
};

const isBot = () => {
    const nav = window.navigator;
    const ua = nav.userAgent.toLowerCase();
    
    if (nav.webdriver) { 
        return true; 
    }

    const botPatterns = ['googlebot', 'bingbot', 'yandexbot', 'baiduspider', 'headlesschrome'];
    if (botPatterns.some(bot => ua.includes(bot))) {
        return true;
    }

    const isMobile = /iphone|ipad|ipod|android/.test(ua);
    
    if (!isMobile && nav.plugins.length === 0) { 
        console.log("Detect: Desktop No Plugins"); return true; 
    }

    const isChrome = !!window.chrome;
    const isSafari = /safari/.test(ua) && !/chrome/.test(ua);
    
    if (!isChrome && !isSafari && !isMobile) {
        if (!/firefox|edge|opera|opr/.test(ua)) {
            return true;
        }
    }

    return false;
};

const setLanguage = (newLang) => {
    localStorage.setItem('app_lang', newLang);
    CONFIG.LANG = newLang.toLowerCase();
};

const fetchWithFallback = async (endpointPattern) => {
    const token = localStorage.getItem('user_token');
    const options = {
        ...REQUEST_OPTIONS,
        headers: {
            ...REQUEST_OPTIONS.headers,
            'Authorization': token ? `Bearer ${token}` : ''
        }
    };

    try {
        let res = await fetch(`${CONFIG.BASE_URL}/${CONFIG.LANG}${endpointPattern}`, options);

        // --- (BELUM LOGIN / LIMIT GUEST HABIS) ---
        if (res.status === 401) {
			const currentParams = window.location.search;
			localStorage.setItem('redirect_after_login', currentParams);
			
			localStorage.removeItem('user_token'); 
			window.location.href = window.location.origin + '/?page=login';
			
			return { error: "Unauthorized" };
		}

        // --- BELUM PREMIUM) ---
        if (res.status === 402) {
            if (typeof showPaymentModal === 'function') showPaymentModal();
            return { error: "Premium Required" };
        }

        let json = await res.json();
        
        // Bahasa (Jika data kosong)
        if (!res.ok || json.error || (json.data && Object.keys(json.data).length === 0)) {
            const availableLangs = ['in', 'en', 'fr', 'ja', 'de', 'es', 'zh', 'pt', 'ar', 'th', 'tl'];
            for (let lang of availableLangs) {
                if (lang === CONFIG.LANG) continue;
                try {
                    const fallbackRes = await fetch(`${CONFIG.BASE_URL}/${lang}${endpointPattern}`, options);
                    if (fallbackRes.ok) {
                        const fallbackJson = await fallbackRes.json();
                        if (fallbackJson && !fallbackJson.error) {
                            setLanguage(lang); 
                            return fallbackJson;
                        }
                    }
                } catch (e) { continue; }
            }
        }
        return json;
    } catch (e) {
        return { error: "Network Error" };
    }
};
const ep = (endpoint) => endpoint;

let currentView = { type: null, bookId: null, chapterId: null };

const GLOBAL_CACHE = {
    homeList: null,  
    dramaDetail: {},  
    videoData: {},
	config: null
};

window.switchLanguage = (lang) => {
    const cleanLang = lang.toLowerCase();
    CONFIG.LANG = cleanLang;
    localStorage.setItem('app_lang', cleanLang);
	
	updateDynamicAtomFeed();
    localStorage.removeItem('app_db');
    
    GLOBAL_CACHE.homeList = null;
    navigateTo('/'); 
};

const api = (endpoint) => {
    return `${CONFIG.BASE_URL}/${CONFIG.LANG}${endpoint}`;
};

const clearAllCache = () => {
    GLOBAL_CACHE.homeList = null;
    GLOBAL_CACHE.dramaDetail = {};
    GLOBAL_CACHE.videoData = {};
};

const prefetchEpisode = async (bookId, chapterId) => {
    const cacheKey = `${bookId}-${chapterId}`;
    if (GLOBAL_CACHE.videoData[cacheKey]) return;

    try {
        const json = await fetchWithFallback(`/video/${bookId}/${chapterId}`);
        GLOBAL_CACHE.videoData[cacheKey] = json.data || json;
    } catch (e) { }
};

const injectSchema = (schema) => {
    let script = document.getElementById('app-schema');
    if (script) script.remove();

    script = document.createElement('script');
    script.id = 'app-schema';
    script.type = 'application/ld+json';
    script.text = JSON.stringify(schema);
    document.head.appendChild(script);
};

const getAllowedDomains = async () => {
    try {
        const res = await fetch(`${CONFIG.BASE_URL}/allowed-domains`, REQUEST_OPTIONS);
        const json = await res.json();
        return json.data || [];
    } catch (e) {
        console.error("Gagal mengambil daftar domain:", e);
        return [];
    }
};

const renderUnauthorizedPage = async (root) => {
    let userIp = "Gagal memuat IP";
    try {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipRes.json();
        userIp = ipData.ip;
    } catch (e) {
        console.error("Gagal mendeteksi IP", e);
    }

    root.innerHTML = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f0f2f5;">
            <div style="text-align: center; padding: 40px; background: white; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); max-width: 400px; width: 90%;">
                <div style="background: #fff1f0; width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
                    <svg style="width: 40px; height: 40px; color: #ff4d4f;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                    </svg>
                </div>
                <h2 style="color: #1a1a1a; margin: 0 0 10px; font-size: 22px; font-weight: 700;">NOT CONNECTED TO SERVER</h2>
                <div style="text-align: left; background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; font-size: 14px; line-height: 1.6; color: #444; border: 1px solid #e8e8e8;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <strong>Your Domain:</strong> <span>${window.location.hostname}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <strong>Your IP:</strong> <span>${userIp}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <strong>Status:</strong> <span style="color: #ff4d4f; font-weight: bold;">DISCONNECTED</span>
                    </div>
                </div>
                <p style="color: #666; font-size: 13px; margin-bottom: 25px;">Akses ditolak atau domain ini tidak memiliki izin untuk menggunakan konten server.</p>
                <div style="display: grid; gap: 10px;">
                    <a href="https://t.me/dramaboss" target="_blank" style="text-decoration: none; padding: 12px; background: #0088cc; color: #1e293b; border-radius: 8px; font-weight: 600;">Hubungi Administrator</a>
                    <button onclick="window.location.reload()" style="cursor: pointer; padding: 12px; background: white; color: #555; border: 1px solid #ddd; border-radius: 8px;">Coba Muat Ulang</button>
                </div>
            </div>
        </div>
    `;
};

const getNavbar = () => {
	const token = localStorage.getItem('user_token');
    const userStr = localStorage.getItem('user_data');
    const user = userStr ? JSON.parse(userStr) : null;
    const isPremium = user && user.isPremium === 1;
	
    let userMenu = '';
    if (token) {
        userMenu = `
            <div class="flex items-center gap-2 ml-4">
                <span class="text-[11px] font-bold ${isPremium ? 'text-yellow-500' : 'text-orange-600'}">
                    ${isPremium ? '👑 PREMIUM' : 'FREE'}
                </span>
                <button onclick="navigateTo('?page=dashboard')" class="w-8 h-8 rounded-full bg-slate-200 border border-slate-200 flex items-center justify-center text-orange-600 hover:border-orange-500 transition-all">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                    </svg>
                </button>
                <button onclick="logout()" class="text-slate-500 hover:text-orange-600 ml-1">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                </button>
            </div>`;
    } else {
        userMenu = `
            <button onclick="navigateTo('?page=login')" class="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-slate-900 text-xs font-bold rounded-xl transition-all shadow-lg shadow-orange-500/20">
                MASUK
            </button>`;
    }

    const languageOptions = (GLOBAL_CACHE.config || []).map(item => {
        const isSelected = CONFIG.LANG === item.lang.toLowerCase() ? 'selected' : '';
        return `<option value="${item.lang.toLowerCase()}" ${isSelected}>${item.label}</option>`;
    }).join('');

    return `
    <nav class="bg-white/80 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-50 p-3 md:p-4">
        <div class="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            
            <a href="javascript:void(0)" onclick="navigateTo('/')" class="text-xl md:text-2xl font-extrabold tracking-tighter text-orange-600">
                DRACIN<span class="text-slate-900">BUZZ</span>
            </a>

            <div class="flex items-center md:order-last">
                <select onchange="switchLanguage(this.value.split('|')[0], this.value.split('|')[1])" 
                        class="bg-white text-slate-900 text-[10px] md:text-xs border border-slate-200 rounded-lg px-2 py-1 outline-none">
                    ${languageOptions}
                </select>
                
                ${userMenu}
            </div>

            <div class="w-full md:flex-1 md:max-w-md relative order-last md:order-none">
                <input type="text" id="searchInput" onkeyup="window.handleSearch(event)" 
                       placeholder="Cari drama..." 
                       class="w-full bg-white/50 text-slate-900 text-sm border border-slate-200 rounded-xl md:rounded-full px-4 py-2.5 md:py-2 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all">
                <button onclick="window.executeSearch()" class="absolute right-3 top-2.5 md:top-2 text-slate-500 hover:text-orange-600">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                </button>
            </div>

        </div>
    </nav>`;
};

function triggerSmartPopup() {
    const NOW = Date.now();
    const THIRTY_MINUTES = 30 * 60 * 1000;
    const lastShow = localStorage.getItem('last_ad_show');

    if (!lastShow || (NOW - lastShow) > THIRTY_MINUTES) {
        setTimeout(() => {
            showPopupAd();
            localStorage.setItem('last_ad_show', NOW);
        }, 20000);
    }
}

const getSkeleton = (type) => {
    const shimmer = "shimmer rounded-2xl bg-slate-200";
    let content = "";
    
    if (type === 'home') {
        content = `
            <div class="max-w-7xl mx-auto p-4 space-y-10">
                <div class="h-8 w-48 ${shimmer}"></div>
                <div class="flex gap-4 overflow-hidden">${[1, 2, 3, 4, 5].map(() => `<div class="min-w-[160px] h-60 ${shimmer}"></div>`).join('')}</div>
                <div class="h-28 w-full ${shimmer}"></div>
                <div class="grid grid-cols-2 md:grid-cols-6 gap-4">${[1, 2, 3, 4, 5, 6].map(() => `<div class="aspect-[3/4] ${shimmer}"></div>`).join('')}</div>
            </div>`;
    } else if (type === 'detail') {
        content = `
            <div class="w-full h-80 bg-slate-200 shimmer mb-6"></div>
            <div class="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div class="lg:col-span-2">
                    <div class="h-6 w-3/4 bg-slate-200 rounded mb-4 shimmer"></div>
                    <div class="h-4 w-full bg-slate-200 rounded mb-2 shimmer"></div>
                    <div class="h-4 w-full bg-slate-200 rounded mb-2 shimmer"></div>
                    <div class="grid grid-cols-4 md:grid-cols-8 gap-3 mt-10">
                        ${[1, 2, 3, 4, 5, 6, 7, 8].map(() => `<div class="h-12 bg-slate-100 rounded-xl shimmer"></div>`).join('')}
                    </div>
                </div>
            </div>`;
    } else {
        content = `
			<div class="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div class="lg:col-span-2 aspect-video bg-slate-200 rounded-2xl shimmer"></div>
                <div class="space-y-4">
                    ${[1, 2, 3, 4].map(() => `<div class="h-20 bg-slate-100 rounded-xl shimmer"></div>`).join('')}
                </div>
            </div>`;
    }

    return `<main class="min-h-screen">${content}</main>`;
};

const initApp = async () => {
	if (isBot()) {
		document.body.innerHTML = `
			<div style="height:100vh; display:flex; align-items:center; justify-content:center; background: #f8fafc; color:#0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin:0;">
				<div style="text-align:center; padding: 2rem; border-radius: 1.5rem; background: rgba(255,255,255,0.9); backdrop-filter: blur(10px); border: 1px solid rgba(0,0,0,0.1); max-width: 400px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
					<div style="background: #ef4444; width: 60px; height: 60px; borderRadius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem;">
						<svg style="width:30px; height:30px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
					</div>
					<h1 style="font-size:1.5rem; font-weight:700; margin-bottom:0.5rem; letter-spacing:-0.025em;">Security Verification</h1>
					<p style="color:#94a3b8; line-height:1.6; font-size:0.95rem;">Maaf, lingkungan browser Anda terdeteksi tidak mendukung atau tidak aman untuk mengakses konten ini.</p>
					<button onclick="window.location.reload()" style="margin-top:1.5rem; background:#f97316; color:#0f172a; border:none; padding: 0.75rem 1.5rem; border-radius: 0.75rem; font-weight:600; cursor:pointer; transition: all 0.2s;">Coba Lagi</button>
				</div>
			</div>`;
		throw new Error("Bot detected, script execution stopped.");
	}
    
    const root = document.getElementById('app');
    if (!root) return false;

    try {
        const [domainsRes, configRes] = await Promise.all([
            fetch(`${CONFIG.BASE_URL}/allowed-domains`, REQUEST_OPTIONS),
            fetch(`${CONFIG.BASE_URL}/config`, REQUEST_OPTIONS)
        ]);
        
        const domainsJson = await domainsRes.json();
        const configJson = await configRes.json();
        
        const allowedDomains = domainsJson.data || [];
        GLOBAL_CACHE.config = configJson.languages || []; 

        const currentDomain = window.location.hostname;
        const isAuthorized = allowedDomains.some(d => d.includes(currentDomain)) || 
                             currentDomain === 'localhost' || 
                             currentDomain === '127.0.0.1';

        if (!isAuthorized) {
            await renderUnauthorizedPage(root);
            return false;
        }

        root.innerHTML = `
            ${getNavbar()}
            <div id="content-area"></div>
        `;
        return true;
    } catch (e) {
        console.error("Inisialisasi gagal:", e);
        return false;
    }
};

(async () => {
    const success = await initApp();
    if (success) {
        router();
    }
})();

const router = async () => {
    const contentArea = document.getElementById('content-area');
    const loader = document.getElementById('loader');
    if (!contentArea) return;

    const params = new URLSearchParams(window.location.search);
    
    const langParam = params.get('lang');
    if (langParam) {
        CONFIG.LANG = langParam.toLowerCase();
        localStorage.setItem('app_lang', CONFIG.LANG);
        
        const langSelect = document.getElementById('lang-select');
        if (langSelect) langSelect.value = CONFIG.LANG;
    } else {
        CONFIG.LANG = (localStorage.getItem('app_lang') || 'in').toLowerCase();
    }

    updateDynamicAtomFeed();

    const bookId = params.get('detail') || params.get('watch')?.split('/')[0];
    const chapterId = params.get('watch')?.split('/')[1];
  
    if (loader) loader.classList.remove('hidden');

    try {
        if (params.has('page')) {
            const p = params.get('page');
            
			if (p === 'dashboard') {
					await renderDashboard();
					return;
				}
				
            if (p === 'login') {
                if (typeof renderLogin === 'function') {
                    renderLogin();
                } else {
                    contentArea.innerHTML = `<div class="p-20 text-center text-slate-500">Fungsi renderLogin tidak ditemukan.</div>`;
                }
                return;
            }

            if (p === 'signup') {
                if (typeof renderSignup === 'function') {
                    renderSignup();
                } else {
                    contentArea.innerHTML = `<div class="p-20 text-center text-slate-500">Fungsi renderSignup tidak ditemukan.</div>`;
                }
                return;
            }

            if (p === 'sitemap' || p === 'rss') {
                const fileName = p === 'sitemap' ? 'sitemap.xml' : 'rss.xml';
                await renderXmlPage(fileName, contentArea);
                return;
            }
        }
        
        if (params.has('detail')) {
            contentArea.innerHTML = getSkeleton('detail');
            await renderDetail(bookId, contentArea);
            currentView = { type: 'detail', bookId };
        } else if (params.has('watch')) {
            if (!document.getElementById('tiktok-container')) {
                contentArea.innerHTML = getSkeleton('watch');
            }
            await renderWatch(bookId, chapterId, contentArea);
        } else if (params.has('search')) {
            const query = params.get('search');
            contentArea.innerHTML = getSkeleton('home');
            renderSearchPage(query, contentArea); 
        } else {
            contentArea.innerHTML = getSkeleton('home');
            await renderHome(contentArea);
            currentView = { type: 'home' };
        }
    } catch (err) {
        console.error("Router Error:", err);
        contentArea.innerHTML = `<div class="p-20 text-center text-slate-500"><p>Gagal memuat konten. Silakan muat ulang.</p></div>`;
    } finally {
        if (loader) loader.classList.add('hidden');
        if (!params.has('watch')) {
            window.scrollTo({ top: 0, behavior: 'instant' });
        }
    }
};

function updateDynamicAtomFeed() {
    let atomLink = document.querySelector('link[type="application/xml"]');
    if (!atomLink) {
        atomLink = document.createElement('link');
        atomLink.rel = 'alternate';
        atomLink.type = 'application/xml';
        document.head.appendChild(atomLink);
    }
    
    const feedUrl = `${CONFIG.BASE_URL}/${CONFIG.LANG}/atom.xml?domain=${window.location.hostname}`;
    atomLink.href = feedUrl;
    atomLink.title = `Atom Feed (${CONFIG.LANG.toUpperCase()})`;
}

window.handleSearch = (e) => {
    if (e.key === 'Enter') window.executeSearch();
};

window.executeSearch = () => {
    const input = document.getElementById('searchInput');
    const query = input ? input.value.trim() : "";
    
    if (query.length >= 2) {
        window.navigateTo(`?search=${encodeURIComponent(query)}`);
    }
};

async function renderSearchPage(query, container) {
    container.innerHTML = getSkeleton('home');

    const availableLangs = [
        { label: 'ID', lang: 'in' },
        { label: 'EN', lang: 'en' },
        { label: 'FR', lang: 'fr' },
        { label: 'JA', lang: 'ja' },
        { label: 'DE', lang: 'de' },
        { label: 'ES', lang: 'es' },
        { label: 'PT', lang: 'pt' },
        { label: 'AR', lang: 'ar' },
        { label: 'TH', lang: 'th' },
        { label: 'TL', lang: 'tl' },
        { label: 'ZHHANS', lang: 'zhhans' },
        { label: 'ZH', lang: 'zh' }
    ];

    const languageOptions = availableLangs.map(l => `
        <option value="${l.id}" ${CONFIG.LANG === l.id ? 'selected' : ''}>
            ${l.name}
        </option>
    `).join('');

    try {
        const response = await fetch(`${CONFIG.BASE_URL}/search?q=${encodeURIComponent(query)}`, {
            headers: {
                'ngrok-skip-browser-warning': 'true',
                'x-api-key': CONFIG.KEY, 
                'Content-Type': 'application/json'
            }
        });

        const json = await response.json();
        const results = json.data || [];

        const schemaData = {
            "@context": "https://schema.org",
            "@type": "ItemList",
            "name": `Search Results for ${query}`,
            "itemListElement": results.map((item, index) => ({
                "@type": "ListItem",
                "position": index + 1,
                "item": {
                    "@type": "Movie",
                    "name": item.bookName,
                    "url": `${window.location.origin}/?detail=${item.bookId}`,
                    "image": item.cover
                }
            }))
        };
        let scriptTag = document.getElementById('search-schema');
        if (!scriptTag) {
            scriptTag = document.createElement('script');
            scriptTag.id = 'search-schema';
            scriptTag.type = 'application/ld+json';
            document.head.appendChild(scriptTag);
        }
        scriptTag.text = JSON.stringify(schemaData);

        if (results.length === 0) {
            container.innerHTML = `
                <div class="py-40 text-center flex flex-col items-center justify-center">
                    <div class="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-6">
                        <i class="fa fa-search text-3xl text-slate-700"></i>
                    </div>
                    <h2 class="text-slate-900 text-xl font-bold">Drama "${query}" tidak ditemukan</h2>
                    <p class="text-slate-500 mt-2 max-w-xs">Coba gunakan kata kunci lain atau periksa ejaan judul drama.</p>
                    <button onclick="navigateTo('/')" class="mt-8 px-8 py-3 bg-orange-500 hover:bg-orange-600 text-slate-900 rounded-full text-sm font-bold transition-all transform active:scale-95">
                        Kembali ke Beranda
                    </button>
                </div>`;
            return;
        }

        container.innerHTML = `
            <div class="max-w-7xl mx-auto p-4 min-h-screen">
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-slate-200 pb-6">
                    <div>
                        <h2 class="text-2xl font-bold text-slate-900">Hasil Pencarian</h2>
                        <p class="text-sm text-slate-500 mt-1">
                            Ditemukan <span class="text-orange-600 font-bold">${results.length}</span> drama untuk <span class="italic">"${query}"</span>
                        </p>
                    </div>
                   
                </div>

                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-8">
                    ${results.map(item => {
                        const itemOrigin = (item.origin || CONFIG.LANG).toLowerCase();
                        
                        return `
                        <div class="cursor-pointer group" onclick="navigateToDetail('${item.bookId}', '${itemOrigin}')">
                            <div class="relative aspect-[3/4] overflow-hidden rounded-2xl bg-white mb-3 shadow-2xl">
                                <img src="${item.cover}" 
                                     alt="${item.bookName}"
                                     loading="lazy"
                                     class="w-full h-full object-cover group-hover:scale-110 transition duration-500"
                                     onerror="this.src='https://placehold.co/300x400/PLACEHOLDER_WHITE'">
                                
                                <div class="absolute top-3 right-3 bg-orange-500 px-2.5 py-1 rounded-md text-[9px] text-slate-900 font-black shadow-xl uppercase tracking-tighter z-10 border border-white/20 backdrop-blur-sm">
                                    ${itemOrigin}
                                </div>

                                <div class="absolute inset-0 bg-gradient-to-t from-white/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                                    <div class="text-[10px] text-slate-900 font-bold flex items-center gap-1">
                                        <i class="fa fa-star text-yellow-500"></i> ${item.score || '8.5'}
                                    </div>
                                </div>
                            </div>
                            
                            <p class="text-xs font-bold text-slate-800 line-clamp-2 group-hover:text-orange-600 transition-colors leading-snug px-1">
                                ${item.bookName}
                            </p>
                        </div>`;
                    }).join('')}
                </div>

                <div class="mt-20 py-10 text-center border-t border-slate-200">
                    <p class="text-[10px] text-slate-500 uppercase tracking-[0.2em]">End of Results</p>
                </div>
            </div>
        `;

        window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (err) {
        console.error("Search Page Error:", err);
        container.innerHTML = `<div class="py-40 text-center text-orange-600 font-bold">Gagal Memuat Hasil Pencarian</div>`;
    }
}


window.navigateToDetail = (bookId, origin) => {
    const targetLang = origin ? origin.toLowerCase() : CONFIG.LANG;
    localStorage.setItem('app_lang', targetLang);
    
    CONFIG.LANG = targetLang;

    const targetUrl = `?detail=${bookId}&lang=${targetLang}`;
    window.history.pushState({}, '', targetUrl);
    
    if (typeof router === 'function') {
        router();
    } else {
        window.location.reload();
    }
};

async function renderHome(container) {
    const json = await fetchWithFallback('/list');
    const data = json.data || {};
    GLOBAL_CACHE.homeList = data;

    container.innerHTML = `
		<div class="max-w-7xl mx-auto p-4 fade-in space-y-12 pb-20">
            
            <!-- Section: Trending -->
            <section>
                <h2 class="text-xl font-extrabold mb-6 flex items-center gap-3">
                    <span class="w-1.5 h-7 bg-orange-500 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)]"></span> 
                    Sedang <span class="text-orange-600">Trending</span>
                </h2>
                <div class="flex overflow-x-auto gap-5 hide-scrollbar pb-4">
                    ${(data.trending || []).map(item => `
                        <div class="min-w-[170px] group cursor-pointer" onclick="navigateTo('?detail=${item.bookId}')">
                            <div class="relative overflow-hidden rounded-2xl border border-slate-200 shadow-xl transition-all group-hover:border-orange-500/50 group-hover:scale-[1.02]">
                                <img src="${item.cover}" loading="lazy" class="w-full h-64 object-cover">
                                <div class="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                                    <div class="w-full py-2 bg-orange-500 rounded-xl text-[10px] font-bold text-center text-white">DETAIL</div>
                                </div>
                            </div>
                            <h3 class="mt-3 text-sm font-bold truncate group-hover:text-orange-600 transition-colors">${item.bookName}</h3>
                        </div>
                    `).join('')}
                </div>
            </section>

            <!-- Section: Terbaru -->
            <section>
                <h2 class="text-xl font-extrabold mb-6 flex items-center gap-3">
                    <span class="
					w-1.5 h-7 bg-amber-500 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.5)]"></span>Rilis <span class="text-amber-400">Terbaru</span>
                </h2>
                <div class="flex overflow-x-auto gap-6 hide-scrollbar pb-4">
                    ${(data.terbaru || []).map((item, index) => `
                        <div class="min-w-[280px] bg-white/40 rounded-3xl p-4 border border-slate-200 flex gap-4 hover:border-amber-500/30 transition-all cursor-pointer group" onclick="navigateTo('?detail=${item.bookId}')">
                            <div class="relative flex-shrink-0">
                                <img src="${item.cover}" class="w-20 h-28 object-cover rounded-xl shadow-lg">
                                <span class="absolute -top-2 -left-2 w-8 h-8 bg-amber-500 text-slate-950 flex items-center justify-center rounded-full font-black text-sm shadow-lg shadow-amber-500/20">
                                    ${index + 1}
                                </span>
                            </div>
                            <div class="flex flex-col justify-center overflow-hidden">
                                <h3 class="font-bold text-sm line-clamp-2 group-hover:text-amber-400 transition-colors">${item.bookName}</h3>
                                <p class="text-[10px] text-slate-500 mt-2 uppercase tracking-tighter line-clamp-2 leading-relaxed">${item.introduction || ''}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </section>

            <!-- Banner Iklan -->
			<div id="container-ads-728x90" class="hidden ad-banner w-full h-24 rounded-xl mb-8 flex-col items-center justify-center border border-dashed border-slate-200 bg-slate-100/50">
				<span class="text-[10px] text-slate-500 uppercase tracking-widest"></span>
				<div id="ads-728x90"></div>
			</div>

            <!-- Section: Populer -->
            <section>
                <h2 class="text-xl font-extrabold mb-6 flex items-center gap-3">
                    <span class="w-1.5 h-7 bg-orange-500 rounded-full shadow-[0_0_15px_rgba(249,115,22,0.5)]"></span> 
                    Paling <span class="text-orange-500">Populer</span>
                </h2>
                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
                    ${(data.popular || []).map(item => `
                        <div class="cursor-pointer group" onclick="navigateTo('?detail=${item.bookId}')">
                            <div class="aspect-[3/4] overflow-hidden rounded-2xl border border-slate-200 mb-3 relative">
                                <img src="${item.cover}" loading="lazy" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500">
                                <div class="absolute top-2 right-2 px-2 py-0.5 bg-orange-500 rounded-md text-[9px] text-slate-900 font-black shadow-lg">HD</div>
                            </div>
                            <h3 class="text-xs font-bold line-clamp-2 leading-snug group-hover:text-orange-500">${item.bookName}</h3>
                        </div>
                    `).join('')}
                </div>
            </section>
        </div>
    `;
	
	if (typeof refreshAds === 'function') refreshAds('home');
    triggerSmartPopup();
	
	const homeSchema = {
		"@name": "DRACINBUZZ",
		"@context": "https://schema.org",
		"@type": "CollectionPage",
		"name": "DRACINBUZZ - Streaming Dracin Online",
		"description": "Watch new drama, trends,, and popular with subtitle English, Indonesia & more in DRACINBUZZ.",
		"publisher": {
			"@type": "Organization",
			"name": "DRACINBUZZ"
		}
	};
	injectSchema(homeSchema);
}

async function renderDetail(bookId, container) {
    container.innerHTML = getSkeleton('detail');

    try {
        const dramaPromise = GLOBAL_CACHE.dramaDetail[bookId]
            ? Promise.resolve({ data: GLOBAL_CACHE.dramaDetail[bookId] })
            : fetchWithFallback(`/view/${bookId}`);

        const listPromise = GLOBAL_CACHE.homeList
            ? Promise.resolve({ data: GLOBAL_CACHE.homeList })
            : fetchWithFallback('/list');

        const episodesPromise = fetchWithFallback(`/episodes/${bookId}`);

        const [dramaRes, listRes, episodesRes] = await Promise.all([dramaPromise, listPromise, episodesPromise]);

        const drama = dramaRes.data || dramaRes;
        const listData = listRes.data || listRes;
        const episodes = episodesRes.data || episodesRes;

		document.title = `Watch Online ${drama.bookName} | DracinBuzz`;
		let metaDesc = document.querySelector('meta[name="description"]');
		if (!metaDesc) {
			metaDesc = document.createElement('meta');
			metaDesc.name = 'description';
			document.head.appendChild(metaDesc);
		}
		metaDesc.setAttribute('content', `Nonton drama ${drama.bookName}. ${drama.introduction ? drama.introduction.substring(0, 150) : ''}...`);

		const ogTitle = document.querySelector('meta[property="og:title"]');
		if (ogTitle) ogTitle.setAttribute('content', drama.bookName);

		const ogImg = document.querySelector('meta[property="og:image"]');
		if (ogImg) ogImg.setAttribute('content', drama.cover);
		
        if (!GLOBAL_CACHE.dramaDetail[bookId]) GLOBAL_CACHE.dramaDetail[bookId] = drama;
        if (!GLOBAL_CACHE.homeList) GLOBAL_CACHE.homeList = listData;

        const flattenedList = [
            ...(listData.trending || []),
            ...(listData.popular || []),
            ...(listData.terbaru || [])
        ];

        const recommendations = Array.from(new Map(flattenedList.map(item => [item.bookId, item])).values())
            .filter(item => item.bookId !== bookId)
            .slice(0, 5);
	
	let html = `
            <div class="relative w-full h-80">
                <img src="${drama.cover}" class="w-full h-full object-cover blur-md opacity-30">
                <div class="absolute inset-0 flex items-end p-6 bg-gradient-to-t from-white">
                    <div class="flex gap-4 items-end max-w-7xl mx-auto w-full">
                        <img src="${drama.cover}" class="w-32 md:w-44 rounded-xl shadow-2xl border-2 border-white/10">
                        <div class="flex-1">
                            <h1 class="text-2xl md:text-4xl font-black text-slate-900">${drama.bookName}</h1>
                            <div class="flex gap-3 mt-2">
                                <span class="text-orange-500 text-sm font-bold"><i class="fa fa-star"></i> ${drama.score || '8.5'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="p-6 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div class="lg:col-span-2">
                    <div class="flex flex-wrap gap-2 mb-6">
                        ${drama.tags && Array.isArray(drama.tags) ? drama.tags.map(t => 
                            `<span class="bg-slate-200 px-4 py-1.5 rounded-full text-xs font-medium text-slate-600 border border-slate-200"># ${t}</span>`
                        ).join('') : ''}
                    </div>

                    <h3 class="text-xl font-bold mb-3">Sinopsis</h3>
                    <p class="text-slate-500 leading-relaxed mb-8 text-justify">${drama.introduction || 'Tidak ada sinopsis tersedia.'}</p>
                    
                    <div id="container-ads-728x90" class="ad-banner w-full h-24 rounded-xl mb-8 flex-col items-center justify-center border border-dashed border-slate-200 bg-slate-100/50" style="display: none;">
						<span class="text-[10px] text-slate-500 uppercase tracking-widest"></span>
						<div id="ads-728x90"></div>
					</div>

                    <h3 class="text-xl font-bold mb-4 flex justify-between items-center">
                        Daftar Episode 
                        <span class="text-sm font-normal text-slate-500">${episodes ? episodes.length : 0} Episode</span>
                    </h3>

                    <div class="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                        ${episodes && Array.isArray(episodes) ? episodes.map((ep, index) => {
                            const displayNum = ep.chapterNum || ep.chapterNo || (index + 1);
                            const id = ep.chapterId;
                            return `
                                <button onclick="navigateTo('?watch=${bookId}/${id}')" 
                                    class="bg-slate-200 hover:bg-orange-500 hover:text-slate-900 hover:border-orange-500 hover:scale-105 transform transition-all py-3 rounded-xl text-sm font-bold border border-slate-200 shadow-lg">
                                    ${displayNum}
                                </button>
                            `;
                        }).join('') : '<p class="col-span-full text-slate-500">Episode tidak tersedia di server.</p>'}
                    </div>
                </div>
                
                <div class="space-y-6">
                    <div id="container-ads-320x250" class="hidden ad-banner w-full h-64 rounded-2xl flex-col items-center justify-center border border-slate-200 bg-slate-200/50">
							<div id="ads-320x250">
								<span class="text-slate-500 text-[10px]"></span>
							</div>
					</div>

                    <h3 class="text-xl font-bold">Mungkin Anda Suka</h3>
                    <div id="recommendation-list" class="space-y-4">
                        ${recommendations.map(item => `
                            <div class="flex gap-3 group cursor-pointer" onclick="navigateTo('?detail=${item.bookId}')">
                                <div class="w-20 h-28 bg-slate-200 rounded-lg overflow-hidden flex-shrink-0 border border-slate-200">
                                    <img src="${item.cover}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300">
                                </div>
                                <div class="flex flex-col justify-center overflow-hidden">
                                    <h4 class="text-sm font-bold text-slate-800 group-hover:text-orange-600 line-clamp-2 transition-colors">${item.bookName}</h4>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
		if (typeof refreshAds === 'function') refreshAds('detail');
		triggerSmartPopup();

		
		const detailSchema = {
			"@name": drama.bookName,
			"@context": "https://schema.org",
			"@type": "Movie",
			"name": drama.bookName,
			"description": drama.introduction,
			"image": drama.cover,
			"aggregateRating": {
				"@type": "AggregateRating",
				"ratingValue": drama.score || "8.5",
				"bestRating": "10",
				"worstRating": "1",
				"ratingCount": drama.viewCount || "100"
			}
		};
		injectSchema(detailSchema);

    } catch (err) {
        console.error("Detail Error:", err);
        container.innerHTML = `<div class="p-20 text-center text-slate-500">Gagal memuat detail drama.</div>`;
    }
}

async function renderWatch(bookId, chapterId, container) {
    const isMobile = window.innerWidth < 768;
    const cacheKey = `${bookId}-${chapterId}`;

    try {
        const [videoResult, dramaResult] = await Promise.all([
            fetchWithFallback(`/video/${bookId}/${chapterId}`),
            GLOBAL_CACHE.dramaDetail[bookId] 
                ? Promise.resolve({ data: GLOBAL_CACHE.dramaDetail[bookId] }) 
                : fetchWithFallback(`/view/${bookId}`)
        ]);

        const videoData = videoResult.data || videoResult;
        let dramaData = dramaResult.data || dramaResult;

        if (!dramaData.chapterList || dramaData.chapterList.length === 0) {
            const episodesRes = await fetchWithFallback(`/episodes/${bookId}`);
            dramaData.chapterList = episodesRes.data || episodesRes;
        }

        GLOBAL_CACHE.videoData[cacheKey] = videoData;
        GLOBAL_CACHE.dramaDetail[bookId] = dramaData;

        executeRender(videoData, dramaData);

    } catch (err) {
        container.innerHTML = `<div class="p-20 text-center text-slate-500"></div>`;
    }

    function executeRender(vData, dData) {
        let videoUrl = '';

        if (vData.videoPathList && vData.videoPathList.length > 0) {
            const filteredLinks = vData.videoPathList.filter(v => 
                v.videoPath.includes('hwztakavideo.dramaboxdb.com')
            );

            if (filteredLinks.length > 0) {
                const preferred = filteredLinks.find(v => v.quality === 720) || filteredLinks[0];
                videoUrl = preferred.videoPath;
            } else {
                videoUrl = vData.videoPathList[0].videoPath;
            }
        } else {
            videoUrl = vData.videoPath || '';
        }

        if (!videoUrl) {
            container.innerHTML = `<div class="p-20 text-center text-slate-500"></div>`;
            return;
        }

		if (isMobile) {
			const tiktokContainer = document.getElementById('tiktok-container');
			
			if (tiktokContainer) {
				renderTiktokStyle(videoUrl, dData, chapterId, container, vData);
			} else {
				renderTiktokStyle(videoUrl, dData, chapterId, container, vData);
			}
		} else {
			renderDesktopStyle(videoUrl, dData, chapterId, container, bookId, vData);
		}
		

		if (typeof refreshAds === 'function') {
            refreshAds('watch'); 
        }
		
        triggerSmartPopup();
		
		const watchSchema = {
			"@name": `${dData.bookName} - ${vData.chapterName || 'Episode'}`,
			"@context": "https://schema.org",
			"@type": "VideoObject",
			"name": `${dData.bookName} - ${vData.chapterName || 'Episode'}`,
			"description": dData.introduction,
			"thumbnailUrl": dData.cover,
			"uploadDate": "2024-01-01T08:00:00+07:00", 
			"contentUrl": videoUrl, 
			"embedUrl": window.location.href,
			"interactionStatistic": {
				"@type": "InteractionCounter",
				"interactionType": { "@type": "WatchAction" },
				"userInteractionCount": dData.viewCount
			}
		};
		injectSchema(watchSchema);
    }
}

const getChapterId = (obj) => {
    if (!obj) return null;
    return String(obj.chapterId || obj.id || obj.chapter_id || obj.chapterid);
};

function renderTiktokStyle(videoUrl, drama, chapterId, container, videoData) {
    window.history.pushState({ page: 'tiktok_view' }, '');
    window.onpopstate = function(event) {
        window.location.href = '/'; 
    };

    const getRealId = (ch) => ch ? String(ch.chapterId || ch.id || ch.chapter_id || "") : "";
    
    const chapterList = drama.chapterList || [];
    
    const currentIndex = chapterList.findIndex(ch => {
        const cid = getRealId(ch);
        return cid === String(chapterId) && cid !== "";
    });

    const prevEpisode = currentIndex > 0 ? chapterList[currentIndex - 1] : null; 
    const nextEpisode = currentIndex < chapterList.length - 1 ? chapterList[currentIndex + 1] : null;

    if (nextEpisode) prefetchEpisode(drama.bookId, getRealId(nextEpisode));
    if (prevEpisode) prefetchEpisode(drama.bookId, getRealId(prevEpisode));

    container.innerHTML = `
        <div id="tiktok-container" class="fixed inset-0 bg-black z-[60] overflow-y-scroll hide-scrollbar" style="scroll-snap-type: y mandatory; height: 100vh;">
            
            <div class="fixed top-0 left-0 right-0 z-[70] flex justify-center p-2 pointer-events-none">
                <div id="container-ads-tiktok-top" class="hidden pointer-events-auto">
                    <div id="ads-tiktok-top"></div>
                </div>
            </div>
            
            ${prevEpisode ? `
            <div class="snap-item w-full h-full flex flex-col items-center justify-center text-slate-900 p-10 text-center" 
                 data-id="${getRealId(prevEpisode)}" style="scroll-snap-align: start; height: 100vh;">
                 <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500 mb-4"></div>
                 <p class="text-xs text-slate-500">Memuat Episode ${currentIndex}</p>
            </div>` : ''}

            <div class="snap-item relative w-full h-full flex items-center justify-center bg-black" 
                 data-id="${chapterId}" style="scroll-snap-align: start; height: 100vh;">
                
                <video id="main-player" 
                       class="w-full h-full object-contain cursor-pointer" 
                       src="${videoUrl}" 
                       autoplay loop playsinline
                       onclick="togglePlayPause()"></video>

                <div id="play-icon-overlay" class="absolute inset-0 flex items-center justify-center pointer-events-none hidden">
                    <div class="bg-black/40 w-20 h-20 rounded-full flex items-center justify-center backdrop-blur-sm">
                        <i class="fa fa-play text-white text-4xl ml-2"></i>
                    </div>
                </div>

                <div class="absolute bottom-0 left-0 right-0 z-40 p-4 bg-gradient-to-t from-black/40 via-black/40 to-transparent">
                    <div class="flex items-center gap-3 mb-4 group">
                        <span id="curr-time" class="text-[10px] text-white font-mono">00:00</span>
                        <div class="relative flex-1 h-1 bg-white/20 rounded-full cursor-pointer" id="progress-container" onclick="seekVideo(event)">
                            <div id="progress-bar" class="absolute top-0 left-0 h-full bg-orange-500 rounded-full w-0"></div>
                        </div>
                        <span id="dur-time" class="text-[10px] text-white font-mono">00:00</span>
                    </div>

                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-6">
                            <button onclick="togglePlayPause()" class="text-slate-900 hover:text-orange-300">
                                <i id="play-btn-icon" class="fa fa-pause text-xl"></i>
                            </button>
                            <button onclick="changePlaybackSpeed()" class="text-slate-900 font-bold text-xs bg-white/10 px-2 py-1 rounded border border-white/20">
                                <span id="speed-text">1.0x</span>
                            </button>
                            <button onclick="toggleMute(event)" class="text-slate-900 hover:text-orange-300">
                                <i id="mute-icon" class="fa fa-volume-up text-xl"></i>
                            </button>
                        </div>
                        <button onclick="toggleFullscreen()" class="text-slate-900 hover:text-orange-300">
                            <i class="fa fa-expand text-xl"></i>
                        </button>
                    </div>
                </div>

                <div class="absolute right-4 bottom-32 flex flex-col gap-6 text-center z-30">
                    <div onclick="shareContent()" class="flex flex-col items-center cursor-pointer group">
                        <div class="bg-slate-200/60 w-12 h-12 rounded-full flex items-center justify-center border border-white/10 active:scale-90 transition-transform">
                            <i class="fa fa-share text-white text-xl"></i>
                        </div>
                        <span class="text-[10px] text-slate-900 mt-1 font-medium">Share</span>
                    </div>
                </div>

                <div class="absolute left-4 bottom-24 right-20 z-30 text-slate-900 pointer-events-none">
                    <h4 class="font-bold text-sm mb-1 text-shadow-lg">@Official_Dramaboss</h4>
                    <p class="text-xs opacity-90 leading-snug line-clamp-2 text-shadow-md">
                        ${drama.bookName} - ${videoData.chapterName || 'Episode ' + (currentIndex + 1)}
                    </p>
                </div>
            </div>

            ${nextEpisode ? `
            <div class="snap-item w-full h-full flex flex-col items-center justify-center text-slate-900 p-10 text-center" 
                 data-id="${getRealId(nextEpisode)}" style="scroll-snap-align: start; height: 100vh;">
                 <div class="animate-bounce">
                    <i class="fa fa-chevron-up text-orange-600 text-3xl"></i>
                 </div>
                 <p class="text-sm font-bold text-slate-500 mt-4">Lepas untuk Episode ${currentIndex + 2}</p>
            </div>` : ''}
        </div>
    `;

    setTimeout(() => {
        const currentVideoEl = container.querySelector(`.snap-item[data-id="${chapterId}"]`);
        if (currentVideoEl) {
            currentVideoEl.scrollIntoView({ behavior: 'auto', block: 'start' });
            initScrollObserver(drama.bookId, chapterId);
            setupVideoEventListeners();
        }
    }, 60);

    if (typeof refreshAds === 'function') refreshAds('tiktok_view');
}

window.shareContent = async () => {
    const shareData = {
        title: document.title,
        text: `Enjoy Watch Drama on DRAMABOSS!`,
        url: window.location.href
    };

    try {
        if (navigator.share) {
            await navigator.share(shareData);
        } else {
            await navigator.clipboard.writeText(shareData.url);
        }
    } catch (err) {
        console.error('Gagal membagikan:', err);
    }
};

function setupVideoEventListeners() {
    const video = document.getElementById('main-player');
    const progressBar = document.getElementById('progress-bar');
    const currTimeText = document.getElementById('curr-time');
    const durTimeText = document.getElementById('dur-time');

    if (!video) return;

    video.ontimeupdate = () => {
        const percent = (video.currentTime / video.duration) * 100;
        if (progressBar) progressBar.style.width = `${percent}%`;
        
        if (currTimeText) currTimeText.innerText = formatTime(video.currentTime);
        if (durTimeText && !isNaN(video.duration)) durTimeText.innerText = formatTime(video.duration);
    };
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

window.seekVideo = (event) => {
    const video = document.getElementById('main-player');
    const container = document.getElementById('progress-container');
    if (!video || !container) return;

    const rect = container.getBoundingClientRect();
    const pos = (event.clientX - rect.left) / rect.width;
    video.currentTime = pos * video.duration;
};

window.changePlaybackSpeed = () => {
    const video = document.getElementById('main-player');
    const speedText = document.getElementById('speed-text');
    if (!video) return;

    const speeds = [1.0, 1.5, 2.0];
    let currentIndex = speeds.indexOf(video.playbackRate);
    let nextIndex = (currentIndex + 1) % speeds.length;
    
    video.playbackRate = speeds[nextIndex];
    if (speedText) speedText.innerText = speeds[nextIndex].toFixed(1) + 'x';
};

window.toggleFullscreen = () => {
    const video = document.getElementById('main-player');
    if (!video) return;

    if (!document.fullscreenElement) {
        if (video.requestFullscreen) video.requestFullscreen();
        else if (video.webkitRequestFullscreen) video.webkitRequestFullscreen();
        else if (video.msRequestFullscreen) video.msRequestFullscreen();
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
    }
};

const originalTogglePlayPause = window.togglePlayPause;
window.togglePlayPause = () => {
    const video = document.getElementById('main-player');
    const playBtnIcon = document.getElementById('play-btn-icon');
    const overlay = document.getElementById('play-icon-overlay');

    if (!video) return;

    if (video.paused) {
        video.play();
        if (playBtnIcon) playBtnIcon.classList.replace('fa-play', 'fa-pause');
        if (overlay) overlay.classList.add('hidden');
    } else {
        video.pause();
        if (playBtnIcon) playBtnIcon.classList.replace('fa-pause', 'fa-play');
        if (overlay) overlay.classList.remove('hidden');
    }
};

function initScrollObserver(bookId, currentId) {
    const container = document.getElementById('tiktok-container');
    
    if (!container) {
        return;
    }

    const items = container.querySelectorAll('.snap-item');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
                const rawId = entry.target.getAttribute('data-id');
                const isValidId = rawId && 
                                  rawId !== "undefined" && 
                                  rawId !== "null" && 
                                  rawId.length > 5;

                if (isValidId && String(rawId) !== String(currentId)) {
                    console.log(`Scroll Berhasil: Berpindah ke ID Asli ${rawId}`);
                    
                    observer.disconnect();
                    
                    const newUrl = `/watch/${bookId}/${rawId}`;
                    window.history.replaceState({ page: 'tiktok_view' }, '', newUrl);
                    
                    const contentArea = document.getElementById('content-area');
                    if (contentArea) {
                        renderWatch(bookId, rawId, contentArea);
                    }
                }
            }
        });
    }, { 
        threshold: [0.1, 0.6], 
        root: container 
    });

    items.forEach(item => {
        const id = item.getAttribute('data-id');
        if (id && id.length > 5) {
            observer.observe(item);
        }
    });
}

window.togglePlayPause = () => {
    const video = document.getElementById('main-player');
    const playIcon = document.getElementById('play-icon');
    if (!video) return;

    if (video.paused) {
        video.play();
        playIcon.classList.add('hidden');
    } else {
        video.pause();
        playIcon.classList.remove('hidden');
    }
};

window.toggleMute = (event) => {
    if(event) event.stopPropagation();
    const video = document.getElementById('main-player');
    const muteIcon = document.getElementById('mute-icon');
    if (!video) return;

    video.muted = !video.muted;
    if (video.muted) {
        muteIcon.classList.replace('fa-volume-up', 'fa-volume-mute');
    } else {
        muteIcon.classList.replace('fa-volume-mute', 'fa-volume-up');
    }
};

let currentBlobUrl = null;

async function renderDesktopStyle(videoUrl, drama, chapterId, container, bookId, videoData) {
    const currentIndex = drama.chapterList?.findIndex(ch => (ch.id || ch.chapterId) == chapterId) || 0;

	if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
    }
	
    container.innerHTML = `
        <div class="p-6 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 fade-in">
            <div class="lg:col-span-2 text-slate-900">
                <div class="aspect-video bg-black rounded-2xl overflow-hidden relative shadow-2xl">
                    <video id="main-player" 
                           controls 
                           autoplay 
                           controlsList="nodownload noremoteplayback" 
                           oncontextmenu="return false;"
                           disablePictureInPicture
                           class="w-full h-full bg-black"></video>
                </div>
                
                <h1 class="text-2xl font-bold mt-4">
                    ${drama.bookName} - ${videoData.chapterName || 'Episode ' + (currentIndex + 1)}
                </h1>
                
                <div class="flex justify-between items-center mt-4 border-b border-slate-200 pb-4">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-orange-500/20">
                            <i class="fa fa-play text-white text-xs"></i>
                        </div>
                        <div>
                            <p class="font-bold">Official Dramaboss</p>
                            <p class="text-xs text-slate-500">1.2M Subscribers</p>
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <button class="bg-slate-200 hover:bg-slate-300 px-4 py-2 rounded-full text-sm transition active:scale-95">
                            <i class="fa fa-thumbs-up mr-1"></i> Like
                        </button>
                        <button class="bg-orange-500 hover:bg-orange-600 px-6 py-2 rounded-full text-sm font-bold transition active:scale-95 shadow-lg shadow-orange-500/20">
                            Subscribe
                        </button>
                    </div>
                </div>
				
				<!-- Banner Iklan -->
				<div id="container-ads-728x90" class="hidden mt-6 w-full h-24 bg-gradient-to-r from-white to-slate-800 rounded-xl border border-slate-200 items-center justify-between px-6 group cursor-pointer hover:border-orange-500/50 transition-all shadow-lg">
					<div id="ads-728x90"></div>
				</div>

                <div class="mt-4 p-4 bg-slate-200/50 rounded-xl text-sm text-slate-600 border border-slate-200">
                    <p class="font-bold text-slate-900 mb-1">Sinopsis:</p>
                    <p class="leading-relaxed opacity-80">${drama.introduction || 'Tidak ada deskripsi tersedia.'}</p>
                </div>
            </div>
            
            <div class="space-y-4">
                <div id="container-320x250" onclick="showPopupAd()" class="hidden ad-banner h-32 rounded-xl border border-dashed border-slate-200 flex-col items-center justify-center text-slate-500 text-xs uppercase font-bold tracking-widest cursor-pointer hover:bg-slate-100/50 transition-colors">
					<span id="ads-320x250"></span>
				</div>
                
                <h3 class="font-bold text-slate-900 flex items-center gap-2">
                    <span class="w-1 h-5 bg-orange-500 rounded"></span> Episode Lainnya
                </h3>
                
                <div class="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                    ${drama.chapterList && Array.isArray(drama.chapterList) ? drama.chapterList.map((ch, idx) => {
                        const epId = ch.id || ch.chapterId; 
                        const epNum = idx + 1;
                        const isActive = epId == chapterId ? 'border-orange-500 bg-orange-500/20 shadow-[0_0_15px_rgba(99,102,241,0.1)]' : 'border-slate-200 bg-slate-200/40 hover:bg-slate-200';

                        return `
                            <div onclick="navigateTo('?watch=${bookId}/${epId}')" class="flex gap-3 cursor-pointer group p-2 rounded-xl border transition-all duration-300 ${isActive}">
                                <div class="flex flex-col justify-center min-w-0">
                                    <p class="text-sm font-bold text-slate-800 line-clamp-1 group-hover:text-orange-600 transition-colors">
                                        EP ${epNum} - ${ch.name || 'Episode ' + epNum}
                                    </p>
                                </div>
                            </div>
                        `;
                    }).join('') : ''}
                </div>
            </div>
        </div>
    `;
	
	const player = document.getElementById('main-player');
    
    if (player) {
        player.src = videoUrl;
        player.addEventListener('loadeddata', () => {
            player.removeAttribute('src'); 
        });

        player.onerror = () => {
            player.poster = "https://via.placeholder.com/800x450?text=Video+Tidak+Tersedia";
        };
    }
}
	
async function renderXmlPage(fileName, container) {
    const targetUrl = `${CONFIG.BASE_URL}/${CONFIG.LANG}/${fileName}`;
    
    try {
        const response = await fetch(targetUrl, {
            headers: { 
                'ngrok-skip-browser-warning': 'true',
                'x-api-key': CONFIG.KEY,
                'Content-Type': 'application/xml'
            }
        });
        
        if (!response.ok) throw new Error("Gagal mengambil data dari server.");
        
        const xmlText = await response.text();

        container.innerHTML = `
            <div class="max-w-6xl mx-auto p-4 md:p-10 fade-in">
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-slate-200 pb-6">
                    <div>
                        <h1 class="text-3xl font-black text-orange-600 uppercase tracking-tighter">${fileName}</h1>
                    </div>
                </div>
                
                <div class="bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl overflow-hidden ring-1 ring-slate-800">
                    <pre class="text-orange-600 text-[10px] md:text-sm font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap">${escapeXml(xmlText)}</pre>
                </div>
            </div>
        `;
    } catch (err) {
        container.innerHTML = `<div class="p-20 text-center text-orange-600 font-bold">${err.message}</div>`;
    }
}

function escapeXml(unsafe) {
    return unsafe.replace(/[<>&"']/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '"': return '&quot;';
            case "'": return '&apos;';
        }
    });
}

window.showPopupAd = () => document.getElementById('popup-ad')?.classList.replace('hidden', 'flex');
window.closePopupAd = () => document.getElementById('popup-ad')?.classList.replace('flex', 'hidden');

window.refreshData = () => {
    clearAllCache();
    router();
};

window.navigateTo = (url) => {
    window.history.pushState({}, '', url === '/' ? window.location.pathname : url);
    router();
    if (typeof direct === 'function') direct(); 
};

window.onpopstate = () => {
    router();
};

document.addEventListener('contextmenu', e => e.preventDefault());

document.addEventListener('keydown', e => {
    if (e.key === "F12" || (e.ctrlKey && e.shiftKey && ['I','J','C'].includes(e.key)) || (e.ctrlKey && e.key === 'u')) {
        e.preventDefault();
    }
});

setInterval(() => {
    const t0 = Date.now();
    debugger;
    if (Date.now() - t0 > 100) {
    }
}, 1000);

window.renderLogin = () => {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
        <div class="flex flex-col items-center justify-center min-h-[80vh] text-slate-900 p-6">
            <div class="w-full max-w-md bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
                <div class="text-center mb-8">
                    <h2 class="text-3xl font-extrabold text-orange-600">MASUK</h2>
                    <p class="text-slate-600 mt-2 text-sm">Masuk untuk akses semua episode</p>
                </div>
                <div class="space-y-5">
                    <input type="email" id="login-email" placeholder="Email" class="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 outline-none focus:border-orange-500 transition">
                    <input type="password" id="login-password" placeholder="Password" class="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 outline-none focus:border-orange-500 transition">
                    <button onclick="processLogin()" id="btn-login" class="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 rounded-xl shadow-lg transition duration-200">
                        Masuk Sekarang
                    </button>
                </div>
                <p class="mt-8 text-center text-slate-600 text-sm">
                    Belum punya akun? <a href="/?page=signup" onclick="event.preventDefault(); window.navigateTo('/?page=signup')" class="text-orange-600 font-bold hover:underline">Daftar</a>
					<br>
					<p class="text-slate-600 mt-2 text-sm">
					Username: demo<br>
					Password: demo</p>
                </p>
            </div>
        </div>
    `;
};

window.showConfirmModal = (message, onConfirm) => {
    if (document.getElementById('confirm-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'confirm-modal';
    modal.className = 'fixed inset-0 z-[10001] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4';
    modal.innerHTML = `
        <style>
            @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
            .slide-up { animation: slideUp 0.3s ease-out forwards; }
        </style>
        <div class="bg-white w-full max-w-xs rounded-3xl border border-slate-200 p-6 text-center shadow-2xl slide-up">
            <div class="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg class="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                </svg>
            </div>
            <h3 class="text-xl font-bold text-slate-900 mb-2">Konfirmasi Keluar</h3>
            <p class="text-slate-600 mb-6 text-sm">${message}</p>
            
            <div class="grid grid-cols-2 gap-3">
                <button id="confirm-yes" class="bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-xl transition active:scale-95 text-sm">
                    Ya, Keluar
                </button>
                <button id="confirm-no" class="bg-slate-200 hover:bg-slate-300 text-gray-300 font-bold py-3 rounded-xl transition active:scale-95 text-sm">
                    Batal
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('confirm-yes').onclick = () => {
        modal.remove();
        onConfirm();
    };

    document.getElementById('confirm-no').onclick = () => {
        modal.remove();
    };
};

window.logout = () => {
    showConfirmModal("Apakah Anda yakin ingin keluar?", () => {
        localStorage.removeItem('user_token');
        localStorage.removeItem('user_premium');
        
        if (typeof showToast === 'function') {
            showToast("Anda telah berhasil keluar", "success");
        }

        const header = document.querySelector('nav');
        if (header) {
            header.outerHTML = getNavbar();
        }
        
        setTimeout(() => {
            window.navigateTo('/');
        }, 500);
    });
};

window.processLogin = async () => {
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const btn = document.getElementById('btn-login');
    const email = emailInput?.value.trim();
    const password = passwordInput?.value;

    if (!email || !password) {
		showToast("Email dan password tidak boleh kosong", "error");
        return;
    }

    const originalBtnText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="inline-block animate-spin mr-2">⏳</span> Memproses...`;

    try {
        const res = await fetch(`${CONFIG.BASE_URL}/user/login`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-api-key': CONFIG.KEY 
            },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (res.ok && data.token) {
            localStorage.setItem('user_token', data.token);
            localStorage.setItem('user_premium', data.user?.isPremium ? '1' : '0');

			showToast("Login Berhasil! Selamat menonton.", "success"); 
			
            const header = document.querySelector('nav');
            if (header) {
                header.outerHTML = getNavbar();
            }

            const targetPage = localStorage.getItem('redirect_after_login') || '/';
            localStorage.removeItem('redirect_after_login'); 

            if (targetPage === '/') {
                window.navigateTo('/');
            } else {
                window.location.href = targetPage;
            }

        } else {
			showToast("Gagal masuk. Periksa kembali email dan password Anda.", "error"); 
        }
    } catch (err) {
		showToast("Terjadi kesalahan jaringan. Pastikan server sudah berjalan.", "error"); 
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalBtnText;
        }
    }
};

window.renderSignup = () => {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
        <div class="flex flex-col items-center justify-center min-h-[80vh] text-slate-900 p-6">
            <div class="w-full max-w-md bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
                <div class="text-center mb-8">
                    <h2 class="text-3xl font-extrabold text-orange-600">DAFTAR</h2>
                    <p class="text-slate-600 mt-2 text-sm">Buat akun gratis untuk menonton</p>
                </div>
                <div class="space-y-5">
                    <input type="email" id="signup-email" placeholder="Email Baru" class="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 outline-none focus:border-orange-500 transition">
                    <input type="password" id="signup-password" placeholder="Buat Password" class="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 outline-none focus:border-orange-500 transition">
                    <button onclick="processSignup()" id="btn-signup" class="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 rounded-xl shadow-lg transition duration-200">
                        Daftar Akun
                    </button>
                </div>
                <p class="mt-8 text-center text-slate-600 text-sm">
                    Sudah punya akun? <a href="/?page=login" onclick="event.preventDefault(); window.navigateTo('/?page=login')" class="text-orange-600 font-bold hover:underline">Masuk</a>
                </p>
            </div>
        </div>
    `;
};

window.processSignup = async () => {
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const btn = document.getElementById('btn-signup');

    if (!email || !password) return showToast("Isi seua kolom!", "error"); 

    btn.disabled = true;
    btn.innerText = "Mendaftar...";

    try {
        const res = await fetch(`${CONFIG.BASE_URL}/user/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': CONFIG.KEY },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();
        if (res.ok) {
			showToast("Pendaftaran Berhasil! Silakan Login.", "success");
            window.navigateTo('/?page=login');
        } else {
			showToast("Gagal mendaftar!", "error"); 
        }
    } catch (e) {
		showToast("Gagal terhubung ke server!", "error"); 
    } finally {
        btn.disabled = false;
        btn.innerText = "Daftar Akun";
    }
};

window.showToast = (message, type = 'success') => {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const toast = document.createElement('div');
    
    const bgColor = type === 'success' ? 'bg-orange-600' : 'bg-orange-600';
    const icon = type === 'success' ? 'check-circle' : 'exclamation-circle';

    toast.className = `flex items-center p-4 min-w-[300px] text-slate-900 rounded-2xl shadow-2xl transform transition-all duration-300 translate-x-full opacity-0 pointer-events-auto ${bgColor}`;
    
    toast.innerHTML = `
        <div class="mr-3">
            <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
            </svg>
        </div>
        <div class="font-medium text-sm">${message}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('translate-x-full', 'opacity-0');
        toast.classList.add('translate-x-0', 'opacity-100');
    }, 100);

    setTimeout(() => {
        toast.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

window.showPaymentModal = () => {
    if (document.getElementById('payment-modal')) return;
    document.body.style.overflow = 'hidden';

    const modal = document.createElement('div');
    modal.id = 'payment-modal';
    modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4';
    modal.innerHTML = `
        <div class="bg-white w-full max-w-sm rounded-3xl border border-slate-200 p-6 text-center shadow-2xl animate-fade-in">
            <div class="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span class="text-3xl">👑</span>
            </div>
            <h3 class="text-xl font-bold text-slate-900 mb-1">Pilih Paket VIP</h3>
            <p class="text-slate-600 mb-6 text-xs">Buka akses semua episode tanpa batas.</p>
            
            <div class="grid gap-3">
                <button onclick="processPayment('weekly', event)" class="flex justify-between items-center bg-slate-200 hover:bg-slate-300 p-4 rounded-2xl border border-slate-200 transition group">
                    <div class="text-left">
                        <div class="text-slate-900 font-bold text-sm">1 Minggu</div>
                        <div class="text-orange-600 text-xs">Rp 10.000</div>
                    </div>
                    <span class="text-orange-600 opacity-0 group-hover:opacity-100">Beli &rarr;</span>
                </button>

                <button onclick="processPayment('monthly', event)" class="flex justify-between items-center bg-slate-200 hover:bg-slate-300 p-4 rounded-2xl border border-slate-200 transition group">
                    <div class="text-left">
                        <div class="text-slate-900 font-bold text-sm">1 Bulan</div>
                        <div class="text-orange-600 text-xs">Rp 20.000</div>
                    </div>
                    <span class="text-orange-600 opacity-0 group-hover:opacity-100">Beli &rarr;</span>
                </button>

                <button onclick="processPayment('yearly', event)" class="flex justify-between items-center bg-orange-500/10 border border-orange-500/30 p-4 rounded-2xl hover:bg-orange-500/20 transition group">
                    <div class="text-left">
                        <div class="text-slate-900 font-bold text-sm">1 Tahun</div>
                        <div class="text-orange-600 text-xs text-orange-600">Rp 50.000</div>
                    </div>
                    <span class="text-orange-600">Hemat 80%</span>
                </button>

                <button onclick="processPayment('lifetime', event)" class="flex justify-between items-center bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-2xl hover:bg-yellow-500/20 transition group">
                    <div class="text-left">
                        <div class="text-slate-900 font-bold text-sm">Selamanya</div>
                        <div class="text-yellow-500 text-xs font-bold">Rp 100.000</div>
                    </div>
                    <span class="text-yellow-500 font-bold">VIP PERMANEN</span>
                </button>
            </div>

            <button onclick="closePaymentModal()" class="mt-6 text-gray-500 text-xs hover:text-slate-900 transition">Mungkin Nanti</button>
        </div>
    `;
    document.body.appendChild(modal);
};

window.closePaymentModal = () => {
    const modal = document.getElementById('payment-modal');
    if (modal) {
        modal.remove();
        document.body.style.overflow = 'auto';
    }
};

window.processPayment = async (plan, event) => {
    const btn = event?.currentTarget || event?.target || null;
    const originalHTML = btn ? btn.innerHTML : "Beli";

    if (btn && btn.disabled) return;

    try {
        const token = localStorage.getItem('user_token');
        if (!token) {
            alert("Silakan login terlebih dahulu untuk membeli paket.");
            return;
        }

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<span class="animate-pulse">Processing...</span>`;
        }

        const res = await fetch(`${CONFIG.BASE_URL}/user/create-transaction`, {
            method: 'POST',
            headers: {
                ...REQUEST_OPTIONS.headers,
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ plan: plan })
        });

        const data = await res.json();

        if (res.status === 201 && data.token) {
            window.snap.pay(data.token, {
                onSuccess: (result) => { 
                    alert("Pembayaran Berhasil! Status Premium Anda sedang diproses."); 
                    location.reload(); 
                },
                onPending: (result) => { 
                    alert("Pesanan dibuat. Silakan selesaikan pembayaran di aplikasi bank/e-wallet Anda."); 
                },
                onError: (result) => { 
                    alert("Terjadi kesalahan saat memproses pembayaran."); 
                },
                onClose: () => {
                    console.log('User menutup popup pembayaran');
                }
            });
        } else {
            alert(data.message || "Gagal membuat sesi pembayaran.");
        }
    } catch (err) {
        console.error("Frontend Error:", err);
        alert("Gagal menghubungi server. Periksa koneksi internet Anda.");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHTML;
        }
    }
};

/**
 * RENDER DASHBOARD MEMBER
 */
const renderDashboard = async () => {
    const contentArea = document.getElementById('content-area');
    const token = localStorage.getItem('user_token');

    if (!token) {
        window.location.href = '/?page=login';
        return;
    }

    contentArea.innerHTML = getSkeleton('home');

    try {
        const res = await fetch(`${CONFIG.BASE_URL}/user/profile`, {
            headers: {
                ...REQUEST_OPTIONS.headers,
                'Authorization': `Bearer ${token}`
            }
        });
        const json = await res.json();
        
        if (!res.ok) throw new Error(json.message || "Gagal memuat profil");

        const user = json.data;
        const isPremium = user.isPremium === 1;

        contentArea.innerHTML = `
            <div class="max-w-4xl mx-auto p-6 space-y-8 animate-fade-in">
                <div class="bg-white border border-slate-200 rounded-3xl p-8 flex flex-col md:flex-row items-center gap-6 shadow-2xl">
                    <div class="w-24 h-24 rounded-full bg-orange-500 flex items-center justify-center text-4xl font-bold text-slate-900 border-4 border-slate-200">
                        ${user.email[0].toUpperCase()}
                    </div>
                    <div class="flex-1 text-center md:text-left">
                        <h1 class="text-2xl font-bold text-slate-900 mb-1">${user.email}</h1>
                        <p class="text-slate-500 text-sm">Member sejak: ${new Date(user.createdAt).toLocaleDateString('id-ID')}</p>
                        <div class="mt-4 inline-flex items-center px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${isPremium ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' : 'bg-slate-200 text-slate-500'}">
                            ${isPremium ? '👑 Premium Member' : 'Free Member'}
                        </div>
                    </div>
                    ${!isPremium ? `
                        <button onclick="showPaymentModal()" class="w-full md:w-auto px-6 py-3 bg-orange-500 hover:bg-orange-600 text-slate-900 font-bold rounded-2xl transition-all shadow-lg shadow-orange-500/20">
                            UPGRADE KE PREMIUM
                        </button>
                    ` : ''}
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="bg-white/50 border border-slate-200 p-6 rounded-2xl">
                        <h3 class="text-slate-500 text-xs font-bold uppercase mb-4 tracking-widest">Detail Langganan</h3>
                        <div class="space-y-3">
                            <div class="flex justify-between text-sm">
                                <span class="text-slate-500">Status</span>
                                <span class="text-slate-900 font-medium">${isPremium ? 'Aktif' : 'Tidak Aktif'}</span>
                            </div>
                            <div class="flex justify-between text-sm">
                                <span class="text-slate-500">Masa Berlaku</span>
                                <span class="text-slate-900 font-medium">${user.expiryDate ? new Date(user.expiryDate).toLocaleDateString('id-ID') : 'Selamanya (Free)'}</span>
                            </div>
                        </div>
                    </div>

                    <div class="bg-white/50 border border-slate-200 p-6 rounded-2xl">
						<h3 class="text-slate-500 text-xs font-bold uppercase mb-4 tracking-widest">Keamanan</h3>
						<button onclick="openChangePasswordModal()" class="text-orange-600 hover:text-orange-600 text-sm font-semibold flex items-center gap-2">
							<span>Ganti Password</span>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M14 5l7 7m0 0l-7 7m7-7H3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
						</button>
					</div>
                </div>
            </div>
        `;
    } catch (err) {
        contentArea.innerHTML = `<div class="p-20 text-center text-slate-500"><p class="text-orange-600">${err.message}</p></div>`;
    }
};

const openChangePasswordModal = () => {
    const modalHtml = `
    <div id="pw-modal" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
        <div class="bg-white border border-slate-200 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl">
            <div class="p-6 border-b border-slate-200 flex justify-between items-center">
                <h3 class="text-xl font-bold text-slate-900">Ganti Password</h3>
                <button onclick="document.getElementById('pw-modal').remove()" class="text-slate-500 hover:text-slate-900">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
            </div>
            <form id="pw-form" class="p-6 space-y-4">
                <div>
                    <label class="block text-xs font-bold text-slate-500 uppercase mb-2">Password Lama</label>
                    <input type="password" id="old-pw" required class="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:border-orange-500 outline-none transition-all">
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-500 uppercase mb-2">Password Baru</label>
                    <input type="password" id="new-pw" required class="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:border-orange-500 outline-none transition-all">
                </div>
                <button type="submit" id="btn-pw-submit" class="w-full py-4 bg-orange-500 hover:bg-orange-600 text-slate-900 font-bold rounded-xl transition-all shadow-lg shadow-orange-500/20">
                    SIMPAN PERUBAHAN
                </button>
            </form>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('pw-form').onsubmit = async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-pw-submit');
        const oldPassword = document.getElementById('old-pw').value;
        const newPassword = document.getElementById('new-pw').value;
        const originalText = btn.innerText;

        btn.disabled = true;
        btn.innerText = "MEMPROSES...";

        try {
            const token = localStorage.getItem('user_token');
            const res = await fetch(`${CONFIG.BASE_URL}/user/change-password`, {
                method: 'POST',
                headers: {
                    ...REQUEST_OPTIONS.headers,
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ oldPassword, newPassword })
            });

            const data = await res.json();
            if (res.ok) {
                showToast("Password berhasil diganti! Silakan login ulang.", "success");
                setTimeout(() => logout(), 2000);
            } else {
                showToast(data.message || "Gagal mengganti password", "error");
            }
        } catch (err) {
            showToast("Terjadi kesalahan koneksi", "error");
        } finally {
            btn.disabled = false;
            btn.innerText = originalText;
        }
    };
};

const showChangePasswordModal = async () => {
    const oldPassword = prompt("Masukkan Password Lama:");
    if (!oldPassword) return;

    const newPassword = prompt("Masukkan Password Baru (Minimal 6 karakter):");
    if (!newPassword || newPassword.length < 6) {
        alert("Password baru tidak valid.");
        return;
    }

    try {
        const token = localStorage.getItem('user_token');
        const res = await fetch(`${CONFIG.BASE_URL}/user/change-password`, {
            method: 'POST',
            headers: {
                ...REQUEST_OPTIONS.headers,
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ oldPassword, newPassword })
        });

        const data = await res.json();
        if (res.ok) {
            alert("Berhasil! Silakan login kembali dengan password baru.");
            logout(); 
        } else {
            alert(data.message || "Gagal mengganti password");
        }
    } catch (err) {
        alert("Terjadi kesalahan koneksi.");
    }
};


(async () => {
    try {
        const success = await initApp();
        if (success) {
            router();
        } else {
            console.warn("Domain tidak terdaftar atau inisialisasi gagal.");
        }
    } catch (error) {
        console.error("Critical Error saat inisialisasi:", error);
    }
})();