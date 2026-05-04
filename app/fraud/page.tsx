// app/fraud/page.tsx
// Página de Detecção de Fraude do ERP
// Exibe análise de risco, pedidos suspeitos, logs e permite revisão
// Acesso restrito: apenas usuários com role 'admin'

import { getFraudSummary } from '../lib/fraud-detection';
import { fraudLogData } from '../lib/data';
import { PageHeader } from '../components/ui';
import { ProtectedPage } from '../components/protected';

// ==========================================
// COMPONENTES INTERNOS
// ==========================================

/** Card de métrica compacto */
function StatCard({ title, value, note, color }: { title: string; value: string | number; note?: string; color?: string }) {
  const colorClass = color === 'red' ? 'border-red-200 bg-red-50' :
    color === 'yellow' ? 'border-amber-200 bg-amber-50' :
    color === 'green' ? 'border-emerald-200 bg-emerald-50' :
    color === 'blue' ? 'border-blue-200 bg-blue-50' :
    'border-slate-200 bg-white';

  return (
    <div className={`rounded-3xl border p-6 shadow-sm ${colorClass}`}>
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">{title}</p>
      <p className="mt-3 text-3xl font-semibold text-slate-900">{value}</p>
      {note ? <p className="mt-2 text-sm text-slate-500">{note}</p> : null}
    </div>
  );
}

/** Badge de status de fraude */
function StatusBadge({ status }: { status: 'aprovado' | 'suspeito' | 'bloqueado' }) {
  const styles = {
    aprovado: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    suspeito: 'bg-amber-100 text-amber-800 border-amber-200',
    bloqueado: 'bg-red-100 text-red-800 border-red-200',
  };

  const icons = { aprovado: '✅', suspeito: '⚠️', bloqueado: '🚫' };

  return (
    <span className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${styles[status]}`}>
      {icons[status]} {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

/** Badge de nível de risco */
function RiskBadge({ level }: { level: 'baixo' | 'médio' | 'alto' | 'crítico' }) {
  const styles = {
    baixo: 'bg-emerald-100 text-emerald-800',
    médio: 'bg-amber-100 text-amber-800',
    alto: 'bg-orange-100 text-orange-800',
    crítico: 'bg-red-100 text-red-800',
  };

  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${styles[level]}`}>
      {level}
    </span>
  );
}

/** Barra de score visual */
function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-red-500' : score >= 50 ? 'bg-orange-500' : score >= 30 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-sm font-mono font-semibold text-slate-700">{score}</span>
    </div>
  );
}

