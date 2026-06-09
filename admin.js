// FIREBASE BAĞLANTISI
const firebaseConfig = {
    apiKey: "AIzaSyAEqLYUevIJCcLrJa-05MXx5ik-QFouq9o",
    authDomain: "arizabildirim-89dfa.firebaseapp.com",
    projectId: "arizabildirim-89dfa",
    storageBucket: "arizabildirim-89dfa.firebasestorage.app",
    messagingSenderId: "106785239667",
    appId: "1:106785239667:web:ab131b6a11d8133a537006"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// Sizin Google Apps Script Web App Linkiniz
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx0TxZ8yjyP7v3q3tYqMxKs7stPL7g7AvhLRxOfm3Ovci0QGD8vM_IwhkmXBc0wu5BZ/exec";

let localOperators = [];
let localRootCauses = [];
let isDirty = false; // Değişiklik yapıldı mı?
let editingIndex = -1; // -1 = Yeni ekleme, 0+ = Düzenleme

document.addEventListener("DOMContentLoaded", () => {
    // Admin kontrolü
    const savedOp = localStorage.getItem("loggedInOperator");
    if (!savedOp) {
        alert("Lütfen önce giriş yapın!");
        window.location.href = 'index.html';
        return;
    }
    
    const op = JSON.parse(savedOp);
    const role = (op.role || "").toLocaleLowerCase('tr-TR');
    if (!role.includes('admin') && !role.includes('admın') && !role.includes('yönetici') && !role.includes('yonetici')) {
        alert("Bu sayfaya girme yetkiniz yok!");
        window.location.href = 'index.html';
        return;
    }

    // Firebase'den mevcut listeyi çek
    loadFromFirebase();
});

async function loadFromFirebase() {
    try {
        const docRef = db.collection('settings').doc('config');
        const docSnap = await docRef.get();

        if (docSnap.exists) {
            const data = docSnap.data();
            localOperators = data.operators || [];
            localRootCauses = data.rootCauses || [];
            
            const lastExport = localStorage.getItem('lastAutoExportFullDate');
            if (lastExport) {
                document.getElementById('last-export-time-label').innerText = lastExport;
            }
            
            checkDailySync();
            renderOperators();
        } else {
            // Boşsa Excel'den çek
            fetchFromExcel();
        }
    } catch (error) {
        console.error("Firebase Hatası:", error);
    }
}

// ----------------------------------------------------
// UI İŞLEMLERİ
// ----------------------------------------------------

function renderOperators() {
    const listDiv = document.getElementById('operator-list');
    document.getElementById('op-count').innerText = localOperators.length;
    
    if (localOperators.length === 0) {
        listDiv.innerHTML = '<p style="text-align:center; color:gray;">Sistemde operatör bulunamadı.</p>';
        return;
    }

    listDiv.innerHTML = '';
    
    localOperators.forEach((op, index) => {
        // Resim formatla (Drive linki varsa çevir)
        let imgUrl = "https://cdn-icons-png.flaticon.com/512/149/149071.png"; // Varsayılan
        if (op.imageUrl) {
            imgUrl = op.imageUrl;
            const driveMatch = imgUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
            if (driveMatch && driveMatch[1]) {
                imgUrl = `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=w500`;
            }
        }

        const card = document.createElement('div');
        card.className = 'op-card';
        card.innerHTML = `
            <img src="${imgUrl}" class="op-img" alt="Foto">
            <div class="op-info">
                <h3 style="margin:0; font-size:1.1rem; color:var(--text-color);">${op.name}</h3>
                <p style="margin:0; font-size:0.85rem; color:var(--text-muted);">
                    PIN: <strong style="color:var(--primary);">${op.pin}</strong> 
                    | Yetki: ${op.role || "Yok"}
                </p>
            </div>
            <div class="op-actions">
                <button class="btn-edit" onclick="editOperator(${index})">DÜZENLE</button>
                <button class="btn-del" onclick="deleteOperator(${index})">SİL</button>
            </div>
        `;
        listDiv.appendChild(card);
    });
}

function editOperator(index) {
    const op = localOperators[index];
    document.getElementById('new-name').value = op.name;
    document.getElementById('new-pin').value = op.pin;
    document.getElementById('new-role').value = op.role || '';
    document.getElementById('new-img').value = op.imageUrl || '';
    
    editingIndex = index;
    const btn = document.getElementById('btn-add-op');
    btn.innerText = "💾 Güncelle";
    btn.style.background = "#3b82f6"; // mavi

    document.getElementById('modal-title').innerText = "✏️ Operatör Düzenle";
    
    // Modalı aç
    document.getElementById('operator-modal').style.display = 'flex';
}

function addOperator() {
    const name = document.getElementById('new-name').value.trim();
    const pin = document.getElementById('new-pin').value.trim();
    const role = document.getElementById('new-role').value.trim();
    const img = document.getElementById('new-img').value.trim();

    if (!name || !pin) {
        alert("Lütfen Ad Soyad ve PIN kodunu mutlaka doldurun!");
        return;
    }

    // Aynı PIN var mı kontrol et (düzenlenen kişi hariç)
    const existingIndex = localOperators.findIndex(o => String(o.pin) === String(pin));
    if (existingIndex > -1 && existingIndex !== editingIndex) {
        alert("Bu PIN kodu zaten başka bir operatörde kullanılıyor!");
        return;
    }

    if (editingIndex > -1) {
        // Mevcut operatörü güncelle
        localOperators[editingIndex] = {
            name: name,
            pin: pin,
            role: role,
            imageUrl: img
        };
        editingIndex = -1;
        const btn = document.getElementById('btn-add-op');
        btn.innerText = "➕ Ekle";
        btn.style.background = "var(--primary)";
    } else {
        // Yeni ekle
        localOperators.push({
            name: name,
            pin: pin,
            role: role,
            imageUrl: img
        });
    }

    document.getElementById('new-name').value = '';
    document.getElementById('new-pin').value = '';
    document.getElementById('new-role').value = '';
    document.getElementById('new-img').value = '';

    markAsDirty();
    renderOperators();
    closeOperatorModal();
}

function openModalForAdd() {
    document.getElementById('new-name').value = '';
    document.getElementById('new-pin').value = '';
    document.getElementById('new-role').value = '';
    document.getElementById('new-img').value = '';
    
    editingIndex = -1;
    const btn = document.getElementById('btn-add-op');
    btn.innerText = "➕ Ekle";
    btn.style.background = "var(--primary)";
    
    document.getElementById('modal-title').innerText = "➕ Yeni Operatör Ekle";
    document.getElementById('operator-modal').style.display = 'flex';
}

function closeOperatorModal() {
    document.getElementById('operator-modal').style.display = 'none';
}

function deleteOperator(index) {
    const op = localOperators[index];
    if (confirm(`${op.name} isimli operatörü silmek istediğinize emin misiniz?`)) {
        localOperators.splice(index, 1);
        markAsDirty();
        renderOperators();
    }
}

function markAsDirty() {
    isDirty = true;
    document.getElementById('btn-save-changes').style.display = 'flex';
}

// ----------------------------------------------------
// VERİTABANI SENKRONİZASYON İŞLEMLERİ
// ----------------------------------------------------

// Değişiklikleri Excel'e ve Firebase'e Kaydet (POST)
async function saveToSystem() {
    if (!isDirty) return;

    const btn = document.getElementById('btn-save-changes');
    btn.innerText = "⏳ KAYDEDİLİYOR (Bekleyin)...";
    btn.style.animation = "none";
    btn.disabled = true;

    try {
        const payload = {
            action: "updateOperators",
            operators: localOperators
        };

        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Excel'e başarıyla yazıldı, şimdi Firebase'i güncelle
            await db.collection('settings').doc('config').set({
                operators: localOperators,
                rootCauses: localRootCauses, // Kök nedenler aynı kalır
                faultReasons: result.data ? result.data.faultReasons || [] : [],
                stoppageReasons: result.data ? result.data.stoppageReasons || [] : [],
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });

            btn.innerText = "✅ SİSTEM GÜNCELLENDİ!";
            btn.style.background = "var(--primary)";
            
            setTimeout(() => {
                btn.style.display = 'none';
                btn.innerText = "💾 DEĞİŞİKLİKLERİ SİSTEME KAYDET";
                btn.style.background = "linear-gradient(135deg, #10b981, #047857)";
                btn.style.animation = "pulse 1.5s infinite";
                btn.disabled = false;
                isDirty = false;
            }, 3000);

        } else {
            alert("Excel'e yazarken hata oluştu: " + result.error);
            restoreSaveBtn(btn);
        }
    } catch (error) {
        console.error("Kayıt Hatası:", error);
        alert("Bağlantı hatası yaşandı! Veriler kaydedilemedi.");
        restoreSaveBtn(btn);
    }
}

