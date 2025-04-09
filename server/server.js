const express = require('express');
const path = require('path');
const session = require('express-session');
const cors = require('cors');
const multer = require('multer');
const sql = require('mssql');
const fs = require('fs');
const { title } = require('process');
require('dotenv').config({ path: 'config.env' });

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Configuração básica do Express
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Configuração de CORS
app.use(cors({
    origin: ['https://app.grupoconcresul.com.br', 'http://localhost:3000'], // Coloque o domínio real aqui
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// 3. Configuração de sessão
app.use(session({
    secret: 'grupo_concresul',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // true se estiver usando HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'lax', // Importante para cross-site cookies
    }
}));

// 4. Middleware para servir arquivos estáticos CORRETAMENTE
const staticOptions = {
    setHeaders: (res, filePath) => {
        const mimeTypes = {
            '.html': 'text/html; charset=UTF-8',
            '.css': 'text/css; charset=UTF-8',
            '.js': 'application/javascript; charset=UTF-8',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.ico': 'image/x-icon',
            '.svg': 'image/svg+xml'
        };
        
        const ext = path.extname(filePath).toLowerCase();
        if (mimeTypes[ext]) {
            res.set('Content-Type', mimeTypes[ext]);
        }
    }
};

// 5. Configurar rotas estáticas PRIMEIRO
app.use('/dashboard', express.static(
    path.join(__dirname, '..', 'frontend', 'dashboard'), 
    staticOptions
));

app.use('/chamados', express.static(
    path.join(__dirname, '..', 'frontend', 'chamados'), 
    staticOptions
));

app.use('/login', express.static(
    path.join(__dirname, '..', 'frontend', 'login'), 
    staticOptions
));

app.use('/password', express.static(
    path.join(__dirname, '..', 'frontend', 'password'), 
    staticOptions
));

app.use('/images', express.static(
    path.join(__dirname, '..', 'frontend', 'images'),
    { maxAge: '1d' }
));

app.use('/uploads', express.static(
    path.join(__dirname, '..', 'uploads'),
    {
        setHeaders: (res, path) => {
            // Permite acesso às imagens de qualquer origem (CORS)
            res.set('Access-Control-Allow-Origin', '*');
        }
    }
));

app.use('/admin', express.static(
    path.join(__dirname, '..', 'frontend', 'admin'),
    staticOptions
));

app.use('/perfil', express.static(
    path.join(__dirname, '..', 'frontend', 'perfil'), 
    staticOptions
));

app.use('/admin/usuarios', express.static(
    path.join(__dirname, '..', 'frontend', 'admin', 'usuarios'),
    staticOptions
));

// 6. Rotas principais que DEVEM vir depois dos arquivos estáticos
app.get('/', (req, res) => {
    const filePath = path.join(__dirname, '..', 'frontend', 'login', 'login.html');
    
    // Verifica se o arquivo existe antes de enviar
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            console.error('Arquivo não encontrado:', filePath);
            return res.status(404).send('Página de login não encontrada');
        }
        res.sendFile(filePath, { 
            headers: {
                'Content-Type': 'text/html; charset=UTF-8'
            } 
        });
    });
});

app.get('/api/check-image/:filename', async (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '..', 'uploads', filename);
    
    try {
        await fs.promises.access(filePath);
        res.json({ exists: true });
    } catch {
        res.json({ exists: false });
    }
});

app.get('/dashboard', checkSession, (req, res, next) => {
    const filePath = path.join(__dirname, '..', 'frontend', 'dashboard', 'dashboard.html');
    
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            console.error('Arquivo não encontrado:', filePath);
            // Remove o next() e usa apenas return com res.status()
            return res.status(404).send('Página não encontrada');
        }
        // Envia o arquivo apenas uma vez
        res.sendFile(filePath);
    });
});

app.get('/password', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'password', 'password.html'));
});

app.get('/dados-cadastrais', (req, res) => {
    const filePath = path.join(__dirname, '..', 'frontend', 'perfil', 'dados-cadastrais.html');
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            console.error('Arquivo não encontrado:', filePath);
            return res.status(404).send('Página não encontrada');
        }
        res.sendFile(filePath);
    });
});

app.get('/api/check-session', (req, res) => {
    res.json({ 
        authenticated: !!req.session.codUsuario,
        userId: req.session.codUsuario,
        sessionId: req.sessionID
    });
});

// Configuração do banco de dados
console.log("DB_SERVER:", process.env.DB_SERVER);
const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    port: parseInt(process.env.DB_PORT) || 3000,
    database: process.env.DB_NAME,
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

