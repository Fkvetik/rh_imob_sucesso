'use client';
import { useEffect, useMemo, useRef, useState } from 'react';

/* ── CONSTANTS ──────────────────────────────────────────────── */
const DEFAULT_QUICK = [
  { title:'Saudação inicial', text:'Olá, {primeiro_nome}! Tudo bem? Estou passando para dar continuidade ao seu atendimento na RHIMOB.', action:'MENSAGEM_LEAD' },
  { title:'Confirmar interesse', text:'Perfeito, {primeiro_nome}. Para te orientar melhor, consegue confirmar se ainda tem interesse em seguir com essa oportunidade?', action:'MENSAGEM_LEAD' },
  { title:'Confirmar agendamento', text:'Olá, {primeiro_nome}! Passando para confirmar nosso agendamento de {dia_semana_agendamento}, {data_agendamento}, às {hora_agendamento}. Se precisar reagendar, me avise por aqui.', action:'CONFIRMAR_AGENDAMENTO' },
  { title:'Encaminhar para responsável', text:'{primeiro_nome}, vou direcionar seu atendimento para {operador_destino_nome}, responsável por {operador_destino_funcao}.', action:'ENCAMINHAR_OPERADOR', operatorName:'', operatorPhone:'', operatorRole:'', operatorText:'Olá, {operador_destino_nome}! Encaminhando atendimento de {nome} ({telefone}).\nOperação: {operacao} | Agendamento: {agenda_resumo}\nObservação: {observacao_encaminhamento}\nResumo: {resumo_conversa}' }
];

const STATUS_MAP = {
  NOVO:          { label:'Novo',           cls:'novo',   scls:'novo',   lcls:'s-novo'   },
  EM_ATENDIMENTO:{ label:'Em atendimento', cls:'hot',    scls:'hot',    lcls:'s-hot'    },
  AGENDADO:      { label:'Agendado',       cls:'ok',     scls:'ok',     lcls:'s-ok'     },
  QUALIFICADO:   { label:'Qualificado',    cls:'purple', scls:'purple', lcls:'s-purple' },
  DESCARTADO:    { label:'Descartado',     cls:'muted',  scls:'muted',  lcls:'s-muted'  },
  SEM_STATUS:    { label:'Sem status',     cls:'muted',  scls:'muted',  lcls:'s-muted'  }
};

const FORWARD_TOPICS = [
  'Posição de liderança','Cliente potencial RH','Agendamento confirmado',
  'Parceria','Dúvida técnica','Outros'
];

const SLOT_CONFIG = {
  NOVOS_TALENTOS:   [{ dayNum:4, hour:10, min:0 },{ dayNum:4, hour:14, min:0 }],
  CORRETORES_CRECI: [{ dayNum:2, hour:10, min:0 },{ dayNum:2, hour:14, min:0 }]
};

// ── Operações cadastradas (atualizado dinamicamente pela API) ───
// Seed com as duas operações originais como fallback offline
const OPERACOES_DEFAULT = [
  { operation_key:'NOVOS_TALENTOS',   label:'Novos Talentos',   label_short:'NT',    cor:'#4f46e5' },
  { operation_key:'CORRETORES_CRECI', label:'Corretores CRECI', label_short:'CRECI', cor:'#0284c7' }
];
// Registro mutável em escopo de módulo — permite que helpers puros usem dados dinâmicos
const _opReg = {};
OPERACOES_DEFAULT.forEach(o=>{ _opReg[o.operation_key]={ label:o.label, short:o.label_short }; });

const OP_COLORS  = ['#4f46e5','#0284c7','#16a34a'];
const OP_DEFAULT = OP_COLORS.map(c=>({ name:'', phone:'', role:'', color:c }));
const REAGENDAR_RE = /(reagendar|remarcar|outro dia|outro horario|outro horário|nao posso|não posso|mudar horario|mudar horário|trocar horario|trocar horário)/i;

