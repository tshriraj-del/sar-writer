import { useState } from 'react'
import { FileText, ShieldAlert, CheckCircle, Copy, Check, RefreshCw, ChevronDown } from 'lucide-react'

// ─── Constants ───────────────────────────────────────────────────────────────

const TYPOLOGIES = [
  'Structuring / Smurfing',
  'Layering / Integration',
  'Account Takeover (ATO)',
  'Synthetic Identity Fraud',
  'APP Scam (Authorised Push Payment)',
  'Pig Butchering / Investment Scam',
  'Business Email Compromise (BEC)',
  'Wire Fraud',
  'Card Testing / Carding',
  'Trade-Based Money Laundering',
  'Darknet / Crypto Mixing',
  'Deepfake Social Engineering',
  'Mule Account Activity',
  'Other',
]

const ACTIVITY_TYPES = [
  'BSA/Structuring',
  'Fraud — ACH',
  'Fraud — Card',
  'Fraud — Check',
  'Fraud — Wire',
  'Identity Theft',
  'Money Laundering',
  'Mortgage Loan Fraud',
  'Securities Fraud',
  'Terrorist Financing',
  'Other',
]

const FILING_TYPES = ['Initial SAR', 'Continuing Activity SAR', 'Corrected SAR']

// ─── Prompts ─────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior BSA/AML compliance officer with 15+ years of experience filing Suspicious Activity Reports with FinCEN. You write SAR narratives that meet FinCEN Form 111 standards and pass regulatory examination without findings.

Your narratives are:
- Factual and chronological — no speculation, no editorialising
- Written in third person (e.g. "The subject" not "you" or "I")
- Structured to answer WHO, WHAT, WHEN, WHERE, WHY and HOW explicitly
- Compliant with FinCEN's guidance: SAR Activity Review, BSA/AML Examination Manual
- Appropriately technical: use correct typology terminology (structuring, layering, smurfing, beneficial ownership, KYC, CDD, EDD, etc.)
- Free of PII beyond what is necessary for law enforcement identification
- Clear about which transactions are suspicious and why they deviate from expected activity

CRITICAL: Respond ONLY with a valid JSON object. No markdown fences, no preamble, no trailing text.`

function buildPrompt(form) {
  return `Generate a complete SAR filing package for the following case.

FILING TYPE: ${form.filingType}
SUBJECT NAME: ${form.subjectName || 'Unknown'}
SUBJECT ACCOUNT(S): ${form.subjectAccounts || 'See narrative'}
SUBJECT OCCUPATION: ${form.subjectOccupation || 'Unknown'}
RELATIONSHIP TO INSTITUTION: ${form.relationship || 'Customer'}
SUSPICIOUS ACTIVITY TYPOLOGY: ${form.typology}
DATE RANGE OF SUSPICIOUS ACTIVITY: ${form.dateFrom} to ${form.dateTo}
TOTAL SUSPICIOUS AMOUNT: $${form.totalAmount || '0'}
PRIOR SAR FILED: ${form.priorSAR ? 'Yes — ' + form.priorSAR : 'No'}
ACTIONS TAKEN: ${form.actionsTaken || 'Account under review'}
CASE NOTES FROM ANALYST: ${form.caseNotes}
${form.transactions ? `\nRAW TRANSACTION DATA:\n${form.transactions}` : ''}

Return this exact JSON structure:

