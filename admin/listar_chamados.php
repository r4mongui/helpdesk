<?php
include('../db_connection.php');
header('Content-Type: application/json');

$sql = "SELECT 
            c.ID,
            c.TITULO,
            u.NOME AS SOLICITANTE,
            c.STATUS,
            c.URGENCIA,
            c.DATACRIACAO
        FROM CHAMADOS c
        LEFT JOIN USUARIOS u ON u.CODUSUARIO = c.USUARIOCRIACAO
        ORDER BY c.DATACRIACAO DESC";

$result = $conn->query($sql);

$chamados = [];
while ($row = $result->fetch_assoc()) {
    $chamados[] = $row;
}

echo json_encode(['success' => true, 'data' => $chamados]);
$conn->close();