/* ── HELPERS ────────────────────────────────────────────────── */
function calcSlots(op){
  const slots = SLOT_CONFIG[op]||SLOT_CONFIG.NOVOS_TALENTOS;
  const now = Date.now(); const MIN = 24*3600*1000;
  return slots.map(({dayNum,hour,min})=>{
    let d=new Date(); d.setHours(hour,min,0,0);
    while(d.getDay()!==dayNum||(d.getTime()-now)<MIN){ d.setDate(d.getDate()+1); d.setHours(hour,min,0,0); }
    return d;
  });
}
function hasReagendarIntent(msgs){ return (msgs||[]).slice(-10).some(m=>REAGENDAR_RE.test(m.message_text||'')); }
function apiHeaders(tok){ return {'Content-Type':'application/json','x-crm-token':tok||''}; }
function normPhone(v){ return String(v||'').replace(/\D+/g,''); }
function firstName(n){ return String(n||'').trim().split(/\s+/)[0]||''; }
function brDate(v){ const s=String(v||'').slice(0,10),p=s.split('-'); return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:s; }
function weekDay(v){ try{ return new Date(String(v).slice(0,10)+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long'}); }catch(e){ return ''; } }
function timeShort(v){ return v?String(v).slice(0,5):''; }
function fmtDate(v){ if(!v)return ''; try{ return new Date(v).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}); }catch(e){ return String(v); } }
function initials(n){ const p=String(n||'?').trim().split(/\s+/).filter(Boolean); return (p[0]?.[0]||'?')+(p[1]?.[0]||''); }
function maskPhone(v){ const n=normPhone(v); if(!n)return '—'; return '●●● '+n.slice(-5,-4)+'-'+n.slice(-4); }
function opLabel(op){ return _opReg[op]?.label || op || '—'; }
function opShort(op){ return _opReg[op]?.short || (op ? op.slice(0,6) : '?'); }
function statusKey(v){ return String(v||'SEM_STATUS').toUpperCase(); }
function statusInfo(v){ return STATUS_MAP[statusKey(v)]||STATUS_MAP.SEM_STATUS; }
function hojeISO(){ return new Date().toISOString().slice(0,10); }
function scheduleDateTime(ag){ if(!ag?.data_agendamento)return null; return new Date(`${String(ag.data_agendamento).slice(0,10)}T${timeShort(ag.hora_agendamento)||'00:00'}:00`); }
function minutesUntil(ag){ const d=scheduleDateTime(ag); if(!d)return null; return Math.round((d.getTime()-Date.now())/60000); }
function countdownLabel(min){ if(min===null||min===undefined)return ''; if(min<0)return 'atrasado'; const h=Math.floor(min/60),m=min%60; return h?`${h}h ${m}min`:`${m}min`; }
function slaLabel(lead){
  if(String(lead.ultima_direcao||'').toUpperCase()!=='IN') return null;
  const h=Math.floor((Date.now()-new Date(lead.ultima_atividade_em||lead.updated_at).getTime())/3600000);
  if(h<2) return null;
  return h+'h sem resposta';
}
function normalizeQuick(row,idx){ return { id:row.id||null, title:row.title||row.titulo||'Mensagem '+(idx+1), text:row.text||row.texto||'', action:row.action||row.tipo_acao||'MENSAGEM_LEAD', operatorName:row.operatorName||row.operador_destino_nome||'', operatorPhone:row.operatorPhone||row.operador_destino_telefone||'', operatorRole:row.operatorRole||row.operador_destino_funcao||'', operatorText:row.operatorText||row.texto_operador||'', active:row.active===undefined?(row.ativo===undefined?true:!!row.ativo):!!row.active, ordem:Number(row.ordem||(idx+1)*10) }; }

/* ── SIMPLE COMPONENTS ─────────────────────────────────────── */
function Badge({ children, type='neu' }){ return <span className={'badge '+type}>{children}</span>; }

/* ══════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════ */
export default function CRMPage(){
  const [tab,setTab]             = useState('atendimento');
  const [token,setToken]         = useState('');
  const [operator,setOperator]   = useState('Fernando');
  const [operation,setOperation] = useState('NOVOS_TALENTOS');
  const [status,setStatus]       = useState('');
  const [bucket,setBucket]       = useState('');
  const [query,setQuery]         = useState('');
  const [leads,setLeads]         = useState([]);
  const [agenda,setAgenda]       = useState([]);
  const [selected,setSelected]   = useState(null);
  const [messages,setMessages]   = useState([]);
  const [latestSchedule,setLatestSchedule] = useState(null);
  const [draft,setDraft]         = useState('');
  const [notice,setNotice]       = useState('Pronto para atendimento.');
  const [loading,setLoading]     = useState(false);
  const [debugOpen,setDebugOpen] = useState(false);
  const [debug,setDebug]         = useState('');
  const [quick,setQuick]         = useState(DEFAULT_QUICK.map(normalizeQuick));
  const [quickLoaded,setQuickLoaded] = useState(false);
  const [quickDirty,setQuickDirty]   = useState(false);
  const [quickSaving,setQuickSaving] = useState(false);
  const [scheduleDate,setScheduleDate] = useState('');
  const [scheduleTime,setScheduleTime] = useState('');
  const [scheduleObs,setScheduleObs]   = useState('');
  const [forwardTopic,setForwardTopic] = useState('');
  const [forwardName,setForwardName]   = useState('');
  const [forwardPhone,setForwardPhone] = useState('');
  const [forwardRole,setForwardRole]   = useState('');
  const [forwardUrgent,setForwardUrgent] = useState(false);
  const [forwardObs,setForwardObs]       = useState('');
  const [operators,setOperators]         = useState([]);
  const [opSlots,setOpSlots]             = useState(OP_DEFAULT);
  const [opSlotsEditing,setOpSlotsEditing] = useState(false);
  const [selectedOpSlot,setSelectedOpSlot] = useState(null);
  const [schedulePanel,setSchedulePanel]   = useState(null);
  const [reminders,setReminders]           = useState([]);
  const [remindersLoading,setRemindersLoading] = useState(false);
  const [modelos,setModelos]               = useState([]);
  const [modelosLoading,setModelosLoading] = useState(false);
  const [modelosSaving,setModelosSaving]   = useState({});
  // Pipeline (Kanban)
  const [viewMode,setViewMode]             = useState('list');
  const [dragLead,setDragLead]             = useState(null);
  const [dragOverStatus,setDragOverStatus] = useState(null);
  // Notes
  const [notes,setNotes]                   = useState([]);
  const [noteDraft,setNoteDraft]           = useState('');
  const [noteSaving,setNoteSaving]         = useState(false);
  // Filtro de exibição da lista (client-side, não recarrega API)
  const [opFilter,setOpFilter]             = useState(''); // '' = todos, 'NOVOS_TALENTOS', 'CORRETORES_CRECI'
  // Modal de encaminhamento rápido (abre direto do chat, sem trocar de aba)
  const [forwardModalOpen,setForwardModalOpen] = useState(false);
  const saveTimer      = useRef(null);
  const endRef         = useRef(null);
  const tokenRef       = useRef(''); // sempre atualizado com o token atual (evita race condition de estado)
  const operacoesRef   = useRef(OPERACOES_DEFAULT); // atualizado pela API; usado em loadLeads/loadAgenda
  const [operacoes,setOperacoes] = useState(OPERACOES_DEFAULT);
  const pollConvRef    = useRef(null); // intervalo de polling da conversa ativa
  const pollLeadsRef   = useRef(null); // intervalo de polling da lista de leads
  const selectedRef    = useRef(null); // ref espelho de selected (evita closure stale no poll)

  /* ── EFFECTS ──────────────────────────────── */
  // Mount: lê localStorage → seta tokenRef → dispara loadLeads com o tok real
  useEffect(()=>{
    let tok='';
    try{
      tok = localStorage.getItem('rhimob_crm_token')||'';
      const op = localStorage.getItem('rhimob_crm_operator')||'Fernando';
      tokenRef.current = tok;
      setToken(tok);
      setOperator(op);
      const saved=localStorage.getItem('rhimob_crm_opslots');
      if(saved){ const p=JSON.parse(saved); if(Array.isArray(p)&&p.length===3) setOpSlots(p); }
    }catch(e){}
    // Boot: carrega operações cadastradas no Supabase primeiro,
    // depois carrega leads de TODAS as operações ativas em paralelo.
    // Se a tabela crm_operacoes não existir ainda, usa o fallback OPERACOES_DEFAULT.
    (async()=>{ await loadOperacoes(tok); loadLeads(tok); })();

    // Polling leve de novos leads a cada 20s (atualiza lista sem re-renderizar conversa)
    pollLeadsRef.current = setInterval(()=>{
      const tok2 = tokenRef.current;
      if(!tok2) return;
      const ops = operacoesRef.current;
      const h   = apiHeaders(tok2);
      Promise.all(
        ops.map(o=>fetchJson('/api/crm/leads?'+new URLSearchParams({operation:o.operation_key,limit:'120'}),{headers:h}).catch(()=>({leads:[]})))
      ).then(results=>{
        const all = results.flatMap(d=>d.leads||[]).sort((a,b)=>
          new Date(b.ultima_atividade_em||b.updated_at||0)-new Date(a.ultima_atividade_em||a.updated_at||0)
        );
        setLeads(prev=>{
          // Só atualiza se houver diferença real (evita re-renders desnecessários)
          const changed = all.length !== prev.length ||
            all.some((l,i)=>(l.ultima_atividade_em||'')!==(prev[i]?.ultima_atividade_em||''));
          return changed ? all : prev;
        });
      }).catch(()=>{});
    }, 20000);

    return ()=>{
      clearInterval(pollLeadsRef.current);
      clearInterval(pollConvRef.current);
    };
  },[]);// eslint-disable-line

  // Polling da conversa ativa a cada 4s — atualiza só se chegaram mensagens novas
  useEffect(()=>{
    selectedRef.current = selected;
    clearInterval(pollConvRef.current);
    if(!selected) return;
    pollConvRef.current = setInterval(async()=>{
      const lead = selectedRef.current;
      if(!lead) return;
      const tok2 = tokenRef.current;
      if(!tok2) return;
      try{
        const d = await fetchJson('/api/crm/conversation?'+new URLSearchParams({
          operation:    lead.operation,
          telefone_norm:lead.telefone_norm
        }),{headers:apiHeaders(tok2)});
        const newMsgs = d.messages || [];
        setMessages(prev=>{
          if(newMsgs.length === prev.length) return prev;
          return newMsgs;
        });
      }catch(_){}
    }, 4000);
    return ()=>{ clearInterval(pollConvRef.current); };
  },[selected]);// eslint-disable-line

  // Mantém tokenRef sempre sincronizado quando o usuário edita o token no header
  useEffect(()=>{ tokenRef.current = token; },[token]);

  // Mudança de operação: recarrega contexto (mensagens rápidas, agenda, operadores)
  // Não recarrega leads — a lista já mostra NT + CRECI juntos
  useEffect(()=>{
    loadQuickMessages(operation);
    loadAgenda(true);
    loadOperators(operation);
  },[operation]);
  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:'smooth'}); },[selected,messages.length]);
  useEffect(()=>{
    if(!quickLoaded||!quickDirty)return;
    try{ localStorage.setItem('rhimob_crm_quick_'+operation,JSON.stringify({saved_at:new Date().toISOString(),items:quick})); }catch(e){}
    if(saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(()=>saveQuick(true),1200);
    return ()=>{ if(saveTimer.current) clearTimeout(saveTimer.current); };
  },[quick,quickDirty,quickLoaded,operation]);

  /* ── MEMOS ────────────────────────────────── */
  const scheduleByPhone = useMemo(()=>{ const m={}; (agenda||[]).forEach(a=>{ if(!m[a.telefone_norm])m[a.telefone_norm]=a; }); return m; },[agenda]);
  const selectedSchedule  = latestSchedule||(selected?scheduleByPhone[selected.telefone_norm]:null);
  // filteredLeads: client-side por operação (não faz nova chamada à API)
  const filteredLeads     = useMemo(()=>opFilter?leads.filter(l=>l.operation===opFilter):leads,[leads,opFilter]);
  const todaysLeads       = useMemo(()=>filteredLeads.filter(l=>String(scheduleByPhone[l.telefone_norm]?.data_agendamento||'').slice(0,10)===hojeISO()),[filteredLeads,scheduleByPhone]);
  const activeLeads       = useMemo(()=>filteredLeads.filter(l=>!todaysLeads.some(x=>x.telefone_norm===l.telefone_norm&&x.operation===l.operation)),[filteredLeads,todaysLeads]);
  const agHoje            = useMemo(()=>agenda.filter(a=>String(a.data_agendamento||'').slice(0,10)===hojeISO()),[agenda]);
  const proximaAgenda     = useMemo(()=>agenda.find(a=>{ const m=minutesUntil(a); return m!==null&&m>=-15; })||null,[agenda]);

  /* ── FETCH ────────────────────────────────── */
  async function fetchJson(url,opts={}){
    const res=await fetch(url,opts); const text=await res.text();
    let data=null; try{ data=text?JSON.parse(text):null; }catch(e){ data={raw:text}; }
    if(!res.ok) throw new Error((data&&(data.error||data.message))||text||('HTTP '+res.status));
    return data;
  }

  /* ── LOADERS ──────────────────────────────── */
  async function loadOperators(op){
    try{ const d=await fetchJson('/api/crm/operadores?'+new URLSearchParams({operation:op}),{headers:apiHeaders(token)}); setOperators(d.operadores||[]); }catch(e){}
  }
  // Carrega operações ativas do Supabase e atualiza o registro global _opReg
  async function loadOperacoes(_tok){
    try{
      const d=await fetchJson('/api/crm/operacoes',{headers:apiHeaders(_tok||tokenRef.current||token)});
      if(d.operacoes&&d.operacoes.length){
        setOperacoes(d.operacoes);
        operacoesRef.current=d.operacoes;
        // Atualiza helpers opLabel/opShort com dados do Supabase
        d.operacoes.forEach(o=>{ _opReg[o.operation_key]={ label:o.label, short:o.label_short }; });
      }
    }catch(e){ /* mantém OPERACOES_DEFAULT — tabela pode ainda não existir */ }
  }
  async function loadQuickMessages(op){
    setQuickLoaded(false); setQuickDirty(false);
    const key='rhimob_crm_quick_'+op; let ok=false;
    try{ const raw=localStorage.getItem(key); if(raw){ const p=JSON.parse(raw),items=Array.isArray(p)?p:p.items; if(Array.isArray(items)&&items.length){setQuick(items.map(normalizeQuick));ok=true;} } }catch(e){}
    if(!ok){ try{ const d=await fetchJson('/api/crm/quick-messages?'+new URLSearchParams({operation:op}),{headers:apiHeaders(token)}); const rows=(d.items||[]).map(normalizeQuick); setQuick(rows.length?rows:DEFAULT_QUICK.map(normalizeQuick)); }catch(e){ setQuick(DEFAULT_QUICK.map(normalizeQuick)); } }
    setQuickLoaded(true); setQuickDirty(false);
  }
  async function saveQuick(silent=false){
    setQuickSaving(true);
    try{
      const items=quick.map((q,i)=>({id:q.id,title:q.title||('Mensagem '+(i+1)),text:q.text||'',action:q.action||'MENSAGEM_LEAD',operatorName:q.operatorName||'',operatorPhone:q.operatorPhone||'',operatorRole:q.operatorRole||'',operatorText:q.operatorText||'',active:q.active!==false,ordem:q.ordem||(i+1)*10}));
      try{ localStorage.setItem('rhimob_crm_quick_'+operation,JSON.stringify({saved_at:new Date().toISOString(),items})); }catch(e){}
      await fetchJson('/api/crm/quick-messages',{method:'POST',headers:apiHeaders(token),body:JSON.stringify({operation,items})});
      setQuickDirty(false); if(!silent) setNotice('Mensagens rápidas salvas para '+opLabel(operation)+'.');
    }catch(e){ if(!silent) setNotice('Salvo localmente. Falha no Supabase: '+e.message); }
    finally{ setQuickSaving(false); }
  }
  // Carrega agendamentos de TODAS as operações ativas (visão unificada)
  async function loadAgenda(silent=false,_tok){
    const ops=operacoesRef.current;
    const h=apiHeaders(_tok||tokenRef.current||token);
    try{
      const results=await Promise.all(
        ops.map(o=>fetchJson('/api/crm/agenda?'+new URLSearchParams({operation:o.operation_key,limit:'180'}),{headers:h}).catch(()=>({agenda:[]})))
      );
      const all=results.flatMap(d=>d.agenda||[]).sort((a,b)=>
        String(a.data_agendamento+'T'+(a.hora_agendamento||'00:00')).localeCompare(String(b.data_agendamento+'T'+(b.hora_agendamento||'00:00')))
      );
      setAgenda(all);
      if(!silent) setNotice(all.length+' agendamentos carregados.');
    }catch(e){ if(!silent) setNotice('Erro ao carregar agenda: '+e.message); }
  }
  // Carrega TODAS as operações ativas em paralelo → lista unificada por atividade
  async function loadLeads(_tok){
    const tok=_tok||tokenRef.current||token;
    const ops=operacoesRef.current; // lista dinâmica de operações
    const h=apiHeaders(tok);
    setLoading(true); setNotice('Carregando…');
    try{
      const buildParams=(op)=>{
        const p=new URLSearchParams({operation:op,limit:'120'});
        if(status) p.set('status',status); if(bucket) p.set('bucket',bucket); if(query) p.set('q',query);
        return p;
      };
      const results=await Promise.all(
        ops.map(o=>fetchJson('/api/crm/leads?'+buildParams(o.operation_key),{headers:h}).catch(()=>({leads:[]})))
      );
      const all=results.flatMap(d=>d.leads||[]).sort((a,b)=>
        new Date(b.ultima_atividade_em||b.updated_at||0)-new Date(a.ultima_atividade_em||a.updated_at||0)
      );
      setLeads(all);
      await loadAgenda(true,tok);
      const countStr=ops.map((o,i)=>`${o.label_short}: ${(results[i]?.leads||[]).length}`).join(' · ');
      setNotice(`${all.length} leads — ${countStr}`);
      if(!selected&&all.length) selectLead(all[0],tok);
    }catch(e){ setNotice('Erro: '+e.message); }
    finally{ setLoading(false); }
  }
  async function selectLead(lead,_tok){
    const h=apiHeaders(_tok||token);
    setSelected(lead); setMessages([]); setLatestSchedule(null); setDraft(''); setNotice('Abrindo conversa…');
    setScheduleDate(''); setScheduleTime(''); setScheduleObs('');
    try{ const d=await fetchJson('/api/crm/conversation?'+new URLSearchParams({operation:lead.operation,telefone_norm:lead.telefone_norm}),{headers:h}); setMessages(d.messages||[]); setNotice((d.messages||[]).length?'Conversa carregada.':'Lead sem histórico. Rode o Apps Script 08.'); }catch(e){ setNotice('Erro ao carregar conversa: '+e.message); }
    try{ const s=await fetchJson('/api/crm/latest-schedule?'+new URLSearchParams({operation:lead.operation,telefone_norm:lead.telefone_norm}),{headers:h}); if(s.agendamento){ setLatestSchedule(s.agendamento); setScheduleDate(String(s.agendamento.data_agendamento||'').slice(0,10)); setScheduleTime(timeShort(s.agendamento.hora_agendamento)); setScheduleObs(s.agendamento.observacao||''); } }catch(e){}
    loadNotes(lead,_tok);
  }
  async function openSchedulePanel(lead,ag){
    const op=lead.operation||operation;
    setSchedulePanel({lead,schedule:ag}); setReminders([]); setRemindersLoading(true);
    try{ const p={operation:op,telefone_norm:lead.telefone_norm}; if(ag?.id)p.agendamento_id=ag.id; else if(ag?.agenda_id)p.agendamento_id=ag.agenda_id; const d=await fetchJson('/api/crm/schedule-reminders?'+new URLSearchParams(p),{headers:apiHeaders(token)}); setReminders(d.reminders||[]); }catch(e){ setReminders([]); }
    finally{ setRemindersLoading(false); }
    loadModelos(op);
  }
  async function loadModelos(op=operation){
    setModelosLoading(true);
    try{ const d=await fetchJson('/api/crm/agenda-modelos?'+new URLSearchParams({operation:op}),{headers:apiHeaders(token)}); setModelos(d.modelos||[]); }catch(e){ setModelos([]); }
    finally{ setModelosLoading(false); }
  }
  async function saveModelo(op,tipo,fields){
    setModelosSaving(prev=>({...prev,[tipo]:true}));
    try{
      await fetchJson('/api/crm/agenda-modelos',{method:'PATCH',headers:apiHeaders(token),body:JSON.stringify({operation:op,tipo,...fields})});
      setModelos(prev=>prev.map(m=>(m.operation===op&&m.tipo===tipo)?{...m,...fields}:m));
      setNotice('Modelo salvo: '+tipo.replace(/_/g,' ').toLowerCase());
    }catch(e){ setNotice('Erro ao salvar modelo: '+e.message); }
    finally{ setModelosSaving(prev=>({...prev,[tipo]:false})); }
  }

  /* ── NOTES ───────────────────────────────── */
  async function loadNotes(lead,_tok){
    const h=apiHeaders(_tok||token);
    try{ const d=await fetchJson('/api/crm/notes?'+new URLSearchParams({operation:lead.operation,telefone_norm:lead.telefone_norm}),{headers:h}); setNotes(d.notes||[]); }catch(e){ setNotes([]); }
  }
  async function saveNote(){
    if(!noteDraft.trim()||!selected) return;
    setNoteSaving(true);
    try{
      const d=await fetchJson('/api/crm/notes',{method:'POST',headers:apiHeaders(token),body:JSON.stringify({operation:selected.operation,telefone_norm:selected.telefone_norm,operador:operator,nota:noteDraft.trim()})});
      setNotes(prev=>[d.note,...(prev||[])]);
      setNoteDraft('');
      setNotice('Nota salva.');
    }catch(e){ setNotice('Erro ao salvar nota: '+e.message); }
    finally{ setNoteSaving(false); }
  }
  async function deleteNote(id){
    try{ await fetchJson('/api/crm/notes?id='+id,{method:'DELETE',headers:apiHeaders(token)}); setNotes(prev=>prev.filter(n=>n.id!==id)); }catch(e){ setNotice('Erro ao excluir nota: '+e.message); }
  }

  /* ── KANBAN DnD ──────────────────────────── */
  function handleDragStart(lead,e){ setDragLead(lead); e.dataTransfer.effectAllowed='move'; }
  function handleDragOver(status,e){ e.preventDefault(); e.dataTransfer.dropEffect='move'; setDragOverStatus(status); }
  function handleDragLeave(){ setDragOverStatus(null); }
  async function handleDrop(status){ if(dragLead&&dragLead.status_atendimento!==status) await updateStatus(status,dragLead); setDragLead(null); setDragOverStatus(null); }
  function openKanbanLead(lead){ setViewMode('list'); setTab('atendimento'); selectLead(lead); }

  /* ── OPERATORS (SLOTS) ────────────────────── */
  function updateOpSlot(i,k,v){ setOpSlots(prev=>{ const n=[...prev]; n[i]={...n[i],[k]:v}; return n; }); }
  function saveOpSlotsLS(){ try{ localStorage.setItem('rhimob_crm_opslots',JSON.stringify(opSlots)); }catch(e){} setOpSlotsEditing(false); setNotice('Responsáveis salvos.'); }
  function selectOpSlot(i){ const s=opSlots[i]; if(!s.name)return; setSelectedOpSlot(i); setForwardName(s.name); setForwardPhone(s.phone); setForwardRole(s.role); }

  /* ── MESSAGE ACTIONS ──────────────────────── */
  function resumoConversa(){ return (messages||[]).slice(-8).map(m=>`${String(m.direction||'').toUpperCase()==='OUT'?'Atendimento':'Lead'}: ${String(m.message_text||'').replace(/\s+/g,' ').slice(0,260)}`).join('\n'); }
  function renderTemplate(text,q={}){
    const lead=selected||{}; const ag=selectedSchedule||{};
    const nome=lead.nome||lead.telefone_display||lead.telefone_norm||'';
    const dataAg=ag.data_agendamento||scheduleDate||''; const horaAg=ag.hora_agendamento||scheduleTime||'';
    const agendaResumo=dataAg?`${weekDay(dataAg)}, ${brDate(dataAg)} às ${timeShort(horaAg)}`:'sem agendamento';
    const map={ nome,primeiro_nome:firstName(nome),telefone:lead.telefone_display||lead.telefone_norm||'',telefone_norm:lead.telefone_norm||'',operacao:lead.operation||operation,operador:operator||'',cidade:lead.cidade||'',bairro:lead.bairro||'',status:lead.status_atendimento||'',ultima_mensagem:lead.ultima_mensagem||(messages[messages.length-1]?.message_text||''),data_agendamento:brDate(dataAg),hora_agendamento:timeShort(horaAg),dia_semana_agendamento:weekDay(dataAg),agenda_resumo:agendaResumo,resumo_conversa:resumoConversa(),operador_destino_nome:q.operatorName||forwardName||'',operador_destino_telefone:q.operatorPhone||forwardPhone||'',operador_destino_funcao:q.operatorRole||forwardRole||'',observacao_encaminhamento:forwardObs||'',topico_encaminhamento:forwardTopic||'' };
    return String(text||'').replace(/\{([a-zA-Z0-9_]+)\}/g,(_,k)=>map[k]??'');
  }
  async function sendMessage(textOverride,meta={}){
    const text=(textOverride||draft||'').trim();
    if(!selected){ setNotice('Selecione um lead antes de enviar.'); return null; }
    if(!text){ setNotice('Digite uma mensagem.'); return null; }
    setLoading(true); setNotice('Enviando...');
    try{ const d=await fetchJson('/api/crm/send-message',{method:'POST',headers:apiHeaders(token),body:JSON.stringify({operation:selected.operation,telefone_norm:selected.telefone_norm,message_text:text,operador:operator,quick_action:meta.quick_action||'',quick_title:meta.quick_title||''})}); if(!textOverride)setDraft(''); setMessages(prev=>[...prev,{direction:'OUT',message_text:text,message_at:new Date().toISOString(),source:'CRM_SITE',operador:operator,status_envio:d.status||'PENDENTE'}]); setNotice('Mensagem enviada para a operação.'); return d; }
    catch(e){ setNotice('Erro ao enviar: '+e.message); return null; }
    finally{ setLoading(false); }
  }
  async function notifyOperator(q,leadMessage=''){
    if(!selected){ setNotice('Selecione um lead.'); return; }
    const phone=normPhone(q.operatorPhone||forwardPhone);
    if(!phone){ setNotice('Preencha o WhatsApp do responsável.'); return; }
    const topicLine=forwardTopic?`Tópico: ${forwardTopic}.\n`:'';
    const baseText=q.operatorText||`${topicLine}Olá, {operador_destino_nome}! Encaminhando atendimento de {nome} ({telefone}).\nFunção: {operador_destino_funcao} | Operação: {operacao} | Agendamento: {agenda_resumo}\nObservação: {observacao_encaminhamento}\nResumo:\n{resumo_conversa}`;
    const text=renderTemplate((forwardUrgent?'⚠️ URGENTE — ':'')+baseText,q).trim();
    if(!text){ setNotice('Texto vazio para o responsável.'); return; }
    try{ const d=await fetchJson('/api/crm/send-message',{method:'POST',headers:apiHeaders(token),body:JSON.stringify({operation:selected.operation,telefone_norm:selected.telefone_norm,telefone_destino:phone,destino_tipo:'OPERADOR',message_text:text,operador:operator,operador_destino_nome:q.operatorName||forwardName,operador_destino_funcao:q.operatorRole||forwardRole,lead_message_text:leadMessage,quick_action:'ENCAMINHAR_OPERADOR',quick_title:q.title||'Encaminhamento'})}); setNotice('Encaminhado para '+(q.operatorName||forwardName||'responsável')+'.'); return d; }
    catch(e){ setNotice('Erro ao encaminhar: '+e.message); }
  }
  async function sendQuick(q){
    if(!selected){ setNotice('Selecione um lead antes de usar mensagem rápida.'); return; }
    if(q.action==='CONFIRMAR_AGENDAMENTO'&&!(selectedSchedule?.data_agendamento||scheduleDate)){ setNotice('Confirme data e horário antes.'); return; }
    const leadText=renderTemplate(q.text,q).trim();
    if(leadText) await sendMessage(leadText,{quick_action:q.action,quick_title:q.title});
    if(q.action==='ENCAMINHAR_OPERADOR') await notifyOperator(q,leadText);
  }
  async function updateStatus(s,leadOverride){
    const lead=leadOverride||selected;
    if(!lead){ setNotice('Selecione um lead.'); return; }
    try{
      await fetchJson('/api/crm/update-status',{method:'POST',headers:apiHeaders(token),body:JSON.stringify({operation:lead.operation,telefone_norm:lead.telefone_norm,status_atendimento:s,operador:operator})});
      // atualização otimista — sem recarregar tudo
      setLeads(prev=>prev.map(l=>(l.telefone_norm===lead.telefone_norm&&l.operation===lead.operation)?{...l,status_atendimento:s}:l));
      if(selected?.telefone_norm===lead.telefone_norm&&selected?.operation===lead.operation) setSelected(p=>p?{...p,status_atendimento:s}:p);
      setNotice('Status → '+s+'.');
    }catch(e){ setNotice('Erro: '+e.message); }
  }
  async function saveSchedule(){
    if(!selected){ setNotice('Selecione um lead.'); return; }
    if(!scheduleDate||!scheduleTime){ setNotice('Informe data e horário.'); return; }
    try{ const r=await fetchJson('/api/crm/schedule',{method:'POST',headers:apiHeaders(token),body:JSON.stringify({operation:selected.operation,telefone_norm:selected.telefone_norm,data_agendamento:scheduleDate,hora_agendamento:scheduleTime,operador:operator,observacao:scheduleObs,status:'AGENDADO'})}); setLatestSchedule(r.agendamento||{data_agendamento:scheduleDate,hora_agendamento:scheduleTime,observacao:scheduleObs,status:'AGENDADO'}); await loadAgenda(true); setNotice('Agendamento confirmado. Use a mensagem de confirmação.'); }
    catch(e){ setNotice('Erro ao agendar: '+e.message); }
  }
  function applySlot(slotDate){ const iso=slotDate.toISOString().slice(0,10),hh=String(slotDate.getHours()).padStart(2,'0'),mm=String(slotDate.getMinutes()).padStart(2,'0'); setScheduleDate(iso); setScheduleTime(`${hh}:${mm}`); setSchedulePanel(null); setTab('atendimento'); setNotice(`Slot selecionado: ${brDate(iso)} às ${hh}:${mm}. Confirme no painel lateral.`); }
  async function runDebug(){ setDebugOpen(true); setDebug('Carregando...'); try{ const d=await fetchJson('/api/crm/debug',{headers:apiHeaders(token)}); setDebug(JSON.stringify(d,null,2)); }catch(e){ setDebug('Erro: '+e.message); } }
  function updateQuick(i,k,v){ setQuick(q=>q.map((x,idx)=>idx===i?{...x,[k]:v}:x)); setQuickDirty(true); }
  function addQuick(){ setQuick(q=>[...q,{title:'Nova mensagem',text:'',action:'MENSAGEM_LEAD',operatorName:'',operatorPhone:'',operatorRole:'',operatorText:'',active:true,ordem:(q.length+1)*10}]); setQuickDirty(true); }
  function removeQuick(i){ setQuick(q=>q.filter((_,idx)=>idx!==i)); setQuickDirty(true); }
  function useQuickText(q){ setDraft(renderTemplate(q.text,q)); setNotice('Mensagem carregada no campo de resposta.'); }
  function openFromAgenda(item){ const lead=leads.find(l=>l.telefone_norm===item.telefone_norm)||item.lead; setTab('atendimento'); if(lead) selectLead({...lead,operation:item.operation,telefone_norm:item.telefone_norm}); else setNotice('Lead não carregado. Clique em Buscar.'); }
  function saveAccess(){ try{ localStorage.setItem('rhimob_crm_token',token||''); localStorage.setItem('rhimob_crm_operator',operator||''); }catch(e){} setNotice('Acesso salvo.'); }

  /* ── DERIVED ──────────────────────────────── */
  const selectedName   = selected?.nome||selected?.telefone_display||selected?.telefone_norm||'Nenhum lead';
  const selectedStatus = statusInfo(selected?.status_atendimento);
  const scheduleLabel  = selectedSchedule?.data_agendamento?`${weekDay(selectedSchedule.data_agendamento)}, ${brDate(selectedSchedule.data_agendamento)} às ${timeShort(selectedSchedule.hora_agendamento)}`:'Sem agendamento';
  const forwardPreview = selected?`${forwardTopic?'['+forwardTopic+'] ':''}${forwardUrgent?'⚠️ URGENTE — ':''}Olá ${firstName(forwardName)||'responsável'}, encaminhando ${selectedName} (${opLabel(selected.operation)}).\nAgendamento: ${scheduleLabel}.\n${forwardObs?'Observação: '+forwardObs:''}`.trim():'Selecione um lead para montar o encaminhamento.';

  /* ── RENDER ───────────────────────────────── */
  return <div className="crmShell">

    {/* HEADER */}
    <header className="crmHeader">
      <div className="brand">
        <div className="brandIcon">RH</div>
        <div className="brandLabel"><strong>RH IMOB</strong><span>CRM · Painel</span></div>
      </div>
      <div className="hBar">
        <select className="hSel" value={operation} onChange={e=>setOperation(e.target.value)}>
          {operacoes.map(o=><option key={o.operation_key} value={o.operation_key}>{o.label}</option>)}
        </select>
        <input className="hInp" value={token} onChange={e=>setToken(e.target.value)} placeholder="Token operacional"/>
        <input className="hInp" value={operator} onChange={e=>setOperator(e.target.value)} placeholder="Operador"/>
        <button className="hBtn pri" onClick={saveAccess}>Salvar</button>
        <button className="hBtn pri" onClick={loadLeads} disabled={loading}>{loading?'Aguarde…':'Buscar leads'}</button>
        <button className="hBtn gh" onClick={runDebug}>Debug</button>
      </div>
      <div className="hConn"><em/> Supabase conectado</div>
    </header>

    {/* TABS */}
    <nav className="tabs">
      <button className={`tabBtn${tab==='atendimento'?' on':''}`} onClick={()=>setTab('atendimento')}>Atendimento</button>
      <button className={`tabBtn${tab==='pipeline'?' on':''}`} onClick={()=>setTab('pipeline')}>Pipeline</button>
      <button className={`tabBtn${tab==='agenda'?' on':''}`} onClick={()=>{ setTab('agenda'); loadAgenda(true); }}>
        Agenda <span className="tabCnt">{agHoje.length}</span>
      </button>
      <button className={`tabBtn${tab==='dashboard'?' on':''}`} onClick={()=>setTab('dashboard')}>Dashboard</button>
      <button className={`tabBtn${tab==='encaminhar'?' on':''}`} onClick={()=>setTab('encaminhar')}>Encaminhar</button>
      <span className="tabNotice">{notice}</span>
    </nav>

    {/* ATENDIMENTO */}
    {tab==='atendimento' && <main className="workGrid">

      {/* LEFT — leads */}
      <section className="leadPanel">
        <div className="lpHead">
          <div className="lpTitle">
            <h2>Leads</h2>
            <span className="lpCnt">{filteredLeads.length}{opFilter?'/'+leads.length:''}</span>
          </div>
          <div className="lpOpRow">
            <button className={`lpOpBtn${!opFilter?' all':''}`} onClick={()=>setOpFilter('')}>Todos</button>
            {operacoes.map(o=>{
              const isActive=opFilter===o.operation_key;
              const cls=isActive?` on`:'';
              return <button key={o.operation_key}
                className={`lpOpBtn${cls}`}
                style={isActive?{background:o.cor||'var(--brand)',color:'#fff',borderColor:o.cor||'var(--brand)'}:{}}
                onClick={()=>setOpFilter(o.operation_key)}>
                {o.label_short}
              </button>;
            })}
          </div>
          <div className="lpSearch">
            <span>⌕</span>
            <input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') loadLeads(); }} placeholder="Buscar lead…"/>
          </div>
          <div className="lpChips">
            <button className={`lpChip${!status?' on':''}`} onClick={()=>setStatus('')}>Todos</button>
            <button className={`lpChip${status==='EM_ATENDIMENTO'?' on':''}`} onClick={()=>setStatus('EM_ATENDIMENTO')}>Quentes</button>
            <button className={`lpChip${status==='AGENDADO'?' on':''}`} onClick={()=>setStatus('AGENDADO')}>Agendados</button>
            <button className={`lpChip${status==='DESCARTADO'?' on':''}`} onClick={()=>setStatus('DESCARTADO')}>Descartados</button>
          </div>
        </div>
        <div className="leadScroll">
          {/* skeleton enquanto carrega na primeira vez */}
          {loading && !leads.length && [0,1,2,3,4].map(i=><div key={i} className="skCard"><div className="skLine skW70"/><div className="skLine skW45"/><div className="skLine skW90 skThin"/></div>)}
          {!loading && todaysLeads.length>0 && <>
            <div className="grpLbl grn">📅 Reunião hoje</div>
            {todaysLeads.map(l=><LeadCard key={l.operation+l.telefone_norm} lead={l} ag={scheduleByPhone[l.telefone_norm]} active={selected?.telefone_norm===l.telefone_norm&&selected?.operation===l.operation} onClick={()=>selectLead(l)} onClockClick={openSchedulePanel}/>)}
          </>}
          {!loading && activeLeads.length>0 && <>
            <div className="grpLbl">Leads ativos</div>
            {activeLeads.map(l=><LeadCard key={l.operation+l.telefone_norm} lead={l} ag={scheduleByPhone[l.telefone_norm]} active={selected?.telefone_norm===l.telefone_norm&&selected?.operation===l.operation} onClick={()=>selectLead(l)} onClockClick={openSchedulePanel}/>)}
          </>}
          {!loading && !leads.length && <div className="emptyState"><span style={{fontSize:28,display:'block',marginBottom:8}}>🔍</span>Nenhum lead encontrado.<br/>Verifique o token ou use os filtros acima.</div>}
        </div>
      </section>

      {/* CENTER — chat */}
      <section className="chatPanel">
        <div className="chatHead">
          <div className={`chatAv${selected?.operation==='CORRETORES_CRECI'?' creci':''}`}>{initials(selectedName).toUpperCase()}</div>
          <div className="chatInfo">
            <h2>{selectedName}</h2>
            <p>{selected?.telefone_display||maskPhone(selected?.telefone_norm)} · {selected?opLabel(selected.operation):'Selecione um lead'} · {selectedStatus.label}</p>
          </div>
          <div className="chatActs">
            <button className="chatActBtn pri" onClick={()=>{ if(selected) setForwardModalOpen(true); }} disabled={!selected}>⚡ Encaminhar</button>
            <button className="chatActBtn" onClick={()=>loadAgenda(true)}>Atualizar</button>
          </div>
        </div>
        <div className="conv">
          {!selected && !loading && <div className="convEmpty"><span style={{fontSize:32}}>💬</span><span>Selecione um lead para ver a conversa completa.</span></div>}
          {selected && loading && !messages.length && <div className="convSkWrap">{[0,1,2,3].map(i=><div key={i} className={`skBubble${i%2===0?' skBubbleOut':''}`}><div className="skLine" style={{width:['65%','45%','75%','55%'][i]}}/><div className="skLine skThin" style={{width:'30%'}}/></div>)}</div>}
          {selected && !loading && !messages.length && <div className="convDanger">Conversa ainda não sincronizada em crm_mensagens.<br/>Rode o Apps Script 08 para sincronizar.</div>}
          {messages.map((m,idx)=>{
            const isOut=String(m.direction||'').toUpperCase()==='OUT';
            return <div key={idx} className={`bubble ${isOut?'out':'in'}`}>
              <div className="bubbleBody">{m.message_text||m.texto||''}</div>
              <div className="bubbleMeta">{String(m.direction||'').toUpperCase()} · {m.source||''} · {fmtDate(m.message_at||m.created_at)}</div>
            </div>;
          })}
          <div ref={endRef}/>
        </div>
        <div className="composer">
          <textarea className="composerTA" value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); sendMessage(); } }} placeholder={selected?`Responder ${firstName(selectedName)}… (Enter para enviar)`:'Selecione um lead para responder'}/>
          <button className="composerSend" onClick={()=>sendMessage()} disabled={loading||!selected}>Enviar →</button>
        </div>
      </section>

      {/* RIGHT — side panel */}
      <aside className="sidePanel">
        <SideContent
          selected={selected} selectedName={selectedName} selectedStatus={selectedStatus}
          scheduleLabel={scheduleLabel} scheduleDate={scheduleDate} setScheduleDate={setScheduleDate}
          scheduleTime={scheduleTime} setScheduleTime={setScheduleTime}
          scheduleObs={scheduleObs} setScheduleObs={setScheduleObs}
          saveSchedule={saveSchedule} updateStatus={updateStatus}
          quick={quick} updateQuick={updateQuick} addQuick={addQuick} removeQuick={removeQuick}
          saveQuick={saveQuick} quickSaving={quickSaving}
          useQuickText={useQuickText} sendQuick={sendQuick} renderTemplate={renderTemplate}
          hasSchedule={!!selectedSchedule?.data_agendamento}
          onOpenSchedulePanel={()=>{ if(selected&&selectedSchedule) openSchedulePanel(selected,selectedSchedule); }}
          notes={notes} noteDraft={noteDraft} setNoteDraft={setNoteDraft}
          noteSaving={noteSaving} saveNote={saveNote} deleteNote={deleteNote}
        />
      </aside>
    </main>}

    {/* PIPELINE */}
    {tab==='pipeline' && <KanbanBoard
      leads={leads} scheduleByPhone={scheduleByPhone}
      dragLead={dragLead} dragOverStatus={dragOverStatus}
      onDragStart={handleDragStart} onDragOver={handleDragOver}
      onDragLeave={handleDragLeave} onDrop={handleDrop}
      onSelectLead={openKanbanLead} onRefresh={loadLeads}
    />}

    {/* AGENDA */}
    {tab==='agenda' && <AgendaTab agenda={agenda} operation={operation} loadAgenda={()=>loadAgenda(false)} openFromAgenda={openFromAgenda} proximaAgenda={proximaAgenda}/>}

    {/* DASHBOARD */}
    {tab==='dashboard' && <DashboardTab
      leads={leads} agenda={agenda} agHoje={agHoje}
      operation={operation} onRefresh={loadLeads}
    />}

    {/* ENCAMINHAR */}
    {tab==='encaminhar' && <ForwardTab
      selected={selected} selectedName={selectedName} scheduleLabel={scheduleLabel}
      forwardTopic={forwardTopic} setForwardTopic={setForwardTopic}
      forwardName={forwardName} setForwardName={setForwardName}
      forwardPhone={forwardPhone} setForwardPhone={setForwardPhone}
      forwardRole={forwardRole} setForwardRole={setForwardRole}
      forwardUrgent={forwardUrgent} setForwardUrgent={setForwardUrgent}
      forwardObs={forwardObs} setForwardObs={setForwardObs}
      forwardPreview={forwardPreview}
      operators={operators}
      opSlots={opSlots} opSlotsEditing={opSlotsEditing}
      setOpSlotsEditing={setOpSlotsEditing} selectedOpSlot={selectedOpSlot}
      updateOpSlot={updateOpSlot} saveOpSlots={saveOpSlotsLS} selectOpSlot={selectOpSlot}
      notifyOperator={()=>notifyOperator({operatorName:forwardName,operatorPhone:forwardPhone,operatorRole:forwardRole})}
      setTab={setTab}
    />}

    {/* QUICK FORWARD MODAL */}
    {forwardModalOpen && <QuickForwardModal
      selected={selected} selectedName={selectedName} scheduleLabel={scheduleLabel}
      opSlots={opSlots} selectedOpSlot={selectedOpSlot} selectOpSlot={selectOpSlot}
      forwardTopic={forwardTopic} setForwardTopic={setForwardTopic}
      forwardObs={forwardObs} setForwardObs={setForwardObs}
      forwardUrgent={forwardUrgent} setForwardUrgent={setForwardUrgent}
      forwardName={forwardName} forwardPhone={forwardPhone} forwardRole={forwardRole}
      forwardPreview={forwardPreview}
      onSend={async()=>{ await notifyOperator({operatorName:forwardName,operatorPhone:forwardPhone,operatorRole:forwardRole}); setForwardModalOpen(false); }}
      onClose={()=>setForwardModalOpen(false)}
    />}

    {/* SCHEDULE MODAL */}
    {schedulePanel && <SchedulePanel
      lead={schedulePanel.lead} schedule={schedulePanel.schedule}
      reminders={reminders} remindersLoading={remindersLoading}
      messages={messages} operation={schedulePanel.lead?.operation||operation}
      modelos={modelos} modelosLoading={modelosLoading} modelosSaving={modelosSaving}
      onSaveModelo={saveModelo}
      onClose={()=>setSchedulePanel(null)} onSelectSlot={applySlot}
    />}

    <button className="debugDot" onClick={()=>debugOpen?setDebugOpen(false):runDebug()} title="Debug"/>
    {debugOpen && <pre className="debugPanel">{debug}</pre>}
  </div>;
}

