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

// Mobil cihazlarda ekran kapanıp açıldığında kopan Firebase bağlantısını zorla tazele (Ağ uykusunu çözmek için)
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        db.disableNetwork().then(() => db.enableNetwork()).catch(err => console.log("Ağ tazeleme hatası:", err));
    }
});

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

    // 3. Operatör görünüm ayarlarını localStorage'dan yükle
    loadOpSettings();

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
            checkDailySync();
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
    const btn = document.getElementById('btn-admin-fetch');
    const oldText = btn ? btn.innerHTML : "";
    if(btn) {
        btn.innerText = "⏳ GÜNCELLENİYOR...";
        btn.disabled = true;
    }

    try {
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
            
            alert("✅ Veriler Google Sheets'ten başarıyla çekildi ve sisteme yüklendi!");
            
            if(btn) {
                btn.innerHTML = oldText;
                btn.disabled = false;
            }
            return true;
        } else {
            alert("❌ Excel'den veri çekilirken hata oluştu!");
            if(btn) {
                btn.innerHTML = oldText;
                btn.disabled = false;
            }
            return false;
        }
    } catch (error) {
        console.error("Senkronizasyon Hatası:", error);
        alert("❌ Bağlantı hatası yaşandı!");
        if(btn) {
            btn.innerHTML = oldText;
            btn.disabled = false;
        }
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
    const operator = operatorsList.find(op => String(op.pin).trim() === String(pinInput).trim());

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
        const freshOp = operatorsList.find(op => String(op.pin).trim() === String(parsedOp.pin).trim());
        
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

// ----------------------------------------------------
// ADMIN OPERATÖR YÖNETİMİ (INDEX İÇİ)
// ----------------------------------------------------

let adminEditingOpIndex = -1;

function openOpListModal() {
    document.getElementById('admin-op-list-modal').style.display = 'flex';
    renderOpListInModal();
}

function renderOpListInModal() {
    const container = document.getElementById('admin-op-list-container');
    container.innerHTML = '';
    
    if (!operatorsList || operatorsList.length === 0) {
        container.innerHTML = '<p style="color: gray; text-align: center;">Operatör bulunamadı.</p>';
        return;
    }

    operatorsList.forEach((op, index) => {
        let imgUrl = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
        if (op.imageUrl) {
            imgUrl = op.imageUrl;
            const driveMatch = imgUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
            if (driveMatch && driveMatch[1]) {
                imgUrl = `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=w500`;
            }
        }

        const exemptText = op.qrExemptUntil && (op.qrExemptUntil === -1 || op.qrExemptUntil > Date.now()) 
            ? '<span style="color: #10b981; font-weight: bold;">🔓 Tıklama İzni Açık</span>' 
            : '<span style="color: #ef4444;">🔒 Sadece QR</span>';

        const card = document.createElement('div');
        card.style = "background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 15px; display: flex; align-items: center; gap: 15px;";
        card.innerHTML = `
            <img src="${imgUrl}" alt="Foto" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; border: 2px solid var(--primary);">
            <div style="flex: 1;">
                <h3 style="margin: 0; color: white; font-size: 1.1rem;">${op.name}</h3>
                <p style="margin: 4px 0 0 0; color: var(--text-muted); font-size: 0.85rem;">
                    PIN: <strong style="color: var(--primary);">${op.pin}</strong> | Yetki: ${op.role || "Yok"}
                    <br>${exemptText}
                </p>
            </div>
            <button onclick="openOpEditModal(${index})" style="background: #3b82f6; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-weight: bold;">DÜZENLE</button>
        `;
        container.appendChild(card);
    });
}

function openOpEditModal(index) {
    adminEditingOpIndex = index;
    const isNew = index === -1;
    
    document.getElementById('op-edit-title').innerText = isNew ? "➕ Yeni Operatör Ekle" : "✏️ Operatör Düzenle";
    
    if (isNew) {
        document.getElementById('op-edit-name').value = '';
        document.getElementById('op-edit-pin').value = '';
        document.getElementById('op-edit-role').value = '';
        document.getElementById('op-edit-img').value = '';
        document.getElementById('op-edit-qr').value = '0';
    } else {
        const op = operatorsList[index];
        document.getElementById('op-edit-name').value = op.name || '';
        document.getElementById('op-edit-pin').value = op.pin || '';
        document.getElementById('op-edit-role').value = op.role || '';
        document.getElementById('op-edit-img').value = op.imageUrl || '';
        
        let selectVal = "0";
        if (op.qrExemptUntil) {
            if (op.qrExemptUntil === -1) selectVal = "-1";
            else {
                const diffHours = (op.qrExemptUntil - Date.now()) / (1000 * 60 * 60);
                if (diffHours > 0) {
                    if (diffHours <= 1) selectVal = "1";
                    else if (diffHours <= 3) selectVal = "3";
                    else selectVal = "24";
                }
            }
        }
        document.getElementById('op-edit-qr').value = selectVal;
    }
    
    document.getElementById('admin-op-edit-modal').style.display = 'flex';
}

async function saveOpEdit() {
    const name = document.getElementById('op-edit-name').value.trim();
    const pin = document.getElementById('op-edit-pin').value.trim();
    const role = document.getElementById('op-edit-role').value.trim();
    const img = document.getElementById('op-edit-img').value.trim();
    const qrExemptVal = parseInt(document.getElementById('op-edit-qr').value);

    if (!name || !pin) {
        alert("Lütfen Ad Soyad ve PIN kodunu girin!");
        return;
    }

    let qrExemptUntil = null;
    if (qrExemptVal === -1) {
        qrExemptUntil = -1;
    } else if (qrExemptVal > 0) {
        qrExemptUntil = Date.now() + (qrExemptVal * 60 * 60 * 1000);
    }

    const newOpObj = {
        name: name,
        pin: pin,
        role: role,
        imageUrl: img,
        qrExemptUntil: qrExemptUntil
    };

    const saveBtn = document.getElementById('btn-save-op');
    saveBtn.innerText = "Kaydediliyor...";
    saveBtn.disabled = true;

    try {
        let updatedList = [...operatorsList];
        if (adminEditingOpIndex > -1) {
            updatedList[adminEditingOpIndex] = newOpObj;
        } else {
            updatedList.push(newOpObj);
        }

        // 1. Google Sheets'e kaydet
        const payload = {
            action: "updateOperators",
            operators: updatedList
        };
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        
        if (result.success) {
            // 2. Firebase'e kaydet
            await db.collection('settings').doc('config').set({
                operators: updatedList,
                rootCauses: rootCausesList,
                faultReasons: faultReasonsList,
                stoppageReasons: stoppageReasonsList,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });

            operatorsList = updatedList; // local arrayi güncelle
            
            // Mevcut giren kişi güncellendiyse local storage'ı da güncelle
            if (loggedInOperator && String(loggedInOperator.pin).trim() === String(pin).trim()) {
                loggedInOperator = newOpObj;
                localStorage.setItem("loggedInOperator", JSON.stringify(newOpObj));
            }

            document.getElementById('admin-op-edit-modal').style.display = 'none';
            renderOpListInModal();
            showToast("✅ Operatör güncellendi!");
        } else {
            alert("Excel'e yazarken hata oluştu: " + result.error);
        }
    } catch (err) {
        console.error(err);
        alert("Bağlantı hatası yaşandı! Veriler kaydedilemedi.");
    } finally {
        saveBtn.innerText = "💾 Kaydet";
        saveBtn.disabled = false;
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
        const opRole = (loggedInOperator.role || loggedInOperator.yetki || "").toString().toLocaleLowerCase('tr-TR');
        
        if (opRole.includes('admin') || opRole.includes('yönetici') || opRole.includes('yonetici')) {
            isAdmin = true;
        }
    }

    let isExempt = false;
    if (loggedInOperator && loggedInOperator.qrExemptUntil) {
        if (loggedInOperator.qrExemptUntil === -1 || loggedInOperator.qrExemptUntil > Date.now()) {
            isExempt = true;
        }
    }

    if (isAdmin || isExempt) {
        // Kullanıcının isteği: Karta tıklandığında tüm makinenin arızaları değil, SADECE o kartın arızası açılsın
        openFaultSelectionModal([fault]);
    } else {
        // Normal teknisyense ve muafiyeti yoksa QR okutmaya zorla
        startQROnlyCamera(fault);
    }
}

// ----------------------------------------------------
// QR KOD İŞLEMLERİ (SADECE OKUYUCU)
// ----------------------------------------------------

let faultsUnsubscribe = null;
let isInitialFaultsLoad = true;

// BİLDİRİM FONKSİYONLARI İPTAL EDİLDİ

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
        myTasksTitle.innerHTML = `<span class="heartbeat-text">${opName}, BU GÖREVLER SENİ BEKLİYOR!</span>`;
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
                olderTbody.innerHTML = '<tr><td colspan="10" style="text-align:center;">Kayıt yok</td></tr>';
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
            let typeGroups = {}; // Sadece türe göre gruplamak için
            let flatOlderFaults = []; // Gruplamasız liste

            // AYARLARI OKU
            const showGuncelDate = document.getElementById('op-set-guncel-date') ? document.getElementById('op-set-guncel-date').checked : true;
            const showGuncelShift = document.getElementById('op-set-guncel-shift') ? document.getElementById('op-set-guncel-shift').checked : true;
            const showGuncelReporter = document.getElementById('op-set-guncel-reporter') ? document.getElementById('op-set-guncel-reporter').checked : true;
            const showGuncelAssignee = document.getElementById('op-set-guncel-assignee') ? document.getElementById('op-set-guncel-assignee').checked : true;
            const showGuncelDesc = document.getElementById('op-set-guncel-desc') ? document.getElementById('op-set-guncel-desc').checked : true;

            const showAtananDate = document.getElementById('op-set-atanan-date') ? document.getElementById('op-set-atanan-date').checked : true;
            const showAtananShift = document.getElementById('op-set-atanan-shift') ? document.getElementById('op-set-atanan-shift').checked : true;
            const showAtananReporter = document.getElementById('op-set-atanan-reporter') ? document.getElementById('op-set-atanan-reporter').checked : true;
            const showAtananAssignee = document.getElementById('op-set-atanan-assignee') ? document.getElementById('op-set-atanan-assignee').checked : true;
            const showAtananDesc = document.getElementById('op-set-atanan-desc') ? document.getElementById('op-set-atanan-desc').checked : true;

            const showEskiDate = document.getElementById('op-set-eski-date') ? document.getElementById('op-set-eski-date').checked : true;
            const showEskiShift = document.getElementById('op-set-eski-shift') ? document.getElementById('op-set-eski-shift').checked : true;
            const showEskiReporter = document.getElementById('op-set-eski-reporter') ? document.getElementById('op-set-eski-reporter').checked : true;
            const showEskiAssignee = document.getElementById('op-set-eski-assignee') ? document.getElementById('op-set-eski-assignee').checked : true;
            const showEskiDesc = document.getElementById('op-set-eski-desc') ? document.getElementById('op-set-eski-desc').checked : true;
            const eskiGroupType = document.getElementById('op-set-eski-group') ? document.getElementById('op-set-eski-group').value : 'date';
            
            const guncelType = document.getElementById('op-set-guncel-type') ? document.getElementById('op-set-guncel-type').value : 'card';
            const atananType = document.getElementById('op-set-atanan-type') ? document.getElementById('op-set-atanan-type').value : 'row';
            const eskiType = document.getElementById('op-set-eski-type') ? document.getElementById('op-set-eski-type').value : 'row';

            let guncelFaults = [];
            let myTaskFaults = [];

            // TABLO BAŞLIKLARINI DİNAMİK GÜNCELLE
            // Eski kullanım iptal edildi, tablolar dinamik oluşturuluyor.
            
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

                // Yardımcılar ve Görevli HTML'si
                let helpersHtml = '';
                if (fault.helpers && fault.helpers.length > 0) {
                    helpersHtml = `<p class="fault-details" style="color:${textColor}; margin-top: 4px;"><strong>🤝 Yardımcılar:</strong> ${fault.helpers.join(', ')}</p>`;
                }
                
                const actualReporter = fault.reporter || fault.userName || fault.kullanici || fault.name || fault.bildiren || "Bilinmiyor";
                
                let reporterHtml = `<p class="fault-details" style="color:${textColor}; margin-top: 4px;"><strong>👤 Bildiren:</strong> ${actualReporter}</p>`;
                
                let assignedHtml = '';
                if (fault.assignedTo) {
                    const isAssigned = fault.assignedTo !== '-' && fault.assignedTo !== 'Atanmadı';
                    assignedHtml = `<p class="fault-details" style="color:var(--warning); font-weight:bold; margin-top: 4px;">🛠️ Görevli: ${isAssigned ? `<span class="neon-border-green">${fault.assignedTo}</span>` : fault.assignedTo}</p>`;
                }

                let itemObj = { fault, dateStr, cardBg, borderColor, textColor, mutedColor, isSolid, statusLabelHtml, helpersHtml, reporterHtml, assignedHtml };

                if (isCard) {
                    todayCount++;
                    guncelFaults.push(itemObj);
                } else {
                    olderCount++;
                    const dateKey = dateObj ? dateObj.toLocaleString('tr-TR', { day:'2-digit', month:'2-digit', year:'numeric' }) : (fault.createdAt ? fault.createdAt.substring(0, 10) : "Belirsiz Tarih");
                    const typeKey = fault.jobType ? fault.jobType.toLocaleUpperCase('tr-TR') : "DİĞER / BELİRTİLMEYEN TÜR";
                    
                    // Eski arızaları Ayara göre kaydet
                    flatOlderFaults.push(itemObj);

                    if (!dateGroups[dateKey]) dateGroups[dateKey] = {};
                    if (!dateGroups[dateKey][typeKey]) dateGroups[dateKey][typeKey] = [];
                    dateGroups[dateKey][typeKey].push(itemObj);

                    if (!typeGroups[typeKey]) typeGroups[typeKey] = [];
                    typeGroups[typeKey].push(itemObj);

                    // EĞER ATANAN KİŞİ BEN İSEM
                    if (isMyTask) {
                        myTaskCount++;
                        myTaskFaults.push(itemObj);
                    }
                }
            });

            // ----------------------------------------------------
            // 1. GÜNCEL ARIZALARI (TODAY) EKRANA BAS
            // ----------------------------------------------------
            todayContainer.innerHTML = '';
            if (todayCount === 0) {
                todayContainer.innerHTML = '<p style="color:var(--text-muted); font-size:0.9rem;">Bugün açılmış acil bir arıza yok.</p>';
            } else if (guncelType === 'row') {
                let tableHtml = `
                    <div class="table-container" style="border-color: rgba(239, 68, 68, 0.3);">
                        <table class="faults-table">
                            <thead>
                                <tr>
                                    ${showGuncelDate ? '<th style="width: 15%;">Tarih</th>' : ''}
                                    ${showGuncelShift ? '<th style="width: 15%;">Vardiya</th>' : ''}
                                    <th style="width: 25%;">Makine</th>
                                    ${showGuncelReporter ? '<th style="width: 15%;">Bildiren</th>' : ''}
                                    ${showGuncelAssignee ? '<th style="width: 15%;">Görevli</th>' : ''}
                                    ${showGuncelDesc ? '<th style="width: 20%;">Açıklama</th>' : ''}
                                </tr>
                            </thead>
                            <tbody id="dynamic-guncel-tbody"></tbody>
                        </table>
                    </div>
                `;
                todayContainer.innerHTML = tableHtml;
                const gTbody = document.getElementById('dynamic-guncel-tbody');
                
                guncelFaults.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.style.backgroundColor = item.cardBg;
                    tr.style.color = item.textColor;
                    tr.style.borderLeft = `4px solid ${item.isSolid ? item.textColor : item.borderColor}`;
                    tr.onclick = () => handleFaultClick(item.fault);
                    
                    let rowHtml = '';
                    if(showGuncelDate) rowHtml += `<td data-label="Tarih" style="color: ${item.textColor}; font-weight: bold;">${item.dateStr}</td>`;
                    if(showGuncelShift) rowHtml += `<td data-label="Vardiya" class="truncate-text" style="color: ${item.mutedColor};">${item.fault.shift || "-"}</td>`;
                    rowHtml += `<td data-label="Makine" class="truncate-text" style="color: ${item.textColor};"><strong>${item.fault.machine || "Bilinmiyor"}</strong></td>`;
                    if(showGuncelReporter) rowHtml += `<td data-label="Bildiren" class="truncate-text" style="color: ${item.textColor};">${item.fault.reporter || item.fault.userName || item.fault.kullanici || item.fault.name || item.fault.bildiren || "Bilinmiyor"}</td>`;
                    if(showGuncelAssignee) {
                        const isAssigned = item.fault.assignedTo && item.fault.assignedTo !== '-' && item.fault.assignedTo !== 'Atanmadı';
                        const val = item.fault.assignedTo || "-";
                        rowHtml += `<td data-label="Görevli" class="truncate-text" style="color: var(--warning); font-weight: bold;">${isAssigned ? `<span class="neon-border-green">${val}</span>` : val}</td>`;
                    }
                    if(showGuncelDesc) rowHtml += `<td data-label="Açıklama" class="truncate-text" style="color: ${item.textColor};">${item.fault.description || "-"}</td>`;
                    
                    tr.innerHTML = rowHtml;
                    gTbody.appendChild(tr);
                });
            } else {
                // KART GÖRÜNÜMÜ
                guncelFaults.forEach(item => {
                    const cardHtml = `
                        <div class="fault-header">
                            <h3 class="machine-name" style="color:${item.textColor};">⚙️ ${item.fault.machine || "Bilinmeyen Makine"}</h3>
                            ${showGuncelDate ? `<span class="fault-date" style="color:${item.mutedColor};">${item.dateStr}</span>` : ''}
                        </div>
                        ${showGuncelShift ? `<p class="fault-details" style="color:${item.textColor};"><strong>Vardiya:</strong> ${item.fault.shift || "-"}</p>` : ''}
                        <p class="fault-details" style="color:${item.textColor};"><strong>Tür:</strong> <span style="font-weight:bold;">${item.fault.jobType || "-"}</span></p>
                        ${showGuncelDesc ? `<p class="fault-details" style="color:${item.textColor};"><strong>Açıklama:</strong> ${item.fault.description || "Açıklama yok"}</p>` : ''}
                        ${showGuncelReporter ? item.reporterHtml : ''}
                        ${showGuncelAssignee ? item.assignedHtml : ''}
                        ${item.helpersHtml}
                        ${item.statusLabelHtml}
                    `;
                    const card = document.createElement('div');
                    card.className = 'fault-card';
                    card.style.backgroundColor = item.cardBg;
                    if (!item.isSolid) card.style.borderLeftColor = item.borderColor;
                    if (loggedInOperator && item.fault.assignedTo === loggedInOperator.name) card.style.border = `3px solid var(--text-main)`; 
                    card.onclick = () => handleFaultClick(item.fault);
                    card.innerHTML = cardHtml;
                    todayContainer.appendChild(card);
                });
            }

            // ----------------------------------------------------
            // 2. ATANANLAR (MY TASKS) EKRANA BAS
            // ----------------------------------------------------
            let myTasksContent = document.getElementById('my-tasks-content');
            if (!myTasksContent) {
                myTasksContent = document.createElement('div');
                myTasksContent.id = 'my-tasks-content';
                document.getElementById('my-tasks-title').after(myTasksContent);
                const tableCont = document.querySelector('#my-tasks-tbody').closest('.table-container');
                if (tableCont) tableCont.style.display = 'none'; // Eskisini gizle
            }
            
            myTasksContent.innerHTML = '';
            if (myTaskCount > 0) {
                myTasksSection.style.display = 'block';
                if (atananType === 'row') {
                    let tableHtml = `
                        <div class="table-container" style="border-color: rgba(245, 158, 11, 0.3);">
                            <table class="faults-table">
                                <thead>
                                    <tr>
                                        ${showAtananDate ? '<th style="width: 20%;">Tarih</th>' : ''}
                                        ${showAtananShift ? '<th style="width: 15%;">Vardiya</th>' : ''}
                                        <th style="width: 25%;">Makine</th>
                                        <th style="width: 15%;">Tür</th>
                                        ${showAtananReporter ? '<th style="width: 15%;">Bildiren</th>' : ''}
                                        ${showAtananDesc ? '<th style="width: 25%;">Açıklama</th>' : ''}
                                    </tr>
                                </thead>
                                <tbody id="dynamic-atanan-tbody"></tbody>
                            </table>
                        </div>
                    `;
                    myTasksContent.innerHTML = tableHtml;
                    const aTbody = document.getElementById('dynamic-atanan-tbody');
                    
                    myTaskFaults.forEach(item => {
                        const tr = document.createElement('tr');
                        tr.style.backgroundColor = item.cardBg;
                        tr.style.color = item.textColor;
                        tr.style.borderLeft = `4px solid ${item.isSolid ? item.textColor : item.borderColor}`;
                        tr.onclick = () => handleFaultClick(item.fault);
                        
                        let rowHtml = '';
                        const dObj = parseFaultDate(item.fault.createdAt);
                        const shortDateTime = dObj ? dObj.toLocaleString('tr-TR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : "-";
                        
                        if(showAtananDate) rowHtml += `<td data-label="Tarih" style="color: ${item.textColor}; font-weight: bold;">${shortDateTime}</td>`;
                        if(showAtananShift) rowHtml += `<td data-label="Vardiya" class="truncate-text" style="color: ${item.mutedColor};">${item.fault.shift || "-"}</td>`;
                        rowHtml += `<td data-label="Makine" class="truncate-text" style="color: ${item.textColor};"><strong>${item.fault.machine || "Bilinmiyor"}</strong></td>`;
                        rowHtml += `<td data-label="Tür" class="truncate-text" style="color: ${item.textColor}; font-weight: bold;">${item.fault.jobType || "-"}</td>`;
                        if(showAtananReporter) rowHtml += `<td data-label="Bildiren" class="truncate-text" style="color: ${item.textColor};">${item.fault.reporter || item.fault.userName || item.fault.kullanici || item.fault.name || item.fault.bildiren || "Bilinmiyor"}</td>`;
                        if(showAtananDesc) rowHtml += `<td data-label="Açıklama" class="truncate-text" style="color: ${item.textColor};">${item.fault.description || "-"}</td>`;
                        
                        tr.innerHTML = rowHtml;
                        aTbody.appendChild(tr);
                    });
                } else {
                    // KART GÖRÜNÜMÜ
                    const cardsDiv = document.createElement('div');
                    cardsDiv.style.display = 'flex';
                    cardsDiv.style.flexDirection = 'column';
                    cardsDiv.style.gap = '1rem';
                    
                    myTaskFaults.forEach(item => {
                        const cardHtml = `
                            <div class="fault-header">
                                <h3 class="machine-name" style="color:${item.textColor};">⚙️ ${item.fault.machine || "Bilinmeyen Makine"}</h3>
                                ${showAtananDate ? `<span class="fault-date" style="color:${item.mutedColor};">${item.dateStr}</span>` : ''}
                            </div>
                            ${showAtananShift ? `<p class="fault-details" style="color:${item.textColor};"><strong>Vardiya:</strong> ${item.fault.shift || "-"}</p>` : ''}
                            <p class="fault-details" style="color:${item.textColor};"><strong>Tür:</strong> <span style="font-weight:bold;">${item.fault.jobType || "-"}</span></p>
                            ${showAtananDesc ? `<p class="fault-details" style="color:${item.textColor};"><strong>Açıklama:</strong> ${item.fault.description || "Açıklama yok"}</p>` : ''}
                            ${showAtananReporter ? item.reporterHtml : ''}
                            ${item.helpersHtml}
                            ${item.statusLabelHtml}
                        `;
                        const card = document.createElement('div');
                        card.className = 'fault-card';
                        card.style.backgroundColor = item.cardBg;
                        card.style.borderLeftColor = item.borderColor;
                        card.onclick = () => handleFaultClick(item.fault);
                        card.innerHTML = cardHtml;
                        cardsDiv.appendChild(card);
                    });
                    myTasksContent.appendChild(cardsDiv);
                }
            } else {
                myTasksSection.style.display = 'none';
            }

            // ----------------------------------------------------
            // 3. ESKİ ARIZALAR (OLDER) EKRANA BAS
            // ----------------------------------------------------
            let olderContent = document.getElementById('older-faults-content');
            if (!olderContent) {
                olderContent = document.createElement('div');
                olderContent.id = 'older-faults-content';
                const tableCont = document.querySelector('#older-faults-tbody').closest('.table-container');
                if (tableCont) {
                    tableCont.parentNode.insertBefore(olderContent, tableCont);
                    tableCont.style.display = 'none'; // Eskisini gizle
                }
            }
            
            olderContent.innerHTML = '';
            
            if (olderCount === 0) {
                olderContent.innerHTML = '<div style="text-align:center; padding:1rem;"><p style="color:var(--text-muted);">Önceki günlerden kalan arıza yok.</p></div>';
            } else {
                const getBgColor = (typeKey) => {
                    let bg = "rgba(59, 130, 246, 0.1)";
                    let txtColor = "var(--primary)";
                    const t = typeKey.toLocaleLowerCase('tr-TR');
                    if (t.includes('mekanik')) { bg = "rgba(0, 255, 255, 0.1)"; txtColor = "#00FFFF"; }
                    else if (t.includes('elektrik')) { bg = "rgba(255, 255, 0, 0.1)"; txtColor = "#FFFF00"; }
                    else if (t.includes('iş güvenliği') || t.includes('is guvenligi')) { bg = "rgba(255, 0, 0, 0.1)"; txtColor = "#FF0000"; }
                    else if (t.includes('planlı bakım') || t.includes('planli bakim')) { bg = "rgba(255, 165, 0, 0.1)"; txtColor = "#FFA500"; }
                    else if (t.includes('tekrar eden')) { bg = "rgba(255, 0, 255, 0.1)"; txtColor = "#FF00FF"; }
                    return {bg, txtColor};
                };

                let oTbody = null;
                let cardsDiv = null;

                if (eskiType === 'row') {
                    let tableHtml = `
                        <div class="table-container">
                            <table class="faults-table">
                                <thead>
                                    <tr>
                                        ${showEskiDate ? '<th style="width: 12%;">Tarih/Saat</th>' : ''}
                                        ${showEskiShift ? '<th style="width: 15%;">Vardiya</th>' : ''}
                                        <th style="width: 28%;">Makine</th>
                                        ${showEskiReporter ? '<th style="width: 15%;">Bildiren</th>' : ''}
                                        ${showEskiAssignee ? '<th style="width: 20%;">Görevli</th>' : ''}
                                        ${showEskiDesc ? '<th style="width: 25%;">Açıklama</th>' : ''}
                                    </tr>
                                </thead>
                                <tbody id="dynamic-older-tbody"></tbody>
                            </table>
                        </div>
                    `;
                    olderContent.innerHTML = tableHtml;
                    oTbody = document.getElementById('dynamic-older-tbody');
                } else {
                    cardsDiv = document.createElement('div');
                    cardsDiv.style.display = 'flex';
                    cardsDiv.style.flexDirection = 'column';
                    cardsDiv.style.gap = '1rem';
                    olderContent.appendChild(cardsDiv);
                }

                const renderItem = (item, bg, txtColor) => {
                    const dObj = parseFaultDate(item.fault.createdAt);
                    const timeStr = dObj ? dObj.toLocaleString('tr-TR', { hour:'2-digit', minute:'2-digit' }) : "-";
                    const dateStrShort = dObj ? `${String(dObj.getDate()).padStart(2, '0')}.${String(dObj.getMonth()+1).padStart(2, '0')} ${String(dObj.getHours()).padStart(2, '0')}:${String(dObj.getMinutes()).padStart(2, '0')}` : "-";

                    if (eskiType === 'row') {
                        const tr = document.createElement('tr');
                        tr.style.backgroundColor = bg; 
                        tr.style.borderLeft = `4px solid ${txtColor}`;
                        tr.onclick = () => handleFaultClick(item.fault);
                        
                        let rowHtml = '';
                        if(showEskiDate) rowHtml += `<td data-label="Tarih" style="color: var(--danger); font-weight: bold; text-align: center;">${dateStrShort}</td>`;
                        if(showEskiShift) rowHtml += `<td data-label="Vardiya" class="truncate-text" style="color: var(--text-muted);">${item.fault.shift || "-"}</td>`;
                        rowHtml += `<td data-label="Makine" class="truncate-text"><strong>${item.fault.machine || "Bilinmiyor"}</strong></td>`;
                        if(showEskiReporter) rowHtml += `<td data-label="Bildiren" class="truncate-text">${item.fault.reporter || item.fault.userName || item.fault.kullanici || item.fault.name || item.fault.bildiren || "Bilinmiyor"}</td>`;
                        if(showEskiAssignee) {
                            const isAssigned = item.fault.assignedTo && item.fault.assignedTo !== '-' && item.fault.assignedTo !== 'Atanmadı';
                            const val = item.fault.assignedTo || "Atanmadı";
                            rowHtml += `<td data-label="Görevli" class="truncate-text" style="color: var(--warning); font-weight: bold;">${isAssigned ? `<span class="neon-border-green">${val}</span>` : val}</td>`;
                        }
                        if(showEskiDesc) rowHtml += `<td data-label="Açıklama" class="truncate-text">${item.fault.description || "-"}</td>`;
                        
                        tr.innerHTML = rowHtml;
                        oTbody.appendChild(tr);
                    } else {
                        const cardHtml = `
                            <div class="fault-header">
                                <h3 class="machine-name" style="color:${item.textColor};">⚙️ ${item.fault.machine || "Bilinmeyen Makine"}</h3>
                                ${showEskiDate ? `<span class="fault-date" style="color:${item.mutedColor};">${item.dateStr}</span>` : ''}
                            </div>
                            ${showEskiShift ? `<p class="fault-details" style="color:${item.textColor};"><strong>Vardiya:</strong> ${item.fault.shift || "-"}</p>` : ''}
                            <p class="fault-details" style="color:${item.textColor};"><strong>Tür:</strong> <span style="font-weight:bold;">${item.fault.jobType || "-"}</span></p>
                            ${showEskiDesc ? `<p class="fault-details" style="color:${item.textColor};"><strong>Açıklama:</strong> ${item.fault.description || "Açıklama yok"}</p>` : ''}
                            ${showEskiReporter ? item.reporterHtml : ''}
                            ${showEskiAssignee ? item.assignedHtml : ''}
                            ${item.helpersHtml}
                            ${item.statusLabelHtml}
                        `;
                        const card = document.createElement('div');
                        card.className = 'fault-card';
                        card.style.backgroundColor = item.cardBg;
                        card.style.borderLeftColor = txtColor;
                        card.onclick = () => handleFaultClick(item.fault);
                        card.innerHTML = cardHtml;
                        cardsDiv.appendChild(card);
                    }
                };

                const renderHeader = (htmlContent) => {
                    if (eskiType === 'row') {
                        const headerTr = document.createElement('tr');
                        headerTr.innerHTML = `<td colspan="10" style="${htmlContent.style}">${htmlContent.text}</td>`;
                        oTbody.appendChild(headerTr);
                    } else {
                        const headerDiv = document.createElement('div');
                        headerDiv.style.cssText = htmlContent.style + "; margin-top: 10px; border-radius: 4px;";
                        headerDiv.innerText = htmlContent.text;
                        cardsDiv.appendChild(headerDiv);
                    }
                };

                if (eskiGroupType === 'date') {
                    for (const [dateKey, typesObj] of Object.entries(dateGroups)) {
                        renderHeader({
                            text: `📅 ${dateKey}`,
                            style: "background: rgba(59, 130, 246, 0.4); color: white; font-weight: bold; text-align: center; padding: 0.6rem; font-size: 1.15rem; letter-spacing: 1px; border-bottom: 2px solid var(--primary);"
                        });

                        for (const [typeKey, groupFaults] of Object.entries(typesObj)) {
                            const {bg, txtColor} = getBgColor(typeKey);
                            renderHeader({
                                text: `⚙️ ${typeKey}`,
                                style: `background: ${bg}; color: ${txtColor}; font-weight: bold; text-align: left; padding: 0.4rem 1rem; border-left: 4px solid ${txtColor};`
                            });

                            groupFaults.forEach(item => renderItem(item, bg, txtColor));
                        }
                    }
                } else if (eskiGroupType === 'type') {
                    for (const [typeKey, groupFaults] of Object.entries(typeGroups)) {
                        const {bg, txtColor} = getBgColor(typeKey);
                        renderHeader({
                            text: `⚙️ ${typeKey}`,
                            style: `background: ${bg}; color: ${txtColor}; font-weight: bold; text-align: left; padding: 0.6rem; font-size: 1.15rem; letter-spacing: 1px; border-left: 4px solid ${txtColor}; border-bottom: 2px solid ${txtColor};`
                        });

                        groupFaults.forEach(item => renderItem(item, bg, txtColor));
                    }
                } else {
                    // none
                    flatOlderFaults.forEach(item => {
                        const typeKey = item.fault.jobType ? item.fault.jobType.toLocaleUpperCase('tr-TR') : "DİĞER / BELİRTİLMEYEN TÜR";
                        const {bg, txtColor} = getBgColor(typeKey);
                        renderItem(item, bg, txtColor);
                    });
                }
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

let expectedFaultForQR = null;

// Tıklanan tüm arızalar bu fonksiyonu tetikler, ID önemsizdir!
function startQROnlyCamera(targetFault = null) {
    expectedFaultForQR = targetFault;
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
    
    // 3. Özel bir arıza için mi kamera açıldı? (Bir arıza kartına tıklandıysa)
    if (expectedFaultForQR) {
        const expectedMachine = expectedFaultForQR.machine ? expectedFaultForQR.machine.trim().toLocaleUpperCase('tr-TR') : "";
        
        // Makine eşleşiyor mu kontrolü
        if (expectedMachine && !(machineNameForSearch.includes(expectedMachine) || machineNameForSearch === expectedMachine)) {
            alert(`❌ Yanlış Makine!\n\nTıkladığınız arıza "${expectedFaultForQR.machine}" makinesine ait.\nOkuttuğunuz karekod ise "${machineNameForSearch}" makinesine ait.\n\nLütfen doğru makinenin karekodunu okutun.`);
            return;
        }
        
        // Eşleşiyorsa o makinedeki TÜM açık arızaları aç
        const allMachineFaults = currentOpenFaults.filter(f => {
            if (!f.machine) return false;
            const dbMachine = f.machine.trim().toLocaleUpperCase('tr-TR');
            return expectedMachine === dbMachine;
        });

        openFaultSelectionModal(allMachineFaults.length > 0 ? allMachineFaults : [expectedFaultForQR]);
        expectedFaultForQR = null; // Sıfırla
        return;
    }

    // 4. Eğer menüden genel 'Manuel QR Okut' dendi ise:
    // Hafızadaki mevcut AÇIK arızaların içinde makineyi ara
    const matchedFaults = currentOpenFaults.filter(f => {
        if (!f.machine) return false;
        const dbMachine = f.machine.trim().toLocaleUpperCase('tr-TR');
        return machineNameForSearch.includes(dbMachine) || machineNameForSearch === dbMachine;
    });
    
    // 5. Sonuç değerlendirmesi
    if (matchedFaults.length >= 1) {
        openFaultSelectionModal(matchedFaults);
    } else {
        if (isAppSheetLink) {
            alert(`❌ Hata: Bu makinede açık bir arıza bulunamadı!\n\nBulunan Makine: "${machineNameForSearch}"\n\nSistem bu makineye ait açık bir arıza bulamadı.`);
        } else {
            alert(`❌ Hata: Bu makinede açık bir arıza bulunamadı!\n\nOkunan Metin: "${scannedText}"`);
        }
    }
}

// --- BİRDEN FAZLA ARIZA SEÇİM MODALI ---
function openFaultSelectionModal(faults) {
    let isAdmin = false;
    if (loggedInOperator) {
        const opRole = (loggedInOperator.role || loggedInOperator.yetki || "").toString().toLocaleLowerCase('tr-TR');
        if (opRole.includes('admin') || opRole.includes('yönetici') || opRole.includes('yonetici')) {
            isAdmin = true;
        }
    }

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
        const typeHtml = `<div style="color: ${txtColor}; font-size: 1rem; margin-bottom: 6px; font-weight: bold; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px;">Tür: ${jobTypeDisplay}</div>`;
        const descHtml = fault.description ? `<div style="color: #cbd5e1; font-size: 0.95rem; margin-bottom: 6px;"><strong>Açıklama:</strong> ${fault.description}</div>` : (fault.faultDescription ? `<div style="color: #cbd5e1; font-size: 0.95rem; margin-bottom: 6px;"><strong>Açıklama:</strong> ${fault.faultDescription}</div>` : '');
        const reporterHtml = fault.assignedTo ? `<div style="color: #94a3b8; font-size: 0.85rem; margin-bottom: 4px;"><strong>Görevli:</strong> ${fault.assignedTo}</div>` : '';
        const helpersModalHtml = (fault.helpers && fault.helpers.length > 0) ? `<div style="color: #94a3b8; font-size: 0.85rem; margin-bottom: 4px;"><strong>Yardımcılar:</strong> ${fault.helpers.join(', ')}</div>` : '';
        
        // Tarihi güvenli bir şekilde dönüştür (Invalid Date hatasını önlemek için)
        const dateObj = parseFaultDate(fault.createdAt || fault.faultDate);
        const dateStr = dateObj ? dateObj.toLocaleString('tr-TR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : (fault.createdAt || fault.faultDate || "Bilinmeyen Tarih");
        const dateHtml = `<div style="color: #64748b; font-size: 0.8rem; margin-top: 2px;"><strong>Tarih:</strong> ${dateStr}</div>`;
        
        // --- DINAMIK BUTON MANTIĞI ---
        let actionButtonsHtml = '';
        const currentStatus = fault.status || "Açık";
        
        // Eğer arıza henüz başlamadıysa ("Açık") VEYA kimse atanmamışsa (Parça bekliyor vb. durumunda atanmış kişi silinir)
        if (currentStatus === "Açık" || !fault.assignedTo) {
            let startBtnText = "Çalışmaya Başla";
            if (currentStatus === "Parça Bekliyor") startBtnText = "Parça Geldi / İşi Devral";
            else if (currentStatus === "Dış Servis Bekliyor") startBtnText = "Dış Servis Geldi / İşe Başla";
            else if (currentStatus !== "Açık") startBtnText = "İşi Devral (" + currentStatus + ")";
            else if (currentStatus === "Açık" && fault.assignedTo && fault.assignedTo !== loggedInOperator.name) {
                startBtnText = `İşi Devral (Görevli: ${fault.assignedTo})`;
            }

            actionButtonsHtml = `<button onclick='startWork("${fault.id}")' style="background: var(--primary); color: #000; padding: 6px 12px; border: none; border-radius: 4px; font-size: 0.85rem; font-weight: bold; cursor: pointer; width: 100%;">${startBtnText}</button>`;
        } else {
            // Arıza aktif durumda (Müdahale Ediliyor)
            if (fault.assignedTo === loggedInOperator.name) {
                // Ana görevli kendisi
                actionButtonsHtml = `<button onclick='startMainIntervention("${fault.id}")' style="background: ${badgeColor}; color: #000; padding: 6px 12px; border: none; border-radius: 4px; font-size: 0.85rem; font-weight: bold; cursor: pointer; width: 100%;">Müdahaleyi Bitir / Güncelle</button>`;
            } else {
                // Ana görevli başkası
                const isHelper = fault.helpers && fault.helpers.includes(loggedInOperator.name);
                
                if (isHelper) {
                    // Zaten yardımcı
                    actionButtonsHtml = `<button onclick='leaveHelper("${fault.id}")' style="background: rgba(239, 68, 68, 0.2); color: #ef4444; padding: 6px 12px; border: 1px solid #ef4444; border-radius: 4px; font-size: 0.85rem; font-weight: bold; cursor: pointer; width: 100%;">Bakımdan Ayrıl</button>`;
                } else {
                    // Henüz katılmamış
                    actionButtonsHtml = `<button onclick='joinAsHelper("${fault.id}")' style="background: rgba(255,255,255,0.1); color: white; padding: 6px 12px; border: 1px solid rgba(255,255,255,0.3); border-radius: 4px; font-size: 0.85rem; font-weight: bold; cursor: pointer; width: 100%;">Yardımcı Olarak Katıl</button>`;
                }
            }
        }
        let adminAssignHtml = '';
        if (isAdmin) {
            let options = `<option value="">-- Görevliyi Kaldır --</option>`;
            operatorsList.forEach(op => {
                const opNameStr = op.name || op.isim || op.ad;
                const isSelected = fault.assignedTo === opNameStr ? 'selected' : '';
                options += `<option value="${opNameStr}" ${isSelected}>${opNameStr}</option>`;
            });
            adminAssignHtml = `
            <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1);">
                <label style="color: var(--warning); font-size: 0.85rem; font-weight: bold; display: block; margin-bottom: 4px;">Admin: Görevli Ata / Değiştir</label>
                <select onchange="assignOperatorByAdmin('${fault.id}', this.value)" style="width: 100%; padding: 8px; border-radius: 4px; background: #334155; color: white; border: 1px solid var(--warning);">
                    ${options}
                </select>
            </div>`;
        }
        
        div.innerHTML = `
            ${typeHtml}
            ${descHtml}
            ${reporterHtml}
            ${helpersModalHtml}
            ${dateHtml}
            ${adminAssignHtml}
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

// Yeni: Admin tarafından görevli atama
window.assignOperatorByAdmin = function(faultId, operatorName) {
    if (!loggedInOperator) return; 
    
    if (!operatorName) {
        db.collection('arizalar').doc(faultId).update({
            assignedTo: firebase.firestore.FieldValue.delete()
        }).then(() => {
            alert("Görevli başarıyla kaldırıldı.");
            closeFaultSelectionModal();
        }).catch(err => alert("Hata: " + err.message));
        return;
    }
    
    db.collection('arizalar').doc(faultId).update({
        assignedTo: operatorName
    }).then(() => {
        alert(operatorName + " bu arızaya başarıyla atandı! (İşe henüz başlanmadı)");
        closeFaultSelectionModal();
    }).catch(err => alert("Hata: " + err.message));
};

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
    
    // Haftalık istatistikleri güncelle
    allNewLogs.forEach(log => {
        if (log.operator) {
            updateWeeklyStats(log.operator, log.durationMin || 0);
        }
    });
    
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
        alert(`✅ Arıza müdahalesi başarıyla sisteme kaydedildi! \nDurum: ${selectedStatus}`);
        closeFaultModal();
        if (selectedStatus === 'Kapalı') {
            updateDailyStatsHeader();
        }
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
    
    // Menü ikonunu görünür yap
    const menuBtn = document.getElementById('main-menu-btn');
    if(menuBtn) menuBtn.style.display = 'block';
    
    // Tema ayarlarını uygula
    applyThemePrefs();
    
    // Mesajları dinlemeye başla
    listenForMessages();
    
    // Header'da Operatör ismini göster
    if (loggedInOperator && loggedInOperator.name) {
        document.getElementById('user-info').innerHTML = `👤 Operatör: <strong>${loggedInOperator.name}</strong>`;
        
        // Varsa operatörün fotoğrafını da göster
        const profilePic = document.getElementById('op-profile-pic');
        if (profilePic) {
            if (loggedInOperator.photoUrl) {
                profilePic.src = loggedInOperator.photoUrl;
                profilePic.style.display = 'block';
            } else {
                profilePic.style.display = 'none';
            }
        }
        
        // Admin butonlarını kontrol et
        const opName = (loggedInOperator.name || loggedInOperator.isim || loggedInOperator.ad || "").toString().toLocaleLowerCase('tr-TR');
        const opPin = (loggedInOperator.pin || "").toString().trim();
        const opRole = (loggedInOperator.role || loggedInOperator.yetki || "").toString().toLocaleLowerCase('tr-TR');
        
        const isAdmin = opRole.includes('admin') || opRole.includes('yönetici') || opRole.includes('yonetici');
        
        document.getElementById('btn-admin-op-settings').style.display = isAdmin ? 'flex' : 'none';
        document.getElementById('btn-admin-report').style.display = isAdmin ? 'flex' : 'none';
        document.getElementById('btn-admin-export').style.display = isAdmin ? 'flex' : 'none';
        document.getElementById('btn-admin-fetch').style.display = isAdmin ? 'flex' : 'none';
        document.getElementById('btn-admin-message-monitor').style.display = isAdmin ? 'flex' : 'none';
        document.getElementById('btn-add-op-menu').style.display = isAdmin ? 'flex' : 'none';
    }

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
    
    document.getElementById('user-info').innerText = `${shortName(loggedInOperator.name)}`;
    document.getElementById('user-info').style.color = "var(--success)";
    
    // YENİ: Bugün bitirilen işleri hesapla ve üst menüye yaz
    updateDailyStatsHeader();
    
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
    
    const addOpMenuBtn = document.getElementById('btn-add-op-menu');
    if (addOpMenuBtn) {
        addOpMenuBtn.style.display = 'none'; // Varsayılan olarak gizle
    }

    
}

// Oturumu Kapat
function logout() {
    localStorage.removeItem("loggedInOperator");
    loggedInOperator = null;
    document.getElementById('pinCode').value = '';
    
    // Mesaj dinlemeyi durdur ve banner'ı gizle
    if (messagesUnsubscribe) {
        messagesUnsubscribe();
        messagesUnsubscribe = null;
    }
    const banner = document.getElementById('message-banner');
    if(banner) banner.style.display = 'none';
    
    // Menü ikonunu ve açık menüyü gizle
    const menuBtn = document.getElementById('main-menu-btn');
    if(menuBtn) menuBtn.style.display = 'none';
    const settingsMenu = document.getElementById('settings-menu');
    if(settingsMenu) settingsMenu.style.display = 'none';
    
    // Temayı varsayılana sıfırla
    resetThemePrefs();
    
    document.getElementById('user-info').innerText = "Lütfen PIN Kodunuzu Girin";
    document.getElementById('user-info').style.color = "var(--text-muted)";
    const statsEl = document.getElementById('user-daily-stats');
    if (statsEl) {
        statsEl.style.display = 'none';
        statsEl.innerText = "";
    }
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
            
            // Operatörün müdahaleye fiilen başladığı zaman (Yoksa arıza açılış saatini baz al)
            let workStartObj = startObj;
            if (data.startedAt) {
                if (typeof data.startedAt.toDate === 'function') workStartObj = data.startedAt.toDate();
                else if (data.startedAt.seconds) workStartObj = new Date(data.startedAt.seconds * 1000);
                else workStartObj = new Date(data.startedAt);
            }
            
            let workBasTarih = basTarih;
            let workBasSaat = basSaat;
            if (workStartObj && !isNaN(workStartObj.getTime())) {
                workBasTarih = workStartObj.toLocaleDateString('tr-TR');
                workBasSaat = workStartObj.toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'});
            }

            let totalStoppageMin = 0;
            if (workStartObj && endObj && !isNaN(workStartObj.getTime()) && !isNaN(endObj.getTime())) {
                totalStoppageMin = Math.max(0, Math.round((endObj - workStartObj) / 60000));
            }

            // K Sütunu için Start - Bitiş formatı (Operatörün çalışmaya başladığı saati baz al)
            let startEndHours = "";
            if (workBasSaat && bitSaat) {
                if (workBasTarih !== bitTarih) {
                    startEndHours = `${workBasTarih} ${workBasSaat} - ${bitTarih} ${bitSaat}`;
                } else {
                    startEndHours = `${workBasSaat} - ${bitSaat}`;
                }
            } else if (bitSaat) {
                startEndHours = bitSaat;
            }

            let basTarihVeSaat = basTarih;
            if (basSaat) {
                basTarihVeSaat = basTarih + " " + basSaat;
            }
            
            // L Sütunu Duruş Süresi Formatı (Örn: 45 saat 37 dk)
            let formattedStoppage = totalStoppageMin + " dk";
            if (totalStoppageMin > 60) {
                let h = Math.floor(totalStoppageMin / 60);
                let m = totalStoppageMin % 60;
                formattedStoppage = `${h} saat ${m} dk`;
            }

            exportData.push([
                basTarihVeSaat, data.userName || "", data.costCenter || "", data.machine || "", data.shift || "",
                data.jobType || "", data.description || "", data.photoUrl ? "Var" : "Yok", bakimLogu, bitTarih, startEndHours,
                formattedStoppage, data.stoppageReason || "", data.faultReason || "", data.actionTaken || "", data.partsChanged || ""
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

// ----------------------------------------------------
// ÜST MENÜ GÜNLÜK İSTATİSTİK GÜNCELLEME
// ----------------------------------------------------
function updateDailyStatsHeader() {
    if (!loggedInOperator) return;
    const statsEl = document.getElementById('user-daily-stats');
    if (!statsEl) return;
    
    statsEl.style.display = 'inline-block';
    statsEl.style.color = '#7FFFD4';
    statsEl.innerText = "Hesaplanıyor...";
    
    // Tarayıcı önbelleğini kırmak için HTML yapısını JavaScript ile zorluyoruz
    const parent = statsEl.parentElement;
    if (parent) {
        parent.style.display = 'flex';
        parent.style.flexDirection = 'row';
        parent.style.alignItems = 'baseline';
        parent.style.gap = '8px';
    }
    
    const today = new Date();
    const todayStr = today.toLocaleDateString('tr-TR');
    
    db.collection('arizalar')
      .where('status', '==', 'Kapalı')
      .get()
      .then(snapshot => {
          let count = 0;
          let totalMinutes = 0;
          snapshot.forEach(doc => {
              const data = doc.data();
              if (data.completedBy === loggedInOperator.name && data.completedAt) {
                  let compDateObj = null;
                  if (typeof data.completedAt.toDate === 'function') {
                      compDateObj = data.completedAt.toDate();
                  } else {
                      compDateObj = new Date(data.completedAt);
                  }
                  if (compDateObj && !isNaN(compDateObj.getTime())) {
                      if (compDateObj.toLocaleDateString('tr-TR') === todayStr) {
                          count++;
                          if (data.interventions) {
                              data.interventions.forEach(log => {
                                  if (log.operator === loggedInOperator.name && log.durationMin) {
                                      totalMinutes += parseInt(log.durationMin) || 0;
                                  }
                              });
                          }
                      }
                  }
              }
          });
          
          let timeText = "";
          if (totalMinutes > 0) {
              const hours = Math.floor(totalMinutes / 60);
              const mins = totalMinutes % 60;
              if (hours > 0) timeText = ` - ${hours}s ${mins}d`;
              else timeText = ` - ${mins}d`;
          }
          
          statsEl.innerText = `(Bugün ${count} iş${timeText})`;
      }).catch(err => {
          console.error("Stats hatası:", err);
          statsEl.innerText = "";
      });
}

// ----------------------------------------------------
// TEMA VE GÖRÜNÜM AYARLARI
// ----------------------------------------------------
const themeColors = [
    { name: "Orijinal", hex: "#0f172a" },
    { name: "Kırmızı", hex: "#FF0000" }, { name: "Açık Mavi", hex: "#00FFFF" }, { name: "Mavi", hex: "#0000FF" },
    { name: "Koyu Mavi", hex: "#00008B" }, { name: "Bebek Mavisi", hex: "#ADD8E6" }, { name: "Mor", hex: "#800080" },
    { name: "Sarı", hex: "#FFFF00" }, { name: "Fosforlu Yeşil", hex: "#00FF00" }, { name: "Açık Pembe", hex: "#FF00FF" },
    { name: "Pembe", hex: "#FFC0CB" }, { name: "Beyaz", hex: "#FFFFFF" }, { name: "Gümüş", hex: "#C0C0C0" },
    { name: "Gri", hex: "#808080" }, { name: "Siyah", hex: "#000000" }, { name: "Turuncu", hex: "#FFA500" },
    { name: "Kahverengi", hex: "#A52A2A" }, { name: "Bordo", hex: "#800000" }, { name: "Yeşil", hex: "#008000" },
    { name: "Zeytin", hex: "#808000" }, { name: "Turkuaz", hex: "#7FFFD4" }
];

let selectedThemeColor = null;

function openThemeModal() {
    const swatches = document.getElementById('color-swatches');
    swatches.innerHTML = '';
    
    const prefs = getThemePrefs();
    selectedThemeColor = prefs.color;
    document.getElementById('font-size-slider').value = prefs.fontSize;
    previewFontSize(prefs.fontSize);

    themeColors.forEach(c => {
        const btn = document.createElement('button');
        btn.style.backgroundColor = c.hex;
        btn.style.width = '100%';
        btn.style.height = '50px'; // Android uyumluluğu için sabit yükseklik
        btn.style.borderRadius = '8px';
        btn.style.border = (selectedThemeColor === c.hex) ? '3px solid white' : '1px solid rgba(255,255,255,0.2)';
        btn.style.cursor = 'pointer';
        btn.title = c.name;
        btn.onclick = () => {
            selectedThemeColor = c.hex;
            Array.from(swatches.children).forEach(child => child.style.border = '1px solid rgba(255,255,255,0.2)');
            btn.style.border = '3px solid white';
        };
        swatches.appendChild(btn);
    });

    document.getElementById('theme-modal').style.display = 'flex';
}

function closeThemeModal() {
    document.getElementById('theme-modal').style.display = 'none';
}

function previewFontSize(val) {
    const preview = document.getElementById('font-size-preview');
    const rem = 0.7 + (val / 100) * 0.8;
    preview.style.fontSize = rem + 'rem';
    preview.innerText = `Örnek Yazı Boyutu (${val})`;
}

function getThemePrefs() {
    if (!loggedInOperator) return { color: '#0f172a', fontSize: 50 };
    const stored = localStorage.getItem(`themePrefs_${loggedInOperator.pin}`);
    if (stored) return JSON.parse(stored);
    return { color: '#0f172a', fontSize: 50 };
}

function saveThemePrefs() {
    if (!loggedInOperator) return;
    const fontSizeVal = document.getElementById('font-size-slider').value;
    const prefs = {
        color: selectedThemeColor || '#0f172a',
        fontSize: parseInt(fontSizeVal)
    };
    localStorage.setItem(`themePrefs_${loggedInOperator.pin}`, JSON.stringify(prefs));
    applyThemePrefs();
    closeThemeModal();
    
    Swal.fire({
        icon: 'success',
        title: 'Tema Uygulandı!',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 1500
    });
}

function getContrastYIQ(hexcolor){
    hexcolor = hexcolor.replace("#", "");
    var r = parseInt(hexcolor.substr(0,2),16);
    var g = parseInt(hexcolor.substr(2,2),16);
    var b = parseInt(hexcolor.substr(4,2),16);
    var yiq = ((r*299)+(g*587)+(b*114))/1000;
    return (yiq >= 128) ? 'black' : 'white';
}

function applyThemePrefs() {
    if (!loggedInOperator) return;
    const prefs = getThemePrefs();
    
    document.documentElement.style.setProperty('--bg-color', prefs.color);
    const textColor = getContrastYIQ(prefs.color);
    document.documentElement.style.setProperty('--text-main', textColor);
    
    if (textColor === 'black') {
        document.documentElement.style.setProperty('--surface-color', 'rgba(255, 255, 255, 0.4)');
        document.documentElement.style.setProperty('--text-muted', '#333333');
        document.documentElement.style.setProperty('--border-color', 'rgba(0,0,0,0.2)');
    } else {
        document.documentElement.style.setProperty('--surface-color', 'rgba(0, 0, 0, 0.4)');
        document.documentElement.style.setProperty('--text-muted', '#94a3b8');
        document.documentElement.style.setProperty('--border-color', 'rgba(255,255,255,0.1)');
    }

    const rem = 0.7 + (prefs.fontSize / 100) * 0.8;
    document.documentElement.style.fontSize = (16 * rem) + 'px';
}

function resetThemePrefs() {
    document.documentElement.style.setProperty('--bg-color', '#0f172a');
    document.documentElement.style.setProperty('--surface-color', '#1e293b');
    document.documentElement.style.setProperty('--text-main', '#f8fafc');
    document.documentElement.style.setProperty('--text-muted', '#94a3b8');
    document.documentElement.style.setProperty('--border-color', '#475569');
    document.documentElement.style.fontSize = '16px';
}

// ----------------------------------------------------
// WHATSAPP RAPORU OLUŞTURMA
// ----------------------------------------------------
function generateWhatsAppReport() {
    Swal.fire({
        title: 'Rapor Hazırlanıyor...',
        text: 'Lütfen bekleyin',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    const today = new Date();
    const todayStr = today.toLocaleDateString('tr-TR');

    let openTasks = [];
    let completedToday = [];
    let operatorStats = {}; 

    db.collection('arizalar').get().then(snapshot => {
        snapshot.forEach(doc => {
            const data = doc.data();
            
            if (data.status === 'Açık') {
                openTasks.push(data);
            } else if (data.status === 'Kapalı') {
                let compDateObj = null;
                if (data.completedAt) {
                    if (typeof data.completedAt.toDate === 'function') {
                        compDateObj = data.completedAt.toDate();
                    } else {
                        compDateObj = new Date(data.completedAt);
                    }
                }
                
                if (compDateObj && !isNaN(compDateObj.getTime()) && compDateObj.toLocaleDateString('tr-TR') === todayStr) {
                    completedToday.push(data);
                    
                    if (data.interventions) {
                        data.interventions.forEach(log => {
                            if (!operatorStats[log.operator]) {
                                operatorStats[log.operator] = { jobsCompleted: 0, totalMinutes: 0 };
                            }
                            operatorStats[log.operator].totalMinutes += parseInt(log.durationMin) || 0;
                        });
                    }
                    
                    if (data.completedBy) {
                        if (!operatorStats[data.completedBy]) {
                            operatorStats[data.completedBy] = { jobsCompleted: 0, totalMinutes: 0 };
                        }
                        operatorStats[data.completedBy].jobsCompleted += 1;
                    }
                }
            }
        });

        let report = "*VARDİYA / GÜNLÜK TESLİM RAPORU*\n";
        report += "Tarih: " + todayStr + "\n\n";

        report += "*OPERATÖR BİLGİLERİ (Bugün)*\n";
        let opNames = Object.keys(operatorStats);
        if (opNames.length === 0) {
            report += "_Bugün herhangi bir çalışma/müdahale kaydı bulunamadı._\n";
        } else {
            opNames.forEach(op => {
                let stats = operatorStats[op];
                let hours = Math.floor(stats.totalMinutes / 60);
                let mins = stats.totalMinutes % 60;
                let timeStr = hours > 0 ? `${hours}s ${mins}d` : `${mins}d`;
                report += `- *${op}:* ${stats.jobsCompleted} İş Bitirdi (Çalışma: ${timeStr})\n`;
            });
        }
        report += "\n";

        report += "*BİTİRİLEN İŞLER (Bugün)*\n";
        if (completedToday.length === 0) {
            report += "_Bugün kapatılan iş yok._\n";
        } else {
            completedToday.forEach((task, index) => {
                let desc = task.description || "";
                if (desc.length > 30) desc = desc.substring(0, 30) + "...";
                let solver = task.completedBy || "Bilinmiyor";
                let machine = task.machine || "Bilinmeyen Makine";
                report += `${index + 1}. ${machine} - ${desc} (Çözen: ${solver})\n`;
            });
        }
        report += "\n";

        report += "*DİĞER VARDİYAYA KALAN (AÇIK) İŞLER*\n";
        if (openTasks.length === 0) {
            report += "_Harika! Bekleyen hiçbir arıza yok._\n";
        } else {
            openTasks.forEach((task, index) => {
                let desc = task.description || "";
                if (desc.length > 30) desc = desc.substring(0, 30) + "...";
                let assigned = task.assignedTo || "Atanmadı";
                let machine = task.machine || "Bilinmeyen Makine";
                report += `${index + 1}. ${machine} - ${desc} (Görevli: ${assigned})\n`;
            });
        }

        Swal.close();

        // Encode and send
        const encodedText = encodeURIComponent(report);
        const waUrl = `https://wa.me/?text=${encodedText}`;
        window.open(waUrl, '_blank');

    }).catch(err => {
        console.error("Rapor hatası: ", err);
        Swal.fire('Hata!', 'Rapor oluşturulurken bir hata oluştu.', 'error');
    });
}

// ----------------------------------------------------
// YENİ OPERATÖR EKLEME
// ----------------------------------------------------
function openAddOperatorModal() {
    // Sadece adminlerin görmesini istiyorsanız buraya if (!isAdmin) return; ekleyebilirsiniz
    document.getElementById('new-operator-name').value = '';
    document.getElementById('new-operator-pin').value = '';
    document.getElementById('add-operator-modal').style.display = 'flex';
}

function closeAddOperatorModal() {
    document.getElementById('add-operator-modal').style.display = 'none';
}

function saveNewOperator() {
    const nameInput = document.getElementById('new-operator-name').value.trim();
    const pinInput = document.getElementById('new-operator-pin').value.trim();

    if (!nameInput) {
        Swal.fire('Eksik Bilgi', 'Lütfen operatör adını giriniz.', 'warning');
        return;
    }
    if (!pinInput || pinInput.length < 3) {
        Swal.fire('Eksik Bilgi', 'Lütfen en az 3 haneli bir PIN (şifre) giriniz.', 'warning');
        return;
    }

    // Mevcut operatör listesinde bu isim veya pin var mı kontrolü
    const exists = operatorsList.find(op => op.pin === pinInput || op.name.toLowerCase() === nameInput.toLowerCase());
    if (exists) {
        Swal.fire('Hata', 'Bu PIN kodu veya İsim zaten sistemde kayıtlı. Lütfen farklı bir şifre belirleyin.', 'error');
        return;
    }

    // Yeni operatörü listeye ekle
    const newOperator = { name: nameInput, pin: pinInput };
    
    // RAM'deki listeyi güncelle
    operatorsList.push(newOperator);

    // Firebase'e kaydet
    db.collection('settings').doc('config').update({
        operators: operatorsList
    }).then(() => {
        Swal.fire({
            icon: 'success',
            title: 'Başarılı',
            text: newOperator.name + ' sisteme eklendi!',
            timer: 2000,
            showConfirmButton: false
        });
        closeAddOperatorModal();
    }).catch(err => {
        console.error("Operatör ekleme hatası:", err);
        Swal.fire('Hata', 'Veritabanına kaydedilirken bir sorun oluştu.', 'error');
        // Hatada geri al
        operatorsList.pop();
    });
}

// ----------------------------------------------------
// OTOMATİK GÜNLÜK ARŞİVLEME (1 GÜN GEÇMİŞ KAPALI ARIZALAR)
// ----------------------------------------------------
function checkDailySync() {
    const now = new Date();
    const today = now.toLocaleDateString('tr-TR');
    const lastExportDate = localStorage.getItem('lastAutoExportDate');

    // Eğer bugün hiç aktarım yapılmamışsa hemen başlat
    if (lastExportDate !== today) {
        console.log("Yeni gün tespit edildi. Dünün kapalı arızaları Excel'e aktarılıyor...");
        localStorage.setItem('lastAutoExportDate', today);
        autoExportPreviousDayFaults();
    }
}

async function autoExportPreviousDayFaults() {
    try {
        const snapshot = await db.collection('arizalar').where('status', '==', 'Kapalı').get();
        
        const today = new Date();
        const todayStr = today.toLocaleDateString('tr-TR');
        
        let docIdsToDelete = [];
        let exportData = [];
        let validDocs = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            let compDateObj = null;
            if (data.completedAt) {
                if (typeof data.completedAt.toDate === 'function') {
                    compDateObj = data.completedAt.toDate();
                } else {
                    compDateObj = new Date(data.completedAt);
                }
            }

            if (compDateObj && compDateObj.toLocaleDateString('tr-TR') !== todayStr) {
                docIdsToDelete.push(doc.id);
                validDocs.push({ id: doc.id, data: data });
            }
        });

        if (docIdsToDelete.length === 0) {
            return; // Hiç yoksa sessizce çık
        }

        // Gösterge (Toast tarzı bildirim)
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'info',
            title: 'Önceki günün kayıtları arşive gönderiliyor...',
            showConfirmButton: false,
            timer: 3000
        });

        validDocs.forEach(item => {
            const data = item.data;
            let bakimLogu = "Kayıt Yok";
            if (data.interventions && Array.isArray(data.interventions) && data.interventions.length > 0) {
                bakimLogu = data.interventions
                    .filter(inv => inv.actionTaken !== "Yardıma katıldı")
                    .map(inv => {
                        let mainOp = (inv.operator || "Bilinmeyen").toUpperCase();
                        let helperText = "";
                        if (inv.helpers && Array.isArray(inv.helpers)) {
                            let validHelpers = inv.helpers.filter(h => h && h !== inv.operator);
                            if (validHelpers.length > 0) {
                                helperText = ` (Yrd: ${validHelpers.join(", ").toUpperCase()})`;
                            }
                        }
                        let opName = mainOp + helperText;
                        let d = inv.durationMin || 0;
                        let actionStr = "";
                        if (inv.actionTaken === "Arıza ile birlikte yardımı tamamladı") actionStr = "YARDIMI TAMAMLADI";
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
                    data.helpers.forEach(h => {
                        if (h !== data.completedBy) logArr.push(h);
                    });
                }
                bakimLogu = logArr.join(", ");
            }

            let bitTarih = "";
            let bitSaat = "";
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
            let workStartObj = startObj;
            if (data.startedAt) {
                if (typeof data.startedAt.toDate === 'function') workStartObj = data.startedAt.toDate();
                else if (data.startedAt.seconds) workStartObj = new Date(data.startedAt.seconds * 1000);
                else workStartObj = new Date(data.startedAt);
            }
            
            let workBasTarih = basTarih;
            let workBasSaat = basSaat;
            if (workStartObj && !isNaN(workStartObj.getTime())) {
                workBasTarih = workStartObj.toLocaleDateString('tr-TR');
                workBasSaat = workStartObj.toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'});
            }

            let totalStoppageMin = 0;
            if (workStartObj && endObj && !isNaN(workStartObj.getTime()) && !isNaN(endObj.getTime())) {
                totalStoppageMin = Math.max(0, Math.round((endObj - workStartObj) / 60000));
            }

            let startEndHours = "";
            if (workBasSaat && bitSaat) {
                if (workBasTarih !== bitTarih) {
                    startEndHours = `${workBasTarih} ${workBasSaat} - ${bitTarih} ${bitSaat}`;
                } else {
                    startEndHours = `${workBasSaat} - ${bitSaat}`;
                }
            } else if (bitSaat) {
                startEndHours = bitSaat;
            }

            let basTarihVeSaat = basTarih;
            if (basSaat) {
                basTarihVeSaat = basTarih + " " + basSaat;
            }
            
            let formattedStoppage = totalStoppageMin + " dk";
            if (totalStoppageMin > 60) {
                let h = Math.floor(totalStoppageMin / 60);
                let m = totalStoppageMin % 60;
                formattedStoppage = `${h} saat ${m} dk`;
            }

            exportData.push([
                basTarihVeSaat,                
                data.userName || "",           
                data.costCenter || "",         
                data.machine || "",            
                data.shift || "",              
                data.jobType || "",            
                data.description || "",        
                data.photoUrl ? "Var" : "Yok", 
                bakimLogu,                     
                bitTarih,                      
                startEndHours,                 
                formattedStoppage,             
                data.stoppageReason || "",     
                data.faultReason || "",        
                data.actionTaken || "",        
                data.partsChanged || ""        
            ]);
        });

        const payload = {
            action: "exportClosedFaults",
            data: exportData
        };

        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        
        if (result.success) {
            const batch = db.batch();
            docIdsToDelete.forEach(id => {
                batch.delete(db.collection('arizalar').doc(id));
            });
            await batch.commit();

            const nowStr = new Date().toLocaleString('tr-TR');
            localStorage.setItem('lastAutoExportFullDate', nowStr);
            
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'Dünün kayıtları arşivlendi.',
                showConfirmButton: false,
                timer: 3000
            });
        }
    } catch (err) {
        console.error("Otomatik aktarım hatası:", err);
    }
}

