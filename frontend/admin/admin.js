const API_BASE_URL = 'https://helpdesk-q2qd.onrender.com'

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loginForm') ? initLoginPage() : initAdminPage();
});

// Login Page Functions
async function initLoginPage() {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');
    
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const { username, password } = e.target.elements;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    usuario: username.value,
                    senha: password.value
                })
            });
            
            const data = await response.json();
            
            data.success 
                ? window.location.href = '/admin/admin.html'
                : errorMessage.textContent = data.message || 'Credenciais inválidas ou sem permissão de administrador';
        } catch (error) {
            console.error('Erro no login:', error);
            errorMessage.textContent = 'Erro ao conectar com o servidor';
        }
    });
}

// Admin Page Functions
async function initAdminPage() {
    try {
        const [authResponse, permResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/api/admin/check-auth`),
            fetch(`${API_BASE_URL}/api/admin/check-permissions`)
        ]);
        
        const [authData, permData] = await Promise.all([
            authResponse.json(),
            permResponse.json()
        ]);
        
        if (!authData.authenticated) {
            return redirectToLogin();
        }
        
        if (!permData.isAdmin) {
            alert('Você não tem permissão para acessar esta área');
            return window.location.href = '/';
        }
    } catch (error) {
        console.error('Erro ao verificar permissões:', error);
        return redirectToLogin();
    }

    await loadAdminInfo();
    setupAdminPage();
}

function redirectToLogin() {
    window.location.href = '/admin/admin-login.html';
}

async function loadAdminInfo() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/user-info`);
        const { success, usuario } = await response.json();
        
        if (success) {
            const adminPhoto = document.getElementById('adminPhoto');
            const adminName = document.getElementById('adminName');
            
            adminName.textContent = usuario.NOME || 'Administrador';
            adminPhoto.src = usuario.FOTO_URL 
                ? `${usuario.FOTO_URL}?t=${Date.now()}`
                : generateAvatar(usuario.NOME);
            
            adminPhoto.onerror = () => {
                adminPhoto.src = generateAvatar(usuario.NOME);
            };
        }
    } catch (error) {
        console.error('Erro ao carregar informações do admin:', error);
    }
}

function generateAvatar(name) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 100;
    const ctx = canvas.getContext('2d');
    
    const colors = ['#4a90e2', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6'];
    const hash = name ? [...name].reduce((acc, char) => char.charCodeAt(0) + acc, 0) : 0;
    
    ctx.fillStyle = colors[hash % colors.length];
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (name) {
        const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
        ctx.font = 'bold 40px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(initials, canvas.width/2, canvas.height/2);
    }
    
    return canvas.toDataURL();
}

