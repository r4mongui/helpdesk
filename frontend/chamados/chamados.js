const API_BASE_URL = 'https://helpdesk-q2qd.onrender.com';

document.addEventListener('DOMContentLoaded', function() {
    // Cache de elementos DOM (mantido igual)
    const elements = {
        navLateral: document.querySelector('.nav-lateral'),
        toggleBtn: document.querySelector('.toggle-btn'),
        header: document.querySelector('header'),
        chamadosContainer: document.getElementById('chamadosContainer'),
        filterStatus: document.getElementById('filterStatus'),
        filterUrgency: document.getElementById('filterUrgency'),
        chamadoModal: document.getElementById('chamadoModal'),
        modalClose: document.getElementById('modalClose'),
        logoutLink: document.getElementById('logout-link'),
        chamadoDetalhes: document.getElementById('chamadoDetalhes'),
        perfilTrigger: document.querySelector('.perfil-trigger'),
        perfil: document.querySelector('.perfil'),
        refreshBtn: document.getElementById('refreshBtn')
    };

    // Verificação inicial de elementos
    if (!elements.navLateral || !elements.toggleBtn || !elements.header) {
        console.error('Elementos essenciais não encontrados');
        return;
    }

    // Função para atualizar posição do header
    function updateHeaderPosition() {
        elements.header.style.left = elements.navLateral.classList.contains('collapsed') 
            ? '60px' 
            : '260px';
    }

    // Função para alternar a barra lateral
    function toggleNavLateral(e) {
        if (e) e.stopPropagation();
        const isCollapsed = elements.navLateral.classList.toggle('collapsed');
        
        elements.toggleBtn.setAttribute('aria-expanded', !isCollapsed);
        
        const icon = elements.toggleBtn.querySelector('i');
        if (icon) {
            icon.classList.toggle('fa-bars');
            icon.classList.toggle('fa-bars');
        }
        
        updateHeaderPosition();
    }

    // Função para fechar todos os menus exceto o atual
    function closeAllMenus(except = null) {
        const menus = [elements.perfil];
        menus.forEach(menu => {
            if (!except || menu !== except) {
                menu.classList.remove('active');
                const submenu = menu.querySelector('.submenu');
                if (submenu) submenu.classList.remove('active');
            }
        });
    }

    // Verificação de autenticação
    async function checkAuth() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/check-auth`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            if (!data?.authenticated) {
                throw new Error('Usuário não autenticado');
            }
            
            // Carrega dados do usuário após autenticação
            await carregarDadosUsuario();
        } catch (error) {
            console.error('Erro na verificação de autenticação:', error);
            window.location.href = '/login/login.html';
        }
    }

    // Carregar dados do usuário
    async function carregarDadosUsuario() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/usuario/dados`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            if (data.success) {
                console.log('Dados do usuário carregados:', data.usuario);
            }
        } catch (error) {
            console.error('Falha ao carregar dados do usuário:', error);
        }
    }

    // Carregar chamados
    async function loadChamados(status = 'all', urgencia = 'all') {
        try {
            elements.chamadosContainer.innerHTML = '<div class="loading">Carregando chamados...</div>';
            
            const response = await fetch(`${API_BASE_URL}/api/chamados?status=${status}&urgencia=${urgencia}`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`Erro ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message || 'Erro ao carregar chamados');
            }
            
            if (data.chamados.length === 0) {
                elements.chamadosContainer.innerHTML = '<div class="no-chamados">Nenhum chamado encontrado</div>';
                return;
            }
            
            // Verifica se os chamados têm a propriedade RESOLUCAO
            console.log('Chamados carregados:', data.chamados);
            renderChamados(data.chamados);
        } catch (error) {
            console.error('Erro:', error);
            elements.chamadosContainer.innerHTML = `
                <div class="error">
                    <i class="fas fa-exclamation-triangle"></i>
                    ${error.message}
                </div>
            `;
        }
    }

    async function refreshChamados() {
        try {
            // Mostra ícone de loading no botão
            elements.refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            
            // Recarrega os chamados com os filtros atuais
            const status = elements.filterStatus.value;
            const urgencia = elements.filterUrgency.value;
            await loadChamados(status, urgencia);
            
        } finally {
            // Restaura o ícone original
            elements.refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Atualizar';
        }
    }

    function renderChamados(chamados) {
        elements.chamadosContainer.innerHTML = '';
        
        chamados.forEach(chamado => {
            const chamadoCard = document.createElement('div');
            chamadoCard.className = 'chamado-card';
            chamadoCard.dataset.id = chamado.ID;
            
            // Adiciona ícone de check se o chamado foi resolvido
            const resolvidoIcon = chamado.STATUS == 3 ? '<i class="fas fa-check-circle resolved-icon"></i>' : '';
            
            chamadoCard.innerHTML = `
                <div class="chamado-header">
                    <div class="chamado-title">${resolvidoIcon}${chamado.TITULO}</div>
                    <div class="chamado-status status-${chamado.STATUS}">${chamado.DESC_STATUS}</div>
                </div>
                <div class="chamado-descricao">${chamado.DESCRICAO.substring(0, 100)}${chamado.DESCRICAO.length > 100 ? '...' : ''}</div>
                <div class="chamado-meta">
                    <span><i class="fas fa-clock"></i> ${chamado.DATACRIACAO}</span>
                    <span><i class="fas fa-exclamation-triangle"></i> ${chamado.DESC_URGENCIA}</span>
                </div>
            `;
            
            chamadoCard.addEventListener('click', () => openChamadoModal(chamado));
            elements.chamadosContainer.appendChild(chamadoCard);
        });
    }

    // Abrir modal com detalhes do chamado
    function openChamadoModal(chamado) {
        console.log('Dados completos do chamado:', chamado);
        // Usa as datas já formatadas pelo servidor
        const dataFormatada = chamado.DATACRIACAO;
        const dataConclusao = chamado.DATACONCLUSAO || 'Não concluído';
        
        let imagemHTML = '';
        if (chamado.IMAGEM_URL) {
            imagemHTML = `
                <div class="chamado-imagem-container">
                    <h3>Imagem anexada:</h3>
                    <img src="${chamado.IMAGEM_URL}" alt="Imagem do chamado" class="chamado-imagem"
                         onerror="this.style.display='none'; this.parentElement.querySelector('h3').style.display='none'">
                </div>
            `;
        }
    
        // Adiciona a seção de resolução se existir
        let resolucaoHTML = '';
        if (chamado.RESOLUCAO) {
            resolucaoHTML = `
                <div class="chamado-resolucao">
                    <h3><i class="fas fa-check-circle"></i> Resolução</h3>
                    <p>${chamado.RESOLUCAO}</p>
                    ${chamado.NOME_RESOLVEDOR ? `
                        <p class="resolucao-info">Resolvido por: ${chamado.NOME_RESOLVEDOR} em ${dataConclusao}</p>
                    ` : ''}
                </div>
            `;
        }
        
        elements.chamadoDetalhes.innerHTML = `
            <h2>${chamado.TITULO || 'Sem título'}</h2>
            <div class="chamado-info">
                <p><strong>Status:</strong> ${chamado.DESC_STATUS || 'Não informado'}</p>
                <p><strong>Urgência:</strong> ${chamado.DESC_URGENCIA || 'Não informado'}</p>
                <p><strong>Data de abertura:</strong> ${dataFormatada}</p>
                <p><strong>Data de conclusão:</strong> ${dataConclusao}</p>
                <p><strong>Telefone para contato:</strong> ${chamado.TELEFONE || 'Não informado'}</p>
            </div>
            <div class="chamado-descricao-completa">
                <h3>Resolução:</h3>
                <p>${chamado.DESCRICAO || 'Nenhuma descrição fornecida'}</p>
            </div>
            ${imagemHTML}
            ${resolucaoHTML}
        `;
        
        elements.chamadoModal.classList.add('active');
    }

    // Fechar modal
    function closeModal() {
        elements.chamadoModal.classList.remove('active');
    }

    // Logout
    async function handleLogout() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/logout`, {
                method: 'POST',
                credentials: 'include'
            });

            if (response.ok) {
                window.location.href = '/login/login.html';
            } else {
                console.warn('Falha ao fazer logout, redirecionando...');
                window.location.href = '/login/login.html';
            }
        } catch (error) {
            console.error('Erro ao fazer logout:', error);
            window.location.href = '/login/login.html';
        }
    }

    // Configurar eventos
    function setupEventListeners() {
        // Menu lateral
        elements.toggleBtn.addEventListener('click', toggleNavLateral);
        
        // Menu de perfil
        if (elements.perfilTrigger && elements.perfil) {
            elements.perfilTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                elements.perfil.classList.toggle('active');
                const submenu = elements.perfil.querySelector('.submenu');
                if (submenu) submenu.classList.toggle('active');
                closeAllMenus(elements.perfil);
            });
        }
        
        // Filtros
        elements.filterStatus.addEventListener('change', function() {
            const status = this.value;
            const urgencia = elements.filterUrgency.value;
            loadChamados(status, urgencia);
        });
        
        elements.filterUrgency.addEventListener('change', function() {
            const urgencia = this.value;
            const status = elements.filterStatus.value;
            loadChamados(status, urgencia);
        });
        
        // Modal
        elements.modalClose.addEventListener('click', closeModal);
        elements.chamadoModal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeModal();
            }
        });
        
        // Logout
        elements.logoutLink.addEventListener('click', function(e) {
            e.preventDefault();
            handleLogout();
        });
        
        // Fechar menus ao clicar fora
        document.addEventListener('click', () => closeAllMenus());

        elements.refreshBtn.addEventListener('click', refreshChamados);
    }

    // Inicialização
    async function init() {
        setupEventListeners();
        await checkAuth();
        await loadChamados();
        updateHeaderPosition();
    }

    init();
});