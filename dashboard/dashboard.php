<?php
session_start();

if (!isset($_SESSION['usuario_id'])) {
    header('Location: ../index.html');
    exit;
}
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Dashboard - Grupo Concresul</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css"/>
    <link rel="stylesheet" href="dashboard.css"/>
    <link rel="shortcut icon" href="../images/grupoconcresul.ico" type="image/x-icon"/>
</head>
<body>
    <nav class="nav-lateral">
        <div class="nav-header">
            <a href="dashboard.php">
                <h1>GRUPO<br>CONCRESUL</h1>
            </a>
            <button class="toggle-btn"><i class="fas fa-bars"></i></button>
        </div>
        <ul>
            <li><a href="#" class="active"><i class="fas fa-home"></i><span>Início</span></a></li>
            <li><a href="../chamados/chamados.html"><i class="fas fa-book"></i><span>Chamados</span></a></li>
        </ul>
    </nav>

    <header>
        <nav class="nav-principal">
            <h1><i class="fas fa-home"></i> Início</h1>
            <ul>
                <li class="perfil">
                    <button class="perfil-trigger">
                        <i class="fas fa-user"></i> Perfil <i class="fas fa-chevron-down"></i>
                    </button>
                    <ul class="submenu" id="submenu-perfil">
                        <li><a href="../dados-cadastrais/dados-cadastrais.html">Meus Dados</a></li>
                        <li><a href="../password/password.html">Redefinir Senha</a></li>
                        <li><a href="../utils/logout.php" id="logout-link">Sair</a></li>
                    </ul>
                </li>
            </ul>
        </nav>
    </header>

    <main class="container-chamado">
        <div id="message-container" role="alert"></div>
        <h2><i class="fas fa-plus-circle"></i> Abrir Novo Chamado</h2>
        <form class="form-chamado" id="formChamado" enctype="multipart/form-data">
            <div class="form-group titulo">
                <label for="titulo">Título*</label>
                <input type="text" id="titulo" name="titulo" required />
            </div>
            <div class="form-group descricao">
                <label for="descricao">Descrição*</label>
                <textarea id="descricao" name="descricao" rows="5" required></textarea>
            </div>
            <div class="form-group telefone">
                <label for="telefone">Telefone para Contato*</label>
                <input type="tel" id="telefone" name="telefone" required />
            </div>
            <div class="side-options">
                <fieldset class="form-group">
                    <legend>Urgência*</legend>
                    <div class="radio-group">
                        <label><input type="radio" name="urgencia" value="1" checked/> Baixa</label>
                        <label><input type="radio" name="urgencia" value="2" /> Média</label>
                        <label><input type="radio" name="urgencia" value="3" /> Alta</label>
                        <label><input type="radio" name="urgencia" value="4" /> Crítica</label>
                    </div>
                </fieldset>
                <div class="form-group">
                    <label for="imagem">Anexar Imagem (Opcional)</label>
                    <div class="file-upload">
                        <input type="file" id="imagem" name="imagem" accept="image/*" />
                        <label for="imagem" class="upload-btn"><i class="fas fa-cloud-upload-alt"></i> Selecione uma imagem</label>
                        <span id="file-name">Nenhum arquivo selecionado</span>
                    </div>
                </div>
                <button type="submit" class="btn-enviar"><i class="fas fa-paper-plane"></i> Enviar Chamado</button>
            </div>
        </form>
    </main>

    <script>
    document.addEventListener('DOMContentLoaded', function () {
        fetch('../check-session.php', { credentials: 'include' })
            .then(res => res.json())
            .then(data => {
                if (!data.loggedIn) {
                    window.location.href = '../index.html';
                }
            })
            .catch(() => {
                window.location.href = '../index.html';
            });

        document.getElementById('imagem').addEventListener('change', function () {
            const fileName = this.files.length > 0 ? this.files[0].name : 'Nenhum arquivo selecionado';
            document.getElementById('file-name').textContent = fileName;
        });

        document.getElementById('formChamado').addEventListener('submit', async function (e) {
            e.preventDefault();

            const form = document.getElementById('formChamado');
            const formData = new FormData(form);
            const messageContainer = document.getElementById('message-container');

            fetch('https://app.grupoconcresul.com.br/dashboard/create_chamado.php', {
                method: 'POST',
                credentials: 'include',
                body: formData
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    showMessage('Chamado enviado com sucesso!', 'sucesso');
                    form.reset();
                    document.getElementById('file-name').textContent = 'Nenhum arquivo selecionado';
                } else {
                    showMessage(data.message || 'Erro ao enviar chamado.', 'erro');
                }
            })
            .catch(() => {
                showMessage('Erro na comunicação com o servidor.', 'erro');
            });

            function showMessage(text, tipo) {
                messageContainer.innerHTML = `<div class="mensagem ${tipo}">${text}</div>`;
                setTimeout(() => {
                    messageContainer.innerHTML = '';
                }, 5000);
            }
        });

        const toggleBtn = document.querySelector('.toggle-btn');
        const navLateral = document.querySelector('.nav-lateral');

        toggleBtn?.addEventListener('click', function () {
            navLateral.classList.toggle('collapsed');
            this.setAttribute('aria-expanded', navLateral.classList.contains('collapsed') ? 'false' : 'true');
        });

        const perfilTrigger = document.querySelector('.perfil-trigger');
        const submenuPerfil = document.getElementById('submenu-perfil');

        perfilTrigger?.addEventListener('click', function (e) {
            e.stopPropagation();
            const isExpanded = this.getAttribute('aria-expanded') === 'true';
            this.setAttribute('aria-expanded', !isExpanded);
            submenuPerfil.classList.toggle('active', !isExpanded);
        });

        document.addEventListener('click', function (e) {
            if (!perfilTrigger.contains(e.target) && !submenuPerfil.contains(e.target)) {
                submenuPerfil.classList.remove('active');
                perfilTrigger.setAttribute('aria-expanded', 'false');
            }
        });

        submenuPerfil?.addEventListener('click', e => e.stopPropagation());
    });
    </script>
</body>
</html>