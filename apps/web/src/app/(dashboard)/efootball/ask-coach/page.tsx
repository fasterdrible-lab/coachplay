'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Bot, ChevronDown, Loader2, Send, Sparkles, User } from 'lucide-react';
import { api } from '../../../../lib/api';
import { BUILD_STRATEGIES, BUILD_STRATEGY_LABELS, formatAiCost, getEfootballGameId } from '../../../../lib/efootball';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { cn } from '../../../../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Squad {
  id: string;
  name: string;
}

interface Pack {
  id: string;
  name: string;
}

interface AskCoachAnswer {
  intent: string;
  answer: string;
  modelUsed: string | null;
  costEstimate: number;
}

interface ChatMessage {
  role: 'user' | 'coach';
  text: string;
  intent?: string;
  modelUsed?: string | null;
  costEstimate?: number;
}

const INTENT_LABELS: Record<string, string> = {
  PLAYER_SEARCH: 'Busca de jogador',
  BUILD_RECOMMENDATION: 'Build',
  SQUAD_ADVICE: 'Elenco',
  ECONOMY_ADVICE: 'Economia',
  LEARNING_RECOMMENDATION: 'Academia',
  UNKNOWN: 'Não identificado',
};

export default function AskCoachPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const [squads, setSquads] = useState<Squad[]>([]);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [userSquadId, setUserSquadId] = useState('');
  const [packId, setPackId] = useState('');
  const [userCoins, setUserCoins] = useState('');
  const [playerCardId, setPlayerCardId] = useState('');
  const [level, setLevel] = useState('');
  const [availableProgressionPoints, setAvailableProgressionPoints] = useState('');
  const [strategy, setStrategy] = useState('');

  useEffect(() => {
    getEfootballGameId()
      .then(async (gameId) => {
        const [squadsData, packsData] = await Promise.all([
          api.get<Squad[]>(`/squad-builder/squads?gameId=${gameId}`),
          api.get<Pack[]>(`/economy-advisor/packs?gameId=${gameId}`),
        ]);
        setSquads(squadsData);
        setPacks(packsData);
      })
      .catch(() => {
        // seletores avançados são opcionais — sem eles, o usuário ainda pode conversar
      });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || isSending) return;

    setMessages((prev) => [...prev, { role: 'user', text: trimmed }]);
    setQuestion('');
    setIsSending(true);
    setError(null);

    try {
      const data = await api.post<AskCoachAnswer>('/ask-coach', {
        question: trimmed,
        ...(userSquadId && { userSquadId }),
        ...(packId && { packId }),
        ...(userCoins && { userCoins: Number(userCoins) }),
        ...(playerCardId && { playerCardId }),
        ...(level && { level: Number(level) }),
        ...(availableProgressionPoints && { availableProgressionPoints: Number(availableProgressionPoints) }),
        ...(strategy && { strategy }),
      });
      setMessages((prev) => [
        ...prev,
        { role: 'coach', text: data.answer, intent: data.intent, modelUsed: data.modelUsed, costEstimate: data.costEstimate },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível falar com o Ask Coach agora.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-[#f8f8fc]">Ask Coach</h1>
        <p className="text-sm text-[#f8f8fc]/45">Pergunte sobre jogadores, builds, seu elenco, packs ou aulas da Academia</p>
      </div>

      <div className="mb-4 rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl">
        <button
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-[#f8f8fc]/70"
        >
          Detalhes avançados (opcional)
          <ChevronDown className={cn('h-4 w-4 transition-transform', showAdvanced && 'rotate-180')} />
        </button>
        {showAdvanced && (
          <div className="grid grid-cols-1 gap-3 border-t border-white/[0.06] p-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/80">Elenco</label>
              <select
                value={userSquadId}
                onChange={(e) => setUserSquadId(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-[#f8f8fc]"
              >
                <option value="" className="bg-ink2">Nenhum</option>
                {squads.map((s) => (
                  <option key={s.id} value={s.id} className="bg-ink2">{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/80">Pack</label>
              <select
                value={packId}
                onChange={(e) => setPackId(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-[#f8f8fc]"
              >
                <option value="" className="bg-ink2">Nenhum</option>
                {packs.map((p) => (
                  <option key={p.id} value={p.id} className="bg-ink2">{p.name}</option>
                ))}
              </select>
            </div>
            <Input label="Suas moedas" type="number" min={0} value={userCoins} onChange={(e) => setUserCoins(e.target.value)} />
            <Input label="ID da carta do jogador" value={playerCardId} onChange={(e) => setPlayerCardId(e.target.value)} />
            <Input label="Nível do jogador" type="number" min={1} value={level} onChange={(e) => setLevel(e.target.value)} />
            <Input
              label="Pontos de progressão"
              type="number"
              min={0}
              value={availableProgressionPoints}
              onChange={(e) => setAvailableProgressionPoints(e.target.value)}
            />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/80">Estratégia de build</label>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-[#f8f8fc]"
              >
                <option value="" className="bg-ink2">Padrão (balanceada)</option>
                {BUILD_STRATEGIES.map((s) => (
                  <option key={s} value={s} className="bg-ink2">{BUILD_STRATEGY_LABELS[s]}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="mb-4 flex-1 overflow-y-auto rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Sparkles className="mb-3 h-8 w-8 text-[#f8f8fc]/25" />
            <p className="text-sm text-[#f8f8fc]/45">Pergunte algo como &quot;quem é Messi?&quot; ou &quot;qual aula eu devo fazer agora?&quot;</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={cn('flex gap-2.5', m.role === 'user' && 'flex-row-reverse')}>
                <div
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                    m.role === 'user' ? 'bg-white/[0.08]' : 'bg-gold/15 text-gold-bright',
                  )}
                >
                  {m.role === 'user' ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                </div>
                <div className={cn('max-w-[75%] rounded-xl px-3.5 py-2.5 text-sm', m.role === 'user' ? 'bg-gold/15 text-[#f8f8fc]' : 'bg-white/[0.06] text-[#f8f8fc]/85')}>
                  <p>{m.text}</p>
                  {m.role === 'coach' && (
                    <p className="mt-1.5 text-xs text-[#f8f8fc]/35">
                      {INTENT_LABELS[m.intent ?? ''] ?? m.intent}
                      {m.modelUsed && ` · ${m.modelUsed}`}
                      {m.costEstimate !== undefined && m.costEstimate > 0 && ` · ${formatAiCost(m.costEstimate)}`}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {isSending && (
              <div className="flex items-center gap-2.5 text-sm text-[#f8f8fc]/45">
                <Loader2 className="h-4 w-4 animate-spin" />
                Pensando...
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {error && <p className="mb-2 text-sm text-[#e2718a]">{error}</p>}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Digite sua pergunta..."
          className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-[#f8f8fc] placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-gold/50"
        />
        <Button type="submit" isLoading={isSending} disabled={!question.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
