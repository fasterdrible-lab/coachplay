import { MESSAGE_TYPES, AuthenticatedUser, CaptureSessionSnapshot, MatchSummary } from '../shared/messages';

interface Response<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

function send<T>(type: string, extra: Record<string, unknown> = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, ...extra }, (response: Response<T>) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response?.ok) {
        reject(new Error(response?.error ?? 'Erro desconhecido'));
        return;
      }
      resolve(response.data as T);
    });
  });
}

const root = document.getElementById('root')!;

const STATE_LABELS: Record<CaptureSessionSnapshot['state'], string> = {
  idle: 'Inativo',
  starting: 'Iniciando...',
  running: 'Capturando',
  paused: 'Pausado',
  reconnecting: 'Reconectando...',
  stopping: 'Encerrando...',
  stopped: 'Encerrado',
  failed: 'Erro',
};

const PROVIDER_LABELS: Record<string, string> = {
  'tab-capture': 'captura direta da aba',
  'video-element': 'modo alternativo',
};

// Estados em que existe uma sessão "presente" o suficiente pra mostrar a tela ativa em vez da
// tela de seleção de partida — inclui os transitórios (starting/reconnecting/stopping), não só
// running/paused como antes.
const ACTIVE_STATES: CaptureSessionSnapshot['state'][] = ['starting', 'running', 'paused', 'reconnecting', 'stopping'];

async function render(): Promise<void> {
  root.innerHTML = '';

  let user: AuthenticatedUser | null = null;
  let expiredReason: string | null = null;
  try {
    const status = await send<{ user: AuthenticatedUser | null; expiredReason: string | null }>(
      MESSAGE_TYPES.AUTH_STATUS,
    );
    user = status.user;
    expiredReason = status.expiredReason;
  } catch {
    user = null;
  }

  if (!user) {
    renderLogin(expiredReason);
    return;
  }

  const snapshot = await send<CaptureSessionSnapshot | null>(MESSAGE_TYPES.CAPTURE_STATUS).catch(() => null);
  if (snapshot && ACTIVE_STATES.includes(snapshot.state)) {
    renderActiveSession(user, snapshot);
  } else {
    renderSelectMatch(user);
  }
}

function renderSelectMatch(user: AuthenticatedUser): void {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <h1>Vincular a uma partida</h1>
    <p>${user.name}</p>
    <p>Escolha uma partida pendente para receber os eventos desta captura, ou crie uma nova.</p>
    <div id="error" class="error"></div>
    <div class="actions">
      <input id="title" type="text" placeholder="Nome da nova partida (opcional)" />
      <button id="create">Nova partida</button>
    </div>
    <div id="matches">Carregando partidas...</div>
  `;
  root.appendChild(wrapper);

  const errorBox = wrapper.querySelector<HTMLDivElement>('#error')!;
  const titleInput = wrapper.querySelector<HTMLInputElement>('#title')!;
  const createBtn = wrapper.querySelector<HTMLButtonElement>('#create')!;
  const matchesBox = wrapper.querySelector<HTMLDivElement>('#matches')!;

  function goToStart(matchId: string): void {
    root.innerHTML = '';
    renderStart(user, matchId);
  }

  createBtn.addEventListener('click', async () => {
    errorBox.textContent = '';
    createBtn.disabled = true;
    try {
      const match = await send<MatchSummary>(MESSAGE_TYPES.MATCHES_CREATE, { title: titleInput.value.trim() || undefined });
      goToStart(match.id);
    } catch (err) {
      errorBox.textContent = err instanceof Error ? err.message : 'Não foi possível criar a partida.';
      createBtn.disabled = false;
    }
  });

  send<MatchSummary[]>(MESSAGE_TYPES.MATCHES_LIST)
    .then((matches) => {
      if (matches.length === 0) {
        matchesBox.textContent = 'Nenhuma partida pendente. Crie uma nova acima.';
        return;
      }
      matchesBox.innerHTML = '';
      matches.forEach((match) => {
        const item = document.createElement('button');
        item.className = 'secondary';
        item.style.display = 'block';
        item.style.width = '100%';
        item.style.marginBottom = '6px';
        item.textContent = match.title || 'Partida sem título';
        item.addEventListener('click', () => goToStart(match.id));
        matchesBox.appendChild(item);
      });
    })
    .catch((err) => {
      matchesBox.textContent = err instanceof Error ? err.message : 'Não foi possível carregar as partidas.';
    });
}

function renderLogin(expiredReason: string | null = null): void {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <h1>Entrar</h1>
    <p>Use a mesma conta do Coach Play.</p>
    <div id="error" class="error">${expiredReason ?? ''}</div>
    <form id="login-form">
      <label>E-mail
        <input id="email" name="username" type="email" autocomplete="username" required />
      </label>
      <label>Senha
        <div class="password-row">
          <input id="password" name="current-password" type="password" autocomplete="current-password" required />
          <button type="button" id="toggle-password" class="secondary" aria-label="Mostrar senha">👁</button>
        </div>
      </label>
      <button id="submit" type="submit">Entrar</button>
    </form>
  `;
  root.appendChild(wrapper);

  const form = wrapper.querySelector<HTMLFormElement>('#login-form')!;
  const emailInput = wrapper.querySelector<HTMLInputElement>('#email')!;
  const passwordInput = wrapper.querySelector<HTMLInputElement>('#password')!;
  const togglePasswordBtn = wrapper.querySelector<HTMLButtonElement>('#toggle-password')!;
  const errorBox = wrapper.querySelector<HTMLDivElement>('#error')!;
  const submitBtn = wrapper.querySelector<HTMLButtonElement>('#submit')!;

  // Chrome só oferece salvar a senha para um <form> de verdade que dispara o
  // evento "submit" — por isso o login usa form.addEventListener('submit'),
  // não um clique avulso no botão. O Coach Play nunca guarda a senha em disco
  // (mesmo princípio do apps/desktop); quem guarda/preenche é o próprio
  // gerenciador de senhas do navegador.
  togglePasswordBtn.addEventListener('click', () => {
    const willShow = passwordInput.type === 'password';
    passwordInput.type = willShow ? 'text' : 'password';
    togglePasswordBtn.textContent = willShow ? '🙈' : '👁';
    togglePasswordBtn.setAttribute('aria-label', willShow ? 'Ocultar senha' : 'Mostrar senha');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.textContent = '';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Entrando...';
    try {
      await send(MESSAGE_TYPES.AUTH_LOGIN, { email: emailInput.value, password: passwordInput.value });
      await render();
    } catch (err) {
      errorBox.textContent = err instanceof Error ? err.message : 'Não foi possível entrar.';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Entrar';
    }
  });
}

