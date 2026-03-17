<?php
/**
 * Quick Deploy Script — Pull latest files from GitHub
 * Upload this ONE file to your hosting, then visit:
 * https://kgen.kudomax.vn/deploy-pull.php?key=kgen2026deploy
 * 
 * After deployment is confirmed, DELETE this file from hosting!
 */

// Simple security key
$SECRET_KEY = 'kgen2026deploy';
if (($_GET['key'] ?? '') !== $SECRET_KEY) {
    http_response_code(403);
    echo "Access denied. Use ?key=kgen2026deploy";
    exit;
}

header('Content-Type: text/plain; charset=utf-8');
echo "=== KGen Deploy Script ===\n\n";

// GitHub raw URLs for the files we need to update
$BASE = 'https://raw.githubusercontent.com/hoaquocdang/KGen-Studio/master/web-ui/';

$files = [
    // Core files
    '.htaccess'              => $BASE . '.htaccess',
    'app.js'                 => $BASE . 'app.js',
    'index.html'             => $BASE . 'index.html',
    'styles.css'             => $BASE . 'styles.css',
    // Avatars / Banners
    'viral_content_avatar.png' => $BASE . 'viral_content_avatar.png',
    'ai_tools_avatar.png'    => $BASE . 'ai_tools_avatar.png',
    'hub_avatar.png'         => $BASE . 'hub_avatar.png',
    'banner_chatbot.png'     => $BASE . 'banner_chatbot.png',
    'banner_gemini.png'      => $BASE . 'banner_gemini.png',
    'banner_premium.png'     => $BASE . 'banner_premium.png',
    // Chatbot Viral — Landing Page
    'chatbot_viral/index.html'  => $BASE . 'chatbot_viral/index.html',
    'chatbot_viral/styles.css'  => $BASE . 'chatbot_viral/styles.css',
    'chatbot_viral/script.js'   => $BASE . 'chatbot_viral/script.js',
    'chatbot_viral/hero_illustration.png' => $BASE . 'chatbot_viral/hero_illustration.png',
    'chatbot_viral/step1.png'   => $BASE . 'chatbot_viral/step1.png',
    'chatbot_viral/step2.png'   => $BASE . 'chatbot_viral/step2.png',
    'chatbot_viral/step3.png'   => $BASE . 'chatbot_viral/step3.png',
    // Chatbot Viral — Gem Store
    'chatbot_viral/gem/index.html'      => $BASE . 'chatbot_viral/gem/index.html',
    'chatbot_viral/gem/thumb_nguoi_que.png' => $BASE . 'chatbot_viral/gem/thumb_nguoi_que.png',
    'chatbot_viral/gem/thumb_triet_hoc.png' => $BASE . 'chatbot_viral/gem/thumb_triet_hoc.png',
    'chatbot_viral/gem/thumb_me_chong.png'  => $BASE . 'chatbot_viral/gem/thumb_me_chong.png',
    'chatbot_viral/gem/thumb_don_dep.png'   => $BASE . 'chatbot_viral/gem/thumb_don_dep.png',
    'chatbot_viral/gem/thumb_thoi_trang_nam.png'  => $BASE . 'chatbot_viral/gem/thumb_thoi_trang_nam.png',
    'chatbot_viral/gem/thumb_stickman_dao_li.png' => $BASE . 'chatbot_viral/gem/thumb_stickman_dao_li.png',
    'chatbot_viral/gem/thumb_con_trung_pov.png'   => $BASE . 'chatbot_viral/gem/thumb_con_trung_pov.png',
    'chatbot_viral/gem/thumb_review_san_pham.png' => $BASE . 'chatbot_viral/gem/thumb_review_san_pham.png',
];

$success = 0;
$failed = 0;

foreach ($files as $localFile => $remoteUrl) {
    echo "Downloading: $localFile ... ";

    $content = @file_get_contents($remoteUrl);
    if ($content === false) {
        echo "FAILED (could not download)\n";
        $failed++;
        continue;
    }

    // Create subdirectory if needed
    $dir = dirname($localFile);
    if ($dir !== '.' && !is_dir($dir)) {
        @mkdir($dir, 0755, true);
        echo "[created dir: $dir] ";
    }

    // Backup existing file
    if (file_exists($localFile)) {
        @copy($localFile, $localFile . '.bak');
    }

    // Write new file
    $written = @file_put_contents($localFile, $content);
    if ($written === false) {
        echo "FAILED (could not write)\n";
        $failed++;
        continue;
    }

    echo "OK (" . number_format(strlen($content)) . " bytes)\n";
    $success++;
}

echo "\n=== Results ===\n";
echo "Success: $success / " . count($files) . "\n";
echo "Failed: $failed\n";

if ($failed === 0) {
    echo "\n✅ All files deployed successfully!\n";
    echo "⚠️  IMPORTANT: Delete deploy-pull.php from your hosting now!\n";
}
else {
    echo "\n⚠️  Some files failed. Check file permissions on hosting.\n";
}
