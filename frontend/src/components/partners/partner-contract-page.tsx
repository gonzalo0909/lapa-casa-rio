// lapa-casa-hostel/frontend/src/components/partners/partner-contract-page.tsx
//
// Página pública del contrato de asociación — Administrador de Propiedad.
// Muestra el modelo de contrato completo y un formulario de contacto inicial.

'use client';

import React, { useState } from 'react';
import { MapPin, FileText, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Mail } from 'lucide-react';

interface Props {
  locale: string;
}

const CLAUSES = [
  {
    id: 1,
    title: 'Das Partes',
    content: `Este Contrato de Parceria é celebrado entre:

**LAPA CASA LTDA**, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº 52.288.274/0001-21, com sede na cidade do Rio de Janeiro/RJ ("Plataforma"), doravante denominada simplesmente "Lapa Casa";

e

**ADMINISTRADOR(A) DA PROPRIEDADE**, pessoa física ou jurídica cujos dados serão informados no momento do cadastro, responsável legal pelo imóvel objeto deste contrato, doravante denominado(a) simplesmente "Administrador(a)".`,
  },
  {
    id: 2,
    title: 'Do Objeto',
    content: `A Lapa Casa disponibiliza plataforma digital de intermediação para hospedagem de curta e média duração, através da qual o(a) Administrador(a) poderá listar sua propriedade e receber reservas de hóspedes.

A Lapa Casa **não é agência de turismo**, operadora hoteleira, nem assume responsabilidade pela gestão operacional do imóvel. O papel da Plataforma é de **intermediadora tecnológica**.`,
  },
  {
    id: 3,
    title: 'Da Regularidade do Imóvel',
    content: `O(a) Administrador(a) declara, sob penas da lei, que:

• O imóvel está regularizado junto aos órgãos competentes (Prefeitura, Cartório, Receita Federal quando aplicável);
• Possui autorização do condomínio para fins de hospedagem, quando aplicável;
• Não há qualquer impedimento judicial ou administrativo que impeça a locação do imóvel;
• Está ciente das legislações municipais aplicáveis à hospedagem por temporada no Rio de Janeiro.

A Lapa Casa não se responsabiliza por irregularidades ocultadas ou não informadas pelo(a) Administrador(a).`,
  },
  {
    id: 4,
    title: 'Das Responsabilidades do Administrador(a)',
    content: `São responsabilidades exclusivas do(a) Administrador(a):

• Manutenção do imóvel em condições adequadas de habitabilidade, limpeza e segurança;
• Cumprimento das obrigações fiscais decorrentes da renda gerada pelas locações;
• Gestão operacional: check-in, check-out, limpeza, fornecimento de itens básicos;
• Resposta a hóspedes dentro do prazo estabelecido pela Plataforma;
• Atualização de calendário e disponibilidades com no mínimo 48 horas de antecedência;
• Comunicação imediata à Lapa Casa em caso de cancelamento ou impedimento de hospedagem.`,
  },
  {
    id: 5,
    title: 'Do Seguro Obrigatório',
    content: `O(a) Administrador(a) deverá manter, durante toda a vigência deste contrato:

**Seguro de Danos ao Imóvel**: cobertura mínima de **R$ 50.000,00** (cinquenta mil reais) para danos materiais causados por hóspedes;

**Seguro de Responsabilidade Civil**: cobertura mínima de **R$ 500.000,00** (quinhentos mil reais) para danos causados a terceiros no interior do imóvel.

A comprovação das apólices vigentes deverá ser encaminhada à Lapa Casa anualmente ou sempre que solicitado. O descumprimento desta cláusula enseja suspensão imediata das listagens.`,
  },
  {
    id: 6,
    title: 'Da Comissão e Modelo Financeiro',
    content: `A Lapa Casa recebe uma comissão de **5% (cinco por cento)** sobre o valor bruto de cada reserva confirmada e efetivamente realizada.

A comissão será deduzida automaticamente no momento do repasse ao Administrador(a), que ocorrerá em até **5 (cinco) dias úteis** após o check-out do hóspede, mediante transferência bancária para a conta indicada no cadastro.

Não há taxa de adesão, mensalidade ou custo fixo para listar imóveis na Plataforma.`,
  },
  {
    id: 7,
    title: 'Das Obrigações Fiscais',
    content: `Cada parte é responsável pelo recolhimento de seus próprios tributos:

**Administrador(a)**: rendimentos de locação devem ser declarados conforme legislação do Imposto de Renda vigente; emissão de NF quando aplicável (pessoa jurídica);

**Lapa Casa**: emite documentação fiscal referente à sua comissão de intermediação.

A Lapa Casa poderá solicitar documentação comprobatória para fins de conformidade regulatória.`,
  },
  {
    id: 8,
    title: 'Da Proteção de Dados (LGPD)',
    content: `As partes comprometem-se a tratar os dados pessoais de hóspedes e entre si em conformidade com a **Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD)**:

• Os dados coletados serão utilizados exclusivamente para fins de operação da hospedagem;
• É vedado o compartilhamento de dados com terceiros não autorizados;
• O(a) Administrador(a) compromete-se a implementar medidas básicas de segurança no tratamento de dados de hóspedes;
• A Lapa Casa atua como **Operadora** de dados dos hóspedes; o(a) Administrador(a) como **Co-Controlador(a)** no que tange à operação local do imóvel.`,
  },
  {
    id: 9,
    title: 'Da Política de Cancelamento',
    content: `A política de cancelamento padrão da Plataforma é:

• **Cancelamento com mais de 7 dias** antes do check-in: reembolso integral ao hóspede; sem penalidade ao Administrador(a);
• **Cancelamento com 3 a 7 dias**: reembolso de 50% ao hóspede; Administrador(a) retém 50%;
• **Cancelamento com menos de 3 dias**: sem reembolso ao hóspede; Administrador(a) retém valor integral;
• **Cancelamento pelo Administrador(a)** após confirmação: reembolso integral ao hóspede + penalidade operacional de **R$ 200,00** por reserva cancelada, descontada do próximo repasse.

Cancelamentos por força maior documentada serão avaliados caso a caso.`,
  },
  {
    id: 10,
    title: 'Das Penalidades Operacionais',
    content: `Sem prejuízo das demais cláusulas, as seguintes situações ensejam penalidades:

| Ocorrência | Penalidade |
|---|---|
| Cancelamento injustificado após confirmação | R$ 200,00 por reserva |
| Reclamação formal de hóspede não respondida em 48h | Advertência + suspensão temporária |
| 3ª reclamação formal no período de 12 meses | Rescisão contratual |
| Descumprimento das normas de seguro | Suspensão imediata das listagens |
| Listagem com informações falsas | Rescisão imediata + eventual responsabilização civil |`,
  },
  {
    id: 11,
    title: 'Da Vigência e Rescisão',
    content: `Este contrato tem vigência **por prazo indeterminado**, iniciando-se na data de ativação do cadastro do imóvel na Plataforma.

Qualquer das partes poderá rescindi-lo mediante notificação por escrito com antecedência mínima de **30 (trinta) dias**, sem ônus, desde que não haja reservas confirmadas pendentes no período.

A Lapa Casa reserva-se o direito de rescindir imediatamente em caso de violação de cláusulas essenciais (segurança, legalidade, LGPD).`,
  },
  {
    id: 12,
    title: 'Da Mediação e Foro',
    content: `As partes elegem o Foro da Comarca do **Rio de Janeiro/RJ** para dirimir quaisquer controvérsias decorrentes deste contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.

As partes concordam em tentar solução amigável por meio de **mediação extrajudicial** antes de qualquer ação judicial, conforme previsto na Lei de Mediação (Lei nº 13.140/2015).`,
  },
];

