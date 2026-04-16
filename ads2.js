const showNontonButton = () => {
    const btn = document.getElementById('btn-nonton-app');
    if (btn) {
        btn.classList.remove('hidden');
        btn.style.display = 'flex';
    }
};

const showPopupAd = () => {
    const popup = document.getElementById('popup-ads-container');
    const adsPlaceholder = document.getElementById('ads-placeholder');

    if (popup && adsPlaceholder) {
        popup.classList.remove('hidden');
        popup.style.display = 'flex';

        window.atOptions = {
            'key' : '1e4197325c6ef10a187d8b2889d632ae',
            'format' : 'iframe',
            'height' : 250,
            'width' : 300,
            'params' : {}
        };

        const adScript = document.createElement('script');
        adScript.type = 'text/javascript';
        adScript.src = 'https://amoralstern.com/1e4197325c6ef10a187d8b2889d632ae/invoke.js?t=' + Date.now();
        
        adsPlaceholder.innerHTML = ''; 
        adsPlaceholder.appendChild(adScript);
    }
};

const closePopupAd = () => {
    const popup = document.getElementById('popup-ads-container');
    if (popup) {
        popup.style.display = 'none';
        direct();
    }
};

const refreshAds = (type) => {
    const isMobile = window.innerWidth < 768;

    const bannerConfig = isMobile ? {
        key: '30b457e8208305e3e692e62ed686fc39',
        format: 'iframe', height: 50, width: 320
    } : {
        key: '6bc6463fa2497bc046044fa0f458d479',
        format: 'iframe', height: 90, width: 728
    };

    const rectConfig = {
        key: '1e4197325c6ef10a187d8b2889d632ae',
        format: 'iframe', height: 250, width: 300
    };
	
	const tiktokConfig = {
        key: '30b457e8208305e3e692e62ed686fc39',
        format: 'iframe',
        height: 50,
        width: 320
    };

    const injectAdIsolated = (targetId, containerId, config) => {
        const target = document.getElementById(targetId);
        const container = document.getElementById(containerId);
        if (!target || !container) return;

        container.style.display = 'flex';
        container.classList.remove('hidden');

        target.innerHTML = '';
        const iframe = document.createElement('iframe');
        iframe.width = config.width;
        iframe.height = config.height;
        iframe.frameBorder = "0";
        iframe.scrolling = "no";
        target.appendChild(iframe);

        const iframeDoc = iframe.contentWindow.document;
        iframeDoc.open();
        iframeDoc.write(`
            <body style="margin:0;padding:0;display:flex;justify-content:center;">
                <script type="text/javascript">var atOptions = ${JSON.stringify(config)};</script>
                <script type="text/javascript" src="https://www.highperformanceformat.com/${config.key}/invoke.js"></script>
            </body>
        `);
        iframeDoc.close();
    };

    if (type === 'tiktok_view') {
        injectAdIsolated('ads-tiktok-top', 'container-ads-tiktok-top', tiktokConfig);
    } else {
        injectAdIsolated('ads-728x90', 'container-ads-728x90', bannerConfig);
        setTimeout(() => {
            injectAdIsolated('ads-320x250', 'container-ads-320x250', rectConfig);
        }, 200);
    }
};

const PopunderManager = {
    STORAGE_KEY: 'dracin_pop_stats',
    CONFIG: {
        INITIAL_DELAY: 60000,      // 1 menit
        COOLDOWN: 150000,          // 2.5 menit
        DAILY_LIMIT: 4,            // Maks 4x/hari
        URL: 'https://amoralstern.com/p5vk22db?key=1cf307fe25d93c5912951ec73981c179'
    },

    getStats() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            const now = Date.now();
            let stats = data ? JSON.parse(data) : { count: 0, lastReset: now, lastPop: 0 };
            
            // Reset harian (24 jam)
            if (now - stats.lastReset > 86400000) {
                stats = { count: 0, lastReset: now, lastPop: 0 };
            }
            return stats;
        } catch (e) {
            return { count: 0, lastReset: Date.now(), lastPop: 0 };
        }
    },

    saveStats(stats) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(stats));
        } catch (e) {}
    },

    canShow() {
        const stats = this.getStats();
        const now = Date.now();
        return stats.count < this.CONFIG.DAILY_LIMIT && (now - stats.lastPop) > this.CONFIG.COOLDOWN;
    },

    trigger() {
        if (!this.canShow()) return;

        const stats = this.getStats();
        window.open(this.CONFIG.URL, '_blank');
        
        stats.count += 1;
        stats.lastPop = Date.now();
        this.saveStats(stats);

        // Hapus listener setelah terpicu
        document.body.removeEventListener('click', this.boundTrigger);
        console.log(`Popunder triggered. Count: ${stats.count}/${this.CONFIG.DAILY_LIMIT}`);

        // Jadwalkan pengecekan berikutnya setelah cooldown
        setTimeout(() => this.setupListener(), this.CONFIG.COOLDOWN);
    },

    setupListener() {
        if (!this.canShow()) return;
        
        // Gunakan binding agar bisa di-remove
        if (!this.boundTrigger) this.boundTrigger = this.trigger.bind(this);
        document.body.addEventListener('click', this.boundTrigger);
    },

    init() {
        console.log('Popunder Manager Initialized. Waiting 60s...');
        setTimeout(() => this.setupListener(), this.CONFIG.INITIAL_DELAY);
    }
};

const direct = () => {
    PopunderManager.init();
};

window.addEventListener('load', () => {
    setTimeout(showNontonButton, 3000);
    refreshAds('initial');
    direct();
});