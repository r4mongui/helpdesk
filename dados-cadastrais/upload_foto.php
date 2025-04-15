<?php
session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['usuario_id'])) {
    echo json_encode(['success' => false, 'message' => 'Usuário não autenticado']);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !isset($_FILES['foto'])) {
    echo json_encode(['success' => false, 'message' => 'Requisição inválida']);
    exit();
}

$usuarioId = $_SESSION['usuario_id'];
$uploadDir = __DIR__ . '/../uploads/'; // volta uma pasta
$webPath = 'uploads/';

if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

$extensao = pathinfo($_FILES['foto']['name'], PATHINFO_EXTENSION);
$nomeArquivo = 'perfil_' . $usuarioId . '_' . time() . '.' . $extensao;
$caminhoCompleto = $uploadDir . $nomeArquivo;

if (move_uploaded_file($_FILES['foto']['tmp_name'], $caminhoCompleto)) {
    require_once __DIR__ . '/../db_connection.php';

    $stmt = $conn->prepare("UPDATE USUARIOS SET FOTO = ? WHERE CODUSUARIO = ?");
    $stmt->execute([$webPath . $nomeArquivo, $usuarioId]);

    $_SESSION['foto'] = $webPath . $nomeArquivo;

    echo json_encode(['success' => true, 'foto' => $webPath . $nomeArquivo]);
} else {
    echo json_encode(['success' => false, 'message' => 'Falha no upload da imagem']);
}
