<?php
header('Content-Type: application/json');

// Habilitar exibição de erros para desenvolvimento
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Verificação robusta do arquivo de conexão
$dbFile = __DIR__ . '/db_connection.php';
if (!file_exists($dbFile)) {
    http_response_code(500);
    die(json_encode(['error' => 'Arquivo de conexão não encontrado']));
}

require_once $dbFile;

try {
    // Estabelecer conexão com o banco
    $pdo = getPDO();
    
    // Verificar ação solicitada
    $action = $_GET['action'] ?? '';
    
    switch ($action) {
        case 'list':
            listUsers($pdo);
            break;
            
        case 'create':
            createUser($pdo);
            break;
            
        case 'update':
            updateUser($pdo);
            break;
            
        case 'delete':
            deleteUser($pdo);
            break;
            
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Ação inválida']);
    }
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Erro no banco de dados: ' . $e->getMessage()]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}

/**
 * Lista usuários com filtros
 */
function listUsers($pdo) {
    // Obter parâmetros de filtro
    $administrador = $_GET['administrador'] ?? null;
    $status = $_GET['status'] ?? null;
    $search = $_GET['search'] ?? null;
    $codUsuario = $_GET['CODUSUARIO'] ?? null;

    // Construir query SQL
    $sql = "SELECT * FROM USUARIOS WHERE 1=1";
    $params = [];
    
    // Adicionar filtros
    if ($codUsuario !== null) {
        $sql .= " AND CODUSUARIO = ?";
        $params[] = $codUsuario;
    }
    
    if ($status !== null) {
        $sql .= " AND STATUS = ?";
        $params[] = $status;
    }
    
    if ($search !== null) {
        $sql .= " AND (NOME LIKE ? OR EMAIL LIKE ? OR TELEFONE LIKE ?)";
        array_push($params, $search, $search, $search);
    }
    
    $sql .= " ORDER BY DATA_CRIACAO DESC";
    
    // Executar consulta
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Formatar resultados
    foreach ($users as &$user) {
        $user['ADMINISTRADOR'] = (bool)$user['ADMINISTRADOR'];
        $user['STATUS'] = (bool)$user['STATUS'];
    }
    
    echo json_encode($users);
}

/**
 * Cria um novo usuário
 */
function createUser($pdo) {
    // Obter dados do corpo da requisição
    $data = json_decode(file_get_contents('php://input'), true);
    
    // Validações básicas
    if (empty($data['NOME'])) {
        throw new Exception('O nome completo é obrigatório');
    }
    
    if (empty($data['EMAIL']) || !filter_var($data['EMAIL'], FILTER_VALIDATE_EMAIL)) {
        throw new Exception('E-mail inválido ou vazio');
    }
    
    if (empty($data['SENHA']) || strlen($data['SENHA']) < 6) {
        throw new Exception('A senha deve ter no mínimo 6 caracteres');
    }
    
    if ($data['SENHA'] !== $data['CONFIRMACAO_SENHA']) {
        throw new Exception('As senhas não coincidem');
    }
    
    // Verificar e-mail duplicado
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM usuarios WHERE EMAIL = ?");
    $stmt->execute([$data['EMAIL']]);
    
    if ($stmt->fetchColumn() > 0) {
        throw new Exception('Este e-mail já está cadastrado');
    }
    
    // Preparar dados para inserção
    $insertData = [
        'NOME' => trim($data['NOME']),
        'EMAIL' => strtolower(trim($data['EMAIL'])),
        'SENHA' => $data['SENHA'], // Senha em texto puro
        'DEPARTAMENTO' => $data['DEPARTAMENTO'] ?? null,
        'TELEFONE' => $data['TELEFONE'] ?? null,
        'CPF' => $data['CPF'] ?? null,
        'ADMINISTRADOR' => !empty($data['ADMINISTRADOR']) ? 1 : 0,
        'STATUS' => !isset($data['STATUS']) || $data['STATUS'] ? 1 : 0,
        'FOTO' => $data['FOTO'] ?? null
    ];
    
    // Query de inserção
    $sql = "INSERT INTO USUARIOS (
                NOME, EMAIL, SENHA, DEPARTAMENTO, TELEFONE, 
                CPF, ADMINISTRADOR, STATUS, FOTO, DATA_CRIACAO
            ) VALUES (
                :NOME, :EMAIL, :SENHA, :DEPARTAMENTO, :TELEFONE, 
                :CPF, :ADMINISTRADOR, :STATUS, :FOTO, NOW()
            )";
    
    $stmt = $pdo->prepare($sql);
    $success = $stmt->execute($insertData);
    
    if ($success) {
        echo json_encode([
            'success' => true,
            'CODUSUARIO' => $pdo->lastInsertId(),
            'message' => 'Usuário criado com sucesso'
        ]);
    } else {
        throw new Exception('Erro ao criar usuário no banco de dados');
    }
}

