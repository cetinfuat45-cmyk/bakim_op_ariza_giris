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
let db = firebase.firestore();
let currentOpenFaults = []; // Taranan makineyi bulmak için RAM'de tutulacak

// Sizin Google Apps Script Web App Linkiniz
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx0TxZ8yjyP7v3q3tYqMxKs7stPL7g7AvhLRxOfm3Ovci0QGD8vM_IwhkmXBc0wu5BZ/exec";

// Global Değişkenler
let operatorsList = [];
let rootCausesList = [];
let loggedInOperator = null;

// Sayfa yüklendiğinde çalışacaklar
document.addEventListener("DOMContentLoaded", () => {
    // 1. Önce verileri Firebase'den çek
    fetchConfigFromFirebase();
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
                rootCauses: result.data.rootCauses,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });

            operatorsList = result.data.operators;
            rootCausesList = result.data.rootCauses;
            
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

function openSettings() {
    document.getElementById('settings-modal').style.display = 'flex';
}

function closeSettings() {
    document.getElementById('settings-modal').style.display = 'none';
}

async function updateMachineList() {
    // Kullanıcı sekmeyi 1. sıraya aldıysa varsayılan (ilk) sekme çekilir.
    const url = `https://docs.google.com/spreadsheets/d/13pjcli1vFeM_DuHk7y5HV1DBpqXE_IlaQtdhMsvf_6U/gviz/tq?tqx=out:json&t=${new Date().getTime()}`;
    
    const btn = document.querySelector('#settings-modal button');
    const originalText = btn.innerHTML;
    btn.innerHTML = "⏳ Güncelleniyor...";
    btn.disabled = true;

    try {
        const res = await fetch(url);
        const text = await res.text();
        
        // Google gviz yanıtı özel bir formatta gelir: /*O_o*/\ngoogle.visualization.Query.setResponse({...});
        const jsonString = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
        const data = JSON.parse(jsonString);
        
        let newDict = {};
        
        // Satırları dön (A sütunu: id, B sütunu: MAKİNE ADI olduğunu varsayıyoruz)
        if (data && data.table && data.table.rows) {
            data.table.rows.forEach(row => {
                if (row.c && row.c[0] && row.c[1]) {
                    const id = row.c[0].v;
                    const name = row.c[1].v;
                    // Başlık satırını atla
                    if (id && name && id.toString().toLowerCase() !== 'id') {
                        newDict[id.toString().trim()] = name.toString().trim();
                    }
                }
            });
        }
        
        if(Object.keys(newDict).length > 0) {
            machineDictionary = newDict;
            localStorage.setItem('akg_machine_dictionary', JSON.stringify(newDict));
            alert(`✅ Başarılı! ${Object.keys(newDict).length} adet makine sisteme kaydedildi.`);
            closeSettings();
        } else {
            alert("❌ Uyarı: Çekilen listede makine bulunamadı. Lütfen Excel dosyasındaki makine listesi sekmesinin EN SOLDA (1. sırada) olduğundan emin olun.");
        }
    } catch(e) {
        alert("❌ Hata oluştu: İnternet bağlantınızı kontrol edin. Hata Detayı: " + e.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// ----------------------------------------------------
// AÇIK ARIZALARI FİREBASE'DEN ÇEKME (REALTIME)
// ----------------------------------------------------

let faultsUnsubscribe = null;

function fetchOpenFaults() {
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
        .where('status', '==', 'Açık')
        .onSnapshot((snapshot) => {
            currentOpenFaults = []; // Listeyi sıfırla

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

                // Arıza Türüne Göre Renk Belirleme Fonksiyonu
                let cardBg = "var(--surface-color)";
                let borderColor = "var(--primary)";
                let textColor = "var(--text-main)"; 
                let mutedColor = "var(--text-muted)";
                let isSolid = false;
                
                if (isToday || isMyTask) {
                    isSolid = true; // Bugün gelenler ve görevlerim için TAM RENK
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

                // Ortak Kart HTML'si
                const cardHtml = `
                    <div class="fault-header">
                        <h3 class="machine-name" style="color:${textColor};">⚙️ ${fault.machine || "Bilinmeyen Makine"}</h3>
                        <span class="fault-date" style="color:${mutedColor};">${dateStr}</span>
                    </div>
                    <p class="fault-details" style="color:${textColor};"><strong>Görevli:</strong> <span style="font-weight:bold;">${assignedPerson}</span></p>
                    <p class="fault-details" style="color:${textColor};"><strong>Vardiya:</strong> ${fault.shift || "-"}</p>
                    <p class="fault-details" style="color:${textColor};"><strong>Tür:</strong> <span style="font-weight:bold;">${fault.jobType || "-"}</span></p>
                    <p class="fault-details" style="color:${textColor};"><strong>Açıklama:</strong> ${fault.description || "Açıklama yok"}</p>
                    <div class="fault-status" style="color:${textColor}; font-weight:bold;">🔥 MÜDAHALE BEKLİYOR</div>
                `;

                if (isToday) {
                    todayCount++;
                    const card = document.createElement('div');
                    card.className = 'fault-card';
                    card.style.backgroundColor = cardBg;
                    if (!isSolid) card.style.borderLeftColor = borderColor;
                    if (isMyTask) card.style.border = `3px solid var(--text-main)`; 
                    card.onclick = () => startQROnlyCamera();
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
                    
                    tr.onclick = () => startQROnlyCamera();
                    tr.innerHTML = `
                        <td style="color: ${textColor}; font-weight: bold;">${shortDateTime}</td>
                        <td class="truncate-text" style="color: ${mutedColor};">${fault.shift || "-"}</td>
                        <td class="truncate-text" style="color: ${textColor};"><strong>${fault.machine || "Bilinmiyor"}</strong></td>
                        <td class="truncate-text" style="color: ${textColor}; font-weight: bold;">${fault.jobType || "-"}</td>
                        <td class="truncate-text" style="color: ${textColor};">${fault.description || "-"}</td>
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
                        tr.onclick = () => startQROnlyCamera();
                        tr.innerHTML = `
                            <td style="color: var(--danger); font-weight: bold; text-align: center;">${timeStr}</td>
                            <td class="truncate-text" style="color: var(--text-muted);">${fault.shift || "-"}</td>
                            <td class="truncate-text"><strong>${fault.machine || "Bilinmiyor"}</strong></td>
                            <td class="truncate-text" style="color: var(--warning); font-weight: bold;">${assignedPerson}</td>
                            <td class="truncate-text">${fault.description || "-"}</td>
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
    const matchedFault = currentOpenFaults.find(f => {
        if (!f.machine) return false;
        const dbMachine = f.machine.trim().toLocaleUpperCase('tr-TR');
        return machineNameForSearch.includes(dbMachine) || machineNameForSearch === dbMachine;
    });
    
    // 4. Sonuç değerlendirmesi
    if (matchedFault) {
        openInterventionForm(matchedFault);
    } else {
        if (isAppSheetLink) {
            alert(`❌ Hata: Bu makinede açık bir arıza bulunamadı!\n\nBulunan Makine: "${machineNameForSearch}"\n\nSistem bu makineye ait açık bir arıza bulamadı. Lütfen listedeki makine adıyla eşleştiğinden emin olun.`);
        } else {
            alert(`❌ Hata: Bu makinede açık bir arıza bulunamadı!\n\nKameranın Okuduğu QR Metni: "${scannedText}"\n\nSistem okunan bu kodun içinde açık arızası olan bir makine adı bulamadı.`);
        }
    }
}

function openInterventionForm(fault) {
    activeInterventionFaultId = fault.id;
    
    // Formu temizle ve makine adını yaz
    document.getElementById('modal-machine-name').innerText = fault.machine || "Bilinmiyor";
    document.getElementById('modal-action-taken').value = '';
    document.getElementById('modal-parts-changed').value = '';
    
    document.getElementById('fault-modal').style.display = 'flex';
}

function closeFaultModal() {
    document.getElementById('fault-modal').style.display = 'none';
    activeInterventionFaultId = null;
}

// Firebase Güncellemesi (Arızayı Kapat)
function saveIntervention() {
    if (!activeInterventionFaultId) return;
    
    const actionTaken = document.getElementById('modal-action-taken').value.trim();
    const partsChanged = document.getElementById('modal-parts-changed').value.trim();
    
    if (!actionTaken) {
        alert("⚠️ Lütfen 'Yapılan İşlem / Kök Neden' alanını doldurun!");
        return;
    }
    
    // Butonu pasife alıp çifte tıklamayı önleyelim
    const saveBtn = document.querySelector('.btn-save');
    saveBtn.innerText = 'Kapatılıyor...';
    saveBtn.disabled = true;
    
    const faultRef = db.collection('arizalar').doc(activeInterventionFaultId);
    faultRef.update({
        status: 'Kapatıldı',
        completedAt: new Date().toISOString(),
        completedBy: loggedInOperator.name,
        actionTaken: actionTaken,
        partsChanged: partsChanged || "-"
    }).then(() => {
        alert("✅ Arıza başarıyla kapatıldı ve arşive eklendi!");
        closeFaultModal();
    }).catch(error => {
        alert("Hata oluştu: " + error.message);
    }).finally(() => {
        saveBtn.innerText = 'Arızayı Kapat';
        saveBtn.disabled = false;
    });
}

// Dashboard (Aktif İşler) Ekranına Geçiş
function showDashboard() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('dashboard-screen').style.display = 'block';
    
    // Açık arızaları getirmeyi (dinlemeyi) başlat
    fetchOpenFaults();
    
    document.getElementById('user-info').innerText = `👤 Hoş Geldin, ${loggedInOperator.name}`;
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
    
    // Çıkış Yap butonu ekle
    let logoutBtn = document.getElementById('btn-logout-header');
    if (!logoutBtn) {
        logoutBtn = document.createElement('button');
        logoutBtn.id = 'btn-logout-header';
        logoutBtn.innerText = "Çıkış";
        logoutBtn.style.padding = "0.3rem 0.6rem";
        logoutBtn.style.marginLeft = "10px";
        logoutBtn.style.background = "var(--danger)";
        logoutBtn.style.color = "white";
        logoutBtn.style.border = "none";
        logoutBtn.style.borderRadius = "4px";
        logoutBtn.style.cursor = "pointer";
        logoutBtn.onclick = logout;
        document.getElementById('user-info').appendChild(logoutBtn);
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