// Pool de conexão com o banco
const poolPromise = new sql.ConnectionPool(config)
    .connect()
    .then(pool => {
        console.log("Conectado ao banco de dados");
        return pool;
    })
    .catch(err => {
        console.error("Erro ao conectar ao banco:", err);
        process.exit(1);
    });

async function getPool() {
    return await poolPromise;
}

// Middleware para verificar sessão
function checkSession(req, res, next) {
    if (!req.session.codUsuario) {
        if (req.accepts('html')) {
            // Retorna imediatamente com redirect
            return res.redirect('/login');
        }
        // Retorna imediatamente com JSON
        return res.status(401).json({
            success: false, 
            message: "Não autenticado" 
        });
    }
    // Só chama next() se o usuário estiver autenticado
    next();
}

// Configuração do Multer para upload de imagens
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '..', 'uploads'));
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Apenas imagens são permitidas'), false);
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

// Rota de login
app.post('/api/login', async (req, res) => {
    const { usuario, senha } = req.body;

    if (!usuario || !senha) {
        return res.status(400).json({ 
            success: false, 
            message: "Usuário e senha são obrigatórios" 
        });
    }

    try {
        const pool = await getPool();
        const result = await pool
            .request()
            .input('usuario', sql.VarChar, usuario)
            .input('senha', sql.VarChar, senha)
            .query("SELECT CODUSUARIO FROM USUARIOS WHERE usuario = @usuario AND senha = @senha");

        if (result.recordset.length > 0) {
            req.session.codUsuario = result.recordset[0].CODUSUARIO;
            
            req.session.save(err => {
                if (err) {
                    console.error("Erro ao salvar sessão:", err);
                    return res.status(500).json({ 
                        success: false, 
                        message: "Erro interno no servidor" 
                    });
                }
                // Apenas uma resposta é enviada
                res.json({ 
                    success: true,
                    message: "Login bem-sucedido"
                });
            });
        } else {
            // Apenas uma resposta é enviada
            res.status(401).json({ 
                success: false, 
                message: "Usuário ou senha incorretos" 
            });
        }
    } catch (err) {
        console.error("Erro no login:", err);
        // Apenas uma resposta é enviada
        res.status(500).json({ 
            success: false, 
            message: "Erro interno do servidor",
            error: err.message 
        });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Erro ao destruir sessão:', err);
            return res.status(500).json({ success: false, message: 'Erro ao fazer logout' });
        }
        res.clearCookie('connect.sid'); // Nome padrão do cookie de sessão
        res.json({ success: true, message: 'Logout realizado com sucesso' });
    });
});

app.get('/api/check-auth', (req, res) => {
    if (req.session.codUsuario) {
        res.json({ authenticated: true });
    } else {
        res.status(401).json({ authenticated: false });
    }
});

// Rota para redefinir senha
app.post('/api/redefinir-senha', checkSession, async (req, res) => {
    const { senhaAtual, novaSenha } = req.body;

    if (!senhaAtual || !novaSenha) {
        return res.status(400).json({ 
            success: false, 
            message: "Todos os campos são obrigatórios"
        });
    }

    try {
        const pool = await getPool();
        const codUsuario = req.session.codUsuario;

        const userResult = await pool
            .request()
            .input('codUsuario', sql.Int, codUsuario)
            .query("SELECT senha FROM USUARIOS WHERE CODUSUARIO = @codUsuario");
        
        if (userResult.recordset.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: "Usuário não encontrado"
            });
        }

        const senhaAtualNoBanco = userResult.recordset[0].senha;

        if (senhaAtual !== senhaAtualNoBanco) {
            return res.status(401).json({ 
                success: false, 
                message: "Senha atual incorreta"
            });
        }

        if (novaSenha === senhaAtualNoBanco) {
            return res.status(400).json({ 
                success: false, 
                message: "A nova senha deve ser diferente da atual"
            });
        }

        await pool
            .request()
            .input('codUsuario', sql.Int, codUsuario)
            .input('novaSenha', sql.VarChar, novaSenha)
            .query("UPDATE USUARIOS SET senha = @novaSenha WHERE CODUSUARIO = @codUsuario");

        req.session.destroy();

        res.json({ 
            success: true, 
            message: "Senha atualizada com sucesso! Redirecionando..."
        });

    } catch (err) {
        console.error("Erro ao redefinir senha:", err);
        res.status(500).json({ 
            success: false, 
            message: "Erro interno do servidor",
            error: err.message
        });
    }
});

