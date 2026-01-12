import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
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
const auth = getAuth(app); // تفعيل المصادقة
const db = getFirestore(app);

// ============================================================
// دالة مساعدة لتجنب الأخطاء عند إخفاء/إظهار العناصر
// ============================================================
const safeToggle = (id, action) => {
    const el = document.getElementById(id);
    if (el) {
        if (action === 'show') el.classList.remove('hidden');
        else el.classList.add('hidden');
    }
};

// ============================================================
// UI Helpers & Global Functions
// ============================================================

// --- 1. Lightbox (عارض الصور) ---
function createLightbox() {
    if (document.getElementById('imgLightbox')) return;
    const box = document.createElement('div');
    box.id = 'imgLightbox';
    box.className = 'fixed inset-0 z-[100] bg-black/95 hidden flex justify-center items-center cursor-zoom-out';
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

// --- 2. دالة ضغط الصور (الحل لمشكلة الحجم الكبير) ---
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

// --- 3. مودال التقييم الفوري ---
function createPostCallRatingModal(sellerId, orderId) {
    const old = document.getElementById('postCallRatingModal');
    if(old) old.remove();

    const modal = document.createElement('div');
    modal.id = 'postCallRatingModal';
    modal.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[90] font-sans p-4';
    
    modal.innerHTML = `
        <div class="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-slide-up relative">
            <div class="p-6 text-center">
                <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span class="text-2xl">📞</span>
                </div>
                <h3 class="text-lg font-bold text-gray-900 mb-1">تم توجيه الاتصال</h3>
                <p class="text-xs text-gray-500 mb-6">يرجى تقييم البائع لإتمام العملية</p>
                
                <div class="flex justify-center gap-2 mb-6" id="starContainer">
                    ${[1,2,3,4,5].map(i => `
                        <button onclick="selectStar(${i})" class="text-3xl text-gray-300 focus:outline-none transition hover:scale-110 star-btn" data-val="${i}">★</button>
                    `).join('')}
                </div>
                
                <input type="hidden" id="selectedRating" value="0">
                
                <button onclick="submitPostCallRating('${sellerId}', '${orderId}')" id="btnConfirmRate" class="w-full bg-gray-900 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                    تأكيد التقييم
                </button>
                <button onclick="document.getElementById('postCallRatingModal').remove()" class="mt-3 text-xs text-gray-400 underline">تخطي</button>
            </div>
        </div>`;
    document.body.appendChild(modal);

    window.selectStar = (val) => {
        document.getElementById('selectedRating').value = val;
        document.querySelectorAll('.star-btn').forEach(btn => {
            const btnVal = parseInt(btn.getAttribute('data-val'));
            if(btnVal <= val) {
                btn.classList.remove('text-gray-300');
                btn.classList.add('text-yellow-400');
            } else {
                btn.classList.add('text-gray-300');
                btn.classList.remove('text-yellow-400');
            }
        });
    };

    window.submitPostCallRating = async (sId, oId) => {
        const stars = document.getElementById('selectedRating').value;
        if(stars == 0) return alert("الرجاء اختيار عدد النجوم");
        
        const btn = document.getElementById('btnConfirmRate');
        btn.innerText = "جاري الإرسال...";
        btn.disabled = true;

        try {
            await addDoc(collection(db, "ratings"), {
                sellerId: sId,
                orderId: oId,
                stars: parseInt(stars),
                createdAt: serverTimestamp()
            });
            alert("شكراً لك! تم التقييم بنجاح.");
            document.getElementById('postCallRatingModal').remove();
            const trackBtn = document.getElementById('trackBtn');
            if(trackBtn) trackBtn.click();
        } catch(e) {
            console.error(e);
            alert("حدث خطأ في التقييم");
            btn.disabled = false;
        }
    };
}

// --- 4. مودال تفاصيل العرض للزبون ---
function createCustomerOfferModal() {
    if (document.getElementById('custOfferModal')) return;
    const modal = document.createElement('div');
    modal.id = 'custOfferModal';
    modal.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm hidden flex items-center justify-center z-[70] p-4 font-sans';
    modal.innerHTML = `
        <div class="bg-white w-full max-w-lg rounded-3xl overflow-hidden relative shadow-2xl max-h-[90vh] overflow-y-auto animate-slide-up">
            <button onclick="document.getElementById('custOfferModal').classList.add('hidden')" class="absolute top-4 left-4 bg-gray-100 p-2 rounded-full text-gray-500 hover:bg-gray-200 z-10 transition">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <div class="p-6 pt-12">
                <h3 class="text-2xl font-bold mb-4 text-center text-gray-900" id="custModalTitle">تفاصيل العرض</h3>
                <div id="custModalSellerRating" class="text-center mb-4"></div>

                <div id="custModalImages" class="flex overflow-x-auto gap-3 mb-6 snap-x py-2 hide-scrollbar min-h-[120px] bg-gray-50 rounded-xl items-center p-2"></div>
                <div class="space-y-3">
                    <div class="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex justify-between items-center">
                        <div>
                            <p class="text-xs text-gray-400 mb-1">حالة القطعة</p>
                            <p class="font-bold text-gray-800 flex items-center gap-2" id="custModalCondition">--</p>
                        </div>
                        <div class="text-left">
                             <p class="text-xs text-gray-400 mb-1">السعر المقترح</p>
                             <p class="text-xl font-bold text-brand-600" id="custModalPrice">0 DA</p>
                        </div>
                    </div>
                    <div class="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                        <p class="text-xs text-gray-400 mb-1">ملاحظات البائع</p>
                        <p class="text-gray-800 text-sm whitespace-pre-wrap leading-relaxed" id="custModalNotes">--</p>
                    </div>
                </div>
                <div id="custModalActionArea" class="mt-6"></div>
            </div>
        </div>`;
    document.body.appendChild(modal);
}
createCustomerOfferModal();

// --- 5. دالة مساعدة لجلب وعرض التقييم ---
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

// --- 6. دالة معاينة الصور للبائع ---
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

// ============================================================
// 1. منطق الزبون (CLIENT SIDE)
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
            } catch(err) {
                console.error(err);
                alert("حدث خطأ أثناء معالجة الصورة");
            }
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

        if(!carMake || !partName || !phoneNumber) { alert("املأ البيانات"); return; }

        submitBtn.disabled = true;
        submitBtn.innerText = "جاري الإرسال...";

        const generatedCode = Math.floor(1000 + Math.random() * 9000).toString();

        try {
            await addDoc(collection(db, "orders"), {
                carMake, carModel, carYear, partName, notes: partNotes, phoneNumber,
                imageUrl: uploadedImageBase64 || null, secretCode: generatedCode,
                status: "active", createdAt: serverTimestamp()
            });

            safeToggle('formScreen', 'hide');
            safeToggle('successScreen', 'show');

            const successDiv = document.getElementById('successScreen');
            if(successDiv) {
            successDiv.innerHTML = `
            <div class="flex items-center justify-center min-h-[50vh] p-4">
              <div class="bg-white w-full max-w-md p-6 rounded-3xl shadow-2xl text-center relative overflow-hidden animate-slide-up">
                <div class="absolute top-0 left-0 w-full h-2 bg-green-500"></div>
                
                <div class="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-100">
                  <span class="text-3xl">✅</span>
                </div>
                
                <h3 class="text-2xl font-bold text-gray-900 mb-2">تم إرسال الطلب!</h3>
                
                <div class="bg-yellow-50 border border-yellow-100 rounded-2xl p-5 my-5 shadow-inner">
                  <p class="text-sm text-yellow-700 font-bold mb-2">⚠️ هام جداً: احفظ هذا الرمز السري</p>
                  <div class="text-4xl font-black text-gray-800 tracking-widest font-mono my-3 select-all bg-white py-2 rounded-lg border border-yellow-200 border-dashed">
                    ${generatedCode}
                  </div>
                  <p class="text-xs text-gray-500 leading-relaxed">
                    ستحتاج هذا الرمز مع رقم هاتفك لـ
                    <span class="font-bold text-gray-700">تتبع حالة الطلب</span>
                    ومشاهدة عروض البائعين.
                  </p>
                </div>
                
                <div class="text-xs text-gray-400 mb-6 px-4">
                  طريقة الاستخدام: عد للصفحة الرئيسية في أي وقت، اضغط على زر "تتبع طلب"، وأدخل رقم هاتفك مع هذا الرمز.
                </div>
                
                <button onclick="window.resetCustomerForm()" class="w-full bg-gray-900 text-white font-bold py-3.5 rounded-xl shadow-lg hover:bg-gray-800 transition transform active:scale-95 cursor-pointer">
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

// ج) تتبع واتصال
const trackBtn = document.getElementById('trackBtn');
if (trackBtn) {
    trackBtn.addEventListener('click', async () => {
        const phone = document.getElementById('trackPhone').value.trim();
        const code = document.getElementById('trackCode').value.trim();
        
        if(!phone || !code) { alert("أدخل البيانات"); return; }
        
        trackBtn.innerText = "بحث...";
        try {
            const q = query(collection(db, "orders"), where("phoneNumber", "==", phone), where("secretCode", "==", code));
            onSnapshot(q, (snap) => {
                if(snap.empty) { 
                    alert("لا يوجد طلب بهذا الرقم والكود.");
                    trackBtn.innerText = "تتبع";
                    return; 
                }
                
                const orderDoc = snap.docs[0];
                const orderId = orderDoc.id;
                
                safeToggle('loginSection', 'hide');
                safeToggle('formScreen', 'hide');
                safeToggle('successScreen', 'hide');
                safeToggle('dashboardSection', 'show');
                
                trackBtn.innerText = "تتبع";
                const titleEl = document.getElementById('orderTitle');
                if(titleEl) titleEl.innerText = orderDoc.data().partName;

                onSnapshot(query(collection(db, "offers"), where("orderId", "==", orderId)), (offerSnap) => {
                    const list = document.getElementById('offersList');
                    if(!list) return;
                    list.innerHTML = "";
                    
                    onSnapshot(query(collection(db, "sales"), where("orderId", "==", orderId)), (salesSnap) => {
                        salesSnap.forEach(sDoc => {
                            const sale = sDoc.data();
                            list.innerHTML += `
                            <div class="bg-gray-50 p-4 rounded-2xl border border-gray-200 mb-4 opacity-75">
                                <div class="flex justify-between items-center">
                                    <h4 class="font-bold text-gray-500">تم الشراء من بائع</h4>
                                    <span class="text-green-600 font-bold text-sm">${sale.price} DA</span>
                                </div>
                                <p class="text-[10px] text-gray-400 mt-1">تمت العملية بنجاح</p>
                            </div>`;
                        });

                        if(offerSnap.empty && salesSnap.empty) {
                            list.innerHTML = "<p class='text-center text-gray-400 py-10 border border-dashed rounded-xl bg-gray-50'>جاري البحث عن بائعين...</p>";
                        }
                        
                        offerSnap.forEach(d => {
                            const o = d.data();
                            const offerId = d.id;
                            const offerDataStr = encodeURIComponent(JSON.stringify({...o, id: offerId}));
                            const ratingBoxId = `rating-${o.sellerId}-${offerId}`;
                            
                            const actionButtonHtml = `
<button onclick="openCustomerOfferDetails('${offerDataStr}')" 
class="w-full bg-gradient-to-r from-orange-600 to-orange-500 text-white font-black py-4 rounded-2xl shadow-lg shadow-orange-900/20 active:scale-95 transition-all text-sm mt-4">
    عرض تفاصيل القطعة
</button>`;

                            list.innerHTML += `
                            <div class="bg-white p-5 rounded-2xl border border-gray-100 mb-4 shadow-sm hover:shadow-md transition">
                                <div class="flex justify-between items-start mb-2">
                                    <div>
                                        <h4 class="font-bold text-gray-900">${o.sellerName}</h4>
                                        <div id="${ratingBoxId}" class="mt-1"></div>
                                        <p class="text-[10px] text-gray-400 mt-1">حالة: <span class="text-gray-800 font-medium">${o.condition || 'غير محدد'}</span></p>
                                    </div>
                                    <span class="bg-orange-500/10 text-orange-500 px-3 py-1 rounded-lg font-bold text-lg">${o.price} DA</span>
                                ${actionButtonHtml}
                            </div>`;
                            
                            updateRatingUI(o.sellerId, ratingBoxId);
                        });
                    });
                });
            });
        } catch(e) { console.error(e); trackBtn.innerText = "تتبع"; }
    });

    window.openCustomerOfferDetails = (offerDataEncoded) => {
        const offer = JSON.parse(decodeURIComponent(offerDataEncoded));
        const modal = document.getElementById('custOfferModal');
        const actionArea = document.getElementById('custModalActionArea');
        const imgContainer = document.getElementById('custModalImages');
        const ratingContainer = document.getElementById('custModalSellerRating');
        
        document.getElementById('custModalCondition').innerText = offer.condition || "غير محدد";
        document.getElementById('custModalNotes').innerText = offer.notes || "لا توجد ملاحظات";
        document.getElementById('custModalPrice').innerText = offer.price + " DA";

        const modalRatingId = `modal-rating-${offer.sellerId}`;
        ratingContainer.innerHTML = `<div id="${modalRatingId}" class="flex justify-center"></div>`;
        updateRatingUI(offer.sellerId, modalRatingId);

        imgContainer.innerHTML = "";
        if (offer.images && offer.images.length > 0) {
            offer.images.forEach(img => {
                imgContainer.innerHTML += `<img src="${img}" class="h-32 w-auto rounded-xl border border-gray-200 shadow-sm snap-center object-cover cursor-zoom-in hover:brightness-90 transition" onclick="openLightbox(this.src)">`;
            });
        } else {
            imgContainer.innerHTML = `<p class="text-gray-400 text-xs w-full text-center">لا توجد صور</p>`;
        }

        const cleanPhone = offer.sellerPhone ? offer.sellerPhone.toString().replace(/\D/g, '') : "";
        actionArea.innerHTML = `
            <button onclick="handleCustomerCallFinal('${offer.sellerId}', '${offer.orderId}', '${cleanPhone}', '${offer.partName}', '${offer.price}', '${offer.id}')" 
            class="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-green-600/30 flex items-center justify-center gap-2 animate-pulse">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
            إظهار الرقم والاتصال
            </button>
            <p class="text-center text-[10px] text-gray-400 mt-3 bg-gray-50 p-2 rounded">بالضغط على الاتصال سيتم حجز القطعة لك</p>`;
        
        modal.classList.remove('hidden');
    };

    window.handleCustomerCallFinal = async (sellerId, orderId, phone, partName, price, offerId) => {
        document.getElementById('custOfferModal').classList.add('hidden');
        await handleCustomerCall(sellerId, orderId, phone, partName, price);
    };

    window.handleCustomerCall = async (sellerId, orderId, phone, partName, price) => {
        if(!confirm("تأكيد الاتصال؟ سيتم إغلاق الطلب وحجزه لك.")) return;
        
        try {
            const orderRef = doc(db, "orders", orderId);
            const orderSnap = await getDoc(orderRef);
            if(orderSnap.exists() && orderSnap.data().status === 'sold') { return; }

            const qOffer = query(collection(db, "offers"), where("orderId", "==", orderId), where("sellerId", "==", sellerId));
            const offerSnap = await getDocs(qOffer);

            const batch = writeBatch(db);
            offerSnap.forEach(doc => { batch.delete(doc.ref); });

            batch.update(doc(db, "sellers", sellerId), { balance: increment(-50) });
            batch.update(orderRef, { status: 'sold', soldAt: serverTimestamp() });
            batch.set(doc(collection(db, "sales")), { sellerId, partName, price, soldAt: serverTimestamp(), orderId });
            
            await batch.commit();
            window.location.href = `tel:${phone}`;
            createPostCallRatingModal(sellerId, orderId);

        } catch(e) { 
            console.error(e); 
            alert("حدث خطأ أثناء العملية، يرجى المحاولة مرة أخرى.");
        }
    };
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

    function renderMarketOrders() {
        const list = document.getElementById('ordersList');
        if(!list) return;
        list.innerHTML = "";
        const now = new Date();
        const FOUR_HOURS = 4 * 60 * 60 * 1000;
        const visible = allMarketOrders.filter(o => {
            if (myOfferedOrderIds.has(o.id) && o.status !== 'sold') return false;
            if (o.status === 'sold') { return o.soldAt ? (now - o.soldAt.toDate()) < FOUR_HOURS : true; }
            return true;
        });
        if(visible.length === 0) { list.innerHTML = "<p class='text-center text-gray-400 mt-10 text-xs'>لا طلبات متاحة حالياً</p>"; return; }
        
        visible.forEach(o => {
            const isSold = (o.status === 'sold');
            if (isSold) {
                list.innerHTML += `
                <div class="bg-gray-50 border border-gray-100 p-5 rounded-2xl mb-4 relative opacity-70 grayscale">
                    <div class="absolute top-0 left-0 bg-gray-500 text-white text-[10px] px-3 py-1 rounded-br-xl font-bold">مباع 🔒</div>
                    <div class="mt-3">
                        <h3 class="font-bold text-gray-500 text-sm line-through">${o.partName}</h3>
                        <span class="text-[9px] text-gray-400 block mt-1">${timeAgo(o.soldAt || o.createdAt)}</span>
                    </div>
                </div>`;
            } else {
                list.innerHTML += `
                <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-4 hover:shadow-md transition cursor-pointer relative overflow-hidden group" onclick="openDetailsModal('${o.id}')">
                    <div class="absolute top-0 right-0 w-1 h-full bg-brand-500 rounded-l-full group-hover:w-2 transition-all"></div>
                    <div class="flex justify-between items-start mb-3 pointer-events-none pl-3">
                        <h3 class="font-bold text-gray-900 text-base">${o.partName}</h3>
                        <span class="text-[10px] bg-gray-100 px-2 py-1 rounded-full text-gray-500 flex items-center gap-1">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            ${timeAgo(o.createdAt)}
                        </span>
                    </div>
                    <div class="flex justify-between items-end mt-2 pointer-events-none pl-3">
                        <div>
                            <p class="text-xs text-gray-600 font-medium">${o.carMake} ${o.carYear||''}</p>
                            <p class="text-[10px] text-gray-400 mt-0.5">سيارة</p>
                        </div>
                        <span class="bg-gray-900 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm flex items-center gap-1 group-hover:bg-brand-600 transition">
                            معاينة
                            <svg class="w-3 h-3 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
                        </span>
                    </div>
                </div>`;
            }
        });
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
            
            // 1. التحقق من الرصيد أولاً
            if (currentSellerData.balance < 50) {
                alert("⚠️ عذراً، رصيدك غير كافٍ لإرسال العروض.\nيجب أن يكون لديك 50 دج على الأقل.");
                return; 
            }

            // 2. التحقق من المدخلات
            const price = document.getElementById('offerPrice').value;
            if(!price) return alert("أدخل السعر");

            const condition = document.getElementById('offerCondition') ? document.getElementById('offerCondition').value : "غير محدد";
            const notes = document.getElementById('offerNotes') ? document.getElementById('offerNotes').value : "";
            
            // 3. معالجة الصور
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

            // 4. إرسال البيانات
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
        if(btn) {
            btn.addEventListener('click', async () => {
                const newPass = document.getElementById('newPass').value;
                if(!newPass) return alert("أدخل كلمة المرور");
                try {
                    await updateDoc(doc(db, "sellers", currentSellerId), { password: newPass });
                    alert("تم التغيير");
                    document.getElementById('newPass').value = "";
                } catch(e) { alert(e.message); }
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
// 3. تسجيل الدخول والتسجيل (LOGIN & REGISTER) - معدل لاستخدام الإيميل والتحقق
// ============================================================

const sellerLoginBtn = document.getElementById('sellerLoginBtn');
if (sellerLoginBtn) {
    sellerLoginBtn.addEventListener('click', async () => {
        // تم التعديل: الاعتماد على الإيميل
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        if(!email || !password) return alert("يرجى ملء الحقول");

        sellerLoginBtn.innerText = "جاري الدخول...";
        sellerLoginBtn.disabled = true;

        try {
            // تسجيل الدخول باستخدام Firebase Auth
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // التحقق من بيانات البائع في Firestore
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
        const phone = document.getElementById('regPhone').value; // يبقى الهاتف للتواصل
        const email = document.getElementById('regEmail').value; // تم إضافة الإيميل
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

            // 1. إنشاء الحساب في Authentication
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 2. حفظ البيانات في Firestore (باستخدام UID كمعرف)
            await setDoc(doc(db, "sellers", user.uid), {
                shopName: shopName,
                phone: phone,
                email: email,
                wilaya: wilaya,
                baladiya: baladiya,
                shopImage: compressedBase64,
                balance: 1500,
                isBlocked: false,
                isVerified: false, // غير مفعل حتى يراجعه الأدمن
                createdAt: serverTimestamp()
            });

            alert("✅ تم إرسال طلبك بنجاح!\nسيتم تفعيل حسابك من قبل الإدارة بعد مراجعة بياناتك.");

            // تنظيف الحقول
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
        // تم التعديل: استعادة كلمة السر بالإيميل
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
const btnAdminLogin = document.getElementById('btnAdminLogin');
if (btnAdminLogin) {
    btnAdminLogin.addEventListener('click', () => {
        if (document.getElementById('adminPass').value === "admin123") {
            document.getElementById('adminLoginScreen').classList.add('hidden');
            document.getElementById('adminDashboard').classList.remove('hidden');
            initAdminPanel();
        } else { alert("خطأ"); }
    });

    function initAdminPanel() {
        // مخزن البيانات المحلي (لأجل البحث السريع)
        let state = {
            pending: [],
            orders: [],
            sellers: [],
            requests: []
        };

        // ========================================================
        // دوال الرسم (Render Functions)
        // ========================================================
        
        // 1. رسم قائمة الانتظار
        const renderPending = (data) => {
            const list = document.getElementById('adminPendingList');
            if(!list) return;
            list.innerHTML = "";
            if (data.length === 0) { list.innerHTML = `<p class="text-center text-gray-500 text-xs py-4 border border-slate-700 border-dashed rounded-lg">لا توجد نتائج</p>`; return; }
            
            data.forEach(item => {
                const d = item.data;
                const img = d.shopImage || 'https://via.placeholder.com/100';
                list.innerHTML += `
                <div class="bg-slate-700 p-4 rounded-xl border border-slate-600 flex flex-col sm:flex-row gap-4 items-start sm:items-center animate-slide-up hover:border-slate-500 transition">
                  <img src="${img}" class="w-16 h-16 rounded-lg object-cover border border-slate-500 cursor-zoom-in" onclick="window.open(this.src)">
                  <div class="flex-1">
                    <h4 class="font-bold text-white text-base">${d.shopName}</h4>
                    <p class="text-xs text-gray-400 mb-0.5">📍 ${d.wilaya} - ${d.baladiya}</p>
                    <p class="text-xs text-blue-300 font-mono tracking-wider">📱 ${d.phone}</p>
                  </div>
                  <div class="flex flex-row sm:flex-col gap-2 w-full sm:w-auto">
                    <button onclick="adminApproveSeller('${item.id}')" class="flex-1 bg-green-600 hover:bg-green-500 text-white text-[10px] font-bold py-2 px-3 rounded shadow transition">✅ قبول</button>
                    <button onclick="adminRejectSeller('${item.id}')" class="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] font-bold py-2 px-3 rounded transition">❌ رفض</button>
                  </div>
                </div>`;
            });
        };

        // 2. رسم قائمة الطلبات
        const renderOrders = (data) => {
            const list = document.getElementById('adminOrdersList');
            if(!list) return;
            list.innerHTML = "";
            if (data.length === 0) { list.innerHTML = `<p class="text-center text-gray-500 text-xs py-4 border border-slate-700 border-dashed rounded-lg">لا توجد نتائج</p>`; return; }

            data.forEach(item => {
                const d = item.data;
                list.innerHTML += `
                <div class="bg-slate-700 p-3 rounded-xl border border-slate-600 mb-2 flex justify-between items-center hover:bg-slate-600/50 transition">
                    <div>
                        <p class="font-bold text-sm text-white">${d.partName}</p>
                        <div class="flex gap-2 mt-1">
                            <span class="text-[10px] text-gray-400 bg-slate-800 px-2 py-0.5 rounded">${d.carMake}</span>
                            <span class="text-[10px] text-blue-300 font-mono">${d.phoneNumber}</span>
                        </div>
                    </div>
                    <button onclick="adminDeleteDoc('orders','${item.id}')" class="text-red-300 hover:text-red-200 text-xs bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded border border-red-500/20 transition">حذف</button>
                </div>`;
            });
        };

        // 3. رسم قائمة التجار
        const renderSellers = (data) => {
            const list = document.getElementById('adminSellersList');
            if(!list) return;
            list.innerHTML = "";
            if (data.length === 0) { list.innerHTML = `<p class="text-center text-gray-500 text-xs py-4 border border-slate-700 border-dashed rounded-lg">لا توجد نتائج</p>`; return; }

            data.forEach(item => {
                const d = item.data;
                list.innerHTML += `
                <div class="bg-slate-700 p-3 rounded-xl border border-slate-600 mb-2 hover:border-slate-500 transition">
                    <div class="flex justify-between items-center mb-1">
                        <p class="font-bold text-white text-sm">${d.shopName}</p>
                        <span class="${d.isBlocked ? 'text-red-400 bg-red-400/10' : 'text-green-400 bg-green-400/10'} text-[10px] px-2 py-0.5 rounded border ${d.isBlocked ? 'border-red-400/20' : 'border-green-400/20'}">${d.isBlocked ? 'محظور' : 'نشط'}</span>
                    </div>
                    <p class="text-xs text-gray-400 font-mono mb-2 flex gap-2">
                        <span>📱 ${d.phone}</span>
                        <span>📍 ${d.wilaya || '--'}</span>
                        <span class="text-yellow-500">💰 ${d.balance} DA</span>
                    </p>
                    <div class="flex gap-2">
                        <button onclick="adminToggleBlock('${item.id}', ${d.isBlocked})" class="flex-1 bg-slate-600 hover:bg-slate-500 text-[10px] py-1.5 rounded text-gray-200 transition">حظر/فك</button>
                        <button onclick="adminAddBalance('${item.id}')" class="flex-1 bg-green-600 hover:bg-green-500 text-[10px] py-1.5 rounded text-white font-bold transition">+ رصيد</button>
                        <button onclick="adminDeleteSeller('${item.id}')" class="flex-1 bg-red-600/10 hover:bg-red-600/20 text-red-300 border border-red-500/20 text-[10px] py-1.5 rounded transition">مسح</button>
                    </div>
                </div>`;
            });
        };

        // 4. رسم طلبات الاسترجاع
        const renderRequests = (data) => {
            const list = document.getElementById('adminRequestsList');
            if(!list) return;
            list.innerHTML = "";
            if (data.length === 0) { list.innerHTML = `<p class="text-center text-gray-500 text-xs py-4">لا توجد طلبات</p>`; return; }
            
            data.forEach(item => {
                const d = item.data;
                list.innerHTML += `
                <div class="bg-slate-700 p-3 rounded border border-slate-600 mb-2 flex justify-between items-center">
                    <div>
                        <p class="text-white font-mono text-sm">${d.phone}</p>
                        <p class="text-[10px] text-gray-400">طلب استعادة</p>
                    </div>
                    <div class="flex gap-2 items-center">
                        <button onclick="adminRevealPass('${d.phone}')" class="text-blue-300 text-xs bg-blue-900/50 border border-blue-800 px-2 py-1 rounded hover:bg-blue-800 transition">👁️ كشف</button>
                        <button onclick="adminDeleteDoc('admin_requests', '${item.id}')" class="text-red-400 text-xs bg-slate-800 px-2 py-1 rounded hover:bg-red-900/50">تم</button>
                    </div>
                </div>`;
            });
        };

        // ========================================================
        // دالة البحث الشامل (Global Search Logic)
        // ========================================================
        const performGlobalSearch = () => {
            const searchEl = document.getElementById('globalAdminSearch');
            // إذا لم يكن عنصر البحث موجوداً، نعرض كل البيانات كما هي
            const term = searchEl ? searchEl.value.toLowerCase().trim() : "";

            // 1. فلترة الانتظار
            const filteredPending = state.pending.filter(i => 
                (i.data.shopName && i.data.shopName.toLowerCase().includes(term)) ||
                (i.data.phone && i.data.phone.includes(term)) ||
                (i.data.wilaya && i.data.wilaya.includes(term))
            );
            renderPending(filteredPending);

            // 2. فلترة الطلبات
            const filteredOrders = state.orders.filter(i => 
                (i.data.partName && i.data.partName.toLowerCase().includes(term)) ||
                (i.data.phoneNumber && i.data.phoneNumber.includes(term)) ||
                (i.data.carMake && i.data.carMake.toLowerCase().includes(term))
            );
            renderOrders(filteredOrders);

            // 3. فلترة التجار
            const filteredSellers = state.sellers.filter(i => 
                (i.data.shopName && i.data.shopName.toLowerCase().includes(term)) ||
                (i.data.phone && i.data.phone.includes(term)) ||
                (i.data.wilaya && i.data.wilaya.includes(term))
            );
            renderSellers(filteredSellers);

            // 4. فلترة طلبات الاسترجاع
            const filteredRequests = state.requests.filter(i => 
                (i.data.phone && i.data.phone.includes(term))
            );
            renderRequests(filteredRequests);
        };

        // ربط حدث الكتابة بدالة البحث
        const searchInput = document.getElementById('globalAdminSearch');
        if(searchInput) {
            searchInput.addEventListener('input', performGlobalSearch);
        }

        // ========================================================
        // جلب البيانات (Listeners)
        // ========================================================

        // أ) جلب الانتظار
        onSnapshot(query(collection(db, "sellers"), where("isVerified", "==", false)), (snap) => {
            const el = document.getElementById('statPending'); if(el) el.innerText = snap.size;
            state.pending = snap.docs.map(d => ({id: d.id, data: d.data()}));
            performGlobalSearch();
        });

        // ب) جلب الطلبات (تم التعديل: إخفاء المباع)
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
            const verifiedCount = snap.docs.filter(d => d.data().isVerified).length;
            const el = document.getElementById('statSellers'); if(el) el.innerText = verifiedCount;
            
            state.sellers = snap.docs
                .map(d => ({id: d.id, data: d.data()}))
                .filter(item => item.data.isVerified === true);
                
            performGlobalSearch();
        });

        // د) جلب طلبات الاسترجاع
        onSnapshot(collection(db, "admin_requests"), (snap) => {
            state.requests = snap.docs.map(d => ({id: d.id, data: d.data()}));
            performGlobalSearch();
        });
    }

    // --- دوال الأدمن المساعدة ---
    // (تنبيه: بما أننا نستخدم Authentication، فإن كشف كلمة المرور لم يعد ممكناً لأنها مشفرة)
    window.adminRevealPass = async (phone) => {
        alert("تنبيه: النظام يعمل الآن بنظام المصادقة الآمنة.\nكلمات المرور مشفرة ولا يمكن كشفها.\nيرجى استخدام زر استعادة كلمة السر في صفحة الدخول.");
    };

    window.adminDeleteDoc = async (c, i) => { if(confirm("حذف الطلب؟")) await deleteDoc(doc(db, c, i)); };
    window.adminToggleBlock = async (id, status) => { await updateDoc(doc(db, "sellers", id), { isBlocked: !status }); };
    window.adminAddBalance = async (id) => { const a = prompt("المبلغ:"); if(a) await updateDoc(doc(db, "sellers", id), { balance: increment(parseInt(a)) }); };
    
    window.adminDeleteSeller = async (id) => {
        if (!confirm("هل أنت متأكد من حذف هذا الحساب؟")) return;
        try {
            const q = query(collection(db, "offers"), where("sellerId", "==", id));
            const querySnapshot = await getDocs(q);
            const batch = writeBatch(db);
            querySnapshot.forEach((doc) => { batch.delete(doc.ref); });
            batch.delete(doc(db, "sellers", id));
            await batch.commit();
            alert("تم الحذف بنجاح");
        } catch (error) { console.error(error); alert("خطأ: " + error.message); }
    };

    window.adminApproveSeller = async (id) => {
        if(!confirm("تفعيل هذا البائع؟")) return;
        await updateDoc(doc(db, "sellers", id), { isVerified: true });
        alert("تم التفعيل");
    };

    window.adminRejectSeller = async (id) => {
        if(!confirm("حذف هذا الطلب؟")) return;
        await deleteDoc(doc(db, "sellers", id));
        alert("تم الحذف");
    };
}