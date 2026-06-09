const CACHE_NAME = 'bakim-ariza-v4';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './weekly_report.js',
    './AKGLOG.png',
    'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
];

// Service Worker Yükleme (Install) - Dosyaları Önbelleğe Al
self.addEventListener('install', event => {
    self.skipWaiting(); // YENİ EKLENDİ: Beklemeyi atla ve anında aktif ol!
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('Önbellek (Cache) başarıyla açıldı.');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// Eski Önbellekleri Temizleme (Activate)
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(keys.map(key => {
                if (key !== CACHE_NAME) {
                    console.log('Eski önbellek siliniyor:', key);
                    return caches.delete(key);
                }
            }));
        }).then(() => self.clients.claim()) // YENİ EKLENDİ: Tüm istemcileri (sekmeleri) anında kontrol altına al
    );
});

// Ağa İstek Atarken (Fetch) - Önce interneti dene, yoksa önbellekten getir (Network-First Cache)
self.addEventListener('fetch', event => {
    // Sadece GET isteklerini yakala ve Firebase / Google API dışındakiler için çalıştır
    if (event.request.method !== 'GET' || event.request.url.includes('firestore') || event.request.url.includes('google')) {
        return;
    }

    event.respondWith(
        fetch(event.request).catch(() => {
            return caches.match(event.request);
        })
    );
});