/* ══════════════════════════════════════════════════════════════
   LEAD CARD
══════════════════════════════════════════════════════════════ */
function LeadCard({ lead, ag, active, onClick, onClockClick }){
  const si = statusInfo(lead.status_atendimento);
  const min = minutesUntil(ag);
  const isToday = String(ag?.data_agendamento||'').slice(0,10)===hojeISO();
  const hasSchedule = !!ag?.data_agendamento;
  const isUnread = String(lead.ultima_direcao||'').toUpperCase()==='IN';
  const isCreci = lead.operation==='CORRETORES_CRECI';
  return <button
    className={`lcCard ${si.lcls} ${active?'active':''} ${isToday?'lcToday':''}`}
    onClick={onClick}
  >
    <div className="lcTop">
      <div className="lcNameWrap">
        {isUnread && <span className="lcDot"/>}
        <span className="lcName">{lead.nome||lead.telefone_display||lead.telefone_norm}</span>
      </div>
      <div className="lcRight">
        {hasSchedule && <span className="lcClock" onClick={e=>{ e.stopPropagation(); onClockClick(lead,ag); }} title="Ver agendamento e lembretes">🕐</span>}
        <span className="lcTime">{fmtDate(lead.ultima_atividade_em||lead.updated_at)||'—'}</span>
      </div>
    </div>
    <div className="lcPreview">{lead.ultima_mensagem||'Sem mensagem registrada'}</div>
    <div className="lcTags">
      <span className={`lcOp ${isCreci?'creci':'nt'}`}>{opShort(lead.operation)}</span>
      <span className={`lcSt ${si.scls}`}>{si.label}</span>
      {isToday && <span className="lcAg">📅 {timeShort(ag.hora_agendamento)}</span>}
      {hasSchedule&&!isToday && <span className="lcAgIcon" title="Agendado">📅</span>}
      {slaLabel(lead) && <span className="slaTag">{slaLabel(lead)}</span>}
    </div>
    {isToday && <div className="lcCountdown">⏱ Reunião em {countdownLabel(min)}</div>}
  </button>;
}

