<?php
// db_connection.php
$host = 'br910.hostgator.com.br';
$user = 'concresu_admin_helpdesk';
$password = 'Cncr@1020';
$database = 'concresu_helpdesk';
$port = 3306;

try {
    $conn = new PDO("mysql:host=$host;port=$port;dbname=$database", $user, $password);
    // Configurar o PDO para lançar exceções em caso de erro
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $conn->exec("SET NAMES utf8");
} catch(PDOException $e) {
    die("Erro na conexão com o banco de dados: " . $e->getMessage());
}
?>