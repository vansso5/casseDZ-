import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, signOut, updatePassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, getDoc, setDoc, doc, updateDoc, deleteDoc, query, where, orderBy, onSnapshot, serverTimestamp, increment, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyDLNY-Uya4tpZSplAqhpsmxgOrwlQMFODI",
    authDomain: "casse-auto-8ef9a.firebaseapp.com",
    databaseURL: "https://casse-auto-8ef9a-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "casse-auto-8ef9a",
    storageBucket: "casse-auto-8ef9a.firebasestorage.app",
    messagingSenderId: "257994887284",
    appId: "1:257994887284:web:16e6006f68520fbbc94121"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app); 
const db = getFirestore(app);

// متغيرات عالمية
let currentReviewSellerId = null;
let currentReviewOrderId = null;

// ============================================================
// Helpers & Utilities
// ============================================================
const safeToggle = (id, action) => {
    const el = document.getElementById(id);
    if (el) {
        if (action === 'show') el.classList.remove('hidden');
        else el.classList.add('hidden');
    }
};

function createLightbox() {
    if (document.getElementById('imgLightbox')) return;
    const box = document.createElement('div');
    box.id = 'imgLightbox';
    box.className = 'fixed inset-0 z-[150] bg-black/95 hidden flex justify-center items-center cursor-zoom-out';
    box.onclick = (e) => { if(e.target !== document.getElementById('lightboxImg')) box.classList.add('hidden'); };
    box.innerHTML = `<img id="lightboxImg" src="" class="max-w-[95%] max-h-[95%] object-contain rounded-lg shadow-2xl transition-transform duration-300 scale-100">`;
    document.body.appendChild(box);
}
createLightbox();

window.openLightbox = (src) => {
    const box = document.getElementById('imgLightbox');
    const img = document.getElementById('lightboxImg');
    img.src = src;
    box.classList.remove('hidden');
};

const compressImage = (file) => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
                const scaleSize = MAX_WIDTH / img.width;
                if (img.width > MAX_WIDTH) {
                    canvas.width = MAX_WIDTH;
                    canvas.height = img.height * scaleSize;
                } else {
                    canvas.width = img.width;
                    canvas.height = img.height;
                }
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.6));
            };
        };
    });
};

async function updateRatingUI(sellerId, elementId) {
    try {
        const q = query(collection(db, "ratings"), where("sellerId", "==", sellerId));
        const snap = await getDocs(q);
        let total = 0;
        snap.forEach(d => total += d.data().stars);
        const count = snap.size;
        const avg = count > 0 ? (total / count).toFixed(1) : 0;
        
        const el = document.getElementById(elementId);
        if(el) {
            if (count > 0) {
                el.innerHTML = `
                    <div class="flex items-center gap-1 bg-yellow-50 px-2 py-0.5 rounded-md border border-yellow-100 w-fit mx-auto sm:mx-0">
                        <span class="text-yellow-500 text-xs">★</span>
                        <span class="text-gray-700 text-xs font-bold">${avg}</span>
                        <span class="text-gray-400 text-[10px]">(${count})</span>
                    </div>`;
            } else {
                el.innerHTML = `<span class="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded">بائع جديد</span>`;
            }
        }
    } catch(e) { console.error("Rating Error", e); }
}

window.previewThumb = (input) => {
    const num = input.id.slice(-1); 
    const thumbId = 'thumb' + num;
    const plusId = 'plusIcon' + num;
    const imgEl = document.getElementById(thumbId);
    const plusEl = document.getElementById(plusId);

    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            if(imgEl) { imgEl.src = e.target.result; imgEl.classList.remove('hidden'); }
            if(plusEl) { plusEl.classList.add('hidden'); }
        }
        reader.readAsDataURL(input.files[0]);
    }
};

// --- مودال تفاصيل العرض للزبون ---
function createCustomerOfferModal() {
    if (document.getElementById('custOfferModal')) return;
    const modal = document.createElement('div');
    modal.id = 'custOfferModal';
    modal.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm hidden flex items-center justify-center z-[70] p-4 font-sans transition-opacity duration-300';
    modal.onclick = (e) => { if (e.target === modal) modal.classList.add('hidden'); };

    modal.innerHTML = `
        <div class="bg-gray-900 w-full max-w-sm rounded-[2rem] overflow-hidden relative shadow-2xl border border-gray-700 max-h-[85vh] overflow-y-auto animate-slide-up" onclick="event.stopPropagation()">
            <button onclick="document.getElementById('custOfferModal').classList.add('hidden')" class="absolute top-3 left-3 bg-gray-800 p-2 rounded-full text-gray-400 hover:text-white transition z-10 border border-gray-600">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <div class="p-5 pt-8">
                <div class="text-center mb-4">
                    <span class="text-orange-500 text-[10px] font-bold uppercase tracking-widest">تفاصيل العرض</span>
                    <h3 class="text-xl font-bold text-white mt-1 flex items-center justify-center gap-2">
                        <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                        <span id="custModalWilaya">---</span>
                    </h3>
                    <div id="custModalSellerRating" class="mt-1 flex justify-center"></div>
                </div>
                <div id="custModalImages" class="flex overflow-x-auto gap-2 mb-4 snap-x py-2 hide-scrollbar min-h-[120px] bg-gray-800/50 rounded-2xl items-center px-2 border border-gray-700/50"></div>
                <div class="space-y-2 mb-4">
                    <div class="bg-gray-800 p-4 rounded-xl border border-gray-700 flex justify-between items-center">
                        <div>
                            <p class="text-[10px] text-gray-400 mb-1 font-bold">حالة القطعة</p>
                            <span id="custModalCondition" class="text-white font-bold text-xs bg-gray-700 px-2 py-1 rounded">--</span>
                        </div>
                        <div class="text-left">
                             <p class="text-[10px] text-gray-400 mb-1 font-bold">السعر المقترح</p>
                             <p class="text-xl font-black text-orange-500 tracking-tight" id="custModalPrice">0 DA</p>
                        </div>
                    </div>
                    <div class="bg-gray-800 p-4 rounded-xl border border-gray-700">
                        <p class="text-[10px] text-gray-400 mb-1 font-bold">ملاحظات التاجر</p>
                        <p class="text-gray-300 text-xs whitespace-pre-wrap leading-relaxed bg-gray-900/50 p-2 rounded-lg border border-gray-700/50" id="custModalNotes">--</p>
                    </div>
                </div>
                <div id="custModalActionArea" class="mt-4"></div>
            </div>
        </div>`;
    document.body.appendChild(modal);
}
createCustomerOfferModal();

// ============================================================
// 1. منطق الزبون (Customer Side)
// ============================================================

let uploadedImageBase64 = null;
const fileInput = document.getElementById('partImage');
const imagePreview = document.getElementById('imagePreview');
const uploadPlaceholder = document.getElementById('uploadPlaceholder');

if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                uploadedImageBase64 = await compressImage(file);
                if(imagePreview && uploadPlaceholder) {
                    imagePreview.src = uploadedImageBase64;
                    imagePreview.classList.remove('hidden'); 
                    uploadPlaceholder.classList.add('hidden'); 
                }
            } catch(err) { console.error(err); alert("حدث خطأ أثناء معالجة الصورة"); }
        }
    });
}

window.resetCustomerForm = () => {
    document.getElementById('carMake').value = "";
    document.getElementById('carModel').value = "";
    document.getElementById('carYear').value = "";
    document.getElementById('partName').value = "";
    if(document.getElementById('partNotes')) document.getElementById('partNotes').value = "";
    document.getElementById('phoneNumber').value = "";
    
    uploadedImageBase64 = null;
    if (fileInput) fileInput.value = "";
    if (imagePreview) { imagePreview.src = ""; imagePreview.classList.add('hidden'); }
    if (uploadPlaceholder) uploadPlaceholder.classList.remove('hidden');

    safeToggle('successScreen', 'hide');
    safeToggle('dashboardSection', 'hide');
    safeToggle('loginSection', 'show');
    safeToggle('formScreen', 'show');
    
    const submitBtn = document.getElementById('submitBtn');
    if(submitBtn) { submitBtn.disabled = false; submitBtn.innerText = "إرسال الطلب"; }
};

