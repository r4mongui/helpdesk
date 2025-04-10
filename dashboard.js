const API_BASE_URL = 'https://helpdesk-q2qd.onrender.com';

document.addEventListener('DOMContentLoaded', function() {
    // Elementos DOM
    const elements = {
        toggleBtn: document.querySelector('.toggle-btn'),
        navLateral: document.querySelector('.nav-lateral'),
        header: document.querySelector('header'),
        perfilTrigger: document.querySelector('.perfil-trigger'),
        avisosTrigger: document.querySelector('.avisos-trigger'),
        perfilMenu: document.querySelector('.perfil'),
        avisosMenu: document.querySelector('.avisos')
    };

    // Elementos de notificação
    const notificationElements = {
        container: document.getElementById('notifications-container'),
        badge: document.getElementById('notification-badge'),
        markAllReadBtn: document.getElementById('mark-all-read'),
        submenu: document.getElementById('submenu-avisos')
    };

    let notifications = [];
    let notificationSocket = null;

    // Inicialização
    verificarAutenticacao();
    setupMenuNavigation();
    initNotificationSystem();

    // Funções de navegação do menu
    function toggleMenu(menuElement, e) {
        if (e) e.stopPropagation();
        
        // Verifica se o menu já está aberto
        const isActive = menuElement.classList.contains('active');
        
        // Fecha todos os menus primeiro
        closeAllMenus();
        
        // Se não estava ativo, abre o menu clicado
        if (!isActive) {
            menuElement.classList.add('active');
            const submenu = menuElement.querySelector('.submenu, .submenu-avisos');
            const trigger = menuElement.querySelector('[aria-expanded]');
            
            if (submenu) submenu.classList.add('active');
            if (trigger) trigger.setAttribute('aria-expanded', 'true');
        }
    }

    // Função modificada para closeAllMenus
    function closeAllMenus() {
        document.querySelectorAll('.perfil, .avisos').forEach(item => {
            item.classList.remove('active');
            const submenu = item.querySelector('.submenu, .submenu-avisos');
            const trigger = item.querySelector('[aria-expanded]');
            
            if (submenu) submenu.classList.remove('active');
            if (trigger) trigger.setAttribute('aria-expanded', 'false');
        });
    }

    // Configuração de eventos modificada
    function setupMenuNavigation() {
        updateHeaderPosition();

        // Toggle do menu lateral
        if (elements.toggleBtn) {
            elements.toggleBtn.addEventListener('click', toggleNavLateral);
        }

        // Toggle do menu de perfil
        if (elements.perfilTrigger && elements.perfilMenu) {
            elements.perfilTrigger.addEventListener('click', (e) => {
                toggleMenu(elements.perfilMenu, e);
            });
        }

        // Toggle do menu de notificações
        if (elements.avisosTrigger && elements.avisosMenu) {
            elements.avisosTrigger.addEventListener('click', (e) => {
                toggleMenu(elements.avisosMenu, e);
            });
        }

        // Fechar menus ao clicar fora
        document.addEventListener('click', closeAllMenus);

        // Prevenir fechamento ao clicar dentro do menu
        if (elements.perfilMenu) {
            elements.perfilMenu.addEventListener('click', (e) => e.stopPropagation());
        }
        
        if (elements.avisosMenu) {
            elements.avisosMenu.addEventListener('click', (e) => e.stopPropagation());
        }
    }

    function toggleNavLateral(e) {
        if (e) e.stopPropagation();
        elements.navLateral.classList.toggle('collapsed');
        elements.toggleBtn.setAttribute('aria-expanded', 
            !elements.navLateral.classList.contains('collapsed'));
        updateHeaderPosition();
    }

    function updateHeaderPosition() {
        if (elements.header) {
            elements.header.style.left = elements.navLateral.classList.contains('collapsed') 
                ? '60px' 
                : '260px';
        }
    }

    function toggleMenu(menuElement, e) {
        if (e) e.stopPropagation();

        const isActive = menuElement.classList.contains('active');

        closeAllMenus();

        if (!isActive) {
            menuElement.classList.add('active');
            const submenu = menuElement.querySelector('.submenu, .submenu-avisos');
            const trigger = menuElement.querySelector('[aria-expanded]');
            
            if (submenu) submenu.classList.add('active');
            if (trigger) trigger.setAttribute('aria-expanded', 'true');
        }
    }

    function closeAllMenus() {
        document.querySelectorAll('.perfil, .avisos').forEach(item => {
            item.classList.remove('active');
            const submenu = item.querySelector('.submenu, .submenu-avisos');
            const trigger = item.querySelector('[aria-expanded]');
            
            if (submenu) submenu.classList.remove('active');
            if (trigger) trigger.setAttribute('aria-expanded', 'false');
        });
    }

    // Verificação de autenticação
    async function verificarAutenticacao() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/check-auth`, {
                credentials: 'include'
            });
            
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const data = await response.json();
            if (!data?.authenticated) throw new Error('Usuário não autenticado');
            
        } catch (error) {
            console.error('Falha na verificação de autenticação:', error);
            window.location.href = 'login.html';
        }
    }

    // Fechar WebSocket quando a página for fechada
    window.addEventListener('beforeunload', function() {
        if (notificationSocket && notificationSocket.readyState === WebSocket.OPEN) {
            notificationSocket.close();
        }
    });
});