/* ══════════════════════════════════════════════════════════════
   SCHEDULE PANEL (MODAL)
══════════════════════════════════════════════════════════════ */
const REMINDER_TIPOS=[
  {tipo:'LEMBRETE_24H',          label:'Confirmação 24h antes',          icon:'🔔', hint:'Enviado ~24h antes do agendamento.'},
  {tipo:'LEMBRETE_MANHA',        label:'Bom dia (manhã do dia)',          icon:'☀️', hint:'Enviado às 7h–9h30 do dia do agendamento.'},
  {tipo:'LEMBRETE_PREVIO_RANDOM',label:'Lembrete 60–90 min antes',       icon:'⏳', hint:'Enviado entre 60 e 90 minutos antes.'},
  {tipo:'LEMBRETE_INICIO',       label:'Aviso de início (1–5 min)',       icon:'🚀', hint:'Enviado 1 a 5 minutos antes do início.'}
];

function SchedulePanel({ lead, schedule, reminders, remindersLoading, messages, operation, modelos, modelosLoading, modelosSaving, onSaveModelo, onClose, onSelectSlot }){
  /* local editable copies of templates */
  const [localTxt,  setLocalTxt]  = useState({});
  const [localAtivo,setLocalAtivo]= useState({});
  const [saved,     setSaved]     = useState({});

  useEffect(()=>{
    const t={}, a={};
    (modelos||[]).forEach(m=>{ t[m.tipo]=m.texto_modelo||''; a[m.tipo]=!!m.ativo; });
    setLocalTxt(t); setLocalAtivo(a); setSaved({});
  },[modelos]);

  function setTxt(tipo,v){ setLocalTxt(p=>({...p,[tipo]:v})); setSaved(p=>({...p,[tipo]:false})); }
  function toggleAtivo(tipo){ setLocalAtivo(p=>({...p,[tipo]:!p[tipo]})); setSaved(p=>({...p,[tipo]:false})); }
  async function handleSave(tipo){
    await onSaveModelo(operation, tipo, { texto_modelo:localTxt[tipo]||'', ativo:!!localAtivo[tipo] });
    setSaved(p=>({...p,[tipo]:true}));
    setTimeout(()=>setSaved(p=>({...p,[tipo]:false})),2200);
  }

  const rm={}; (reminders||[]).forEach(r=>{ if(!rm[r.tipo])rm[r.tipo]=r; });
  const showReagendar=hasReagendarIntent(messages);
  const slots=showReagendar?calcSlots(operation):[];
  function stBadge(tipo){ const r=rm[tipo]; if(!r)return <Badge type="neu">Pendente</Badge>; if(r.status==='ENVIADO')return <Badge type="ok">✓ Enviado</Badge>; if(r.status==='ERRO')return <Badge type="err">✗ Erro</Badge>; return <Badge type="neu">{r.status||'Registrado'}</Badge>; }

  return <div className="modalOverlay" onClick={onClose}>
    <div className="modalBox" onClick={e=>e.stopPropagation()}>
      {/* HEADER */}
      <div className="modalHd">
        <div>
          <h3>🕐 Agendamento</h3>
          <span>{lead?.nome||lead?.telefone_norm}</span>
          <span>{schedule?.data_agendamento?`${weekDay(schedule.data_agendamento)}, ${brDate(schedule.data_agendamento)} às ${timeShort(schedule.hora_agendamento)}`:'Sem data definida'}</span>
        </div>
        <button className="modalClose" onClick={onClose}>Fechar ✕</button>
      </div>

      <div className="modalBody">
        {/* STATUS DOS LEMBRETES */}
        <div>
          <div className="remHd">Status dos lembretes (Apps Script)</div>
          {remindersLoading && <div className="emptyState" style={{padding:'14px 0'}}>Carregando lembretes…</div>}
          {!remindersLoading && REMINDER_TIPOS.map(({tipo,label,icon})=><div className="remRow" key={tipo}>
            <span style={{fontSize:14,flexShrink:0}}>{icon}</span>
            <span className="remLabel">{label}</span>
            {stBadge(tipo)}
            {rm[tipo]?.enviado_em && <span className="remTime">{fmtDate(rm[tipo].enviado_em)}</span>}
          </div>)}
          {!remindersLoading&&!reminders.length && <p style={{fontSize:12,color:'var(--faint)',paddingTop:4}}>Nenhum registro de lembrete para este agendamento.</p>}
        </div>

        {/* EDITOR DE MODELOS */}
        <div className="modelSection">
          <div className="modelSectionHd">✏️ Configurar mensagens automáticas — {operation==='CORRETORES_CRECI'?'CRECI':'Novos Talentos'}</div>
          {modelosLoading && <div className="emptyState" style={{padding:'12px 0',fontSize:12}}>Carregando modelos…</div>}
          {!modelosLoading && REMINDER_TIPOS.map(({tipo,label,icon,hint})=>{
            const ativo = localAtivo[tipo]!==undefined ? localAtivo[tipo] : true;
            const saving = !!modelosSaving[tipo];
            const isSaved = !!saved[tipo];
            return <div key={tipo} className={`modelCard${!ativo?' inactive':''}`}>
              <div className="modelCardHead">
                <span className="modelCardIcon">{icon}</span>
                <span className="modelCardLabel">{label}</span>
                <label className="toggleWrap" onClick={e=>e.stopPropagation()}>
                  <span className="toggleLbl">{ativo?'Ativo':'Inativo'}</span>
                  <label className="toggle">
                    <input type="checkbox" checked={!!ativo} onChange={()=>toggleAtivo(tipo)}/>
                    <span className="toggleSlider"/>
                  </label>
                </label>
              </div>
              <div className="modelCardBody">
                <textarea
                  className="modelTA"
                  value={localTxt[tipo]||''}
                  onChange={e=>setTxt(tipo,e.target.value)}
                  placeholder={`Texto da mensagem para ${label.toLowerCase()}…\nPlaceholders: {primeiro_nome}, {hora_agendamento}, {data_agendamento}, {dia_semana_agendamento}`}
                  rows={3}
                />
                <div className="modelHint">{hint} Placeholders: {'{primeiro_nome}'}, {'{hora_agendamento}'}, {'{data_agendamento}'}.</div>
                <div className="modelActions">
                  <button className="modelSaveBtn" onClick={()=>handleSave(tipo)} disabled={saving}>
                    {saving?'Salvando…':'Salvar'}
                  </button>
                  {isSaved && <span className="modelSavedTag">✓ Salvo</span>}
                </div>
              </div>
            </div>;
          })}
          {!modelosLoading&&!modelos.length && <p style={{fontSize:11.5,color:'var(--faint)',lineHeight:1.5}}>Modelos não encontrados no Supabase.<br/>Execute o patch SQL <code>06_PATCH_LEMBRETE_MANHA_V19.sql</code> para cadastrar os 4 modelos.</p>}
        </div>

        {/* REAGENDAMENTO */}
        {showReagendar && <div className="slotSec">
          <h4>⚠ Intenção de reagendamento detectada</h4>
          <p>Selecione um slot para pré-preencher o agendamento:</p>
          <div className="slotBtns">
            {slots.map((d,i)=><button key={i} className="slotBtn" onClick={()=>onSelectSlot(d)}>
              Slot {i+1} — {d.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'2-digit'})} às {d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
            </button>)}
          </div>
          <p className="slotNote">Após selecionar, confirme o agendamento no painel lateral e envie a mensagem de confirmação.</p>
        </div>}
      </div>
    </div>
  </div>;
}

