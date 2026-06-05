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
let faultReasonsList = [];
let stoppageReasonsList = [];
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

function openSettings() {
    document.getElementById('settings-modal').style.display = 'flex';
}

function closeSettings() {
    document.getElementById('settings-modal').style.display = 'none';
}

// JSONP Callback Fonksiyonunu Ayarlıyoruz
window.google = {
    visualization: {
        Query: {
            setResponse: function(data) {
                const btn = document.querySelector('#settings-modal button');
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
                        alert(`✅ Başarılı! ${Object.keys(newDict).length} adet makine sisteme kaydedildi.`);
                        closeSettings();
                    } else {
                        alert("❌ Uyarı: Çekilen listede makine bulunamadı.");
                    }
                } catch(e) {
                    alert("❌ Veri işlenirken hata oluştu: " + e.message);
                } finally {
                    if(btn) {
                        btn.innerHTML = "🔄 Makine Listesini Güncelle";
                        btn.disabled = false;
                    }
                    // Eklenen script etiketini temizle
                    const script = document.getElementById('gviz-script');
                    if(script) script.remove();
                }
            }
        }
    }
};

function updateMachineList() {
    const btn = document.querySelector('#settings-modal button');
    if(btn) {
        btn.innerHTML = "⏳ Güncelleniyor...";
        btn.disabled = true;
    }

    // CORS ve Proxy hatalarını %100 aşmak için fetch yerine JSONP (script tag) yöntemi kullanıyoruz.
    const url = `https://docs.google.com/spreadsheets/d/13pjcli1vFeM_DuHk7y5HV1DBpqXE_IlaQtdhMsvf_6U/gviz/tq?tqx=out:json&gid=1078561341&t=${new Date().getTime()}`;
    
    // Eski script varsa temizle
    const oldScript = document.getElementById('gviz-script');
    if(oldScript) oldScript.remove();

    // Yeni script etiketi oluştur ve sayfaya ekle. Bu, veriyi doğrudan çeker ve üstte tanımladığımız setResponse fonksiyonunu tetikler.
    const script = document.createElement('script');
    script.id = 'gviz-script';
    script.src = url;
    script.onerror = function() {
        alert("❌ Ağ Hatası: Liste indirilemedi. İnternet bağlantınızı veya güvenlik duvarınızı kontrol edin.");
        if(btn) {
            btn.innerHTML = "🔄 Makine Listesini Güncelle";
            btn.disabled = false;
        }
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
        .where('status', 'in', ['Açık', 'Müdahale Ediliyor', 'Parça Bekliyor', 'Geçici Çözüm', 'Dış Servis Bekliyor', 'Devredildi'])
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

                // Durum Etiketini Dinamik Yap
                let statusLabelHtml = `<div class="fault-status" style="color:${textColor}; font-weight:bold;">🔥 MÜDAHALE BEKLİYOR</div>`;
                const cStatus = fault.status || "Açık";
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

                if (isToday) {
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
                        tr.onclick = () => handleFaultClick(fault);
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
            // Hiç kimse işe başlamamış veya arıza parça beklemeye düşmüş
            let startBtnText = "🚀 Çalışmaya Başla";
            if (currentStatus === "Parça Bekliyor") startBtnText = "📦 Parça Geldi / İşi Devral";
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
    
    const confirmStart = confirm(`Bu arızaya ana görevli olarak müdahale etmeye başlamak istiyor musunuz?`);
    if (!confirmStart) return;
    
    const btn = event.currentTarget;
    const oldText = btn.innerText;
    btn.innerText = "⏳ Başlatılıyor...";
    btn.disabled = true;

    db.collection('arizalar').doc(faultId).update({
        status: "Müdahale Ediliyor",
        assignedTo: loggedInOperator.name,
        startedAt: new Date().toISOString()
    }).then(() => {
        alert("🚀 Çalışma başarıyla başlatıldı! Kolay gelsin.");
        closeFaultSelectionModal();
    }).catch(err => {
        alert("Hata oluştu: " + err.message);
        btn.innerText = oldText;
        btn.disabled = false;
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

    const confirmJoin = confirm(`Bu arızaya yardımcı bakımcı olarak katılmak istiyor musunuz?\n\n(Kayıtlarınıza eklenecektir.)`);
    if (!confirmJoin) return;
    
    const btn = event.currentTarget;
    const oldText = btn.innerText;
    btn.innerText = "⏳ Katılınıyor...";
    btn.disabled = true;

    db.collection('arizalar').doc(faultId).update({
        helpers: firebase.firestore.FieldValue.arrayUnion(loggedInOperator.name)
    }).then(() => {
        alert("✅ Başarıyla arızaya yardımcı olarak katıldınız!");
        closeFaultSelectionModal();
    }).catch(err => {
        alert("Hata oluştu: " + err.message);
        btn.innerText = oldText;
        btn.disabled = false;
    });
}

// Yeni: Yardımcı bakımcının işten ayrılması
function leaveHelper(faultId) {
    if (!loggedInOperator) return;
    
    const confirmLeave = confirm(`Bu arızadaki görevinizi (yardımcı bakımcı) sonlandırıp ayrılmak istiyor musunuz?`);
    if (!confirmLeave) return;
    
    const btn = event.currentTarget;
    const oldText = btn.innerText;
    btn.innerText = "⏳ Ayrılıyorsunuz...";
    btn.disabled = true;

    db.collection('arizalar').doc(faultId).update({
        helpers: firebase.firestore.FieldValue.arrayRemove(loggedInOperator.name)
    }).then(() => {
        alert("👋 Arızadan başarıyla ayrıldınız. Emeğinize sağlık!");
        closeFaultSelectionModal();
    }).catch(err => {
        alert("Hata oluştu: " + err.message);
        btn.innerText = oldText;
        btn.disabled = false;
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
    
    // Log Kaydını Oluştur
    const logEntry = {
        operator: loggedInOperator.name,
        helpers: (fault && fault.helpers) ? fault.helpers : [],
        durationMin: durationMin,
        actionTaken: actionTaken,
        status: selectedStatus,
        timestamp: new Date().toISOString()
    };
    
    const faultRef = db.collection('arizalar').doc(activeInterventionFaultId);
    
    // Duruma göre güncellenecek alanları belirle
    let updateData = {
        status: selectedStatus,
        actionTaken: actionTaken,
        partsChanged: partsChanged || "-",
        interventions: firebase.firestore.FieldValue.arrayUnion(logEntry)
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
