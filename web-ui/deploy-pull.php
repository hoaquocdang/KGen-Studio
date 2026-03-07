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
$files = [
    '.htaccess' => 'https://raw.githubusercontent.com/hoaquocdang/KGen-Studio/master/web-ui/.htaccess',
    'app.js' => 'https://raw.githubusercontent.com/hoaquocdang/KGen-Studio/master/web-ui/app.js',
    'index.html' => 'https://raw.githubusercontent.com/hoaquocdang/KGen-Studio/master/web-ui/index.html',
    'styles.css' => 'https://raw.githubusercontent.com/hoaquocdang/KGen-Studio/master/web-ui/styles.css',
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
