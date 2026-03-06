<?php
/**
 * KGen Gallery — Gemini Imagen Proxy
 * Correct endpoint: :predict (NOT :generateImages)
 * Correct body format: { instances:[{prompt}], parameters:{sampleCount, aspectRatio} }
 * Correct auth: x-goog-api-key header (NOT ?key= query param)
 */

$allowed_origins = [
    'https://kgen.kudomax.vn',
    'http://127.0.0.1:8888',
    'http://localhost:8888',
    'http://localhost',
];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed_origins)) {
    header("Access-Control-Allow-Origin: $origin");
}
else {
    header("Access-Control-Allow-Origin: https://kgen.kudomax.vn");
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

$apiKey = $data['apiKey'] ?? '';
$modelId = $data['model'] ?? 'imagen-3.0-generate-002';
$prompt = $data['prompt'] ?? '';
$count = intval($data['sampleCount'] ?? 1);
$ar = $data['aspectRatio'] ?? '1:1';

if (!$apiKey || !$prompt) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing apiKey or prompt']);
    exit();
}

// Block text models
$blocked = ['gemini-1.5', 'gemini-2.0', 'gemini-3.0', 'gemini-flash', 'gemini-pro'];
foreach ($blocked as $b) {
    if (str_contains($modelId, $b)) {
        http_response_code(400);
        echo json_encode(['error' => "Model '$modelId' is a text model. Use imagen-3.0-generate-002 instead."]);
        exit();
    }
}

// CORRECT endpoint: :predict
$url = "https://generativelanguage.googleapis.com/v1beta/models/{$modelId}:predict";

// CORRECT body format
$payload = json_encode([
    'instances' => [['prompt' => $prompt]],
    'parameters' => [
        'sampleCount' => min($count, 4),
        'aspectRatio' => $ar,
    ],
]);

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        "x-goog-api-key: {$apiKey}", // CORRECT auth header
    ],
    CURLOPT_TIMEOUT => 60,
    CURLOPT_SSL_VERIFYPEER => true,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($curlError) {
    http_response_code(500);
    echo json_encode(['error' => "Proxy connection error: $curlError"]);
    exit();
}

http_response_code($httpCode);
echo $response;
