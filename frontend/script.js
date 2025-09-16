// ===============================
// CONFIGURAÇÃO GLOBAL E INICIALIZAÇÃO
// ===============================

const API_URL = "http://localhost:4000/api";

document.addEventListener('DOMContentLoaded', () => {
    if (document.body.id === 'page-admin') {
        carregarDadosAdmin();
    } else if (document.body.id === 'page-professor') {
        carregarDadosProfessor();
    } else if (document.body.id === 'page-aluno') {
        carregarDadosAluno();
    }
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
// CONTROLO DO MODAL (ADMIN E NOTAS)
// ===============================
const adminModal = document.getElementById('admin-modal');
const notasModal = document.getElementById('modal-notas');

function fecharModal() {
    if (adminModal) adminModal.style.display = 'none';
}

function fecharModalNotas() {
    if (notasModal) notasModal.style.display = 'none';
}

async function abrirModalTurma(turma = null) {
    const modalTitle = document.getElementById('modal-title');
    const modalForm = document.getElementById('modal-form');
    const modalFormFields = document.getElementById('modal-form-fields');
    
    modalTitle.textContent = turma ? 'Editar Turma' : 'Criar Nova Turma';
    const usuariosResponse = await apiFetch('/usuarios');
    const todosUsuarios = await usuariosResponse.json();
    const professores = todosUsuarios.filter(u => u.perfil === 'professor');
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
            ${professores.map(p => `<option value="${p.id_usuario}">${p.nome}</option>`).join('')}
        </select>
    `;
    adminModal.style.display = 'flex';
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

async function abrirModalUsuario(perfil, usuario = null) {
    const modalTitle = document.getElementById('modal-title');
    const modalForm = document.getElementById('modal-form');
    const modalFormFields = document.getElementById('modal-form-fields');
    
    modalTitle.textContent = usuario ? `Editar ${perfil}` : `Criar Novo ${perfil}`;
    let extraFieldsHTML = '';
    if (perfil === 'professor') {
        extraFieldsHTML = `<label>Associar Turmas</label><div class="multi-select-container"><div id="tags-container"></div><select id="turmas-select"><option value="">Adicionar turma...</option></select></div>`;
    } else if (perfil === 'aluno') {
        const turmas = await (await apiFetch('/turmas')).json();
        const idTurmaAtual = usuario ? usuario.id_turma : null;
        extraFieldsHTML = `<label for="id_turma">Turma</label><select id="id_turma" name="id_turma" required><option value="" disabled ${!idTurmaAtual ? 'selected' : ''}>Selecione uma turma...</option>${turmas.map(t => `<option value="${t.id_turma}" ${t.id_turma === idTurmaAtual ? 'selected' : ''}>${t.nome}</option>`).join('')}</select>`;
    }
    modalFormFields.innerHTML = `<label for="nome">Nome</label><input type="text" id="nome" name="nome" value="${usuario?.nome || ''}" required><label for="email">Email</label><input type="email" id="email" name="email" value="${usuario?.email || ''}" required><label for="senha">Senha</label><input type="password" id="senha" name="senha" placeholder="${usuario ? 'Deixe em branco para não alterar' : 'Senha temporária'}">${extraFieldsHTML}`;
    adminModal.style.display = 'flex';
    if (perfil === 'professor' && usuario) {
        const [todasTurmas, turmasAtuaisIds] = await Promise.all([
            (await apiFetch('/turmas')).json(),
            (await apiFetch(`/usuarios/${usuario.id_usuario}/turmas`)).json()
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

function popularMultiSelect(todasTurmas, turmasAtuaisIds) {
    const tagsContainer = document.getElementById('tags-container');
    const turmaSelect = document.getElementById('turmas-select');
    if (!tagsContainer || !turmaSelect) return;
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
// PAINEL DO ADMINISTRADOR
// ===============================
function carregarDadosAdmin() { carregarTurmas(); carregarUsuarios('professor'); carregarUsuarios('aluno'); }
function mostrarSecao(secao) { document.querySelectorAll('.painel').forEach(s => s.id === secao ? s.classList.remove('hidden') : s.classList.add('hidden')); }
async function carregarTurmas() {
    try {
        const turmas = await (await apiFetch('/turmas')).json();
        document.getElementById("listaTurmas").innerHTML = turmas.map(turma => `<li><span>${turma.nome} (${turma.ano}) - Prof: ${turma.professor_nome || 'Nenhum'}</span><div><button onclick='abrirModalTurma(${JSON.stringify(turma)})'>Editar</button><button onclick="excluirTurma(${turma.id_turma})">Excluir</button></div></li>`).join('');
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
        document.getElementById(listaId).innerHTML = usuarios.filter(u => u.perfil === perfil).map(usuario => {
            let infoExtra = '';
            if (perfil === 'aluno') {
                infoExtra = `(${usuario.turma_nome || 'Sem turma'})`;
            }
            return `<li><span>${usuario.nome} - ${usuario.email} ${infoExtra}</span><div><button onclick='abrirModalUsuario("${perfil}", ${JSON.stringify(usuario)})'>Editar</button></div></li>`;
        }).join('');
    } catch (e) { console.error(e) }
}

// ===============================
// LÓGICA PARA O PAINEL DO PROFESSOR
// ===============================

let turmaSelecionadaGlobal = { id: null, nome: '' };

async function carregarDadosProfessor() {
    try {
        const turmas = await (await apiFetch('/turmas')).json();
        const listaTurmasProfessor = document.getElementById("listaTurmasProfessor");
        if (turmas.length > 0) {
            listaTurmasProfessor.innerHTML = turmas.map(turma => `
                <li class="turma-item">
                    <span>${turma.nome} (${turma.ano})</span>
                    <button onclick="selecionarTurma(${turma.id_turma}, '${turma.nome.replace(/'/g, "\\'")}')">Gerenciar Turma</button>
                </li>`).join('');
        } else {
            listaTurmasProfessor.innerHTML = '<li>Você não está associado a nenhuma turma.</li>';
        }
    } catch (e) {
        console.error(e);
        document.getElementById("listaTurmasProfessor").innerHTML = '<li>Ocorreu um erro ao carregar as turmas.</li>';
    }
}

function selecionarTurma(id_turma, nome_turma) {
    turmaSelecionadaGlobal = { id: id_turma, nome: nome_turma };
    
    document.getElementById('detalhesTurma').classList.remove('hidden');
    document.getElementById('acoesTurma').classList.remove('hidden');
    document.getElementById('nomeTurmaSelecionada').textContent = `Gerenciando a Turma: ${nome_turma}`;

    document.getElementById('btnVerFaltas').onclick = () => verResumoDaTurma();
    document.getElementById('btnFazerChamada').onclick = () => verAlunosParaChamada();
    document.getElementById('btnLancarNotas').onclick = () => verAlunosParaNotas();

    verResumoDaTurma();
}

function esconderConteudosTurma() {
    document.getElementById('listaAlunosResumo').classList.add('hidden');
    document.getElementById('formChamada').classList.add('hidden');
    document.getElementById('listaAlunosParaNotas').classList.add('hidden');
}

async function verResumoDaTurma() {
    esconderConteudosTurma();
    const { id: id_turma } = turmaSelecionadaGlobal;
    const listaAlunosResumoEl = document.getElementById('listaAlunosResumo');
    listaAlunosResumoEl.classList.remove('hidden');
    listaAlunosResumoEl.innerHTML = '<li>Carregando resumo de faltas...</li>';

    try {
        const alunosComFaltas = await (await apiFetch(`/turmas/${id_turma}/alunos/faltas`)).json();
        if (alunosComFaltas.length > 0) {
            listaAlunosResumoEl.innerHTML = alunosComFaltas.map(aluno => `<li class="chamada-item"><span>${aluno.nome}</span><span style="font-weight: bold;">Faltas: ${aluno.total_faltas}</span></li>`).join('');
        } else {
            listaAlunosResumoEl.innerHTML = '<li>Nenhum aluno matriculado nesta turma.</li>';
        }
    } catch (e) {
        console.error(e);
        listaAlunosResumoEl.innerHTML = '<li>Ocorreu um erro ao carregar o resumo da turma.</li>';
    }
}

async function verAlunosParaChamada() {
    esconderConteudosTurma();
    const { id: id_turma } = turmaSelecionadaGlobal;
    const listaAlunosChamadaEl = document.getElementById('listaAlunosChamada');
    const dataChamadaEl = document.getElementById('dataChamada');
    const formChamada = document.getElementById('formChamada');
    formChamada.classList.remove('hidden');
    
    const hoje = new Date().toISOString().slice(0, 10);
    dataChamadaEl.value = hoje;
    listaAlunosChamadaEl.innerHTML = '<li>Carregando alunos...</li>';
    formChamada.onsubmit = (event) => salvarChamada(event, id_turma);

    try {
        const alunos = await (await apiFetch(`/turmas/${id_turma}/alunos`)).json();
        if (alunos.length === 0) {
            listaAlunosChamadaEl.innerHTML = '<li>Nenhum aluno matriculado nesta turma.</li>';
            return;
        }
        listaAlunosChamadaEl.innerHTML = alunos.map(aluno => `<li class="chamada-item"><span>${aluno.nome}</span><div class="chamada-options"><input type="radio" id="presente_${aluno.id_usuario}" name="aluno_${aluno.id_usuario}" value="presente" checked> <label for="presente_${aluno.id_usuario}">Presente</label><input type="radio" id="falta_${aluno.id_usuario}" name="aluno_${aluno.id_usuario}" value="falta"> <label for="falta_${aluno.id_usuario}">Falta</label></div></li>`).join('');
        try {
            const presencasDoDia = await (await apiFetch(`/chamadas/turma/${id_turma}/data/${hoje}`)).json();
            for (const id_aluno in presencasDoDia) {
                const status = presencasDoDia[id_aluno];
                const radio = document.querySelector(`input[name="aluno_${id_aluno}"][value="${status}"]`);
                if (radio) radio.checked = true;
            }
        } catch (presencaError) {
            console.warn("Não foi possível carregar a chamada para o dia de hoje.");
        }
    } catch (alunosError) {
        console.error(alunosError);
        listaAlunosChamadaEl.innerHTML = '<li>Ocorreu um erro ao carregar os alunos.</li>';
    }
}

async function salvarChamada(event, id_turma) {
    event.preventDefault();
    const data = document.getElementById('dataChamada').value;
    if (!data) return alert('Por favor, selecione uma data para a chamada.');
    const form = event.target;
    const presencas = {};
    form.querySelectorAll('input[type="radio"]:checked').forEach(radio => {
        const id_aluno = radio.name.replace('aluno_', '');
        presencas[id_aluno] = radio.value;
    });
    const payload = { id_turma, data, presencas };
    try {
        const response = await apiFetch('/chamadas', 'POST', payload);
        if(response.ok) {
            alert('✅ Chamada salva com sucesso!');
            verResumoDaTurma();
        } else {
            const err = await response.json();
            alert(`❌ Erro ao salvar chamada: ${err.error}`);
        }
    } catch (e) {
        console.error(e);
        alert('⚠️ Ocorreu um erro de conexão ao salvar a chamada.');
    }
}

async function verAlunosParaNotas() {
    esconderConteudosTurma();
    const { id: id_turma } = turmaSelecionadaGlobal;
    const listaAlunosParaNotasEl = document.getElementById('listaAlunosParaNotas');
    listaAlunosParaNotasEl.classList.remove('hidden');
    listaAlunosParaNotasEl.innerHTML = '<li>Carregando alunos...</li>';

    try {
        const alunos = await (await apiFetch(`/turmas/${id_turma}/alunos`)).json();
        if (alunos.length > 0) {
            listaAlunosParaNotasEl.innerHTML = alunos.map(aluno => `
                <li class="aluno-item-nota">
                    <span>${aluno.nome}</span>
                    <button onclick="abrirModalNotas(${id_turma}, ${aluno.id_usuario}, '${aluno.nome.replace(/'/g, "\\'")}')">Lançar/Ver Notas</button>
                </li>
            `).join('');
        } else {
            listaAlunosParaNotasEl.innerHTML = '<li>Nenhum aluno encontrado nesta turma.</li>';
        }
    } catch (e) {
        console.error(e);
        listaAlunosParaNotasEl.innerHTML = '<li>Erro ao carregar alunos.</li>';
    }
}

async function abrirModalNotas(id_turma, id_aluno, nome_aluno) {
    const modal = document.getElementById('modal-notas');
    // CORREÇÃO: Busca os elementos corretos dentro do modal de notas
    const modalTitulo = document.getElementById('modal-notas-titulo');
    const modalCorpo = document.getElementById('modal-notas-corpo');

    modalTitulo.textContent = `Notas de: ${nome_aluno}`;
    modalCorpo.innerHTML = `<p>Carregando notas...</p>`;
    modal.style.display = 'flex';

    // A requisição busca os dados de todos os alunos, depois filtramos
    const alunosComNotas = await (await apiFetch(`/notas/turma/${id_turma}`)).json();
    const alunoData = alunosComNotas.find(a => a.id_usuario === id_aluno);
    
    if (!alunoData) {
        modalCorpo.innerHTML = "<p>Não foi possível carregar os dados do aluno.</p>";
        return;
    }

    const mediaFormatada = alunoData.media_final !== null ? alunoData.media_final.toFixed(2) : 'N/A';

    modalCorpo.innerHTML = `
        <div class="resumo-media">
            <strong>Média Atual:</strong> ${mediaFormatada}
        </div>
        <ul class="lista-avaliacoes-modal">
            ${alunoData.avaliacoes.map(av => `
                <li>
                    <span>${av.descricao} (${new Date(av.data_avaliacao).toLocaleDateString('pt-BR',{timeZone:'UTC'})}):</span>
                    <strong>${av.nota}</strong>
                </li>
            `).join('') || '<li>Nenhuma nota lançada.</li>'}
        </ul>
        <form id="form-add-nota">
            <h4>Adicionar Nova Nota</h4>
            <input type="text" id="nova-nota-descricao" placeholder="Descrição (Ex: Prova 1)" required>
            <input type="number" step="0.1" min="0" max="10" id="nova-nota-valor" placeholder="Nota (Ex: 8.5)" required>
            <button type="submit">Adicionar Nota</button>
        </form>
    `;

    document.getElementById('form-add-nota').onsubmit = async (event) => {
        event.preventDefault();
        const descricao = document.getElementById('nova-nota-descricao').value;
        const nota = document.getElementById('nova-nota-valor').value;
        const payload = { id_turma, id_aluno, descricao, nota };
        
        const response = await apiFetch('/notas', 'POST', payload);
        if (response.ok) {
            alert('✅ Nota adicionada com sucesso!');
            abrirModalNotas(id_turma, id_aluno, nome_aluno);
        } else {
            alert('❌ Erro ao adicionar nota.');
        }
    };
}

// ===============================
// LÓGICA PARA O PAINEL DO ALUNO
// ===============================
async function carregarDadosAluno() {
    const turmaEl = document.getElementById('turmaAluno');
    const presencasEl = document.getElementById('presencasAluno');
    const notasEl = document.getElementById('notasAluno');
    try {
        const [turmas, presencas, notas] = await Promise.all([
            (await apiFetch('/turmas')).json(),
            (await apiFetch('/chamadas/me')).json(),
            (await apiFetch('/notas/me')).json()
        ]);
        if (turmas.length > 0) {
            turmaEl.textContent = `${turmas[0].nome} (${turmas[0].ano})`;
        } else {
            turmaEl.textContent = 'Você não está matriculado em nenhuma turma.';
        }
        if (presencas.length > 0) {
            presencasEl.innerHTML = presencas.map(p => {
                const dataFormatada = new Date(p.data).toLocaleDateString('pt-BR', {timeZone: 'UTC'});
                const statusClasse = p.status === 'presente' ? 'status-presente' : 'status-falta';
                return `<li>${dataFormatada} - <span class="${statusClasse}">${p.status.charAt(0).toUpperCase() + p.status.slice(1)}</span></li>`;
            }).join('');
        } else {
            presencasEl.innerHTML = '<li>Nenhum registro de presença encontrado.</li>';
        }
        if (notas.length > 0) {
            notasEl.innerHTML = notas.map(n => `<li>${n.descricao}: <strong>${n.nota}</strong></li>`).join('');
        } else {
            notasEl.innerHTML = '<li>Nenhum registro de nota encontrado.</li>';
        }
    } catch (e) {
        console.error(e);
        turmaEl.textContent = 'Erro ao carregar dados.';
        presencasEl.innerHTML = '<li>Erro ao carregar dados.</li>';
        notasEl.innerHTML = '<li>Erro ao carregar dados.</li>';
    }
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
    if (!response.ok && response.status !== 201) { 
        console.error("Erro na API", await response.json()); 
    }
    return response;
}