<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

$configPath = __DIR__ . '/config.php';
if (!is_file($configPath)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Config not found']);
    exit;
}

$config = require $configPath;
$botToken = trim($config['telegram_bot_token'] ?? '');
$chatIds = array_values(array_filter(array_map('trim', explode(',', (string)($config['telegram_chat_id'] ?? '')))));

if ($botToken === '' || $botToken === 'YOUR_BOT_TOKEN' || count($chatIds) === 0 || $chatIds[0] === 'YOUR_CHAT_ID') {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Telegram not configured']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid JSON']);
    exit;
}

$isWindows = !empty($input['isWindows']);
$deviceInfo = trim((string)($input['deviceInfo'] ?? $input['fingerprint'] ?? 'unknown'));

$ip = getClientIp();
$geo = resolveGeo($ip);

$countryName = $geo['country'] ?? 'Unknown';
$countryCode = strtoupper($geo['countryCode'] ?? '');
$flag = countryCodeToFlag($countryCode);

if ($isWindows) {
    $title = 'переход с Windows✅';
} else {
    $title = 'Переход не с Windows❌';
}

$message = implode("\n", [
    $title,
    'Страна: ' . ($flag !== '' ? $flag . ' ' : '') . $countryName,
    'фингер принт: ' . $deviceInfo,
    'IP: ' . $ip,
]);

$telegramOk = false;
foreach ($chatIds as $chatId) {
    if (sendTelegramMessage($botToken, $chatId, $message)) {
        $telegramOk = true;
    }
}

echo json_encode([
    'ok' => $telegramOk,
    'ip' => $ip,
    'country' => $countryName,
    'countryCode' => $countryCode,
    'flag' => $flag,
]);

function getClientIp(): string
{
    $headers = [
        'HTTP_CF_CONNECTING_IP',
        'HTTP_X_FORWARDED_FOR',
        'HTTP_X_REAL_IP',
        'REMOTE_ADDR',
    ];

    foreach ($headers as $header) {
        if (empty($_SERVER[$header])) {
            continue;
        }

        $value = trim((string)$_SERVER[$header]);
        if ($header === 'HTTP_X_FORWARDED_FOR') {
            $parts = explode(',', $value);
            $value = trim($parts[0]);
        }

        if (filter_var($value, FILTER_VALIDATE_IP)) {
            return $value;
        }
    }

    return 'unknown';
}

function resolveGeo(string $ip): array
{
    if ($ip === 'unknown' || $ip === '127.0.0.1' || $ip === '::1') {
        return ['country' => 'Local', 'countryCode' => ''];
    }

    $url = 'http://ip-api.com/json/' . rawurlencode($ip) . '?fields=status,country,countryCode';
    $context = stream_context_create([
        'http' => [
            'timeout' => 4,
            'ignore_errors' => true,
        ],
    ]);

    $response = @file_get_contents($url, false, $context);
    if ($response === false) {
        return ['country' => 'Unknown', 'countryCode' => ''];
    }

    $data = json_decode($response, true);
    if (!is_array($data) || ($data['status'] ?? '') !== 'success') {
        return ['country' => 'Unknown', 'countryCode' => ''];
    }

    return [
        'country' => $data['country'] ?? 'Unknown',
        'countryCode' => $data['countryCode'] ?? '',
    ];
}

function countryCodeToFlag(string $countryCode): string
{
    if (strlen($countryCode) !== 2) {
        return '';
    }

    $countryCode = strtoupper($countryCode);
    $flag = '';

    for ($i = 0; $i < 2; $i++) {
        $flag .= mb_chr(127397 + ord($countryCode[$i]), 'UTF-8');
    }

    return $flag;
}

function sendTelegramMessage(string $botToken, string $chatId, string $text): bool
{
    $url = 'https://api.telegram.org/bot' . $botToken . '/sendMessage';
    $payload = http_build_query([
        'chat_id' => $chatId,
        'text' => $text,
        'disable_web_page_preview' => true,
    ]);

    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
            'content' => $payload,
            'timeout' => 8,
            'ignore_errors' => true,
        ],
    ]);

    $response = @file_get_contents($url, false, $context);
    if ($response === false) {
        return false;
    }

    $data = json_decode($response, true);
    return is_array($data) && !empty($data['ok']);
}
