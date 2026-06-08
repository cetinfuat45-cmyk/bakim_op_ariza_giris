// Firebase JS kütüphanelerini içe aktar (importScripts Service Worker için özeldir)
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

// Kendi Firebase Config bilgilerinizi buraya girin (app.js ile aynı)
firebase.initializeApp({
    apiKey: "AIzaSyAEqLYUevIJCcLrJa-05MXx5ik-QFouq9o",
    authDomain: "arizabildirim-89dfa.firebaseapp.com",
    projectId: "arizabildirim-89dfa",
    storageBucket: "arizabildirim-89dfa.firebasestorage.app",
    messagingSenderId: "106785239667",
    appId: "1:106785239667:web:ab131b6a11d8133a537006"
});

// Messaging objesini oluştur
const messaging = firebase.messaging();

// Uygulama kapalıyken arka planda gelen mesajları yakalama
messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Arka plan mesajı alındı: ', payload);
  
  // Mesajın içeriği
  const notificationTitle = payload.notification.title || "⚠️ YENİ ARIZA";
  const notificationOptions = {
    body: payload.notification.body || "Sisteme yeni bir arıza girişi yapıldı.",
    icon: 'https://cdn-icons-png.flaticon.com/512/2885/2885417.png', // Uygulamanızın ikonu
    badge: 'https://cdn-icons-png.flaticon.com/512/2885/2885417.png',
    vibrate: [200, 100, 200, 100, 200, 100, 200], // Titreşim ritmi
    data: {
      url: payload.data ? payload.data.url : '/'
    }
  };

  // İşletim sistemine native bildirim gönder (Ekranı uyandırır)
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Bildirime tıklandığında ne olacağı (Uygulamayı aç)
self.addEventListener('notificationclick', function(event) {
  console.log('[firebase-messaging-sw.js] Bildirime tıklandı.');
  event.notification.close(); // Bildirimi kapat
  
  // Tıklanınca açılacak link (Varsayılan olarak kök dizini açar)
  const targetUrl = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
      // Eğer sekme zaten açıksa ona odaklan (focus)
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      // Açık değilse yeni sekmede aç
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
