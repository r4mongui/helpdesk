const API_BASE_URL = 'https://helpdesk-q2qd.onrender.com';

document.addEventListener('DOMContentLoaded', function() {
    // Elementos do DOM
    const form = document.getElementById('dadosForm');
    const fotoUsuario = document.getElementById('fotoUsuario');
    const uploadFoto = document.getElementById('uploadFoto');
    const nomeUsuario = document.getElementById('nomeUsuario');
    const cargoUsuario = document.getElementById('cargoUsuario');
    
    // Máscaras para os campos
    const telefoneInput = document.getElementById('telefone');
    const cpfInput = document.getElementById('cpf');

    // Aplicar máscaras
    telefoneInput.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 11) value = value.substring(0, 11);
        
        if (value.length > 0) {
            if (value.length <= 2) {
                value = `(${value}`;
            } else if (value.length <= 7) {
                value = `(${value.substring(0, 2)}) ${value.substring(2)}`;
            } else if (value.length <= 11) {
                value = `(${value.substring(0, 2)}) ${value.substring(2, 7)}-${value.substring(7)}`;
            }
        }
        
        e.target.value = value;
    });

    cpfInput.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 11) value = value.substring(0, 11);
        
        if (value.length > 0) {
            if (value.length <= 3) {
                value = value;
            } else if (value.length <= 6) {
                value = `${value.substring(0, 3)}.${value.substring(3)}`;
            } else if (value.length <= 9) {
                value = `${value.substring(0, 3)}.${value.substring(3, 6)}.${value.substring(6)}`;
            } else {
                value = `${value.substring(0, 3)}.${value.substring(3, 6)}.${value.substring(6, 9)}-${value.substring(9)}`;
            }
        }
        
        e.target.value = value;
    });

    async function carregarDadosUsuario() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/usuario/dados`, {
                method: 'GET',
                credentials: 'include'
            });
    
            if (!response.ok) {
                throw new Error('Erro ao carregar dados do usuário');
            }
    
            const data = await response.json();
            
            if (data.success) {
                // Preencher o formulário com os dados
                document.getElementById('usuario').value = data.usuario.USUARIO || '';
                document.getElementById('nome').value = data.usuario.NOME || '';
                document.getElementById('departamento').value = data.usuario.DEPARTAMENTO || '';
                document.getElementById('telefone').value = data.usuario.TELEFONE || '';
                document.getElementById('cpf').value = data.usuario.CPF || '';
                document.getElementById('email').value = data.usuario.EMAIL || '';
                
                // Preencher a área de foto e informações
                nomeUsuario.textContent = data.usuario.NOME || '';
                cargoUsuario.textContent = data.usuario.DEPARTAMENTO || '';
                
                if (data.usuario.FOTO_URL) {
                    // Adiciona um timestamp para evitar cache
                    fotoUsuario.src = data.usuario.FOTO_URL + '?t=' + new Date().getTime();
                } else {
                    // Se não tiver foto, mostra um placeholder com as iniciais
                    fotoUsuario.src = getAvatarPlaceholder(data.usuario.NOME);
                }
            } else {
                alert(data.message || 'Erro ao carregar dados');
            }
        } catch (error) {
            console.error('Erro:', error);
            alert('Erro ao carregar dados do usuário. Tente novamente mais tarde.');
        }
    }

    function getAvatarPlaceholder(nome) {
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 200;
        const ctx = canvas.getContext('2d');
        
        // Cor de fundo baseada no nome (para ser consistente)
        const colors = ['#4a90e2', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6'];
        const colorIndex = nome ? nome.charCodeAt(0) % colors.length : 0;
        
        // Desenha o fundo
        ctx.fillStyle = colors[colorIndex];
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Desenha as iniciais
        if (nome) {
            const initials = nome.split(' ').map(n => n[0]).join('').toUpperCase();
            ctx.font = 'bold 80px Arial';
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(initials.substring(0, 2), canvas.width/2, canvas.height/2);
        }
        
        return canvas.toDataURL();
    }

    uploadFoto.addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        if (file.size > 5 * 1024 * 1024) { // 5MB
            alert('A foto deve ter no máximo 5MB');
            return;
        }
        
        const formData = new FormData();
        formData.append('foto', file);
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/upload-photo`, {
                method: 'POST',
                credentials: 'include',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                fotoUsuario.src = data.fotoUrl;
                alert('Foto atualizada com sucesso!');
            } else {
                alert(data.message || 'Erro ao atualizar foto');
            }
        } catch (error) {
            console.error('Erro:', error);
            alert('Erro ao enviar foto. Tente novamente mais tarde.');
        }
    });

    // Enviar dados atualizados
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = {
            telefone: document.getElementById('telefone').value.replace(/\D/g, ''),
            cpf: document.getElementById('cpf').value.replace(/\D/g, ''),
            email: document.getElementById('email').value // Adicione esta linha
        };
    
        try {
            const response = await fetch(`${API_BASE_URL}/api/usuario/dados`, {
                method: 'PUT',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
    
            if (!response.ok) {
                const errorData = await response.json();
                console.error('Erro detalhado:', errorData);
                throw new Error(errorData.message || 'Erro ao atualizar dados');
            }
    
            const data = await response.json();
            
            if (data.success) {
                alert('Dados atualizados com sucesso!');
            } else {
                alert(data.message || 'Erro ao atualizar dados');
            }
        } catch (error) {
            console.error('Erro detalhado:', error);
            alert(error.message || 'Erro ao atualizar dados. Tente novamente mais tarde.');
        }
    });

    // Verificar autenticação ao carregar a página
    fetch(`${API_BASE_URL}/api/check-auth`, {
        credentials: 'include'
    })
    .then(response => {
        if (!response.ok) {
            window.location.href = 'index.html'; // Caminho corrigido
        } else {
            return response.json();
        }
    })
    .then(data => {
        if (!data.authenticated) {
            window.location.href = 'index.html'; // Caminho corrigido
        } else {
            carregarDadosUsuario();
        }
    })
    .catch(err => {
        console.error('Erro ao verificar autenticação:', err);
        window.location.href = 'index.html'; // Caminho corrigido
    });
});