/** Mini gráfico de barras CSS */
function MiniBarChart({ labels, values, title, color }: { labels: string[]; values: number[]; title: string; color?: string }) {
  if (values.length === 0) return null;
  const max = Math.max(...values, 1);
  const barColor = color || 'bg-blue-500';

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <div className="mt-4 flex items-end gap-2" style={{ height: '100px' }}>
        {values.map((val, i) => (
          <div key={i} className="flex flex-1 flex-col items-center justify-end" style={{ height: '100%' }}>
            <span className="mb-1 text-[10px] font-mono text-slate-500">{val}</span>
            <div
              className={`w-full rounded-t-lg ${barColor} transition-all`}
              style={{ height: `${Math.max(2, (val / max) * 100)}%`, minHeight: '4px' }}
              title={`${labels[i]}: ${val}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        {labels.map((label, i) => (
          <div key={i} className="flex-1 text-center text-[10px] text-slate-400">{label}</div>
        ))}
      </div>
    </section>
  );
}

/** Tabela de logs de fraude */
function FraudLogTable({ logs }: { logs: Array<{
  id: string; orderId: string; userName: string; orderTotal: number;
  riskScore: number; riskLevel: string; flags: string[];
  status: string; createdAt: string; reviewedBy?: string;
}> }) {
  if (logs.length === 0) {
    return <p className="text-sm text-slate-500">Nenhum log de análise registrado.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="pb-3 font-semibold text-slate-600">Data</th>
            <th className="pb-3 font-semibold text-slate-600">Pedido</th>
            <th className="pb-3 font-semibold text-slate-600">Usuário</th>
            <th className="pb-3 text-right font-semibold text-slate-600">Valor</th>
            <th className="pb-3 text-center font-semibold text-slate-600">Score</th>
            <th className="pb-3 text-center font-semibold text-slate-600">Nível</th>
            <th className="pb-3 text-center font-semibold text-slate-600">Status</th>
            <th className="pb-3 font-semibold text-slate-600">Flags</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {logs.map((log) => (
            <tr key={log.id} className={`hover:bg-slate-50 transition ${log.status === 'bloqueado' ? 'bg-red-50/50' : ''}`}>
              <td className="py-3 text-slate-500 text-xs">
                {new Date(log.createdAt).toLocaleString('pt-BR')}
              </td>
              <td className="py-3 font-mono text-slate-700">#{log.orderId}</td>
              <td className="py-3 font-medium text-slate-900">{log.userName}</td>
              <td className="py-3 text-right font-mono text-slate-700">R$ {log.orderTotal.toFixed(2)}</td>
              <td className="py-3 text-center"><ScoreBar score={log.riskScore} /></td>
              <td className="py-3 text-center"><RiskBadge level={log.riskLevel as 'baixo' | 'médio' | 'alto' | 'crítico'} /></td>
              <td className="py-3 text-center"><StatusBadge status={log.status as 'aprovado' | 'suspeito' | 'bloqueado'} /></td>
              <td className="py-3">
                <div className="max-w-xs space-y-1">
                  {log.flags.slice(0, 3).map((flag, i) => (
                    <p key={i} className="text-xs text-slate-500 truncate" title={flag}>• {flag}</p>
                  ))}
                  {log.flags.length > 3 && (
                    <p className="text-xs text-slate-400">+{log.flags.length - 3} mais</p>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ==========================================
// PÁGINA PRINCIPAL
// ==========================================

export default function FraudDetectionPage() {
  const summary = getFraudSummary();
  const allLogs = fraudLogData.getAll()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <ProtectedPage allowedRoles={['admin']}>
      <div>
        <PageHeader
          title="Detecção de Fraude"
          description="Sistema local de análise de risco baseado em regras. Sem IA externa — comportamento, frequência e valores são analisados automaticamente."
        />

        {/* MÉTRICAS RESUMO */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total analisados"
            value={summary.totalAnalyzed}
            note="Pedidos com análise de fraude"
          />
          <StatCard
            title="Aprovados"
            value={summary.approvedCount}
            note={`${summary.totalAnalyzed > 0 ? Math.round((summary.approvedCount / summary.totalAnalyzed) * 100) : 0}% do total`}
            color="green"
          />
          <StatCard
            title="Suspeitos + Bloqueados"
            value={summary.flaggedTotal}
            note={`${summary.suspiciousCount} suspeitos, ${summary.blockedCount} bloqueados`}
            color={summary.flaggedTotal > 0 ? 'red' : undefined}
          />
          <StatCard
            title="Score médio"
            value={summary.avgRiskScore}
            note="Média de risco de todos os pedidos"
            color={summary.avgRiskScore >= 40 ? 'yellow' : undefined}
          />
        </div>

        {/* MÉTRICAS 24H */}
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <StatCard
            title="Últimas 24h"
            value={summary.recent24hCount}
            note="Pedidos analisados hoje"
          />
          <StatCard
            title="Flags hoje"
            value={summary.suspicious24hCount}
            note="Pedidos com alerta nas últimas 24h"
            color={summary.suspicious24hCount > 0 ? 'yellow' : undefined}
          />
          <StatCard
            title="Últimos 7 dias"
            value={summary.recent7dCount}
            note="Volume semanal de análises"
          />
        </div>

        {/* GRÁFICO: TENDÊNCIA SEMANAL */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <MiniBarChart
            labels={summary.weeklyTrend.map(w => w.week)}
            values={summary.weeklyTrend.map(w => w.total)}
            title="📊 Volume de Análises (semanal)"
            color="bg-blue-500"
          />
          <MiniBarChart
            labels={summary.weeklyTrend.map(w => w.week)}
            values={summary.weeklyTrend.map(w => w.flagged)}
            title="🚩 Pedidos Sinalizados (semanal)"
            color="bg-red-500"
          />
        </div>

        {/* FLAGS MAIS FREQUENTES */}
        {summary.topFlags.length > 0 ? (
          <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">🔍 Flags Mais Frequentes</h3>
            <div className="mt-4 space-y-3">
              {summary.topFlags.map((item, i) => (
                <div key={i} className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3">
                  <span className="text-sm text-slate-700">{item.flag}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {item.count}x
                  </span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* USUÁRIOS PROBLEMÁTICOS */}
        {summary.problematicUsers.length > 0 ? (
          <section className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-red-900">👤 Usuários com Mais Alertas</h3>
            <div className="mt-4 space-y-2">
              {summary.problematicUsers.map((user, i) => (
                <div key={i} className="flex items-center justify-between rounded-2xl border border-red-200 bg-white px-4 py-3">
                  <div>
                    <span className="font-semibold text-slate-900">{user.name}</span>
                    <span className="ml-2 text-sm text-slate-500">{user.count} alerta(s)</span>
                  </div>
                  <ScoreBar score={user.maxScore} />
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* PEDIDOS PENDENTES DE REVISÃO */}
        {summary.pendingReview.length > 0 ? (
          <section className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-amber-900">⏳ Pendentes de Revisão</h3>
            <p className="mt-1 text-sm text-amber-700">Estes pedidos foram sinalizados mas ainda não foram revisados por um admin.</p>
            <div className="mt-4 space-y-3">
              {summary.pendingReview.map((log) => (
                <div key={log.id} className="rounded-2xl border border-amber-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-900">Pedido #{log.orderId}</span>
                      <span className="ml-2 text-sm text-slate-500">por {log.userName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">R$ {log.orderTotal.toFixed(2)}</span>
                      <RiskBadge level={log.riskLevel as 'baixo' | 'médio' | 'alto' | 'crítico'} />
                    </div>
                  </div>
                  <div className="mt-2">
                    <ScoreBar score={log.riskScore} />
                  </div>
                  <div className="mt-2 space-y-1">
                    {log.flags.map((flag, i) => (
                      <p key={i} className="text-xs text-amber-700">⚠ {flag}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* TABELA COMPLETA DE LOGS */}
        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-slate-900">📋 Histórico Completo de Análises</h3>
          <p className="mt-1 text-sm text-slate-500">
            {allLogs.length} registro(s) • Ordenado por data (mais recente primeiro)
          </p>
          <div className="mt-4">
            <FraudLogTable logs={allLogs.map(l => ({
              ...l,
              createdAt: l.createdAt instanceof Date ? l.createdAt.toISOString() : String(l.createdAt),
            }))} />
          </div>
        </section>

        {/* COMO FUNCIONA */}
        <section className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
          <h3 className="font-semibold text-slate-800">🛡️ Como funciona a detecção</h3>
          <ul className="mt-3 space-y-2 list-disc list-inside">
            <li><strong>Automático:</strong> Todo pedido finalizado passa pela análise — sem ação manual necessária</li>
            <li><strong>Valor do pedido:</strong> Detecta valores absolutos altos e desvios da média do usuário</li>
            <li><strong>Frequência:</strong> Identifica rajadas de pedidos (múltiplos em 24h, intervalos curtos)</li>
            <li><strong>Quantidades:</strong> Flag para quantidades anormais por item ou muitos itens distintos</li>
            <li><strong>Perfil do usuário:</strong> Usuários novos, histórico de cancelamentos, produtos atípicos</li>
            <li><strong>Score 0-100:</strong> Cada regra contribui com pontos parciais que somam o score final</li>
            <li><strong>Status:</strong> Aprovado (0-39), Suspeito (40-69), Bloqueado (70+)</li>
            <li><strong>Revisão:</strong> Admins podem revisar e alterar status de qualquer log</li>
            <li><strong>Sem IA externa:</strong> Toda lógica é implementada localmente em TypeScript</li>
          </ul>
        </section>
      </div>
    </ProtectedPage>
  );
}