// ----------------------------------------------------
// HAFTALIK OPERATÖR ÇALIŞMA SÜRESİ İSTATİSTİĞİ
// ----------------------------------------------------
async function updateWeeklyStats(operatorName, durationMin) {
    if (!operatorName) return;
    
    // Süre yoksa veya eksi gelirse 0 kabul et
    durationMin = Math.max(0, parseInt(durationMin) || 0);
    
    try {
        const docRef = db.collection('settings').doc('weeklyStats');
        const docSnap = await docRef.get();
        
        let data = { weekStartDate: "", stats: {} };
        if (docSnap.exists) {
            data = docSnap.data();
            if (!data.stats) data.stats = {};
        }

        // Pazartesi'yi bul
        const d = new Date();
        const day = d.getDay(); 
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff)).toLocaleDateString('tr-TR');

        // Eğer yeni haftaya girilmişse sıfırla
        if (data.weekStartDate !== monday) {
            data.weekStartDate = monday;
            data.stats = {}; 
        }

        const daysTr = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
        const todayName = daysTr[new Date().getDay()];
        
        const opName = operatorName.toUpperCase();
        if (!data.stats[opName]) {
            data.stats[opName] = { 
                "Pazartesi": {mins:0, count:0}, 
                "Salı": {mins:0, count:0}, 
                "Çarşamba": {mins:0, count:0}, 
                "Perşembe": {mins:0, count:0}, 
                "Cuma": {mins:0, count:0}, 
                "Cumartesi": {mins:0, count:0}, 
                "Pazar": {mins:0, count:0} 
            };
        }
        
        // Geriye dönük uyumluluk (Eğer daha önceki kayıt sadece sayıysa objeye çevir)
        let currentData = data.stats[opName][todayName];
        if (typeof currentData === 'number') {
            currentData = { mins: currentData, count: currentData > 0 ? 1 : 0 };
        } else if (!currentData) {
            currentData = { mins: 0, count: 0 };
        }
        
        currentData.mins += durationMin;
        currentData.count += 1; // Her müdahalede işlem sayısını 1 artır

        data.stats[opName][todayName] = currentData;

        await docRef.set(data);
    } catch (error) {
        console.error("Haftalık istatistik güncellenirken hata:", error);
    }
}

