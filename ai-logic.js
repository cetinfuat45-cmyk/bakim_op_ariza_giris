// ==========================================
// AI (GEMINI) ENTEGRASYONU & SOHBET MANTIĞI
// ==========================================
let geminiApiKey = localStorage.getItem('geminiApiKey') || '';
let isAIChatOpen = false;
let aiChatState = 'IDLE'; 
let aiContextData = {};

window.openAISettingsModal = function() {
    document.getElementById('gemini-api-key-input').value = geminiApiKey;
    document.getElementById('ai-settings-modal').style.display = 'flex';
};

window.saveAISettings = function() {
    const key = document.getElementById('gemini-api-key-input').value.trim();
    if(key) {
        localStorage.setItem('geminiApiKey', key);
        geminiApiKey = key;
        alert("API Anahtarı başarıyla kaydedildi!");
        document.getElementById('ai-settings-modal').style.display = 'none';
    } else {
        alert("Lütfen geçerli bir anahtar girin.");
    }
};

async function callGemini(promptText) {
    if(!geminiApiKey) {
        alert("Sistemin çalışabilmesi için önce Admin ayarlarından Gemini API Anahtarı girilmelidir.");
        return null;
    }
    try {
        const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + geminiApiKey;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: promptText }] }]
            })
        });
        if(!response.ok) {
            console.error("API Hatası", response.status);
            alert("Yapay zekaya ulaşılamadı (Hata kodu: " + response.status + "). API anahtarınızı kontrol edin.");
            return null;
        }
        const data = await response.json();
        if(data && data.candidates && data.candidates.length > 0) {
            return data.candidates[0].content.parts[0].text;
        }
        return null;
    } catch(err) {
        console.error("Gemini ağ hatası:", err);
        return null;
    }
}

window.toggleAIChat = function() {
    isAIChatOpen = !isAIChatOpen;
    document.getElementById('ai-chat-window').style.display = isAIChatOpen ? 'flex' : 'none';
    if(isAIChatOpen && document.getElementById('ai-chat-messages').children.length === 0) {
        addAIMessage("Merhaba usta! 👋 Ben Sistem Asistanı. Ne yapmak istersin?", [
            { text: "🛠️ İşe Başla (Barkod Okut)", action: "start_job" },
            { text: "✅ Arıza Kapat (Rapor Yaz)", action: "close_job" },
            { text: "📊 Sistemden Bilgi İste", action: "ask_question" }
        ]);
    }
};

window.addAIMessage = function(text, buttons = []) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'ai-msg';
    msgDiv.innerHTML = text.replace(/\n/g, '<br>');
    if(buttons && buttons.length > 0) {
        const btnContainer = document.createElement('div');
        btnContainer.style.marginTop = '8px';
        btnContainer.style.display = 'flex';
        btnContainer.style.flexDirection = 'column';
        btnContainer.style.gap = '5px';
        buttons.forEach(btn => {
            const b = document.createElement('button');
            b.className = 'ai-action-btn';
            b.innerText = btn.text;
            b.onclick = () => {
                btnContainer.style.display = 'none';
                handleAIAction(btn.action);
            };
            btnContainer.appendChild(b);
        });
        msgDiv.appendChild(btnContainer);
    }
    document.getElementById('ai-chat-messages').appendChild(msgDiv);
    scrollToBottomChat();
};

window.addUserMessage = function(text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'user-msg';
    msgDiv.innerText = text;
    document.getElementById('ai-chat-messages').appendChild(msgDiv);
    scrollToBottomChat();
};

window.scrollToBottomChat = function() {
    const box = document.getElementById('ai-chat-messages');
    box.scrollTop = box.scrollHeight;
};

const originalOnScanSuccess = window.onScanSuccess;
window.onScanSuccess = function(decodedText) {
    if(aiChatState === 'WAIT_BARCODE_START' || aiChatState === 'WAIT_BARCODE_CLOSE') {
        closeQRModal();
        handleAIBarkodRead(decodedText);
    } else {
        if(originalOnScanSuccess) originalOnScanSuccess(decodedText);
    }
};

