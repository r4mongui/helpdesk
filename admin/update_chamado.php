<?php
include('../db_connection.php');

$data = json_decode(file_get_contents("php://input"), true);

$id = $data['id'] ?? null;
$status = $data['status'] ?? null;
$urgencia = $data['urgencia'] ?? null;
$resolucao = $data['resolucao'] ?? null;

if (!$id || !$status) {
    echo json_encode(['success' => false, 'message' => 'ID e status são obrigatórios.']);
    exit;
}

$sql = "UPDATE CHAMADO SET STATUS = ?, URGENCIA = ?, RESOLUCAO = ?, DATACONCLUSAO = NOW() WHERE ID = ?";
$stmt = $conn->prepare($sql);
$stmt->execute([$status, $urgencia, $resolucao, $id]);

echo json_encode(['success' => true]);
?>