const btnNewOrder = document.getElementById('btnNewOrder') || document.getElementById('backToFormBtn'); 
if(btnNewOrder) {
    btnNewOrder.addEventListener('click', window.resetCustomerForm);
}

const submitBtn = document.getElementById('submitBtn');
if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
        const carMake = document.getElementById('carMake').value;
        const carModel = document.getElementById('carModel').value;
        const carYear = document.getElementById('carYear').value;
        const partName = document.getElementById('partName').value;
        const partNotes = document.getElementById('partNotes') ? document.getElementById('partNotes').value : "";
        const phoneNumber = document.getElementById('phoneNumber').value;
        const wilaya = document.getElementById('wilaya') ? document.getElementById('wilaya').value : "";

        if(!carMake || !partName || !phoneNumber) { alert("املأ البيانات"); return; }

        submitBtn.disabled = true;
        submitBtn.innerText = "جاري الإرسال...";

        const generatedCode = Math.floor(1000 + Math.random() * 9000).toString();

        try {
            await addDoc(collection(db, "orders"), {
                carMake, carModel, carYear, partName, notes: partNotes, phoneNumber,
                wilaya: wilaya, 
                imageUrl: uploadedImageBase64 || null, secretCode: generatedCode,
                status: "active", createdAt: serverTimestamp()
            });

            safeToggle('formScreen', 'hide');
            safeToggle('successScreen', 'show');

            const successDiv = document.getElementById('successScreen');
            if(successDiv) {
            successDiv.innerHTML = `
            <div class="flex items-center justify-center min-h-[50vh] p-4">
              <div class="bg-gray-800 w-full max-w-md p-6 rounded-[2rem] shadow-2xl text-center relative overflow-hidden animate-slide-up border border-gray-700">
                <div class="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-500 to-orange-600"></div>
                <div class="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/20 shadow-[0_0_30px_rgba(34,197,94,0.2)]">
                  <span class="text-4xl">✅</span>
                </div>
                <h3 class="text-2xl font-bold text-white mb-2">تم الإرسال بنجاح!</h3>
                <div class="bg-gray-900/50 border border-gray-700 rounded-2xl p-5 my-6">
                  <p class="text-xs text-orange-400 font-bold mb-2 uppercase tracking-widest">رمز التتبع الخاص بك</p>
                  <div class="text-5xl font-black text-white tracking-[0.2em] font-mono my-3 select-all drop-shadow-md">
                    ${generatedCode}
                  </div>
                  <p class="text-[10px] text-gray-500">استخدم هذا الرمز لمتابعة العروض</p>
                </div>
                <button onclick="window.resetCustomerForm()" class="w-full bg-white text-gray-900 font-black py-4 rounded-xl shadow-lg hover:bg-gray-200 transition transform active:scale-95 cursor-pointer text-sm">
                  طلب قطعة أخرى
                </button>
              </div>
            </div>`;
            }
        } catch (e) {
            alert("خطأ: " + e.message);
            submitBtn.disabled = false;
            submitBtn.innerText = "إرسال الطلب";
        }
    });
}

// --- تتبع الطلب ---
const trackBtn = document.getElementById('trackBtn');
if (trackBtn) {
    trackBtn.addEventListener('click', async () => {
        const phone = document.getElementById('trackPhone').value.trim();
        const code = document.getElementById('trackCode').value.trim();
        
        if(!phone || !code) { alert("أدخل البيانات"); return; }
        
        trackBtn.innerText = "جاري البحث...";
        
        try {
            const q = query(collection(db, "orders"), where("phoneNumber", "==", phone), where("secretCode", "==", code));
            
            onSnapshot(q, (snap) => {
                if(snap.empty) { 
                    alert("لا يوجد طلب بهذا الرقم والكود.");
                    trackBtn.innerText = "إظهار العروض";
                    return; 
                }
                
                const orderDoc = snap.docs[0];
                const orderId = orderDoc.id;
                const orderData = orderDoc.data();
                
                safeToggle('loginSection', 'hide');
                safeToggle('formScreen', 'hide');
                safeToggle('successScreen', 'hide');
                safeToggle('dashboardSection', 'show');
                
                trackBtn.innerText = "إظهار العروض";
                
                const titleEl = document.getElementById('orderTitle');
                if(titleEl) titleEl.innerText = `${orderData.partName} (${orderData.carMake})`;

                onSnapshot(query(collection(db, "offers"), where("orderId", "==", orderId)), (offerSnap) => {
                    const list = document.getElementById('offersList');
                    if(!list) return;
                    list.innerHTML = "";
                    
                    if(offerSnap.empty) {
                        list.innerHTML = `
                        <div class="bg-gray-800/50 rounded-2xl p-10 text-center border border-dashed border-gray-700">
                            <p class="text-lg font-bold mb-2 text-gray-300">
                                ${orderData.status === 'sold' ? 'تم إغلاق الطلب ✅' : 'جاري البحث...'}
                            </p>
                            <p class="text-sm text-gray-500 animate-pulse">
                                ${orderData.status === 'sold' ? 'تمت العملية بنجاح، شكراً لثقتكم.' : 'تم إرسال طلبك للورشات، انتظر العروض قريباً.'}
                            </p>
                        </div>`;
                        return;
                    }
                    
                    const wilayas = ["Adrar", "Chlef", "Laghouat", "Oum El Bouaghi", "Batna", "Béjaïa", "Biskra", "Béchar", "Blida", "Bouira", "Tamanrasset", "Tébessa", "Tlemcen", "Tiaret", "Tizi Ouzou", "Alger", "Djelfa", "Jijel", "Sétif", "Saïda", "Skikda", "Sidi Bel Abbès", "Annaba", "Guelma", "Constantine", "Médéa", "Mostaganem", "M'Sila", "Mascara", "Ouargla", "Oran", "El Bayadh", "Illizi", "Bordj Bou Arreridj", "Boumerdès", "El Tarf", "Tindouf", "Tissemsilt", "El Oued", "Khenchela", "Souk Ahras", "Tipaza", "Mila", "Aïn Defla", "Naâma", "Aïn Témouchent", "Ghardaïa", "Relizane", "Timimoun", "Bordj Badji Mokhtar", "Ouled Djellal", "Béni Abbès", "In Salah", "In Guezzam", "Touggourt", "Djanet", "El M'Ghair", "El Meniaa"];

                    offerSnap.forEach(async (d) => {
                        const o = d.data();
                        const offerId = d.id;
                        
                        let sellerWilayaName = "غير محدد";
                        if(o.sellerWilaya) {
                            sellerWilayaName = !isNaN(o.sellerWilaya) ? wilayas[parseInt(o.sellerWilaya)-1] : o.sellerWilaya;
                        } else {
                            const sellerSnap = await getDoc(doc(db, "sellers", o.sellerId));
                            if(sellerSnap.exists()) {
                                const sData = sellerSnap.data();
                                sellerWilayaName = !isNaN(sData.wilaya) ? wilayas[parseInt(sData.wilaya)-1] : sData.wilaya;
                            }
                        }

                        const offerData = { ...o, id: offerId, displayWilaya: sellerWilayaName, partName: orderData.partName };
                        const offerDataStr = encodeURIComponent(JSON.stringify(offerData));

                        list.innerHTML += `
                        <div class="bg-gray-800 p-5 rounded-[2rem] border border-gray-700 mb-4 shadow-lg hover:border-gray-600 transition-all cursor-pointer group" onclick="openCustomerOfferDetails('${offerDataStr}')">
                            <div class="flex justify-between items-start mb-3">
                                <div class="flex flex-col">
                                    <span class="text-[10px] text-gray-400">السعر</span>
                                    <span class="text-2xl font-black text-white">${o.price} <span class="text-sm text-orange-500">DA</span></span>
                                </div>
                                <span class="bg-gray-700/50 text-gray-300 px-3 py-1 rounded-full text-[10px] border border-gray-600">
                                    ${o.condition || 'مستعمل'}
                                </span>
                            </div>
                            <div class="flex items-center gap-3 mb-4">
                                <div class="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-gray-400">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                </div>
                                <div>
                                    <p class="text-xs text-gray-400">موقع القطعة</p>
                                    <p class="text-sm font-bold text-white">${sellerWilayaName}</p>
                                </div>
                            </div>
                            <button class="w-full bg-gray-700 group-hover:bg-gray-600 text-white font-bold py-3 rounded-xl transition text-sm flex items-center justify-center gap-2">
                                <span>عرض الصور والتفاصيل</span>
                                <svg class="w-4 h-4 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                            </button>
                        </div>`;
                    });
                });
            });
        } catch(e) { console.error(e); trackBtn.innerText = "إظهار العروض"; }
    });
}

