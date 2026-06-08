// FIREBASE BAĞLANTISI (Sizin orijinal projenizden kopyalandı)
const firebaseConfig = {
    apiKey: "AIzaSyAEqLYUevIJCcLrJa-05MXx5ik-QFouq9o",
    authDomain: "arizabildirim-89dfa.firebaseapp.com",
    projectId: "arizabildirim-89dfa",
    storageBucket: "arizabildirim-89dfa.firebasestorage.app",
    messagingSenderId: "106785239667",
    appId: "1:106785239667:web:ab131b6a11d8133a537006"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// SİSTEMDEKİ TÜM ALERT'LERİ ŞIK BİR HALE GETİRMEK İÇİN (SweetAlert2 OVERRIDE)
window.alert = function(message) {
    const isError = message.toLowerCase().includes('hata') || message.toLowerCase().includes('lütfen') || message.includes('⚠️') || message.includes('❌');
    const isSuccess = message.includes('✅') || message.includes('🚀') || message.toLowerCase().includes('başarı');
    
    let iconType = 'info';
    if (isError) iconType = 'warning';
    if (isSuccess) iconType = 'success';

    // Eğer sayfada SweetAlert yüklüyse onu kullan
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            text: message,
            icon: iconType,
            background: '#1e293b',
            color: '#f8fafc',
            confirmButtonColor: '#3b82f6',
            confirmButtonText: 'Tamam',
            customClass: {
                popup: 'rounded-xl border border-slate-700 shadow-2xl'
            }
        });
    } else {
        // Yüklü değilse orjinale düş (fallback)
        console.log("ALERT:", message);
    }
};

let currentOpenFaults = []; // Taranan makineyi bulmak için RAM'de tutulacak

// İsim Kısaltma Fonksiyonu (Ahmet Yılmaz -> A.Yılmaz)
function shortName(fullName) {
    if (!fullName) return "";
    // Özel olarak Engin Vardar istendiyse
    if (fullName.toLowerCase() === "engin vardar") return "E.Vardar";
    
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    
    let result = "";
    for (let i = 0; i < parts.length - 1; i++) {
        result += parts[i].charAt(0).toUpperCase() + ".";
    }
    // Son ismin ilk harfini büyük, kalanını küçük yap (opsiyonel, olduğu gibi de bırakılabilir)
    const lastName = parts[parts.length - 1];
    result += lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase();
    
    return result;
}

// Sizin Google Apps Script Web App Linkiniz
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx0TxZ8yjyP7v3q3tYqMxKs7stPL7g7AvhLRxOfm3Ovci0QGD8vM_IwhkmXBc0wu5BZ/exec";

// Global Değişkenler
let operatorsList = [];
let rootCausesList = [];
let faultReasonsList = [];
let stoppageReasonsList = [];
let loggedInOperator = null;

// Sayfa yüklendiğinde çalışacaklar
document.addEventListener("DOMContentLoaded", () => {
    // 1. Önce verileri Firebase'den çek
    fetchConfigFromFirebase();
    
    // 2. Hafızadaki makine sözlüğünü yükle (QR hızlandırması için)
    loadMachineDictionary();

    // Menü dışında bir yere tıklanınca menüyü kapat
    document.addEventListener("click", (e) => {
        const menu = document.getElementById('settings-menu');
        const menuBtn = document.getElementById('main-menu-btn');
        if (menu && menu.style.display === 'flex') {
            // Tıklanan yer menü veya menü butonu değilse kapat
            if (!menu.contains(e.target) && (!menuBtn || !menuBtn.contains(e.target))) {
                menu.style.display = 'none';
            }
        }
    });
});

// Ayarları Firebase'den Hızlıca Çek
async function fetchConfigFromFirebase() {
    try {
        document.getElementById('user-info').innerText = "Veritabanı kontrol ediliyor...";
        
        const docRef = db.collection('settings').doc('config');
        const docSnap = await docRef.get();

        if (docSnap.exists) {
            const data = docSnap.data();
            operatorsList = data.operators || [];
            rootCausesList = data.rootCauses || [];
            faultReasonsList = data.faultReasons || [];
            stoppageReasonsList = data.stoppageReasons || [];
            document.getElementById('user-info').innerText = "Lütfen PIN Kodunuzu Girin";
            
            checkSavedLogin();
        } else {
            // Eğer Firebase tamamen boşsa otomatik olarak ilk kurulumu yap
            document.getElementById('user-info').innerText = "Sistem İlk Kurulumu Yapılıyor (Excel'e bağlanılıyor)...";
            await syncFromExcel();
        }
    } catch (error) {
        console.error("Firebase Hatası:", error);
        document.getElementById('user-info').innerText = "Hata: Veritabanına ulaşılamadı!";
    }
}

// Excel'den Veri Çek ve Firebase'e Kaydet (Sadece Admin Görebilir)
async function syncFromExcel() {
    try {
        const btn = document.getElementById('btn-sync');
        if(btn) btn.innerText = "⏳ Güncelleniyor...";

        const response = await fetch(GOOGLE_SCRIPT_URL);
        const result = await response.json();
        
        if (result.success && result.data) {
            await db.collection('settings').doc('config').set({
                operators: result.data.operators,
                rootCauses: result.data.rootCauses || [],
                faultReasons: result.data.faultReasons || [],
                stoppageReasons: result.data.stoppageReasons || [],
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });

            operatorsList = result.data.operators;
            rootCausesList = result.data.rootCauses || [];
            faultReasonsList = result.data.faultReasons || [];
            stoppageReasonsList = result.data.stoppageReasons || [];
            
            console.log("Sistem ilk kez Excel'den çekildi.");
            document.getElementById('user-info').innerText = "Kurulum Tamam! Lütfen PIN girin.";
            return true;
        } else {
            alert("Excel'den veri çekilirken hata oluştu!");
            return false;
        }
    } catch (error) {
        console.error("Senkronizasyon Hatası:", error);
        alert("Bağlantı hatası yaşandı!");
        return false;
    }
}

// PIN ile Giriş Yapma Fonksiyonu
function login() {
    const pinInput = document.getElementById('pinCode').value.trim();
    
    if (pinInput.length === 0) {
        alert("Lütfen şifrenizi girin!");
        return;
    }

    if (operatorsList.length === 0) {
        alert("Sistem verileri yüklenemedi. Lütfen sayfayı yenileyin.");
        return;
    }

    // Girilen PIN kodunu Firebase'den okuduğumuz listede ara
    const operator = operatorsList.find(op => op.pin === pinInput);

    if (operator) {
        loggedInOperator = operator;
        localStorage.setItem("loggedInOperator", JSON.stringify(operator));
        showDashboard();
    } else {
        alert("Hatalı PIN! Lütfen şifrenizi kontrol edin.");
        document.getElementById('pinCode').value = '';
    }
}

// Tarayıcıda Kayıtlı Oturum Varsa Doğrudan Panele Geç
function checkSavedLogin() {
    const savedOp = localStorage.getItem("loggedInOperator");
    if (savedOp) {
        // Localstorage'daki objeyi mevcut operatör listesiyle eşleştirip güncel halini alalım
        const parsedOp = JSON.parse(savedOp);
        const freshOp = operatorsList.find(op => op.pin === parsedOp.pin);
        
        if (freshOp) {
            loggedInOperator = freshOp;
            showDashboard();
        } else {
            // Şifresi değişmiş veya listeden silinmiş olabilir
            logout();
        }
    }
}

// --- MAKİNE SÖZLÜĞÜ (AppSheet ID -> Makine Adı) ---
let machineDictionary = {};

function loadMachineDictionary() {
    try {
        const storedMap = localStorage.getItem('akg_machine_dictionary');
        if (storedMap) {
            machineDictionary = JSON.parse(storedMap);
            console.log(`Hafızadan makine sözlüğü yüklendi: ${Object.keys(machineDictionary).length} kayıt.`);
        }
    } catch(e) {
        console.error("Sözlük yüklenirken hata:", e);
    }
}

// JSONP Callback Fonksiyonunu Ayarlıyoruz (Sessiz Çalışır)
window.google = {
    visualization: {
        Query: {
            setResponse: function(data) {
                try {
                    let newDict = {};
                    if (data && data.table && data.table.rows) {
                        data.table.rows.forEach(row => {
                            if (row.c && row.c[0] && row.c[1]) {
                                const id = row.c[0].v;
                                const name = row.c[1].v;
                                if (id && name && id.toString().toLowerCase() !== 'id') {
                                    newDict[id.toString().trim()] = name.toString().trim();
                                }
                            }
                        });
                    }
                    
                    if(Object.keys(newDict).length > 0) {
                        machineDictionary = newDict;
                        localStorage.setItem('akg_machine_dictionary', JSON.stringify(newDict));
                        console.log(`✅ Arka plan sözlük güncellemesi tamamlandı: ${Object.keys(newDict).length} makine.`);
                    } else {
                        console.warn("Makine listesi çekildi ama veri bulunamadı.");
                    }
                } catch(e) {
                    console.error("Veri işlenirken hata oluştu: " + e.message);
                } finally {
                    const script = document.getElementById('gviz-script');
                    if(script) script.remove();
                }
            }
        }
    }
};

