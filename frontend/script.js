// URL base da API (ajuste se necessário)
const API_URL = "http://localhost:4000";

// Função de login
async function login(event) {
  event.preventDefault(); // Evita recarregar a página

  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (response.ok) {
      alert("✅ Login realizado com sucesso!");

      // Armazena o token no localStorage
      localStorage.setItem("token", data.token);
      localStorage.setItem("perfil", data.perfil);

      // Redireciona conforme perfil
      if (data.perfil === "admin") {
        window.location.href = "admin.html";
      } else if (data.perfil === "professor") {
        window.location.href = "professor.html";
      } else if (data.perfil === "aluno") {
        window.location.href = "aluno.html";
      }
    } else {
      alert("❌ Erro no login: " + data.message);
    }
  } catch (err) {
    console.error("Erro ao conectar com o backend:", err);
    alert("⚠️ Falha na conexão com o servidor.");
  }
}

// Exemplo de função para buscar turmas (usada no painel do admin)
async function carregarTurmas() {
  const token = localStorage.getItem("token");

  if (!token) {
    alert("Usuário não autenticado!");
    window.location.href = "index.html";
    return;
  }

  try {
    const response = await fetch(`${API_URL}/turmas`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const turmas = await response.json();
    console.log("📌 Turmas:", turmas);

    // Renderizar turmas na tela (exemplo)
    const lista = document.getElementById("lista-turmas");
    if (lista) {
      lista.innerHTML = "";
      turmas.forEach((turma) => {
        const li = document.createElement("li");
        li.textContent = `${turma.nome} - ${turma.ano}`;
        lista.appendChild(li);
      });
    }
  } catch (err) {
    console.error("Erro ao carregar turmas:", err);
  }
}
