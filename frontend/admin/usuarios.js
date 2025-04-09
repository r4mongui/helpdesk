document.addEventListener('DOMContentLoaded', () => {
    initUsersPage();
});

async function initUsersPage() {
    // Verificar autenticação e permissões (código similar ao admin.js)
    try {
        const [authResponse, permResponse] = await Promise.all([
            fetch('/api/admin/check-auth'),
            fetch('/api/admin/check-permissions')
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
    setupUsersPage();
}

function redirectToLogin() {
    window.location.href = '/admin/admin-login.html';
}

async function loadAdminInfo() {
    try {
        const response = await fetch('/api/admin/user-info');
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

function setupUsersPage() {
    const elements = {
        logoutBtn: document.getElementById('logoutBtn'),
        usersTable: document.getElementById('usersTable').querySelector('tbody'),
        typeFilter: document.getElementById('typeFilter'),
        statusFilter: document.getElementById('statusFilter'),
        searchFilter: document.getElementById('searchFilter'),
        addUserBtn: document.getElementById('addUserBtn'),
        modal: document.getElementById('userModal'),
        closeModalBtn: document.getElementById('closeModal'),
        cancelBtn: document.getElementById('cancelBtn'),
        saveUserBtn: document.getElementById('saveUserBtn'),
        userPhoto: document.getElementById('userPhoto'),
        photoPreview: document.getElementById('photoPreview')
    };

    let users = [];
    let currentUserId = null;

    // Event Listeners
    elements.logoutBtn.addEventListener('click', handleLogout);
    elements.addUserBtn.addEventListener('click', () => openModal());
    elements.closeModalBtn.addEventListener('click', closeModal);
    elements.cancelBtn.addEventListener('click', closeModal);
    elements.saveUserBtn.addEventListener('click', saveUser);
    
    elements.modal.addEventListener('click', (e) => e.target === elements.modal && closeModal());
    document.addEventListener('keydown', (e) => e.key === 'Escape' && elements.modal.style.display === 'flex' && closeModal());
    
    [elements.typeFilter, elements.statusFilter].forEach(filter => {
        filter.addEventListener('change', loadUsers);
    });
    elements.searchFilter.addEventListener('input', debounce(loadUsers, 300));
    
    elements.userPhoto.addEventListener('change', function(e) {
        if (this.files && this.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                elements.photoPreview.src = e.target.result;
                elements.photoPreview.style.display = 'block';
            };
            reader.readAsDataURL(this.files[0]);
        }
    });

    loadUsers();

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
            resetForm();
        }, 300);
    }

    function resetForm() {
        document.getElementById('userId').value = '';
        document.getElementById('userName').value = '';
        document.getElementById('userEmail').value = '';
        document.getElementById('userType').value = '';
        document.getElementById('userStatus').value = '1';
        document.getElementById('userPassword').value = '';
        document.getElementById('confirmPassword').value = '';
        elements.userPhoto.value = '';
        elements.photoPreview.src = '';
        elements.photoPreview.style.display = 'none';
        currentUserId = null;
    }

    async function handleLogout() {
        try {
            await fetch('/api/admin/logout', { method: 'POST' });
            redirectToLogin();
        } catch (error) {
            console.error('Erro ao fazer logout:', error);
        }
    }
    
    async function loadUsers() {
        try {
            const params = new URLSearchParams({
                type: elements.typeFilter.value,
                status: elements.statusFilter.value,
                search: elements.searchFilter.value
            });
            
            const response = await fetch(`/api/admin/users?${params.toString()}`);
            const { success, users: fetchedUsers, message } = await response.json();
            
            if (success) {
                users = fetchedUsers;
                renderUsers();
            } else {
                console.error('Erro ao carregar usuários:', message);
            }
        } catch (error) {
            console.error('Erro ao carregar usuários:', error);
        }
    }
    
    function renderUsers() {
        elements.usersTable.innerHTML = '';
        
        if (users.length === 0) {
            const row = elements.usersTable.insertRow();
            const cell = row.insertCell(0);
            cell.colSpan = 7;
            cell.textContent = 'Nenhum usuário encontrado';
            cell.style.textAlign = 'center';
            return;
        }
        
        users.forEach(user => {
            const row = elements.usersTable.insertRow();
            
            row.insertCell(0).textContent = user.ID;
            row.insertCell(1).textContent = user.NOME;
            row.insertCell(2).textContent = user.EMAIL;
            
            // Célula de tipo
            const typeCell = row.insertCell(3);
            typeCell.textContent = getTypeDescription(user.TIPO);
            
            // Célula de status
            const statusCell = row.insertCell(4);
            const statusSpan = document.createElement('span');
            statusSpan.className = `status status-${user.STATUS == 1 ? 'active' : 'inactive'}`;
            statusSpan.textContent = user.STATUS == 1 ? 'Ativo' : 'Inativo';
            statusCell.appendChild(statusSpan);
            
            // Data de cadastro
            row.insertCell(5).textContent = new Date(user.DATA_CRIACAO).toLocaleDateString();
            
            // Célula de ações
            const actionsCell = row.insertCell(6);
            const editBtn = document.createElement('button');
            editBtn.className = 'btn btn-warning';
            editBtn.innerHTML = '<i class="fas fa-edit"></i> Editar';
            editBtn.addEventListener('click', () => openModal(user.ID));
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn btn-danger';
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i> Excluir';
            deleteBtn.addEventListener('click', () => confirmDelete(user.ID, user.NOME));
            
            actionsCell.appendChild(editBtn);
            actionsCell.appendChild(deleteBtn);
        });
    }
    
    function getTypeDescription(type) {
        const types = {
            1: 'Administrador',
            2: 'Técnico',
            3: 'Usuário'
        };
        return types[type] || 'Desconhecido';
    }
    
    function openModal(userId = null) {
        currentUserId = userId;
        const modalTitle = document.getElementById('modalTitle');
        
        if (userId) {
            // Modo edição
            modalTitle.textContent = 'Editar Usuário';
            const user = users.find(u => u.ID == userId);
            
            if (user) {
                document.getElementById('userId').value = user.ID;
                document.getElementById('userName').value = user.NOME;
                document.getElementById('userEmail').value = user.EMAIL;
                document.getElementById('userType').value = user.TIPO;
                document.getElementById('userStatus').value = user.STATUS;
                
                if (user.FOTO_URL) {
                    elements.photoPreview.src = user.FOTO_URL;
                    elements.photoPreview.style.display = 'block';
                }
            }
        } else {
            // Modo criação
            modalTitle.textContent = 'Novo Usuário';
        }
        
        elements.modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        void elements.modal.offsetWidth;
        elements.modal.classList.add('show');
    }
    
    async function saveUser() {
        const formData = new FormData();
        const userId = document.getElementById('userId').value;
        const name = document.getElementById('userName').value.trim();
        const email = document.getElementById('userEmail').value.trim();
        const type = document.getElementById('userType').value;
        const status = document.getElementById('userStatus').value;
        const password = document.getElementById('userPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const photoFile = elements.userPhoto.files[0];
        
        // Validações
        if (!name || !email || !type) {
            alert('Por favor, preencha todos os campos obrigatórios (*)');
            return;
        }
        
        if (!userId && !password) {
            alert('Para novos usuários, é necessário definir uma senha');
            return;
        }
        
        if (password && password.length < 6) {
            alert('A senha deve ter no mínimo 6 caracteres');
            return;
        }
        
        if (password !== confirmPassword) {
            alert('As senhas não coincidem');
            return;
        }
        
        // Preparar dados para envio
        formData.append('id', userId);
        formData.append('name', name);
        formData.append('email', email);
        formData.append('type', type);
        formData.append('status', status);
        if (password) formData.append('password', password);
        if (photoFile) formData.append('photo', photoFile);
        
        try {
            const url = userId ? `/api/admin/users/${userId}` : '/api/admin/users';
            const method = userId ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method,
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                alert(userId ? 'Usuário atualizado com sucesso!' : 'Usuário criado com sucesso!');
                closeModal();
                loadUsers();
            } else {
                alert('Erro: ' + (data.message || 'Ocorreu um erro ao salvar o usuário'));
            }
        } catch (error) {
            console.error('Erro ao salvar usuário:', error);
            alert('Erro ao conectar com o servidor');
        }
    }
    
    function confirmDelete(userId, userName) {
        if (confirm(`Tem certeza que deseja excluir o usuário "${userName}"?`)) {
            deleteUser(userId);
        }
    }
    
    async function deleteUser(userId) {
        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (data.success) {
                alert('Usuário excluído com sucesso!');
                loadUsers();
            } else {
                alert('Erro ao excluir usuário: ' + (data.message || 'Erro desconhecido'));
            }
        } catch (error) {
            console.error('Erro ao excluir usuário:', error);
            alert('Erro ao conectar com o servidor');
        }
    }
}