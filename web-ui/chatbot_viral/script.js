const products = [
    {
        id: 1,
        title: "Chatbot Tạo Video Viral (Gemini Pro X KGen)",
        desc: "Chatbot chuyên gia hệ thống hóa quy trình sáng tạo Video/Carousel Viral trên nền tảng Gemini Advanced.",
        price: "250.000đ",
        priceNum: 250000,
        sales: 42,
        image: "/viral_content_avatar.png",
        tags: ["Premium", "Mới"],
        category: "Chatbot AI",
        version: "v2.0",
        geminiUrl: "https://gemini.google.com/gem/1n1D5rcnxr6HtDyItLXQgyW-4RgMThjEQ?usp=sharing",
        sku: "gem_chatbot",
        features: [
            { icon: "🚀", title: "Phân tích Hook chuẩn tâm lý", desc: "Áp dụng các công thức Hook 3 giây đầu mạnh mẽ nhất để níu chân người xem." },
            { icon: "✍️", title: "Kịch bản phân cảnh chi tiết", desc: "Viết chi tiết từng khung hình (mô tả hình ảnh, text trên màn hình, giọng đọc)." },
            { icon: "⚡", title: "Tối ưu cho AI Video & Carousel", desc: "Prompt được thiết kế tối ưu hóa tạo ảnh Midjourney/KGen để dựng video." },
            { icon: "🔒", title: "Sở hữu vĩnh viễn", desc: "Kích hoạt một lần, sử dụng vĩnh viễn trên tài khoản Google Gemini cá nhân." }
        ]
    },
    {
        id: 2,
        title: "Kể chuyện doanh nhân tỉ phú bán sách",
        desc: "Bản nâng cấp của dạng video người que kể chuyện. Tích hợp sẵn lối kể chuyện cuốn hút.",
        price: "250.000đ",
        priceNum: 250000,
        sales: 12,
        image: "https://images.unsplash.com/photo-1542626991-cbc4e32524cc?q=80&w=600&auto=format&fit=crop",
        tags: ["Premium", "Mới"],
        category: "Chatbot AI",
        version: "v1.0",
        sku: "ceobook_bot",
        geminiUrl: "https://gemini.google.com/gem/example_ceo",
        features: [
            { icon: "📚", title: "Phong cách Shark Tank", desc: "Giọng văn kể chuyện thành công, chia sẻ góc nhìn sâu sắc của doanh nhân tỷ phú." },
            { icon: "📈", title: "Tối ưu Affiliate Sách", desc: "Tích hợp khéo léo lời khuyên mua sách vào câu chuyện giúp tăng thu nhập Affiliate." }
        ]
    },
    {
        id: 3,
        title: "Chatbot tạo video KOC bán hàng mỹ phẩm",
        desc: "Chatbot tạo video review mỹ phẩm chân thật, thống nhất nhân vật giúp tăng tỷ lệ chuyển đổi.",
        price: "190.000đ",
        priceNum: 190000,
        sales: 8,
        image: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?q=80&w=600&auto=format&fit=crop",
        tags: ["Premium", "Mới"],
        category: "Chatbot AI",
        version: "v1.0",
        sku: "koc_makeup",
        geminiUrl: "https://gemini.google.com/gem/example_makeup",
        features: [
            { icon: "💄", title: "Format Review Trendy", desc: "Kịch bản dạng đập hộp, test sản phẩm chân thật trên da." }
        ]
    },
    {
        id: 4,
        title: "Chatbot tạo video đội quân chữa lành cơ thể",
        desc: "Chatbot tạo video Hoạt Hình 3D cơ chế chữa lành của cơ thể Phù hợp với kênh muốn xây dựng nội dung sức khỏe.",
        price: "179.000đ",
        priceNum: 179000,
        sales: 4,
        image: "https://images.unsplash.com/photo-1532187863486-abf9db0c2018?q=80&w=600&auto=format&fit=crop",
        tags: ["Premium"],
        category: "Chatbot AI",
        version: "v1.0",
        sku: "health_3d",
        geminiUrl: "https://gemini.google.com/gem/example_health",
        features: [
            { icon: "🧬", title: "Sinh học 3D hóa", desc: "Nhân cách hóa hồng cầu, bạch cầu thành các chiến binh ngộ nghĩnh." }
        ]
    },
    {
        id: 5,
        title: "Chatbot tạo video nông nghiệp",
        desc: "Chatbot tạo video Hoạt Hình 3D chủ đề nông nghiệp. Phù hợp cho bà con làm marketing.",
        price: "189.000đ",
        priceNum: 189000,
        sales: 3,
        image: "https://images.unsplash.com/photo-1586771107445-d3af11116fd1?q=80&w=600&auto=format&fit=crop",
        tags: ["Premium"],
        category: "Chatbot AI",
        version: "v1.0",
        sku: "agri_bot",
        geminiUrl: "https://gemini.google.com/gem/example_agri"
    },
    {
        id: 6,
        title: "Chatbot người que làm video AFF sách",
        desc: "Chat bot này giúp người dùng tạo ra video dạng người que kể truyện với hình ảnh minh họa chân thực.",
        price: "250.000đ",
        priceNum: 250000,
        sales: 12,
        image: "https://images.unsplash.com/photo-1456324504439-367cee3b3c32?q=80&w=600&auto=format&fit=crop",
        tags: ["Premium"],
        category: "Chatbot AI",
        version: "v1.0",
        sku: "stickman_book",
        geminiUrl: "https://gemini.google.com/gem/example_stickman"
    },
    {
        id: 7,
        title: "Chatbot tạo video pov côn trùng",
        desc: "Chatbot tạo video pov côn trùng - thích hợp để xây kênh youtube shorts kiếm views.",
        price: "299.000đ",
        priceNum: 299000,
        sales: 3,
        image: "https://images.unsplash.com/photo-1580658327339-b9d9eb2ac219?q=80&w=600&auto=format&fit=crop",
        tags: ["Premium"],
        category: "Chatbot AI",
        version: "v1.0",
        sku: "insect_pov",
        geminiUrl: "https://gemini.google.com/gem/example_insect"
    },
    {
        id: 8,
        title: "Chatbot chủ đề video sức khỏe hài hước",
        desc: "Từ 1 bức ảnh gốc, tạo ra video nhân vật hài hước. Dành cho các kênh review vui nhộn.",
        price: "159.000đ",
        priceNum: 159000,
        sales: 22,
        image: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=600&auto=format&fit=crop",
        tags: ["Premium"],
        category: "Chatbot AI",
        version: "v1.0",
        sku: "comedy_health",
        geminiUrl: "https://gemini.google.com/gem/example_comedy"
    },
    {
        id: 9,
        title: "Chatbot Trợ lý Viết Blog Tự Động SEO",
        desc: "Chuyên gia Content Master, tự động hóa quy trình viết bài Blog WordPress chuẩn SEO 100 điểm RankMath.",
        price: "199.000đ",
        priceNum: 199000,
        sales: 45,
        image: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?q=80&w=600&auto=format&fit=crop",
        tags: ["Premium", "HOT"],
        category: "Chatbot AI",
        version: "v2.5",
        sku: "seo_blogger",
        geminiUrl: "https://gemini.google.com/gem/example_seo",
        features: [
            { icon: "🔎", title: "Tự động chèn từ khóa", desc: "Nghiên cứu LSI keywords và rải đều vào H2, H3 tự nhiên nhất." },
            { icon: "📝", title: "Giọng văn chuyên gia", desc: "Không giống AI viết, có cấu trúc so sánh, bảng đánh giá (table) và FAQ." }
        ]
    }
];

