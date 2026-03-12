// ============================================================
// KGen Gallery — Internationalization (i18n)
// Supported: en, vi, ja, es, hi
// ============================================================

const SUPPORTED_LANGS = [
    { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'ja', name: '日本語', flag: '🇯🇵' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
];

const TRANSLATIONS = {
    // ===== SIDEBAR =====
    'nav.home': { vi: 'Trang chủ', en: 'Home', ja: 'ホーム', es: 'Inicio', hi: 'होम' },
    'nav.search': { vi: 'Tìm kiếm', en: 'Search', ja: '検索', es: 'Buscar', hi: 'खोज' },
    'nav.history': { vi: 'Lịch sử', en: 'History', ja: '履歴', es: 'Historial', hi: 'इतिहास' },
    'nav.enhance': { vi: 'Nâng cấp Prompt', en: 'Upgrade Prompt', ja: 'プロンプト強化', es: 'Mejorar Prompt', hi: 'प्रॉम्प्ट अपग्रेड' },
    'nav.collection': { vi: 'Bộ sưu tập', en: 'My Collection', ja: 'コレクション', es: 'Mi Colección', hi: 'मेरा संग्रह' },
    'nav.recent': { vi: 'Cập nhật mới', en: 'Recent Updates', ja: '最新', es: 'Recientes', hi: 'हाल के' },
    'nav.aitools': { vi: 'Công cụ AI khác', en: 'Other AI Tools', ja: '他のAIツール', es: 'Otras Herramientas IA', hi: 'अन्य AI टूल' },
    'nav.carousel': { vi: 'Tạo Content Viral', en: 'Viral Content Creator', ja: 'バイラルコンテンツ制作', es: 'Creador de Contenido Viral', hi: 'वायरल कंटेंट क्रिएटर' },
    'nav.seo': { vi: 'Hệ sinh thái KGEN HUB', en: 'KGEN HUB Ecosystem', ja: 'KGEN HUB エコシステム', es: 'Ecosistema KGEN HUB', hi: 'KGEN HUB इकोसिस्टम' },
    'nav.docs': { vi: 'Tài liệu hướng dẫn', en: 'Documentation', ja: 'ドキュメント', es: 'Documentación', hi: 'दस्तावेज़' },
    'nav.categories': { vi: 'DANH MỤC', en: 'CATEGORIES', ja: 'カテゴリー', es: 'CATEGORÍAS', hi: 'श्रेणियाँ' },
    'nav.guide': { vi: 'HƯỚNG DẪN', en: 'GUIDE', ja: 'ガイド', es: 'GUÍA', hi: 'गाइड' },
    'nav.portfolio': { vi: 'Danh thiếp (Info)', en: 'Portfolio (Info)', ja: 'ポートフォリオ', es: 'Portafolio', hi: 'पोर्टफोलियो' },

    // ===== HOME TAB =====
    'home.title': { vi: 'AI Prompt', en: 'AI Prompt', ja: 'AIプロンプト', es: 'AI Prompt', hi: 'AI प्रॉम्प्ट' },
    'home.title2': { vi: 'Gallery', en: 'Gallery', ja: 'ギャラリー', es: 'Galería', hi: 'गैलरी' },
    'home.subtitle': { vi: 'Khám phá hàng ngàn prompt tạo ảnh chuyên nghiệp', en: 'Discover thousands of professional image prompts', ja: '何千ものプロフェッショナルな画像プロンプトを発見', es: 'Descubre miles de prompts profesionales', hi: 'हजारों पेशेवर इमेज प्रॉम्प्ट खोजें' },
    'home.search_placeholder': { vi: 'Tìm prompt theo từ khoá...', en: 'Search prompts by keyword...', ja: 'キーワードでプロンプトを検索...', es: 'Buscar prompts por palabra clave...', hi: 'कीवर्ड से प्रॉम्प्ट खोजें...' },
    'home.trending': { vi: '🔥 Trending', en: '🔥 Trending', ja: '🔥 トレンド', es: '🔥 Tendencias', hi: '🔥 ट्रेंडिंग' },
    'home.newest': { vi: '✨ Mới nhất', en: '✨ Newest', ja: '✨ 最新', es: '✨ Más nuevos', hi: '✨ नवीनतम' },
    'home.popular': { vi: '💎 Phổ biến', en: '💎 Popular', ja: '💎 人気', es: '💎 Popular', hi: '💎 लोकप्रिय' },

    // ===== GENERATE TAB =====
    'gen.title': { vi: 'Tạo ảnh', en: 'Generate', ja: '画像生成', es: 'Generar', hi: 'बनाएं' },
    'gen.title_accent': { vi: 'AI', en: 'AI', ja: 'AI', es: 'IA', hi: 'AI' },
    'gen.subtitle': { vi: 'Tạo ảnh từ prompt bằng AI', en: 'Create images from prompts with AI', ja: 'AIでプロンプトから画像を生成', es: 'Crea imágenes con IA', hi: 'AI से प्रॉम्प्ट से इमेज बनाएं' },
    'gen.prompt_label': { vi: 'Prompt của bạn', en: 'Your Prompt', ja: 'プロンプト', es: 'Tu Prompt', hi: 'आपका प्रॉम्प्ट' },
    'gen.prompt_placeholder': { vi: 'Mô tả hình ảnh bạn muốn tạo...', en: 'Describe the image you want to create...', ja: '作りたい画像を説明してください...', es: 'Describe la imagen que quieres crear...', hi: 'जो इमेज बनानी है उसका वर्णन करें...' },
    'gen.btn_generate': { vi: '✨ Tạo ảnh', en: '✨ Generate', ja: '✨ 生成', es: '✨ Generar', hi: '✨ बनाएं' },
    'gen.btn_enhance': { vi: '⬆ Nâng cấp prompt', en: '⬆ Enhance Prompt', ja: '⬆ プロンプト強化', es: '⬆ Mejorar Prompt', hi: '⬆ प्रॉम्प्ट सुधारें' },
    'gen.model': { vi: 'Model', en: 'Model', ja: 'モデル', es: 'Modelo', hi: 'मॉडल' },
    'gen.ratio': { vi: 'Tỷ lệ', en: 'Ratio', ja: '比率', es: 'Proporción', hi: 'अनुपात' },
    'gen.api_key': { vi: 'API Key', en: 'API Key', ja: 'APIキー', es: 'Clave API', hi: 'API कुंजी' },

    // ===== ENHANCE TAB =====
    'enhance.title': { vi: 'Nâng Cấp', en: 'Upgrade', ja: '強化', es: 'Mejorar', hi: 'अपग्रेड' },
    'enhance.title_accent': { vi: 'Prompt', en: 'Prompt', ja: 'プロンプト', es: 'Prompt', hi: 'प्रॉम्प्ट' },
    'enhance.subtitle': { vi: 'Biến ý tưởng đơn giản thành prompt chuyên nghiệp', en: 'Transform simple ideas into professional prompts', ja: 'シンプルなアイデアをプロのプロンプトに変換', es: 'Transforma ideas simples en prompts profesionales', hi: 'सरल विचारों को पेशेवर प्रॉम्प्ट में बदलें' },
    'enhance.input_label': { vi: 'Ý tưởng của bạn', en: 'Your idea', ja: 'あなたのアイデア', es: 'Tu idea', hi: 'आपका विचार' },
    'enhance.input_placeholder': { vi: 'VD: a cat in a garden, sunset portrait, product on marble table...', en: 'E.g.: a cat in a garden, sunset portrait, product on marble table...', ja: '例：庭の猫、夕日のポートレート、大理石のテーブルの製品...', es: 'Ej.: un gato en un jardín, retrato al atardecer...', hi: 'उदा.: बगीचे में बिल्ली, सूर्यास्त पोर्ट्रेट...' },
    'enhance.style_label': { vi: 'Phong cách', en: 'Style', ja: 'スタイル', es: 'Estilo', hi: 'शैली' },
    'enhance.mode_label': { vi: 'Chế độ sáng tạo', en: 'Creative Mode', ja: 'クリエイティブモード', es: 'Modo Creativo', hi: 'क्रिएटिव मोड' },
    'enhance.angle_label': { vi: 'Góc máy', en: 'Camera Angle', ja: 'カメラアングル', es: 'Ángulo de Cámara', hi: 'कैमरा एंगल' },
    'enhance.optional': { vi: '(tuỳ chọn)', en: '(optional)', ja: '（オプション）', es: '(opcional)', hi: '(वैकल्पिक)' },
    'enhance.btn': { vi: '✨ Nâng Cấp Prompt', en: '✨ Upgrade Prompt', ja: '✨ プロンプト強化', es: '✨ Mejorar Prompt', hi: '✨ प्रॉम्प्ट अपग्रेड' },
    'enhance.placeholder_text': { vi: 'Prompt nâng cấp sẽ hiển thị ở đây', en: 'Enhanced prompt will appear here', ja: '強化されたプロンプトがここに表示されます', es: 'El prompt mejorado aparecerá aquí', hi: 'अपग्रेड प्रॉम्प्ट यहाँ दिखेगा' },
    'enhance.use_btn': { vi: '🚀 Dùng prompt này để tạo ảnh', en: '🚀 Use this prompt to generate', ja: '🚀 このプロンプトで生成', es: '🚀 Usar este prompt para generar', hi: '🚀 इस प्रॉम्प्ट से बनाएं' },

    // Style options
    'style.realistic': { vi: 'Realistic', en: 'Realistic', ja: 'リアル', es: 'Realista', hi: 'रियलिस्टिक' },
    'style.anime': { vi: 'Anime', en: 'Anime', ja: 'アニメ', es: 'Anime', hi: 'एनीमे' },
    'style.illustration': { vi: 'Illustration', en: 'Illustration', ja: 'イラスト', es: 'Ilustración', hi: 'इलस्ट्रेशन' },

    // Mode options
    'mode.default': { vi: 'Mặc định', en: 'Default', ja: 'デフォルト', es: 'Predeterminado', hi: 'डिफ़ॉल्ट' },
    'mode.infographic': { vi: 'Infographic', en: 'Infographic', ja: 'インフォグラフィック', es: 'Infografía', hi: 'इन्फोग्राफिक' },
    'mode.removebg': { vi: 'Tách nền', en: 'Remove BG', ja: '背景除去', es: 'Quitar Fondo', hi: 'बैकग्राउंड हटाएं' },
    'mode.storyboard': { vi: 'Storyboard', en: 'Storyboard', ja: 'ストーリーボード', es: 'Guión Gráfico', hi: 'स्टोरीबोर्ड' },

    // Angle options
    'angle.auto': { vi: 'Tự động', en: 'Auto', ja: '自動', es: 'Auto', hi: 'ऑटो' },
    'angle.front': { vi: 'Chính diện', en: 'Front', ja: '正面', es: 'Frontal', hi: 'सामने' },
    'angle.wide': { vi: 'Toàn cảnh', en: 'Wide', ja: 'ワイド', es: 'Panorámica', hi: 'वाइड' },
    'angle.shoulder': { vi: 'Ngang vai', en: 'Over Shoulder', ja: '肩越し', es: 'Sobre Hombro', hi: 'कंधे से' },
    'angle.low': { vi: 'Dưới lên', en: 'Low Angle', ja: 'ローアングル', es: 'Contrapicado', hi: 'लो एंगल' },
    'angle.high': { vi: 'Trên xuống', en: 'High Angle', ja: 'ハイアングル', es: 'Picado', hi: 'हाई एंगल' },
    'angle.behind': { vi: 'Sau lưng', en: 'Behind', ja: '背後', es: 'Detrás', hi: 'पीछे से' },

    // ===== SEARCH TAB =====
    'search.title': { vi: 'Tìm kiếm', en: 'Search', ja: '検索', es: 'Buscar', hi: 'खोज' },
    'search.title_accent': { vi: 'Prompt', en: 'Prompts', ja: 'プロンプト', es: 'Prompts', hi: 'प्रॉम्प्ट' },
    'search.placeholder': { vi: 'Tìm theo từ khoá, phong cách, chủ đề...', en: 'Search by keyword, style, topic...', ja: 'キーワード、スタイル、トピックで検索...', es: 'Buscar por palabra clave, estilo, tema...', hi: 'कीवर्ड, स्टाइल, विषय से खोजें...' },

    // ===== HISTORY TAB =====
    'history.title': { vi: 'Lịch sử', en: 'History', ja: '履歴', es: 'Historial', hi: 'इतिहास' },
    'history.title_accent': { vi: 'tạo ảnh', en: 'Generation', ja: '生成', es: 'Generación', hi: 'जेनरेशन' },

    // ===== MODAL =====
    'modal.copy': { vi: '📋 Copy Prompt', en: '📋 Copy Prompt', ja: '📋 コピー', es: '📋 Copiar', hi: '📋 कॉपी' },
    'modal.generate': { vi: '🎨 Tạo ảnh từ prompt', en: '🎨 Generate from prompt', ja: '🎨 プロンプトから生成', es: '🎨 Generar desde prompt', hi: '🎨 प्रॉम्प्ट से बनाएं' },
    'modal.prompt_label': { vi: 'Prompt', en: 'Prompt', ja: 'プロンプト', es: 'Prompt', hi: 'प्रॉम्प्ट' },
    'modal.locked': { vi: '🔒 Nội dung dành cho thành viên Pro', en: '🔒 Pro members only', ja: '🔒 Proメンバー限定', es: '🔒 Solo miembros Pro', hi: '🔒 केवल Pro सदस्य' },

    // ===== PRICING =====
    'pricing.title': { vi: 'Nâng cấp tài khoản', en: 'Upgrade Account', ja: 'アカウントアップグレード', es: 'Mejorar Cuenta', hi: 'अकाउंट अपग्रेड' },
    'pricing.footer': { vi: '🔒 Hệ thống Thanh Toán Tự Động KGen', en: '🔒 KGen Auto Payment System', ja: '🔒 KGen 自動決済システム', es: '🔒 Sistema de Pago Automático KGen', hi: '🔒 KGen ऑटो पेमेंट सिस्टम' },
    'pricing.footer_sub': { vi: 'Mở khóa tự động 24/7. Không cam kết.', en: 'Auto unlock 24/7. No commitment.', ja: '24時間自動ロック解除。契約縛りなし。', es: 'Desbloqueo automático 24/7. Sin compromiso.', hi: 'ऑटो अनलॉक 24/7. कोई प्रतिबद्धता नहीं।' },

    // ===== COMMON =====
    'common.copy': { vi: 'Copy', en: 'Copy', ja: 'コピー', es: 'Copiar', hi: 'कॉपी' },
    'common.close': { vi: 'Đóng', en: 'Close', ja: '閉じる', es: 'Cerrar', hi: 'बंद' },
    'common.save': { vi: 'Lưu', en: 'Save', ja: '保存', es: 'Guardar', hi: 'सेव' },
    'common.cancel': { vi: 'Huỷ', en: 'Cancel', ja: 'キャンセル', es: 'Cancelar', hi: 'रद्द' },
    'common.loading': { vi: 'Đang tải...', en: 'Loading...', ja: '読み込み中...', es: 'Cargando...', hi: 'लोड हो रहा है...' },
    'common.login': { vi: 'Đăng nhập', en: 'Sign In', ja: 'ログイン', es: 'Iniciar Sesión', hi: 'साइन इन' },
    'common.signup': { vi: 'Đăng ký', en: 'Sign Up', ja: '登録', es: 'Registrarse', hi: 'साइन अप' },
    'common.upgrade': { vi: 'Nâng cấp Pro', en: 'Upgrade Pro', ja: 'Proにアップグレード', es: 'Mejorar a Pro', hi: 'Pro अपग्रेड' },
    'common.language': { vi: 'Ngôn ngữ', en: 'Language', ja: '言語', es: 'Idioma', hi: 'भाषा' },

    // ===== TOASTS =====
    'toast.copied': { vi: '📋 Đã copy prompt!', en: '📋 Prompt copied!', ja: '📋 コピーしました！', es: '📋 ¡Prompt copiado!', hi: '📋 प्रॉम्प्ट कॉपी हुआ!' },
    'toast.enhanced': { vi: '✨ Prompt đã được nâng cấp!', en: '✨ Prompt enhanced!', ja: '✨ プロンプトが強化されました！', es: '✨ ¡Prompt mejorado!', hi: '✨ प्रॉम्प्ट अपग्रेड हुआ!' },
    'toast.generating': { vi: '⏳ Đang tạo ảnh...', en: '⏳ Generating image...', ja: '⏳ 画像生成中...', es: '⏳ Generando imagen...', hi: '⏳ इमेज बन रही है...' },
    'toast.error_input': { vi: 'Vui lòng nhập ý tưởng', en: 'Please enter an idea', ja: 'アイデアを入力してください', es: 'Por favor ingresa una idea', hi: 'कृपया एक विचार दर्ज करें' },

    // ===== LEGAL MODALS =====
    'legal.terms.title': { vi: 'Điều khoản Dịch vụ', en: 'Terms of Service', ja: '利用規約', es: 'Términos de Servicio', hi: 'सेवा की शर्तें' },
    'legal.terms.p1': { vi: 'Bằng việc truy cập và sử dụng trang web này, bạn đồng ý tuân thủ các điều khoản và điều kiện sau.', en: 'By accessing and using this website, you agree to comply with the following terms and conditions.' },
    'legal.terms.p2': { vi: 'Dịch vụ này cung cấp các công cụ và tiện ích kỹ thuật số tích hợp AI để tạo và phân tích nội dung. Người dùng phải sử dụng dịch vụ tuân thủ các luật hiện hành và không được lạm dụng, trục lợi hoặc cố gắng phá hoại nền tảng.', en: 'This service provides AI-powered tools and digital utilities for content generation and analysis. Users must use the service in compliance with applicable laws and must not misuse, exploit, or attempt to disrupt the platform.' },
    'legal.terms.p3': { vi: 'Chúng tôi có quyền sửa đổi, đình chỉ hoặc ngừng bất kỳ phần nào của dịch vụ vào bất kỳ lúc nào mà không cần thông báo trước.', en: 'We reserve the right to modify, suspend, or discontinue any part of the service at any time without prior notice.' },
    'legal.terms.p4': { vi: 'Người dùng chịu trách nhiệm về nội dung họ tạo ra hoặc tải lên trong quá trình sử dụng nền tảng.', en: 'Users are responsible for the content they generate or upload while using the platform.' },
    'legal.terms.p5': { vi: 'Bằng việc tiếp tục sử dụng trang web này, bạn đồng ý với các điều khoản trên.', en: 'By continuing to use this website, you agree to these terms.' },

    'legal.privacy.title': { vi: 'Chính sách Bảo mật', en: 'Privacy Policy', ja: 'プライバシーポリシー', es: 'Política de Privacidad', hi: 'गोपनीयता नीति' },
    'legal.privacy.p1': { vi: 'Chúng tôi tôn trọng quyền riêng tư của bạn và cam kết bảo vệ thông tin cá nhân của bạn.', en: 'We respect your privacy and are committed to protecting your personal information.' },
    'legal.privacy.p2': { vi: 'Trang web này có thể thu thập dữ liệu giới hạn như địa chỉ email, số liệu thống kê sử dụng và thông tin kỹ thuật để cải thiện hiệu suất dịch vụ.', en: 'This website may collect limited data such as email addresses, usage statistics, and technical information to improve service performance.' },
    'legal.privacy.p3': { vi: 'Chúng tôi không bán hoặc chia sẻ dữ liệu cá nhân của bạn với bên thứ ba trừ khi luật pháp yêu cầu hoặc cần thiết để vận hành dịch vụ.', en: 'We do not sell or share your personal data with third parties except when required by law or necessary to operate the service.' },
    'legal.privacy.p4': { vi: 'Tất cả dữ liệu được thu thập được xử lý an toàn và chỉ được sử dụng để duy trì và cải thiện nền tảng.', en: 'All collected data is handled securely and used solely to maintain and improve the platform.' },
    'legal.privacy.p5': { vi: 'Bằng việc sử dụng trang web này, bạn đồng ý với chính sách bảo mật này.', en: 'By using this website, you consent to this privacy policy.' },

    'legal.dmca.title': { vi: 'Chính sách DMCA', en: 'DMCA Policy', ja: 'DMCAポリシー', es: 'Política de DMCA', hi: 'DMCA नीति' },
    'legal.dmca.p1': { vi: 'Chúng tôi tôn trọng quyền sở hữu trí tuệ và tuân thủ Đạo luật Bản quyền Thiên niên kỷ Kỹ thuật số (DMCA).', en: 'We respect intellectual property rights and comply with the Digital Millennium Copyright Act (DMCA).' },
    'legal.dmca.p2': { vi: 'Nếu bạn tin rằng bất kỳ nội dung nào trên trang web này vi phạm bản quyền của bạn, vui lòng gửi thông báo DMCA bao gồm:', en: 'If you believe that any content on this website infringes your copyright, please submit a DMCA notice including:' },
    'legal.dmca.li1': { vi: 'Tên và thông tin liên hệ của bạn', en: 'Your name and contact information' },
    'legal.dmca.li2': { vi: 'Mô tả tác phẩm có bản quyền bị vi phạm', en: 'Description of the copyrighted work' },
    'legal.dmca.li3': { vi: 'URL của nội dung vi phạm', en: 'URL of the infringing content' },
    'legal.dmca.li4': { vi: 'Tuyên bố xác nhận tin tưởng thiện chí về sự vi phạm', en: 'A statement confirming good faith belief of infringement' },
    'legal.dmca.p3': { vi: 'Khi nhận được thông báo hợp lệ, chúng tôi sẽ nhanh chóng điều tra và gỡ bỏ tài liệu vi phạm nếu cần thiết.', en: 'Upon receiving a valid notice, we will promptly investigate and remove the infringing material if necessary.' },

    'legal.refund.title': { vi: 'Chính sách Hoàn tiền', en: 'Refund Policy', ja: '返金ポリシー', es: 'Política de Reembolso', hi: 'धनवापसी नीति' },
    'legal.refund.p1': { vi: 'Tất cả các giao dịch mua bán trên nền tảng này đều được xem là cuối cùng.', en: 'All purchases made on this platform are considered final.' },
    'legal.refund.p2': { vi: 'Do bản chất của dịch vụ kỹ thuật số và nội dung do AI tạo ra, chúng tôi thường không hoàn tiền sau khi dịch vụ đã được sử dụng.', en: 'Due to the nature of digital services and AI-generated content, refunds are generally not provided once the service has been used.' },
    'legal.refund.p3': { vi: 'Nếu bạn gặp vấn đề kỹ thuật hoặc lỗi thanh toán, vui lòng liên hệ với đội ngũ hỗ trợ của chúng tôi để được trợ giúp.', en: 'If you experience technical issues or billing errors, please contact our support team for assistance.' },
    'legal.refund.p4': { vi: 'Chúng tôi sẽ xem xét từng yêu cầu riêng biệt và có thể hoàn tiền trong các trường hợp ngoại lệ.', en: 'We will review each request individually and may provide a refund in exceptional circumstances.' },
    'legal.copyright': { vi: 'Thiết kế bởi hoaquocdang', en: 'Design by hoaquocdang', ja: 'デザイン: hoaquocdang', es: 'Diseño de hoaquocdang', hi: 'डिजाइन: hoaquocdang' },
};

// ============================================================
// i18n ENGINE
// ============================================================
const LANG_STORAGE_KEY = 'kgen_lang';

function getCurrentLang() {
    return localStorage.getItem(LANG_STORAGE_KEY) || 'vi';
}

function setLang(langCode) {
    localStorage.setItem(LANG_STORAGE_KEY, langCode);
    applyTranslations();
    // Update picker display
    const picker = document.getElementById('lang-current');
    if (picker) {
        const lang = SUPPORTED_LANGS.find(l => l.code === langCode);
        if (lang) picker.textContent = lang.flag + ' ' + lang.name;
    }
}

function t(key) {
    const lang = getCurrentLang();
    const entry = TRANSLATIONS[key];
    if (!entry) return key;
    return entry[lang] || entry['en'] || entry['vi'] || key;
}

function applyTranslations() {
    // Apply to all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const translated = t(key);
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            el.placeholder = translated;
        } else {
            el.textContent = translated;
        }
    });

    // Apply to data-i18n-placeholder
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });
}