function restoreSaveBtn(btn) {
    btn.innerText = "💾 DEĞİŞİKLİKLERİ SİSTEME KAYDET";
    btn.style.animation = "pulse 1.5s infinite";
    btn.disabled = false;
}

// Zorla Excel'den Güncelle (GET)
async function fetchFromExcel() {
    if (isDirty) {
        if (!confirm("Kaydedilmemiş değişiklikleriniz var! Excel'den veri çekerseniz buradaki ekleme/silme işlemleriniz iptal olur. Devam edilsin mi?")) {
            return;
        }
    }

    const btn = document.getElementById('btn-fetch');
    const oldText = btn.innerText;
    btn.innerText = "⏳ Excel'den İndiriliyor...";
    btn.disabled = true;

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL);
        const result = await response.json();
        
        if (result.success && result.data) {
            localOperators = result.data.operators;
            localRootCauses = result.data.rootCauses || [];
            const localFaultReasons = result.data.faultReasons || [];
            const localStoppageReasons = result.data.stoppageReasons || [];
            
            await db.collection('settings').doc('config').set({
                operators: localOperators,
                rootCauses: localRootCauses,
                faultReasons: localFaultReasons,
                stoppageReasons: localStoppageReasons,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });

            isDirty = false;
            document.getElementById('btn-save-changes').style.display = 'none';
            renderOperators();
            
            btn.innerText = "✅ Excel ile Eşitlendi!";
            setTimeout(() => {
                btn.innerText = oldText;
                btn.disabled = false;
            }, 3000);
        } else {
            alert("Hata: " + result.message);
            btn.innerText = oldText;
            btn.disabled = false;
        }
    } catch (error) {
        console.error("Senkronizasyon Hatası:", error);
        alert("Bağlantı hatası yaşandı!");
        btn.innerText = oldText;
        btn.disabled = false;
    }
}