function updateMachineList() {
    // CORS ve Proxy hatalarını %100 aşmak için fetch yerine JSONP (script tag) yöntemi kullanıyoruz.
    const url = `https://docs.google.com/spreadsheets/d/13pjcli1vFeM_DuHk7y5HV1DBpqXE_IlaQtdhMsvf_6U/gviz/tq?tqx=out:json&gid=1078561341&t=${new Date().getTime()}`;
    
    const oldScript = document.getElementById('gviz-script');
    if(oldScript) oldScript.remove();

    const script = document.createElement('script');
    script.id = 'gviz-script';
    script.src = url;
    script.onerror = function() {
        console.error("Ağ Hatası: Makine Sözlüğü indirilemedi.");
    };
    document.body.appendChild(script);
}

// ----------------------------------------------------
// ARIZAYA TIKLAMA VE ADMIN KONTROLÜ
// ----------------------------------------------------
function handleFaultClick(fault) {
    let isAdmin = false;
    
    // Admin kontrolü: İsmin içinde admin, akif, şef geçiyorsa veya şifre 9999 ise Admin say.
    if (loggedInOperator) {
        const opName = (loggedInOperator.name || loggedInOperator.isim || loggedInOperator.ad || "").toString().toLocaleLowerCase('tr-TR');
        const opPin = (loggedInOperator.pin || "").toString().trim();
        
        if (opName.includes('admin') || opName.includes('akif') || opName.includes('şef') || opName.includes('sef') || opName.includes('fuat') || opPin === '9999' || opPin === '0000') {
            isAdmin = true;
        }
    }

    if (isAdmin) {
        // Admin ise, tıkladığı arızanın ait olduğu makinedeki TÜM AÇIK arızaları bulalım
        if (fault && fault.machine) {
            const dbMachine = fault.machine.trim().toLocaleUpperCase('tr-TR');
            const matchedFaults = currentOpenFaults.filter(f => {
                if (!f.machine) return false;
                return f.machine.trim().toLocaleUpperCase('tr-TR') === dbMachine;
            });

            // Arıza varsa daima seçim ekranını aç (tek arıza olsa bile 'Yardımcı Ol' butonunu göstermek için)
            if (matchedFaults.length >= 1) {
                openFaultSelectionModal(matchedFaults);
            } else {
                openInterventionForm(fault);
            }
        } else {
            // Makine adı yoksa mecburen tekli arıza olarak listele
            openFaultSelectionModal([fault]);
        }
    } else {
        // Normal teknisyense QR okutmaya zorla
        startQROnlyCamera();
    }
}

// ----------------------------------------------------
// QR KOD İŞLEMLERİ (SADECE OKUYUCU)
// ----------------------------------------------------

let faultsUnsubscribe = null;
let isInitialFaultsLoad = true;

// BİLDİRİM FONKSİYONLARI
function requestNotificationPermission() {
    // Menüdeki butonun ilk durumunu ayarla
    updateNotificationBtnUI();
    
    if ("Notification" in window) {
        Notification.requestPermission().then(permission => {
            console.log("Bildirim izni durumu:", permission);
        });
    }
}

function updateNotificationBtnUI() {
    const btn = document.getElementById('btn-toggle-notifications');
    if (!btn) return;
    const isEnabled = localStorage.getItem('notificationsEnabled') !== 'false';
    if (isEnabled) {
        btn.innerHTML = '🔔 Bildirimler: AÇIK';
        btn.style.background = 'rgba(59, 130, 246, 0.2)';
        btn.style.color = '#93c5fd';
        btn.style.borderColor = 'rgba(59, 130, 246, 0.4)';
    } else {
        btn.innerHTML = '🔕 Bildirimler: KAPALI';
        btn.style.background = 'rgba(100, 116, 139, 0.2)';
        btn.style.color = '#cbd5e1';
        btn.style.borderColor = 'rgba(100, 116, 139, 0.4)';
    }
}

function toggleNotifications() {
    const isEnabled = localStorage.getItem('notificationsEnabled') !== 'false';
    if (isEnabled) {
        localStorage.setItem('notificationsEnabled', 'false');
        alert("Bildirimler KAPATILDI. Artık yeni arızalarda ses veya uyarı almayacaksınız.");
    } else {
        localStorage.setItem('notificationsEnabled', 'true');
        alert("Bildirimler AÇILDI. Yeni arızalarda sesli ve görsel uyarı alacaksınız.");
        requestNotificationPermission(); // Açıldığı an izin yoksa tekrar ister
    }
    updateNotificationBtnUI();
    // Menüyü otomatik kapatma
    // document.getElementById('settings-menu').style.display = 'none';
}

function playNotificationSound() {
    if (localStorage.getItem('notificationsEnabled') === 'false') return;
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.type = 'sine';
        
        // Klasik uyarı sesi ritmi (çift bip)
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); 
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        
        oscillator.start(audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.5);
        oscillator.stop(audioCtx.currentTime + 0.5);
    } catch(e) {
        console.error("Ses çalınamadı", e);
    }
}

function showBrowserNotification(faultData) {
    if (localStorage.getItem('notificationsEnabled') === 'false') return;
    
    const titleText = "⚠️ YENİ ARIZA: " + (faultData.machine || 'Bilinmiyor');
    const bodyText = `Tür: ${faultData.jobType || 'Belirtilmedi'}\nAçıklama: ${faultData.description || 'Açıklama yok'}`;
    
    // 1. Sistem (İşletim Sistemi) Bildirimi
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification(titleText, {
            body: bodyText,
            icon: 'https://cdn-icons-png.flaticon.com/512/2885/2885417.png'
        });
    }

    // 2. Uygulama İçi (Toast) Görsel Bildirim (Garanti Yöntem)
    const toastContainer = document.getElementById('toast-container');
    if (toastContainer) {
        const toast = document.createElement('div');
        toast.style.background = 'rgba(239, 68, 68, 0.9)'; // Kırmızı alert
        toast.style.color = 'white';
        toast.style.padding = '15px 20px';
        toast.style.borderRadius = '8px';
        toast.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';
        toast.style.border = '1px solid #fca5a5';
        toast.style.animation = 'slideIn 0.3s ease-out forwards';
        toast.style.cursor = 'pointer';
        toast.innerHTML = `
            <strong style="display:block; font-size:1.1rem; margin-bottom:5px;">${titleText}</strong>
            <span style="font-size:0.9rem;">${bodyText.replace(/\n/g, '<br>')}</span>
        `;
        
        // Tıklanınca hemen kaybolsun
        toast.onclick = () => toast.remove();
        
        toastContainer.appendChild(toast);
        
        // 10 saniye sonra otomatik kaybolsun
        setTimeout(() => {
            if (toastContainer.contains(toast)) {
                toast.remove();
            }
        }, 10000);
    }
}