{
  "narrative": "The complete SAR narrative as a single string. 3-5 paragraphs. Chronological. Third person. Covers WHO (subject identity and relationship), WHAT (specific suspicious transactions and amounts), WHEN (exact dates), WHERE (accounts, branches, jurisdictions), WHY (what makes this suspicious — what deviates from expected activity, what the institution knows about the subject), HOW (methodology — how the scheme operates). End with actions taken by the institution. Use correct BSA/AML terminology throughout.",

  "form_fields": {
    "activity_type": "The most appropriate FinCEN activity type checkbox from: BSA/Structuring, Fraud, Identity Theft, Money Laundering, Terrorist Financing, Other",
    "instrument_type": "Cash, Wire Transfer, ACH, Check, Credit/Debit Card, Virtual Currency, or Other",
    "amount": "${form.totalAmount || 'TBD'}",
    "date_range_from": "${form.dateFrom}",
    "date_range_to": "${form.dateTo}",
    "filing_type": "${form.filingType}",
    "law_enforcement_contacted": "Yes or No",
    "subject_role": "Initiator, Recipient, Both, or Unknown"
  },

  "compliance_check": {
    "who":   { "present": true or false, "note": "one sentence on how WHO is addressed" },
    "what":  { "present": true or false, "note": "one sentence on how WHAT is addressed" },
    "when":  { "present": true or false, "note": "one sentence on how WHEN is addressed" },
    "where": { "present": true or false, "note": "one sentence on how WHERE is addressed" },
    "why":   { "present": true or false, "note": "one sentence on how WHY is addressed" },
    "how":   { "present": true or false, "note": "one sentence on how HOW is addressed" }
  },

  "examiner_notes": [
    "Any regulatory examination risk or gap the BSA officer should address before filing. Max 3 items. If narrative is strong, note that."
  ]
}`
}

// ─── Main App ─────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  filingType: 'Initial SAR',
  subjectName: '',
  subjectAccounts: '',
  subjectOccupation: '',
  relationship: 'Customer',
  typology: 'Structuring / Smurfing',
  dateFrom: '',
  dateTo: '',
  totalAmount: '',
  priorSAR: '',
  actionsTaken: '',
  caseNotes: '',
  transactions: '',
}

export default function App() {
  const [form, setForm] = useState(EMPTY_FORM)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)
  const [activeSection, setActiveSection] = useState('narrative') // narrative | fields | compliance

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const generate = async () => {
    if (!form.caseNotes.trim()) {
      setError('Add case notes describing the suspicious activity before generating.')
      return
    }
    if (!form.dateFrom || !form.dateTo) {
      setError('Date range is required.')
      return
    }

    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
    if (!apiKey) {
      setError('VITE_ANTHROPIC_API_KEY not set in .env')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 4000,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: buildPrompt(form) }],
        }),
      })

      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error?.message || `API error ${res.status}`)
      }

      const data = await res.json()
      const raw = data.content[0].text.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim()
      setResult(JSON.parse(raw))
      setActiveSection('narrative')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const copyNarrative = async () => {
    if (!result?.narrative) return
    await navigator.clipboard.writeText(result.narrative)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const allChecks = result
    ? Object.values(result.compliance_check).every(c => c.present)
    : false

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>

      {/* Header */}
      <header style={{
        borderBottom: '1px solid var(--border)',
        background: 'rgba(8,11,20,0.95)',
        backdropFilter: 'blur(16px)',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ maxWidth: 1320, margin: '0 auto', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36,
              background: 'rgba(240,180,41,0.1)',
              border: '1px solid rgba(240,180,41,0.3)',
              borderRadius: 9,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FileText size={17} color="#f0b429" />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em' }}>SAR Writer</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>FinCEN Form 111 · Suspicious Activity Report Generator</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              background: 'rgba(240,180,41,0.08)', border: '1px solid rgba(240,180,41,0.2)',
              borderRadius: 6, padding: '4px 10px', fontSize: 11, color: '#f0b429', fontWeight: 500,
            }}>
              REDWING · BSA/AML Suite
            </div>
            <div style={{
              background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.2)',
              borderRadius: 6, padding: '4px 10px', fontSize: 11, color: '#f85149', fontWeight: 500,
            }}>
              ⚠ Compliance use only
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main style={{ maxWidth: 1320, margin: '0 auto', padding: '28px 24px 64px', display: 'grid', gridTemplateColumns: '420px 1fr', gap: 24, alignItems: 'start' }}>

        {/* ─── LEFT: Input Form ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Filing metadata */}
          <FormCard title="Filing Information">
            <FormRow label="Filing Type">
              <StyledSelect value={form.filingType} onChange={v => set('filingType', v)} options={FILING_TYPES} />
            </FormRow>
            <FormRow label="Suspicious Activity Typology">
              <StyledSelect value={form.typology} onChange={v => set('typology', v)} options={TYPOLOGIES} />
            </FormRow>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <FormRow label="Date From">
                <input type="date" value={form.dateFrom} onChange={e => set('dateFrom', e.target.value)}
                  style={{ width: '100%', padding: '7px 10px' }} />
              </FormRow>
              <FormRow label="Date To">
                <input type="date" value={form.dateTo} onChange={e => set('dateTo', e.target.value)}
                  style={{ width: '100%', padding: '7px 10px' }} />
              </FormRow>
            </div>
            <FormRow label="Total Suspicious Amount ($)">
              <input type="number" placeholder="e.g. 47500" value={form.totalAmount} onChange={e => set('totalAmount', e.target.value)}
                style={{ width: '100%', padding: '7px 10px' }} />
            </FormRow>
          </FormCard>

          {/* Subject info */}
          <FormCard title="Subject Information">
            <FormRow label="Subject Name">
              <input placeholder="Full legal name or 'Unknown'" value={form.subjectName} onChange={e => set('subjectName', e.target.value)}
                style={{ width: '100%', padding: '7px 10px' }} />
            </FormRow>
            <FormRow label="Account Number(s)">
              <input placeholder="e.g. ****4821, ****9034" value={form.subjectAccounts} onChange={e => set('subjectAccounts', e.target.value)}
                style={{ width: '100%', padding: '7px 10px' }} />
            </FormRow>
            <FormRow label="Occupation">
              <input placeholder="e.g. Self-employed, Unknown" value={form.subjectOccupation} onChange={e => set('subjectOccupation', e.target.value)}
                style={{ width: '100%', padding: '7px 10px' }} />
            </FormRow>
            <FormRow label="Relationship to Institution">
              <input placeholder="e.g. Customer since 2021" value={form.relationship} onChange={e => set('relationship', e.target.value)}
                style={{ width: '100%', padding: '7px 10px' }} />
            </FormRow>
          </FormCard>

          {/* Case details */}
          <FormCard title="Case Details">
            <FormRow label="Case Notes *" hint="Describe the suspicious activity — what happened, what triggered the review, what's anomalous">
              <textarea
                placeholder="e.g. Customer made 9 cash deposits of $9,800 each over 12 days across 3 branches, totalling $88,200. Amounts consistently just below the $10,000 CTR threshold. No business account on file. Customer stated funds were from 'freelance work' but no 1099 on record. Prior activity showed < $500/month average."
                value={form.caseNotes}
                onChange={e => set('caseNotes', e.target.value)}
                style={{ width: '100%', padding: '9px 12px', minHeight: 120, resize: 'vertical', lineHeight: 1.6 }}
              />
            </FormRow>
            <FormRow label="Raw Transaction Data" hint="Optional — paste CSV, JSON, or plain text. Specific transactions will be referenced in the narrative.">
              <textarea
                placeholder="date,amount,type,account&#10;2024-01-03,$9800,cash deposit,****4821&#10;2024-01-05,$9800,cash deposit,****9034"
                value={form.transactions}
                onChange={e => set('transactions', e.target.value)}
                style={{ width: '100%', padding: '9px 12px', minHeight: 80, resize: 'vertical', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.55 }}
              />
            </FormRow>
            <FormRow label="Prior SAR Reference" hint="Leave blank if none">
              <input placeholder="e.g. SAR filed 2023-08-15, ref #2309-XXXX" value={form.priorSAR} onChange={e => set('priorSAR', e.target.value)}
                style={{ width: '100%', padding: '7px 10px' }} />
            </FormRow>
            <FormRow label="Actions Taken">
              <input placeholder="e.g. Account restricted pending review; law enforcement notified" value={form.actionsTaken} onChange={e => set('actionsTaken', e.target.value)}
                style={{ width: '100%', padding: '7px 10px' }} />
            </FormRow>
          </FormCard>

          {/* Error */}
          {error && (
            <div style={{ background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.25)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#f85149', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <ShieldAlert size={14} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{error}</span>
            </div>
          )}

          {/* Generate button */}
          <button
            onClick={generate}
            disabled={loading}
            style={{
              width: '100%', padding: '13px 20px',
              background: loading ? 'rgba(240,180,41,0.08)' : 'rgba(240,180,41,0.12)',
              border: '1px solid rgba(240,180,41,0.4)',
              borderRadius: 10, color: '#f0b429',
              fontSize: 14, fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all 0.15s ease',
              letterSpacing: '0.01em',
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'rgba(240,180,41,0.2)' }}
            onMouseLeave={e => { e.currentTarget.style.background = loading ? 'rgba(240,180,41,0.08)' : 'rgba(240,180,41,0.12)' }}
          >
            {loading ? (
              <>
                <div style={{ width: 14, height: 14, border: '2px solid rgba(240,180,41,0.3)', borderTopColor: '#f0b429', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                Generating SAR…
              </>
            ) : (
              <>
                <FileText size={15} />
                Generate SAR Narrative
              </>
            )}
          </button>
        </div>

        {/* ─── RIGHT: Output ─── */}
        <div>
          {!loading && !result && (
            <EmptyState />
          )}

          {loading && <SARSkeleton />}

          {!loading && result && (
            <div className="fade-up">
              {/* Compliance banner */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 16px', borderRadius: 10, marginBottom: 16,
                background: allChecks ? 'rgba(63,185,80,0.08)' : 'rgba(240,180,41,0.08)',
                border: `1px solid ${allChecks ? 'rgba(63,185,80,0.3)' : 'rgba(240,180,41,0.3)'}`,
              }}>
                <CheckCircle size={14} color={allChecks ? 'var(--green)' : 'var(--accent)'} />
                <span style={{ fontSize: 13, color: allChecks ? 'var(--green)' : 'var(--accent)', fontWeight: 600 }}>
                  {allChecks ? 'All five Ws present — narrative is FinCEN-compliant' : 'Some five-W elements need attention — see Compliance Check tab'}
                </span>
              </div>

              {/* Tab bar */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
                {[
                  { id: 'narrative',   label: 'SAR Narrative' },
                  { id: 'fields',      label: 'Form 111 Fields' },
                  { id: 'compliance',  label: 'Compliance Check' },
                  { id: 'examiner',    label: 'Examiner Notes' },
                ].map(tab => (
                  <button key={tab.id} onClick={() => setActiveSection(tab.id)} style={{
                    background: 'none', border: 'none',
                    borderBottom: `2px solid ${activeSection === tab.id ? 'var(--accent)' : 'transparent'}`,
                    color: activeSection === tab.id ? 'var(--text)' : 'var(--text-muted)',
                    padding: '9px 18px', fontSize: 13,
                    fontWeight: activeSection === tab.id ? 600 : 400,
                    cursor: 'pointer', marginBottom: -1,
                    transition: 'color 0.15s ease',
                  }}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Narrative tab */}
              {activeSection === 'narrative' && (
                <div>
                  <div style={{
                    background: 'var(--surface)', border: '1px solid var(--border-2)',
                    borderRadius: 12, padding: '24px 28px',
                    fontSize: 13.5, lineHeight: 1.85,
                    color: 'var(--text)', whiteSpace: 'pre-wrap',
                    fontFamily: 'Georgia, serif',
                  }}>
                    {result.narrative}
                  </div>
                  <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
                    <button onClick={copyNarrative} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                      background: copied ? 'rgba(63,185,80,0.1)' : 'rgba(56,139,253,0.1)',
                      border: `1px solid ${copied ? 'rgba(63,185,80,0.35)' : 'rgba(56,139,253,0.35)'}`,
                      color: copied ? 'var(--green)' : 'var(--blue)',
                      transition: 'all 0.2s ease',
                    }}>
                      {copied ? <Check size={13} /> : <Copy size={13} />}
                      {copied ? 'Copied to clipboard' : 'Copy Narrative'}
                    </button>
                    <button onClick={() => { setResult(null); setForm(EMPTY_FORM) }} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                      background: 'none', border: '1px solid var(--border-2)',
                      color: 'var(--text-muted)', transition: 'all 0.15s ease',
                    }}>
                      <RefreshCw size={13} />
                      New SAR
                    </button>
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-dim)', alignSelf: 'center' }}>
                      ~{result.narrative.split(' ').length} words
                    </span>
                  </div>
                </div>
              )}

              {/* Form 111 Fields tab */}
              {activeSection === 'fields' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                    Suggested values for FinCEN Form 111 structured fields. Review before filing.
                  </div>
                  {Object.entries(result.form_fields).map(([key, value]) => (
                    <div key={key} style={{
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: 10, padding: '12px 16px',
                      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16,
                    }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 160, paddingTop: 1 }}>
                        {key.replace(/_/g, ' ')}
                      </span>
                      <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, textAlign: 'right' }}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Compliance Check tab */}
              {activeSection === 'compliance' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                    FinCEN guidance requires all SAR narratives to address the five Ws. Each item below must be present before filing.
                  </div>
                  {Object.entries(result.compliance_check).map(([key, val]) => (
                    <div key={key} style={{
                      background: val.present ? 'rgba(63,185,80,0.05)' : 'rgba(248,81,73,0.05)',
                      border: `1px solid ${val.present ? 'rgba(63,185,80,0.2)' : 'rgba(248,81,73,0.2)'}`,
                      borderRadius: 10, padding: '14px 16px',
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                    }}>
                      <div style={{
                        width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                        background: val.present ? 'rgba(63,185,80,0.15)' : 'rgba(248,81,73,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: val.present ? 'var(--green)' : 'var(--red)' }}>
                          {key.toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: val.present ? 'var(--green)' : 'var(--red)', marginBottom: 3 }}>
                          {key === 'who' ? 'WHO — Subject identification' :
                           key === 'what' ? 'WHAT — Activity description' :
                           key === 'when' ? 'WHEN — Dates and timeline' :
                           key === 'where' ? 'WHERE — Accounts and jurisdiction' :
                           key === 'why' ? 'WHY — Basis for suspicion' :
                           'HOW — Methodology and scheme'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>{val.note}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Examiner Notes tab */}
              {activeSection === 'examiner' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                    Pre-filing risk notes from a BSA examiner perspective. Address these before submitting to FinCEN.
                  </div>
                  {result.examiner_notes.map((note, i) => (
                    <div key={i} style={{
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: 10, padding: '14px 16px',
                      display: 'flex', gap: 12, alignItems: 'flex-start',
                    }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                        background: 'rgba(240,180,41,0.1)', border: '1px solid rgba(240,180,41,0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, color: 'var(--accent)',
                      }}>{i + 1}</div>
                      <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.65 }}>{note}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function FormCard({ title, children }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 12, overflow: 'hidden',
    }}>
      <div style={{
        padding: '10px 16px', borderBottom: '1px solid var(--border)',
        fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.06em',
        background: 'var(--surface-2)',
      }}>
        {title}
      </div>
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {children}
      </div>
    </div>
  )
}

function FormRow({ label, hint, children }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5, fontWeight: 500 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4, lineHeight: 1.5 }}>{hint}</div>}
    </div>
  )
}

function StyledSelect({ value, onChange, options }) {
  return (
    <div style={{ position: 'relative' }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '7px 32px 7px 10px', appearance: 'none', cursor: 'pointer' }}
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: 480, gap: 18,
      border: '1px dashed var(--border-2)', borderRadius: 14, padding: 40,
    }}>
      <div style={{
        width: 68, height: 68, borderRadius: '50%',
        background: 'rgba(240,180,41,0.07)', border: '1px solid rgba(240,180,41,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <FileText size={28} color="#f0b429" strokeWidth={1.4} />
      </div>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>SAR narrative ready to generate</h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
          Fill in the case details on the left — subject information, date range, and case notes are the most important inputs. The more context you provide, the more precise the narrative.
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
        {['SAR Narrative', 'Form 111 Fields', 'Compliance Check', 'Examiner Notes'].map(l => (
          <span key={l} style={{
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 20, padding: '4px 12px', fontSize: 11, color: 'var(--text-muted)',
          }}>{l}</span>
        ))}
      </div>
    </div>
  )
}

function SARSkeleton() {
  const Bar = ({ w = '100%', h = 13 }) => <div className="skeleton" style={{ width: w, height: h, marginBottom: 8 }} />
  return (
    <div style={{ padding: '20px 0' }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        {['SAR Narrative', 'Form 111 Fields', 'Compliance Check', 'Examiner Notes'].map(t => (
          <div key={t} className="skeleton" style={{ height: 34, width: 130, borderRadius: 8 }} />
        ))}
      </div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px 28px' }}>
        <Bar w="60%" h={11} />
        <div style={{ height: 8 }} />
        <Bar /><Bar /><Bar w="80%" />
        <div style={{ height: 16 }} />
        <Bar /><Bar /><Bar w="90%" /><Bar w="70%" />
        <div style={{ height: 16 }} />
        <Bar /><Bar w="85%" /><Bar />
        <div style={{ height: 16 }} />
        <Bar w="40%" h={11} />
        <Bar w="95%" /><Bar w="60%" />
      </div>
    </div>
  )
}
