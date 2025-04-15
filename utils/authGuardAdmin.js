// authGuard.js - Deve ser incluído em todas as páginas protegidas
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('../check-session.php', {
            credentials: 'include'
        });

        const data = await response.json();

        if (!data.loggedIn) {
            window.location.href = '../admin/admin-login.html';
        }
    } catch (error) {
        console.error('Erro ao verificar sessão:', error);
        window.location.href = '../admin/admin-login.html';
    }
});