/* ══════════════════════════════════════════════════════════════
   QUICK FORWARD MODAL
   Abre diretamente do botão no cabeçalho do chat, sem sair do
   tab de Atendimento. Mostra slots de operadores, chips de
   tópico, observação, prévia e botão de envio em um único gesto.
══════════════════════════════════════════════════════════════ */
function QuickForwardModal({ selected, selectedName, scheduleLabel, opSlots, selectedOpSlot, selectOpSlot, forwardTopic, setForwardTopic, forwardObs, setForwardObs, forwardUrgent, setForwardUrgent, forwardName, forwardPhone, forwardRole, forwardPreview, onSend, onClose }){
  const ready = selectedOpSlot!==null && opSlots[selectedOpSlot]?.name && !!forwardPhone;
  const hasAnySlot = (opSlots||[]).some(s=>s.name);
  return <div className="modalOverlay" onClick={onClose}>
    <div className="qfModalBox" onClick={e=>e.stopPropagation()}>

      {/* HEADER */}
      <div className="modalHd">
        <div>
          <h3>⚡ Encaminhar atendimento</h3>
          <span>{selectedName} · {scheduleLabel}</span>
        </div>
        <button className="modalClose" onClick={onClose}>Fechar ✕</button>
      </div>

      <div className="modalBody">

        {/* 1 — SLOTS DE OPERADORES */}
        <div>
          <div className="remHd">① Selecione o responsável</div>
          <div className="qfSlotsRow">
            {(opSlots||[]).map((s,i)=> s.name
              ? <button key={i} className={`qfSlot${selectedOpSlot===i?' sel':''}`} onClick={()=>selectOpSlot(i)}>
                  <div className="qfSlotAv" style={{background:s.color||'#4f46e5'}}>{initials(s.name).toUpperCase()}</div>
                  <div className="qfSlotName">{s.name}</div>
                  <div className="qfSlotRole">{s.role||'Responsável'}</div>
                  {selectedOpSlot===i && <span className="opSlotSel">✓</span>}
                </button>
              : <div key={i} className="qfSlot empty">
                  <div className="qfSlotAv" style={{background:'#e2e8f0',color:'#94a3b8',fontSize:20}}>+</div>
                  <div className="qfSlotRole" style={{color:'var(--faint)'}}>Vazio</div>
                </div>
            )}
          </div>
          {!hasAnySlot && <p style={{fontSize:12,color:'var(--faint)',textAlign:'center',padding:'6px 0',lineHeight:1.5}}>Nenhum responsável configurado.<br/>Acesse a aba <strong>Encaminhar</strong> para cadastrar os slots.</p>}
        </div>

        {/* 2 — TÓPICO */}
        <div>
          <div className="remHd">② Tópico do encaminhamento</div>
          <div className="qfTopics">
            {FORWARD_TOPICS.map(t=>(
              <button key={t} className={`qfChip${forwardTopic===t?' on':''}`} onClick={()=>setForwardTopic(forwardTopic===t?'':t)}>{t}</button>
            ))}
          </div>
        </div>

        {/* 3 — OBSERVAÇÃO */}
        <div>
          <div className="remHd">③ Observação (opcional)</div>
          <textarea className="modelTA" value={forwardObs} onChange={e=>setForwardObs(e.target.value)}
            placeholder="Contexto adicional para o responsável — ex: lead já tem agendamento, demonstrou urgência, etc."
            rows={2}/>
        </div>

        {/* 4 — URGENTE */}
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'2px 0'}}>
          <label className="toggle" style={{flexShrink:0}}>
            <input type="checkbox" checked={!!forwardUrgent} onChange={()=>setForwardUrgent(p=>!p)}/>
            <span className="toggleSlider"/>
          </label>
          <span style={{fontSize:13,fontWeight:700,color:forwardUrgent?'var(--hot)':'var(--muted)'}}>
            {forwardUrgent?'⚠️ Marcado como URGENTE':'Marcar como urgente'}
          </span>
        </div>

        {/* 5 — PRÉVIA */}
        <div>
          <div className="remHd">Prévia da mensagem ao responsável</div>
          <div className="fwPreview" style={{minHeight:70,fontSize:12,lineHeight:1.55}}>{forwardPreview}</div>
        </div>

        {/* 6 — ENVIAR */}
        <button className="fwSendBtn" onClick={onSend} disabled={!selected||!ready}>
          {ready
            ? `✓ Enviar encaminhamento para ${forwardName}`
            : hasAnySlot ? 'Selecione um responsável acima' : 'Configure os responsáveis na aba Encaminhar'}
        </button>

      </div>
    </div>
  </div>;
}