// --- فتح مودال التفاصيل ---
window.openCustomerOfferDetails = (offerDataEncoded) => {
    const offer = JSON.parse(decodeURIComponent(offerDataEncoded));
    const modal = document.getElementById('custOfferModal');
    const actionArea = document.getElementById('custModalActionArea');
    const imgContainer = document.getElementById('custModalImages');
    const ratingContainer = document.getElementById('custModalSellerRating');
    
    document.getElementById('custModalWilaya').innerText = offer.displayWilaya || "غير محدد";
    document.getElementById('custModalCondition').innerText = offer.condition || "غير محدد";
    document.getElementById('custModalNotes').innerText = offer.notes || "لا توجد ملاحظات";
    document.getElementById('custModalPrice').innerText = offer.price + " DA";

    const modalRatingId = `modal-rating-view-${offer.sellerId}`;
    ratingContainer.innerHTML = `<div id="${modalRatingId}"></div>`;
    updateRatingUI(offer.sellerId, modalRatingId);

    imgContainer.innerHTML = "";
    if (offer.images && offer.images.length > 0) {
        offer.images.forEach(img => {
            imgContainer.innerHTML += `<img src="${img}" class="h-32 w-auto rounded-xl border border-gray-600 shadow-md snap-center object-cover cursor-zoom-in hover:brightness-110 transition" onclick="openLightbox(this.src)">`;
        });
    } else {
        imgContainer.innerHTML = `<div class="w-full text-center py-4 text-gray-500 text-xs border border-dashed border-gray-700 rounded-xl">لا توجد صور مرفقة</div>`;
    }

    actionArea.innerHTML = `
        <button onclick="handleFinalSelection('${offer.sellerId}', '${offer.orderId}', '${offer.sellerPhone}', '${offer.sellerName}', '${offer.displayWilaya}', '${offer.partName || 'قطعة غيار'}', '${offer.price}')" 
        class="w-full bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-black py-4 rounded-xl shadow-lg shadow-orange-900/50 flex items-center justify-center gap-3 transform active:scale-[0.98] transition-all">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
            <span class="text-lg">كشف الرقم والاتصال</span>
        </button>
        <p class="text-center text-[10px] text-gray-500 mt-3">بالضغط هنا سيتم تثبيت الطلب وحجزه لك</p>
    `;
    
    modal.classList.remove('hidden');
};

// --- الدالة النهائية: الخصم + الكشف + تجهيز التقييم ---
window.handleFinalSelection = async (sellerId, orderId, phone, sellerName, sellerWilaya, partName, price) => {
    
    if(!confirm("هل أنت متأكد من اختيار هذا العرض؟\nسيتم نقلك للاتصال فوراً.")) return;
    
    const btn = document.querySelector('#custModalActionArea button');
    if(btn) {
        btn.disabled = true;
        btn.innerHTML = `<span class="animate-pulse">جاري تحويل الاتصال...</span>`;
    }

    try {
        const batch = writeBatch(db);

        // 1. خصم الرصيد
        const sellerRef = doc(db, "sellers", sellerId);
        batch.update(sellerRef, { balance: increment(-50) });

        // 2. تحديث الحالة إلى مباع
        const orderRef = doc(db, "orders", orderId);
        batch.update(orderRef, { status: 'sold', soldAt: serverTimestamp() });

        // 3. تسجيل بيع
        const saleRef = doc(collection(db, "sales"));
        batch.set(saleRef, { sellerId, orderId, partName, price: price, soldAt: serverTimestamp() });

        await batch.commit();

        document.getElementById('custOfferModal').classList.add('hidden');

        currentReviewSellerId = sellerId;
        currentReviewOrderId = orderId; 
        
        if(window.openReviewModal) {
            window.openReviewModal(sellerName, sellerWilaya);
        }

        window.location.href = `tel:${phone}`;

    } catch(e) { 
        console.error(e); 
        alert("حدث خطأ أثناء العملية.");
        if(btn) { btn.disabled = false; btn.innerText = "كشف الرقم والاتصال"; }
    }
};

// --- زر إرسال التقييم + حذف العروض ---
const submitReviewBtn = document.getElementById('submitReviewBtn');
if (submitReviewBtn) {
    submitReviewBtn.addEventListener('click', async () => {
        const stars = document.querySelectorAll('#starContainer .text-orange-500').length;
        const text = document.getElementById('reviewText').value;
        const sellerId = currentReviewSellerId;
        const orderId = currentReviewOrderId;

        if (!sellerId) return alert("حدث خطأ: لم يتم تحديد التاجر.");
        if (stars === 0) return alert("يرجى تحديد عدد النجوم.");

        submitReviewBtn.innerText = "جاري الإرسال...";
        submitReviewBtn.disabled = true;

        try {
            // حفظ التقييم
            await addDoc(collection(db, "ratings"), {
                sellerId: sellerId,
                stars: stars,
                comment: text,
                createdAt: serverTimestamp()
            });

            // حذف العروض المرتبطة بالطلب (تنظيف)
            if (orderId) {
                const qOffers = query(collection(db, "offers"), where("orderId", "==", orderId));
                const snap = await getDocs(qOffers);
                const batch = writeBatch(db);
                snap.forEach((doc) => { batch.delete(doc.ref); });
                await batch.commit();
            }

            alert("شكراً لك! تم إرسال تقييمك.");
            if(window.closeReviewModal) window.closeReviewModal();
            document.getElementById('reviewText').value = "";

        } catch (e) {
            console.error(e);
            alert("حدث خطأ أثناء إرسال التقييم.");
        } finally {
            submitReviewBtn.innerText = "إرسال التقييم";
            submitReviewBtn.disabled = false;
        }
    });
}