function createLangPicker() {
    const currentLang = getCurrentLang();
    const lang = SUPPORTED_LANGS.find(l => l.code === currentLang) || SUPPORTED_LANGS[0];

    const picker = document.createElement('div');
    picker.className = 'lang-picker';
    picker.innerHTML = `
        <button class="lang-picker-btn" id="lang-picker-btn" onclick="toggleLangMenu()">
            <span id="lang-current">${lang.flag} ${lang.name}</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 5l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>
        <div class="lang-menu" id="lang-menu">
            ${SUPPORTED_LANGS.map(l => `
                <button class="lang-option ${l.code === currentLang ? 'active' : ''}" onclick="selectLang('${l.code}')">
                    <span>${l.flag}</span> ${l.name}
                </button>
            `).join('')}
        </div>
    `;
    return picker;
}

function toggleLangMenu() {
    const menu = document.getElementById('lang-menu');
    if (menu) menu.classList.toggle('open');
}

// Close menu when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.lang-picker')) {
        document.getElementById('lang-menu')?.classList.remove('open');
    }
});

// ============================================================
// CURRENCY CONVERSION (Frankfurter API — ECB data, free)
// ============================================================

// Base prices in VND
const BASE_PRICES_VND = {
    free: 0,
    pro: 39000,
    premium: 199000,
};

