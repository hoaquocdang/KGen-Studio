const products = [
    {
        id: 1,
        title: "Người mẫu thay đồ review thời trang",
        desc: "tạo video người mẫu và trang phục mà bạn cung cấp để review chân thực",
        price: "200.000đ",
        sales: 2,
        image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=600&auto=format&fit=crop",
        tags: ["Premium", "Mới"],
        category: "Chatbot AI",
        version: "v1.0"
    },
    {
        id: 2,
        title: "Kể chuyện doanh nhân tỉ phú bán sách",
        desc: "Bản nâng cấp của dạng video người que kể chuyện. Tích hợp sẵn lối kể chuyện cuốn hút.",
        price: "250.000đ",
        sales: 1,
        image: "https://images.unsplash.com/photo-1542626991-cbc4e32524cc?q=80&w=600&auto=format&fit=crop",
        tags: ["Premium", "Mới"],
        category: "Chatbot AI",
        version: "v1.0"
    },
    {
        id: 3,
        title: "Chatbot tạo video KOC bán hàng mỹ phẩm",
        desc: "Chatbot tạo video review mỹ phẩm chân thật, thống nhất nhân vật giúp tăng tỷ lệ chuyển đổi.",
        price: "190.000đ",
        sales: 1,
        image: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?q=80&w=600&auto=format&fit=crop",
        tags: ["Premium", "Mới"],
        category: "Chatbot AI",
        version: "v1.0"
    },
    {
        id: 4,
        title: "Chatbot tạo video đội quân chữa lành cơ thể",
        desc: "Chatbot tạo video Hoạt Hình 3D cơ chế chữa lành của cơ thể Phù hợp với kênh muốn xây dựng nội dung sức khỏe.",
        price: "179.000đ",
        sales: 4,
        image: "https://images.unsplash.com/photo-1532187863486-abf9db0c2018?q=80&w=600&auto=format&fit=crop",
        tags: ["Premium"],
        category: "Chatbot AI",
        version: "v1.0"
    },
    {
        id: 5,
        title: "Chatbot tạo video nông nghiệp",
        desc: "Chatbot tạo video Hoạt Hình 3D chủ đề nông nghiệp. Phù hợp cho bà con làm marketing.",
        price: "189.000đ",
        sales: 3,
        image: "https://images.unsplash.com/photo-1586771107445-d3af11116fd1?q=80&w=600&auto=format&fit=crop",
        tags: ["Premium"],
        category: "Chatbot AI",
        version: "v1.0"
    },
    {
        id: 6,
        title: "Chatbot người que kể chuyện làm video AFF sách",
        desc: "Chat bot này giúp người dùng tạo ra video dạng người que kể truyện với hình ảnh minh họa chân thực.",
        price: "250.000đ",
        sales: 12,
        image: "https://images.unsplash.com/photo-1456324504439-367cee3b3c32?q=80&w=600&auto=format&fit=crop",
        tags: ["Premium"],
        category: "Chatbot AI",
        version: "v1.0"
    },
    {
        id: 7,
        title: "Chatbot tạo video pov côn trùng",
        desc: "Chatbot tạo video pov côn trùng - thích hợp để xây kênh youtube shorts kiếm views.",
        price: "299.000đ",
        sales: 3,
        image: "https://images.unsplash.com/photo-1580658327339-b9d9eb2ac219?q=80&w=600&auto=format&fit=crop",
        tags: ["Premium"],
        category: "Chatbot AI",
        version: "v1.0"
    },
    {
        id: 8,
        title: "Chatbot chủ đề video sức khỏe hài hước",
        desc: "Từ 1 bức ảnh gốc, tạo ra video nhân vật hài hước. Dành cho các kênh review vui nhộn.",
        price: "159.000đ",
        sales: 22,
        image: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=600&auto=format&fit=crop",
        tags: ["Premium"],
        category: "Chatbot AI",
        version: "v1.0"
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
            <div class="product-card">
                <div class="product-image-container">
                    <img src="${product.image}" alt="${product.title}" class="product-image">
                    <div class="badges-top">
                        ${tagsHtml}
                    </div>
                    <div class="badge-top-right">
                        <i class="fa-regular fa-comment-dots"></i> ${product.category}
                    </div>
                    <span class="version-badge"><i class="fa-solid fa-code-branch"></i> ${product.version}</span>
                    <button class="btn-bookmark"><i class="fa-solid fa-bookmark"></i></button>
                </div>
                <div class="product-info">
                    <h3 class="product-title">${product.title}</h3>
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

// Initial render
document.addEventListener('DOMContentLoaded', renderProducts);
