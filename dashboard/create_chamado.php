<?php
session_start();
error_reporting(0);

// Cabeçalhos
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json; charset=utf-8");

// Pré-flight OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Verificação de sessão
if (!isset($_SESSION['usuario_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Usuário não autenticado']);
    exit();
}

// Conexão com o banco
require_once __DIR__ . '/../db_connection.php'; // ou ajuste se estiver em outra pasta

try {
    // Verificação de método
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Método não permitido']);
        exit();
    }

    // Campos obrigatórios
    $titulo = trim($_POST['titulo'] ?? '');
    $descricao = trim($_POST['descricao'] ?? '');
    $telefone = trim($_POST['telefone'] ?? '');
    $urgencia = (int)($_POST['urgencia'] ?? 2);
    $status = 1; // Padrão: Aberto
    $usuarioCriacao = $_SESSION['usuario_id'];
    $imagemPath = null;

    if (!$titulo || !$descricao || !$telefone) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Campos obrigatórios ausentes']);
        exit();
    }

    // Upload de imagem (opcional)
    if (isset($_FILES['imagem']) && $_FILES['imagem']['error'] === UPLOAD_ERR_OK) {
        $uploadDir = __DIR__ . '/../uploads/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        $extensao = pathinfo($_FILES['imagem']['name'], PATHINFO_EXTENSION);
        $nomeArquivo = time() . '_' . uniqid() . '.' . $extensao;
        $caminhoCompleto = $uploadDir . $nomeArquivo;

        if (move_uploaded_file($_FILES['imagem']['tmp_name'], $caminhoCompleto)) {
            $imagemPath = 'uploads/' . $nomeArquivo; // Caminho relativo
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Erro ao salvar imagem']);
            exit();
        }
    }

    // Inserção no banco
    $sql = "INSERT INTO CHAMADO 
            (TITULO, DESCRICAO, TELEFONE, IMAGEM, STATUS, URGENCIA, USUARIOCRIACAO, DATACRIACAO)
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW())";

    $stmt = $conn->prepare($sql);
    $stmt->execute([
        $titulo,
        $descricao,
        $telefone,
        $imagemPath,
        $status,
        $urgencia,
        $usuarioCriacao
    ]);

    echo json_encode([
        'success' => true,
        'message' => 'Chamado criado com sucesso!',
        'id' => $conn->lastInsertId()
    ]);
} catch (PDOException $e) {
    error_log("Erro em create_chamado.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Erro ao criar chamado']);
}
