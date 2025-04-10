const API_BASE_URL = '';

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('redefinicao');
    const mensagemErro = document.getElementById('mensagem-erro');

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const senhaAtual = document.getElementById('senha').value;
        const novaSenha = document.getElementById('nova-senha').value;
        const confirmarSenha = document.getElementById('confirmar-senha').value;

        // Reset mensagens de erro
        mensagemErro.style.display = 'none';
        mensagemErro.textContent = '';

        // Validações básicas (mantenha as que você já tem)
        if (novaSenha !== confirmarSenha) {
            mostrarErro('As novas senhas não coincidem.');
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/redefinir-senha`, {  // Use caminho relativo
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    senhaAtual: senhaAtual,
                    novaSenha: novaSenha
                }),
                credentials: 'include' // Importante para manter a sessão
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Erro ao redefinir senha');
            }

            alert('Senha redefinida com sucesso!');
            window.location.href = 'index.html';
            
        } catch (error) {
            console.error('Erro na redefinição:', error);
            
            // Tratamento específico para erros de conexão com o banco
            if (error.message.includes("ECONNREFUSED") || 
                error.message.includes("Failed to connect")) {
                mostrarErro('Erro de conexão com o banco de dados. Tente novamente mais tarde.');
            } else {
                mostrarErro(error.message || 'Erro ao processar sua solicitação');
            }
            
            // Limpa os campos em caso de erro
            document.getElementById('senha').value = '';
            document.getElementById('nova-senha').value = '';
            document.getElementById('confirmar-senha').value = '';
        }
    });

    function mostrarErro(mensagem) {
        mensagemErro.textContent = mensagem;
        mensagemErro.style.display = 'block';
        mensagemErro.scrollIntoView({ behavior: 'smooth' });
    }
});