// Lang → Currency mapping
const LANG_CURRENCY = {
    vi: { code: 'VND', symbol: 'đ', position: 'after', decimals: 0, locale: 'vi-VN' },
    en: { code: 'USD', symbol: '$', position: 'before', decimals: 2, locale: 'en-US' },
    ja: { code: 'JPY', symbol: '¥', position: 'before', decimals: 0, locale: 'ja-JP' },
    es: { code: 'EUR', symbol: '€', position: 'after', decimals: 2, locale: 'es-ES' },
    hi: { code: 'INR', symbol: '₹', position: 'before', decimals: 0, locale: 'hi-IN' },
};

// Fallback rates (VND → X), updated manually as backup
const FALLBACK_RATES = {
    VND: 1,
    USD: 1 / 25500,
    JPY: 1 / 170,
    EUR: 1 / 27500,
    INR: 1 / 305,
};

const RATES_CACHE_KEY = 'kgen_fx_rates';
const RATES_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

let _cachedRates = null;

async function fetchExchangeRates() {
    // Check cache first
    try {
        const cached = JSON.parse(localStorage.getItem(RATES_CACHE_KEY) || 'null');
        if (cached && (Date.now() - cached.timestamp) < RATES_CACHE_TTL) {
            _cachedRates = cached.rates;
            return cached.rates;
        }
    } catch (e) { /* ignore */ }

    // Fetch from Frankfurter API (ECB data)
    try {
        const res = await fetch('https://api.frankfurter.app/latest?from=VND&to=USD,JPY,EUR');
        if (res.ok) {
            const data = await res.json();
            // Frankfurter doesn't support VND as base, so use USD as base and convert
            // Alternative: fetch USD-based rates and inverse
        }
    } catch (e) { /* API might not support VND directly */ }

    // Better approach: use USD as base (Frankfurter supports it well)
    try {
        const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=EUR,JPY,INR');
        if (res.ok) {
            const data = await res.json();
            // 1 USD = X of target currency
            const rates = {
                VND: 1,
                USD: 1 / 25500, // VND → USD
                EUR: (1 / 25500) * data.rates.EUR, // VND → USD → EUR
                JPY: (1 / 25500) * data.rates.JPY, // VND → USD → JPY
                INR: (1 / 25500) * data.rates.INR, // VND → USD → INR
            };
            _cachedRates = rates;
            localStorage.setItem(RATES_CACHE_KEY, JSON.stringify({
                rates,
                timestamp: Date.now(),
                source: 'frankfurter.app (ECB)'
            }));
            return rates;
        }
    } catch (e) {
        console.warn('FX API unavailable, using fallback rates');
    }

    _cachedRates = FALLBACK_RATES;
    return FALLBACK_RATES;
}

