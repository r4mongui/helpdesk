<?php
include('../db_connection.php');

$data = json_decode(file_get_contents("php://input"), true);
$id = $data['id'] ?? null;

if (!$id) {
    echo json_encode(['success' => false, 'message' => 'ID do chamado n«ªo informado.']);
    exit;
}

$sql = "DELETE FROM CHAMADO WHERE ID = ?";
$stmt = $conn->prepare($sql);
$stmt->execute([$id]);

echo json_encode(['success' => true]);
?>