// ============================================================
// 2. منطق البائع (SELLER SIDE)
// ============================================================
if (document.getElementById('headerShopName')) {
    
    let currentSellerId = localStorage.getItem('sellerId');
    let currentSellerData = null;
    let selectedOrderId = null;
    let myOfferedOrderIds = new Set(); 
    let allMarketOrders = []; 
    let allMyOffers = []; 
    let sellerImagesBase64 = []; 

    window.openDetailsModal = (orderId) => {
        try {
            const order = allMarketOrders.find(o => o.id === orderId);
            if (!order) return;
            selectedOrderId = orderId;

            const setText = (id, text) => { const el = document.getElementById(id); if(el) el.innerText = text || ""; };
            setText('detailPartName', order.partName);
            setText('detailCarInfo', `${order.carMake} ${order.carModel || ''} ${order.carYear || ''}`);
            setText('detailTime', timeAgo(order.createdAt));
            setText('detailNotes', order.notes || "لا توجد ملاحظات من الزبون");
            setText('modalOrderInfo', `${order.partName} - ${order.carMake}`);

            const imgEl = document.getElementById('detailImage');
            const txtEl = document.getElementById('noImageText');
            if (imgEl && txtEl) {
                if (order.imageUrl && order.imageUrl.length > 20) { 
                    imgEl.src = order.imageUrl; imgEl.classList.remove('hidden'); txtEl.classList.add('hidden');
                } else {
                    imgEl.classList.add('hidden'); txtEl.classList.remove('hidden');
                }
            }
            document.getElementById('detailsModal').classList.remove('hidden');
        } catch (err) { console.error(err); }
    };

    async function initDashboard() {
        if (!currentSellerId) { window.location.href = 'seller-login.html'; return; }
        
        onSnapshot(doc(db, "sellers", currentSellerId), (docSnap) => {
            if (docSnap.exists()) {
                currentSellerData = docSnap.data();
                document.getElementById('headerShopName').innerText = currentSellerData.shopName;
                document.getElementById('headerBalance').innerText = currentSellerData.balance + " DA";
                
                const headerNameDiv = document.getElementById('headerShopName').parentElement;
                let ratingDiv = document.getElementById('sellerHeaderRating');
                if(!ratingDiv) {
                    ratingDiv = document.createElement('div');
                    ratingDiv.id = 'sellerHeaderRating';
                    headerNameDiv.appendChild(ratingDiv);
                }
                updateRatingUI(currentSellerId, 'sellerHeaderRating');

                if(currentSellerData.isBlocked) { alert("محظور"); window.location.href='seller-login.html'; }
            } else { window.location.href = 'seller-login.html'; }
        });
        startListeners();
        setupChangePassword();
        setupBalanceRequest(); 
    }

    function setupBalanceRequest() {
        const btnSendReq = document.getElementById('btnRequestBalance');
        const amountInput = document.getElementById('reqAmount');
        const receiptInput = document.getElementById('reqReceiptImage'); 
        
        if (btnSendReq) {
            btnSendReq.addEventListener('click', async () => {
                const amount = parseInt(amountInput.value);
                if (!amount || amount <= 0) return alert("يرجى إدخال مبلغ صحيح");
                const originalText = btnSendReq.innerText;
                btnSendReq.innerText = "جاري الإرسال...";
                btnSendReq.disabled = true;
                try {
                    let receiptBase64 = null;
                    if (receiptInput && receiptInput.files[0]) {
                        receiptBase64 = await compressImage(receiptInput.files[0]);
                    }
                    await addDoc(collection(db, "balance_requests"), {
                        sellerId: currentSellerId,
                        shopName: currentSellerData.shopName,
                        phone: currentSellerData.phone,
                        amount: amount,
                        receiptImage: receiptBase64, 
                        status: "pending", 
                        createdAt: serverTimestamp()
                    });
                    alert("✅ تم إرسال طلب الشحن للإدارة بنجاح!");
                    amountInput.value = "";
                    if (receiptInput) receiptInput.value = "";
                } catch (e) {
                    console.error(e);
                    alert("حدث خطأ أثناء الإرسال: " + e.message);
                } finally {
                    btnSendReq.innerText = originalText;
                    btnSendReq.disabled = false;
                }
            });
        }
    }  

    function startListeners() {
        onSnapshot(query(collection(db, "offers"), where("sellerId", "==", currentSellerId)), (snap) => {
            allMyOffers = [];
            myOfferedOrderIds.clear();
            snap.forEach(d => {
                const data = d.data();
                allMyOffers.push({ id: d.id, ...data });
                myOfferedOrderIds.add(data.orderId);
            });
            renderMyOffers(); 
            renderMarketOrders(); 
        });

        onSnapshot(query(collection(db, "orders"), orderBy("createdAt", "desc")), (snap) => {
            allMarketOrders = [];
            snap.forEach(d => allMarketOrders.push({ id: d.id, ...d.data() }));
            renderMarketOrders(); 
            renderMyOffers(); 
        });

        const salesQuery = query(collection(db, "sales"), where("sellerId", "==", currentSellerId));
        onSnapshot(salesQuery, (snap) => {
            const list = document.getElementById('salesList');
            const countEl = document.getElementById('totalSalesCount');
            if(list) list.innerHTML = "";
            if(countEl) countEl.innerText = snap.size;
            if(snap.empty && list) { list.innerHTML = "<p class='text-center text-gray-400 py-10 text-xs border border-dashed rounded-xl'>لا توجد مبيعات حتى الآن</p>"; return; }
            let salesData = [];
            snap.forEach(d => salesData.push(d.data()));
            salesData.sort((a, b) => (b.soldAt ? b.soldAt.seconds : 0) - (a.soldAt ? a.soldAt.seconds : 0));
            
            salesData.forEach(s => {
                const date = s.soldAt ? new Date(s.soldAt.toDate()).toLocaleDateString('en-GB') : 'الآن';
                if(list) {
                    list.innerHTML += `
                        <div class="bg-white p-4 rounded-xl border-r-4 border-green-500 shadow-sm flex justify-between items-center mb-3">
                            <div>
                                <p class="font-bold text-sm text-gray-800">${s.partName}</p>
                                <p class="text-[10px] text-gray-400 font-mono mt-0.5">${date}</p>
                            </div>
                            <div class="text-left">
                                <span class="block font-bold text-brand-600 text-sm">${s.price} DA</span>
                                <span class="text-[9px] text-green-500 font-bold bg-green-50 px-2 py-0.5 rounded-full">تم البيع</span>
                            </div>
                        </div>`;
                }
            });
        });
    }

    function renderMyOffers() {
        const list = document.getElementById('myOffersList');
        if(!list) return;
        list.innerHTML = "";
        const activeOffers = allMyOffers.filter(offer => {
            const associatedOrder = allMarketOrders.find(o => o.id === offer.orderId);
            if (associatedOrder && associatedOrder.status === 'sold') return false;
            return true;
        });
        if(activeOffers.length === 0) { list.innerHTML = "<p class='text-center text-gray-400 py-10 text-xs border border-dashed rounded-xl'>لا توجد عروض نشطة</p>"; return; }
        
        activeOffers.forEach(o => {
            list.innerHTML += `
            <div class="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm relative mb-4">
                <div class="flex justify-between items-start">
                    <div>
                        <p class="font-bold text-gray-900 text-sm mb-1">${o.partName}</p>
                        <div class="flex items-center gap-2">
                            <span class="text-[10px] bg-brand-50 text-brand-600 px-2 py-1 rounded font-bold">عرضك: ${o.price} DA</span>
                            <span class="text-[10px] text-gray-400">${o.condition || 'غير محدد'}</span>
                        </div>
                    </div>
                    <button onclick="deleteMyOffer('${o.id}')" class="text-red-400 text-xs bg-red-50 hover:bg-red-100 px-3 py-2 rounded-lg transition font-bold">سحب</button>
                </div>
            </div>`;
        });
    }

    // --- دالة عرض السوق (Market) المحدثة ---
    function renderMarketOrders() {
        const list = document.getElementById('ordersList');
        if(!list) return;
        list.innerHTML = "";
        
        const now = new Date();
        const FOUR_HOURS = 4 * 60 * 60 * 1000;
        const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

        const visible = allMarketOrders.filter(o => {
            // 1. إذا كان الطلب مباع
            if (o.status === 'sold') {
                if (o.soldAt) {
                    const soldDate = o.soldAt.toDate ? o.soldAt.toDate() : new Date(o.soldAt);
                    const diff = now - soldDate;
                    return diff < FOUR_HOURS; // يظهر لمدة 4 ساعات فقط
                }
                return false;
            }
            // 2. إذا كان الطلب نشط
            if (o.createdAt) {
                const createdDate = o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
                const age = now - createdDate;
                if (age > THIRTY_DAYS) return false; // يخفي القديم جداً (30 يوم)
            }
            // 3. إذا قدمت عرضاً
            if (myOfferedOrderIds.has(o.id)) return false;

            return true;
        });

        if(visible.length === 0) { 
            list.innerHTML = `<div class="flex flex-col items-center justify-center py-10 opacity-60"><p class='text-center text-gray-400 text-sm'>لا توجد طلبات جديدة حالياً</p></div>`; 
            return; 
        }
        
        visible.forEach(o => {
            const isSold = (o.status === 'sold');
            if (isSold) {
                list.innerHTML += `
                <div class="bg-gray-800/50 border border-gray-700 p-5 rounded-2xl mb-4 relative opacity-60 grayscale select-none">
                    <div class="absolute top-0 left-0 bg-gray-600 text-white text-[10px] px-3 py-1 rounded-br-xl font-bold flex items-center gap-1">مباع 🔒</div>
                    <div class="mt-4 flex justify-between items-center">
                        <div>
                            <h3 class="font-bold text-gray-400 text-sm line-through decoration-red-500/50">${o.partName}</h3>
                            <p class="text-[10px] text-gray-500">${o.carMake} ${o.carYear || ''}</p>
                        </div>
                        <span class="text-[9px] text-gray-500 font-mono bg-gray-900 px-2 py-1 rounded">بيع منذ: ${timeAgo(o.soldAt)}</span>
                    </div>
                </div>`;
            } else {
                list.innerHTML += `
                <div class="bg-white p-5 rounded-2xl shadow-lg shadow-gray-900/10 border border-gray-100 mb-4 hover:shadow-xl transition-all duration-300 cursor-pointer relative overflow-hidden group transform hover:-translate-y-1" onclick="openDetailsModal('${o.id}')">
                    <div class="absolute top-0 right-0 w-1.5 h-full bg-gradient-to-b from-orange-500 to-orange-600 rounded-l-full group-hover:w-2.5 transition-all"></div>
                    <div class="flex justify-between items-start mb-3 pl-3">
                        <div>
                            <h3 class="font-black text-gray-900 text-lg leading-tight mb-1">${o.partName}</h3>
                            <div class="flex items-center gap-2">
                                <span class="text-[10px] font-bold bg-orange-50 text-orange-600 px-2 py-0.5 rounded border border-orange-100">${o.carMake}</span>
                                <span class="text-[10px] text-gray-400 font-mono">${o.carYear || ''}</span>
                            </div>
                        </div>
                        <span class="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded-full flex items-center gap-1 font-medium">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            ${timeAgo(o.createdAt)}
                        </span>
                    </div>
                    <div class="flex justify-between items-end mt-4 pl-3">
                        <div class="flex items-center gap-1 text-gray-400 text-[10px]">
                            📍 ${o.wilaya ? getWilayaName(o.wilaya) : 'الجزائر'}
                        </div>
                        <span class="bg-gray-900 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md flex items-center gap-2 group-hover:bg-orange-600 transition-colors">
                            معاينة
                            <svg class="w-3 h-3 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                        </span>
                    </div>
                </div>`;
            }
        });
    }
    
    function getWilayaName(num) {
        const wilayas = ["Adrar", "Chlef", "Laghouat", "Oum El Bouaghi", "Batna", "Béjaïa", "Biskra", "Béchar", "Blida", "Bouira", "Tamanrasset", "Tébessa", "Tlemcen", "Tiaret", "Tizi Ouzou", "Alger", "Djelfa", "Jijel", "Sétif", "Saïda", "Skikda", "Sidi Bel Abbès", "Annaba", "Guelma", "Constantine", "Médéa", "Mostaganem", "M'Sila", "Mascara", "Ouargla", "Oran", "El Bayadh", "Illizi", "Bordj Bou Arreridj", "Boumerdès", "El Tarf", "Tindouf", "Tissemsilt", "El Oued", "Khenchela", "Souk Ahras", "Tipaza", "Mila", "Aïn Defla", "Naâma", "Aïn Témouchent", "Ghardaïa", "Relizane", "Timimoun", "Bordj Badji Mokhtar", "Ouled Djellal", "Béni Abbès", "In Salah", "In Guezzam", "Touggourt", "Djanet", "El M'Ghair", "El Meniaa"];
        return wilayas[parseInt(num)-1] || '---';
    }

    const btnOpenOffer = document.getElementById('btnOpenOffer');
    if(btnOpenOffer) {
        btnOpenOffer.addEventListener('click', () => {
            document.getElementById('detailsModal').classList.add('hidden');
            const offerModal = document.getElementById('offerModal');
            offerModal.classList.remove('hidden');
            
            const container = document.querySelector('#offerModal .space-y-5'); 
            
            if(container && !document.getElementById('addedOfferFields')) {
                const newFields = document.createElement('div');
                newFields.id = 'addedOfferFields';
                newFields.className = 'space-y-4 pt-2 animate-slide-up';
                newFields.innerHTML = `
                    <div class="relative">
                        <select id="offerCondition" class="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 focus:outline-none focus:border-brand-500 appearance-none">
                            <option value="" disabled selected>اختر حالة القطعة</option>
                            <option value="جديدة"> جديدة (New)</option>
                            <option value="شبه جديدة"> شبه جديدة (Good Condition)</option>
                            <option value="مستعملة"> مستعملة (Used)</option>
                            <option value="قديمة"> قديمة (Old)</option>
                        </select>
                        <div class="absolute inset-y-0 left-0 flex items-center px-3 pointer-events-none text-gray-500">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>

                    <div>
                        <label class="block text-xs font-bold text-gray-400 mb-2">إضافة صور (اختياري)</label>
                        <div class="flex gap-2">
                            ${[1,2,3].map(i => `
                            <label class="flex-1 h-20 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center cursor-pointer hover:border-brand-300 transition relative overflow-hidden group">
                                <input type="file" id="sellerImg${i}" accept="image/*" class="hidden" onchange="previewThumb(this)">
                                <span id="plusIcon${i}" class="text-2xl text-gray-300 group-hover:text-brand-400 transition">+</span>
                                <img class="absolute inset-0 w-full h-full object-cover hidden" id="thumb${i}">
                            </label>`).join('')}
                        </div>
                    </div>

                    <textarea id="offerNotes" class="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm focus:outline-none focus:border-brand-500 h-24 resize-none" placeholder="اكتب ملاحظات إضافية هنا..."></textarea>
                `;
                const sendBtn = document.getElementById('sendOfferBtn');
                if(sendBtn) container.insertBefore(newFields, sendBtn);
            }
            
            sellerImagesBase64 = [];
            ['thumb1','thumb2','thumb3'].forEach(id => { 
                const el = document.getElementById(id); if(el) el.classList.add('hidden'); 
            });
            ['plusIcon1','plusIcon2','plusIcon3'].forEach(id => { 
                const el = document.getElementById(id); if(el) el.classList.remove('hidden'); 
            });
            ['sellerImg1','sellerImg2','sellerImg3'].forEach(id => { 
                const el = document.getElementById(id); if(el) el.value = ''; 
            });
        });
    }

        const sendBtn = document.getElementById('sendOfferBtn');
    if(sendBtn) {
        sendBtn.addEventListener('click', async () => {
            if (currentSellerData.balance < 50) {
                alert("⚠️ عذراً، رصيدك غير كافٍ لإرسال العروض.\nيجب أن يكون لديك 50 دج على الأقل.");
                return; 
            }

            const price = document.getElementById('offerPrice').value;
            if(!price) return alert("أدخل السعر");

            const condition = document.getElementById('offerCondition') ? document.getElementById('offerCondition').value : "غير محدد";
            const notes = document.getElementById('offerNotes') ? document.getElementById('offerNotes').value : "";
            
            sellerImagesBase64 = [];
            const files = [
                document.getElementById('sellerImg1')?.files[0],
                document.getElementById('sellerImg2')?.files[0],
                document.getElementById('sellerImg3')?.files[0]
            ].filter(f => f); 

            const readFiles = (filesArr) => Promise.all(filesArr.map(file => compressImage(file)));

            const originalText = sendBtn.innerText;
            sendBtn.innerText = "جاري رفع الصور...";
            sendBtn.disabled = true;

            if(files.length > 0) {
                try {
                    sellerImagesBase64 = await readFiles(files);
                } catch(err) { alert("خطأ في الصور"); sendBtn.disabled = false; return; }
            }

            sendBtn.innerText = "جاري الإرسال...";
            try {
                const partNameEl = document.getElementById('detailPartName');
                const partName = partNameEl ? partNameEl.innerText : "قطعة غيار";
                await addDoc(collection(db, "offers"), {
                    orderId: selectedOrderId,
                    sellerId: currentSellerId,
                    sellerName: currentSellerData.shopName,
                    sellerPhone: currentSellerData.phone,
                    price: price,
                    partName: partName,
                    condition: condition, 
                    notes: notes,         
                    images: sellerImagesBase64, 
                    createdAt: serverTimestamp()
                });
                document.getElementById('offerModal').classList.add('hidden');
                document.getElementById('offerPrice').value = "";
                if(document.getElementById('offerNotes')) document.getElementById('offerNotes').value = "";
                
                alert("تم إرسال العرض بنجاح!");
            } catch(e) { alert(e.message); }
            
            sendBtn.innerText = originalText;
            sendBtn.disabled = false;
        });
    }

    window.deleteMyOffer = async (id) => { if(confirm("سحب العرض؟")) await deleteDoc(doc(db, "offers", id)); };

    function setupChangePassword() {
    const btn = document.getElementById('btnChangePass');
    if (btn) {
        btn.addEventListener('click', async () => {
            const newPass = document.getElementById('newPass').value;
            if (!newPass || newPass.length < 6) {
                return alert("كلمة المرور يجب أن تكون 6 أحرف أو أكثر.");
            }
            const user = auth.currentUser;
            if (!user) return alert("يرجى إعادة تسجيل الدخول للمتابعة.");
            
            const originalText = btn.innerText;
            btn.innerText = "جاري التحديث...";
            btn.disabled = true;
            
            try {
                await updatePassword(user, newPass);
                alert("✅ تم تغيير كلمة المرور بنجاح!");
                document.getElementById('newPass').value = "";
            } catch (error) {
                console.error("Error updating password:", error);
                if (error.code === 'auth/requires-recent-login') {
                    alert("⚠️ لأسباب أمنية، يجب عليك تسجيل الخروج ثم الدخول مرة أخرى لتتمكن من تغيير كلمة المرور.");
                } else {
                    alert("حدث خطأ: " + error.message);
                }
            } finally {
                btn.innerText = originalText;
                btn.disabled = false;
            }
        });
    }
}

    function timeAgo(t) {
        if(!t) return "";
        const s = Math.floor((new Date() - t.toDate())/1000);
        if(s>3600) return Math.floor(s/3600) + " س";
        if(s>60) return Math.floor(s/60) + " د";
        return "الآن";
    }

    initDashboard();
}