function fetchOpenFaults() {
    isInitialFaultsLoad = true; // Her dashboard açılışında sıfırla
    const todayContainer = document.getElementById('today-faults-container');
    const olderTbody = document.getElementById('older-faults-tbody');
    const myTasksTbody = document.getElementById('my-tasks-tbody');
    const myTasksSection = document.getElementById('my-tasks-section');
    const countEl = document.getElementById('fault-count');
    const myTasksTitle = document.getElementById('my-tasks-title');
    
    if (myTasksTitle && loggedInOperator) {
        const opName = loggedInOperator.name.toLocaleUpperCase('tr-TR');
        myTasksTitle.innerHTML = `⭐ ${opName}, BU GÖREVLERİ TAMAMLAMAN GEREKİYOR!`;
    }

    todayContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted);">Açık arızalar aranıyor...</p>';
    olderTbody.innerHTML = '';
    myTasksTbody.innerHTML = '';
    myTasksSection.style.display = 'none';

    // Eğer daha önce dinleyici başlatıldıysa durdur
    if (faultsUnsubscribe) {
        faultsUnsubscribe();
    }

    faultsUnsubscribe = db.collection('arizalar')
        .where('status', 'in', ['Açık', 'Müdahale Ediliyor', 'Parça Bekliyor', 'Geçici Çözüm', 'Dış Servis Bekliyor', 'Devredildi'])
        .onSnapshot((snapshot) => {
            currentOpenFaults = []; // Listeyi sıfırla

            // YENİ ARIZA GELDİĞİNDE BİLDİRİM ATMA MANTIĞI
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added' && !isInitialFaultsLoad) {
                    playNotificationSound();
                    showBrowserNotification(change.doc.data());
                }
            });
            isInitialFaultsLoad = false;

            if (snapshot.empty) {
                todayContainer.innerHTML = `
                    <div style="text-align:center; padding:2rem; background:rgba(16,185,129,0.1); border-radius:8px; border:1px solid var(--primary);">
                        <h3 style="color:var(--primary); margin:0;">🎉 Harika!</h3>
                        <p style="color:var(--text-muted); margin-top:0.5rem;">Şu an sistemde bekleyen açık arıza bulunmuyor.</p>
                    </div>`;
                olderTbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Kayıt yok</td></tr>';
                countEl.innerText = "0";
                myTasksSection.style.display = 'none';
                return;
            }

            countEl.innerText = snapshot.size;
            todayContainer.innerHTML = '';
            olderTbody.innerHTML = '';
            myTasksTbody.innerHTML = '';
            myTasksSection.style.display = 'none';

            let faultDocs = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                data.id = doc.id;
                faultDocs.push(data);
                currentOpenFaults.push(data); // Aramak için kaydet
            });

            faultDocs.sort((a, b) => {
                const dateA = getTimestampMs(a.createdAt);
                const dateB = getTimestampMs(b.createdAt);
                return dateB - dateA;
            });

            const today = new Date();
            let todayCount = 0;
            let olderCount = 0;
            let myTaskCount = 0;
            
            let dateGroups = {}; // Tarihe ve ardından türe göre gruplamak için

            faultDocs.forEach(fault => {
                const dateObj = parseFaultDate(fault.createdAt);
                const isToday = dateObj && 
                                dateObj.getDate() === today.getDate() && 
                                dateObj.getMonth() === today.getMonth() && 
                                dateObj.getFullYear() === today.getFullYear();
                                
                // Tarihi ekranda göstermek için formatla
                const dateStr = dateObj ? dateObj.toLocaleString('tr-TR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : (fault.createdAt || "Tarih Yok");

                const assignedPerson = fault.assignedTo || "Atanmadı";
                const isMyTask = (loggedInOperator && fault.assignedTo === loggedInOperator.name);
                
                const cStatus = fault.status || "Açık";
                const isWorkInProgress = cStatus !== "Açık"; // Üzerinde çalışma varsa (Parça bekliyor, müdahale ediliyor vs.)
                const isCard = isToday || isWorkInProgress;

                // Arıza Türüne Göre Renk Belirleme Fonksiyonu
                let cardBg = "var(--surface-color)";
                let borderColor = "var(--primary)";
                let textColor = "var(--text-main)"; 
                let mutedColor = "var(--text-muted)";
                let isSolid = false;
                
                if (isCard || isMyTask) {
                    isSolid = true; // Kart olarak gösterilenler ve görevlerim için TAM RENK
                }
                
                if (fault.jobType) {
                    const t = fault.jobType.toLocaleLowerCase('tr-TR');
                    if (t.includes('mekanik')) { 
                        cardBg = isSolid ? "#00FFFF" : "rgba(0, 255, 255, 0.15)"; 
                        borderColor = "#00FFFF"; 
                        if(isSolid) { textColor = "#000000"; mutedColor = "#333333"; }
                    }
                    else if (t.includes('elektrik')) { 
                        cardBg = isSolid ? "#FFFF00" : "rgba(255, 255, 0, 0.15)"; 
                        borderColor = "#FFFF00"; 
                        if(isSolid) { textColor = "#000000"; mutedColor = "#333333"; }
                    }
                    else if (t.includes('iş güvenliği') || t.includes('is guvenligi')) { 
                        cardBg = isSolid ? "#FF0000" : "rgba(255, 0, 0, 0.15)"; 
                        borderColor = "#FF0000"; 
                        if(isSolid) { textColor = "#FFFFFF"; mutedColor = "#DDDDDD"; }
                    }
                    else if (t.includes('planlı bakım') || t.includes('planli bakim')) { 
                        cardBg = isSolid ? "#FFA500" : "rgba(255, 165, 0, 0.15)"; 
                        borderColor = "#FFA500"; 
                        if(isSolid) { textColor = "#000000"; mutedColor = "#333333"; }
                    }
                    else if (t.includes('tekrar eden')) { 
                        cardBg = isSolid ? "#FF00FF" : "rgba(255, 0, 255, 0.15)"; 
                        borderColor = "#FF00FF"; 
                        if(isSolid) { textColor = "#FFFFFF"; mutedColor = "#DDDDDD"; }
                    }
                }

                // Durum Etiketini Dinamik Yap
                let statusLabelHtml = `<div class="fault-status" style="color:${textColor}; font-weight:bold;">🔥 MÜDAHALE BEKLİYOR</div>`;
                if (cStatus === "Müdahale Ediliyor") {
                    statusLabelHtml = `<div class="fault-status" style="color:#000; background: ${cardBg !== 'var(--surface-color)' ? cardBg : '#3b82f6'}; padding:4px 8px; border-radius:4px; display:inline-block; font-weight:bold;">👨‍🔧 MÜDAHALE EDİLİYOR (${assignedPerson})</div>`;
                } else if (cStatus !== "Açık") {
                    statusLabelHtml = `<div class="fault-status" style="color:#000; background: ${cardBg !== 'var(--surface-color)' ? cardBg : '#f59e0b'}; padding:4px 8px; border-radius:4px; display:inline-block; font-weight:bold;">⏳ ${cStatus.toLocaleUpperCase('tr-TR')}</div>`;
                }

                // Yardımcılar HTML'si
                let helpersHtml = '';
                if (fault.helpers && fault.helpers.length > 0) {
                    helpersHtml = `<p class="fault-details" style="color:${textColor}; margin-top: 4px;"><strong>🤝 Yardımcılar:</strong> ${fault.helpers.join(', ')}</p>`;
                }

                // Ortak Kart HTML'si
                const cardHtml = `
                    <div class="fault-header">
                        <h3 class="machine-name" style="color:${textColor};">⚙️ ${fault.machine || "Bilinmeyen Makine"}</h3>
                        <span class="fault-date" style="color:${mutedColor};">${dateStr}</span>
                    </div>
                    <p class="fault-details" style="color:${textColor};"><strong>Vardiya:</strong> ${fault.shift || "-"}</p>
                    <p class="fault-details" style="color:${textColor};"><strong>Tür:</strong> <span style="font-weight:bold;">${fault.jobType || "-"}</span></p>
                    <p class="fault-details" style="color:${textColor};"><strong>Açıklama:</strong> ${fault.description || "Açıklama yok"}</p>
                    ${helpersHtml}
                    ${statusLabelHtml}
                `;

                if (isCard) {
                    todayCount++;
                    const card = document.createElement('div');
                    card.className = 'fault-card';
                    card.style.backgroundColor = cardBg;
                    if (!isSolid) card.style.borderLeftColor = borderColor;
                    if (isMyTask) card.style.border = `3px solid var(--text-main)`; 
                    card.onclick = () => handleFaultClick(fault);
                    card.innerHTML = cardHtml;
                    todayContainer.appendChild(card);
                }
                else if (isMyTask) { // Sadece bugünden öncekiler buraya düşer
                    myTaskCount++;
                    myTasksSection.style.display = 'block';
                    
                    const shortDateTime = dateObj ? dateObj.toLocaleString('tr-TR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : "-";

                    const tr = document.createElement('tr');
                    tr.style.backgroundColor = cardBg;
                    tr.style.color = textColor;
                    tr.style.borderLeft = `4px solid ${isSolid ? textColor : borderColor}`;
                    
                    tr.onclick = () => handleFaultClick(fault);
                    tr.innerHTML = `
                        <td data-label="Tarih" style="color: ${textColor}; font-weight: bold;">${shortDateTime}</td>
                        <td data-label="Vardiya" class="truncate-text" style="color: ${mutedColor};">${fault.shift || "-"}</td>
                        <td data-label="Makine" class="truncate-text" style="color: ${textColor};"><strong>${fault.machine || "Bilinmiyor"}</strong></td>
                        <td data-label="Tür" class="truncate-text" style="color: ${textColor}; font-weight: bold;">${fault.jobType || "-"}</td>
                        <td data-label="Açıklama" class="truncate-text" style="color: ${textColor};">${fault.description || "-"}</td>
                    `;
                    myTasksTbody.appendChild(tr);
                } else {
                    olderCount++;
                    // Eski arızaları ÖNCE TARİHE SONRA TÜRÜNE göre grupla
                    const dateObj = parseFaultDate(fault.createdAt);
                    const dateKey = dateObj ? dateObj.toLocaleString('tr-TR', { day:'2-digit', month:'2-digit', year:'numeric' }) : (fault.createdAt ? fault.createdAt.substring(0, 10) : "Belirsiz Tarih");
                    const typeKey = fault.jobType ? fault.jobType.toLocaleUpperCase('tr-TR') : "DİĞER / BELİRTİLMEYEN TÜR";
                    
                    if (!dateGroups[dateKey]) dateGroups[dateKey] = {};
                    if (!dateGroups[dateKey][typeKey]) dateGroups[dateKey][typeKey] = [];
                    
                    dateGroups[dateKey][typeKey].push(fault);
                }
            });

            // Gruplanmış eski arızaları ekrana bas
            for (const [dateKey, typesObj] of Object.entries(dateGroups)) {
                // Ana Tarih Başlığı
                const dateHeaderTr = document.createElement('tr');
                dateHeaderTr.innerHTML = `<td colspan="5" style="background: rgba(59, 130, 246, 0.4); color: white; font-weight: bold; text-align: center; padding: 0.6rem; font-size: 1.15rem; letter-spacing: 1px; border-bottom: 2px solid var(--primary);">📅 ${dateKey}</td>`;
                olderTbody.appendChild(dateHeaderTr);

                for (const [typeKey, groupFaults] of Object.entries(typesObj)) {
                    // Grubun başlık rengini belirle
                    let bg = "rgba(59, 130, 246, 0.1)";
                    let txtColor = "var(--primary)";
                    const t = typeKey.toLocaleLowerCase('tr-TR');
                    if (t.includes('mekanik')) { bg = "rgba(0, 255, 255, 0.1)"; txtColor = "#00FFFF"; }
                    else if (t.includes('elektrik')) { bg = "rgba(255, 255, 0, 0.1)"; txtColor = "#FFFF00"; }
                    else if (t.includes('iş güvenliği') || t.includes('is guvenligi')) { bg = "rgba(255, 0, 0, 0.1)"; txtColor = "#FF0000"; }
                    else if (t.includes('planlı bakım') || t.includes('planli bakim')) { bg = "rgba(255, 165, 0, 0.1)"; txtColor = "#FFA500"; }
                    else if (t.includes('tekrar eden')) { bg = "rgba(255, 0, 255, 0.1)"; txtColor = "#FF00FF"; }

                    // Alt Grup Başlığı (Örn: MEKANİK ARIZALAR)
                    const typeHeaderTr = document.createElement('tr');
                    typeHeaderTr.innerHTML = `<td colspan="5" style="background: ${bg}; color: ${txtColor}; font-weight: bold; text-align: left; padding: 0.4rem 1rem; border-left: 4px solid ${txtColor};">⚙️ ${typeKey}</td>`;
                    olderTbody.appendChild(typeHeaderTr);

                    // Gruptaki arızaları satır olarak ekle
                    groupFaults.forEach(fault => {
                        const dateObj = parseFaultDate(fault.createdAt);
                        const timeStr = dateObj ? dateObj.toLocaleString('tr-TR', { hour:'2-digit', minute:'2-digit' }) : "-";
                        const assignedPerson = fault.assignedTo || "Atanmadı";
                        
                        const tr = document.createElement('tr');
                        tr.style.backgroundColor = bg; 
                        tr.style.borderLeft = `4px solid ${txtColor}`;
                        tr.onclick = () => handleFaultClick(fault);
                        tr.innerHTML = `
                            <td data-label="Saat" style="color: var(--danger); font-weight: bold; text-align: center;">${timeStr}</td>
                            <td data-label="Vardiya" class="truncate-text" style="color: var(--text-muted);">${fault.shift || "-"}</td>
                            <td data-label="Makine" class="truncate-text"><strong>${fault.machine || "Bilinmiyor"}</strong></td>
                            <td data-label="Görevli" class="truncate-text" style="color: var(--warning); font-weight: bold;">${assignedPerson}</td>
                            <td data-label="Açıklama" class="truncate-text">${fault.description || "-"}</td>
                        `;
                        olderTbody.appendChild(tr);
                    });
                }
            }

            if (todayCount === 0) {
                todayContainer.innerHTML = '<p style="color:var(--text-muted); font-size:0.9rem;">Bugün açılmış acil bir arıza yok.</p>';
            }
            if (olderCount === 0) {
                olderTbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">Önceki günlerden kalan arıza yok.</td></tr>';
            }

        }, (error) => {
            console.error("Firebase dinleme hatası:", error);
            todayContainer.innerHTML = '<p style="text-align: center; color: var(--danger);">Arızalar yüklenirken hata oluştu!</p>';
        });
}

