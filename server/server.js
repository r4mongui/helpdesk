const express = require('express');
const path = require('path');
const session = require('express-session');
const cors = require('cors');
const multer = require('multer');
const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config({ path: 'config.env' });

// Configuração do banco de dados MySQL
const pool = mysql.createPool({
    host: 'interchange.proxy.rlwy.net',
    port: 19905,
    user: 'root',
    password: 'dvyGvZfypklSjbzhNuqytVtTfERErqyR',
    database: 'railway',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  (async () => {
    try {
      const conn = await pool.getConnection();
      const [rows] = await conn.query('SELECT 1');
      console.log('✅ MySQL está respondendo!');
      conn.release();
    } catch (error) {
      console.error('Erro ao conectar ao MySQL:', error);
    }
  })();

// Testar conexão
pool.getConnection()
    .then(conn => {
        console.log('✅ Conectado ao banco MySQL');
        conn.release();
    })
    .catch(err => {
        console.error('Erro ao conectar ao MySQL:', err);
        process.exit(1);
    });

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

// 1. Configuração básica do Express
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Configuração de CORS
app.use(cors({
    origin: ['https://app.grupoconcresul.com.br', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// 3. Configuração de sessão (usando store MySQL)
const MySQLStore = require('express-mysql-session')(session);
const sessionStore = new MySQLStore({}, pool);

app.use(session({
    secret: 'grupo_concresul',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true, // precisa ser true para produção (https)
      httpOnly: true,
      sameSite: 'none', // isso é ESSENCIAL para cookies cross-domain
      maxAge: 24 * 60 * 60 * 1000
    }
  }));

// 4. Middleware para servir arquivos estáticos
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

// 5. Configurar rotas estáticas
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

// 6. Rotas principais
app.get('/', (req, res) => {
    const filePath = path.join(__dirname, '..', 'frontend', 'login', 'login.html');
    
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

// Middleware para verificar sessão
function checkSession(req, res, next) {
    if (!req.session.codUsuario) {
        if (req.accepts('html')) {
            return res.redirect('/login');
        }
        return res.status(401).json({
            success: false, 
            message: "Não autenticado" 
        });
    }
    next();
}

// Middleware para verificar sessão de admin
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
        const [rows] = await pool.query(
            "SELECT ADMINISTRADOR FROM USUARIOS WHERE CODUSUARIO = ?", 
            [req.session.codUsuario]
        );

        if (rows.length > 0 && rows[0].ADMINISTRADOR === 1) {
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
        const [rows] = await pool.query(
            "SELECT CODUSUARIO FROM USUARIOS WHERE usuario = ? AND senha = ?", 
            [usuario, senha]
        );

        if (rows.length > 0) {
            req.session.codUsuario = rows[0].CODUSUARIO;
            
            req.session.save(err => {
                if (err) {
                    console.error("Erro ao salvar sessão:", err);
                    return res.status(500).json({ 
                        success: false, 
                        message: "Erro interno no servidor" 
                    });
                }
                res.json({ 
                    success: true,
                    message: "Login bem-sucedido"
                });
            });
        } else {
            res.status(401).json({ 
                success: false, 
                message: "Usuário ou senha incorretos" 
            });
        }
    } catch (err) {
        console.error("Erro no login:", err);
        res.status(500).json({ 
            success: false, 
            message: "Erro interno do servidor",
            error: err.message 
        });
    }
});

app.get('/api/usuarios', checkSession, async (req, res) => {
    try {
      const [rows] = await pool.query('SELECT * FROM USUARIOS');
      res.json({ success: true, usuarios: rows });
    } catch (err) {
      console.error("Erro ao buscar usuários:", err);
      res.status(500).json({ success: false, message: "Erro ao buscar usuários" });
    }
  });

app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Erro ao destruir sessão:', err);
            return res.status(500).json({ success: false, message: 'Erro ao fazer logout' });
        }
        res.clearCookie('connect.sid');
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
        const codUsuario = req.session.codUsuario;

        const [userRows] = await pool.query(
            "SELECT senha FROM USUARIOS WHERE CODUSUARIO = ?", 
            [codUsuario]
        );
        
        if (userRows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: "Usuário não encontrado"
            });
        }

        const senhaAtualNoBanco = userRows[0].senha;

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

        await pool.query(
            "UPDATE USUARIOS SET senha = ? WHERE CODUSUARIO = ?", 
            [novaSenha, codUsuario]
        );

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

        const [result] = await pool.query(
            `INSERT INTO CHAMADO 
            (TITULO, DESCRICAO, TELEFONE, URGENCIA, IMAGEM, STATUS, DATACRIACAO, USUARIOCRIACAO) 
            VALUES (?, ?, ?, ?, ?, 1, NOW(), ?)`,
            [titulo, descricao, telefone, parseInt(urgencia), imagemPath, usuarioCriacao]
        );

        res.status(201).json({ 
            success: true, 
            message: 'Chamado criado com sucesso',
            chamadoId: result.insertId,
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
        const codUsuario = req.session.codUsuario;
        
        const [rows] = await pool.query(`
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
                DATE_FORMAT(c.DATACRIACAO, '%d/%m/%Y %H:%i') AS DATACRIACAO,
                DATE_FORMAT(c.DATACONCLUSAO, '%d/%m/%Y %H:%i') AS DATACONCLUSAO,
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
            WHERE c.USUARIOCRIACAO = ?
            ORDER BY c.DATACRIACAO DESC
        `, [codUsuario]);

        res.json({ 
            success: true, 
            chamados: rows 
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
        const [rows] = await pool.query("SELECT * FROM TIPO_URGENCIA");
        res.json({ 
            success: true, 
            tipos: rows 
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
        const [rows] = await pool.query("SELECT * FROM TIPO_STATUS");
        res.json({ 
            success: true, 
            tipos: rows 
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
        const codUsuario = req.session.codUsuario;
        
        const [rows] = await pool.query(`
            SELECT 
                USUARIO, 
                NOME, 
                DEPARTAMENTO, 
                TELEFONE, 
                EMAIL,
                CPF,
                FOTO,
                CASE 
                    WHEN FOTO IS NOT NULL THEN CONCAT('http://${HOST}:${PORT}/', REPLACE(FOTO, '\\\\', '/'))
                    ELSE NULL
                END AS FOTO_URL
            FROM USUARIOS 
            WHERE CODUSUARIO = ?
        `, [codUsuario]);

        if (rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: "Usuário não encontrado" 
            });
        }

        res.json({ 
            success: true, 
            usuario: rows[0] 
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
        const { telefone, cpf, email } = req.body;

        await pool.query(
            `UPDATE USUARIOS 
            SET TELEFONE = ?, 
                CPF = ?,
                EMAIL = ?
            WHERE CODUSUARIO = ?`,
            [telefone, cpf, email, req.session.codUsuario]
        );

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

// Rota de login administrativo
app.post('/api/admin/login', async (req, res) => {
    const { usuario, senha } = req.body;

    try {
        const [rows] = await pool.query(
            "SELECT CODUSUARIO, ADMINISTRADOR FROM USUARIOS WHERE usuario = ? AND senha = ?", 
            [usuario, senha]
        );

        if (rows.length > 0 && rows[0].ADMINISTRADOR === 1) {
            req.session.codUsuario = rows[0].CODUSUARIO;
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

// Rota para listar chamados (admin)
app.get('/api/admin/chamados', checkAdminSession, async (req, res) => {
    try {
        const { status, urgencia, data, search } = req.query;
        
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
                DATE_FORMAT(c.DATACRIACAO, '%d/%m/%Y %H:%i') AS DATACRIACAO,
                DATE_FORMAT(c.DATACONCLUSAO, '%d/%m/%Y %H:%i') AS DATACONCLUSAO,
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
        const params = [];
        
        if (status) {
            conditions.push('c.STATUS = ?');
            params.push(parseInt(status));
        }
        
        if (urgencia) {
            conditions.push('c.URGENCIA = ?');
            params.push(parseInt(urgencia));
        }
        
        if (data) {
            conditions.push('DATE(c.DATACRIACAO) = DATE(?)');
            params.push(data);
        }
        
        if (search) {
            conditions.push('(c.TITULO LIKE ? OR c.DESCRICAO LIKE ? OR uc.USUARIO LIKE ?)');
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        
        query += ' ORDER BY c.DATACRIACAO DESC';
        
        const [rows] = await pool.query(query, params);
        
        res.json({ 
            success: true, 
            chamados: rows 
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

// Rota para atualizar chamados (admin)
app.put('/api/admin/chamados/:id', checkAdminSession, async (req, res) => {
    try {
        const { status, resolucao } = req.body;
        const chamadoId = req.params.id;
        const usuarioResolucao = req.session.codUsuario;
        
        let query = `
            UPDATE CHAMADO 
            SET STATUS = ?,
                USUARIORESOLUCAO = ?,
                DATACONCLUSAO = ${status === '3' ? 'NOW()' : 'NULL'}
        `;
        
        const params = [parseInt(status), usuarioResolucao];
        
        if (resolucao) {
            query += `, RESOLUCAO = ?`;
            params.push(resolucao);
        }
        
        query += ` WHERE ID = ?`;
        params.push(parseInt(chamadoId));
        
        await pool.query(query, params);
        
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

// Rota para verificar permissões
app.get('/api/admin/check-permissions', checkSession, async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT ADMINISTRADOR FROM USUARIOS WHERE CODUSUARIO = ?", 
            [req.session.codUsuario]
        );

        if (rows.length > 0 && rows[0].ADMINISTRADOR === 1) {
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

// Rota para obter informações do admin
app.get('/api/admin/user-info', checkAdminSession, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                NOME,
                FOTO,
                CASE 
                    WHEN FOTO IS NOT NULL THEN CONCAT('http://${HOST}:${PORT}/', REPLACE(FOTO, '\\\\', '/'))
                    ELSE NULL
                END AS FOTO_URL
            FROM USUARIOS 
            WHERE CODUSUARIO = ?
        `, [req.session.codUsuario]);

        if (rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: "Administrador não encontrado" 
            });
        }

        res.json({ 
            success: true,
            usuario: rows[0]
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

// Rota para upload de foto
app.post('/api/upload-photo', checkSession, upload.single('foto'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                message: "Nenhuma foto enviada" 
            });
        }

        const fotoPath = `uploads/${req.file.filename}`;
        
        await pool.query(
            "UPDATE USUARIOS SET FOTO = ? WHERE CODUSUARIO = ?",
            [fotoPath, req.session.codUsuario]
        );

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
                DATE_FORMAT(DATA_CRIACAO, '%d/%m/%Y %H:%i') AS DATA_CRIACAO,
                FOTO,
                CASE 
                    WHEN FOTO IS NOT NULL THEN CONCAT('http://${HOST}:${PORT}/', REPLACE(FOTO, '\\\\', '/'))
                    ELSE NULL
                END AS FOTO_URL
            FROM USUARIOS
        `;
        
        const conditions = [];
        const params = [];
        
        if (type) {
            conditions.push('ADMINISTRADOR = ?');
            params.push(parseInt(type));
        }
        
        if (status) {
            conditions.push('STATUS = ?');
            params.push(parseInt(status));
        }
        
        if (search) {
            conditions.push('(USUARIO LIKE ? OR NOME LIKE ? OR EMAIL LIKE ?)');
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        
        query += ' ORDER BY NOME';
        
        const [rows] = await pool.query(query, params);
        
        res.json({ 
            success: true, 
            users: rows 
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
        
        // Verifica se o e-mail já existe
        const [emailCheck] = await pool.query(
            "SELECT CODUSUARIO FROM USUARIOS WHERE EMAIL = ?", 
            [email]
        );
        
        if (emailCheck.length > 0) {
            if (photoFile) fs.unlink(photoFile.path, () => {});
            return res.status(400).json({ 
                success: false, 
                message: "E-mail já cadastrado" 
            });
        }

        const photoPath = photoFile ? `uploads/${photoFile.filename}` : null;
        const status = req.body.status || 0;
        
        const [result] = await pool.query(
            `INSERT INTO USUARIOS 
            (USUARIO, NOME, EMAIL, SENHA, ADMINISTRADOR, STATUS, FOTO, DATA_CRIACAO) 
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
            [email.split('@')[0], name, email, password, parseInt(type), parseInt(status) || 0, photoPath]
        );

        res.status(201).json({ 
            success: true, 
            message: 'Usuário criado com sucesso',
            userId: result.insertId,
            photoUrl: photoPath ? `http://${HOST}:${PORT}/${photoPath}` : null
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

        // Verifica se o usuário existe
        const [userCheck] = await pool.query(
            "SELECT CODUSUARIO, EMAIL, FOTO FROM USUARIOS WHERE CODUSUARIO = ?", 
            [userId]
        );
        
        if (userCheck.length === 0) {
            if (photoFile) fs.unlink(photoFile.path, () => {});
            return res.status(404).json({ 
                success: false, 
                message: "Usuário não encontrado" 
            });
        }

        // Verifica se o e-mail já existe para outro usuário
        if (userCheck[0].EMAIL !== email) {
            const [emailCheck] = await pool.query(
                "SELECT CODUSUARIO FROM USUARIOS WHERE EMAIL = ?", 
                [email]
            );
            
            if (emailCheck.length > 0) {
                if (photoFile) fs.unlink(photoFile.path, () => {});
                return res.status(400).json({ 
                    success: false, 
                    message: "E-mail já cadastrado para outro usuário" 
                });
            }
        }

        // Obter foto atual para deletar se for substituída
        let oldPhotoPath = null;
        if (photoFile && userCheck[0].FOTO) {
            oldPhotoPath = path.join(__dirname, '..', userCheck[0].FOTO);
        }

        const photoPath = photoFile ? `uploads/${photoFile.filename}` : null;
        
        let query = `
            UPDATE USUARIOS SET
                USUARIO = ?,
                NOME = ?,
                EMAIL = ?,
                ADMINISTRADOR = ?,
                STATUS = ?
        `;
        
        const params = [
            email.split('@')[0], 
            name, 
            email, 
            parseInt(type), 
            parseInt(status) || 1
        ];
        
        if (password) {
            query += `, SENHA = ?`;
            params.push(password);
        }
        
        if (photoPath) {
            query += `, FOTO = ?`;
            params.push(photoPath);
        }
        
        query += ` WHERE CODUSUARIO = ?`;
        params.push(userId);
        
        await pool.query(query, params);
        
        // Remove a foto antiga se foi substituída
        if (oldPhotoPath) {
            fs.unlink(oldPhotoPath, (err) => {
                if (err) console.error("Erro ao remover foto antiga:", err);
            });
        }

        res.json({ 
            success: true, 
            message: 'Usuário atualizado com sucesso',
            photoUrl: photoPath ? `http://${HOST}:${PORT}/${photoPath}` : null
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
        
        // Verifica se o usuário existe
        const [userCheck] = await pool.query(
            "SELECT FOTO FROM USUARIOS WHERE CODUSUARIO = ?", 
            [userId]
        );
        
        if (userCheck.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: "Usuário não encontrado" 
            });
        }

        // Obter foto para deletar
        let photoPath = null;
        if (userCheck[0].FOTO) {
            photoPath = path.join(__dirname, '..', userCheck[0].FOTO);
        }

        // Verificar se o usuário tem chamados associados
        const [chamadosCheck] = await pool.query(
            `SELECT COUNT(*) AS total 
            FROM CHAMADO 
            WHERE USUARIOCRIACAO = ? OR USUARIORESOLUCAO = ?`,
            [userId, userId]
        );
        
        if (chamadosCheck[0].total > 0) {
            return res.status(400).json({ 
                success: false, 
                message: "Não é possível excluir usuário com chamados associados" 
            });
        }

        await pool.query(
            "DELETE FROM USUARIOS WHERE CODUSUARIO = ?", 
            [userId]
        );
        
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

// Middleware de erro
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