// Rota para criar chamados
app.post('/api/chamados', checkSession, upload.single('imagem'), async (req, res) => {
    try {
        const { titulo, descricao, telefone, urgencia } = req.body;
        const imagemPath = req.file ? path.join('uploads', req.file.filename) : null;
        const usuarioCriacao = req.session.codUsuario;

        if (!titulo || titulo.length < 5) {
            return res.status(400).json({ 
                success: false, 
                message: "Título deve ter pelo menos 5 caracteres" 
            });
        }

        if (!descricao || descricao.length < 10) {
            return res.status(400).json({ 
                success: false, 
                message: "Descrição deve ter pelo menos 10 caracteres" 
            });
        }

        if (!telefone || telefone.length < 14) {
            return res.status(400).json({ 
                success: false, 
                message: "Telefone inválido" 
            });
        }

        if (![1, 2, 3, 4].includes(parseInt(urgencia))) {
            return res.status(400).json({ 
                success: false, 
                message: "Nível de urgência inválido" 
            });
        }

        const pool = await getPool();
        
        const result = await pool.request()
            .input('titulo', sql.VarChar, titulo)
            .input('descricao', sql.Text, descricao)
            .input('telefone', sql.VarChar, telefone)
            .input('urgencia', sql.Int, parseInt(urgencia))
            .input('imagem', sql.VarChar, imagemPath)
            .input('usuarioCriacao', sql.BigInt, usuarioCriacao)
            .query(`
                INSERT INTO CHAMADO 
                (TITULO, DESCRICAO, TELEFONE, URGENCIA, IMAGEM, STATUS, DATACRIACAO, USUARIOCRIACAO) 
                VALUES (@titulo, @descricao, @telefone, @urgencia, @imagem, 1, GETDATE(), @usuarioCriacao);
                SELECT SCOPE_IDENTITY() AS ID;
            `);

        res.status(201).json({ 
            success: true, 
            message: 'Chamado criado com sucesso',
            chamadoId: result.recordset[0].ID,
            imagemUrl: imagemPath ? `http://${HOST}:${PORT}/${imagemPath}` : null
        });

    } catch (err) {
        console.error("Erro ao criar chamado:", err);
        
        if (req.file) {
            fs.unlink(req.file.path, () => {});
        }

        res.status(500).json({ 
            success: false, 
            message: 'Erro ao criar chamado',
            error: err.message 
        });
    }
});

// Rota para listar chamados
app.get('/api/chamados', checkSession, async (req, res) => {
    try {
        const pool = await getPool();
        const codUsuario = req.session.codUsuario;
        
        const result = await pool.request()
            .input('codUsuario', sql.BigInt, codUsuario)
            .query(`
                SELECT 
                    c.ID,
                    c.TITULO,
                    c.DESCRICAO,
                    c.TELEFONE,
                    c.URGENCIA,
                    tu.DESCRICAO AS DESC_URGENCIA,
                    CASE 
                        WHEN c.IMAGEM IS NOT NULL THEN CONCAT('http://${HOST}:${PORT}/', c.IMAGEM)
                        ELSE NULL
                    END AS IMAGEM_URL,
                    c.STATUS,
                    ts.DESCRICAO AS DESC_STATUS,
                    FORMAT(c.DATACRIACAO, 'dd/MM/yyyy HH:mm') AS DATACRIACAO,
                    FORMAT(c.DATACONCLUSAO, 'dd/MM/yyyy HH:mm') AS DATACONCLUSAO,
                    c.USUARIOCRIACAO,
                    uc.USUARIO AS NOME_CRIADOR,
                    c.USUARIORESOLUCAO,
                    ur.USUARIO AS NOME_RESOLVEDOR,
                    c.RESOLUCAO
                FROM CHAMADO c
                LEFT JOIN TIPO_URGENCIA tu ON c.URGENCIA = tu.ID
                LEFT JOIN TIPO_STATUS ts ON c.STATUS = ts.ID
                LEFT JOIN USUARIOS uc ON c.USUARIOCRIACAO = uc.CODUSUARIO
                LEFT JOIN USUARIOS ur ON c.USUARIORESOLUCAO = ur.CODUSUARIO
                WHERE c.USUARIOCRIACAO = @codUsuario
                ORDER BY c.DATACRIACAO DESC
            `);

        res.json({ 
            success: true, 
            chamados: result.recordset 
        });
    } catch (err) {
        console.error("Erro ao buscar chamados:", err);
        res.status(500).json({ 
            success: false, 
            message: 'Erro ao buscar chamados',
            error: err.message 
        });
    }
});