// ----------------------------------------------------
// GÖRÜNÜM AYARLARI (VIEW SETTINGS)
// ----------------------------------------------------
function openOpViewSettingsModal() {
    document.getElementById('op-view-settings-modal').style.display = 'flex';
}

function closeOpViewSettingsModal(save) {
    document.getElementById('op-view-settings-modal').style.display = 'none';
    if (save) {
        Swal.fire({
            icon: 'success',
            title: 'Ayarlar Kaydedildi',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 1500
        });
        fetchOpenFaults();
    }
}

function switchViewTab(tabId) {
    document.getElementById('tab-guncel').style.display = 'none';
    document.getElementById('tab-atanan').style.display = 'none';
    document.getElementById('tab-eski').style.display = 'none';

    document.getElementById('btn-tab-guncel').style.background = 'transparent';
    document.getElementById('btn-tab-guncel').style.color = 'var(--text-muted)';
    
    document.getElementById('btn-tab-atanan').style.background = 'transparent';
    document.getElementById('btn-tab-atanan').style.color = 'var(--text-muted)';
    
    document.getElementById('btn-tab-eski').style.background = 'transparent';
    document.getElementById('btn-tab-eski').style.color = 'var(--text-muted)';

    document.getElementById(tabId).style.display = 'block';
    
    const activeBtn = document.getElementById('btn-' + tabId);
    activeBtn.style.background = 'var(--primary)';
    activeBtn.style.color = 'white';
}