function renderProducts() {
    const grid = document.getElementById('productGrid');
    let html = '';

    products.forEach(product => {
        // Generate tags HTML
        let tagsHtml = '';
        if (product.tags.includes('Premium')) {
            tagsHtml += `<span class="badge badge-premium"><i class="fa-solid fa-crown"></i> Premium</span>`;
        }
        if (product.tags.includes('Mới')) {
            tagsHtml += `<span class="badge badge-new"><i class="fa-solid fa-sparkles"></i> Mới</span>`;
        }

        html += `
            <div class="product-card" onclick="openProductModal(${product.id})">
                <div class="product-image-container">
                    <img src="${product.image}" alt="${product.title}" class="product-image">
                    <div class="badges-top">
                        ${tagsHtml}
                    </div>
                    <div class="badge-top-right">
                        <i class="fa-regular fa-comment-dots"></i> ${product.category}
                    </div>
                    <span class="version-badge"><i class="fa-solid fa-code-branch"></i> ${product.version}</span>
                    <button class="btn-bookmark" onclick="event.stopPropagation()"><i class="fa-solid fa-bookmark"></i></button>
                </div>
                <div class="product-info">
                    <h3 class="product-title" style="color:white;">${product.title}</h3>
                    <p class="product-desc">${product.desc}</p>
                    <div class="product-footer">
                        <span class="sales-count">${product.sales} đã bán</span>
                        <span class="product-price">${product.price}</span>
                    </div>
                </div>
            </div>
        `;
    });

    grid.innerHTML = html;
}