function convertPrice(vndAmount) {
    const lang = getCurrentLang();
    const currency = LANG_CURRENCY[lang] || LANG_CURRENCY.vi;
    const rates = _cachedRates || FALLBACK_RATES;
    const rate = rates[currency.code] || 1;

    const converted = vndAmount * rate;

    // Format number
    let formatted;
    if (currency.decimals === 0) {
        formatted = Math.round(converted).toLocaleString(currency.locale);
    } else {
        formatted = converted.toFixed(currency.decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    // Position symbol
    if (currency.position === 'before') {
        return currency.symbol + formatted;
    } else {
        return formatted + currency.symbol;
    }
}

function getPriceForLang(tierPriceVND) {
    return convertPrice(tierPriceVND);
}

function getCurrencyPeriod() {
    const lang = getCurrentLang();
    const periods = {
        vi: '/tháng',
        en: '/month',
        ja: '/月',
        es: '/mes',
        hi: '/महीना',
    };
    return periods[lang] || '/month';
}

// Update setLang to also refresh pricing
const _originalSetLang = setLang;
function setLangWithPricing(langCode) {
    _originalSetLang(langCode);
    // Re-render pricing if visible
    if (typeof setupPricing === 'function') setupPricing();
    if (typeof renderPricingModal === 'function') {
        const modal = document.getElementById('pricing-modal-overlay');
        if (modal) renderPricingModal();
    }
}

// Init: fetch rates on load
fetchExchangeRates();

// Export
window.t = t;
window.setLang = setLangWithPricing;
window.getCurrentLang = getCurrentLang;
window.applyTranslations = applyTranslations;
window.createLangPicker = createLangPicker;
window.toggleLangMenu = toggleLangMenu;
window.selectLang = function (code) {
    setLangWithPricing(code);
    document.querySelectorAll('.lang-option').forEach(opt => {
        opt.classList.toggle('active', opt.textContent.trim().includes(SUPPORTED_LANGS.find(l => l.code === code)?.name || ''));
    });
    toggleLangMenu();
};
window.convertPrice = convertPrice;
window.getPriceForLang = getPriceForLang;
window.getCurrencyPeriod = getCurrencyPeriod;
window.BASE_PRICES_VND = BASE_PRICES_VND;
window.LANG_CURRENCY = LANG_CURRENCY;
window.fetchExchangeRates = fetchExchangeRates;
