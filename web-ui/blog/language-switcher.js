(function() {
  // Chỉ chạy nếu chúng ta đang ở trong khu vực Blog
  const path = window.location.pathname;
  if (!path.includes('/blog')) return;

  const userLang = localStorage.getItem('kgen_blog_lang');
  const isEn = path.includes('/en/blog');
  
  // Xác định đường dẫn hoán đổi
  let targetPath = '';
  if (isEn) {
    targetPath = path.replace('/en/blog', '/blog');
  } else {
    // Xử lý cẩn thận nếu root là domain.com/blog vs domain.com/blog/
    let base = path;
    if (base.startsWith('/blog')) {
      targetPath = '/en' + base;
    } else {
      targetPath = base.replace(/\/blog/, '/en/blog');
    }
  }

  // 1. Nếu người dùng đã tự chuyển ngôn ngữ (Có cờ LocalStorage)
  if (userLang) {
    if (userLang === 'en' && !isEn) {
       window.location.replace(targetPath);
    } else if (userLang === 'vi' && isEn) {
       window.location.replace(targetPath);
    }
    return; // Đã xử lý xong
  }

  // 2. Chặn vòng lặp và gọi API Check IP Quốc Gia
  fetch('https://get.geojs.io/v1/ip/country.json')
    .then(r => r.json())
    .then(data => {
       const isVN = data.country === 'VN';
       if (!isVN && !isEn) {
          // Là khách ngoại quốc truy cập link VN -> chuyển EN
          localStorage.setItem('kgen_blog_lang', 'en');
          window.location.replace(targetPath);
       } else if (isVN && isEn) {
          // Là khách VN truy cập link EN -> chuyển VI
          localStorage.setItem('kgen_blog_lang', 'vi');
          window.location.replace(targetPath);
       } else {
          // Lưu lại để lần sau không gọi API nữa
          localStorage.setItem('kgen_blog_lang', isVN ? 'vi' : 'en');
       }
    })
    .catch(e => console.error('Geo detect failed', e));

  // --- Cài đặt cơ chế nút Switch Language ---
  // Chờ DOM load xong để bắt sự kiện cho nút Toggle (nếu có)
  document.addEventListener('DOMContentLoaded', () => {
    const langBtn = document.getElementById('lang-switch-btn');
    if (langBtn) {
      langBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const newLang = isEn ? 'vi' : 'en';
        localStorage.setItem('kgen_blog_lang', newLang);
        window.location.href = targetPath;
      });
    }
  });
})();