function saveOpSettings() {
    const config = {};
    const ids = [
        'op-set-guncel-type', 'op-set-guncel-date', 'op-set-guncel-shift', 'op-set-guncel-reporter', 'op-set-guncel-assignee', 'op-set-guncel-desc',
        'op-set-atanan-type', 'op-set-atanan-date', 'op-set-atanan-shift', 'op-set-atanan-reporter', 'op-set-atanan-assignee', 'op-set-atanan-desc',
        'op-set-eski-type', 'op-set-eski-group', 'op-set-eski-date', 'op-set-eski-shift', 'op-set-eski-reporter', 'op-set-eski-assignee', 'op-set-eski-desc'
    ];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            config[id] = el.type === 'checkbox' ? el.checked : el.value;
        }
    });
    localStorage.setItem('opSettingsConfig', JSON.stringify(config));
}

function loadOpSettings() {
    const saved = localStorage.getItem('opSettingsConfig');
    if (!saved) return;
    try {
        const config = JSON.parse(saved);
        Object.keys(config).forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                if (el.type === 'checkbox') el.checked = config[id];
                else el.value = config[id];
            }
        });
    } catch(e) {
        console.error("Op Settings parse error:", e);
    }
}

function previewOpSettings() {
    saveOpSettings();
    // Sadece fetchOpenFaults'u çağır, böylece DOM hemen güncellenir
    fetchOpenFaults();
}