function renderStart(user: AuthenticatedUser, matchId: string): void {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <h1>Antes de começar</h1>
    <p>${user.name}</p>
    <p>
      Captura só a imagem exibida nesta aba do Xbox Remote Play. Não acessamos dados internos do
      Xbox/EA FC, memória do jogo ou API privada. Você pode encerrar a qualquer momento.
    </p>
    <div id="error" class="error"></div>
    <button id="start">Iniciar captura desta aba</button>
  `;
  root.appendChild(wrapper);

  const errorBox = wrapper.querySelector<HTMLDivElement>('#error')!;
  const startBtn = wrapper.querySelector<HTMLButtonElement>('#start')!;

  startBtn.addEventListener('click', async () => {
    errorBox.textContent = '';
    startBtn.disabled = true;
    try {
      await send(MESSAGE_TYPES.CAPTURE_START, { matchId });
      await render();
    } catch (err) {
      errorBox.textContent = err instanceof Error ? err.message : 'Não foi possível iniciar a captura.';
      startBtn.disabled = false;
    }
  });
}

function renderActiveSession(user: AuthenticatedUser, snapshot: CaptureSessionSnapshot): void {
  const wrapper = document.createElement('div');
  const isPaused = snapshot.state === 'paused';
  const actionsDisabled = snapshot.state === 'starting' || snapshot.state === 'reconnecting' || snapshot.state === 'stopping';
  const providerLabel = snapshot.provider ? PROVIDER_LABELS[snapshot.provider] : null;
  const statusLine = [STATE_LABELS[snapshot.state], providerLabel, `${snapshot.fps.analysisFps} FPS de análise`]
    .filter(Boolean)
    .join(' · ');

  wrapper.innerHTML = `
    <h1>Coach Play</h1>
    <p>${user.name}</p>
    <div class="status-row">
      <span class="status-dot status-${snapshot.state}"></span>
      <span>${statusLine}</span>
    </div>
    <div id="error" class="error">${snapshot.state === 'failed' && snapshot.errorMessage ? snapshot.errorMessage : ''}</div>
    <div class="actions">
      <button id="toggle" class="secondary" ${actionsDisabled ? 'disabled' : ''}>${isPaused ? 'Retomar' : 'Pausar'}</button>
      <button id="stop" class="danger" ${snapshot.state === 'stopping' ? 'disabled' : ''}>Encerrar</button>
    </div>
  `;
  root.appendChild(wrapper);

  const errorBox = wrapper.querySelector<HTMLDivElement>('#error')!;
  const toggleBtn = wrapper.querySelector<HTMLButtonElement>('#toggle')!;
  const stopBtn = wrapper.querySelector<HTMLButtonElement>('#stop')!;

  toggleBtn.addEventListener('click', async () => {
    errorBox.textContent = '';
    try {
      await send(isPaused ? MESSAGE_TYPES.CAPTURE_RESUME : MESSAGE_TYPES.CAPTURE_PAUSE);
      await render();
    } catch (err) {
      errorBox.textContent = err instanceof Error ? err.message : 'Ação falhou.';
    }
  });

  stopBtn.addEventListener('click', async () => {
    errorBox.textContent = '';
    try {
      await send(MESSAGE_TYPES.CAPTURE_STOP);
      await render();
    } catch (err) {
      errorBox.textContent = err instanceof Error ? err.message : 'Ação falhou.';
    }
  });
}

render();