/* ══════════════════════════════════════════════════════════════
   SIDE CONTENT (right panel)
══════════════════════════════════════════════════════════════ */
function SideContent({ selected, selectedName, selectedStatus, scheduleLabel, scheduleDate, setScheduleDate, scheduleTime, setScheduleTime, scheduleObs, setScheduleObs, saveSchedule, updateStatus, quick, updateQuick, addQuick, removeQuick, saveQuick, quickSaving, useQuickText, sendQuick, renderTemplate, hasSchedule, onOpenSchedulePanel, notes, noteDraft, setNoteDraft, noteSaving, saveNote, deleteNote }){
  return <div className="sidePad">
    {/* Lead data */}
    <div className="box">
      <div className="boxHd"><span className="boxTitle">Dados do lead</span></div>
      <div className="dl"><span className="dl-k">Nome</span><span className="dl-v">{selected?.nome||'—'}</span></div>
      <div className="dl"><span className="dl-k">Telefone</span><span className="dl-v">{maskPhone(selected?.telefone_norm)}</span></div>
      <div className="dl"><span className="dl-k">Operação</span><span className="dl-v">{selected?opLabel(selected.operation):'—'}</span></div>
      <div className="dl"><span className="dl-k">Status</span><span className="dl-v">{selectedStatus.label}</span></div>
      <div className="dlAgRow">
        <span className="dlAgLeft">Agendamento</span>
        <span className="dlAgRight">
          <span className="dlAgVal">{scheduleLabel}</span>
          {hasSchedule && <button className="dlClockBtn" onClick={onOpenSchedulePanel}>🕐 Lembretes</button>}
        </span>
      </div>
      <div className="dl" style={{borderBottom:'none'}}><span className="dl-k">Última atividade</span><span className="dl-v">{fmtDate(selected?.ultima_atividade_em)||'—'}</span></div>
    </div>

    {/* Status */}
    <div className="box">
      <div className="boxHd"><span className="boxTitle">Status rápido</span></div>
      <select className="stSelect" value={selected?.status_atendimento||''} onChange={e=>updateStatus(e.target.value)} disabled={!selected}>
        <option value="">Selecionar status…</option>
        <option value="EM_ATENDIMENTO">Em atendimento</option>
        <option value="AGENDADO">Agendado</option>
        <option value="QUALIFICADO">Qualificado</option>
        <option value="DESCARTADO">Descartado</option>
      </select>
    </div>

    {/* Notes */}
    <div className="box">
      <div className="boxHd"><span className="boxTitle">📝 Notas internas</span><span className="boxBadge">{(notes||[]).length} nota{(notes||[]).length!==1?'s':''}</span></div>
      {selected && <div className="notesList">
        {(notes||[]).map(n=><div key={n.id||n.created_at} className="noteItem">
          <div className="noteText">{n.nota}</div>
          <div className="noteMeta">{n.operador||'—'} · {fmtDate(n.created_at)}</div>
          {n.id && <button className="noteDelBtn" onClick={()=>deleteNote(n.id)} title="Excluir nota">✕</button>}
        </div>)}
        {!(notes||[]).length && <p style={{fontSize:12,color:'var(--faint)',textAlign:'center',padding:'8px 0'}}>Nenhuma nota para este lead.</p>}
      </div>}
      <div className="noteAddRow">
        <textarea className="noteTA" value={noteDraft} onChange={e=>setNoteDraft(e.target.value)} placeholder={selected?'Adicionar nota interna…':'Selecione um lead'} disabled={!selected} onKeyDown={e=>{ if(e.key==='Enter'&&e.ctrlKey){ e.preventDefault(); saveNote(); } }}/>
        <button className="noteSaveBtn" onClick={saveNote} disabled={!selected||noteSaving||!noteDraft.trim()}>{noteSaving?'…':'Salvar'}</button>
      </div>
      <p style={{fontSize:10,color:'var(--faint)',marginTop:4}}>Ctrl+Enter para salvar rapidamente.</p>
    </div>

    {/* Schedule */}
    <div className="box">
      <div className="boxHd"><span className="boxTitle">Agendamento</span></div>
      <div className="schRow">
        <input className="schIn" type="date" value={scheduleDate} onChange={e=>setScheduleDate(e.target.value)}/>
        <input className="schIn" type="time" value={scheduleTime} onChange={e=>setScheduleTime(e.target.value)}/>
      </div>
      <textarea className="schNote" value={scheduleObs} onChange={e=>setScheduleObs(e.target.value)} placeholder="Observação…" rows={2}/>
      <button className="schBtn" onClick={saveSchedule} disabled={!selected}>✓ Confirmar agendamento</button>
      <p className="schHint">Após confirmar, envie a mensagem rápida de confirmação para o lead.</p>
    </div>

    {/* Quick messages — respostas diretas ao lead */}
    <div className="box">
      <div className="boxHd">
        <span className="boxTitle">💬 Respostas rápidas</span>
        <span className="boxBadge">{quickSaving?'salvando…':`${quick.length} msg`}</span>
      </div>
      <p style={{fontSize:11,color:'var(--faint)',marginBottom:8,lineHeight:1.4}}>
        Clique <b>Usar</b> para editar antes de enviar, ou <b>Enviar</b> para despachar direto.<br/>
        Placeholders: {'{primeiro_nome}'}, {'{agenda_resumo}'}, {'{resumo_conversa}'}.
      </p>
      {quick.filter(q=>q.action!=='ENCAMINHAR_OPERADOR').map((q,i)=>{
        const realIdx=quick.indexOf(q);
        return <div className="qmCard" key={realIdx}>
          <input className="qmIn" value={q.title} onChange={e=>updateQuick(realIdx,'title',e.target.value)} placeholder="Título"/>
          <select className="qmSel" value={q.action||'MENSAGEM_LEAD'} onChange={e=>updateQuick(realIdx,'action',e.target.value)}>
            <option value="MENSAGEM_LEAD">Mensagem para o lead</option>
            <option value="CONFIRMAR_AGENDAMENTO">Confirmar agendamento</option>
          </select>
          <textarea className="qmTA" value={q.text} onChange={e=>updateQuick(realIdx,'text',e.target.value)} placeholder="Texto enviado para o lead…"/>
          <div className="qmPreview"><b>Prévia:</b> {renderTemplate(q.text,q).slice(0,160)}</div>
          <div className="qmActs">
            <button className="bSm soft" onClick={()=>useQuickText(q)} title="Carrega no campo de resposta">Usar</button>
            <button className="bSm sol" onClick={()=>sendQuick(q)} disabled={!selected} title="Envia imediatamente">Enviar</button>
            <button className="bSm del" onClick={()=>removeQuick(realIdx)}>✕</button>
          </div>
        </div>;
      })}
      <button className="qmAddBtn" onClick={addQuick}>+ Nova mensagem</button>
      <div className="qmSaveRow"><button className="bPri" onClick={()=>saveQuick(false)}>Salvar tudo</button></div>
    </div>
  </div>;
}