// ----------------------------------------------------
// ARŞİVLEME VE TEMİZLİK
// ----------------------------------------------------

// Sayfa ilk açıldığında bugün aktarım yapılmış mı diye kontrol eden fonksiyon
function checkDailySync() {
    const now = new Date();
    const today = now.toLocaleDateString('tr-TR');
    const lastExportDate = localStorage.getItem('lastAutoExportDate');

    // Eğer bugün hiç aktarım yapılmamışsa hemen başlat
    if (lastExportDate !== today) {
        console.log("Yeni gün tespit edildi. Dünün kapalı arızaları Excel'e aktarılıyor...");
        localStorage.setItem('lastAutoExportDate', today);
        exportAndCleanClosedFaults();
    }
}

async function exportAndCleanClosedFaults() {
    const btn = document.getElementById('btn-manual-export');
    const oldText = btn.innerHTML;
    if (btn) {
        btn.innerHTML = "⏳ İŞLEM YAPILIYOR LÜTFEN BEKLEYİN...";
        btn.disabled = true;
    }

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

            // Sadece kapanma tarihi BUGÜN OLMAYAN (1 gün geçmiş) kayıtları al
            if (compDateObj && compDateObj.toLocaleDateString('tr-TR') !== todayStr) {
                docIdsToDelete.push(doc.id);
                validDocs.push({ id: doc.id, data: data });
            }
        });

        if (docIdsToDelete.length === 0) {
            alert("Aktarılacak eski kapalı arıza bulunamadı! (Bugün kapatılanlar gün sonuna kadar kalır)");
            const nowStr = new Date().toLocaleString('tr-TR');
            localStorage.setItem('lastAutoExportFullDate', nowStr);
            const lbl = document.getElementById('last-export-time-label');
            if (lbl) lbl.innerText = nowStr;
            
            if (btn) {
                btn.innerHTML = oldText;
                btn.disabled = false;
            }
            return;
        }

        validDocs.forEach(item => {
            const data = item.data;

            // Bakım Logu ve Toplam Süre Hesaplama
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
                    
                    // Yardımcı mesajlarını olduğu gibi koru
                    if (inv.actionTaken === "Arıza ile birlikte yardımı tamamladı") {
                        actionStr = "YARDIMI TAMAMLADI";
                    } else if (inv.actionTaken === "Durum değişti, yardımdan ayrıldı" || inv.actionTaken === "Yardımdan ayrıldı") {
                        actionStr = "YARDIMDAN AYRILDI";
                    } 
                    // Ana operatör durumları
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
                // Eski sistem geriye dönük uyumluluk (Eğer intervention yoksa)
                let logArr = [];
                if (data.completedBy) logArr.push(data.completedBy);
                if (data.helpers && Array.isArray(data.helpers)) {
                    data.helpers.forEach(h => {
                        if (h !== data.completedBy) logArr.push(h);
                    });
                }
                bakimLogu = logArr.join(", ");
                totalDuration = data.durationMin || 0;
            }

            // Tarih ve saat parçalama
            let bitTarih = "";
            let bitSaat = "";
            if (data.completedAt) {
                let d = new Date(data.completedAt);
                bitTarih = d.toLocaleDateString('tr-TR');
                bitSaat = d.toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'});
            }

            // A Sütunu Tarihi Düzeltme (Obje veya String olabilir) ve Toplam Duruş Süresi Hesaplama
            let basTarih = data.createdAt || "";
            let basSaat = "";
            let startObj = null;
            if (data.createdAt) {
                if (typeof data.createdAt.toDate === 'function') {
                    startObj = data.createdAt.toDate();
                } else if (data.createdAt.seconds) {
                    startObj = new Date(data.createdAt.seconds * 1000);
                } else {
                    startObj = new Date(data.createdAt);
                }
                
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
                basTarihVeSaat,                // A (Tarih ve Saat)
                data.userName || "",           // B
                data.costCenter || "",         // C
                data.machine || "",            // D
                data.shift || "",              // E
                data.jobType || "",            // F
                data.description || "",        // G
                data.photoUrl ? "Var" : "Yok", // H
                bakimLogu,                     // I
                bitTarih,                      // J
                startEndHours,                 // K (Start - Bitiş Saatleri)
                formattedStoppage,             // L (Makine Toplam Duruşu)
                data.stoppageReason || "",     // M
                data.faultReason || "",        // N (Yer Değiştirdi: Arıza Nedeni -> YAPILAN BAKIM sütunu)
                data.actionTaken || "",        // O (Yer Değiştirdi: Açıklama -> AÇIKLAMA sütunu)
                data.partsChanged || ""        // P
            ]);
        });

        // Apps Script'e gönder
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
            // Başarılı olursa Firebase'den sil
            const batch = db.batch();
            docIdsToDelete.forEach(id => {
                batch.delete(db.collection('arizalar').doc(id));
            });
            await batch.commit();
            
            const nowStr = new Date().toLocaleString('tr-TR');
            localStorage.setItem('lastAutoExportFullDate', nowStr);
            const lbl = document.getElementById('last-export-time-label');
            if (lbl) lbl.innerText = nowStr;

            alert(`✅ İşlem Başarılı!\n${docIdsToDelete.length} adet arıza Excel'e aktarıldı ve sistemden silindi.`);
        } else {
            alert("Excel'e aktarılırken hata oluştu: " + result.error);
        }

    } catch (err) {
        console.error(err);
        alert("Bağlantı veya işlem hatası: " + err.message);
    } finally {
        btn.innerHTML = oldText;
        btn.disabled = false;
    }
}