function parseFaultDate(createdAt) {
    if (!createdAt) return null;
    // Eğer Firebase Timestamp objesi ise toDate() metodu vardır
    if (typeof createdAt.toDate === 'function') {
        return createdAt.toDate();
    }
    // Değilse String'dir
    const d = new Date(createdAt);
    if (!isNaN(d.getTime())) return d;
    return null;
}

function getTimestampMs(createdAt) {
    const d = parseFaultDate(createdAt);
    return d ? d.getTime() : 0;
}

// --- QR VE MÜDAHALE SİSTEMİ EKLENTİSİ ---

let html5QrCode = null;
let activeInterventionFaultId = null;

// Tıklanan tüm arızalar bu fonksiyonu tetikler, ID önemsizdir!
function startQROnlyCamera() {
    document.getElementById('qr-modal').style.display = 'flex';
    
    html5QrCode = new Html5Qrcode("qr-reader");
    
    // Tarayıcı Ayarları (Yüksek fps ve geniş kutu)
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    // "environment" = Arka Canlı Kamera Zorunlu (Galeri Yok!)
    html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess)
    .catch(err => {
        alert("Kamera başlatılamadı! Tarayıcınızın kameraya erişim izni verdiğinden emin olun.");
        closeQRModal();
    });
}

function closeQRModal() {
    document.getElementById('qr-modal').style.display = 'none';
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            html5QrCode.clear();
        }).catch(err => console.error("Kamera durdurma hatası:", err));
    }
}

// Karekod başarılı okunduğunda
function onScanSuccess(decodedText) {
    // 1. Hemen kamerayı kapat
    closeQRModal();
    
    // 2. Taranan metni işle (AppSheet ID veya Direkt İsim)
    let scannedText = decodedText.trim();
    let machineNameForSearch = scannedText.toLocaleUpperCase('tr-TR');
    let isAppSheetLink = false;
    let extractedId = "";

    // Eğer karekod AppSheet linki ise içindeki "row=" kısmını bul
    if (scannedText.includes('appsheet.com') && scannedText.includes('row=')) {
        isAppSheetLink = true;
        const urlParams = new URLSearchParams(scannedText.split('#')[1] || scannedText.split('?')[1]);
        extractedId = urlParams.get('row');
        
        if (extractedId && machineDictionary[extractedId]) {
            // Sözlükten makine adını bulduk!
            machineNameForSearch = machineDictionary[extractedId].toLocaleUpperCase('tr-TR');
            console.log(`Eşleşme Bulundu: ${extractedId} -> ${machineNameForSearch}`);
        } else {
            // Sözlükte bu ID yok
            alert(`❌ Hata: Bu makinenin ID'si (${extractedId}) sistemin sözlüğünde bulunamadı!\n\nLütfen sağ üstteki 'Ayarlar ⚙️' menüsünden makine listesini güncelleyin.`);
            return;
        }
    }
    
    // 3. Hafızadaki mevcut AÇIK arızaların içinde makineyi ara
    const matchedFaults = currentOpenFaults.filter(f => {
        if (!f.machine) return false;
        const dbMachine = f.machine.trim().toLocaleUpperCase('tr-TR');
        return machineNameForSearch.includes(dbMachine) || machineNameForSearch === dbMachine;
    });
    
    // 4. Sonuç değerlendirmesi
    if (matchedFaults.length >= 1) {
        // Yardımcı ol butonlarını da gösterebilmek için tek arıza da olsa bu ekranı açıyoruz
        openFaultSelectionModal(matchedFaults);
    } else {
        // Hiç arıza yoksa hata ver
        if (isAppSheetLink) {
            alert(`❌ Hata: Bu makinede açık bir arıza bulunamadı!\n\nBulunan Makine: "${machineNameForSearch}"\n\nSistem bu makineye ait açık bir arıza bulamadı. Lütfen listedeki makine adıyla eşleştiğinden emin olun.`);
        } else {
            alert(`❌ Hata: Bu makinede açık bir arıza bulunamadı!\n\nKameranın Okuduğu QR Metni: "${scannedText}"\n\nSistem okunan bu kodun içinde açık arızası olan bir makine adı bulamadı.`);
        }
    }
}

