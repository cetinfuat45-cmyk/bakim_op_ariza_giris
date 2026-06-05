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
    btn.innerText = "✏️ Güncelle";
    btn.style.background = "#3b82f6"; // mavi
    
    // Forma kaydır
    document.querySelector('.add-form').scrollIntoView({ behavior: 'smooth' });
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
            localRootCauses = result.data.rootCauses;
            
            await db.collection('settings').doc('config').set({
                operators: localOperators,
                rootCauses: localRootCauses,
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
