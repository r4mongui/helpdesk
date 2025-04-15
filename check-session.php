<?php
// Configurações de sessão mais completas
session_set_cookie_params([
    'lifetime' => 86400, // 1 dia
    'path' => '/',
    'domain' => '.grupoconcresul.com.br', // Permite subdomínios
    'secure' => true,
    'httponly' => true,
    'samesite' => 'Lax'
]);

session_start();

// Headers para API e CORS
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://app.grupoconcresul.com.br');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Dados de debug
$debugData = [
    'session_id' => session_id(),
    'session_status' => session_status(),
    'cookie_params' => session_get_cookie_params(),
    'server_https' => $_SERVER['HTTPS'] ?? 'off'
];

try {
    // Verificação completa da sessão
    $isLoggedIn = isset(
        $_SESSION['usuario_id'],
        $_SESSION['usuario_nome'],
        $_SESSION['logged_in']
    ) && $_SESSION['logged_in'] === true;

    if ($isLoggedIn) {
        // Dados seguros para retornar ao front-end
        $response = [
            'loggedIn' => true,
            'usuario' => [
                'id' => $_SESSION['usuario_id'],
                'nome' => $_SESSION['usuario_nome'],
                'email' => $_SESSION['usuario_email'] ?? null,
                'administrador' => $_SESSION['administrador'] ?? 0,
                'departamento' => $_SESSION['departamento'] ?? null,
                'foto' => $_SESSION['foto'] ?? null
            ],
            'session' => [
                'last_activity' => $_SESSION['last_activity'] ?? null,
                'session_age' => isset($_SESSION['last_activity']) 
                    ? time() - $_SESSION['last_activity'] 
                    : null
            ]
        ];
        
        // Atualiza tempo da última atividade
        $_SESSION['last_activity'] = time();
        
        http_response_code(200);
        echo json_encode($response);
    } else {
        http_response_code(401);
        echo json_encode([
            'loggedIn' => false,
            'message' => 'Sessão inválida ou expirada',
            'debug' => $debugData // Remova em produção
        ]);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'loggedIn' => false,
        'error' => 'Erro ao verificar sessão',
        'message' => $e->getMessage(),
        'debug' => $debugData // Remova em produção
    ]);
}

// Debug (remova ou proteja em produção)
file_put_contents(
    __DIR__ . '/sessao_debug.log', 
    date('Y-m-d H:i:s') . " - " . json_encode([
        'session' => $_SESSION,
        'debug' => $debugData,
        'headers' => headers_list()
    ]) . PHP_EOL, 
    FILE_APPEND
);