// ============================================================
// 3. تسجيل الدخول والتسجيل (LOGIN & REGISTER)
// ============================================================

const sellerLoginBtn = document.getElementById('sellerLoginBtn');
if (sellerLoginBtn) {
    sellerLoginBtn.addEventListener('click', async () => {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        if(!email || !password) return alert("يرجى ملء الحقول");

        sellerLoginBtn.innerText = "جاري الدخول...";
        sellerLoginBtn.disabled = true;

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            const docRef = doc(db, "sellers", user.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.isBlocked) { 
                    alert("⛔ حسابك محظور من قبل الإدارة."); 
                    await signOut(auth);
                } else if (data.isVerified === false) {
                    alert("⏳ حسابك قيد المراجعة.\nيرجى انتظار موافقة الإدارة.");
                    await signOut(auth);
                } else {
                    localStorage.setItem('sellerId', user.uid);
                    window.location.href = "dash.html"; 
                }
            } else {
                alert("بيانات البائع غير موجودة");
                await signOut(auth);
            }
        } catch (error) {
            console.error(error);
            alert("خطأ في البريد الإلكتروني أو كلمة المرور");
        }
        sellerLoginBtn.innerText = "تسجيل الدخول";
        sellerLoginBtn.disabled = false;
    });
}

// ميزة معاينة صورة التسجيل
const regImgInput = document.getElementById('regShopImage');
if(regImgInput) {
    regImgInput.addEventListener('change', function(e) {
        if(this.files && this.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                let preview = document.getElementById('regImgPreview');
                if(!preview) {
                    preview = document.createElement('img');
                    preview.id = 'regImgPreview';
                    preview.className = "w-full h-32 object-cover rounded-lg mt-2 border border-gray-600 shadow-lg";
                    regImgInput.parentNode.appendChild(preview);
                }
                preview.src = e.target.result;
            }
            reader.readAsDataURL(this.files[0]);
        }
    });
}

