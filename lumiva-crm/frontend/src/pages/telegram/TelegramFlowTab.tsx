import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { Ic, TG_ICON } from './TelegramIcons';
import {
  fetchTelegramFlows,
  saveTelegramFlow,
  deleteTelegramFlow,
  activateTelegramFlow,
  deactivateTelegramFlow,
  fetchTelegramFlowStats,
  type TelegramBot,
  type Flow,
  type FlowNode,
  type FlowNodeType,
  type FlowsMap,
} from '../../api/telegram-crm';

const NODE_META: Record<FlowNodeType, { ic: keyof typeof TG_ICON; cls: string }> = {
  msg: { ic: 'msg', cls: '' },
  buttons: { ic: 'buttons', cls: '' },
  ask: { ic: 'ask', cls: '' },
  ai: { ic: 'ai', cls: 'ai' },
  cond: { ic: 'cond', cls: 'cond' },
  crm: { ic: 'crm', cls: 'crm' },
  human: { ic: 'human', cls: 'human' },
  delay: { ic: 'delay', cls: '' },
  hook: { ic: 'hook', cls: '' },
  pay: { ic: 'pay', cls: 'crm' },
};
const NODE_TYPES: FlowNodeType[] = ['msg', 'buttons', 'ask', 'ai', 'cond', 'crm', 'human', 'delay', 'hook', 'pay'];

function newId(): string { return `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`; }

function collectDescendantIds(flow: Flow, nodeId: string, out: Set<string> = new Set()): Set<string> {
  out.add(nodeId);
  const node = flow.nodes[nodeId];
  (node?.childIds || []).forEach((cid) => { if (!out.has(cid)) collectDescendantIds(flow, cid, out); });
  return out;
}

interface Props { bot: TelegramBot; onBotChange: (bot: TelegramBot) => void }

