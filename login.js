const API_BASE_URL = 'https://helpdesk-q2qd.onrender.com';

fetch(`${API_BASE_URL}/login`, {
    method: "POST",
    headers: {
        "Content-Type": "application/json"
    },
    body: JSON.stringify({ usuario, senha })
})
.then(response => response.json())
.then(data => {
    if (data.success) {
        localStorage.setItem("auth", "true");
        window.location.href = "dashboard.html";
    } else {
        alert("Usuário ou senha incorretos");
    }
})
.catch(error => console.error("Erro:", error));
