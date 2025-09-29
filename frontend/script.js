// ===============================
// CONFIGURAÇÃO GLOBAL E INICIALIZAÇÃO
// ===============================

const API_URL = "http://localhost:4000/api";
let alunosComNotasCache = [];
let turmaSelecionadaGlobal = { id: null, nome: '' };
let materiaSelecionadaGlobal = null;
let dadosAlunoCache = { notas: [], presencas: [] };
let turmasCache = []; // NOVO: Cache de turmas para uso em filtros e modais

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
    verAlunosParaNotas(); // Recarrega a tabela para garantir que as notas foram atualizadas
}

async function abrirModalTurma(turma = null) {
    const modalTitle = document.getElementById('modal-title');
    const modalForm = document.getElementById('modal-form');
    const modalFormFields = document.getElementById('modal-form-fields');
    
    modalTitle.textContent = turma ? 'Editar Turma' : 'Criar Nova Turma';
    // REMOVIDO: Busca por professores
    modalFormFields.innerHTML = `
        <label for="nome">Nome da Turma</label>
        <input type="text" id="nome" name="nome" value="${turma?.nome || ''}" required>
        <label for="descricao">Descrição</label>
        <input type="text" id="descricao" name="descricao" value="${turma?.descricao || ''}">
        <label for="ano">Ano</label>
        <input type="number" id="ano" name="ano" value="${turma?.ano || new Date().getFullYear()}" required>
    `;
    adminModal.style.display = 'flex';
    modalForm.onsubmit = async (event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(modalForm).entries());
        // Não precisamos remover id_professor ou materias, pois não estão mais no formulário
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
    const materias = ['matematica', 'portugues', 'artes', 'educacao fisica', 'ingles', 'geografia', 'sociologia', 'filosofia', 'historia', 'biologia', 'fisica', 'quimica', 'projeto de vida', 'projeto profissional'];
    let extraFieldsHTML = '';
    if (perfil === 'professor') {
        // Usa turmasCache para evitar nova chamada API se já carregado
        const turmas = turmasCache.length > 0 ? turmasCache : await (await apiFetch('/turmas')); 
        extraFieldsHTML = `<label>Associar Turmas e Matérias</label><div class="multi-select-container"><div id="tags-container"></div><select id="turmas-select"><option value="">Adicionar turma...</option>${turmas.map(t => `<option value="${t.id_turma}">${t.nome}</option>`).join('')}</select> <select id="materias-select"><option value="">Selecione a matéria...</option>${materias.map(m => `<option value="${m}">${m.charAt(0).toUpperCase() + m.slice(1)}</option>`).join('')}</select> <button type="button" onclick="adicionarMateriaProfessor()">Adicionar</button></div>`;
    } else if (perfil === 'aluno') {
        // Usa turmasCache para evitar nova chamada API se já carregado
        const turmas = turmasCache.length > 0 ? turmasCache : await (await apiFetch('/turmas')); 
        const idTurmaAtual = usuario ? usuario.id_turma : null;
        extraFieldsHTML = `<label for="id_turma">Turma</label><select id="id_turma" name="id_turma" required><option value="" disabled ${!idTurmaAtual ? 'selected' : ''}>Selecione uma turma...</option>${turmas.map(t => `<option value="${t.id_turma}" ${t.id_turma === idTurmaAtual ? 'selected' : ''}>${t.nome}</option>`).join('')}</select>`;
    }
    modalFormFields.innerHTML = `<label for="nome">Nome</label><input type="text" id="nome" name="nome" value="${usuario?.nome || ''}" required><label for="email">Email</label><input type="email" id="email" name="email" value="${usuario?.email || ''}" required><label for="senha">Senha</label><input type="password" id="senha" name="senha" placeholder="${usuario ? 'Deixe em branco para não alterar' : 'Senha temporária'}">${extraFieldsHTML}`;
    adminModal.style.display = 'flex';
    if (perfil === 'professor' && usuario) {
        const turmasAtuais = await (await apiFetch(`/usuarios/${usuario.id_usuario}/turmas`));
        setTimeout(() => popularMultiSelect(turmasAtuais), 0);
    }
    modalForm.onsubmit = async (event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(modalForm).entries());
        data.perfil = perfil;
        if (perfil === 'professor') {
            data.turmas = Array.from(document.querySelectorAll('#tags-container .tag-item')).map(tag => ({ id_turma: tag.dataset.turma, materia: tag.dataset.materia }));
        }
        if (usuario && !data.senha) delete data.senha;
        if (usuario) {
            const response = await apiFetch(`/usuarios/${usuario.id_usuario}`, 'PUT', data, true); // Passa true para retornar o objeto Response
             if (response.ok) {
                 alert(`✅ ${perfil} atualizado com sucesso!`);
             } else {
                 const err = await response.json(); 
                 alert(`❌ Erro ao atualizar ${perfil}: ${err.error || response.statusText || 'Erro desconhecido'}`);
             }
        } else {
            const response = await apiFetch('/usuarios', 'POST', data, true); // Passa true para retornar o objeto Response
            
            if (response.ok) { // Verifica se a resposta é 2xx (ex: 201 Created)
                alert(`✅ ${perfil} criado com sucesso!`);
            } else {
                const err = await response.json(); 
                alert(`❌ Erro ao criar ${perfil}: ${err.error || response.statusText || 'Erro desconhecido'}`);
            }
        }
        fecharModal();
        carregarUsuarios(perfil);
    };
}

function adicionarMateriaProfessor() {
    const turmaSelect = document.getElementById('turmas-select');
    const materiaSelect = document.getElementById('materias-select');
    const tagsContainer = document.getElementById('tags-container');

    const idTurma = turmaSelect.value;
    const nomeTurma = turmaSelect.options[turmaSelect.selectedIndex].text;
    const materia = materiaSelect.value;
    const nomeMateria = materiaSelect.options[materiaSelect.selectedIndex].text;

    if (idTurma && materia) {
        const tag = document.createElement('div');
        tag.className = 'tag-item';
        tag.dataset.turma = idTurma;
        tag.dataset.materia = materia;
        tag.innerHTML = `<span>${nomeTurma} - ${nomeMateria}</span><span class="remove-tag" onclick="this.parentElement.remove()">&times;</span>`;
        tagsContainer.appendChild(tag);
        turmaSelect.value = "";
        materiaSelect.value = "";
    }
}

function popularMultiSelect(turmasAtuais) {
    const tagsContainer = document.getElementById('tags-container');
    tagsContainer.innerHTML = '';
    turmasAtuais.forEach(turma => {
        const tag = document.createElement('div');
        tag.className = 'tag-item';
        tag.dataset.turma = turma.id_turma;
        tag.dataset.materia = turma.materia;
        // Assume que a turma.nome não está disponível na resposta da API /usuarios/:id/turmas, então usa o id e a matéria.
        tag.innerHTML = `<span>Turma ${turma.id_turma} - ${turma.materia}</span><span class="remove-tag" onclick="this.parentElement.remove()">&times;</span>`;
        tagsContainer.appendChild(tag);
    });
}

// ===============================
// PAINEL DO ADMINISTRADOR
// ===============================
// ATUALIZADO: Carrega turmas primeiro para cache e filtros
async function carregarDadosAdmin() { 
    // Garante que o primeiro botão da sidebar esteja ativo
    document.querySelector('.admin-sidebar button').classList.add('active');
    await carregarTurmas(); 
    await carregarUsuarios('professor'); 
    await carregarUsuarios('aluno'); 
}