// --- BİRDEN FAZLA ARIZA SEÇİM MODALI ---
function openFaultSelectionModal(faults) {
    const modal = document.getElementById('fault-selection-modal');
    const container = document.getElementById('multiple-faults-container');
    const machineNameEl = document.getElementById('fault-selection-machine-name');
    
    // Konteyneri temizle
    container.innerHTML = '';
    
    // Makine ismini SADECE en üste 1 kere yazdır
    if (faults.length > 0) {
        machineNameEl.innerHTML = `🏭 ${faults[0].machine || 'Bilinmeyen Makine'}`;
    }
    
    // Her bir arıza için bir seçim butonu/kartı oluştur
    faults.forEach(fault => {
        // Arıza Türüne Göre Renk Belirleme (Ana paneldekiyle aynı renkler)
        let bg = "rgba(255,255,255,0.05)";
        let txtColor = "var(--primary)";
        let badgeColor = "var(--primary)";
        
        if (fault.jobType) {
            const t = fault.jobType.toLocaleLowerCase('tr-TR');
            if (t.includes('mekanik')) { bg = "rgba(0, 255, 255, 0.1)"; txtColor = "#00FFFF"; badgeColor = "#00FFFF"; }
            else if (t.includes('elektrik')) { bg = "rgba(255, 255, 0, 0.1)"; txtColor = "#FFFF00"; badgeColor = "#FFFF00"; }
            else if (t.includes('iş güvenliği') || t.includes('is guvenligi')) { bg = "rgba(255, 0, 0, 0.1)"; txtColor = "#FF0000"; badgeColor = "#FF0000"; }
            else if (t.includes('planlı bakım') || t.includes('planli bakim')) { bg = "rgba(255, 165, 0, 0.1)"; txtColor = "#FFA500"; badgeColor = "#FFA500"; }
            else if (t.includes('tekrar eden')) { bg = "rgba(255, 0, 255, 0.1)"; txtColor = "#FF00FF"; badgeColor = "#FF00FF"; }
        }
        
        const div = document.createElement('div');
        div.style.background = bg;
        div.style.border = `1px solid ${txtColor}`;
        div.style.borderLeft = `4px solid ${txtColor}`;
        div.style.borderRadius = '8px';
        div.style.padding = '12px';
        
        // İçerik: Arıza Türü (jobType), Açıklama, Açan Kişi, Tarih
        const jobTypeDisplay = fault.jobType || fault.faultType || "Belirtilmemiş";
        const typeHtml = `<div style="color: ${txtColor}; font-size: 1rem; margin-bottom: 6px; font-weight: bold; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px;">🛠️ Tür: ${jobTypeDisplay}</div>`;
        const descHtml = fault.description ? `<div style="color: #cbd5e1; font-size: 0.95rem; margin-bottom: 6px;"><strong>📝 Açıklama:</strong> ${fault.description}</div>` : (fault.faultDescription ? `<div style="color: #cbd5e1; font-size: 0.95rem; margin-bottom: 6px;"><strong>📝 Açıklama:</strong> ${fault.faultDescription}</div>` : '');
        const reporterHtml = fault.assignedTo ? `<div style="color: #94a3b8; font-size: 0.85rem; margin-bottom: 4px;">👤 <strong>Görevli:</strong> ${fault.assignedTo}</div>` : '';
        const helpersModalHtml = (fault.helpers && fault.helpers.length > 0) ? `<div style="color: #94a3b8; font-size: 0.85rem; margin-bottom: 4px;">🤝 <strong>Yardımcılar:</strong> ${fault.helpers.join(', ')}</div>` : '';
        
        // Tarihi güvenli bir şekilde dönüştür (Invalid Date hatasını önlemek için)
        const dateObj = parseFaultDate(fault.createdAt || fault.faultDate);
        const dateStr = dateObj ? dateObj.toLocaleString('tr-TR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : (fault.createdAt || fault.faultDate || "Bilinmeyen Tarih");
        const dateHtml = `<div style="color: #64748b; font-size: 0.8rem; margin-top: 2px;">🗓️ <strong>Tarih:</strong> ${dateStr}</div>`;
        
        // --- DINAMIK BUTON MANTIĞI ---
        let actionButtonsHtml = '';
        const currentStatus = fault.status || "Açık";
        
        if (!fault.assignedTo) {
            // Hiç kimse işe başlamamış veya arıza parça/dış servis beklemeye düşmüş
            let startBtnText = "🚀 Çalışmaya Başla";
            if (currentStatus === "Parça Bekliyor") startBtnText = "📦 Parça Geldi / İşi Devral";
            else if (currentStatus === "Dış Servis Bekliyor") startBtnText = "🚐 Dış Servis Geldi / İşe Başla";
            else if (currentStatus !== "Açık") startBtnText = "🚀 İşi Devral (" + currentStatus + ")";

            actionButtonsHtml = `<button onclick='startWork("${fault.id}")' style="background: var(--primary); color: #000; padding: 6px 12px; border: none; border-radius: 4px; font-size: 0.85rem; font-weight: bold; cursor: pointer; width: 100%;">${startBtnText}</button>`;
        } else {
            // Arıza aktif durumda (Müdahale Ediliyor)
            if (fault.assignedTo === loggedInOperator.name) {
                // Ana görevli kendisi
                actionButtonsHtml = `<button onclick='startMainIntervention("${fault.id}")' style="background: ${badgeColor}; color: #000; padding: 6px 12px; border: none; border-radius: 4px; font-size: 0.85rem; font-weight: bold; cursor: pointer; width: 100%;">📝 Müdahaleyi Bitir / Güncelle</button>`;
            } else {
                // Ana görevli başkası
                const isHelper = fault.helpers && fault.helpers.includes(loggedInOperator.name);
                
                if (isHelper) {
                    // Zaten yardımcı
                    actionButtonsHtml = `<button onclick='leaveHelper("${fault.id}")' style="background: rgba(239, 68, 68, 0.2); color: #ef4444; padding: 6px 12px; border: 1px solid #ef4444; border-radius: 4px; font-size: 0.85rem; font-weight: bold; cursor: pointer; width: 100%;">👋 Bakımdan Ayrıl</button>`;
                } else {
                    // Henüz katılmamış
                    actionButtonsHtml = `<button onclick='joinAsHelper("${fault.id}")' style="background: rgba(255,255,255,0.1); color: white; padding: 6px 12px; border: 1px solid rgba(255,255,255,0.3); border-radius: 4px; font-size: 0.85rem; font-weight: bold; cursor: pointer; width: 100%;">🤝 Yardımcı Olarak Katıl</button>`;
                }
            }
        }
        
        div.innerHTML = `
            ${typeHtml}
            ${descHtml}
            ${reporterHtml}
            ${helpersModalHtml}
            ${dateHtml}
            <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px;">
                ${actionButtonsHtml}
            </div>
        `;
        
        container.appendChild(div);
    });
    
    modal.style.display = 'flex';
}

function closeFaultSelectionModal() {
    document.getElementById('fault-selection-modal').style.display = 'none';
}

// Yeni: İşi üzerine alıp çalışmaya başlar
function startWork(faultId) {
    if (!loggedInOperator) return;
    
    Swal.fire({
        title: 'Müdahaleye Başla',
        text: 'Bu arızaya ana görevli olarak müdahale etmeye başlamak istiyor musunuz?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#ef4444',
        confirmButtonText: 'Evet, Başla',
        cancelButtonText: 'Vazgeç',
        background: '#1e293b',
        color: '#f8fafc'
    }).then((result) => {
        if (!result.isConfirmed) return;
        
        // Butonu bul (Tıklanan elementi bulmak asenkron işlemden sonra zor olabilir, bu yüzden id ile veya genel olarak yükleniyor diyebiliriz)
        // Ancak işi basitleştirmek için genel bir SweetAlert loading gösterebiliriz
        Swal.fire({
            title: 'Başlatılıyor...',
            allowOutsideClick: false,
            background: '#1e293b',
            color: '#f8fafc',
            didOpen: () => {
                Swal.showLoading();
            }
        });

        db.collection('arizalar').doc(faultId).update({
            status: "Müdahale Ediliyor",
            assignedTo: loggedInOperator.name,
            startedAt: new Date().toISOString()
        }).then(() => {
            alert("🚀 Çalışma başarıyla başlatıldı! Kolay gelsin.");
            closeFaultSelectionModal();
        }).catch(err => {
            alert("Hata oluştu: " + err.message);
        });
    });
}

// Seçim ekranından ana müdahale formunu başlatır
function startMainIntervention(faultId) {
    const fault = currentOpenFaults.find(f => f.id === faultId);
    if (fault) {
        closeFaultSelectionModal();
        openInterventionForm(fault);
    }
}

// Yardımcı bakımcı olarak veritabanına kendini ekler
function joinAsHelper(faultId) {
    if (!loggedInOperator) return;
    
    const fault = currentOpenFaults.find(f => f.id === faultId);
    if (!fault) return;
    
    // Eğer kişi zaten kendi başlattığı bir arızaysa
    if (fault.assignedTo === loggedInOperator.name || fault.completedBy === loggedInOperator.name) {
        alert("⚠️ Siz zaten bu arızanın ana sorumlususunuz. Formu açmak için 'Müdahale Et' butonunu kullanın.");
        return;
    }
    
    // Eğer kişi zaten yardımcılarda ekliyse
    if (fault.helpers && fault.helpers.includes(loggedInOperator.name)) {
        alert("✅ Siz zaten bu arızanın kayıtlarında yardımcı olarak bulunuyorsunuz.");
        return;
    }

    // Yardımcı eklenmesini onayla
    Swal.fire({
        title: 'Yardımcı Olarak Katıl',
        text: 'Bu arızaya yardımcı bakımcı olarak katılmak istiyor musunuz? (Kayıtlarınıza eklenecektir.)',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#3b82f6',
        cancelButtonColor: '#ef4444',
        confirmButtonText: 'Evet, Katıl',
        cancelButtonText: 'Vazgeç',
        background: '#1e293b',
        color: '#f8fafc'
    }).then((result) => {
        if (!result.isConfirmed) return;
        
        Swal.fire({
            title: 'Katılınıyor...',
            allowOutsideClick: false,
            background: '#1e293b',
            color: '#f8fafc',
            didOpen: () => {
                Swal.showLoading();
            }
        });

        const joinLog = {
            operator: loggedInOperator.name,
            helpers: [],
            durationMin: 0,
            actionTaken: "Yardıma katıldı",
            status: "Yardımcı",
            timestamp: new Date().toISOString()
        };

        db.collection('arizalar').doc(faultId).update({
            helpers: firebase.firestore.FieldValue.arrayUnion(loggedInOperator.name),
            interventions: firebase.firestore.FieldValue.arrayUnion(joinLog)
        }).then(() => {
            alert("✅ Başarıyla arızaya yardımcı olarak katıldınız!");
            closeFaultSelectionModal();
        }).catch(err => {
            alert("Hata oluştu: " + err.message);
        });
    });
}

// Yeni: Yardımcı bakımcının işten ayrılması
function leaveHelper(faultId) {
    if (!loggedInOperator) return;
    
    Swal.fire({
        title: 'Görevden Ayrıl',
        text: 'Bu arızadaki görevinizi (yardımcı bakımcı) sonlandırıp ayrılmak istiyor musunuz?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#f59e0b',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Evet, Ayrıl',
        cancelButtonText: 'İptal',
        background: '#1e293b',
        color: '#f8fafc'
    }).then((result) => {
        if (!result.isConfirmed) return;

        Swal.fire({
            title: 'Ayrılıyorsunuz...',
            allowOutsideClick: false,
            background: '#1e293b',
            color: '#f8fafc',
            didOpen: () => {
                Swal.showLoading();
            }
        });

        const fault = currentOpenFaults.find(f => f.id === faultId);
        let durationMin = 0;
        if (fault && fault.interventions) {
            // Find the LAST time this operator joined
            const userLogs = fault.interventions.filter(i => i.operator === loggedInOperator.name && i.actionTaken === "Yardıma katıldı");
            if (userLogs.length > 0) {
                const lastJoin = userLogs[userLogs.length - 1];
                const startTime = new Date(lastJoin.timestamp).getTime();
                const endTime = new Date().getTime();
                durationMin = Math.max(1, Math.round((endTime - startTime) / 60000));
            }
        }

        const leaveLog = {
            operator: loggedInOperator.name,
            helpers: [],
            durationMin: durationMin,
            actionTaken: "Yardımdan ayrıldı",
            status: "Yardımcı",
            timestamp: new Date().toISOString()
        };

        db.collection('arizalar').doc(faultId).update({
            helpers: firebase.firestore.FieldValue.arrayRemove(loggedInOperator.name),
            interventions: firebase.firestore.FieldValue.arrayUnion(leaveLog)
        }).then(() => {
            alert("👋 Arızadan başarıyla ayrıldınız. Emeğinize sağlık!");
            closeFaultSelectionModal();
        }).catch(err => {
            alert("Hata oluştu: " + err.message);
        });
    });
}

function openInterventionForm(fault) {
    activeInterventionFaultId = fault.id;
    
    // Formu temizle ve makine adını yaz
    document.getElementById('modal-machine-name').innerText = fault.machine || "Bilinmiyor";
    document.getElementById('modal-action-taken').value = fault.actionTaken || '';
    document.getElementById('modal-parts-changed').value = fault.partsChanged !== '-' ? (fault.partsChanged || '') : '';
    
    // Radyo butonunu mevcut duruma getir (Yoksa Kapalı)
    const statusRadios = document.getElementsByName('faultStatus');
    const currentStatus = fault.status === "Açık" || fault.status === "Müdahale Ediliyor" ? "Kapalı" : fault.status;
    
    const toggleReasons = () => {
        let isKapali = false;
        for (let r of statusRadios) {
            if (r.checked && r.value === 'Kapalı') isKapali = true;
        }
        document.getElementById('reasons-container').style.display = isKapali ? 'block' : 'none';
    };

    for (let r of statusRadios) {
        if (r.value === currentStatus) r.checked = true;
        r.onchange = toggleReasons;
    }
    toggleReasons();

    // Seçim listelerini doldur
    const faultReasonSelect = document.getElementById('modal-fault-reason');
    const stoppageReasonSelect = document.getElementById('modal-stoppage-reason');
    
    faultReasonSelect.innerHTML = '<option value="">Seçiniz...</option>';
    faultReasonsList.forEach(r => {
        faultReasonSelect.innerHTML += `<option value="${r}">${r}</option>`;
    });
    
    stoppageReasonSelect.innerHTML = '<option value="">Seçiniz...</option>';
    stoppageReasonsList.forEach(r => {
        stoppageReasonSelect.innerHTML += `<option value="${r}">${r}</option>`;
    });
    
    // (Elle yardımcı seçme listesi, sadece QR ile katılım sağlandığı için kaldırıldı)
    
    document.getElementById('fault-modal').style.display = 'flex';
}

function closeFaultModal() {
    document.getElementById('fault-modal').style.display = 'none';
    activeInterventionFaultId = null;
}

// Firebase Güncellemesi (Müdahaleyi Kaydet)
function saveIntervention() {
    if (!activeInterventionFaultId) return;
    
    const actionTaken = document.getElementById('modal-action-taken').value.trim();
    const partsChanged = document.getElementById('modal-parts-changed').value.trim();
    
    // Seçilen Durumu (Status) Al
    let selectedStatus = 'Kapalı';
    const statusRadios = document.getElementsByName('faultStatus');
    for (let r of statusRadios) {
        if (r.checked) {
            selectedStatus = r.value;
            break;
        }
    }
    
    // Yeni eklenen alanlar
    const faultReason = document.getElementById('modal-fault-reason').value;
    const stoppageReason = document.getElementById('modal-stoppage-reason').value;
    
    // Açıklama alanı ve yeni listeler sadece "Kapalı" durumu için zorunlu olsun
    if (selectedStatus === 'Kapalı') {
        if (!actionTaken) {
            alert("⚠️ Lütfen 'Yapılan İşlem / Detaylar' alanını doldurun! Arızayı kapatmak için bu alan zorunludur.");
            return;
        }
        // Eğer E-Tablo'dan veri gelmişse seçim zorunlu olsun (henüz eklenmemişse hata vermesin)
        if (faultReasonsList.length > 0 && !faultReason) {
            alert("⚠️ Lütfen 'Arıza Nedeni' seçin!");
            return;
        }
        if (stoppageReasonsList.length > 0 && !stoppageReason) {
            alert("⚠️ Lütfen 'Duruş Nedeni' seçin!");
            return;
        }
    }
    
    // İlgili arızayı hafızadan bul (Log ve süre hesabı için)
    const fault = currentOpenFaults.find(f => f.id === activeInterventionFaultId);
    
    // Butonu pasife alıp çifte tıklamayı önleyelim
    const saveBtn = document.getElementById('btn-save-intervention');
    const originalBtnText = saveBtn.innerText;
    saveBtn.innerText = 'Kaydediliyor...';
    saveBtn.disabled = true;
    
    // Çalışma Süresini Hesapla (Dakika)
    let durationMin = 0;
    if (fault && fault.startedAt) {
        const startTime = new Date(fault.startedAt).getTime();
        const endTime = new Date().getTime();
        durationMin = Math.max(1, Math.round((endTime - startTime) / 60000));
    }
    
    // Yardımcıların Loglarını Ayrı Ayrı Oluştur
    let helperLogs = [];
    if (fault && fault.helpers && fault.helpers.length > 0) {
        fault.helpers.forEach(helperName => {
            let hDuration = 0;
            if (fault.interventions) {
                const userLogs = fault.interventions.filter(i => i.operator === helperName && i.actionTaken === "Yardıma katıldı");
                if (userLogs.length > 0) {
                    const lastJoin = userLogs[userLogs.length - 1];
                    const startTime = new Date(lastJoin.timestamp).getTime();
                    const endTime = new Date().getTime();
                    hDuration = Math.max(1, Math.round((endTime - startTime) / 60000));
                }
            }
            
            helperLogs.push({
                operator: helperName,
                helpers: [],
                durationMin: hDuration,
                actionTaken: selectedStatus === 'Kapalı' ? "Arıza ile birlikte yardımı tamamladı" : "Durum değişti, yardımdan ayrıldı",
                status: selectedStatus,
                timestamp: new Date().toISOString()
            });
        });
    }

    // Ana Operatörün Log Kaydını Oluştur (Artık helpers array'i boş, çünkü herkesin kendi logu var)
    const logEntry = {
        operator: loggedInOperator.name,
        helpers: [], 
        durationMin: durationMin,
        actionTaken: actionTaken,
        status: selectedStatus,
        timestamp: new Date().toISOString()
    };
    
    // Tüm logları birleştir
    const allNewLogs = [logEntry, ...helperLogs];
    
    const faultRef = db.collection('arizalar').doc(activeInterventionFaultId);
    
    // Duruma göre güncellenecek alanları belirle
    let updateData = {
        status: selectedStatus,
        actionTaken: actionTaken,
        partsChanged: partsChanged || "-"
    };
    
    if (selectedStatus === 'Kapalı') {
        updateData.completedAt = new Date().toISOString();
        updateData.completedBy = loggedInOperator.name;
        updateData.faultReason = faultReason;
        updateData.stoppageReason = stoppageReason;
    } else {
        // Parça Bekliyor, Devredildi veya Geçici Çözüm ise Görevlileri Temizle (Havuz Düşsün)
        updateData.assignedTo = firebase.firestore.FieldValue.delete();
        updateData.startedAt = firebase.firestore.FieldValue.delete();
        updateData.helpers = [];
        updateData.lastInterventionAt = new Date().toISOString();
        updateData.lastInterventionBy = loggedInOperator.name;
    }
    
    // Firestore'da arrayUnion tek tek eleman aldığı için ...allNewLogs yapıyoruz
    updateData.interventions = firebase.firestore.FieldValue.arrayUnion(...allNewLogs);

    faultRef.update(updateData).then(() => {
        alert(`✅ Arıza müdahalesi başarıyla sisteme kaydedildi! \n\nYeni Durum: ${selectedStatus}`);
        closeFaultModal();
    }).catch(error => {
        alert("Hata oluştu: " + error.message);
    }).finally(() => {
        saveBtn.innerText = originalBtnText;
        saveBtn.disabled = false;
    });
}

// Dashboard (Aktif İşler) Ekranına Geçiş
function showDashboard() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('dashboard-screen').style.display = 'block';
    
    // Bildirim izni iste
    requestNotificationPermission();

    // Açık arızaları getirmeyi (dinlemeyi) başlat
    fetchOpenFaults();
    
    // Aynı zamanda arka planda Excel'den Makine ID Sözlüğünü güncelle (Sessizce)
    updateMachineList();
    
    // Yükleme barı simülasyonu (100'den 0'a)
    const progContainer = document.getElementById('update-progress-container');
    const progBar = document.getElementById('update-progress-bar');
    if (progContainer && progBar) {
        // İçindeki yazıyı güncelleyelim
        const textDiv = progContainer.querySelector('div');
        if (textDiv) textDiv.innerText = "Açık Arızalar ve Makine Sözlüğü Güncelleniyor...";
        
        progContainer.style.display = 'block';
        progBar.style.width = '100%';
        let width = 100;
        const interval = setInterval(() => {
            width -= 5;
            progBar.style.width = width + '%';
            if (width <= 0) {
                clearInterval(interval);
                setTimeout(() => { progContainer.style.display = 'none'; }, 200);
            }
        }, 75); // 75 * 20 = 1.5 saniye sürer
    }
    // Arka planda eksik senkronizasyon var mı kontrol et (Yönetici yokken operatör tetikler)
    triggerSilentDailyExport();
    
    document.getElementById('user-info').innerText = `👤 Hoş Geldin, ${shortName(loggedInOperator.name)}`;
    document.getElementById('user-info').style.color = "var(--success)";
    
    // Profil resmini göster
    const picEl = document.getElementById('op-profile-pic');
    if (loggedInOperator.imageUrl) {
        let directUrl = loggedInOperator.imageUrl;
        const driveMatch = directUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (driveMatch && driveMatch[1]) {
            // Google Drive resimlerini göstermek için daha güvenilir olan thumbnail yöntemini kullanıyoruz
            directUrl = `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=w500`;
        }
        picEl.src = directUrl;
        picEl.style.display = 'block';
    } else {
        picEl.style.display = 'none';
    }

    // ADMIN KONTROLÜ - Eğer Yetkisi Admin veya Yönetici ise
    // Türkçe karakter sorununu çözmek için toLocaleLowerCase kullanıyoruz
    const role = (loggedInOperator.role || "").toLocaleLowerCase('tr-TR');
    
    const oldAdminBtn = document.getElementById('btn-sync');
    if (oldAdminBtn) oldAdminBtn.remove();

    if (role.includes('admin') || role.includes('admın') || role.includes('yönetici') || role.includes('yonetici')) {
        const syncBtn = document.createElement('button');
        syncBtn.id = 'btn-sync';
        syncBtn.innerText = "⚙️ Admin Paneline Giriş";
        syncBtn.className = "btn-scan";
        syncBtn.style.background = "linear-gradient(135deg, #10b981, #047857)";
        syncBtn.style.marginBottom = "10px";
        syncBtn.onclick = () => { window.location.href = 'admin.html'; };
        
        // Barkod okut butonunun hemen üstüne ekleyelim
        const dashScreen = document.getElementById('dashboard-screen');
        dashScreen.insertBefore(syncBtn, dashScreen.firstChild);
    }
}