function ClauseBlock({ clause }: { clause: typeof CLAUSES[0] }) {
  const [open, setOpen] = useState(false);

  // Parse markdown-lite: bold and table
  const formatContent = (text: string) => {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('|')) {
        // skip table rows in the simple renderer — handled separately
        return null;
      }
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <p key={i} style={{ margin: '0.35rem 0', lineHeight: 1.7 }}>
          {parts.map((part, j) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={j}>{part.slice(2, -2)}</strong>;
            }
            return <span key={j}>{part}</span>;
          })}
        </p>
      );
    });
  };

  // Extract table from content if present
  const tableMatch = clause.content.match(/(\|[^\n]+\n)+/);
  const tableContent = tableMatch ? tableMatch[0] : null;
  const textContent = clause.content.replace(/(\|[^\n]+\n)+/, '').trim();

  return (
    <div style={{
      border: '1px solid #e5e7eb',
      borderRadius: 10,
      overflow: 'hidden',
      marginBottom: '.75rem',
    }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '.85rem 1.2rem',
          background: open ? '#f0f6ff' : '#fafafa',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          gap: '1rem',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
          <span style={{
            fontSize: '.72rem', fontWeight: 700, color: '#2c5f8a',
            background: '#dbeafe', borderRadius: 999, padding: '.15rem .55rem',
            minWidth: 28, textAlign: 'center',
          }}>
            {clause.id}
          </span>
          <span style={{ fontWeight: 600, fontSize: '.92rem', color: '#1a2332' }}>
            {clause.title}
          </span>
        </span>
        <span style={{ color: '#6b7280', flexShrink: 0 }}>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {open && (
        <div style={{ padding: '1rem 1.2rem 1.2rem', fontSize: '.88rem', color: '#374151', lineHeight: 1.7 }}>
          {formatContent(textContent)}
          {tableContent && (
            <div style={{ overflowX: 'auto', marginTop: '.75rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.84rem' }}>
                <tbody>
                  {tableContent.trim().split('\n').filter(r => !r.match(/^[\|\s\-]+$/)).map((row, ri) => {
                    const cells = row.split('|').filter(c => c.trim() !== '');
                    return (
                      <tr key={ri} style={{ background: ri === 0 ? '#f1f5f9' : ri % 2 === 0 ? '#f9fafb' : '#fff' }}>
                        {cells.map((cell, ci) => {
                          const Tag = ri === 0 ? 'th' : 'td';
                          return (
                            <Tag key={ci} style={{
                              padding: '.5rem .75rem',
                              border: '1px solid #e5e7eb',
                              textAlign: 'left',
                              fontWeight: ri === 0 ? 700 : 400,
                            }}>
                              {cell.trim()}
                            </Tag>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ContactForm() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', property: '', message: '' });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      // TODO: connect to real endpoint once backend route exists
      await new Promise(r => setTimeout(r, 1000));
      setSent(true);
    } catch {
      setError('Erro ao enviar. Tente novamente ou entre em contato por e-mail.');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem',
        padding: '2rem', textAlign: 'center',
      }}>
        <CheckCircle size={48} color="#059669" />
        <p style={{ fontWeight: 600, color: '#065f46', fontSize: '1rem' }}>Mensagem enviada!</p>
        <p style={{ color: '#6b7280', fontSize: '.88rem' }}>
          Entraremos em contato em até 48 horas úteis.
        </p>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '.6rem .85rem',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    fontSize: '.88rem',
    boxSizing: 'border-box',
    outline: 'none',
    fontFamily: 'inherit',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '.8rem',
    fontWeight: 600,
    color: '#374151',
    marginBottom: '.35rem',
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {error && (
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', padding: '.75rem 1rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, color: '#991b1b', fontSize: '.85rem' }}>
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div>
          <label style={labelStyle}>Nome completo *</label>
          <input required style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="João Silva" />
        </div>
        <div>
          <label style={labelStyle}>E-mail *</label>
          <input required type="email" style={inputStyle} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="joao@email.com" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div>
          <label style={labelStyle}>WhatsApp / Telefone</label>
          <input style={inputStyle} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+55 21 99999-9999" />
        </div>
        <div>
          <label style={labelStyle}>Endereço da propriedade *</label>
          <input required style={inputStyle} value={form.property} onChange={e => setForm(f => ({ ...f, property: e.target.value }))} placeholder="Rua X, Santa Teresa, RJ" />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Mensagem (opcional)</label>
        <textarea
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' }}
          value={form.message}
          onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
          placeholder="Conte um pouco sobre seu imóvel, disponibilidade, dúvidas..."
        />
      </div>

      <button
        type="submit"
        disabled={sending}
        style={{
          padding: '.75rem 1.5rem',
          background: '#2c5f8a',
          color: '#fff',
          border: 'none',
          borderRadius: 9,
          fontSize: '.9rem',
          fontWeight: 700,
          cursor: sending ? 'not-allowed' : 'pointer',
          opacity: sending ? .7 : 1,
          alignSelf: 'flex-start',
          display: 'flex',
          alignItems: 'center',
          gap: '.5rem',
          fontFamily: 'inherit',
        }}
      >
        <Mail size={16} />
        {sending ? 'Enviando…' : 'Quero ser parceiro(a)'}
      </button>
    </form>
  );
}

export function PartnerContractPage({ locale: _locale }: Props) {
  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '2.5rem 1.25rem 4rem', fontFamily: 'Georgia, serif' }}>
      {/* Header */}
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '.5rem',
          fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em',
          color: '#2c5f8a', marginBottom: '.75rem',
        }}>
          <MapPin size={12} />
          Rio de Janeiro · Lapa Casa
        </div>

        <h1 style={{
          fontFamily: 'Georgia, serif', fontSize: 'clamp(1.6rem, 4vw, 2.5rem)',
          fontWeight: 400, lineHeight: 1.2, margin: '0 0 .75rem',
          color: '#1a2332',
        }}>
          Contrato de Parceria<br />
          <em style={{ fontStyle: 'italic', color: '#2c5f8a' }}>Administrador de Propriedade</em>
        </h1>

        <p style={{ fontSize: '.9rem', color: '#6b7280', maxWidth: 600, lineHeight: 1.6, margin: 0, fontFamily: 'system-ui, sans-serif' }}>
          Este é o modelo de contrato que rege a relação entre a Lapa Casa e os administradores que listam propriedades em nossa plataforma.
          Leia cada cláusula com atenção antes de prosseguir com o cadastro.
        </p>

        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '1.5rem',
          padding: '1rem 1.25rem', background: '#f0f9ff', border: '1px solid #bae6fd',
          borderRadius: 10, fontFamily: 'system-ui, sans-serif',
        }}>
          {[
            { label: 'Comissão', value: '5% por reserva' },
            { label: 'Seguro imóvel', value: 'R$ 50.000 mín.' },
            { label: 'Seguro civil', value: 'R$ 500.000 mín.' },
            { label: 'Repasse', value: '5 dias úteis pós check-out' },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: '#0369a1' }}>{label}</div>
              <div style={{ fontSize: '.92rem', fontWeight: 600, color: '#1a2332' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Cláusulas */}
      <div style={{ marginBottom: '3rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '1.25rem' }}>
          <FileText size={18} color="#2c5f8a" />
          <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#1a2332', fontFamily: 'system-ui, sans-serif' }}>
            Cláusulas do Contrato
          </h2>
        </div>

        {CLAUSES.map(clause => (
          <ClauseBlock key={clause.id} clause={clause} />
        ))}

        <p style={{
          marginTop: '1.5rem', padding: '1rem 1.25rem',
          background: '#fffbeb', border: '1px solid #fde68a',
          borderRadius: 10, fontSize: '.83rem', color: '#78350f',
          fontFamily: 'system-ui, sans-serif', lineHeight: 1.6,
        }}>
          <strong>Versão do documento:</strong> agosto de 2026 · CNPJ Lapa Casa: 52.288.274/0001-21 ·
          Foro: Comarca do Rio de Janeiro/RJ. Este modelo é meramente informativo;
          o contrato definitivo será assinado digitalmente no momento do cadastro.
        </p>
      </div>

      {/* Formulario de contacto */}
      <div style={{
        background: '#fff', border: '1px solid #e5e7eb',
        borderRadius: 14, padding: '2rem',
      }}>
        <h2 style={{
          margin: '0 0 .4rem', fontSize: '1.2rem', fontWeight: 700,
          color: '#1a2332', fontFamily: 'system-ui, sans-serif',
        }}>
          Quero listar minha propriedade
        </h2>
        <p style={{ margin: '0 0 1.5rem', fontSize: '.88rem', color: '#6b7280', fontFamily: 'system-ui, sans-serif' }}>
          Preencha o formulário abaixo e nossa equipe entrará em contato para iniciar o cadastro.
        </p>
        <ContactForm />
      </div>
    </div>
  );
}