// Rota para obter tipos de urgência
app.get('/api/tipos/urgencia', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query("SELECT * FROM TIPO_URGENCIA");
        res.json({ 
            success: true, 
            tipos: result.recordset 
        });
    } catch (err) {
        res.status(500).json({ 
            success: false, 
            message: 'Erro ao buscar tipos de urgência',
            error: err.message 
        });
    }
});

// Rota para obter tipos de status
app.get('/api/tipos/status', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query("SELECT * FROM TIPO_STATUS");
        console.log("Tipos de status:", result.recordset); // Adicione este log
        res.json({ 
            success: true, 
            tipos: result.recordset 
        });
    } catch (err) {
        res.status(500).json({ 
            success: false, 
            message: 'Erro ao buscar tipos de status',
            error: err.message 
        });
    }
});

// Rota para obter dados do usuário
app.get('/api/usuario/dados', checkSession, async (req, res) => {
    try {
        const pool = await getPool();
        const codUsuario = req.session.codUsuario;
        
        const result = await pool.request()
            .input('codUsuario', sql.Int, codUsuario)
            .query(`
                SELECT 
                    USUARIO, 
                    NOME, 
                    DEPARTAMENTO, 
                    TELEFONE, 
                    EMAIL,
                    CPF,
                    FOTO,
                    CASE 
                        WHEN FOTO IS NOT NULL THEN CONCAT('http://${HOST}:${PORT}/', REPLACE(FOTO, '\\', '/'))
                        ELSE NULL
                    END AS FOTO_URL
                FROM USUARIOS 
                WHERE CODUSUARIO = @codUsuario
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: "Usuário não encontrado" 
            });
        }

        res.json({ 
            success: true, 
            usuario: result.recordset[0] 
        });
    } catch (err) {
        console.error("Erro ao buscar dados do usuário:", err);
        res.status(500).json({ 
            success: false, 
            message: "Erro interno do servidor",
            error: err.message 
        });
    }
});

// Rota para atualizar dados do usuário
app.put('/api/usuario/dados', checkSession, async (req, res) => {
    try {
        const { telefone, cpf, email } = req.body; // Adicione email aqui

        const pool = await getPool();
        await pool.request()
            .input('codUsuario', sql.Int, req.session.codUsuario)
            .input('telefone', sql.VarChar, telefone)
            .input('cpf', sql.VarChar, cpf)
            .input('email', sql.VarChar, email) // Adicione esta linha
            .query(`
                UPDATE USUARIOS 
                SET TELEFONE = @telefone, 
                    CPF = @cpf,
                    EMAIL = @email
                WHERE CODUSUARIO = @codUsuario
            `);

        res.json({ 
            success: true, 
            message: "Dados atualizados com sucesso"
        });
    } catch (err) {
        console.error("Erro ao atualizar dados do usuário:", err);
        res.status(500).json({ 
            success: false, 
            message: "Erro interno do servidor",
            error: err.message 
        });
    }
});

app.get('/chamados', checkSession, (req, res) => {
    const filePath = path.join(__dirname, '..', 'frontend', 'chamados', 'chamados.html');
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            console.error('Arquivo não encontrado:', filePath);
            return res.status(404).send('Página não encontrada');
        }
        res.sendFile(filePath);
    });
});

app.post('/api/admin/login', async (req, res) => {
    const { usuario, senha } = req.body;

    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('usuario', sql.VarChar, usuario)
            .input('senha', sql.VarChar, senha)
            .query("SELECT CODUSUARIO, ADMINISTRADOR FROM USUARIOS WHERE usuario = @usuario AND senha = @senha");

        if (result.recordset.length > 0 && result.recordset[0].ADMINISTRADOR === 1) {
            req.session.codUsuario = result.recordset[0].CODUSUARIO;
            req.session.admin = true;
            
            res.json({ 
                success: true,
                message: "Login administrativo bem-sucedido"
            });
        } else {
            res.status(401).json({ 
                success: false, 
                message: "Credenciais inválidas ou não tem permissão de administrador" 
            });
        }
    } catch (err) {
        console.error("Erro no login admin:", err);
        res.status(500).json({ 
            success: false, 
            message: "Erro interno do servidor",
            error: err.message 
        });
    }
});

app.get('/api/admin/check-auth', (req, res) => {
    if (req.session.codUsuario && req.session.admin) {
        res.json({ authenticated: true });
    } else {
        res.status(401).json({ authenticated: false });
    }
});

app.post('/api/admin/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Erro ao destruir sessão admin:', err);
            return res.status(500).json({ success: false, message: 'Erro ao fazer logout' });
        }
        res.clearCookie('connect.sid');
        res.json({ success: true, message: 'Logout realizado com sucesso' });
    });
});

app.get('/api/admin/chamados', checkAdminSession, async (req, res) => {
    try {
        const { status, urgencia, data, search } = req.query;
        const pool = await getPool();
        
        let query = `
            SELECT 
                c.ID,
                c.TITULO,
                c.DESCRICAO,
                c.TELEFONE,
                c.URGENCIA,
                tu.DESCRICAO AS DESC_URGENCIA,
                CASE 
                    WHEN c.IMAGEM IS NOT NULL THEN CONCAT('http://${HOST}:${PORT}/', c.IMAGEM)
                    ELSE NULL
                END AS IMAGEM_URL,
                c.STATUS,
                ts.DESCRICAO AS DESC_STATUS,
                FORMAT(c.DATACRIACAO, 'dd/MM/yyyy HH:mm') AS DATACRIACAO,
                FORMAT(c.DATACONCLUSAO, 'dd/MM/yyyy HH:mm') AS DATACONCLUSAO,
                c.USUARIOCRIACAO,
                uc.USUARIO AS NOME_CRIADOR,
                c.USUARIORESOLUCAO,
                ur.USUARIO AS NOME_RESOLVEDOR,
                c.RESOLUCAO
            FROM CHAMADO c
            LEFT JOIN TIPO_URGENCIA tu ON c.URGENCIA = tu.ID
            LEFT JOIN TIPO_STATUS ts ON c.STATUS = ts.ID
            LEFT JOIN USUARIOS uc ON c.USUARIOCRIACAO = uc.CODUSUARIO
            LEFT JOIN USUARIOS ur ON c.USUARIORESOLUCAO = ur.CODUSUARIO
        `;
        
        const conditions = [];
        const inputs = {};
        
        if (status) {
            conditions.push('c.STATUS = @status');
            inputs.status = parseInt(status);
        }
        
        if (urgencia) {
            conditions.push('c.URGENCIA = @urgencia');
            inputs.urgencia = parseInt(urgencia);
        }
        
        if (data) {
            conditions.push('CONVERT(DATE, c.DATACRIACAO) = CONVERT(DATE, @data)');
            inputs.data = data;
        }
        
        if (search) {
            conditions.push('(c.TITULO LIKE @search OR c.DESCRICAO LIKE @search OR uc.USUARIO LIKE @search)');
            inputs.search = `%${search}%`;
        }
        
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        
        query += ' ORDER BY c.DATACRIACAO DESC';
        
        const request = pool.request();
        for (const [key, value] of Object.entries(inputs)) {
            request.input(key, value);
        }
        
        const result = await request.query(query);
        
        res.json({ 
            success: true, 
            chamados: result.recordset 
        });
    } catch (err) {
        console.error("Erro ao buscar chamados admin:", err);
        res.status(500).json({ 
            success: false, 
            message: 'Erro ao buscar chamados',
            error: err.message 
        });
    }
});

app.put('/api/admin/chamados/:id', checkAdminSession, async (req, res) => {
    try {
        const { status, resolucao } = req.body;
        const chamadoId = req.params.id;
        const usuarioResolucao = req.session.codUsuario;
        
        const pool = await getPool();
        
        let query = `
            UPDATE CHAMADO 
            SET STATUS = @status,
                USUARIORESOLUCAO = @usuarioResolucao,
                DATACONCLUSAO = ${status === '3' ? 'GETDATE()' : 'NULL'}
        `;
        
        if (resolucao) {
            query += `, RESOLUCAO = @resolucao`;
        }
        
        query += ` WHERE ID = @chamadoId`;
        
        const request = pool.request()
            .input('status', sql.Int, parseInt(status))
            .input('usuarioResolucao', sql.BigInt, usuarioResolucao)
            .input('chamadoId', sql.Int, parseInt(chamadoId));
            
        if (resolucao) {
            request.input('resolucao', sql.Text, resolucao);
        }
        
        await request.query(query);
        
        res.json({ 
            success: true, 
            message: 'Chamado atualizado com sucesso'
        });
    } catch (err) {
        console.error("Erro ao atualizar chamado:", err);
        res.status(500).json({ 
            success: false, 
            message: 'Erro ao atualizar chamado',
            error: err.message 
        });
    }
});

async function checkAdminSession(req, res, next) {
    if (!req.session.codUsuario) {
        if (req.accepts('html')) {
            return res.redirect('/admin/admin-login.html');
        }
        return res.status(401).json({
            success: false, 
            message: "Não autenticado" 
        });
    }
    
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('codUsuario', sql.Int, req.session.codUsuario)
            .query("SELECT ADMINISTRADOR FROM USUARIOS WHERE CODUSUARIO = @codUsuario");

        if (result.recordset.length > 0 && result.recordset[0].ADMINISTRADOR === 1) {
            return next();
        } else {
            if (req.accepts('html')) {
                return res.redirect('/admin/admin-login.html');
            }
            return res.status(403).json({
                success: false, 
                message: "Acesso não autorizado" 
            });
        }
    } catch (err) {
        console.error("Erro ao verificar permissões de admin:", err);
        if (req.accepts('html')) {
            return res.redirect('/admin/admin-login.html');
        }
        return res.status(500).json({
            success: false, 
            message: "Erro ao verificar permissões" 
        });
    }
}

app.get('/api/admin/check-permissions', checkSession, async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('codUsuario', sql.Int, req.session.codUsuario)
            .query("SELECT ADMINISTRADOR FROM USUARIOS WHERE CODUSUARIO = @codUsuario");

        if (result.recordset.length > 0 && result.recordset[0].ADMINISTRADOR === 1) {
            res.json({ isAdmin: true });
        } else {
            res.json({ isAdmin: false });
        }
    } catch (err) {
        console.error("Erro ao verificar permissões:", err);
        res.status(500).json({ 
            success: false, 
            message: "Erro ao verificar permissões",
            error: err.message 
        });
    }
});

app.get('/api/admin/user-info', checkAdminSession, async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('codUsuario', sql.Int, req.session.codUsuario)
            .query(`
                SELECT 
                    NOME,
                    FOTO,
                    CASE 
                        WHEN FOTO IS NOT NULL THEN CONCAT('http://${HOST}:${PORT}/', REPLACE(FOTO, '\\', '/'))
                        ELSE NULL
                    END AS FOTO_URL
                FROM USUARIOS 
                WHERE CODUSUARIO = @codUsuario
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: "Administrador não encontrado" 
            });
        }

        res.json({ 
            success: true,
            usuario: result.recordset[0]
        });
    } catch (err) {
        console.error("Erro ao buscar dados do admin:", err);
        res.status(500).json({ 
            success: false, 
            message: "Erro interno do servidor",
            error: err.message 
        });
    }
});