// Oturumu Kapat
function logout() {
    localStorage.removeItem("loggedInOperator");
    loggedInOperator = null;
    document.getElementById('pinCode').value = '';
    
    document.getElementById('user-info').innerText = "Lütfen PIN Kodunuzu Girin";
    document.getElementById('user-info').style.color = "var(--text-muted)";
    document.getElementById('op-profile-pic').style.display = 'none';
    
    const logoutBtn = document.getElementById('btn-logout-header');
    if (logoutBtn) logoutBtn.remove();
    
    document.getElementById('dashboard-screen').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
}

function startScanner() {
    alert("Barkod Okuyucu Kamera Açılıyor...");
}

// ----------------------------------------------------
// ARKA PLAN SESSİZ AKTARIM (OPERATÖRLER İÇİN)
// ----------------------------------------------------
async function triggerSilentDailyExport() {
    const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzi0x_x4E31eY5T8V6J1V2QW35q3cI7KjXN0p-0V-mQ40gB9Jt38_z4H5bH8t4P7V0e/exec";
    const now = new Date();
    const today = now.toLocaleDateString('tr-TR');
    
    try {
        const configRef = db.collection('settings').doc('config');
        const configSnap = await configRef.get();
        if (configSnap.exists) {
            const data = configSnap.data();
            if (data.lastGlobalExportDate === today) {
                return; // Bugün zaten aktarım yapılmış.
            }
        }
        
        // Kilidi kapat ki aynı anda 5 kişi girerse 5 kere export etmesin
        await configRef.set({ lastGlobalExportDate: today }, { merge: true });
        
        const snapshot = await db.collection('arizalar').where('status', '==', 'Kapalı').get();
        let docIdsToDelete = [];
        snapshot.forEach(doc => docIdsToDelete.push(doc.id));

        if (docIdsToDelete.length === 0) return;

        let exportData = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            let bakimLogu = "Kayıt Yok";
            if (data.interventions && Array.isArray(data.interventions) && data.interventions.length > 0) {
                bakimLogu = data.interventions
                    .filter(inv => inv.actionTaken !== "Yardıma katıldı")
                    .map(inv => {
                    let mainOp = (inv.operator || "Bilinmeyen").toUpperCase();
                    let helperText = "";
                    if (inv.helpers && Array.isArray(inv.helpers)) {
                        let validHelpers = inv.helpers.filter(h => h && h !== inv.operator);
                        if (validHelpers.length > 0) helperText = ` (Yrd: ${validHelpers.join(", ").toUpperCase()})`;
                    }
                    let opName = mainOp + helperText;
                    let d = inv.durationMin || 0;
                    let actionStr = "";
                    if (inv.actionTaken === "Yardıma katıldı") actionStr = "YARDIMA KATILDI";
                    else if (inv.actionTaken === "Arıza ile birlikte yardımı tamamladı") actionStr = "YARDIMI TAMAMLADI";
                    else if (inv.actionTaken === "Durum değişti, yardımdan ayrıldı" || inv.actionTaken === "Yardımdan ayrıldı") actionStr = "YARDIMDAN AYRILDI";
                    else {
                        if (inv.status === 'Kapalı') actionStr = "ARIZAYI KAPATTI";
                        else if (inv.status === 'Parça Bekliyor') actionStr = "PARÇA BEKLİYOR";
                        else if (inv.status === 'Dış Servis Bekliyor') actionStr = "DIŞ SERVİS BEKLİYOR";
                        else if (inv.status === 'Geçici Çözüm') actionStr = "GEÇİCİ ÇÖZÜM UYGULADI";
                        else if (inv.status === 'Devredildi') actionStr = "VARDİYAYA DEVRETTİ";
                        else if (inv.actionTaken) actionStr = inv.actionTaken.toUpperCase();
                        else actionStr = "MÜDAHALE ETTİ";
                    }
                    return `${opName} ${actionStr} ( ${d} dk )`;
                }).join("\n");
            } else {
                let logArr = [];
                if (data.completedBy) logArr.push(data.completedBy);
                if (data.helpers && Array.isArray(data.helpers)) {
                    data.helpers.forEach(h => { if (h !== data.completedBy) logArr.push(h); });
                }
                bakimLogu = logArr.join(", ");
            }

            let bitTarih = ""; let bitSaat = "";
            if (data.completedAt) {
                let d = new Date(data.completedAt);
                bitTarih = d.toLocaleDateString('tr-TR');
                bitSaat = d.toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'});
            }

            let basTarih = data.createdAt || "";
            let basSaat = "";
            let startObj = null;
            if (data.createdAt) {
                if (typeof data.createdAt.toDate === 'function') startObj = data.createdAt.toDate();
                else if (data.createdAt.seconds) startObj = new Date(data.createdAt.seconds * 1000);
                else startObj = new Date(data.createdAt);
                
                if (startObj && !isNaN(startObj.getTime())) {
                    basTarih = startObj.toLocaleDateString('tr-TR');
                    basSaat = startObj.toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'});
                }
            }

            let endObj = data.completedAt ? new Date(data.completedAt) : null;
            let totalStoppageMin = 0;
            if (startObj && endObj && !isNaN(startObj.getTime()) && !isNaN(endObj.getTime())) {
                totalStoppageMin = Math.max(0, Math.round((endObj - startObj) / 60000));
            }

            let startEndHours = "";
            if (basSaat && bitSaat) {
                startEndHours = `${basSaat} - ${bitSaat}`;
            } else if (bitSaat) {
                startEndHours = bitSaat;
            }

            let basTarihVeSaat = basTarih;
            if (basSaat) {
                basTarihVeSaat = basTarih + " " + basSaat;
            }

            exportData.push([
                basTarihVeSaat, data.userName || "", data.costCenter || "", data.machine || "", data.shift || "",
                data.jobType || "", data.description || "", data.photoUrl ? "Var" : "Yok", bakimLogu, bitTarih, startEndHours,
                totalStoppageMin + " dk", data.stoppageReason || "", data.faultReason || "", data.actionTaken || "", data.partsChanged || ""
            ]);
        });

        const payload = { action: "exportClosedFaults", data: exportData };
        const response = await fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) });
        const result = await response.json();
        
        if (result.success) {
            const batch = db.batch();
            docIdsToDelete.forEach(id => batch.delete(db.collection('arizalar').doc(id)));
            await batch.commit();
            console.log(`✅ Arka plan aktarımı başarılı: ${docIdsToDelete.length} adet.`);
        } else {
            // Başarısız olursa kilidi aç
            await configRef.set({ lastGlobalExportDate: "" }, { merge: true });
        }
    } catch(err) {
        console.error("Sessiz günlük aktarım hatası:", err);
    }
}

