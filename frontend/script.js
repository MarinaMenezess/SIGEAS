// ===============================
// CONFIGURAÇÃO GLOBAL E INICIALIZAÇÃO
// ===============================

const API_URL = "http://localhost:4000/api";

document.addEventListener('DOMContentLoaded', () => {
    if (document.body.id === 'page-admin') carregarDadosAdmin();
});

// ===============================
// AUTENTICAÇÃO
// ===============================

async function login(event) {
    event.preventDefault();
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usernameOrEmail: username, senha: password }),
        });
        const data = await response.json();
        if (response.ok) {
            alert("✅ Login realizado com sucesso!");
            localStorage.setItem("token", data.token);
            localStorage.setItem("user", JSON.stringify(data.user));
            switch (data.user.perfil) {
                case "administrador": window.location.href = "admin.html"; break;
                case "professor": window.location.href = "professor.html"; break;
                case "aluno": window.location.href = "aluno.html"; break;
            }
        } else {
            alert(`❌ Erro no login: ${data.error || "Verifique os seus dados."}`);
        }
    } catch (err) {
        console.error("Erro ao conectar com o backend:", err);
        alert("⚠️ Falha na conexão com o servidor.");
    }
}

function logout() {
    localStorage.clear();
    window.location.href = 'index.html';
}

// ===============================
// CONTROLO DO MODAL (ADMIN)
// ===============================
const modal = document.getElementById('admin-modal');
const modalTitle = document.getElementById('modal-title');
const modalForm = document.getElementById('modal-form');
const modalFormFields = document.getElementById('modal-form-fields');

function fecharModal() {
    modal.style.display = 'none';
}

// RESTAURADO E CORRIGIDO: Modal para Turmas
async function abrirModalTurma(turma = null) {
    modalTitle.textContent = turma ? 'Editar Turma' : 'Criar Nova Turma';

    // Busca professores para o select
    const [usuariosResponse, turmasResponse] = await Promise.all([
        apiFetch('/usuarios'),
        turma ? apiFetch(`/turmas/${turma.id_turma}/professores`) : Promise.resolve(null)
    ]);
    const todosUsuarios = await usuariosResponse.json();
    const professores = todosUsuarios.filter(u => u.perfil === 'professor');
    const profAtualArr = turmasResponse ? await turmasResponse.json() : [];
    const profAtualId = profAtualArr.length > 0 ? profAtualArr[0].id_professor : null;

    modalFormFields.innerHTML = `
        <label for="nome">Nome da Turma</label>
        <input type="text" id="nome" name="nome" value="${turma?.nome || ''}" required>
        <label for="descricao">Descrição</label>
        <input type="text" id="descricao" name="descricao" value="${turma?.descricao || ''}">
        <label for="ano">Ano</label>
        <input type="number" id="ano" name="ano" value="${turma?.ano || new Date().getFullYear()}" required>
        <label for="id_professor">Associar Professor</label>
        <select id="id_professor" name="id_professor">
            <option value="">Nenhum</option>
            ${professores.map(p => `<option value="${p.id_usuario}" ${p.id_usuario === profAtualId ? 'selected' : ''}>${p.nome}</option>`).join('')}
        </select>
    `;
    modal.style.display = 'flex';

    modalForm.onsubmit = async (event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(modalForm).entries());
        
        if (turma) {
            await apiFetch(`/turmas/${turma.id_turma}`, 'PUT', data);
            alert('✅ Turma atualizada!');
        } else {
            await apiFetch('/turmas', 'POST', data);
            alert('✅ Turma criada!');
        }
        fecharModal();
        carregarTurmas();
    };
}

// RESTAURADO E CORRIGIDO: Modal para Usuários
async function abrirModalUsuario(perfil, usuario = null) {
    modalTitle.textContent = usuario ? `Editar ${perfil}` : `Criar Novo ${perfil}`;
    
    let extraFieldsHTML = '';
    if (perfil === 'professor') {
        extraFieldsHTML = `
            <label>Associar Turmas</label>
            <div class="multi-select-container">
                <div id="tags-container"></div>
                <select id="turmas-select"><option value="">Adicionar turma...</option></select>
            </div>`;
    } else if (perfil === 'aluno' && !usuario) {
        const turmas = await (await apiFetch('/turmas')).json();
        extraFieldsHTML = `
            <label for="id_turma">Matricular na Turma (Opcional)</label>
            <select id="id_turma" name="id_turma">
                <option value="">Nenhuma</option>
                ${turmas.map(t => `<option value="${t.id_turma}">${t.nome}</option>`).join('')}
            </select>`;
    }

    modalFormFields.innerHTML = `
        <label for="nome">Nome</label>
        <input type="text" id="nome" name="nome" value="${usuario?.nome || ''}" required>
        <label for="email">Email</label>
        <input type="email" id="email" name="email" value="${usuario?.email || ''}" required>
        <label for="senha">Senha</label>
        <input type="password" id="senha" name="senha" placeholder="${usuario ? 'Deixe em branco para não alterar' : 'Senha temporária'}">
        ${extraFieldsHTML}
    `;
    modal.style.display = 'flex';

    if (perfil === 'professor') {
        const [todasTurmas, turmasAtuaisIds] = await Promise.all([
            (await apiFetch('/turmas')).json(),
            usuario ? (await apiFetch(`/usuarios/${usuario.id_usuario}/turmas`)).json() : []
        ]);
        setTimeout(() => popularMultiSelect(todasTurmas, turmasAtuaisIds), 0);
    }

    modalForm.onsubmit = async (event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(modalForm).entries());
        data.perfil = perfil;
        if (perfil === 'professor') {
            data.turmas = Array.from(document.querySelectorAll('#tags-container .tag-item')).map(tag => tag.dataset.value);
        }
        if (usuario && !data.senha) delete data.senha;
        
        if (usuario) {
            await apiFetch(`/usuarios/${usuario.id_usuario}`, 'PUT', data);
            alert(`✅ ${perfil} atualizado!`);
        } else {
            await apiFetch('/usuarios', 'POST', data);
            alert(`✅ ${perfil} criado!`);
        }
        fecharModal();
        carregarUsuarios(perfil);
    };
}

