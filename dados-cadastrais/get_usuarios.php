<?php
session_start();
header('Content-Type: application/json');

// Verifica se o usuário está logado
if (!isset($_SESSION['usuario_id'])) {
    echo json_encode(['success' => false, 'message' => 'Usuário não autenticado']);
    exit();
}

// Conexão com o banco
require_once '../db_connection.php';

try {
    $stmt = $conn->prepare("SELECT USUARIO, NOME, EMAIL, DEPARTAMENTO, TELEFONE, CPF, FOTO FROM USUARIOS WHERE CODUSUARIO = ?");
    $stmt->execute([$_SESSION['usuario_id']]);
    $usuario = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($usuario) {
        echo json_encode([
            'success' => true,
            'data' => $usuario
        ]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Usuário não encontrado']);
    }
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'Erro ao buscar usuário']);
}