function mostrarSecao(secao) { 
    // Atualiza o estado ativo da sidebar
    document.querySelectorAll('.admin-sidebar button').forEach(btn => {
        if (btn.onclick && btn.onclick.toString().includes(`mostrarSecao('${secao}')`)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Mostra/Esconde seções
    document.querySelectorAll('.painel').forEach(s => s.id === secao ? s.classList.remove('hidden') : s.classList.add('hidden')); 
}

// ATUALIZADO: Renderiza em tabela.
async function carregarTurmas() {
    try {
        const turmas = await (await apiFetch('/turmas'));
        turmasCache = turmas; // Armazena globalmente
        
        const tabelaEl = document.getElementById("tabelaTurmas");
        
        let tabelaHTML = `
            <thead>
                <tr>
                    <th>Nome da Turma</th>
                    <th>Descrição</th>
                    <th>Ano</th>
                    <th>Professores Associados</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody>
        `;
        
        if (turmas.length === 0) {
            tabelaHTML += `<tr><td colspan="5">Nenhuma turma cadastrada.</td></tr>`;
        } else {
            tabelaHTML += turmas.map(turma => {
                // professor_nome vem da correção no backend/routes/turmas.js
                const professores = turma.professor_nome || 'N/A'; 
                return `
                    <tr>
                        <td>${turma.nome}</td>
                        <td>${turma.descricao || 'Sem descrição'}</td>
                        <td>${turma.ano}</td>
                        <td>${professores}</td>
                        <td>
                            <div>
                                <button onclick='abrirModalTurma(${JSON.stringify(turma)})'>Editar</button>
                                <button onclick="excluirTurma(${turma.id_turma})" class="btn-excluir">Excluir</button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }
        
        tabelaHTML += `</tbody>`;
        tabelaEl.innerHTML = tabelaHTML;

    } catch (e) { 
        console.error(e);
        document.getElementById("tabelaTurmas").innerHTML = '<tbody><tr><td colspan="5">Erro ao carregar turmas.</td></tr></tbody>';
    }
}

async function excluirTurma(id) {
    if (!confirm("Tem certeza que deseja excluir esta turma? Isso excluirá todas as associações de professores e alunos, chamadas e notas relacionadas.")) return;
    await apiFetch(`/turmas/${id}`, 'DELETE');
    alert('✅ Turma excluída!');
    carregarTurmas();
}

// ATUALIZADO: Recebe idTurmaFiltro e renderiza em tabela com base no perfil.
async function carregarUsuarios(perfil, idTurmaFiltro = 'todos') {
    try {
        const usuarios = await (await apiFetch('/usuarios'));
        const tabelaId = perfil === 'professor' ? 'tabelaProfessores' : 'tabelaAlunos';
        const tabelaEl = document.getElementById(tabelaId);
        let usuariosFiltrados = usuarios.filter(u => u.perfil === perfil);

        if (perfil === 'aluno') {
            const filtroEl = document.getElementById('filtroTurmaAluno');
            
            // Popula o filtro de turmas na primeira vez que a seção de alunos é carregada
            if (filtroEl.options.length === 0) {
                filtroEl.innerHTML = `<option value="todos">Todas as Turmas</option>` +
                    turmasCache.map(t => `<option value="${t.id_turma}">${t.nome}</option>`).join('');
            }

            // Garante que o valor do select corresponda ao filtro aplicado
            filtroEl.value = idTurmaFiltro;

            // Aplica o filtro de turma
            if (idTurmaFiltro !== 'todos') {
                // Filtra os alunos que têm o id_turma correspondente
                usuariosFiltrados = usuariosFiltrados.filter(u => String(u.id_turma) === String(idTurmaFiltro));
            }
        }
        
        // Renderiza a tabela
        let tabelaHTML = `<thead><tr><th>Nome</th><th>Email</th>`;
        if (perfil === 'aluno') {
            tabelaHTML += `<th>Turma</th>`;
        }
        tabelaHTML += `<th>Ações</th></tr></thead><tbody>`;
        
        if (usuariosFiltrados.length === 0) {
             tabelaHTML += `<tr><td colspan="${perfil === 'aluno' ? 4 : 3}">Nenhum ${perfil} encontrado.</td></tr>`;
        } else {
            tabelaHTML += usuariosFiltrados.map(usuario => {
                let infoExtra = '';
                if (perfil === 'aluno') {
                    infoExtra = `<td>${usuario.turma_nome || 'Sem turma'}</td>`;
                }
                return `
                    <tr>
                        <td>${usuario.nome}</td>
                        <td>${usuario.email}</td>
                        ${infoExtra}
                        <td>
                            <div>
                                <button onclick='abrirModalUsuario("${perfil}", ${JSON.stringify(usuario)})'>Editar</button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }
        
        tabelaHTML += `</tbody>`;
        tabelaEl.innerHTML = tabelaHTML;

    } catch (e) { 
        console.error(e);
        const tabelaId = perfil === 'professor' ? 'tabelaProfessores' : 'tabelaAlunos';
        document.getElementById(tabelaId).innerHTML = `<tbody><tr><td colspan="${perfil === 'aluno' ? 4 : 3}">Erro ao carregar usuários.</td></tr></tbody>`;
    }
}

/**
 * Filtra as tabelas de Professor e Aluno em tempo real com base no input de pesquisa.
 */
function filtrarTabela(perfil) {
    const inputId = perfil === 'professor' ? 'filtroProfessor' : 'filtroAluno';
    const tabelaId = perfil === 'professor' ? 'tabelaProfessores' : 'tabelaAlunos';
    
    const input = document.getElementById(inputId);
    const filter = input.value.toUpperCase();
    const table = document.getElementById(tabelaId);
    if (!table.tBodies || table.tBodies.length === 0) return;
    
    // Obtém todas as linhas do corpo da tabela, ignorando o cabeçalho
    const tr = table.tBodies[0].getElementsByTagName("tr");
    
    for (let i = 0; i < tr.length; i++) {
        // Assume que a primeira coluna é Nome e a segunda é Email
        const nomeCell = tr[i].getElementsByTagName("td")[0]; 
        const emailCell = tr[i].getElementsByTagName("td")[1]; 
        
        if (nomeCell || emailCell) {
            const nomeText = nomeCell.textContent || nomeCell.innerText;
            const emailText = emailCell.textContent || emailCell.innerText;
            
            // Verifica se o texto de pesquisa está contido no Nome OU no Email
            if (nomeText.toUpperCase().indexOf(filter) > -1 || emailText.toUpperCase().indexOf(filter) > -1) {
                tr[i].style.display = "";
            } else {
                tr[i].style.display = "none";
            }
        }       
    }
}


// ===============================
// LÓGICA PARA O PAINEL DO PROFESSOR
// ===============================

async function carregarDadosProfessor() {
    try {
        const turmas = await (await apiFetch('/turmas'));
        const listaTurmasProfessor = document.getElementById("listaTurmasProfessor");
        const turmasAgrupadas = turmas.reduce((acc, t) => {
            if (!acc[t.id_turma]) {
                acc[t.id_turma] = { id_turma: t.id_turma, nome: t.nome, ano: t.ano, materias: [] };
            }
            if (t.materia) {
                acc[t.id_turma].materias.push(t.materia);
            }
            return acc;
        }, {});

        if (Object.keys(turmasAgrupadas).length > 0) {
            listaTurmasProfessor.innerHTML = Object.values(turmasAgrupadas).map(turma => `
                <li class="turma-item">
                    <span>${turma.nome} (${turma.ano})</span>
                    <button onclick="selecionarTurma(${turma.id_turma}, '${turma.nome.replace(/'/g, "\\'")}', [${turma.materias.map(m => `'${m}'`).join(',')}])">Gerenciar</button>
                </li>`).join('');
        } else {
            listaTurmasProfessor.innerHTML = '<li>Você não está associado a nenhuma turma.</li>';
        }
    } catch (e) {
        console.error(e);
        document.getElementById("listaTurmasProfessor").innerHTML = '<li>Ocorreu um erro ao carregar as turmas.</li>';
    }
}

function selecionarTurma(id_turma, nome_turma, materias) {
    turmaSelecionadaGlobal = { id: id_turma, nome: nome_turma };
    
    // SUGESTÃO 1: Se houver apenas uma matéria, vai direto para a gestão da matéria.
    if (materias.length === 1) {
        // Redireciona imediatamente, chamando a função de gestão da matéria
        selecionarMateria(materias[0]);
        return; 
    }

    document.getElementById('listagem').classList.add('hidden');
    document.getElementById('detalhesTurma').classList.remove('hidden');
    document.getElementById('nomeTurmaSelecionada').textContent = `Turma: ${nome_turma}`;

    const listaMaterias = document.getElementById('listaMateriasProfessor');
    listaMaterias.innerHTML = materias.map(materia => `
        <li>
            <span>${materia.charAt(0).toUpperCase() + materia.slice(1)}</span>
            <button onclick="selecionarMateria('${materia}')">Gerenciar Matéria</button>
        </li>
    `).join('');
}

function fecharDetalhesTurma() {
    document.getElementById('listagem').classList.remove('hidden');
    document.getElementById('detalhesTurma').classList.add('hidden');
    document.getElementById('detalhesMateria').classList.add('hidden');
}

function selecionarMateria(materia) {
    materiaSelecionadaGlobal = materia;
    document.getElementById('detalhesTurma').classList.add('hidden');
    document.getElementById('detalhesMateria').classList.remove('hidden');
    document.getElementById('nomeMateriaSelecionada').textContent = `Matéria: ${materia.charAt(0).toUpperCase() + materia.slice(1)}`;

    document.getElementById('btnVerFaltas').onclick = () => verResumoDaMateria();
    document.getElementById('btnFazerChamada').onclick = () => verAlunosParaChamada();
    document.getElementById('btnLancarNotas').onclick = () => verAlunosParaNotas();
    
    verResumoDaMateria();
}

function fecharDetalhesMateria() {
    document.getElementById('detalhesMateria').classList.add('hidden');
    document.getElementById('detalhesTurma').classList.remove('hidden');
}

function esconderConteudosMateria() {
    document.getElementById('listaAlunosResumo').classList.add('hidden');
    document.getElementById('formChamada').classList.add('hidden');
    document.getElementById('conteudoNotas').classList.add('hidden');
}

async function verResumoDaMateria() {
    esconderConteudosMateria();
    const { id: id_turma } = turmaSelecionadaGlobal;
    const listaAlunosResumoEl = document.getElementById('listaAlunosResumo');
    listaAlunosResumoEl.classList.remove('hidden');
    listaAlunosResumoEl.innerHTML = '<li>Carregando resumo de faltas...</li>';

    try {
        const alunos = await (await apiFetch(`/turmas/${id_turma}/alunos`));
        const faltasPorMateria = await (await apiFetch(`/turmas/${id_turma}/alunos/faltas`));

        const faltasMap = faltasPorMateria.reduce((acc, aluno) => {
            if (aluno.materia === materiaSelecionadaGlobal) {
                acc[aluno.id_usuario] = aluno.total_faltas;
            }
            return acc;
        }, {});

        if (alunos.length > 0) {
            listaAlunosResumoEl.innerHTML = alunos.map(aluno => `<li class="chamada-item"><span>${aluno.nome}</span><span style="font-weight: bold;">Faltas: ${faltasMap[aluno.id_usuario] || 0}</span></li>`).join('');
        } else {
            listaAlunosResumoEl.innerHTML = '<li>Nenhum aluno matriculado nesta turma.</li>';
        }
    } catch (e) {
        console.error(e);
        listaAlunosResumoEl.innerHTML = '<li>Ocorreu um erro ao carregar o resumo da turma.</li>';
    }
}

async function verAlunosParaChamada() {
    esconderConteudosMateria();
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
        const alunos = await (await apiFetch(`/turmas/${id_turma}/alunos`));
        if (alunos.length === 0) {
            listaAlunosChamadaEl.innerHTML = '<li>Nenhum aluno matriculado nesta turma.</li>';
            return;
        }
        
        // SUGESTÃO PROFESSOR: Substituir Radio Buttons por Checkbox (Falta)
        listaAlunosChamadaEl.innerHTML = alunos.map(aluno => `
            <li class="chamada-item">
                <span>${aluno.nome}</span>
                <div class="chamada-options">
                    <input type="checkbox" id="falta_aluno_${aluno.id_usuario}" name="aluno_${aluno.id_usuario}" value="falta" class="input-falta"> 
                    <label for="falta_aluno_${aluno.id_usuario}">Marcar Falta</label>
                </div>
            </li>
        `).join('');
        
        try {
            const presencasDoDia = await (await apiFetch(`/chamadas/turma/${id_turma}/materia/${materiaSelecionadaGlobal}/data/${hoje}`));
            for (const id_aluno in presencasDoDia) {
                const status = presencasDoDia[id_aluno];
                // Se o status for 'falta', marca o checkbox. Caso contrário, deixa desmarcado (que representa 'presente').
                if (status === 'falta') {
                    const checkbox = document.getElementById(`falta_aluno_${id_aluno}`);
                    if (checkbox) checkbox.checked = true;
                }
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
    
    // SUGESTÃO PROFESSOR: Coleta de dados com Checkbox
    form.querySelectorAll('li.chamada-item').forEach(li => {
        const checkbox = li.querySelector('input[type="checkbox"]');
        if (!checkbox) return; // Garante que o elemento existe
        
        const id_aluno = checkbox.name.replace('aluno_', '');
        // Se o checkbox estiver marcado, o status é 'falta'. Se não estiver, é 'presente'.
        presencas[id_aluno] = checkbox.checked ? 'falta' : 'presente'; 
    });
    
    const payload = { id_turma, materia: materiaSelecionadaGlobal, data, presencas };
    try {
        const response = await apiFetch('/chamadas', 'POST', payload, true);
        if(response.ok) {
            alert('✅ Chamada salva com sucesso!');
            verResumoDaMateria();
        } else {
            const err = await response.json();
            alert(`❌ Erro ao salvar chamada: ${err.error}`);
        }
    } catch (e) {
        console.error(e);
        alert('⚠️ Ocorreu um erro de conexão ao salvar a chamada.');
    }
}

function calcularMedia(notas) {
    if (notas.length === 0) return null;
    const notasNumericas = notas.filter(nota => !isNaN(parseFloat(nota))).map(nota => parseFloat(nota));
    if (notasNumericas.length === 0) return null;
    const total = notasNumericas.reduce((sum, nota) => sum + nota, 0);
    return total / notasNumericas.length;
}

async function verAlunosParaNotas() {
    esconderConteudosMateria();
    const { id: id_turma } = turmaSelecionadaGlobal;
    const notasContainer = document.getElementById('conteudoNotas');
    notasContainer.classList.remove('hidden');
    notasContainer.innerHTML = '<li>Carregando notas...</li>';
    
    try {
        const alunosComNotas = await (await apiFetch(`/notas/turma/${id_turma}/materia/${materiaSelecionadaGlobal}`));
        alunosComNotasCache = alunosComNotas;

        if (alunosComNotas.length === 0) {
            notasContainer.innerHTML = "<p>Nenhum aluno encontrado nesta turma.</p>";
            return;
        }

        const avaliacoesSet = new Set();
        alunosComNotas.flatMap(a => a.avaliacoes).forEach(aval => {
            if (aval && aval.descricao && aval.trimestre) {
                avaliacoesSet.add(JSON.stringify({
                    descricao: String(aval.descricao),
                    trimestre: String(aval.trimestre)
                }));
            }
        });
        const avaliacoesUnicas = Array.from(avaliacoesSet).map(s => JSON.parse(s));

        const avaliacoesPorTrimestre = {};
        avaliacoesUnicas.forEach(av => {
            if (!avaliacoesPorTrimestre[av.trimestre]) {
                avaliacoesPorTrimestre[av.trimestre] = [];
            }
            avaliacoesPorTrimestre[av.trimestre].push(av);
        });
        
        const trimestresOrdenados = Object.keys(avaliacoesPorTrimestre).sort();

        let tabelaHTML = `
            <div id="controles-tabela">
                <button onclick="abrirModalAddAvaliacao()">Adicionar Avaliação</button>
                <div id="filtro-trimestre">
                    <span>Filtrar por Trimestre:</span>
                    <button class="btn-trimestre" data-trimestre="1">1º</button>
                    <button class="btn-trimestre" data-trimestre="2">2º</button>
                    <button class="btn-trimestre" data-trimestre="3">3º</button>
                    <button class="btn-trimestre active" data-trimestre="todos">Todos</button>
                </div>
            </div>
            <div class="tabela-notas-container">
                <table id="tabelaNotas">
                    <thead>
                        <tr>
                            <th rowspan="2">Aluno</th>
                            ${trimestresOrdenados.map(trimestre => {
                                const avs = avaliacoesPorTrimestre[trimestre];
                                return `<th colspan="${avs.length}" class="trimestre-header">${trimestre}º Trimestre</th>`;
                            }).join('')}
                            <th rowspan="2" class="media-destaque-header">Média Final</th>
                        </tr>
                        <tr>
                            ${trimestresOrdenados.map(trimestre => {
                                const avs = avaliacoesPorTrimestre[trimestre];
                                return avs.map((av, index) => {
                                    const isFirstInTrimestre = index === 0;
                                    const dividerClass = isFirstInTrimestre ? 'trimestre-divider' : '';
                                    return `<th class="nota-header ${dividerClass}" data-trimestre="${av.trimestre}">${av.descricao} <button class="btn-excluir-aval" data-desc="${av.descricao}">&times;
                                    </button></th>`;
                                }).join('');
                            }).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${alunosComNotas.map(aluno => `
                            <tr>
                                <td>${aluno.nome}</td>
                                ${trimestresOrdenados.map(trimestre => {
                                    const avaliacoesDoTrimestre = avaliacoesPorTrimestre[trimestre] || [];
                                    return avaliacoesDoTrimestre.map((avUnica, index) => {
                                        const nota = aluno.avaliacoes.find(n => 
                                            n.descricao === avUnica.descricao && n.trimestre == avUnica.trimestre
                                        )?.nota || '---';
                                        const isFirstInTrimestre = index === 0;
                                        const dividerClass = isFirstInTrimestre ? 'trimestre-divider' : '';
                                        return `<td class="${dividerClass}" data-trimestre="${avUnica.trimestre}">${nota}</td>`;
                                    }).join('');
                                }).join('')}
                                <td class="media-final media-destaque">${aluno.media_final !== null ? aluno.media_final.toFixed(2) : '---'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        notasContainer.innerHTML = tabelaHTML;

        document.querySelectorAll('.btn-trimestre').forEach(btn => {
            btn.addEventListener('click', (event) => {
                document.querySelectorAll('.btn-trimestre').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const trimestre = event.target.dataset.trimestre;
                filtrarTabelaPorTrimestre(trimestre);
            });
        });
        
        document.querySelectorAll('.btn-excluir-aval').forEach(btn => {
            btn.addEventListener('click', () => {
                const descricao = btn.dataset.desc;
                excluirAvaliacaoPorDescricao(descricao, id_turma);
            });
        });

    } catch (e) {
        console.error("Erro ao carregar notas no modal:", e);
        notasContainer.innerHTML = "<p>Erro ao carregar notas. Verifique a conexão com o servidor.</p>";
    }
}

function filtrarTabelaPorTrimestre(trimestre) {
    const tabela = document.getElementById('tabelaNotas');
    if (!tabela) return;

    const headers = tabela.querySelectorAll('th.nota-header');
    const trimestreHeaders = tabela.querySelectorAll('th.trimestre-header');
    const rows = tabela.querySelectorAll('tbody tr');
    
    headers.forEach(header => {
        const headerTrimestre = header.dataset.trimestre;
        if (trimestre === 'todos' || headerTrimestre === trimestre) {
            header.style.display = '';
        } else {
            header.style.display = 'none';
        }
    });

    trimestreHeaders.forEach(header => {
        const currentTrimestre = header.textContent.split('º')[0];
        if (trimestre === 'todos' || currentTrimestre === trimestre) {
            header.style.display = '';
            const visibleNotesCount = Array.from(headers).filter(h => h.dataset.trimestre === currentTrimestre && h.style.display !== 'none').length;
            header.setAttribute('colspan', visibleNotesCount);
        } else {
            header.style.display = 'none';
        }
    });

    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        const notasDoTrimestre = [];
        
        for (let i = 1; i < cells.length - 1; i++) {
            const header = headers[i - 1];
            const notaCell = cells[i];

            if (header.style.display === 'none') {
                notaCell.style.display = 'none';
            } else {
                notaCell.style.display = '';
                const nota = notaCell.textContent.trim();
                if (nota !== '---') {
                    notasDoTrimestre.push(nota);
                }
            }
        }
        
        const mediaFinalCell = row.querySelector('.media-final');
        const novaMedia = calcularMedia(notasDoTrimestre);
        mediaFinalCell.textContent = novaMedia !== null ? novaMedia.toFixed(2) : '---';
    });
}

async function abrirModalAddAvaliacao() {
    const { id: id_turma } = turmaSelecionadaGlobal;
    const modalTitulo = document.getElementById('modal-notas-titulo');
    const modalCorpo = document.getElementById('modal-notas-corpo');

    modalTitulo.textContent = `Nova Avaliação para ${materiaSelecionadaGlobal.charAt(0).toUpperCase() + materiaSelecionadaGlobal.slice(1)}`;
    modalCorpo.innerHTML = `<p>Carregando alunos...</p>`;
    notasModal.style.display = 'flex';

    try {
        const alunos = await (await apiFetch(`/turmas/${id_turma}/alunos`));

        if (alunos.length === 0) {
            modalCorpo.innerHTML = "<p>Nenhum aluno encontrado nesta turma.</p>";
            return;
        }

        modalCorpo.innerHTML = `
            <form id="form-lancar-em-lote">
                <h4>Adicionar Notas para todos os alunos</h4>
                <input type="text" id="nova-avaliacao-descricao" placeholder="Descrição da Avaliação" required>
                <select id="trimestre" required>
                    <option value="" disabled selected>Selecione o Trimestre</option>
                    <option value="1">1º Trimestre</option>
                    <option value="2">2º Trimestre</option>
                    <option value="3">3º Trimestre</option>
                </select>
                <div class="tabela-lancar-notas-container">
                    <table class="tabela-lancar-notas">
                        <thead><tr><th>Aluno</th><th>Nota</th></tr></thead>
                        <tbody>
                            ${alunos.map(aluno => `
                                <tr>
                                    <td>${aluno.nome}</td>
                                    <td>
                                        <input type="number" step="0.1" min="0" max="10" name="nota_${aluno.id_usuario}" placeholder="Nota" required>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <button type="submit">Lançar Avaliação</button>
            </form>
        `;
        
        document.getElementById('form-lancar-em-lote').onsubmit = async (event) => {
            event.preventDefault();
            const descricao = document.getElementById('nova-avaliacao-descricao').value;
            const trimestre = document.getElementById('trimestre').value;
            const notas = [];
            const form = event.target;
            form.querySelectorAll('input[type="number"]').forEach(input => {
                const id_aluno = input.name.replace('aluno_', '');
                notas.push({ id_aluno: parseInt(id_aluno), nota: parseFloat(input.value) });
            });
            
            const payload = { id_turma, materia: materiaSelecionadaGlobal, descricao, trimestre, notas };
            
            const response = await apiFetch('/notas/lancar-em-lote', 'POST', payload, true);
            if (response.ok) {
                alert('✅ Avaliação lançada com sucesso!');
                fecharModalNotas();
            } else {
                alert('❌ Erro ao lançar avaliação.');
            }
        };
    } catch (e) {
        console.error("Erro ao carregar modal de avaliação:", e);
        modalCorpo.innerHTML = "<p>Erro ao carregar modal. Verifique a conexão com o servidor.</p>";
    }
}

async function excluirAvaliacaoPorDescricao(descricao, id_turma) {
    if (!confirm(`Tem certeza que deseja excluir todas as notas da avaliação "${descricao}" desta turma?`)) {
        return;
    }

    try {
        const alunosComNotas = await (await apiFetch(`/notas/turma/${id_turma}/materia/${materiaSelecionadaGlobal}`));
        const avaliacoesParaExcluir = alunosComNotas.flatMap(aluno => aluno.avaliacoes)
                                                   .filter(av => av.descricao === descricao)
                                                   .map(av => av.id_avaliacao);

        if (avaliacoesParaExcluir.length > 0) {
            await Promise.all(avaliacoesParaExcluir.map(id => apiFetch(`/notas/${id}`, 'DELETE')));
            alert('✅ Avaliações excluídas com sucesso!');
            verAlunosParaNotas();
        } else {
            alert('Nenhuma avaliação encontrada com essa descrição.');
        }

    } catch (e) {
        console.error("Erro ao excluir avaliações:", e);
        alert('❌ Erro ao excluir avaliações.');
    }
}

// ===============================
// LÓGICA PARA O PAINEL DO ALUNO (ATUALIZADO)
// ===============================

let dadosCompletosAluno = { notas: [], presencas: [] };

/**
 * Função Auxiliar (SUGESTÃO 1) para calcular Média Final e Total de Faltas
 */
function calcularKPIsAluno(notas, presencas) {
    const notasPorMateria = notas.reduce((acc, nota) => {
        const materia = nota.materia;
        const trimestre = String(nota.trimestre);
        if (!acc[materia]) acc[materia] = { mediasTrimestrais: {} };
        if (!acc[materia].mediasTrimestrais[trimestre]) acc[materia].mediasTrimestrais[trimestre] = [];
        acc[materia].mediasTrimestrais[trimestre].push(parseFloat(nota.nota));
        return acc;
    }, {});

    let mediasFinaisMateria = [];
    for (const materia in notasPorMateria) {
        let mediasTrimestrais = [];
        for (const trimestre in notasPorMateria[materia].mediasTrimestrais) {
            const notas = notasPorMateria[materia].mediasTrimestrais[trimestre];
            const mediaTrimestre = notas.reduce((sum, n) => sum + n, 0) / notas.length;
            mediasTrimestrais.push(mediaTrimestre);
        }
        if (mediasTrimestrais.length > 0) {
            const mediaFinal = mediasTrimestrais.reduce((sum, m) => sum + m, 0) / mediasTrimestrais.length;
            mediasFinaisMateria.push(mediaFinal);
        }
    }

    const mediaFinalAcumulada = mediasFinaisMateria.length > 0 
        ? (mediasFinaisMateria.reduce((sum, m) => sum + m, 0) / mediasFinaisMateria.length).toFixed(1)
        : '---';

    const totalFaltas = presencas.filter(p => p.status === 'falta').length;

    return { mediaFinalAcumulada, totalFaltas };
}


async function carregarDadosAluno() {
    const turmaEl = document.getElementById('turmaAluno');
    
    try {
        // As chamadas API agora retornam o JSON de dados diretamente
        const [turmas, presencas, notas] = await Promise.all([
            apiFetch('/turmas'),
            apiFetch('/chamadas/me'),
            apiFetch('/notas/me')
        ]);
        
        if (turmas.length > 0) {
            turmaEl.textContent = `${turmas[0].nome} (${turmas[0].ano})`;
        } else {
            turmaEl.textContent = 'Você não está matriculado em nenhuma turma.';
        }

        // Os dados de presença agora contêm objetos Date, mas serão tratados nas funções de renderização
        dadosCompletosAluno.notas = notas;
        dadosCompletosAluno.presencas = presencas;

        // SUGESTÃO 1: Calcular e Renderizar KPIs
        const kpis = calcularKPIsAluno(notas, presencas);
        document.getElementById('kpiMedia').textContent = `Média Final: ${kpis.mediaFinalAcumulada}`;
        document.getElementById('kpiFaltas').textContent = `Faltas Totais: ${kpis.totalFaltas}`;

        const materiasUnicas = new Set(dadosCompletosAluno.notas.map(n => n.materia).concat(dadosCompletosAluno.presencas.map(p => p.materia)));
        // Garantir que 'todos' esteja selecionado
        const materiasDisponiveis = ['todos', ...Array.from(materiasUnicas)].map(m => {
            const isSelected = m === 'todos' ? 'selected' : '';
            return `<option value="${m}" ${isSelected}>${m.charAt(0).toUpperCase() + m.slice(1)}</option>`;
        }).join('');
        
        document.getElementById('filtroMateriaNotas').innerHTML = materiasDisponiveis;
        document.getElementById('filtroMateriaFaltas').innerHTML = materiasDisponiveis;
        
        // Garantir que os filtros estejam definidos antes de renderizar
        document.getElementById('filtroMateriaNotas').value = 'todos';
        document.getElementById('filtroMateriaFaltas').value = 'todos';
        
        const trimestresUnicos = new Set(dadosCompletosAluno.notas.map(n => n.trimestre).filter(t => t !== null));
        // Garantir que 'todos' esteja selecionado
        const trimestresDisponiveis = ['todos', ...Array.from(trimestresUnicos).sort()].map(t => {
            const isSelected = t === 'todos' ? 'selected' : '';
            return `<option value="${t}" ${isSelected}>${t === 'todos' ? 'Todos' : t + 'º Trimestre'}</option>`;
        }).join('');
        
        document.getElementById('filtroTrimestreNotas').innerHTML = trimestresDisponiveis;
        document.getElementById('filtroTrimestreNotas').value = 'todos'; // Corrigido para selecionar o valor 'todos'

        // A seção Notas é exibida por padrão. 
        mostrarSecaoAluno('notas');
        
    } catch (e) {
        console.error(e);
        turmaEl.textContent = 'Erro ao carregar dados.';
        document.getElementById('conteudoNotasAluno').innerHTML = '<p>Erro ao carregar notas.</p>';
        document.getElementById('conteudoFaltasAluno').innerHTML = '<p>Erro ao carregar faltas.</p>';
    }
}

function mostrarSecaoAluno(secao) {
    // CORREÇÃO CRÍTICA: Remove a classe 'active' de todos os painéis e adiciona ao alvo,
    // garantindo que a regra CSS (.painel-aluno.active { display: block; }) funcione.
    document.querySelectorAll('.painel-aluno').forEach(s => {
        s.classList.add('hidden'); 
        s.classList.remove('active');
    });

    const targetSection = document.getElementById(`secao${secao.charAt(0).toUpperCase() + secao.slice(1)}`);
    // Adiciona a classe 'active' e remove 'hidden' no painel alvo para exibi-lo.
    targetSection.classList.add('active');
    targetSection.classList.remove('hidden');

    document.querySelectorAll('.aluno-nav button').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.aluno-nav button[onclick="mostrarSecaoAluno('${secao}')"]`).classList.add('active');

    if (secao === 'notas') {
        renderizarNotasAluno();
    } else if (secao === 'faltas') {
        renderizarFaltasAluno();
    }
    // Não é necessário renderizar Tarefas, pois o HTML já contém o placeholder inicial.
}

/**
 * Função Auxiliar (SUGESTÃO 2) para obter a classe CSS da nota.
 */
function getNotaClass(nota) {
    if (nota === '---' || isNaN(parseFloat(nota))) return '';
    const valor = parseFloat(nota);
    // Assumindo critérios de aprovação: >= 7.0, Recuperação: 5.0 - 6.9, Reprovação: < 5.0
    if (valor >= 7.0) return 'nota-aprovado';
    if (valor >= 5.0 && valor < 7.0) return 'nota-recuperacao';
    return 'nota-reprovado';
}


function renderizarNotasAluno() {
    const conteudoNotas = document.getElementById('conteudoNotasAluno');
    const materiaSelecionada = document.getElementById('filtroMateriaNotas').value;
    const trimestreSelecionado = document.getElementById('filtroTrimestreNotas').value;

    // 1. Filtrar as notas
    const notasFiltradas = dadosCompletosAluno.notas.filter(nota => {
        const porMateria = materiaSelecionada === 'todos' || nota.materia === materiaSelecionada;
        const porTrimestre = trimestreSelecionado === 'todos' || nota.trimestre == trimestreSelecionado;
        return porMateria && porTrimestre;
    });

    if (notasFiltradas.length === 0) {
        conteudoNotas.innerHTML = '<p>Nenhuma nota encontrada com os filtros selecionados.</p>';
        return;
    }

    let html = '';

    // =========================================================================
    // CASE 1: FILTRO POR TRIMESTRE (e Matéria é 'todos') -> Matéria x Avaliação
    // =========================================================================
    if (trimestreSelecionado !== 'todos' && materiaSelecionada === 'todos') {
        // Agrupar por Matéria para obter a lista de matérias na linha
        const notasAgrupadasPorMateria = notasFiltradas.reduce((acc, nota) => {
            const materia = nota.materia;
            if (!acc[materia]) {
                acc[materia] = { nome: materia, avaliacoes: [] };
            }
            // Adiciona a nota completa (que inclui descrição)
            acc[materia].avaliacoes.push(nota);
            return acc;
        }, {});

        // Coletar todas as descrições de avaliações únicas (colunas)
        const avaliacoesUnicasSet = new Set(notasFiltradas.map(n => n.descricao));
        const avaliacoesUnicas = Array.from(avaliacoesUnicasSet).sort();

        html = `
            <div class="resumo-media">Notas do ${trimestreSelecionado}º Trimestre (Matéria x Avaliação)</div>
            <div class="tabela-notas-container">
                <table class="tabela-notas-aluno">
                    <thead>
                        <tr>
                            <th>Matéria</th>
                            ${avaliacoesUnicas.map(desc => `<th>${desc}</th>`).join('')}
                            <th>Média Trimestral</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.keys(notasAgrupadasPorMateria).sort().map(materiaKey => {
                            const dadosMateria = notasAgrupadasPorMateria[materiaKey];
                            const nomeMateria = dadosMateria.nome.charAt(0).toUpperCase() + dadosMateria.nome.slice(1);
                            
                            let notasDoTrimestre = []; // Para calcular a média
                            
                            const rowData = avaliacoesUnicas.map(desc => {
                                // Encontra a nota para esta descrição
                                const notaObj = dadosMateria.avaliacoes.find(n => n.descricao === desc);
                                const nota = notaObj ? parseFloat(notaObj.nota) : '---';
                                // Só adiciona ao cálculo da média se for um número válido
                                if (nota !== '---' && !isNaN(nota)) notasDoTrimestre.push(nota);
                                const notaDisplay = nota !== '---' ? nota.toFixed(1) : '---';
                                // SUGESTÃO 2: Aplicar Destaque
                                return `<td class="${getNotaClass(notaDisplay)}">${notaDisplay}</td>`;
                            }).join('');

                            const mediaTrimestral = notasDoTrimestre.length > 0
                                ? (notasDoTrimestre.reduce((sum, n) => sum + n, 0) / notasDoTrimestre.length).toFixed(1)
                                : '---';
                            
                            // SUGESTÃO 2: Aplicar Destaque na Média
                            return `
                                <tr>
                                    <td>${nomeMateria}</td>
                                    ${rowData}
                                    <td class="${getNotaClass(mediaTrimestral)}" style="font-weight: bold;">${mediaTrimestral}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } 
    // =========================================================================
    // CASE 2: FILTRO POR MATÉRIA (e Trimestre é 'todos') -> Avaliação x Trimestre
    // =========================================================================
    else if (materiaSelecionada !== 'todos' && trimestreSelecionado === 'todos') {
        const nomeMateria = materiaSelecionada.charAt(0).toUpperCase() + materiaSelecionada.slice(1);
        
        // Coletar todas as descrições de avaliações únicas (linhas)
        const avaliacoesUnicasSet = new Set(notasFiltradas.map(n => n.descricao));
        const avaliacoesUnicas = Array.from(avaliacoesUnicasSet).sort();

        // Agrupar por Descrição para facilitar o preenchimento das linhas
        const notasAgrupadasPorDescricao = notasFiltradas.reduce((acc, nota) => {
            if (!acc[nota.descricao]) {
                acc[nota.descricao] = { notas: {}, mediasTrimestrais: [] };
            }
            const notaValor = parseFloat(nota.nota);
            acc[nota.descricao].notas[String(nota.trimestre)] = notaValor;
            return acc;
        }, {});

        const trimestresPadrao = ['1', '2', '3'];
        let notasParaMediaFinal = {}; // {trimestre: [notas]} para calcular as médias trimestrais

        html = `
            <div class="resumo-media">Notas de ${nomeMateria} (Avaliação x Trimestre)</div>
            <div class="tabela-notas-container">
                <table class="tabela-notas-aluno">
                    <thead>
                        <tr>
                            <th>Avaliação</th>
                            <th>1º Trimestre</th>
                            <th>2º Trimestre</th>
                            <th>3º Trimestre</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${avaliacoesUnicas.map(descricao => {
                            const dadosAvaliacao = notasAgrupadasPorDescricao[descricao];
                            
                            const rowData = trimestresPadrao.map(trimestre => {
                                const nota = dadosAvaliacao.notas[trimestre];
                                const notaDisplay = nota !== undefined ? nota.toFixed(1) : '---';

                                if (nota !== undefined) {
                                    if (!notasParaMediaFinal[trimestre]) notasParaMediaFinal[trimestre] = [];
                                    // Adiciona as notas de cada avaliação para calcular a média do trimestre
                                    notasParaMediaFinal[trimestre].push(nota); 
                                }
                                // SUGESTÃO 2: Aplicar Destaque
                                return `<td class="${getNotaClass(notaDisplay)}">${notaDisplay}</td>`;
                            }).join('');
                            
                            return `
                                <tr>
                                    <td>${descricao}</td>
                                    ${rowData}
                                </tr>
                            `;
                        }).join('')}
                        <tr>
                           <td style="font-weight: bold;">Média Trimestral</td>
                           ${trimestresPadrao.map(trimestre => {
                               const notas = notasParaMediaFinal[trimestre] || [];
                               const media = notas.length > 0
                                   ? (notas.reduce((sum, n) => sum + n, 0) / notas.length).toFixed(1)
                                   : '---';
                                // SUGESTÃO 2: Aplicar Destaque na Média
                               return `<td class="${getNotaClass(media)}" style="font-weight: bold;">${media}</td>`;
                           }).join('')}
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
    } 
    // =========================================================================
    // CASE 3: SEM FILTRO (ou filtros mistos) -> Matéria x Trimestre (Report Card)
    // =========================================================================
    else {
        // Agrupar notas por Matéria e Trimestre e calcular as médias
        const notasAgrupadasPorMateria = notasFiltradas.reduce((acc, nota) => {
            const materia = nota.materia;
            const trimestre = String(nota.trimestre);
            if (!acc[materia]) {
                acc[materia] = { notasPorTrimestre: {} };
            }
            if (!acc[materia].notasPorTrimestre[trimestre]) {
                acc[materia].notasPorTrimestre[trimestre] = [];
            }
            acc[materia].notasPorTrimestre[trimestre].push(parseFloat(nota.nota));
            return acc;
        }, {});
        
        // Define o título do bloco
        const titulo = (materiaSelecionada !== 'todos' && trimestreSelecionado !== 'todos') 
            ? `Notas de ${materiaSelecionada.charAt(0).toUpperCase() + materiaSelecionada.slice(1)} no ${trimestreSelecionado}º Trimestre`
            : 'BOLETIM ESCOLAR SIMPLIFICADO';

        html = `
            <div class="resumo-media">${titulo}</div>
            <div class="tabela-notas-container">
                <table class="tabela-notas-aluno">
                    <thead>
                        <tr>
                            <th>Componentes Curriculares</th>
                            <th>1º Trimestre</th>
                            <th>2º Trimestre</th>
                            <th>3º Trimestre</th>
                            <th>Média Final</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        for (const materia in notasAgrupadasPorMateria) {
            const dadosMateria = notasAgrupadasPorMateria[materia];
            const nomeMateria = materia.charAt(0).toUpperCase() + materia.slice(1);
            const trimestresPadrao = ['1', '2', '3'];
            let todasMediasTrimestrais = []; // Para calcular a média final (apenas trimestres válidos)

            const rowData = trimestresPadrao.map(trimestre => {
                const notas = dadosMateria.notasPorTrimestre[trimestre];
                let cellContent = '---';
                let mediaTrimestre = '---';
                
                if (notas && notas.length > 0) {
                    mediaTrimestre = notas.reduce((sum, n) => sum + n, 0) / notas.length;
                    cellContent = mediaTrimestre.toFixed(1);
                    todasMediasTrimestrais.push(mediaTrimestre); // Adiciona para o cálculo da média final
                }
                
                // SUGESTÃO 2: Aplicar Destaque
                return `<td class="${getNotaClass(cellContent)}">${cellContent}</td>`;
            }).join('');

            // 3. Calcular Média Final (Média de todos os trimestres com nota)
            const mediaFinalMateria = todasMediasTrimestrais.length > 0
                ? todasMediasTrimestrais.reduce((sum, m) => sum + m, 0) / todasMediasTrimestrais.length
                : '---';
            
            const finalCellDisplay = mediaFinalMateria !== '---' ? mediaFinalMateria.toFixed(1) : '---';
            // SUGESTÃO 2: Aplicar Destaque
            const finalCell = `<td class="${getNotaClass(finalCellDisplay)}" style="font-weight: bold;">${finalCellDisplay}</td>`;

            html += `
                <tr>
                    <td>${nomeMateria}</td>
                    ${rowData}
                    ${finalCell}
                </tr>
            `;
        }

        html += `
                    </tbody>
                </table>
            </div>
        `;
    }

    conteudoNotas.innerHTML = html;
}

function renderizarFaltasAluno() {
    const conteudoFaltas = document.getElementById('conteudoFaltasAluno');
    const materiaSelecionada = document.getElementById('filtroMateriaFaltas').value;
    
    // 1. Filtrar registros de presença/falta
    const presencasFiltradas = dadosCompletosAluno.presencas.filter(p => {
        if (!p.materia || typeof p.materia !== 'string') {
            return false;
        }
        return materiaSelecionada === 'todos' || p.materia === materiaSelecionada;
    });

    if (presencasFiltradas.length === 0) {
        conteudoFaltas.innerHTML = '<p>Nenhum registro de chamada encontrado com os filtros selecionados.</p>';
        return;
    }

    // 2. Agrupar faltas por Matéria e Trimestre
    const faltasAgrupadas = presencasFiltradas.reduce((acc, p) => {
        const materia = p.materia;
        // O trimestre é inferido, pois a API retorna apenas a data
        const trimestre = getTrimestreFromDate(p.data);

        if (!acc[materia]) {
            acc[materia] = { '1': 0, '2': 0, '3': 0, 'total': 0, faltasDetalhe: [] };
        }

        if (p.status === 'falta') {
            if (trimestre) {
                acc[materia][trimestre] += 1;
            }
            acc[materia]['total'] += 1;
            acc[materia].faltasDetalhe.push({ data: p.data, materia: p.materia, trimestre: trimestre });
        }
        return acc;
    }, {});
    
    const materiasParaExibir = Object.keys(faltasAgrupadas).sort();

    let html = `
        <div class="resumo-media">Resumo de Faltas por Trimestre</div>
        <div class="tabela-notas-container">
            <table class="tabela-notas-aluno">
                <thead>
                    <tr>
                        <th>Matéria</th>
                        <th>1º Trimestre</th>
                        <th>2º Trimestre</th>
                        <th>3º Trimestre</th>
                        <th>Total de Faltas</th>
                    </tr>
                </thead>
                <tbody>
    `;

    // 3. Gerar as linhas da tabela
    materiasParaExibir.forEach(materia => {
        const nomeMateria = materia.charAt(0).toUpperCase() + materia.slice(1);
        const dadosFaltas = faltasAgrupadas[materia];
        const totalFaltas = dadosFaltas.total;
        
        // Cor vermelha para o total de faltas (> 0) e verde/primária para 0 faltas
        const corTotalFaltas = totalFaltas > 0 ? '#F44336' : '#167D7F';
        
        html += `
            <tr>
                <td>${nomeMateria}</td>
                <td>${dadosFaltas['1']}</td>
                <td>${dadosFaltas['2']}</td>
                <td>${dadosFaltas['3']}</td>
                <td style="font-weight: bold; color: ${corTotalFaltas};">${totalFaltas}</td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>
    `;
    
    // SUGESTÃO 3: Lista Detalhada de Faltas (Mostrar a lista de datas abaixo da tabela)
    if (materiaSelecionada !== 'todos') {
        const dadosFaltasMateria = faltasAgrupadas[materiaSelecionada];
        
        if (dadosFaltasMateria && dadosFaltasMateria.faltasDetalhe.length > 0) {
            html += `
                <div class="lista-faltas-detalhada">
                    <h4>Registro Detalhado de Faltas em ${materiaSelecionada.charAt(0).toUpperCase() + materiaSelecionada.slice(1)} (${dadosFaltasMateria.total} faltas)</h4>
                    <ul>
                        ${dadosFaltasMateria.faltasDetalhe.sort((a, b) => new Date(a.data) - new Date(b.data)).map(falta => {
                            const dataFormatada = new Date(falta.data).toLocaleDateString('pt-BR');
                            return `
                                <li>
                                    <span>${dataFormatada}</span>
                                    <span style="color: #F44336; font-weight: 600;">Falta (T${falta.trimestre})</span>
                                </li>
                            `;
                        }).join('')}
                    </ul>
                </div>
            `;
        } else if (materiaSelecionada !== 'todos') {
             // Caso a matéria seja filtrada, mas não tenha faltas
             html += `<p style="margin-top: 1.5rem;">Nenhuma falta registrada para ${materiaSelecionada.charAt(0).toUpperCase() + materiaSelecionada.slice(1)}.</p>`;
        }
    } else {
        // Se estiver em 'todos' (visão geral), adiciona a lista detalhada completa de todas as faltas (ordenada por data)
        const todasFaltasDetalhes = presencasFiltradas.filter(p => p.status === 'falta')
            .map(p => ({ data: p.data, materia: p.materia, trimestre: getTrimestreFromDate(p.data) }));

        if (todasFaltasDetalhes.length > 0) {
             html += `
                <div class="lista-faltas-detalhada">
                    <h4>Todas as Faltas Registradas (${todasFaltasDetalhes.length} no total)</h4>
                    <ul>
                        ${todasFaltasDetalhes.sort((a, b) => new Date(a.data) - new Date(b.data)).map(falta => {
                            const dataFormatada = new Date(falta.data).toLocaleDateString('pt-BR');
                            const nomeMateria = falta.materia.charAt(0).toUpperCase() + falta.materia.slice(1);
                            return `
                                <li>
                                    <span>${dataFormatada} - ${nomeMateria}</span>
                                    <span style="color: #F44336; font-weight: 600;">Falta (T${falta.trimestre})</span>
                                </li>
                            `;
                        }).join('')}
                    </ul>
                </div>
            `;
        }
    }

    conteudoFaltas.innerHTML = html;
}

// ===============================
// FUNÇÕES AUXILIARES
// ===============================

/**
 * Inferir o trimestre com base no mês de uma data.
 * Nota: Esta é uma divisão acadêmica simplificada (Jan-Abr: 1º, Mai-Ago: 2º, Set-Dez: 3º).
 * @param {string} dateString - Data no formato string (ex: '2025-09-26T03:00:00.000Z')
 * @returns {string|null} O número do trimestre ('1', '2', '3') ou null se inválido.
 */
function getTrimestreFromDate(dateString) {
    // Usar a data local para instanciar, mas métodos UTC para consistência
    const date = new Date(dateString);
    const month = date.getUTCMonth() + 1; // getUTCMonth retorna 0-11

    // Divisão simplificada:
    if (month >= 1 && month <= 4) {
        return '1'; // 1º Trimestre (Jan, Fev, Mar, Abr)
    } else if (month >= 5 && month <= 8) {
        return '2'; // 2º Trimestre (Mai, Jun, Jul, Ago)
    } else if (month >= 9 && month <= 12) {
        return '3'; // 3º Trimestre (Set, Out, Nov, Dez)
    }
    return null; 
}


function calcularMedia(notas) {
    if (notas.length === 0) return null;
    const notasNumericas = notas.filter(nota => !isNaN(parseFloat(nota))).map(nota => parseFloat(nota));
    if (notasNumericas.length === 0) return null;
    const total = notasNumericas.reduce((sum, nota) => sum + nota, 0);
    return total / notasNumericas.length;
}

// ATENÇÃO: Função modificada para forçar o retorno do JSON e logar a resposta da API
async function apiFetch(endpoint, method = 'GET', body = null, returnResponseObject = false) {
    const token = localStorage.getItem("token");
    if (!token) { logout(); throw new Error("Token não encontrado."); }
    const options = { method, headers: { 'Authorization': `Bearer ${token}` } } ;
    if (body) { options.headers['Content-Type'] = 'application/json'; options.body = JSON.stringify(body); }
    const response = await fetch(`${API_URL}${endpoint}`, options);
    
    if (response.status === 401 || response.status === 403) { logout(); throw new Error("Não autorizado."); }

    if (returnResponseObject) {
         // Necessário para chamadas POST/PUT que só precisam do status.
         return response;
    }
    
    // Tentativa de ler a resposta JSON
    try {
        // Clona a resposta para permitir a leitura duplicada (log e consumo)
        const data = await response.clone().json();
        
        // LOG DE DIAGNÓSTICO CRÍTICO
        if (endpoint.includes('/me') || !response.ok) {
            console.log(`DIAGNÓSTICO API ${endpoint} (Status ${response.status}):`, data);
        }
        
        if (!response.ok && response.status !== 201) { 
            console.error("Erro na API", data); 
            // Lançar um erro para que a função chamadora possa usar o bloco catch
            throw new Error(data.error || `Erro de API com status ${response.status}`);
        }
        
        return data; // Retorna o JSON de dados
    } catch (e) {
        // Se a resposta for 204 No Content (sem JSON) ou se houver um erro de parsing
        if (response.status === 204) return [];
        
        console.error(`Erro ao processar JSON da API (${response.status} ${endpoint}):`, e);
        // Lançar um erro se não for possível ler o JSON e a resposta não for 204
        throw new Error(`Falha ao ler resposta da API para ${endpoint}.`);
    }
}