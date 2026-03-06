<?php
/**
 * KGen Gallery — Gemini Imagen Proxy
 * Handles CORS for browser-to-Gemini API calls
 * Place this file in the same folder as index.html on your hosting
 */

// CORS headers — allow your domain only
$allowed_origins = [
    'https://kgen.kudomax.vn',
    'http://127.0.0.1:8888',
    'http://localhost:8888',
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed_origins)) {
    header("Access-Control-Allow-Origin: $origin");
} else {
    header("Access-Control-Allow-Origin: https://kgen.kudomax.vn");
}

header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Only accept POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

// Read request body
$body = file_get_contents('php://input');
$data = json_decode($body, true);
if (!$data) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON body']);
    exit();
}

$apiKey    = $data['apiKey'] ?? '';
$modelId   = $data['model'] ?? 'imagen-3.0-generate-002';
$prompt    = $data['prompt'] ?? '';
$count     = intval($data['numberOfImages'] ?? 1);
$ar        = $data['aspectRatio'] ?? '1:1';

if (!$apiKey || !$prompt) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing apiKey or prompt']);
    exit();
}

// Block text models (safety check)
$blocked = ['gemini-1.5', 'gemini-2.0', 'gemini-3.0', 'gemini-flash', 'gemini-pro'];
foreach ($blocked as $b) {
    if (str_contains($modelId, $b)) {
        http_response_code(400);
        echo json_encode(['error' => "Model '$modelId' is a text model. Use imagen-3.0-generate-002 instead."]);
        exit();
    }
}

// Forward to Gemini API
$url = "https://generativelanguage.googleapis.com/v1beta/models/{$modelId}:generateImages?key={$apiKey}";

$payload = json_encode([
    'prompt'  => $prompt,
    'config'  => [
        'numberOfImages' => min($count, 4),
        'aspectRatio'    => $ar,
        'outputOptions'  => ['mimeType' => 'image/png'],
    ],
]);

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $payload,
    CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
    CURLOPT_TIMEOUT        => 60,
    CURLOPT_SSL_VERIFYPEER => true,
]);

$response   = curl_exec($ch);
$httpCode   = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError  = curl_error($ch);
curl_close($ch);

if ($curlError) {
    http_response_code(500);
    echo json_encode(['error' => "Proxy connection error: $curlError"]);
    exit();
}

http_response_code($httpCode);
echo $response;