// Global modal and purchase logic
function openProductModal(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;
    
    // Check if purchased locally
    const sku = product.sku;
    const isUnlocked = localStorage.getItem('unlocked_' + sku) === 'true';

    // Generate Features HTML
    let featuresHtml = '';
    if (product.features && product.features.length > 0) {
        featuresHtml = '<div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:20px;">' + 
            product.features.map(f => `
                <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05); padding:16px; border-radius:12px;">
                    <div style="font-size:1.2rem; margin-bottom:8px;">${f.icon} <span style="font-weight:600; font-size:1rem; color:#e5e7eb;">${f.title}</span></div>
                    <p style="color:#94a3b8; font-size:0.85rem; margin:0; line-height:1.4;">${f.desc}</p>
                </div>
            `).join('') + '</div>';
    }

    const overlay = document.createElement('div');
    overlay.id = 'product-modal-overlay';
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:1000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(8px); background-color:rgba(0,0,0,0.8); padding: 20px; overflow-y:auto;';
    
    overlay.innerHTML = `
        <div style="position:relative; max-width:900px; width:100%; border-radius:24px; background:var(--bg-main, #09090b); border:1px solid rgba(255,255,255,0.08); box-shadow:0 32px 64px rgba(0,0,0,0.5); padding:32px; display:flex; gap:32px; flex-wrap:wrap;">
            <button onclick="this.parentElement.parentElement.remove()" style="position:absolute; top:20px; right:20px; background:rgba(255,255,255,0.1); border:none; color:white; width:36px; height:36px; border-radius:50%; cursor:pointer; font-size:18px;">&times;</button>
            
            <div style="flex:1; min-width:300px;">
                <img src="${product.image}" style="width:100%; border-radius:16px; border:1px solid rgba(255,255,255,0.1); box-shadow:0 20px 40px rgba(0,0,0,0.3);">
            </div>
            <div style="flex:1.5; min-width:300px; display:flex; flex-direction:column;">
                <h2 style="color:white; font-size:1.8rem; margin-bottom:12px;">${product.title}</h2>
                <div style="color:var(--accent-blue, #ff4747); font-size:1.6rem; font-weight:700; margin-bottom:16px;">${product.price}</div>
                <p style="color:var(--text-secondary, #a1a1aa); font-size:1rem; line-height:1.6; margin-bottom:24px;">${product.desc}</p>
                
                ${featuresHtml}
                
                <div style="margin-top:auto; padding-top:24px;">
                    ${isUnlocked ? `
                        <div style="background:rgba(16,185,129,0.1); border:1px dashed rgba(16,185,129,0.3); border-radius:16px; padding:20px; text-align:center;">
                            <h4 style="color:white; margin-bottom:12px;">✅ Đã mở khóa: Link truy cập Chatbot</h4>
                            <div style="background:#18181b; color:#10b981; padding:12px; border-radius:8px; font-family:monospace; margin-bottom:12px; word-break:break-all;">${product.geminiUrl}</div>
                            <button onclick="navigator.clipboard.writeText('${product.geminiUrl}'); alert('Đã Copy!')" style="background:#10b981; color:white; border:none; padding:10px 24px; border-radius:8px; font-weight:600; cursor:pointer;">Copy Link</button>
                        </div>
                    ` : `
                        <button onclick="initiatePurchase(${product.id})" style="width:100%; background:linear-gradient(135deg, var(--accent-blue, #ff4747) 0%, #ff2a2a 100%); color:white; border:none; padding:16px; border-radius:12px; font-size:1.1rem; font-weight:700; cursor:pointer; box-shadow:0 8px 16px rgba(255,71,71,0.25);">
                            Mua ngay - Kích hoạt tự động
                        </button>
                    `}
                </div>
            </div>
        </div>
    `;
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if(e.target === overlay) overlay.remove();
    });
    
    document.body.appendChild(overlay);
}

