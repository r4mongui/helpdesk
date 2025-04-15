<?php
session_start();
include('../db_connection.php'); // Certifique-se de que esta conexão usa PDO

header('Content-Type: application/json');

// Verifique se o usuário está autenticado
if (!isset($_SESSION['usuario_id'])) {
    echo json_encode(['success' => false, 'message' => 'Usuário não autenticado']);
    exit();
}

$usuarioId = $_SESSION['usuario_id'];
$senhaAtual = $_POST['senha_atual'] ?? '';
$novaSenha = $_POST['nova_senha'] ?? '';
$confirmarSenha = $_POST['confirmar_senha'] ?? '';

// Validações
if (empty($senhaAtual) || empty($novaSenha) || empty($confirmarSenha)) {
    echo json_encode(['success' => false, 'message' => 'Todos os campos são obrigatórios.']);
    exit;
}

if ($novaSenha !== $confirmarSenha) {
    echo json_encode(['success' => false, 'message' => 'As senhas não coincidem.']);
    exit;
}

try {
    // Buscar a senha atual do banco
    $sql = "SELECT SENHA FROM USUARIOS WHERE CODUSUARIO = ?";
    $stmt = $conn->prepare($sql);
    $stmt->execute([$usuarioId]);
    $senhaBD = $stmt->fetchColumn();

    if (!$senhaBD || $senhaAtual !== $senhaBD) {
        echo json_encode(['success' => false, 'message' => 'Senha atual incorreta.']);
        exit;
    }

    // Atualizar a senha (texto puro)
    $updateSql = "UPDATE USUARIOS SET SENHA = ? WHERE CODUSUARIO = ?";
    $updateStmt = $conn->prepare($updateSql);
    $updateStmt->execute([$novaSenha, $usuarioId]);

    if ($updateStmt->rowCount() > 0) {
        echo json_encode(['success' => true, 'message' => 'Senha alterada com sucesso.']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Nenhuma alteração realizada.']);
    }
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'Erro no servidor: ' . $e->getMessage()]);
}
?>