app.post('/api/upload-photo', checkSession, upload.single('foto'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                message: "Nenhuma foto enviada" 
            });
        }

        const pool = await getPool();
        // Garante que o caminho está no formato correto para o banco de dados
        const fotoPath = `uploads\\${req.file.filename}`;
        
        await pool.request()
            .input('codUsuario', sql.Int, req.session.codUsuario)
            .input('foto', sql.VarChar, fotoPath)
            .query("UPDATE USUARIOS SET FOTO = @foto WHERE CODUSUARIO = @codUsuario");

        res.json({ 
            success: true,
            fotoUrl: `/uploads/${req.file.filename}?t=${new Date().getTime()}`,
            message: "Foto atualizada com sucesso"
        });
    } catch (err) {
        console.error("Erro ao atualizar foto:", err);
        
        if (req.file) {
            fs.unlink(req.file.path, () => {});
        }
        
        res.status(500).json({ 
            success: false, 
            message: "Erro ao atualizar foto",
            error: err.message 
        });
    }
});

// Rotas para gerenciamento de usuários (admin)
app.get('/api/admin/users', checkAdminSession, async (req, res) => {
    try {
        const { type, status, search } = req.query;
        const pool = await getPool();
        
        let query = `
            SELECT 
                CODUSUARIO AS ID,
                USUARIO,
                NOME,
                EMAIL,
                ADMINISTRADOR AS TIPO,
                CASE 
                    WHEN ADMINISTRADOR = 1 THEN 'Administrador'
                    WHEN ADMINISTRADOR = 2 THEN 'Técnico'
                    ELSE 'Usuário'
                END AS DESC_TIPO,
                STATUS,
                CASE 
                    WHEN STATUS = 0 THEN 'Ativo'
                    ELSE 'Inativo'
                END AS DESC_STATUS,
                FORMAT(DATA_CRIACAO, 'dd/MM/yyyy HH:mm') AS DATA_CRIACAO,
                FOTO,
                CASE 
                    WHEN FOTO IS NOT NULL THEN CONCAT('http://${HOST}:${PORT}/', REPLACE(FOTO, '\\', '/'))
                    ELSE NULL
                END AS FOTO_URL
            FROM USUARIOS
        `;
        
        const conditions = [];
        const inputs = {};
        
        if (type) {
            conditions.push('ADMINISTRADOR = @type');
            inputs.type = parseInt(type);
        }
        
        if (status) {
            conditions.push('STATUS = @status');  // Alterado para STATUS
            inputs.status = parseInt(status);
        }
        
        if (search) {
            conditions.push('(USUARIO LIKE @search OR NOME LIKE @search OR EMAIL LIKE @search)');
            inputs.search = `%${search}%`;
        }
        
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        
        query += ' ORDER BY NOME';
        
        const request = pool.request();
        for (const [key, value] of Object.entries(inputs)) {
            request.input(key, value);
        }
        
        const result = await request.query(query);
        
        res.json({ 
            success: true, 
            users: result.recordset 
        });
    } catch (err) {
        console.error("Erro ao buscar usuários:", err);
        res.status(500).json({ 
            success: false, 
            message: 'Erro ao buscar usuários',
            error: err.message 
        });
    }
});

