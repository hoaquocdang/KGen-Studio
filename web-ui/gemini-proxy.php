<?php
/**
 * KGen Gallery — Gemini Imagen Proxy
 * Model: imagen-4.0-generate-001 (Imagen 4) → fallback imagen-3.0-generate-002
 * Endpoint: :predict | Auth: x-goog-api-key header
 */

$allowed_origins = [
    'https://kgen.cloud',
    'https://kgen.kudomax.vn',
    'http://127.0.0.1:8888',
    'http://localhost:8888',
    'http://localhost',
];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed_origins)) {
    header("Access-Control-Allow-Origin: $origin");
} else {
    header("Access-Control-Allow-Origin: https://kgen.cloud");
}
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

$body = file_get_contents('php://input');
$data = json_decode($body, true);
if (!$data) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON']);
    exit();
}

// ── Key Pool: GEMINI_KEY_1, GEMINI_KEY_2, ... hoặc GEMINI_KEY ──────────
$keyPool = [];
for ($i = 1; $i <= 20; $i++) {
    $k = getenv("GEMINI_KEY_$i");
    if ($k) $keyPool[] = trim($k);
}
$singleKey = getenv('GEMINI_KEY') ?: ($data['apiKey'] ?? '');
if ($singleKey && !in_array($singleKey, $keyPool)) $keyPool[] = trim($singleKey);

if (empty($keyPool)) {
    http_response_code(500);
    echo json_encode(['error' => 'Gemini API key chua duoc cau hinh tren server.']);
    exit();
}

// Round-robin selection (stateless: time-based)
$apiKey = $keyPool[intval(microtime(true)) % count($keyPool)];

// Validate model
$requestedModel = $data['model'] ?? 'imagen-4.0-generate-001';
$blockedModels = ['gemini-1.5', 'gemini-2.0', 'gemini-3.0', 'gemini-flash', 'gemini-pro'];
foreach ($blockedModels as $b) {
    if (str_contains($requestedModel, $b)) {
        http_response_code(400);
        echo json_encode(['error' => "Model '$requestedModel' is not an image model."]);
        exit();
    }
}

// Models to try: Imagen 4 first, then fallback to Imagen 3
$modelsToTry = ['imagen-4.0-generate-001', 'imagen-3.0-generate-002'];
if ($requestedModel !== 'imagen-4.0-generate-001') {
    $modelsToTry = [$requestedModel]; // use exact model if user specified other
}

$prompt = $data['prompt'] ?? '';
$count  = intval($data['sampleCount'] ?? 1);
$ar     = $data['aspectRatio'] ?? '1:1';

if (!$prompt) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing prompt']);
    exit();
}

$payload = json_encode([
    'instances'  => [['prompt' => $prompt]],
    'parameters' => ['sampleCount' => min($count, 4), 'aspectRatio' => $ar],
]);

$lastStatus = 500;
$lastBody   = json_encode(['error' => 'All models failed']);

foreach ($modelsToTry as $modelId) {
    $url = "https://generativelanguage.googleapis.com/v1beta/models/{$modelId}:predict";

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            "x-goog-api-key: {$apiKey}",
        ],
        CURLOPT_TIMEOUT        => 60,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);

    $response  = curl_exec($ch);
    $httpCode  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError) {
        http_response_code(500);
        echo json_encode(['error' => "Proxy connection error: $curlError"]);
        exit();
    }

    // 404 = model not available yet → try next
    if ($httpCode === 404 && count($modelsToTry) > 1) {
        $lastStatus = $httpCode;
        $lastBody   = $response;
        continue;
    }

    // Return response with model header
    http_response_code($httpCode);
    header('X-Imagen-Model: ' . $modelId);
    echo $response;
    exit();
}

http_response_code($lastStatus);
echo $lastBody;
