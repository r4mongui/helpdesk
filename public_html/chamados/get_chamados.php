<?php
// Configurações iniciais
error_reporting(0);
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header('Content-Type: application/json; charset=utf-8');
$base_url = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http") . "://$_SERVER[HTTP_HOST]";
header("Access-Control-Allow-Origin: $base_url");

// Verificação de requisição OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Conexão com o banco de dados
require_once __DIR__ . '/db_connection.php';

try {
    // Sanitização dos parâmetros
    $status = isset($_GET['status']) && $_GET['status'] !== 'all' ? (int)$_GET['status'] : null;
    $urgencia = isset($_GET['urgency']) && $_GET['urgency'] !== 'all' ? (int)$_GET['urgency'] : null;

    // Construção da query SQL com proteção contra SQL Injection
    $sql = "SELECT 
                ID,
                TITULO, 
                DESCRICAO, 
                TELEFONE, 
                IMAGEM, 
                DATE_FORMAT(DATACRIACAO, '%d/%m/%Y %H:%i') as DATACRIACAO_FORMATADA,
                IFNULL(DATE_FORMAT(DATACONCLUSAO, '%d/%m/%Y %H:%i'), '-') as DATACONCLUSAO_FORMATADA,
                STATUS, 
                URGENCIA, 
                RESOLUCAO 
            FROM CHAMADO 
            WHERE 1=1";
    
    $params = [];
    
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
    
    // Mapeamentos para status e urgência
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
    
    // Processamento dos resultados
    $chamados = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $chamados[] = [
            'id' => $row['ID'],
            'titulo' => $row['TITULO'],
            'descricao' => $row['DESCRICAO'],
            'telefone' => $row['TELEFONE'],
            'imagem' => $row['IMAGEM'] ?: null,
            'dataCriacao' => $row['DATACRIACAO_FORMATADA'],
            'dataConclusao' => $row['DATACONCLUSAO_FORMATADA'],
            'status' => $statusMap[$row['STATUS']] ?? ['text' => 'Desconhecido', 'class' => ''],
            'urgencia' => $urgenciaMap[$row['URGENCIA']] ?? ['text' => 'Desconhecido', 'class' => ''],
            'resolucao' => $row['RESOLUCAO'] ?: null
        ];
    }
    
    // Resposta JSON
    echo json_encode([
        'success' => true,
        'data' => $chamados,
        'total' => count($chamados)
    ]);
    
} catch(PDOException $e) {
    // Log do erro (em produção, registrar em arquivo de log)
    error_log('Erro em get_chamados.php: ' . $e->getMessage());
    
    // Resposta de erro
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro ao buscar chamados'
        // Em produção, remova o detalhe do erro abaixo
        // 'error' => $e->getMessage()
    ]);
}
?>