app.post('/api/admin/users', checkAdminSession, upload.single('photo'), async (req, res) => {
    try {
        const { name, email, type } = req.body;
        const password = req.body.password || generateRandomPassword();
        const photoFile = req.file;
        
        if (!name || !email || !type) {
            if (photoFile) fs.unlink(photoFile.path, () => {});
            return res.status(400).json({ 
                success: false, 
                message: "Nome, e-mail e tipo são obrigatórios" 
            });
        }

        const pool = await getPool();
        
        // Verifica se o e-mail já existe
        const emailCheck = await pool.request()
            .input('email', sql.VarChar, email)
            .query("SELECT CODUSUARIO FROM USUARIOS WHERE EMAIL = @email");
        
        if (emailCheck.recordset.length > 0) {
            if (photoFile) fs.unlink(photoFile.path, () => {});
            return res.status(400).json({ 
                success: false, 
                message: "E-mail já cadastrado" 
            });
        }

        const photoPath = photoFile ? `uploads\\${photoFile.filename}` : null;

        const status = req.body.status || 0;
        
        const result = await pool.request()
            .input('usuario', sql.VarChar, email.split('@')[0])
            .input('nome', sql.VarChar, name)
            .input('email', sql.VarChar, email)
            .input('senha', sql.VarChar, password)
            .input('tipo', sql.Int, parseInt(type))
            .input('status', sql.Bit, parseInt(status) || 0)  // Corrigido aqui (estava usando type)
            .input('foto', sql.VarChar, photoPath)
            .query(`
                INSERT INTO USUARIOS 
                (USUARIO, NOME, EMAIL, SENHA, ADMINISTRADOR, STATUS, FOTO, DATA_CRIACAO) 
                VALUES (@usuario, @nome, @email, @senha, @tipo, @status, @foto, GETDATE());
                SELECT SCOPE_IDENTITY() AS ID;
            `);

        res.status(201).json({ 
            success: true, 
            message: 'Usuário criado com sucesso',
            userId: result.recordset[0].ID,
            photoUrl: photoPath ? `http://${HOST}:${PORT}/${photoPath.replace(/\\/g, '/')}` : null
        });

    } catch (err) {
        console.error("Erro ao criar usuário:", err);
        if (req.file) fs.unlink(req.file.path, () => {});
        res.status(500).json({ 
            success: false, 
            message: 'Erro ao criar usuário',
            error: err.message 
        });
    }
});