/* ══════════════════════════════════════════════════════════════
   AGENDA TAB
══════════════════════════════════════════════════════════════ */
function AgendaTab({ agenda, operation, loadAgenda, openFromAgenda, proximaAgenda }){
  return <div className="tabPage">
    <div className="pageHd">
      <div><h2>Agenda — {opLabel(operation)}</h2><p>Reuniões e lembretes da operação.</p></div>
      <button className="bPri" onClick={loadAgenda}>Atualizar</button>
    </div>
    {proximaAgenda && <div className="nextStrip">⏱ Próxima reunião: <b>{proximaAgenda.lead?.nome||proximaAgenda.telefone_norm}</b> · {brDate(proximaAgenda.data_agendamento)} às {timeShort(proximaAgenda.hora_agendamento)} · em {countdownLabel(minutesUntil(proximaAgenda))}</div>}
    <div className="agList">
      {agenda.map(item=><div className="agItem" key={item.id||item.telefone_norm+item.data_agendamento+item.hora_agendamento}>
        <div className="agHour"><b>{timeShort(item.hora_agendamento)}</b><span>{brDate(item.data_agendamento)}</span></div>
        <div className="agBody">
          <h3>{item.lead?.nome||item.telefone_norm}</h3>
          <p>{opLabel(item.operation)} · {item.status||'AGENDADO'} · {item.operador||'sem operador'}</p>
          <p>{item.observacao||'Sem observação.'}</p>
          <div className="agFlags">
            <span className="agFlag">24h</span>
            <span className="agFlag">90min</span>
            <span className="agFlag">5min</span>
            <span className="agFlag na">Apps Script</span>
          </div>
        </div>
        <button className="bGh" onClick={()=>openFromAgenda(item)}>Abrir conversa</button>
      </div>)}
      {!agenda.length && <div className="emptyState">Nenhum agendamento encontrado para os próximos dias.</div>}
    </div>
  </div>;
}

/* ══════════════════════════════════════════════════════════════
   KANBAN BOARD (Pipeline tab)
══════════════════════════════════════════════════════════════ */
const KANBAN_COLS = [
  { key:'NOVO',           label:'Novos',          color:'var(--brand)',  bg:'#e0e7ff', text:'var(--nt)'     },
  { key:'EM_ATENDIMENTO', label:'Em Atendimento', color:'var(--hot)',   bg:'var(--hot-bg)', text:'var(--hot)' },
  { key:'AGENDADO',       label:'Agendados',      color:'var(--ok)',    bg:'var(--ok-bg)',  text:'var(--ok)'  },
  { key:'QUALIFICADO',    label:'Qualificados',   color:'var(--purple)',bg:'var(--purple-bg)',text:'var(--purple)'},
  { key:'DESCARTADO',     label:'Descartados',    color:'var(--muted)', bg:'#f1f5f9', text:'var(--muted)'   },
];

function KanbanBoard({ leads, scheduleByPhone, dragLead, dragOverStatus, onDragStart, onDragOver, onDragLeave, onDrop, onSelectLead, onRefresh }){
  const byStatus={};
  KANBAN_COLS.forEach(c=>{ byStatus[c.key]=[]; });
  (leads||[]).forEach(l=>{ const s=l.status_atendimento||'NOVO'; if(byStatus[s]) byStatus[s].push(l); });
  return <div className="kanbanWrap">
    <div className="kanbanToolbar">
      <div className="kanbanToolbarLeft">
        <span>📋 Pipeline — arraste um card para mudar o status</span>
        <span style={{color:'var(--faint)'}}>·</span>
        <span style={{color:'var(--faint)'}}>{(leads||[]).length} leads</span>
      </div>
      <button className="bPri" style={{height:30,fontSize:12,padding:'0 14px'}} onClick={onRefresh}>Atualizar</button>
    </div>
    <div className="kanbanBoard">
      {KANBAN_COLS.map(({key,label,color,bg,text})=>{
        const cards=byStatus[key]||[];
        const isDragOver=dragOverStatus===key;
        return <div key={key} className="kanbanCol">
          <div className="kanbanColHd" style={{borderTopColor:color}}>
            <span className="kanbanColTitle" style={{color:text}}>{label}</span>
            <span className="kanbanColCnt" style={{background:bg,color:text}}>{cards.length}</span>
          </div>
          <div className={`kanbanCards${isDragOver?' dov':''}`}
            onDragOver={e=>onDragOver(key,e)} onDragLeave={onDragLeave} onDrop={()=>onDrop(key)}>
            {cards.map(lead=><KanbanCard key={lead.operation+lead.telefone_norm} lead={lead}
              ag={scheduleByPhone?.[lead.telefone_norm]}
              isDragging={dragLead?.telefone_norm===lead.telefone_norm&&dragLead?.operation===lead.operation}
              onDragStart={e=>onDragStart(lead,e)} onClick={()=>onSelectLead(lead)}/>)}
            {!cards.length && <div className="kanbanEmpty">Nenhum lead<br/>neste estágio</div>}
          </div>
        </div>;
      })}
    </div>
  </div>;
}

function KanbanCard({ lead, ag, isDragging, onDragStart, onClick }){
  const isUnread=String(lead.ultima_direcao||'').toUpperCase()==='IN';
  const sla=slaLabel(lead);
  const isCreci=lead.operation==='CORRETORES_CRECI';
  const hasAg=!!ag?.data_agendamento;
  return <div className={`kanbanCard${isDragging?' dragging':''}`} draggable onDragStart={onDragStart} onClick={onClick}>
    <div className="kanbanCardName">
      {isUnread&&<span className="lcDot"/>}
      {lead.nome||lead.telefone_display||lead.telefone_norm}
    </div>
    {lead.ultima_mensagem&&<div className="kanbanCardPrev">{lead.ultima_mensagem}</div>}
    <div className="kanbanCardFoot">
      <span className={`lcOp ${isCreci?'creci':'nt'}`}>{opShort(lead.operation)}</span>
      {hasAg&&<span className="lcAg">📅 {timeShort(ag.hora_agendamento)}</span>}
      {sla&&<span className="slaTag">{sla}</span>}
    </div>
  </div>;
}