// ------------------------------------------------------------------
// HAFTALIK ÇALIŞMA RAPORU (MODAL VE PDF)
// ------------------------------------------------------------------
async function openWeeklyReportModal() {
    const modal = document.getElementById('weekly-report-modal');
    const tbody = document.getElementById('weekly-report-tbody');
    const lblWeek = document.getElementById('report-week-start-date');
    
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 20px;">Yükleniyor...</td></tr>';
    modal.style.display = 'flex';

    try {
        const docRef = db.collection('settings').doc('weeklyStats');
        const docSnap = await docRef.get();
        
        if (!docSnap.exists) {
            // TEST AMAÇLI DUMMY VERİ OLUŞTUR
            const d = new Date();
            const day = d.getDay(); 
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(d.setDate(diff)).toLocaleDateString('tr-TR');
            
            const dummyData = {
                weekStartDate: monday,
                stats: {
                    "SİSTEM TEST (SİLEBİLİRSİNİZ)": {
                        "Pazartesi": {mins: 0, count: 0},
                        "Salı": {mins: 5, count: 1},
                        "Çarşamba": {mins: 0, count: 0},
                        "Perşembe": {mins: 0, count: 0},
                        "Cuma": {mins: 0, count: 0},
                        "Cumartesi": {mins: 0, count: 0},
                        "Pazar": {mins: 0, count: 0}
                    }
                }
            };
            await docRef.set(dummyData);
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 20px; color: green;">Sistem sıfırdan başlatıldı. Lütfen pencereyi kapatıp tekrar açın.</td></tr>';
            return;
        }

        const data = docSnap.data();
        lblWeek.innerText = data.weekStartDate || "Bilinmiyor";

        const stats = data.stats || {};
        const days = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
        
        let html = "";
        
        const allOperators = localOperators.map(op => op.name.toUpperCase());
        Object.keys(stats).forEach(op => {
            if (!allOperators.includes(op) && op !== "SİSTEM TEST (SİLEBİLİRSİNİZ)") {
                allOperators.push(op);
            }
        });
        
        allOperators.sort();

        allOperators.forEach(operatorName => {
            const opStats = stats[operatorName] || {};
            let totalMin = 0;
            let totalCount = 0;
            let rowHtml = `<td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: bold;">${operatorName}</td>`;
            
            days.forEach(d => {
                const statVal = opStats[d];
                let mins = 0;
                let count = 0;
                
                if (typeof statVal === 'number') {
                    mins = statVal;
                    count = mins > 0 ? 1 : 0;
                } else if (statVal && typeof statVal === 'object') {
                    mins = statVal.mins || 0;
                    count = statVal.count || 0;
                }
                
                totalMin += mins;
                totalCount += count;
                
                let display = mins > 0 ? (mins >= 60 ? `${Math.floor(mins/60)}s ${mins%60}d` : `${mins}d`) : "-";
                if (count > 0) {
                    display += `<br><small style="color:#64748b;">(${count} Müd.)</small>`;
                }
                rowHtml += `<td style="padding: 10px; border: 1px solid #cbd5e1; text-align: center;">${display}</td>`;
            });
            
            let totalDisplay = totalMin > 0 ? (totalMin >= 60 ? `${Math.floor(totalMin/60)}s ${totalMin%60}d` : `${totalMin}d`) : "0d";
            if (totalCount > 0) {
                totalDisplay += `<br><small style="color:#64748b;">(${totalCount} İşlem)</small>`;
            }
            rowHtml += `<td style="padding: 10px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; background-color: #f1f5f9;">${totalDisplay}</td>`;
            
            html += `<tr>${rowHtml}</tr>`;
        });

        if (html === "") {
            html = '<tr><td colspan="9" style="text-align:center; padding: 20px;">Bu hafta için henüz kayıt yok.</td></tr>';
        }

        tbody.innerHTML = html;
        
    } catch (err) {
        console.error("Rapor çekilirken hata:", err);
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 20px; color: red;">Veri çekilirken hata oluştu.</td></tr>';
    }
}

function exportReportToPDF() {
    const element = document.getElementById('weekly-report-content');
    const weekStart = document.getElementById('report-week-start-date').innerText;
    
    // PDF Ayarları
    const opt = {
      margin:       10,
      filename:     `Haftalik_Calisma_Raporu_${weekStart}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    // html2pdf kütüphanesini kullanarak PDF oluştur ve indir
    html2pdf().set(opt).from(element).save();
}