// --- MESAJLAŞMA SİSTEMİ (P2P BANNER) ---

let messagesUnsubscribe = null;

function openSendMessageModal() {
    document.getElementById('modal-send-message-text').value = '';
    const targetsContainer = document.getElementById('send-message-targets');
    
    // Checkbox listesini oluştur
    let html = `
        <label style="display:flex; align-items:center; gap:8px; margin-bottom: 8px; color: var(--text-color); font-weight: bold; border-bottom: 1px solid var(--border-color); padding-bottom: 5px;">
            <input type="checkbox" id="msg-target-all" checked onchange="toggleAllMsgTargets(this)"> HERKESE GÖNDER (Tüm Kullanıcılar)
        </label>
        <div id="msg-individual-targets" style="display:none; padding-left: 10px; flex-direction: column; gap: 5px;">
    `;
    
    operatorsList.forEach(op => {
        if (op.name !== loggedInOperator.name) {
            html += `
                <label style="display:flex; align-items:center; gap:8px; color: var(--text-muted);">
                    <input type="checkbox" class="msg-target-cb" value="${op.name}"> ${op.name}
                </label>
            `;
        }
    });
    
    html += `</div>`;
    targetsContainer.innerHTML = html;
    
    document.getElementById('send-message-modal').style.display = 'flex';
}