const btnRegister = document.getElementById('btnRegister');
if (btnRegister) {
    btnRegister.addEventListener('click', async () => {
        const shopName = document.getElementById('regShopName').value;
        const phone = document.getElementById('regPhone').value;
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;
        const wilaya = document.getElementById('regWilaya').value;
        const baladiya = document.getElementById('regBaladiya').value;
        const fileInput = document.getElementById('regShopImage');

        if (!shopName || !phone || !email || !password || !wilaya || !baladiya) {
            alert("يرجى ملء جميع البيانات"); return;
        }
        if (!fileInput.files || !fileInput.files[0]) {
            alert("صورة المحل إجبارية"); return;
        }

        const originalText = btnRegister.innerText;
        btnRegister.innerText = "جاري الإنشاء...";
        btnRegister.disabled = true;

        try {
            const file = fileInput.files[0];
            const compressedBase64 = await compressImage(file);

            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            await setDoc(doc(db, "sellers", user.uid), {
                shopName: shopName,
                phone: phone,
                email: email,
                wilaya: wilaya,
                baladiya: baladiya,
                shopImage: compressedBase64,
                balance: 1500,
                isBlocked: false,
                isVerified: false,
                createdAt: serverTimestamp()
            });

            alert("✅ تم إرسال طلبك بنجاح!\nسيتم تفعيل حسابك من قبل الإدارة بعد مراجعة بياناتك.");

            document.getElementById('regShopName').value = "";
            document.getElementById('regPhone').value = "";
            document.getElementById('regEmail').value = "";
            document.getElementById('regPassword').value = "";
            document.getElementById('regWilaya').value = "";
            document.getElementById('regBaladiya').value = "";
            fileInput.value = "";
            const preview = document.getElementById('regImgPreview');
            if(preview) preview.remove();

            if (window.showLogin) window.showLogin();

        } catch (e) {
            console.error(e);
            alert("حدث خطأ: " + e.message);
        } finally {
            btnRegister.disabled = false;
            btnRegister.innerText = originalText;
        }
    });
}

