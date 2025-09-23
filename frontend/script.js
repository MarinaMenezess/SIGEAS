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
    document.getElementById('conteudoNotas').classList.add('hidden');
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

// Nova função para renderizar a tabela de notas na página
async function verAlunosParaNotas() {
    esconderConteudosTurma();
    const { id: id_turma, nome: nome_turma } = turmaSelecionadaGlobal;
    const notasContainer = document.getElementById('conteudoNotas');
    notasContainer.classList.remove('hidden');
    notasContainer.innerHTML = '<li>Carregando notas...</li>';
    
    try {
        const alunosComNotas = await (await apiFetch(`/notas/turma/${id_turma}`)).json();
        
        if (alunosComNotas.length === 0) {
            notasContainer.innerHTML = "<p>Nenhum aluno encontrado nesta turma.</p>";
            return;
        }

        const avaliacoesUnicas = Array.from(new Set(alunosComNotas.flatMap(a => a.avaliacoes.map(av => ({
            descricao: av.descricao,
            trimestre: av.trimestre,
            id: av.id_avaliacao
        })))));
        
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
                            <th>Aluno</th>
                            ${avaliacoesUnicas.map(av => `<th class="nota-header" data-trimestre="${av.trimestre}">${av.descricao} <button class="btn-excluir-aval" data-desc="${av.descricao}">&times;</button></th>`).join('')}
                            <th>Média Final</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${alunosComNotas.map(aluno => `
                            <tr>
                                <td>${aluno.nome}</td>
                                ${avaliacoesUnicas.map(av => {
                                    const nota = aluno.avaliacoes.find(alunoAv => alunoAv.descricao === av.descricao)?.nota || '---';
                                    const avaliacaoID = aluno.avaliacoes.find(alunoAv => alunoAv.descricao === av.descricao)?.id_avaliacao || null;
                                    return `<td data-id="${avaliacaoID}">${nota}</td>`;
                                }).join('')}
                                <td>${aluno.media_final !== null ? aluno.media_final.toFixed(2) : '---'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        notasContainer.innerHTML = tabelaHTML;

        // Adiciona os eventos de clique para os botões de filtro
        document.querySelectorAll('.btn-trimestre').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.btn-trimestre').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const trimestre = btn.dataset.trimestre;
                filtrarTabelaPorTrimestre(trimestre);
            });
        });
        
        // Adiciona o evento de clique para os botões de exclusão de avaliação
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

// Abre o modal APENAS para adicionar uma nova avaliação
async function abrirModalAddAvaliacao() {
    const { id: id_turma, nome: nome_turma } = turmaSelecionadaGlobal;
    const modalTitulo = document.getElementById('modal-notas-titulo');
    const modalCorpo = document.getElementById('modal-notas-corpo');

    modalTitulo.textContent = `Nova Avaliação para ${nome_turma}`;
    modalCorpo.innerHTML = `<p>Carregando alunos...</p>`;
    notasModal.style.display = 'flex';

    try {
        const alunos = await (await apiFetch(`/turmas/${id_turma}/alunos`)).json();

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
                <div class="tabela-notas-container">
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
                const id_aluno = input.name.replace('nota_', '');
                notas.push({ id_aluno: parseInt(id_aluno), nota: parseFloat(input.value) });
            });
            
            const payload = { id_turma, descricao, trimestre, notas };
            
            const response = await apiFetch('/notas/lancar-em-lote', 'POST', payload);
            if (response.ok) {
                alert('✅ Avaliação lançada com sucesso!');
                fecharModalNotas();
                verAlunosParaNotas(); // Recarrega a tabela na página
            } else {
                alert('❌ Erro ao lançar avaliação.');
            }
        };
    } catch (e) {
        console.error("Erro ao carregar modal de avaliação:", e);
        modalCorpo.innerHTML = "<p>Erro ao carregar modal. Verifique a conexão com o servidor.</p>";
    }
}

// Nova função para excluir uma avaliação por descrição e turma
async function excluirAvaliacaoPorDescricao(descricao, id_turma) {
    if (!confirm(`Tem certeza que deseja excluir todas as notas da avaliação "${descricao}" desta turma?`)) {
        return;
    }

    try {
        const alunosComNotas = await (await apiFetch(`/notas/turma/${id_turma}`)).json();
        const avaliacoesParaExcluir = alunosComNotas.flatMap(aluno => aluno.avaliacoes)
                                                   .filter(av => av.descricao === descricao)
                                                   .map(av => av.id_avaliacao);

        if (avaliacoesParaExcluir.length > 0) {
            await Promise.all(avaliacoesParaExcluir.map(id => apiFetch(`/notas/${id}`, 'DELETE')));
            alert('✅ Avaliações excluídas com sucesso!');
            verAlunosParaNotas(); // Recarrega a tabela
        } else {
            alert('Nenhuma avaliação encontrada com essa descrição.');
        }

    } catch (e) {
        console.error("Erro ao excluir avaliações:", e);
        alert('❌ Erro ao excluir avaliações.');
    }
}

// Função de filtragem (lógica no frontend)
function filtrarTabelaPorTrimestre(trimestre) {
    const tabela = document.getElementById('tabelaNotas');
    if (!tabela) return;

    const headers = tabela.querySelectorAll('th.nota-header');
    const rows = tabela.querySelectorAll('tbody tr');
    
    headers.forEach(header => {
        const headerTrimestre = header.dataset.trimestre;
        if (trimestre === 'todos' || headerTrimestre === trimestre) {
            header.style.display = '';
        } else {
            header.style.display = 'none';
        }
    });

    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        // Exibe/esconde as células correspondentes ao cabeçalho
        for (let i = 1; i < cells.length - 1; i++) { // Ignora a primeira e a última célula (aluno e média)
            const header = headers[i - 1];
            if (header.style.display === 'none') {
                cells[i].style.display = 'none';
            } else {
                cells[i].style.display = '';
            }
        }
    });
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