// ----------------------------------------------------
// BUGÜN KAPATILAN İŞLER LİSTESİ (SİSTEM MENÜSÜ MODALI)
// ----------------------------------------------------
function openClosedTodayModal() {
    const modal = document.getElementById('closed-today-modal');
    const listContainer = document.getElementById('closed-today-list');
    const loadingText = document.getElementById('closed-today-loading');
    
    modal.style.display = 'flex';
    listContainer.innerHTML = '';
    loadingText.style.display = 'block';

    const todayStr = new Date().toLocaleDateString('tr-TR');

    db.collection('arizalar')
        .where('status', '==', 'Kapalı')
        .get()
        .then(snapshot => {
            let closedTodayFaults = [];
            let myClosedJobsCount = 0;
            let myTotalMinutes = 0;
            
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.completedAt) {
                    const compDateObj = new Date(data.completedAt);
                    if (!isNaN(compDateObj.getTime())) {
                        const compStr = compDateObj.toLocaleDateString('tr-TR');
                        if (compStr === todayStr) {
                            closedTodayFaults.push({ id: doc.id, ...data, compDateObj });

                            // Operatörün kendi istatistiklerini hesapla
                            if (loggedInOperator) {
                                if (data.completedBy === loggedInOperator.name) {
                                    myClosedJobsCount++;
                                }
                                if (data.interventions) {
                                    data.interventions.forEach(log => {
                                        if (log.operator === loggedInOperator.name && log.durationMin) {
                                            myTotalMinutes += parseInt(log.durationMin) || 0;
                                        }
                                    });
                                }
                            }
                        }
                    }
                }
            });

            loadingText.style.display = 'none';

            // Kendi özetimi en üste ekle
            if (loggedInOperator) {
                const summaryCard = document.createElement('div');
                summaryCard.style.background = 'linear-gradient(135deg, #1e293b, #0f172a)';
                summaryCard.style.border = '1px solid var(--primary)';
                summaryCard.style.borderRadius = '8px';
                summaryCard.style.padding = '15px';
                summaryCard.style.marginBottom = '20px';
                summaryCard.style.textAlign = 'center';
                summaryCard.innerHTML = `
                    <h4 style="margin: 0 0 10px 0; color: var(--primary);">👤 Günlük Özetiniz (${shortName(loggedInOperator.name)})</h4>
                    <div style="display: flex; justify-content: space-around;">
                        <div><span style="font-size: 1.5rem; color: white; font-weight: bold;">${myClosedJobsCount}</span><br><span style="font-size: 0.8rem; color: var(--text-muted);">Kapatılan İş</span></div>
                        <div><span style="font-size: 1.5rem; color: white; font-weight: bold;">${myTotalMinutes}</span><br><span style="font-size: 0.8rem; color: var(--text-muted);">Dk. Süre</span></div>
                    </div>
                `;
                listContainer.appendChild(summaryCard);
            }

            if (closedTodayFaults.length === 0) {
                const emptyMsg = document.createElement('p');
                emptyMsg.style.textAlign = 'center';
                emptyMsg.style.color = 'var(--text-muted)';
                emptyMsg.innerText = 'Bugün henüz hiçbir arıza kapatılmamış.';
                listContainer.appendChild(emptyMsg);
                return;
            }

            // En son kapatılan en üstte çıksın
            closedTodayFaults.sort((a, b) => b.compDateObj - a.compDateObj);

            closedTodayFaults.forEach(fault => {
                const timeStr = fault.compDateObj.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                const closedBy = shortName(fault.completedBy) || "Bilinmiyor";
                const action = fault.actionTaken || "Açıklama girilmedi";
                const machine = fault.machine || "Bilinmiyor";

                const card = document.createElement('div');
                card.style.background = 'rgba(16, 185, 129, 0.1)';
                card.style.borderLeft = '4px solid var(--success)';
                card.style.borderRadius = '6px';
                card.style.padding = '10px';
                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 5px; margin-bottom: 5px;">
                        <span style="color: var(--text-muted); font-size: 0.85rem;">🕒 ${timeStr}</span>
                        <span style="color: white; font-weight: bold; font-size: 0.95rem;">${machine}</span>
                    </div>
                    <div style="font-size: 0.85rem; color: #ddd; margin-bottom: 5px;"><strong>Kapatan:</strong> ${closedBy}</div>
                    <div style="font-size: 0.85rem; color: #aaa;"><strong>İşlem:</strong> ${action}</div>
                `;
                listContainer.appendChild(card);
            });

        })
        .catch(err => {
            console.error("Kapalı arızalar çekilirken hata:", err);
            loadingText.style.display = 'none';
            listContainer.innerHTML = '<p style="text-align: center; color: var(--danger);">Veriler çekilirken hata oluştu!</p>';
        });
}