// Funções para o seletor de tags (sem alterações)
function popularMultiSelect(todasTurmas, turmasAtuaisIds) {
    const tagsContainer = document.getElementById('tags-container');
    const turmaSelect = document.getElementById('turmas-select');
    if(!tagsContainer || !turmaSelect) return;
    tagsContainer.innerHTML = '';
    turmaSelect.innerHTML = '<option value="">Adicionar turma...</option>';
    const turmasSelecionadas = new Set(turmasAtuaisIds.map(String));
    todasTurmas.forEach(turma => {
        if (turmasSelecionadas.has(String(turma.id_turma))) {
            criarTag(turma);
        } else {
            const option = document.createElement('option');
            option.value = turma.id_turma;
            option.textContent = turma.nome;
            turmaSelect.appendChild(option);
        }
    });
    turmaSelect.onchange = (e) => {
        const id = e.target.value;
        if (!id) return;
        const turma = todasTurmas.find(t => String(t.id_turma) === id);
        criarTag(turma);
        e.target.querySelector(`option[value='${id}']`).remove();
        e.target.value = '';
    };
}
function criarTag(turma) {
    const tagsContainer = document.getElementById('tags-container');
    const tag = document.createElement('div');
    tag.className = 'tag-item';
    tag.dataset.value = turma.id_turma;
    tag.innerHTML = `<span>${turma.nome}</span><span class="remove-tag" onclick="removerTag(this, ${JSON.stringify(turma).replace(/"/g, "'")})">&times;</span>`;
    tagsContainer.appendChild(tag);
}
function removerTag(element, turma) {
    const turmaSelect = document.getElementById('turmas-select');
    const option = document.createElement('option');
    option.value = turma.id_turma;
    option.textContent = turma.nome;
    turmaSelect.appendChild(option);
    element.parentElement.remove();
}

// ===============================
// PAINEL DO ADMINISTRADOR (LÓGICA DE CARREGAMENTO)
// ===============================
function carregarDadosAdmin() { carregarTurmas(); carregarUsuarios('professor'); carregarUsuarios('aluno'); }
function mostrarSecao(secao) { document.querySelectorAll('.painel').forEach(s => s.id === secao ? s.classList.remove('hidden') : s.classList.add('hidden')); }

async function carregarTurmas() {
    try {
        const turmas = await (await apiFetch('/turmas')).json();
        document.getElementById("listaTurmas").innerHTML = turmas.map(turma => `
            <li>
                <span>${turma.nome} (${turma.ano}) - Prof: ${turma.professor_nome || 'Nenhum'}</span>
                <div>
                    <button onclick='abrirModalTurma(${JSON.stringify(turma)})'>Editar</button>
                    <button onclick="excluirTurma(${turma.id_turma})">Excluir</button>
                </div>
            </li>`).join('');
    } catch (e) { console.error(e) }
}
async function excluirTurma(id) { 
    if (!confirm("Tem certeza que deseja excluir esta turma?")) return;
    await apiFetch(`/turmas/${id}`, 'DELETE');
    alert('✅ Turma excluída!');
    carregarTurmas();
}
async function carregarUsuarios(perfil) {
    try {
        const usuarios = await (await apiFetch('/usuarios')).json();
        const listaId = perfil === 'professor' ? 'listaProfessores' : 'listaAlunos';
        document.getElementById(listaId).innerHTML = usuarios.filter(u => u.perfil === perfil).map(usuario => `
            <li>
                <span>${usuario.nome} - ${usuario.email}</span>
                <div>
                    <button onclick='abrirModalUsuario("${perfil}", ${JSON.stringify(usuario)})'>Editar</button>
                </div>
            </li>`).join('');
    } catch (e) { console.error(e) }
}

// ===============================
// FUNÇÃO AUXILIAR PARA API
// ===============================
async function apiFetch(endpoint, method = 'GET', body = null) {
    const token = localStorage.getItem("token");
    if (!token) { logout(); throw new Error("Token não encontrado."); }
    const options = { method, headers: { 'Authorization': `Bearer ${token}` } };
    if (body) { options.headers['Content-Type'] = 'application/json'; options.body = JSON.stringify(body); }
    const response = await fetch(`${API_URL}${endpoint}`, options);
    if (response.status === 401 || response.status === 403) { logout(); throw new Error("Não autorizado."); }
    if (!response.ok && response.status !== 201) { console.error("Erro na API", await response.json()); }
    return response;
}