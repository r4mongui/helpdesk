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
require_once 'db_connection.php';

// Verifica se o ID do chamado foi enviado
if (!isset($_GET['id']) || !is_numeric($_GET['id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'ID do chamado inválido']);
    exit;
}

$idChamado = (int)$_GET['id'];

try {
    // Query SQL para buscar os detalhes do chamado específico
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
            WHERE ID = ?";
    
    $stmt = $conn->prepare($sql);
    $stmt->execute([$idChamado]);
    
    $chamado = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$chamado) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Chamado não encontrado']);
        exit;
    }
    
    // Mapeamentos para status e urgência (igual ao get_chamados.php)
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
    
    // Prepara a resposta com os detalhes do chamado
    $response = [
        'success' => true,
        'data' => [
            'id' => $chamado['ID'],
            'titulo' => $chamado['TITULO'],
            'descricao' => $chamado['DESCRICAO'],
            'telefone' => $chamado['TELEFONE'],
            'imagem' => $chamado['IMAGEM'] ? $base_url . '/' . ltrim($chamado['IMAGEM'], '/') : null,
            'dataCriacao' => $chamado['DATACRIACAO_FORMATADA'],
            'dataConclusao' => $chamado['DATACONCLUSAO_FORMATADA'],
            'status' => $statusMap[$chamado['STATUS']] ?? ['text' => 'Desconhecido', 'class' => ''],
            'urgencia' => $urgenciaMap[$chamado['URGENCIA']] ?? ['text' => 'Desconhecido', 'class' => ''],
            'resolucao' => $chamado['RESOLUCAO'] ?: null
        ]
    ];
    
    echo json_encode($response);
    
} catch(PDOException $e) {
    // Log do erro
    error_log('Erro em get_chamados_detalhes.php: ' . $e->getMessage());
    
    // Resposta de erro
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro ao buscar detalhes do chamado'
        // Em produção, remova o detalhe do erro abaixo
        // 'error' => $e->getMessage()
    ]);
}
?>