/* ══════════════════════════════════════════════════════════════
   DASHBOARD TAB
══════════════════════════════════════════════════════════════ */
function DashboardTab({ leads, agenda, agHoje, operation, onRefresh }){
  const all=leads||[];
  const total=all.length;
  // status counts
  const byStatus={};
  all.forEach(l=>{ const s=l.status_atendimento||'NOVO'; byStatus[s]=(byStatus[s]||0)+1; });
  const maxCnt=Math.max(...Object.values(byStatus),1);
  // SLA violations: ultima_direcao=IN, sem resposta > 2h
  const slaItems=all.filter(l=>{
    if(String(l.ultima_direcao||'').toUpperCase()!=='IN') return false;
    const h=(Date.now()-new Date(l.ultima_atividade_em||l.updated_at).getTime())/3600000;
    return h>=2;
  }).map(l=>({lead:l,h:Math.floor((Date.now()-new Date(l.ultima_atividade_em||l.updated_at).getTime())/3600000)}))
    .sort((a,b)=>b.h-a.h);
  // unread
  const unread=all.filter(l=>String(l.ultima_direcao||'').toUpperCase()==='IN');
  // funil approximate conversion
  const agendados=byStatus['AGENDADO']||0;
  const qualificados=byStatus['QUALIFICADO']||0;
  const taxaAgendamento=total>0?Math.round((agendados/total)*100):0;
  const taxaQualificacao=total>0?Math.round((qualificados/total)*100):0;

  const BARS=[
    {key:'NOVO',           label:'Novos',          color:'#2563eb'},
    {key:'EM_ATENDIMENTO', label:'Em Atendimento', color:'#dc2626'},
    {key:'AGENDADO',       label:'Agendados',      color:'#16a34a'},
    {key:'QUALIFICADO',    label:'Qualificados',   color:'#7c3aed'},
    {key:'DESCARTADO',     label:'Descartados',    color:'#94a3b8'},
  ];

  return <div className="dashPage">
    <div className="pageHd" style={{marginBottom:14}}>
      <div><h2>Dashboard — {opLabel(operation)}</h2><p>Visão operacional atualizada a cada carregamento.</p></div>
      <button className="bPri" onClick={onRefresh}>↺ Atualizar</button>
    </div>

    {/* KPI cards */}
    <div className="dashGrid">
      <div className="dashKpi"><div className="dashKpiVal">{total}</div><div className="dashKpiLbl">Total de leads</div></div>
      <div className="dashKpi"><div className="dashKpiVal" style={{color:'var(--hot)'}}>{unread.length}</div><div className="dashKpiLbl">Aguardando resposta</div></div>
      <div className="dashKpi"><div className="dashKpiVal" style={{color:'var(--warn)'}}>{slaItems.length}</div><div className="dashKpiLbl">SLA crítico (+2h)</div></div>
      <div className="dashKpi"><div className="dashKpiVal" style={{color:'var(--ok)'}}>{agHoje.length}</div><div className="dashKpiLbl">Reuniões hoje</div><div className="dashKpiSub">{(agenda||[]).length} agendados no total</div></div>
      <div className="dashKpi"><div className="dashKpiVal" style={{color:'var(--nt)'}}>{taxaAgendamento}%</div><div className="dashKpiLbl">Taxa agendamento</div></div>
      <div className="dashKpi"><div className="dashKpiVal" style={{color:'var(--purple)'}}>{taxaQualificacao}%</div><div className="dashKpiLbl">Taxa qualificação</div></div>
    </div>

    <div className="dashRow">
      {/* Distribuição por status */}
      <div className="dashSection">
        <div className="dashSectionTitle">📊 Distribuição por status</div>
        <div className="barChart">
          {BARS.map(({key,label,color})=><div key={key} className="barRow">
            <span className="barLabel">{label}</span>
            <div className="barTrack"><div className="barFill" style={{width:`${((byStatus[key]||0)/maxCnt)*100}%`,background:color}}/></div>
            <span className="barVal">{byStatus[key]||0}</span>
          </div>)}
        </div>
      </div>

      {/* Reuniões de hoje */}
      <div className="dashSection">
        <div className="dashSectionTitle">📅 Reuniões de hoje ({agHoje.length})</div>
        {agHoje.length>0
          ? <div className="alertList">{agHoje.map(a=><div key={a.id||a.telefone_norm} className="alertItem ok">
              <span className="alertItemName">{a.lead?.nome||a.telefone_norm}</span>
              <span className="alertItemBadge" style={{color:'var(--ok)'}}>{timeShort(a.hora_agendamento)}</span>
            </div>)}</div>
          : <p style={{fontSize:12,color:'var(--faint)',textAlign:'center',padding:'12px 0'}}>Nenhuma reunião hoje.</p>}
      </div>
    </div>

    {/* SLA violations */}
    {slaItems.length>0 && <div className="dashSection">
      <div className="dashSectionTitle">⚠️ SLA — Leads sem resposta há mais de 2h ({slaItems.length})</div>
      <div className="alertList">
        {slaItems.slice(0,12).map(({lead,h})=><div key={lead.telefone_norm} className={`alertItem ${h>=6?'red':'warn'}`}>
          <span className="alertItemName">{lead.nome||lead.telefone_display||lead.telefone_norm}</span>
          <span className="alertItemBadge" style={{color:h>=6?'var(--hot)':'var(--warn)'}}>{h}h</span>
        </div>)}
      </div>
    </div>}

    {!total && <div className="emptyState"><span style={{fontSize:28,display:'block',marginBottom:8}}>📊</span>Nenhum lead carregado. Clique em Atualizar ou vá em Atendimento.</div>}
  </div>;
}

/* ══════════════════════════════════════════════════════════════
   FORWARD TAB — with operator slots
══════════════════════════════════════════════════════════════ */
function ForwardTab({ selected, selectedName, scheduleLabel, forwardTopic, setForwardTopic, forwardName, setForwardName, forwardPhone, setForwardPhone, forwardRole, setForwardRole, forwardUrgent, setForwardUrgent, forwardObs, setForwardObs, forwardPreview, operators, opSlots, opSlotsEditing, setOpSlotsEditing, selectedOpSlot, updateOpSlot, saveOpSlots, selectOpSlot, notifyOperator, setTab }){
  return <div className="tabPage">
    <div className="pageHd">
      <div><h2>Encaminhar atendimento</h2><p>Direcione o lead para um responsável com contexto completo.</p></div>
      <button className="bGh" onClick={()=>setTab('atendimento')}>← Voltar</button>
    </div>

    {selected && <div className="ctxBanner">
      <b>Lead:</b> {selectedName} &nbsp;·&nbsp; <b>Operação:</b> {opLabel(selected.operation)} &nbsp;·&nbsp; <b>Agendamento:</b> {scheduleLabel}
    </div>}
    {!selected && <div className="ctxBanner" style={{background:'#fff7ed',borderColor:'#fed7aa',color:'#9a3412'}}>Nenhum lead selecionado. Vá para Atendimento e selecione um lead primeiro.</div>}

    {/* OPERATOR SLOTS */}
    <div className="opSlotsBox">
      <div className="opSlotsHd">
        <div>
          <h3>Responsáveis configurados</h3>
          <p>Clique em um responsável para preencher automaticamente os campos abaixo.</p>
        </div>
        <button className="bGh" style={{height:32,fontSize:12}} onClick={()=>{ if(opSlotsEditing) saveOpSlots(); else setOpSlotsEditing(true); }}>
          {opSlotsEditing?'✓ Salvar':'✎ Editar'}
        </button>
      </div>
      <div className="opSlotsRow">
        {opSlots.map((slot,i)=>{
          const isEmpty=!slot.name;
          const isSel=selectedOpSlot===i;
          return <div
            key={i}
            className={`opSlot${isEmpty?'':' clickable'}${isSel?' sel':''}${isEmpty?' empty':''}`}
            onClick={()=>{ if(!opSlotsEditing&&!isEmpty) selectOpSlot(i); }}
          >
            {opSlotsEditing
              ? <div className="opEditBox">
                  <input className="opEditIn" value={slot.name} onChange={e=>updateOpSlot(i,'name',e.target.value)} placeholder="Nome"/>
                  <input className="opEditIn" value={slot.phone} onChange={e=>updateOpSlot(i,'phone',e.target.value)} placeholder="WhatsApp (com DDD)"/>
                  <input className="opEditIn" value={slot.role} onChange={e=>updateOpSlot(i,'role',e.target.value)} placeholder="Função"/>
                </div>
              : <>
                  <div className="opSlotAv" style={{background:slot.color}}>{isEmpty?'+':(initials(slot.name).toUpperCase())}</div>
                  {isEmpty
                    ? <><span className="opSlotEmptyLbl">Configurar responsável</span></>
                    : <>
                        <span className="opSlotName">{slot.name}</span>
                        <span className="opSlotRole">{slot.role||'Sem função'}</span>
                        <span className="opSlotPhone">{slot.phone?maskPhone(slot.phone):'Sem telefone'}</span>
                        {isSel && <span className="opSlotSel">✔</span>}
                      </>
                  }
                </>
            }
          </div>;
        })}
      </div>
    </div>

    {/* FORWARD FORM */}
    <div className="fwGrid">
      <div className="fwBox">
        <div className="boxHd" style={{marginBottom:12}}><span className="boxTitle">Detalhes do encaminhamento</span></div>
        <label style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',color:'var(--muted)',display:'block',marginBottom:5}}>Tópico</label>
        <select className="fwSel" value={forwardTopic} onChange={e=>setForwardTopic(e.target.value)}>
          <option value="">Selecionar tópico…</option>
          {FORWARD_TOPICS.map(t=><option key={t} value={t}>{t}</option>)}
        </select>
        <label style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',color:'var(--muted)',display:'block',marginBottom:5,marginTop:8}}>Responsável</label>
        {operators.length>0 && <select className="fwSel" defaultValue="" onChange={e=>{ const op=operators.find(o=>o.nome===e.target.value); if(op){ setForwardName(op.nome); setForwardPhone(op.telefone_norm||''); setForwardRole(op.funcao||''); } }}>
          <option value="">Selecionar da lista…</option>
          {operators.map(o=><option key={o.id||o.nome} value={o.nome}>{o.nome}{o.funcao?' — '+o.funcao:''}</option>)}
        </select>}
        <input className="fwIn" value={forwardName} onChange={e=>setForwardName(e.target.value)} placeholder="Nome do responsável"/>
        <input className="fwIn" value={forwardPhone} onChange={e=>setForwardPhone(e.target.value)} placeholder="WhatsApp do responsável"/>
        <input className="fwIn" value={forwardRole} onChange={e=>setForwardRole(e.target.value)} placeholder="Função. Ex: agendamento / dúvidas"/>
        <label className="fwCheck"><input type="checkbox" checked={forwardUrgent} onChange={e=>setForwardUrgent(e.target.checked)}/> Marcar como urgente</label>
        <textarea className="fwTA" value={forwardObs} onChange={e=>setForwardObs(e.target.value)} placeholder="Observação para o responsável…"/>
      </div>
      <div className="fwBox">
        <div className="boxHd" style={{marginBottom:12}}><span className="boxTitle">Prévia da mensagem</span></div>
        {forwardTopic && <div className="topicPill">{forwardTopic}</div>}
        <div className="fwPreview">{forwardPreview}</div>
        <button className="fwSendBtn" onClick={notifyOperator} disabled={!selected}>Enviar para responsável →</button>
      </div>
    </div>
  </div>;
}
