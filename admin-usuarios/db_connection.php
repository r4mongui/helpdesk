<?php
function getPDO() {
    $host = 'br910.hostgator.com.br';
    $user = 'concresu_admin_helpdesk';
    $password = 'Cncr@1020';
    $database = 'concresu_helpdesk';
    $port = 3306;

    try {
        $conn = new PDO("mysql:host=$host;port=$port;dbname=$database", $user, $password);
        $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $conn->exec("SET NAMES utf8");
        return $conn;
    } catch(PDOException $e) {
        error_log("Erro de conexão: " . $e->getMessage());
        throw new Exception("Erro ao conectar ao banco de dados");
    }
}