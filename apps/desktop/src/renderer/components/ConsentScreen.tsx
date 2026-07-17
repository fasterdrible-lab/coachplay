import React from 'react';

interface ConsentScreenProps {
  onAccept: () => void;
}

export function ConsentScreen({ onAccept }: ConsentScreenProps) {
  return (
    <div className="card" style={{ maxWidth: 640, margin: '40px auto' }}>
      <h1 style={{ marginTop: 0 }}>Antes de começar</h1>
      <p>O Coach Play Desktop captura apenas a imagem exibida na tela do seu PC:</p>
      <ul>
        <li>A janela do Xbox Remote Play, o monitor inteiro, ou uma área recortada — só o que você escolher a seguir.</li>
        <li>Não acessamos dados internos do Xbox, do EA FC, memória do jogo ou qualquer API privada.</li>
        <li>Não capturamos microfone nem webcam por padrão.</li>
        <li>Frames temporários são descartados ao encerrar a sessão, a menos que virem evidência de um evento que você optou por salvar.</li>
        <li>Nenhuma chave de IA fica neste aplicativo — a análise acontece no servidor, autenticada com sua conta.</li>
      </ul>
      <p>Você pode pausar ou encerrar a captura a qualquer momento.</p>
      <button className="btn btn-primary" onClick={onAccept}>
        Entendi, continuar
      </button>
    </div>
  );
}