export const TelegramFlowTab: React.FC<Props> = ({ bot, onBotChange }) => {
  const { t } = useTranslation();
  const { showAlert, showConfirm } = useAlertModal();
  const [flows, setFlows] = useState<FlowsMap>({});
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null);
  const [flowId, setFlowId] = useState<string | null>(null);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const res = await fetchTelegramFlows(bot.id);
    setFlows(res.flows);
    setActiveFlowId(res.activeFlowId);
    const firstId = flowId && res.flows[flowId] ? flowId : (res.activeFlowId && res.flows[res.activeFlowId] ? res.activeFlowId : Object.keys(res.flows)[0] || null);
    setFlowId(firstId);
    if (firstId) {
      setFlow(res.flows[firstId]);
      setSel(res.flows[firstId].startNodeId);
      fetchTelegramFlowStats(bot.id, firstId).then(setStats).catch(() => setStats({}));
    }
    setDirty(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [bot.id]);

  const selectFlow = (id: string) => {
    setFlowId(id);
    setFlow(flows[id]);
    setSel(flows[id]?.startNodeId || null);
    setDirty(false);
    fetchTelegramFlowStats(bot.id, id).then(setStats).catch(() => setStats({}));
  };

  const node = flow && sel ? flow.nodes[sel] : null;
  const flatNodes = useMemo(() => (flow ? Object.values(flow.nodes) : []), [flow]);

  const mutate = (fn: (f: Flow) => Flow) => {
    setFlow((prev) => (prev ? fn(prev) : prev));
    setDirty(true);
  };

  const updateNode = (id: string, patch: Partial<FlowNode>) => {
    mutate((f) => ({ ...f, nodes: { ...f.nodes, [id]: { ...f.nodes[id], ...patch } } }));
  };

  const addChild = (parentId: string, type: FlowNodeType) => {
    if (!flow) return;
    const id = newId();
    const meta = NODE_META[type];
    const label = t(`crm.telegram.flow.nodeTypes.${type}`);
    const child: FlowNode = { id, type, name: label, text: '' };
    mutate((f) => {
      const nodes = { ...f.nodes, [id]: child };
      const parent = { ...nodes[parentId] };
      parent.childIds = [...(parent.childIds || []), id];
      if (parent.type === 'buttons') {
        parent.options = [...(parent.options || []), { id: newId(), label: t('crm.telegram.flow.newOption'), nextNodeId: id }];
      } else if (parent.type === 'ai') {
        if (!parent.aiNextNodeId) parent.aiNextNodeId = id;
      } else if (parent.type === 'cond') {
        if (!parent.trueNodeId) parent.trueNodeId = id; else if (!parent.falseNodeId) parent.falseNodeId = id;
      } else if (!parent.nextNodeId) {
        parent.nextNodeId = id;
      }
      nodes[parentId] = parent;
      return { ...f, nodes };
    });
    setSel(id);
    void meta;
  };

  const deleteNode = async (id: string) => {
    if (!flow || id === flow.startNodeId) return;
    const ok = await showConfirm(t('crm.telegram.flow.deleteNodeConfirm'), { title: t('crm.telegram.flow.deleteNodeTitle'), danger: true });
    if (!ok) return;
    const toRemove = collectDescendantIds(flow, id);
    mutate((f) => {
      const nodes = { ...f.nodes };
      toRemove.forEach((rid) => delete nodes[rid]);
      Object.keys(nodes).forEach((k) => {
        const n = { ...nodes[k] };
        n.childIds = (n.childIds || []).filter((cid) => !toRemove.has(cid));
        if (n.nextNodeId && toRemove.has(n.nextNodeId)) n.nextNodeId = undefined;
        if (n.aiNextNodeId && toRemove.has(n.aiNextNodeId)) n.aiNextNodeId = undefined;
        if (n.trueNodeId && toRemove.has(n.trueNodeId)) n.trueNodeId = undefined;
        if (n.falseNodeId && toRemove.has(n.falseNodeId)) n.falseNodeId = undefined;
        if (n.options) n.options = n.options.filter((o) => !o.nextNodeId || !toRemove.has(o.nextNodeId));
        nodes[k] = n;
      });
      return { ...f, nodes };
    });
    setSel(flow.startNodeId);
  };

  const save = async () => {
    if (!flow) return;
    setBusy(true);
    try {
      const res = await saveTelegramFlow(bot.id, flow);
      setFlows(res.flows);
      setDirty(false);
      showAlert(t('crm.telegram.flow.saved'), { variant: 'success' });
    } catch (e: any) {
      showAlert(e.message || t('crm.telegram.errors.saveFailed'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const activate = async () => {
    if (!flow) return;
    setBusy(true);
    try {
      const updated = await activateTelegramFlow(bot.id, flow.id);
      onBotChange(updated);
      setActiveFlowId(flow.id);
    } catch (e: any) {
      showAlert(e.message || t('crm.telegram.errors.saveFailed'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async () => {
    setBusy(true);
    try {
      const updated = await deactivateTelegramFlow(bot.id);
      onBotChange(updated);
      setActiveFlowId(null);
    } finally {
      setBusy(false);
    }
  };

  const addFlow = () => {
    const id = newId();
    const startId = newId();
    const f: Flow = { id, name: t('crm.telegram.flow.newFlowName'), startNodeId: startId, nodes: { [startId]: { id: startId, type: 'msg', name: t('crm.telegram.flow.greeting'), text: '' } } };
    setFlows((prev) => ({ ...prev, [id]: f }));
    setFlowId(id);
    setFlow(f);
    setSel(startId);
    setDirty(true);
  };

  const removeFlow = async () => {
    if (!flow) return;
    const ok = await showConfirm(t('crm.telegram.flow.deleteFlowConfirm', { name: flow.name }), { title: t('crm.telegram.flow.deleteFlowTitle'), danger: true });
    if (!ok) return;
    await deleteTelegramFlow(bot.id, flow.id);
    await load();
  };

  if (!flow) return <div className="tg-empty">{t('crm.telegram.loading')}</div>;

  return (
    <>
      <div className="tg-variants" style={{ marginBottom: 16 }}>
        {Object.values(flows).map((f) => (
          <div key={f.id} className={`tg-variant ${f.id === flowId ? 'on' : ''}`} onClick={() => selectFlow(f.id)}>
            <div className="n">{f.name}{f.id === activeFlowId && <Ic d={TG_ICON.check} size={14} />}</div>
            <div className="d">{f.description || t('crm.telegram.flow.noDescription')}</div>
            <div className="m"><span>{Object.keys(f.nodes).length} {t('crm.telegram.flow.stepsShort')}</span>{f.id === activeFlowId && <span>{t('crm.telegram.flow.activeLabel')}</span>}</div>
          </div>
        ))}
        <div className="tg-variant" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-3)' }} onClick={addFlow}>
          <div className="n"><Ic d={TG_ICON.plus} size={14} />{t('crm.telegram.flow.newFlow')}</div>
        </div>
      </div>

      <div className="tg-split wide">
        <div className="tg-card">
          <div className="tg-card-head">
            <div>
              <h3><Ic d={TG_ICON.cond} size={15} />{flow.name}</h3>
              <div className="sub">{t('crm.telegram.flow.treeSubtitle')}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {flowId === activeFlowId ? (
                <button className="btn btn-sm" disabled={busy} onClick={deactivate}>{t('crm.telegram.flow.deactivate')}</button>
              ) : (
                <button className="btn btn-sm" disabled={busy} onClick={activate}>{t('crm.telegram.flow.activate')}</button>
              )}
              <button className="btn btn-sm" style={{ color: '#cc2f47' }} onClick={removeFlow}><Ic d={TG_ICON.trash} size={13} /></button>
              <button className="btn btn-sm btn-primary" disabled={busy || !dirty} onClick={save}><Ic d={TG_ICON.check} size={13} />{t('crm.telegram.flow.publish')}</button>
            </div>
          </div>
          <div className="tg-flow">
            <FlowNodeView flow={flow} nodeId={flow.startNodeId} sel={sel} onSel={setSel} stats={stats} />
          </div>
        </div>

        <div>
          {node && (
            <div className="tg-card" style={{ marginBottom: 16 }}>
              <div className="tg-card-head">
                <div>
                  <h3><Ic d={TG_ICON[NODE_META[node.type].ic]} size={15} />{node.name}</h3>
                  <div className="sub">{t(`crm.telegram.flow.nodeTypes.${node.type}`)}</div>
                </div>
                {node.id !== flow.startNodeId && <button className="tg-node-del btn btn-sm" onClick={() => deleteNode(node.id)}><Ic d={TG_ICON.trash} size={13} /></button>}
              </div>
              <div className="tg-card-body">
                <div className="tg-field">
                  <span className="tg-label">{t('crm.telegram.flow.stepName')}</span>
                  <input className="tg-input" value={node.name} onChange={(e) => updateNode(node.id, { name: e.target.value })} />
                </div>
                <div className="tg-field">
                  <span className="tg-label">{t('crm.telegram.flow.stepText')}</span>
                  <textarea className="tg-area" value={node.text} onChange={(e) => updateNode(node.id, { text: e.target.value })} placeholder="{{first_name}} {{username}}" />
                </div>

                {node.type === 'buttons' && (
                  <div className="tg-field">
                    <span className="tg-label">{t('crm.telegram.flow.buttonSource')}</span>
                    <select className="tg-select" value={node.source || 'static'} onChange={(e) => updateNode(node.id, { source: e.target.value === 'static' ? undefined : (e.target.value as any) })}>
                      <option value="static">{t('crm.telegram.flow.sourceStatic')}</option>
                      <option value="booking_services">{t('crm.telegram.flow.sourceServices')}</option>
                      <option value="booking_staff">{t('crm.telegram.flow.sourceStaff')}</option>
                      <option value="booking_slots">{t('crm.telegram.flow.sourceSlots')}</option>
                    </select>
                    {(!node.source || node.source === 'static') && (
                      <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                        {(node.options || []).map((o, i) => (
                          <div key={o.id} style={{ display: 'flex', gap: 6 }}>
                            <input className="tg-input" style={{ flex: 1 }} value={o.label} onChange={(e) => {
                              const options = [...(node.options || [])]; options[i] = { ...o, label: e.target.value }; updateNode(node.id, { options });
                            }} />
                            <select className="tg-select" style={{ maxWidth: 160 }} value={o.nextNodeId || ''} onChange={(e) => {
                              const options = [...(node.options || [])]; options[i] = { ...o, nextNodeId: e.target.value || undefined }; updateNode(node.id, { options });
                            }}>
                              <option value="">{t('crm.telegram.flow.noTarget')}</option>
                              {flatNodes.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
                            </select>
                          </div>
                        ))}
                        <button className="btn btn-sm" onClick={() => updateNode(node.id, { options: [...(node.options || []), { id: newId(), label: t('crm.telegram.flow.newOption'), nextNodeId: undefined }] })}>
                          <Ic d={TG_ICON.plus} size={12} />{t('crm.telegram.flow.addOption')}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {node.type === 'ask' && (
                  <div className="tg-row2">
                    <div className="tg-field">
                      <span className="tg-label">{t('crm.telegram.flow.fieldTarget')}</span>
                      <select className="tg-select" value={node.fieldTarget || ''} onChange={(e) => updateNode(node.id, { fieldTarget: e.target.value })}>
                        <option value="">—</option>
                        <option value="contact.firstName">{t('crm.telegram.flow.fields.firstName')}</option>
                        <option value="contact.phone">{t('crm.telegram.flow.fields.phone')}</option>
                        <option value="lead.customFields.note">{t('crm.telegram.flow.fields.customField')}</option>
                        <option value="collected.value">{t('crm.telegram.flow.fields.temp')}</option>
                      </select>
                    </div>
                    <div className="tg-field">
                      <span className="tg-label">{t('crm.telegram.flow.validation')}</span>
                      <select className="tg-select" value={node.validation || 'none'} onChange={(e) => updateNode(node.id, { validation: e.target.value as any })}>
                        <option value="none">{t('crm.telegram.flow.validationNone')}</option>
                        <option value="text">{t('crm.telegram.flow.validationText')}</option>
                        <option value="phone">{t('crm.telegram.flow.validationPhone')}</option>
                      </select>
                    </div>
                  </div>
                )}

                {node.type === 'crm' && (
                  <div className="tg-field">
                    <span className="tg-label">{t('crm.telegram.flow.crmAction')}</span>
                    <select className="tg-select" value={node.crmAction || 'create_lead'} onChange={(e) => updateNode(node.id, { crmAction: e.target.value as any })}>
                      <option value="create_lead">{t('crm.telegram.flow.crmCreateLead')}</option>
                      <option value="create_reservation">{t('crm.telegram.flow.crmCreateReservation')}</option>
                      <option value="update_lead_stage">{t('crm.telegram.flow.crmUpdateStage')}</option>
                    </select>
                  </div>
                )}

                {node.type === 'human' && (
                  <div className="tg-row2">
                    <div className="tg-field"><span className="tg-label">{t('crm.telegram.flow.department')}</span><input className="tg-input" value={node.department || ''} onChange={(e) => updateNode(node.id, { department: e.target.value })} /></div>
                    <div className="tg-field"><span className="tg-label">{t('crm.telegram.flow.pauseMinutes')}</span><input className="tg-input mono" type="number" value={node.pauseMinutes ?? 30} onChange={(e) => updateNode(node.id, { pauseMinutes: Number(e.target.value) })} /></div>
                  </div>
                )}

                {node.type === 'delay' && (
                  <div className="tg-field"><span className="tg-label">{t('crm.telegram.flow.afterMinutes')}</span><input className="tg-input mono" type="number" value={node.afterMinutes ?? 60} onChange={(e) => updateNode(node.id, { afterMinutes: Number(e.target.value) })} /></div>
                )}

                {node.type === 'hook' && (
                  <div className="tg-field">
                    <span className="tg-label">{t('crm.telegram.flow.targetFlow')}</span>
                    <select className="tg-select" value={node.targetFlowId || ''} onChange={(e) => updateNode(node.id, { targetFlowId: e.target.value || undefined })}>
                      <option value="">—</option>
                      {Object.values(flows).filter((f) => f.id !== flow.id).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>
                )}

                {node.type === 'cond' && (
                  <>
                    <div className="tg-row2">
                      <div className="tg-field">
                        <span className="tg-label">{t('crm.telegram.flow.condField')}</span>
                        <select className="tg-select" value={node.condField || ''} onChange={(e) => updateNode(node.id, { condField: e.target.value })}>
                          <option value="">—</option>
                          <option value="repeatCount">{t('crm.telegram.flow.condRepeatCount')}</option>
                          <option value="collected.value">{t('crm.telegram.flow.condCollected')}</option>
                        </select>
                      </div>
                      <div className="tg-field">
                        <span className="tg-label">{t('crm.telegram.flow.condOp')}</span>
                        <select className="tg-select" value={node.condOp || 'eq'} onChange={(e) => updateNode(node.id, { condOp: e.target.value as any })}>
                          <option value="eq">=</option>
                          <option value="exists">{t('crm.telegram.flow.condExists')}</option>
                          <option value="gte">≥</option>
                        </select>
                      </div>
                    </div>
                    <div className="tg-field"><span className="tg-label">{t('crm.telegram.flow.condValue')}</span><input className="tg-input" value={node.condValue || ''} onChange={(e) => updateNode(node.id, { condValue: e.target.value })} /></div>
                    <div className="tg-row2">
                      <div className="tg-field"><span className="tg-label">{t('crm.telegram.flow.condTrue')}</span><select className="tg-select" value={node.trueNodeId || ''} onChange={(e) => updateNode(node.id, { trueNodeId: e.target.value || undefined })}><option value="">—</option>{flatNodes.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</select></div>
                      <div className="tg-field"><span className="tg-label">{t('crm.telegram.flow.condFalse')}</span><select className="tg-select" value={node.falseNodeId || ''} onChange={(e) => updateNode(node.id, { falseNodeId: e.target.value || undefined })}><option value="">—</option>{flatNodes.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</select></div>
                    </div>
                  </>
                )}

                {(node.type === 'msg' || node.type === 'ask' || node.type === 'crm' || node.type === 'delay') && (
                  <div className="tg-field" style={{ marginBottom: 0 }}>
                    <span className="tg-label">{t('crm.telegram.flow.next')}</span>
                    <select className="tg-select" value={node.nextNodeId || ''} onChange={(e) => updateNode(node.id, { nextNodeId: e.target.value || undefined })}>
                      <option value="">{t('crm.telegram.flow.noTarget')}</option>
                      {flatNodes.filter((n) => n.id !== node.id).map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
                    </select>
                  </div>
                )}
                {node.type === 'ai' && (
                  <div className="tg-field" style={{ marginBottom: 0 }}>
                    <span className="tg-label">{t('crm.telegram.flow.aiNext')}</span>
                    <select className="tg-select" value={node.aiNextNodeId || ''} onChange={(e) => updateNode(node.id, { aiNextNodeId: e.target.value || undefined })}>
                      <option value="">{t('crm.telegram.flow.aiStayOpen')}</option>
                      {flatNodes.filter((n) => n.id !== node.id).map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="tg-card">
            <div className="tg-card-head"><div><h3><Ic d={TG_ICON.plus} size={15} />{t('crm.telegram.flow.palette')}</h3><div className="sub">{t('crm.telegram.flow.paletteSubtitle')}</div></div></div>
            <div className="tg-card-body">
              <div className="tg-palette">
                {NODE_TYPES.map((tp) => (
                  <div key={tp} className="tg-pal" onClick={() => sel && addChild(sel, tp)}>
                    <div className="ic"><Ic d={TG_ICON[NODE_META[tp].ic]} size={13} /></div>{t(`crm.telegram.flow.nodeTypes.${tp}`)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const FlowNodeView: React.FC<{ flow: Flow; nodeId: string; sel: string | null; onSel: (id: string) => void; stats: Record<string, number>; depth?: number }> = ({ flow, nodeId, sel, onSel, stats, depth = 0 }) => {
  const node = flow.nodes[nodeId];
  if (!node || depth > 12) return null;
  const meta = NODE_META[node.type];
  const chips: string[] = [];
  if (node.type === 'ask' && node.fieldTarget) chips.push(`→ ${node.fieldTarget}`);
  if (node.type === 'human' && node.department) chips.push(node.department);
  if (node.type === 'crm' && node.crmAction) chips.push(node.crmAction);
  if (node.type === 'hook' && node.targetFlowId) chips.push(`→ ${flow.id === node.targetFlowId ? node.targetFlowId : node.targetFlowId}`);
  return (
    <div className="tg-branch">
      <div className={`tg-node ${sel === node.id ? 'sel' : ''}`} onClick={() => onSel(node.id)}>
        <div className={`tg-node-ic ${meta.cls}`}><Ic d={TG_ICON[meta.ic]} size={15} /></div>
        <div className="tg-node-b">
          <div className="tg-node-t">{node.type}</div>
          <div className="tg-node-n">{node.name}</div>
          {node.text && <div className="tg-node-p">{node.text}</div>}
          {chips.length > 0 && <div className="tg-node-chips">{chips.map((c, i) => <span key={i} className="tg-chip">{c}</span>)}</div>}
        </div>
        <div className="tg-node-stat">{stats[node.id] || 0}</div>
      </div>
      {(node.childIds || []).length > 0 && (
        <div className="kids">
          {(node.childIds || []).map((cid) => <FlowNodeView key={cid} flow={flow} nodeId={cid} sel={sel} onSel={onSel} stats={stats} depth={depth + 1} />)}
        </div>
      )}
    </div>
  );
};
