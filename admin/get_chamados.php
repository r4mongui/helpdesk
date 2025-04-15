<?php
header('Content-Type: application/json');
session_start();

if (!isset($_SESSION['usuario_id'])) {
    echo json_encode(["error" => "Não autorizado"]);
    exit;
}

require_once '../db_connection.php'; // ou ajuste o caminho se estiver diferente

try {
    $stmt = $conn->prepare("
        SELECT 
            c.ID,
            c.TITULO,
            c.DESCRICAO,
            c.TELEFONE,
            c.IMAGEM,
            c.DATACRIACAO,
            c.DATACONCLUSAO,
            c.USUARIOCRIACAO,
            u.NOME AS SOLICITANTE,
            c.USUARIORESOLUCAO,
            c.STATUS,
            c.URGENCIA,
            c.RESOLUCAO
        FROM CHAMADO c
        LEFT JOIN USUARIOS u ON u.CODUSUARIO = c.USUARIOCRIACAO
        ORDER BY c.DATACRIACAO DESC
    ");
    
    $stmt->execute();
    $chamados = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($chamados);
} catch (PDOException $e) {
    echo json_encode(["error" => "Erro no banco de dados: " . $e->getMessage()]);
}
?>