function setupAdminPage() {
    const elements = {
        logoutBtn: document.getElementById('logoutBtn'),
        chamadosTable: document.getElementById('chamadosTable').querySelector('tbody'),
        statusFilter: document.getElementById('statusFilter'),
        urgencyFilter: document.getElementById('urgencyFilter'),
        dateFilter: document.getElementById('dateFilter'),
        searchFilter: document.getElementById('searchFilter'),
        modal: document.getElementById('chamadoModal'),
        closeModalBtn: document.getElementById('closeModal'),
        saveBtn: document.getElementById('saveBtn'),
        statusSelect: document.getElementById('modalStatus')
    };

    let chamados = [];
    let currentChamadoId = null;

    // Event Listeners
    elements.logoutBtn.addEventListener('click', handleLogout);
    elements.closeModalBtn.addEventListener('click', closeModal);
    elements.saveBtn.addEventListener('click', saveChamado);
    
    elements.modal.addEventListener('click', (e) => e.target === elements.modal && closeModal());
    document.addEventListener('keydown', (e) => e.key === 'Escape' && elements.modal.style.display === 'flex' && closeModal());
    
    [elements.statusFilter, elements.urgencyFilter, elements.dateFilter].forEach(filter => {
        filter.addEventListener('change', loadChamados);
    });
    elements.searchFilter.addEventListener('input', debounce(loadChamados, 300));

    loadChamados();

    // Helper Functions
    function debounce(func, wait) {
        let timeout;
        return function() {
            const context = this, args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    }

    function closeModal() {
        elements.modal.classList.remove('show');
        document.body.style.overflow = '';
        
        setTimeout(() => {
            elements.modal.style.display = 'none';
        }, 300);
    }

    async function handleLogout() {
        try {
            await fetch(`${API_BASE_URL}/api/admin/logout`, { method: 'POST' });
            redirectToLogin();
        } catch (error) {
            console.error('Erro ao fazer logout:', error);
        }
    }
    
    async function loadChamados() {
        try {
            const params = new URLSearchParams({
                status: elements.statusFilter.value,
                urgencia: elements.urgencyFilter.value,
                data: elements.dateFilter.value,
                search: elements.searchFilter.value
            });
            
            const response = await fetch(`${API_BASE_URL}/api/admin/chamados?${params.toString()}`);
            const { success, chamados: fetchedChamados, message } = await response.json();
            
            if (success) {
                chamados = fetchedChamados;
                renderChamados();
            } else {
                console.error('Erro ao carregar chamados:', message);
            }
        } catch (error) {
            console.error('Erro ao carregar chamados:', error);
        }
    }
    
    function renderChamados() {
        elements.chamadosTable.innerHTML = '';
        
        if (chamados.length === 0) {
            const row = elements.chamadosTable.insertRow();
            const cell = row.insertCell(0);
            cell.colSpan = 7;
            cell.textContent = 'Nenhum chamado encontrado';
            cell.style.textAlign = 'center';
            return;
        }
        
        chamados.forEach(chamado => {
            const row = elements.chamadosTable.insertRow();
            
            // Configurar o clique na linha
            row.style.cursor = 'pointer';
            row.addEventListener('click', () => openModal(chamado.ID));
            
            // Adicionar células
            row.insertCell(0).textContent = chamado.ID;
            row.insertCell(1).textContent = chamado.TITULO;
            row.insertCell(2).textContent = chamado.NOME_CRIADOR;
            
            // Célula de status
            const statusCell = row.insertCell(3);
            const statusSpan = document.createElement('span');
            statusSpan.className = `status status-${getStatusClass(chamado.STATUS)}`;
            statusSpan.textContent = chamado.DESC_STATUS;
            statusCell.appendChild(statusSpan);
            
            // Demais células
            row.insertCell(4).textContent = chamado.DESC_URGENCIA;
            row.insertCell(5).textContent = chamado.DATACRIACAO;
            
            // Célula de ações
            const actionsCell = row.insertCell(6);
            const editBtn = document.createElement('button');
            editBtn.className = 'btn btn-warning';
            editBtn.innerHTML = '<i class="fas fa-edit"></i> Editar';
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openModal(chamado.ID);
            });
            actionsCell.appendChild(editBtn);
        });
    }
    
    function createNoResultsRow() {
        const row = document.createElement('tr');
        const cell = row.insertCell();
        cell.colSpan = 7;
        cell.textContent = 'Nenhum chamado encontrado';
        cell.style.textAlign = 'center';
        return row.outerHTML;
    }
    
    function createChamadoRow(chamado) {
        return `
            <tr onclick="openModal(${chamado.ID})">
                <td>${chamado.ID}</td>
                <td>${chamado.TITULO}</td>
                <td>${chamado.NOME_CRIADOR}</td>
                <td><span class="status status-${getStatusClass(chamado.STATUS)}">${chamado.DESC_STATUS}</span></td>
                <td>${chamado.DESC_URGENCIA}</td>
                <td>${chamado.DATACRIACAO}</td>
                <td>
                    <button class="btn btn-warning" onclick="event.stopPropagation(); openModal(${chamado.ID})">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                </td>
            </tr>
        `;
    }
    
    function getStatusClass(statusId) {
        const statusClasses = {
            1: 'pending',
            2: 'in-progress',
            3: 'resolved',
            4: 'cancelled'
        };
        return statusClasses[parseInt(statusId)] || '';
    }
    
    window.openModal = function(chamadoId) {
        currentChamadoId = chamadoId;
        const chamado = chamados.find(c => c.ID == chamadoId);
        
        if (!chamado) return;
        
        document.getElementById('modalTitle').textContent = `Editar Chamado #${chamado.ID}`;
        document.getElementById('modalTitulo').value = chamado.TITULO;
        document.getElementById('modalSolicitante').value = chamado.NOME_CRIADOR;
        document.getElementById('modalTelefone').value = chamado.TELEFONE;
        document.getElementById('modalDescricao').value = chamado.DESCRICAO;
        document.getElementById('modalUrgencia').value = chamado.URGENCIA;
        document.getElementById('modalStatus').value = chamado.STATUS;
        
        const statusSelect = document.getElementById('modalStatus');
        statusSelect.disabled = false;
        statusSelect.onchange = () => toggleResolucaoField(statusSelect.value);
        
        toggleResolucaoField(chamado.STATUS);
        
        const imagemPreview = document.getElementById('modalImagem');
        if (chamado.IMAGEM_URL) {
            imagemPreview.src = chamado.IMAGEM_URL;
            imagemPreview.style.display = 'block';
        } else {
            imagemPreview.style.display = 'none';
        }
        
        elements.modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        void elements.modal.offsetWidth;
        elements.modal.classList.add('show');
    }

    function toggleResolucaoField(status) {
        const resolucaoGroup = document.getElementById('resolucaoGroup');
        const shouldShow = parseInt(status) === 3;
        resolucaoGroup.style.display = shouldShow ? 'block' : 'none';
        
        if (shouldShow) {
            setTimeout(() => document.getElementById('modalResolucao').focus(), 100);
        }
    }

    async function saveChamado() {
        const status = document.getElementById('modalStatus').value;
        const resolucao = document.getElementById('modalResolucao').value;

        if (parseInt(status) === 3 && !resolucao.trim()) {
            alert('Por favor, informe a resolução para chamados solucionados');
            document.getElementById('modalResolucao').focus();
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/chamados/${currentChamadoId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, resolucao })
            });
            
            const data = await response.json();
            
            if (data.success) {
                alert('Chamado atualizado com sucesso!');
                closeModal();
                loadChamados();
            } else {
                alert('Erro ao atualizar chamado: ' + data.message);
            }
        } catch (error) {
            console.error('Erro ao salvar chamado:', error);
            alert('Erro ao conectar com o servidor');
        }
    }
}