<?php
session_start();
header('Content-Type: application/json');

require_once '../db_connection.php';

if (!isset($_SESSION['usuario_id'])) {
    echo json_encode(['success' => false, 'message' => 'Usuário não autenticado']);
    exit();
}

$telefone = trim($_POST['telefone'] ?? '');
$cpf = trim($_POST['cpf'] ?? '');

if (!$telefone || !$cpf) {
    echo json_encode(['success' => false, 'message' => 'Telefone e CPF são obrigatórios']);
    exit();
}

try {
    $stmt = $conn->prepare("UPDATE USUARIOS SET TELEFONE = ?, CPF = ? WHERE CODUSUARIO = ?");
    $stmt->execute([$telefone, $cpf, $_SESSION['usuario_id']]);

    echo json_encode(['success' => true, 'message' => 'Dados atualizados com sucesso']);
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'Erro ao atualizar os dados']);
}