const btnSendReset = document.getElementById('btnSendReset');
if (btnSendReset) {
    btnSendReset.addEventListener('click', async () => {
        const email = document.getElementById('forgotEmail').value.trim();
        if (!email) { alert("أدخل البريد الإلكتروني"); return; }
        
        const btn = btnSendReset;
        const originalText = btn.innerText;
        btn.innerText = "جاري الإرسال...";
        btn.disabled = true;
        
        try {
            await sendPasswordResetEmail(auth, email);
            alert("تم إرسال رابط إعادة تعيين كلمة السر إلى بريدك الإلكتروني.");
            document.getElementById('forgotModal').classList.add('hidden');
        } catch (e) {
            console.error(e);
            alert("حدث خطأ: " + e.message);
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    });
}

// ============================================================
// 4. منطق الأدمن (ADMIN)
// ============================================================
if (localStorage.getItem('adminLoggedIn') === 'true') {
    const loginScreen = document.getElementById('adminLoginScreen');
    const dashboard = document.getElementById('adminDashboard');
    
    // إخفاء شاشة القفل وإظهار اللوحة
    if (loginScreen) loginScreen.classList.add('hidden');
    if (dashboard) dashboard.classList.remove('hidden');
    
    // تشغيل دالة جلب البيانات
    // نستخدم setTimeout لضمان أن الدالة initAdminPanel قد تم تحميلها
    setTimeout(() => {
        if (typeof initAdminPanel === "function") initAdminPanel();
    }, 100);
}

// 2. زر تسجيل الدخول
const btnAdminLogin = document.getElementById('btnAdminLogin');
if (btnAdminLogin) {
    btnAdminLogin.addEventListener('click', () => {
        const passInput = document.getElementById('adminPass');
        
        // التحقق من كلمة المرور
        if (passInput && passInput.value === "admin123") {
            // ✅ حفظ حالة الدخول في المتصفح
            localStorage.setItem('adminLoggedIn', 'true');
            
            document.getElementById('adminLoginScreen').classList.add('hidden');
            document.getElementById('adminDashboard').classList.remove('hidden');
            initAdminPanel();
        } else {
            alert("كلمة المرور خاطئة");
        }
    });
}

// 3. دالة تسجيل الخروج (مهمة جداً الآن)
// يجب استدعاء هذه الدالة عند الضغط على زر الخروج في الـ HTML
window.adminLogout = () => {
    if (confirm("هل تريد تسجيل الخروج؟")) {
        localStorage.removeItem('adminLoggedIn'); // مسح الحفظ
        location.reload(); // إعادة تحميل الصفحة للعودة للقفل
    }
};

// ============================================================
// دالة لوحة الأدمن (مع البحث الشامل المحدث)
// ============================================================
function initAdminPanel() {
    // مخزن البيانات المحلي (يحتوي دائماً على النسخة الكاملة من البيانات)
    let state = {
        pending: [],
        orders: [],
        sellers: [],
        balanceRequests: [], // أضفنا طلبات الرصيد هنا
        requests: []
    };

    // ----------------------------------------------------
    // 1. دالة البحث والفلترة المركزية (العقل المدبر)
    // ----------------------------------------------------
    const performGlobalSearch = () => {
        const searchEl = document.getElementById('globalAdminSearch');
        // تحويل النص لحروف صغيرة ومسح الفراغات للبحث الدقيق
        const term = searchEl ? searchEl.value.toLowerCase().trim() : "";

        // --- أ) فلترة الانتظار (Pending) ---
        // نبحث في: اسم المتجر، الهاتف، الولاية، الإيميل
        const filteredPending = state.pending.filter(i => {
            const d = i.data;
            const fullText = `${d.shopName} ${d.phone} ${d.wilaya} ${d.baladiya} ${d.email}`.toLowerCase();
            return fullText.includes(term);
        });
        renderPending(filteredPending);

        // --- ب) فلترة الطلبات (Orders) ---
        // نبحث في: اسم القطعة، السيارة، الهاتف، الكود السري، الموديل
        const filteredOrders = state.orders.filter(i => {
            const d = i.data;
            const fullText = `${d.partName} ${d.carMake} ${d.carModel || ''} ${d.phoneNumber} ${d.secretCode || ''} ${d.wilaya || ''}`.toLowerCase();
            return fullText.includes(term);
        });
        renderOrders(filteredOrders);

        // --- ج) فلترة التجار (Sellers) ---
        // نبحث في: اسم المتجر، الهاتف، الولاية
        const filteredSellers = state.sellers.filter(i => {
            const d = i.data;
            const fullText = `${d.shopName} ${d.phone} ${d.wilaya} ${d.email}`.toLowerCase();
            return fullText.includes(term);
        });
        renderSellers(filteredSellers);

        // --- د) فلترة طلبات الرصيد (Balance) ---
        // نبحث في: اسم المتجر، الهاتف، المبلغ
        const filteredBalance = state.balanceRequests.filter(i => {
            const d = i.data;
            const fullText = `${d.shopName} ${d.phone} ${d.amount}`.toLowerCase();
            return fullText.includes(term);
        });
        renderBalance(filteredBalance);
    };

    // ربط حدث الكتابة بدالة البحث
    const searchInput = document.getElementById('globalAdminSearch');
    if (searchInput) {
        // "input" يعني التحديث فوراً عند كتابة أي حرف
        searchInput.addEventListener('input', performGlobalSearch);
    }

    // ----------------------------------------------------
    // 2. دوال الرسم (Render Functions)
    // ----------------------------------------------------

    const renderPending = (data) => {
        const list = document.getElementById('adminPendingList');
        if (!list) return;
        list.innerHTML = "";
        if (data.length === 0) { list.innerHTML = `<p class="text-center text-gray-600 text-xs py-10">لا توجد نتائج مطابقة</p>`; return; }

        data.forEach(item => {
            const d = item.data;
            const img = d.shopImage || 'https://via.placeholder.com/100';
            list.innerHTML += `
<div class="bg-gray-800 p-4 rounded-2xl border border-gray-700 flex flex-col sm:flex-row gap-4 items-start sm:items-center animate-slide-up hover:border-yellow-500/30 transition">
  <img src="${img}" class="w-16 h-16 rounded-xl object-cover border border-gray-600 cursor-zoom-in" onclick="window.open(this.src)">
  <div class="flex-1">
    <h4 class="font-bold text-white text-base">${d.shopName}</h4>
    <p class="text-xs text-gray-400 mb-0.5">📍 ${d.wilaya} - ${d.baladiya}</p>
    <p class="text-xs text-blue-400 font-mono tracking-wider">📱 ${d.phone}</p>
  </div>
  <div class="flex gap-2 w-full sm:w-auto">
    <button onclick="adminApproveSeller('${item.id}')" class="flex-1 bg-green-600 hover:bg-green-500 text-white text-[10px] font-bold py-2 px-4 rounded-xl transition">قبول</button>
    <button onclick="adminRejectSeller('${item.id}')" class="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-bold py-2 px-4 rounded-xl transition">رفض</button>
  </div>
</div>`;
        });
    };

    const renderBalance = (data) => {
        const list = document.getElementById('adminBalanceRequestsList');
        if (!list) return;
        list.innerHTML = "";
        if (data.length === 0) { list.innerHTML = `<p class="text-center text-gray-600 text-xs py-10 border border-dashed border-gray-800 rounded-2xl">لا توجد طلبات شحن</p>`; return; }

        data.forEach(item => {
            const r = item.data;
            const imgHtml = r.receiptImage ? `<div class="mb-2"><img src="${r.receiptImage}" class="h-12 w-auto rounded border border-gray-600 cursor-zoom-in" onclick="window.open(this.src)"></div>` : ``;

            list.innerHTML += `
<div class="bg-gray-800 p-4 rounded-2xl border border-gray-700 animate-slide-up hover:border-purple-500/30 transition">
  <div class="flex justify-between items-start">
    <div>
      <p class="font-bold text-white text-sm mb-1">🏪 ${r.shopName}</p>
      <p class="text-xs text-gray-400 font-mono mb-2">📱 ${r.phone}</p>
      <div class="flex items-center gap-2">
        <span class="text-purple-400 font-black text-xl">${r.amount} <span class="text-xs">DA</span></span>
        <span class="text-[10px] text-gray-500 bg-gray-900 px-2 py-1 rounded">طلب شحن</span>
      </div>
    </div>
    ${imgHtml}
  </div>
  <div class="flex gap-2 mt-4 pt-3 border-t border-gray-700">
    <button onclick="adminApproveTopUp('${item.id}', '${r.sellerId}', ${r.amount})" class="flex-1 bg-green-600 hover:bg-green-500 text-white text-xs font-bold py-2.5 rounded-xl transition">✅ تأكيد الشحن</button>
    <button onclick="adminRejectTopUp('${item.id}')" class="px-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold py-2.5 rounded-xl transition">رفض</button>
  </div>
</div>`;
        });
    };

    const renderOrders = (data) => {
        const list = document.getElementById('adminOrdersList');
        if (!list) return;
        list.innerHTML = "";
        if (data.length === 0) { list.innerHTML = `<p class="text-center text-gray-600 text-xs py-10">لا توجد نتائج مطابقة</p>`; return; }

        data.forEach(item => {
            const d = item.data;
            list.innerHTML += `
<div class="bg-gray-800 p-4 rounded-2xl border border-gray-700 mb-3 flex justify-between items-center hover:border-green-500/30 transition">
  <div>
    <p class="font-bold text-sm text-white mb-1">${d.partName}</p>
    <div class="flex flex-wrap gap-2">
      <span class="text-[10px] text-gray-300 bg-gray-700 px-2 py-0.5 rounded border border-gray-600">${d.carMake} ${d.carModel || ''}</span>
      <span class="text-[10px] text-orange-400 font-mono bg-orange-400/10 px-2 py-0.5 rounded">${d.phoneNumber}</span>
      <span class="text-[10px] text-gray-500 bg-black/20 px-2 py-0.5 rounded font-mono tracking-widest">Code: ${d.secretCode || '---'}</span>
    </div>
  </div>
  <button onclick="adminDeleteDoc('orders','${item.id}')" class="text-red-400 hover:bg-red-500/10 p-2 rounded-lg transition">
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
    </svg>
  </button>
</div>`;
        });
    };

    const renderSellers = (data) => {
        const list = document.getElementById('adminSellersList');
        if (!list) return;
        list.innerHTML = "";
        if (data.length === 0) { list.innerHTML = `<p class="text-center text-gray-600 text-xs py-10">لا توجد نتائج مطابقة</p>`; return; }

        data.forEach(item => {
            const d = item.data;
            list.innerHTML += `
<div class="bg-gray-800 p-4 rounded-2xl border border-gray-700 mb-3 hover:border-blue-500/30 transition">
  <div class="flex justify-between items-start mb-2">
    <div>
      <p class="font-bold text-white text-base">${d.shopName}</p>
      <p class="text-xs text-gray-400">📍 ${d.wilaya || '--'}</p>
    </div>
    <span class="${d.isBlocked ? 'text-red-400 bg-red-400/10 border-red-400/20' : 'text-green-400 bg-green-400/10 border-green-400/20'} text-[10px] px-2 py-1 rounded border font-bold">
      ${d.isBlocked ? 'محظور' : 'نشط'}
    </span>
  </div>
  
  <div class="flex items-center justify-between bg-gray-900/50 p-2 rounded-xl mb-3">
    <span class="text-xs text-gray-400 font-mono">${d.phone}</span>
    <span class="text-yellow-500 font-bold text-sm">${d.balance} DA</span>
  </div>
  
  <div class="flex gap-2">
    <button onclick="adminToggleBlock('${item.id}', ${d.isBlocked})" class="flex-1 bg-gray-700 hover:bg-gray-600 text-[10px] py-2 rounded-lg text-white transition">${d.isBlocked ? 'فك الحظر' : 'حظر'}</button>
    <button onclick="adminAddBalance('${item.id}')" class="flex-1 bg-blue-600 hover:bg-blue-500 text-[10px] py-2 rounded-lg text-white font-bold transition">+ رصيد يدوي</button>
    <button onclick="adminDeleteSeller('${item.id}')" class="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-[10px] py-2 rounded-lg transition">حذف</button>
  </div>
</div>`;
        });
    };

    // ----------------------------------------------------
    // 3. جلب البيانات (Listeners)
    // ----------------------------------------------------

    // أ) جلب الانتظار
    onSnapshot(query(collection(db, "sellers"), where("isVerified", "==", false)), (snap) => {
        const el = document.getElementById('statPending'); if (el) el.innerText = snap.size;
        state.pending = snap.docs.map(d => ({ id: d.id, data: d.data() }));
        performGlobalSearch(); // تحديث العرض فوراً عبر الفلتر
    });

    // ب) جلب الطلبات (Active Only)
    onSnapshot(query(collection(db, "orders"), orderBy("createdAt", "desc")), (snap) => {
        const activeOrders = snap.docs
            .map(d => ({ id: d.id, data: d.data() }))
            .filter(item => item.data.status !== 'sold');

        const el = document.getElementById('statOrders');
        if (el) el.innerText = activeOrders.length;

        state.orders = activeOrders;
        performGlobalSearch();
    });

    // ج) جلب التجار النشطين
    onSnapshot(collection(db, "sellers"), (snap) => {
        const verifiedSellers = snap.docs.filter(d => d.data().isVerified === true);
        const el = document.getElementById('statSellers'); if (el) el.innerText = verifiedSellers.length;

        state.sellers = snap.docs
            .map(d => ({ id: d.id, data: d.data() }))
            .filter(item => item.data.isVerified === true);

        performGlobalSearch();
    });

    // د) جلب طلبات الشحن (Balance)
    onSnapshot(query(collection(db, "balance_requests"), where("status", "==", "pending")), (snap) => {
        const el = document.getElementById('statBalance'); if (el) el.innerText = snap.size;
        state.balanceRequests = snap.docs.map(d => ({ id: d.id, data: d.data() }));
        performGlobalSearch();
    });

    // تنظيف تلقائي عند البدء
    async function systemAutoCleanup() {
        const THIRTY_DAYS_AGO = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
        try {
            const batch = writeBatch(db);
            let count = 0;
            // حذف الطلبات القديمة
            const oldOrders = await getDocs(query(collection(db, "orders"), where("createdAt", "<", THIRTY_DAYS_AGO))); oldOrders.forEach(d => { batch.delete(d.ref); count++; });
            // حذف المبيعات القديمة
            const oldSales = await getDocs(query(collection(db, "sales"), where("soldAt", "<", THIRTY_DAYS_AGO))); oldSales.forEach(d => { batch.delete(d.ref); count++; });

            if (count > 0) { await batch.commit(); console.log("Cleaned:", count); }
        } catch (e) { console.log("Cleanup check done."); }
    }
    systemAutoCleanup();
}

// --- دوال التحكم للأدمن (كما هي) ---
window.adminDeleteDoc = async (c, i) => { if (confirm("حذف؟")) await deleteDoc(doc(db, c, i)); };
window.adminToggleBlock = async (id, status) => { await updateDoc(doc(db, "sellers", id), { isBlocked: !status }); };
window.adminAddBalance = async (id) => { const a = prompt("المبلغ:"); if (a) await updateDoc(doc(db, "sellers", id), { balance: increment(parseInt(a)) }); };

window.adminDeleteSeller = async (id) => {
    if (!confirm("حذف نهائي؟")) return;
    const q = query(collection(db, "offers"), where("sellerId", "==", id));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.forEach((doc) => { batch.delete(doc.ref); });
    batch.delete(doc(db, "sellers", id));
    await batch.commit();
};

window.adminApproveSeller = async (id) => {
    if (!confirm("قبول؟")) return;
    await updateDoc(doc(db, "sellers", id), { isVerified: true });
};

window.adminRejectSeller = async (id) => {
    if (!confirm("رفض؟")) return;
    await deleteDoc(doc(db, "sellers", id));
};

window.adminApproveTopUp = async (reqId, sellerId, amount) => {
    if (!confirm("تأكيد الشحن؟")) return;
    const batch = writeBatch(db);
    batch.update(doc(db, "balance_requests", reqId), { status: 'approved', processedAt: serverTimestamp() });
    batch.update(doc(db, "sellers", sellerId), { balance: increment(amount) });
    await batch.commit();
    alert("تم الشحن");
};

window.adminRejectTopUp = async (reqId) => {
    if (!confirm("رفض الطلب؟")) return;
    await updateDoc(doc(db, "balance_requests", reqId), { status: 'rejected', processedAt: serverTimestamp() });
    alert("تم الرفض");
};