app.put('/api/admin/users/:id', checkAdminSession, upload.single('photo'), async (req, res) => {
    try {
        const userId = req.params.id;
        const { name, email, type, status } = req.body;
        const password = req.body.password;
        const photoFile = req.file;
        
        if (!name || !email || !type) {
            if (photoFile) fs.unlink(photoFile.path, () => {});
            return res.status(400).json({ 
                success: false, 
                message: "Nome, e-mail e tipo são obrigatórios" 
            });
        }

        const pool = await getPool();
        
        // Verifica se o usuário existe
        const userCheck = await pool.request()
            .input('id', sql.Int, userId)
            .query("SELECT CODUSUARIO, EMAIL FROM USUARIOS WHERE CODUSUARIO = @id");
        
        if (userCheck.recordset.length === 0) {
            if (photoFile) fs.unlink(photoFile.path, () => {});
            return res.status(404).json({ 
                success: false, 
                message: "Usuário não encontrado" 
            });
        }

        // Verifica se o e-mail já existe para outro usuário
        if (userCheck.recordset[0].EMAIL !== email) {
            const emailCheck = await pool.request()
                .input('email', sql.VarChar, email)
                .query("SELECT CODUSUARIO FROM USUARIOS WHERE EMAIL = @email");
            
            if (emailCheck.recordset.length > 0) {
                if (photoFile) fs.unlink(photoFile.path, () => {});
                return res.status(400).json({ 
                    success: false, 
                    message: "E-mail já cadastrado para outro usuário" 
                });
            }
        }

        // Obter foto atual para deletar se for substituída
        let oldPhotoPath = null;
        if (photoFile) {
            const currentPhoto = await pool.request()
                .input('id', sql.Int, userId)
                .query("SELECT FOTO FROM USUARIOS WHERE CODUSUARIO = @id");
            
            if (currentPhoto.recordset[0].FOTO) {
                oldPhotoPath = path.join(__dirname, '..', currentPhoto.recordset[0].FOTO);
            }
        }

        const photoPath = photoFile ? `uploads\\${photoFile.filename}` : null;
        
        let query = `
            UPDATE USUARIOS SET
                USUARIO = @usuario,
                NOME = @nome,
                EMAIL = @email,
                ADMINISTRADOR = @tipo,
                STATUS = @status
        `;
        
        if (password) {
            query += `, SENHA = @senha`;
        }
        
        if (photoPath) {
            query += `, FOTO = @foto`;
        }
        
        query += ` WHERE CODUSUARIO = @id`;
        
        const request = pool.request()
            .input('id', sql.Int, userId)
            .input('usuario', sql.VarChar, email.split('@')[0])
            .input('nome', sql.VarChar, name)
            .input('email', sql.VarChar, email)
            .input('tipo', sql.Int, parseInt(type))
            .input('status', sql.Bit, parseInt(status) || 1);
        
        if (password) {
            request.input('senha', sql.VarChar, password);
        }
        
        if (photoPath) {
            request.input('foto', sql.VarChar, photoPath);
        }
        
        await request.query(query);
        
        // Remove a foto antiga se foi substituída
        if (oldPhotoPath) {
            fs.unlink(oldPhotoPath, (err) => {
                if (err) console.error("Erro ao remover foto antiga:", err);
            });
        }

        res.json({ 
            success: true, 
            message: 'Usuário atualizado com sucesso',
            photoUrl: photoPath ? `http://${HOST}:${PORT}/${photoPath.replace(/\\/g, '/')}` : null
        });

    } catch (err) {
        console.error("Erro ao atualizar usuário:", err);
        if (req.file) fs.unlink(req.file.path, () => {});
        res.status(500).json({ 
            success: false, 
            message: 'Erro ao atualizar usuário',
            error: err.message 
        });
    }
});