function initiatePurchase(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;

    // Remove the product modal to show QR
    document.getElementById('product-modal-overlay').remove();

    // Re-use standard site configuration if APP_STATE isn't present
    const priceVnd = product.priceNum;
    const tier = product.sku;
    const bankId = 'TPB';
    const accountNo = '00002035456';
    const accountName = 'TRAN DANG QUOC HOA';
    const webhookBase = 'https://n8n-1adi.srv1465145.hstgr.cloud';
    
    let userEmail = 'guest_user';
    try {
        if (window.APP_STATE && window.APP_STATE.currentUser) {
            userEmail = window.APP_STATE.currentUser.email;
        } else {
            const storedUser = localStorage.getItem('kgen_session');
            if (storedUser) userEmail = JSON.parse(storedUser).email;
        }
    } catch(e){}

    const rndCode = Math.floor(Math.random() * 90000) + 10000;
    const orderCode = `KGEN BOT ${rndCode}`;
    const qrUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${priceVnd}&addInfo=${encodeURIComponent(orderCode)}&accountName=${encodeURIComponent(accountName)}`;

    // Save order locally
    const orders = JSON.parse(localStorage.getItem('kgen_orders') || '[]');
    orders.push({ user: userEmail, orderCode, tier, amount: priceVnd, date: new Date().toISOString(), status: 'pending' });
    localStorage.setItem('kgen_orders', JSON.stringify(orders));

    // Create QR Modal
    const overlay = document.createElement('div');
    overlay.id = 'qr-modal-overlay';
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:10000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(16px); background-color:rgba(0,0,0,0.85); overflow-y:auto; padding:20px;';
    
    overlay.innerHTML = `
        <div style="position:relative; max-width:440px; width:100%; border-radius:24px; background:linear-gradient(180deg, #18181b 0%, #09090b 100%); border:1px solid rgba(255,255,255,0.08); box-shadow:0 32px 64px rgba(0,0,0,0.5); padding:32px;">
            <button onclick="this.parentElement.parentElement.remove()" style="position:absolute; top:16px; right:16px; background:rgba(255,255,255,0.1); border:none; color:white; width:32px; height:32px; border-radius:50%; cursor:pointer;">&times;</button>
            <div style="text-align:center;">
                <h2 style="font-size:1.4rem; margin-bottom:8px; color:#fff;">Thanh toán: <span style="color:var(--accent-blue, #ff4747);">${product.title.substr(0, 15)}...</span></h2>
                <p style="color:#a1a1aa; font-size:0.95rem;">Quét mã thanh toán để mở khóa tự động</p>
            </div>
            <div style="background:white; padding:20px; border-radius:20px; margin:24px 0;">
                <img src="${qrUrl}" style="width:100%; border-radius:8px;">
                <div style="text-align:center; color:black; font-weight:800; font-size:1.4rem; margin-top:16px;">
                    ${priceVnd.toLocaleString('vi')}đ
                </div>
            </div>
            <div style="background:rgba(255,255,255,0.05); padding:16px; border-radius:12px; margin-bottom:20px;">
                <div style="font-size:0.8rem; color:#a1a1aa; margin-bottom:4px;">Nội dung chuyển khoản (bắt buộc)</div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong style="color:var(--accent-blue, #ff4747); font-size:1.1rem;">${orderCode}</strong>
                    <button onclick="navigator.clipboard.writeText('${orderCode}'); alert('Đã sao chép')" style="background:var(--accent-blue, #ff4747); color:white; border:none; padding:6px 16px; border-radius:6px; cursor:pointer;">Copy</button>
                </div>
            </div>
            <div id="polling-status" style="text-align:center; color:var(--text-secondary, #a1a1aa); font-weight:600; font-size:0.9rem;">
                🔄 Hệ thống đang chờ thanh toán...
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    // Polling logic
    const poller = setInterval(async () => {
        if (!document.getElementById('qr-modal-overlay')) {
            clearInterval(poller);
            return;
        }

        const currentStored = JSON.parse(localStorage.getItem('kgen_orders') || '[]');
        const currentOrder = currentStored.find(o => o.orderCode === orderCode);

        try {
            const resp = await fetch(`${webhookBase}/webhook/check-payment?code=${encodeURIComponent(orderCode)}`);
            if (resp.ok) {
                const data = await resp.json();
                if (data.status === 'paid') {
                    if (currentOrder) currentOrder.status = 'paid';
                    localStorage.setItem('kgen_orders', JSON.stringify(currentStored));
                }
            }
        } catch (e) {}

        if (currentOrder && currentOrder.status === 'paid') {
            clearInterval(poller);
            document.getElementById('polling-status').textContent = '✅ Thanh toán thành công!';
            document.getElementById('polling-status').style.color = '#10b981';
            
            // Mark as unlocked
            localStorage.setItem('unlocked_' + tier, 'true');
            
            setTimeout(() => {
                document.getElementById('qr-modal-overlay').remove();
                alert('Mua hàng thành công! Đã mở khóa đường dẫn Chatbot.');
                // Reopen the modal which will now show the unlocked state
                openProductModal(id);
            }, 1000);
        }
    }, 5000);
}

// Initial render
document.addEventListener('DOMContentLoaded', renderProducts);
