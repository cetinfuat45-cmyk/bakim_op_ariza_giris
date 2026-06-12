async function exportAndCleanClosedFaults() {
    const btn = document.getElementById('btn-admin-export');
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
        
        const allOperators = (typeof operatorsList !== 'undefined' ? operatorsList : []).map(op => op.name.toUpperCase());
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
            let rowHtml = `<td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: bold; white-space: nowrap; color: black;">${operatorName}</td>`;
            
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
                
                let display = "-";
                if (count > 0 || mins > 0) {
                    let timeStr = mins >= 60 ? `${Math.floor(mins/60)}s ${mins%60}dk` : `${mins}dk`;
                    display = `(iş:${count}ad-sür:${timeStr})`;
                }
                rowHtml += `<td style="padding: 10px; border: 1px solid #cbd5e1; text-align: center; white-space: nowrap; color: black;">${display}</td>`;
            });
            
            let totalDisplay = "-";
            if (totalCount > 0 || totalMin > 0) {
                let timeStr = totalMin >= 60 ? `${Math.floor(totalMin/60)}s ${totalMin%60}dk` : `${totalMin}dk`;
                totalDisplay = `(iş:${totalCount}ad-sür:${timeStr})`;
            }
            rowHtml += `<td style="padding: 10px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; background-color: #f1f5f9; white-space: nowrap; color: black;">${totalDisplay}</td>`;
            
            html += `<tr>${rowHtml}</tr>`;
        });

        if (html === "") {
            html = '<tr><td colspan="9" style="text-align:center; padding: 20px; color: black;">Bu hafta için henüz kayıt yok.</td></tr>';
        }

        tbody.innerHTML = html;
        
    } catch (err) {
        console.error("Rapor çekilirken hata:", err);
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 20px; color: red;">Veri çekilirken hata oluştu.</td></tr>';
    }
}

async function syncWeeklyStatsFromArizalar() {
    if (!confirm("Bugün kapatılan tüm işlerin süreleri taranacak ve haftalık rapora otomatik eklenecektir. Emin misiniz?")) return;
    
    try {
        const btn = document.querySelector('button[onclick="syncWeeklyStatsFromArizalar()"]');
        const oldText = btn.innerText;
        btn.innerText = "Senkronize Ediliyor...";
        btn.disabled = true;

        const arizalarSnap = await db.collection('arizalar').get();
        let syncCount = 0;
        
        // Bugünün başlangıcı
        const todayStart = new Date();
        todayStart.setHours(0,0,0,0);
        
        // Hangi operatör bugün kaç dakika çalışmış ve kaç işlem yapmış hesapla
        const todayStats = {};

        arizalarSnap.forEach(doc => {
            const data = doc.data();
            if (data.interventions && Array.isArray(data.interventions)) {
                data.interventions.forEach(inv => {
                    if (inv.timestamp) {
                        const invDate = new Date(inv.timestamp);
                        if (invDate >= todayStart) {
                            // Bugün yapılmış bir müdahale
                            const opName = inv.operator.toUpperCase();
                            const duration = Math.max(0, parseInt(inv.durationMin) || 0);
                            
                            if (!todayStats[opName]) {
                                todayStats[opName] = { mins: 0, count: 0 };
                            }
                            todayStats[opName].mins += duration;
                            todayStats[opName].count += 1;
                            syncCount++;
                        }
                    }
                });
            }
        });

        if (syncCount === 0) {
            alert("Bugün yapılmış herhangi bir işlem bulunamadı.");
            btn.innerText = oldText;
            btn.disabled = false;
            return;
        }

        // Şimdi weeklyStats'ı çekip bugünün verilerini ez
        const docRef = db.collection('settings').doc('weeklyStats');
        const docSnap = await docRef.get();
        let statsData = { weekStartDate: "", stats: {} };
        if (docSnap.exists) {
            statsData = docSnap.data();
            if (!statsData.stats) statsData.stats = {};
        }

        const d = new Date();
        const day = d.getDay(); 
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff)).toLocaleDateString('tr-TR');

        if (statsData.weekStartDate !== monday) {
            statsData.weekStartDate = monday;
            statsData.stats = {}; 
        }

        const daysTr = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
        const todayName = daysTr[new Date().getDay()];

        for (const [op, vals] of Object.entries(todayStats)) {
            if (!statsData.stats[op]) {
                statsData.stats[op] = { 
                    "Pazartesi": {mins:0, count:0}, "Salı": {mins:0, count:0}, "Çarşamba": {mins:0, count:0}, 
                    "Perşembe": {mins:0, count:0}, "Cuma": {mins:0, count:0}, "Cumartesi": {mins:0, count:0}, "Pazar": {mins:0, count:0} 
                };
            }
            statsData.stats[op][todayName] = { mins: vals.mins, count: vals.count };
        }

        await docRef.set(statsData);
        alert(`Başarılı! Bugün yapılan toplam ${syncCount} işlem taranarak istatistiklere eklendi.`);
        
        btn.innerText = oldText;
        btn.disabled = false;
        
        openWeeklyReportModal(); // Tabloyu yenile
    } catch (error) {
        console.error("Senkronizasyon hatası:", error);
        alert("Senkronizasyon sırasında hata oluştu!");
        document.querySelector('button[onclick="syncWeeklyStatsFromArizalar()"]').disabled = false;
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
      jsPDF:        { unit: 'mm', format: 'a3', orientation: 'landscape' }
    };

    // html2pdf kütüphanesini kullanarak PDF oluştur ve indir
    html2pdf().set(opt).from(element).save();
}