/**
 * Atualiza um usuário existente
 */
function updateUser($pdo) {
    // Obter dados do corpo da requisição
    $data = json_decode(file_get_contents('php://input'), true);
    
    // Validações básicas
    if (empty($data['CODUSUARIO'])) {
        throw new Exception('ID do usuário é obrigatório');
    }
    
    if (empty($data['NOME'])) {
        throw new Exception('O nome completo é obrigatório');
    }
    
    if (empty($data['EMAIL']) || !filter_var($data['EMAIL'], FILTER_VALIDATE_EMAIL)) {
        throw new Exception('E-mail inválido ou vazio');
    }
    
    // Verificar e-mail duplicado em outro usuário
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM usuarios WHERE EMAIL = ? AND CODUSUARIO != ?");
    $stmt->execute([$data['EMAIL'], $data['CODUSUARIO']]);
    
    if ($stmt->fetchColumn() > 0) {
        throw new Exception('Este e-mail já está cadastrado para outro usuário');
    }
    
    // Preparar dados para atualização
    $updateData = [
        'CODUSUARIO' => $data['CODUSUARIO'],
        'NOME' => trim($data['NOME']),
        'EMAIL' => strtolower(trim($data['EMAIL'])),
        'DEPARTAMENTO' => $data['DEPARTAMENTO'] ?? null,
        'TELEFONE' => $data['TELEFONE'] ?? null,
        'CPF' => $data['CPF'] ?? null,
        'ADMINISTRADOR' => !empty($data['ADMINISTRADOR']) ? 1 : 0,
        'STATUS' => !empty($data['STATUS']) ? 1 : 0,
        'FOTO' => $data['FOTO'] ?? null
    ];
    
    // Query de atualização básica
    $sql = "UPDATE USUARIOS SET 
                NOME = :NOME,
                EMAIL = :EMAIL,
                DEPARTAMENTO = :DEPARTAMENTO,
                TELEFONE = :TELEFONE,
                CPF = :CPF,
                ADMINISTRADOR = :ADMINISTRADOR,
                STATUS = :STATUS,
                FOTO = :FOTO";
    
    // Adicionar atualização de senha se fornecida
    if (!empty($data['SENHA'])) {
        if (strlen($data['SENHA']) < 6) {
            throw new Exception('A senha deve ter no mínimo 6 caracteres');
        }
        
        if ($data['SENHA'] !== $data['CONFIRMACAO_SENHA']) {
            throw new Exception('As senhas não coincidem');
        }
        
        $sql .= ", SENHA = :SENHA";
        $updateData['SENHA'] = $data['SENHA'];
    }
    
    $sql .= " WHERE CODUSUARIO = :CODUSUARIO";
    
    $stmt = $pdo->prepare($sql);
    $success = $stmt->execute($updateData);
    
    if ($success) {
        echo json_encode([
            'success' => true,
            'message' => 'Usuário atualizado com sucesso'
        ]);
    } else {
        throw new Exception('Erro ao atualizar usuário no banco de dados');
    }
}

/**
 * Realiza um soft delete (inativa) do usuário
 */
function deleteUser($pdo) {
    // Obter dados do corpo da requisição
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (empty($data['CODUSUARIO'])) {
        throw new Exception('ID do usuário é obrigatório');
    }
    
    // Soft delete (marca como inativo)
    $stmt = $pdo->prepare("UPDATE USUARIOS SET STATUS = 0 WHERE CODUSUARIO = ?");
    $success = $stmt->execute([$data['CODUSUARIO']]);
    
    if ($success) {
        echo json_encode([
            'success' => true,
            'message' => 'Usuário inativado com sucesso'
        ]);
    } else {
        throw new Exception('Erro ao inativar usuário');
    }
}