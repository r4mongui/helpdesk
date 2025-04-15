<?php
session_start();

// Configurações iniciais
error_reporting(0);
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Credentials: true");

$base_url = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http") . "://$_SERVER[HTTP_HOST]";

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Verifica sessão
if (!isset($_SESSION['usuario_id'])) {
    echo json_encode(['success' => false, 'message' => 'Sessão não encontrada']);
    exit();
}

require_once __DIR__ . '/db_connection.php';

try {
    $status = isset($_GET['status']) && $_GET['status'] !== 'all' ? (int)$_GET['status'] : null;
    $urgencia = isset($_GET['urgency']) && $_GET['urgency'] !== 'all' ? (int)$_GET['urgency'] : null;
    $usuarioId = $_SESSION['usuario_id'];

    $sql = "SELECT 
                ID,
                TITULO,
                DESCRICAO,
                TELEFONE,
                IMAGEM,
                DATE_FORMAT(DATACRIACAO, '%d/%m/%Y %H:%i') AS DATACRIACAO_FORMATADA,
                IFNULL(DATE_FORMAT(DATACONCLUSAO, '%d/%m/%Y %H:%i'), '-') AS DATACONCLUSAO_FORMATADA,
                STATUS,
                URGENCIA,
                RESOLUCAO
            FROM CHAMADO
            WHERE USUARIOCRIACAO = ?";
    
    $params = [$usuarioId];

    if ($status !== null) {
        $sql .= " AND STATUS = ?";
        $params[] = $status;
    }

    if ($urgencia !== null) {
        $sql .= " AND URGENCIA = ?";
        $params[] = $urgencia;
    }

    $sql .= " ORDER BY DATACRIACAO DESC";

    $stmt = $conn->prepare($sql);
    $stmt->execute($params);

    $statusMap = [
        1 => ['text' => 'Aberto', 'class' => 'status-aberto'],
        2 => ['text' => 'Em andamento', 'class' => 'status-andamento'],
        3 => ['text' => 'Resolvido', 'class' => 'status-resolvido'],
        4 => ['text' => 'Fechado', 'class' => 'status-fechado']
    ];

    $urgenciaMap = [
        1 => ['text' => 'Baixa', 'class' => 'urgencia-baixa'],
        2 => ['text' => 'Média', 'class' => 'urgencia-media'],
        3 => ['text' => 'Alta', 'class' => 'urgencia-alta'],
        4 => ['text' => 'Crítica', 'class' => 'urgencia-critica']
    ];

    $chamados = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $chamados[] = [
            'id' => $row['ID'],
            'titulo' => $row['TITULO'],
            'descricao' => $row['DESCRICAO'],
            'telefone' => $row['TELEFONE'],
            'imagem' => $row['IMAGEM'] ? $base_url . '/' . ltrim($row['IMAGEM'], '/') : null,
            'dataCriacao' => $row['DATACRIACAO_FORMATADA'],
            'dataConclusao' => $row['DATACONCLUSAO_FORMATADA'],
            'status' => $statusMap[$row['STATUS']] ?? ['text' => 'Desconhecido', 'class' => ''],
            'urgencia' => $urgenciaMap[$row['URGENCIA']] ?? ['text' => 'Desconhecido', 'class' => ''],
            'resolucao' => $row['RESOLUCAO'] ?: null
        ];
    }

    echo json_encode([
        'success' => true,
        'data' => $chamados,
        'total' => count($chamados)
    ]);

} catch (PDOException $e) {
    error_log('Erro em get_chamados.php: ' . $e->getMessage());

    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro ao buscar chamados'
    ]);
}