window.handleAIAction = async function(action) {
    if(!loggedInOperator) {
        addAIMessage("Lütfen önce sisteme giriş yap usta.");
        return;
    }
    if(!geminiApiKey) {
        addAIMessage("Sistemin çalışabilmesi için önce Admin ayarlarından Gemini API Anahtarı girilmelidir.");
        return;
    }

    if(action === 'start_job') {
        addUserMessage("İşe Başla");
        aiChatState = 'WAIT_BARCODE_START';
        addAIMessage("Hangi makinedesin? Kamerayı açıyorum, lütfen makinenin barkodunu okut.");
        setTimeout(() => startQROnlyCamera(), 1500);
    }
    else if(action === 'close_job') {
        addUserMessage("Arıza Kapat");
        aiChatState = 'WAIT_BARCODE_CLOSE';
        addAIMessage("Hangi makinenin arızasını kapatıyoruz? Kamerayı açıyorum, barkodu okut.");
        setTimeout(() => startQROnlyCamera(), 1500);
    }
    else if(action === 'ask_question') {
        addUserMessage("Sistemden Bilgi İste");
        aiChatState = 'WAIT_QUESTION';
        addAIMessage("Veritabanına hakimim. Ne öğrenmek istiyorsun? (Örn: Bugün kim kaç saat çalıştı?)");
    }
    else if(action.startsWith('cause_')) {
        const cause = action.replace('cause_', '');
        addUserMessage(cause);
        aiContextData.cause = cause;
        aiChatState = 'WAIT_RESOLUTION';
        addAIMessage("Anlaşıldı. Peki bu arızayı nasıl çözdün? Hangi parçaları kullandın? Lütfen buraya yaz.");
    }
};