app.delete('/api/admin/users/:id', checkAdminSession, async (req, res) => {
    try {
        const userId = req.params.id;
        const pool = await getPool();
        
        // Verifica se o usuário existe
        const userCheck = await pool.request()
            .input('id', sql.Int, userId)
            .query("SELECT FOTO FROM USUARIOS WHERE CODUSUARIO = @id");
        
        if (userCheck.recordset.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: "Usuário não encontrado" 
            });
        }

        // Obter foto para deletar
        let photoPath = null;
        if (userCheck.recordset[0].FOTO) {
            photoPath = path.join(__dirname, '..', userCheck.recordset[0].FOTO);
        }

        // Verificar se o usuário tem chamados associados
        const chamadosCheck = await pool.request()
        .input('id', sql.Int, userId)
        .query(`
            SELECT COUNT(*) AS total 
            FROM CHAMADO 
            WHERE USUARIOCRIACAO = @id OR USUARIORESOLUCAO = @id
        `);
        
        if (chamadosCheck.recordset[0].total > 0) {
            return res.status(400).json({ 
                success: false, 
                message: "Não é possível excluir usuário com chamados associados" 
            });
        }

        await pool.request()
            .input('id', sql.Int, userId)
            .query("DELETE FROM USUARIOS WHERE CODUSUARIO = @id");
        
        // Remove a foto se existir
        if (photoPath) {
            fs.unlink(photoPath, (err) => {
                if (err) console.error("Erro ao remover foto:", err);
            });
        }

        res.json({ 
            success: true, 
            message: 'Usuário excluído com sucesso'
        });

    } catch (err) {
        console.error("Erro ao excluir usuário:", err);
        res.status(500).json({ 
            success: false, 
            message: 'Erro ao excluir usuário',
            error: err.message 
        });
    }
});

// Função auxiliar para gerar senha aleatória
function generateRandomPassword() {
    const length = 8;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let password = "";
    for (let i = 0; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
}

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: err.message
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
  });