<?php
session_set_cookie_params([
    'lifetime' => 86400,
    'path' => '/',
    'secure' => true, // Ative em produção
    'httponly' => true,
    'samesite' => 'Lax'
]);

session_start();
require_once __DIR__ . '/db_connection.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://app.grupoconcresul.com.br');
header('Access-Control-Allow-Credentials: true');

try {
    $input = json_decode(file_get_contents('php://input'), true);
    $usuario = trim($input['usuario'] ?? '');
    $senha = trim($input['senha'] ?? '');

    if (empty($usuario) || empty($senha)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Credenciais inválidas']);
        exit();
    }

    $stmt = $conn->prepare("SELECT * FROM USUARIOS WHERE USUARIO = ? AND STATUS = 1");
    $stmt->execute([$usuario]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($user && $senha === $user['SENHA']) {
        $_SESSION = [
            'usuario_id' => $user['CODUSUARIO'],
            'usuario_nome' => $user['NOME'],
            'logged_in' => true,
            'last_activity' => time()
        ];

        session_regenerate_id(true);

        echo json_encode([
            'success' => true,
            'redirect' => 'dashboard/dashboard.html'
        ]);
    } else {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Usuário ou senha incorretos']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Erro no servidor']);
}