window.handleAIBarkodRead = async function(decodedText) {
    let scannedText = decodedText.trim();
    let machineName = scannedText.toLocaleUpperCase('tr-TR');
    if (scannedText.includes('appsheet.com') && scannedText.includes('row=')) {
        const urlParams = new URLSearchParams(scannedText.split('#')[1] || scannedText.split('?')[1]);
        machineName = urlParams.get('row').toLocaleUpperCase('tr-TR');
    }
    addUserMessage("Barkod: " + machineName);

    if(aiChatState === 'WAIT_BARCODE_START') {
        const faultsRef = db.collection('faults');
        const snapshot = await faultsRef.where('status', '==', 'Açık').where('machine', '==', machineName).get();
        if(snapshot.empty) {
            addAIMessage("Bu makinede açık bir arıza bulamadım.");
            aiChatState = 'IDLE';
            return;
        }
        if(snapshot.size > 1) {
            addAIMessage("Bu makinede birden fazla açık arıza var, ilkini alıyorum.");
        }
        const faultDoc = snapshot.docs[0];
        await faultsRef.doc(faultDoc.id).update({
            status: 'İşlemde',
            assignedTo: loggedInOperator.name,
            startedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        addAIMessage("Tamamdır! İşi senin üzerine aldım ve süreyi başlattım. Kolay gelsin usta. İşin bitince Arıza Kapat menüsünden kapatabilirsin.");
        aiChatState = 'IDLE';
    }
    else if(aiChatState === 'WAIT_BARCODE_CLOSE') {
        const faultsRef = db.collection('faults');
        const snapshot = await faultsRef.where('status', '==', 'İşlemde')
                                        .where('machine', '==', machineName)
                                        .where('assignedTo', '==', loggedInOperator.name).get();
        if(snapshot.empty) {
            addAIMessage("Senin üzerinde olan bu makineye ait işlemde bir arıza bulamadım.");
            aiChatState = 'IDLE';
            return;
        }
        const faultDoc = snapshot.docs[0];
        aiContextData.faultId = faultDoc.id;
        aiContextData.machine = machineName;
        
        aiChatState = 'WAIT_CAUSE';
        addAIMessage("Süper. Arızanın asıl nedeni neydi?", [
            {text: "Mekanik", action: "cause_Mekanik"},
            {text: "Elektrik", action: "cause_Elektrik"},
            {text: "Elektronik", action: "cause_Elektronik"},
            {text: "Pnömatik", action: "cause_Pnömatik"},
            {text: "Kullanıcı Hatası", action: "cause_Kullanıcı_Hatası"},
            {text: "Diğer", action: "cause_Diğer"}
        ]);
    }
};

window.sendAIChatMessage = async function() {
    const inputEl = document.getElementById('ai-chat-input');
    const text = inputEl.value.trim();
    if(!text) return;
    inputEl.value = '';
    addUserMessage(text);

    if(aiChatState === 'WAIT_RESOLUTION') {
        addAIMessage("⏳ Raporunu inceliyorum...");
        const prompt = `Sen endüstriyel bir bakım uzmanısın. Operatör bir arızayı çözdü ve şu notu girdi: "${text}". Eğer bu notta parça ismi geçiyorsa ancak parça kodu veya ölçüsü yoksa (örneğin "rulman değişti" dediyse ama numarasını vermediyse), "Hangi kodlu rulman takıldı?" gibi kısa tek bir soru sor. Eğer not yeterince açıklayıyıcıysa, parçalar netse veya parça değişimi yoksa SADECE "YETERLİ" yaz. Başka bir şey yazma.`;
        
        const answer = await callGemini(prompt);
        if(!answer) {
            addAIMessage("Hata oluştu. Rapora kaydetmek için tekrar yazın.");
            return;
        }
        
        if(answer.includes("YETERLİ")) {
            finalizeReport(text);
        } else {
            addAIMessage(answer);
            aiChatState = 'WAIT_EXTRA_INFO';
            aiContextData.draftText = text;
        }
    }
    else if(aiChatState === 'WAIT_EXTRA_INFO') {
        const newText = aiContextData.draftText + " - Ek Bilgi: " + text;
        finalizeReport(newText);
    }
    else if(aiChatState === 'WAIT_QUESTION') {
        addAIMessage("⏳ Veritabanını tarıyorum...");
        
        const todayStart = new Date();
        todayStart.setHours(0,0,0,0);
        
        const openRef = await db.collection('faults').where('status','in',['Açık','İşlemde']).get();
        const closedRef = await db.collection('faults').where('status','==','Kapalı').where('completedAt','>=',todayStart).get();
        
        let contextJson = {
            acik_ve_islemde_arizalar: openRef.docs.map(d=>d.data()),
            bugun_kapananlar: closedRef.docs.map(d=>d.data()),
            soruyu_soran_kisi: loggedInOperator.name
        };
        
        const prompt = `Aşağıdaki JSON verisinde fabrikanın bugünkü tüm arıza durumu vardır. Operatörün sorusuna bu verilere dayanarak kısa, net ve Türkçe bir cevap ver. JSON VERİSİ: ${JSON.stringify(contextJson)}. OPERATÖRÜN SORUSU: "${text}"`;
        
        const answer = await callGemini(prompt);
        addAIMessage(answer || "Cevap üretilemedi.");
        aiChatState = 'IDLE';
    } else {
        addAIMessage("Şu an bir işlem beklemiyorum. Menüden bir işlem seçebilirsin.", [
            { text: "🛠️ İşe Başla", action: "start_job" },
            { text: "✅ Arıza Kapat", action: "close_job" },
            { text: "📊 Soru Sor", action: "ask_question" }
        ]);
    }
};

window.finalizeReport = async function(finalText) {
    addAIMessage("⏳ Raporu kurumsal bir dile çeviriyorum...");
    const prompt = `Sen endüstriyel bir bakım mühendisisin. Operatörün girdiği şu kaba notu son derece profesyonel, resmi bir arıza kapanış açıklamasına dönüştür. İçinde kullanılan parçaları ve kodlarını net belirt. Sadece oluşturduğun metni ver.\nNot: ${finalText}`;
    
    let proReport = await callGemini(prompt);
    if(!proReport) proReport = finalText;
    
    try {
        const faultRef = db.collection('faults').doc(aiContextData.faultId);
        await faultRef.update({
            status: 'Kapalı',
            stoppageReason: aiContextData.cause,
            actionTaken: proReport,
            completedAt: firebase.firestore.FieldValue.serverTimestamp(),
            completedBy: loggedInOperator.name
        });
        
        addAIMessage("✅ Arıza başarıyla kapatıldı! Oluşturduğum rapor:\n" + proReport);
        
        const msgPrompt = `Aşağıdaki bakım raporunda (Eğer varsa) kullanılan parçaları ve malzemeleri tespit et. Eğer herhangi bir parça/malzeme kullanılmışsa SADECE "MESAJ: ${aiContextData.machine} makinesinde şu parçalar kullanılmıştır: [parçalar]. Stoktan düşebilirsiniz." formatında kısa bir mesaj üret. Eğer hiç parça/malzeme geçmiyorsa SADECE "YOK" yaz.\nRapor: ${proReport}`;
        const msgAnswer = await callGemini(msgPrompt);
        
        if(msgAnswer && msgAnswer.includes("MESAJ:")) {
            const finalMsg = msgAnswer.replace("MESAJ:", "").trim();
            await db.collection('messages').add({
                text: finalMsg,
                sender: "🤖 AI Sistem Asistanı",
                targetUsers: ['everyone'],
                readBy: [],
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            addAIMessage("Ayrıca kullanılan parçaları depodan düşmeleri için ekibe sistem üzerinden otomatik mesaj yolladım! Başka bir isteğin var mı?", [
                { text: "🛠️ Yeni İşe Başla", action: "start_job" },
                { text: "✅ Başka Arıza Kapat", action: "close_job" }
            ]);
        } else {
            addAIMessage("Başka bir isteğin var mı?", [
                { text: "🛠️ Yeni İşe Başla", action: "start_job" },
                { text: "✅ Başka Arıza Kapat", action: "close_job" }
            ]);
        }
        aiChatState = 'IDLE';
    } catch(err) {
        console.error("Rapor kapatma hatası", err);
        addAIMessage("Arıza kapatılırken bir veritabanı hatası oluştu.");
        aiChatState = 'IDLE';
    }
};

// ==========================================
// AI CHAT BTN SÜRÜKLEME (DRAG) MANTIĞI
// ==========================================
setTimeout(() => {
    let aiBtn = document.getElementById('ai-chat-btn');
    if(aiBtn) {
        aiBtn.removeAttribute('onclick'); // Inline onclick sil
        
        let isDragging = false;
        let initialX, initialY;
        let moved = false;

        aiBtn.addEventListener('mousedown', dragStart);
        aiBtn.addEventListener('touchstart', dragStart, {passive: false});

        function dragStart(e) {
            if (e.type === "touchstart") {
                initialX = e.touches[0].clientX - aiBtn.getBoundingClientRect().left;
                initialY = e.touches[0].clientY - aiBtn.getBoundingClientRect().top;
            } else {
                initialX = e.clientX - aiBtn.getBoundingClientRect().left;
                initialY = e.clientY - aiBtn.getBoundingClientRect().top;
            }
            isDragging = true;
            moved = false;
            
            document.addEventListener('mouseup', dragEnd);
            document.addEventListener('mousemove', drag);
            document.addEventListener('touchend', dragEnd);
            document.addEventListener('touchmove', drag, {passive: false});
        }

        function drag(e) {
            if (!isDragging) return;
            moved = true;
            if(e.cancelable) { e.preventDefault(); }
            
            let currentX, currentY;
            if (e.type === "touchmove") {
                currentX = e.touches[0].clientX - initialX;
                currentY = e.touches[0].clientY - initialY;
            } else {
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
            }
            
            const maxX = window.innerWidth - aiBtn.offsetWidth;
            const maxY = window.innerHeight - aiBtn.offsetHeight;
            currentX = Math.max(0, Math.min(currentX, maxX));
            currentY = Math.max(0, Math.min(currentY, maxY));

            aiBtn.style.left = currentX + "px";
            aiBtn.style.top = currentY + "px";
            aiBtn.style.bottom = "auto";
            aiBtn.style.right = "auto";
        }

        function dragEnd(e) {
            isDragging = false;
            document.removeEventListener('mouseup', dragEnd);
            document.removeEventListener('mousemove', drag);
            document.removeEventListener('touchend', dragEnd);
            document.removeEventListener('touchmove', drag);
        }

        aiBtn.addEventListener('click', function(e) {
            if(moved) {
                e.preventDefault();
                return;
            }
            toggleAIChat();
        });
    }
}, 1000);