function toggleAllMsgTargets(checkbox) {
    const indDiv = document.getElementById('msg-individual-targets');
    if (checkbox.checked) {
        indDiv.style.display = 'none';
    } else {
        indDiv.style.display = 'flex';
    }
}

async function submitSendMessage() {
    const text = document.getElementById('modal-send-message-text').value.trim();
    if (!text) {
        alert("Lütfen bir mesaj yazın.");
        return;
    }
    
    const isAll = document.getElementById('msg-target-all').checked;
    let targetUsers = [];
    
    if (isAll) {
        targetUsers = ["ALL"];
    } else {
        const checkboxes = document.querySelectorAll('.msg-target-cb:checked');
        checkboxes.forEach(cb => targetUsers.push(cb.value));
        if (targetUsers.length === 0) {
            alert("Lütfen en az bir kişi seçin veya Herkese Gönder'i işaretleyin.");
            return;
        }
    }
    
    const sendBtn = document.querySelector('#send-message-modal .btn-primary');
    sendBtn.innerText = "Gönderiliyor...";
    sendBtn.disabled = true;
    
    try {
        await db.collection('messages').add({
            sender: loggedInOperator.name,
            text: text,
            targetUsers: targetUsers,
            readBy: [],
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        document.getElementById('send-message-modal').style.display = 'none';
        Swal.fire({ title: 'Başarılı', text: 'Mesajınız gönderildi!', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (e) {
        console.error("Mesaj gönderme hatası:", e);
        alert("Mesaj gönderilemedi: " + e.message);
    } finally {
        sendBtn.innerText = "Gönder";
        sendBtn.disabled = false;
    }
}

function listenForMessages() {
    if (messagesUnsubscribe) messagesUnsubscribe();
    if (!loggedInOperator) return;
    
    // Son 24 saatteki mesajları dinle
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    messagesUnsubscribe = db.collection('messages')
        .where('createdAt', '>=', yesterday)
        .onSnapshot(snapshot => {
            let activeMsg = null;
            
            // Tüm mesajları tara, benim okumadığım ilk mesajı bul
            snapshot.docs.forEach(doc => {
                const msg = { id: doc.id, ...doc.data() };
                const isTarget = msg.targetUsers.includes("ALL") || msg.targetUsers.includes(loggedInOperator.name);
                const isRead = msg.readBy && msg.readBy.includes(loggedInOperator.name);
                const isSender = msg.sender === loggedInOperator.name;
                
                // Eğer hedef ben isem, henüz okumadıysam ve gönderen ben değilsem
                if (isTarget && !isRead && !isSender) {
                    if (!activeMsg) activeMsg = msg; 
                }
            });
            
            const banner = document.getElementById('message-banner');
            const senderNameEl = document.getElementById('message-sender-name');
            const textEl = document.getElementById('message-banner-text');
            const readBtn = document.getElementById('btn-message-read');
            const replyBtn = document.getElementById('btn-message-reply');
            
            if (activeMsg) {
                senderNameEl.innerText = activeMsg.sender;
                textEl.innerText = activeMsg.text;
                
                // Eğer banner zaten açık değilse sesi çal (Sürekli çalmaması için)
                if (banner.style.display === 'none') {
                    try {
                        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                        const osc = audioCtx.createOscillator();
                        const gain = audioCtx.createGain();
                        osc.type = 'triangle';
                        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
                        osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
                        gain.gain.setValueAtTime(0, audioCtx.currentTime);
                        gain.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.05);
                        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
                        osc.connect(gain);
                        gain.connect(audioCtx.destination);
                        osc.start();
                        osc.stop(audioCtx.currentTime + 0.3);
                    } catch(e) {}
                }
                
                banner.style.display = 'flex';
                readBtn.onclick = () => markMessageAsRead(activeMsg.id);
                if(replyBtn) replyBtn.onclick = () => replyToMessage(activeMsg.sender, activeMsg.id);
            } else {
                banner.style.display = 'none';
            }
        });
}

function replyToMessage(senderName, msgId) {
    // Mesaj gönderme modalını aç (Senkron olarak HTML'i oluşturur)
    openSendMessageModal();
    
    // Herkese gönderi kaldır ve sadece gönderen kişiyi seç (Senkron işlem)
    const allCb = document.getElementById('msg-target-all');
    if(allCb) {
        allCb.checked = false;
        toggleAllMsgTargets(allCb);
    }
    
    const checkboxes = document.querySelectorAll('.msg-target-cb');
    checkboxes.forEach(cb => {
        if(cb.value === senderName) {
            cb.checked = true;
        } else {
            cb.checked = false;
        }
    });
    
    // Mobil cihazlarda klavyenin açılabilmesi için focus() işleminin tıklama anında senkron olması gerekir
    const textArea = document.getElementById('modal-send-message-text');
    if(textArea) {
        textArea.focus();
    }
    
    // Mesajı okundu olarak işaretle (kapat) - Firebase isteğini en sona bırak
    markMessageAsRead(msgId);
}

async function markMessageAsRead(msgId) {
    if (!loggedInOperator) return;
    
    const readBtn = document.getElementById('btn-message-read');
    readBtn.innerText = "...";
    readBtn.disabled = true;
    
    try {
        await db.collection('messages').doc(msgId).update({
            readBy: firebase.firestore.FieldValue.arrayUnion(loggedInOperator.name)
        });
    } catch (e) {
        console.error("Okundu işaretleme hatası:", e);
    } finally {
        readBtn.innerText = "Okudum";
        readBtn.disabled = false;
    }
}

// --- ADMİN MESAJ İZLEME (HAYALET MOD) ---
async function openAdminMessageMonitor() {
    const listBody = document.getElementById('admin-message-monitor-list');
    listBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Mesajlar yükleniyor...</td></tr>';
    document.getElementById('admin-message-monitor-modal').style.display = 'flex';
    
    try {
        const snapshot = await db.collection('messages')
            .orderBy('createdAt', 'desc')
            .limit(100)
            .get();
            
        listBody.innerHTML = '';
        
        if(snapshot.empty) {
            listBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--text-muted);">Sistemde kayıtlı mesaj bulunmuyor.</td></tr>';
            return;
        }
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const id = doc.id;
            const dateStr = data.createdAt ? data.createdAt.toDate().toLocaleString('tr-TR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}) : 'Bilinmiyor';
            
            const targetsStr = (data.targetUsers && data.targetUsers.includes("ALL")) ? '<span style="color:#22c55e; font-weight:bold;">HERKES</span>' : (data.targetUsers ? data.targetUsers.join(', ') : '-');
            const readByStr = (data.readBy && data.readBy.length > 0) ? data.readBy.join(', ') : '<span style="color:#ef4444;">Kimse Okumadı</span>';
            
            listBody.innerHTML += `
                <tr>
                    <td style="color:var(--text-muted);">${dateStr}</td>
                    <td style="font-weight:bold; color:var(--primary);">${data.sender}</td>
                    <td>${targetsStr}</td>
                    <td>${data.text}</td>
                    <td style="font-size:0.8rem; color:var(--text-muted);">${readByStr}</td>
                    <td>
                        <button onclick="deleteAdminMessage('${id}')" style="background:#ef4444; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">Sil</button>
                    </td>
                </tr>
            `;
        });
    } catch (e) {
        console.error("Mesajlar çekilemedi:", e);
        listBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: red;">Mesajlar yüklenirken bir hata oluştu.</td></tr>';
    }
}

async function deleteAdminMessage(id) {
    if(confirm("Bu mesajı sistemden tamamen silmek istediğinize emin misiniz? (Alıcıların ekranından da kaybolur)")) {
        try {
            await db.collection('messages').doc(id).delete();
            // Listeyi yenile
            openAdminMessageMonitor();
        } catch(e) {
            alert("Hata oluştu: " + e.message);
        }
    }
}

async function deleteAllAdminMessages() {
    if(confirm("DİKKAT: Sistemdeki TÜM mesajları silmek üzeresiniz. Bu işlem geri alınamaz. Emin misiniz?")) {
        try {
            const snapshot = await db.collection('messages').get();
            if(snapshot.empty) {
                alert("Silinecek mesaj bulunmuyor.");
                return;
            }
            
            const batch = db.batch();
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            await batch.commit();
            alert("Tüm mesajlar başarıyla silindi!");
            openAdminMessageMonitor(); // Listeyi yenile
        } catch(e) {
            console.error("Toplu silme hatası:", e);
            alert("Hata oluştu: " + e.message);
        }
    }
}







