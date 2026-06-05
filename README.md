# SAR Writer — Suspicious Activity Report Generator

> Part of the **[REDWING](https://github.com/tshriraj-del/redwing-fraud-os)** AI Fraud Detection Platform

![REDWING](https://img.shields.io/badge/REDWING-BSA%2FAML%20Suite-818cf8?style=for-the-badge)
![Stack](https://img.shields.io/badge/Stack-React%20%7C%20Vite%20%7C%20Tailwind-38bdf8?style=for-the-badge)

---

## What It Does

BSA officers spend 45–90 minutes writing a single SAR narrative. SAR Writer cuts that to under 60 seconds.

Input a fraud case — subject details, transaction data, case notes — and get back a **FinCEN Form 111-compliant Suspicious Activity Report** with four components:

1. **SAR Narrative** — complete, chronological, third-person narrative that meets FinCEN filing standards
2. **Form 111 Field Mapping** — structured field suggestions (activity type, instrument, amounts, dates) ready to transfer into the actual form
3. **Compliance Check** — scores the narrative against FinCEN's own guidance: does it cover WHO, WHAT, WHEN, WHERE, WHY, and HOW? Flags every gap before you file
4. **Examiner Notes** — pre-filing risk flags from a BSA examiner perspective

---

## Supported Typologies

| Typology | Description |
|---|---|
| Structuring / Smurfing | Deposits structured to avoid $10K CTR threshold |
| Layering / Integration | Multi-step fund movement to obscure origin |
| Account Takeover (ATO) | Unauthorised account access and fund transfer |
| Synthetic Identity Fraud | Fabricated PII used to open and exploit accounts |
| APP Scam | Victim authorises transfer to fraudster under deception |
| Pig Butchering | Long-term relationship fraud → crypto investment drain |
| Business Email Compromise | Fraudulent wire instruction via compromised email |
| Wire Fraud | Deceptive wire transfers across institutions |
| Card Testing / Carding | Automated card validity probing |
| Trade-Based Money Laundering | Value transfer through over/under-invoiced trade |
| Darknet / Crypto Mixing | Virtual currency obfuscation |
| Deepfake Social Engineering | Synthetic media used to authorise transactions |
| Mule Account Activity | Account used to receive and forward fraud proceeds |

---

## The Five Ws — FinCEN Compliance Standard

FinCEN's BSA/AML guidance requires every SAR narrative to explicitly address:

| Element | What It Covers |
|---|---|
| **WHO** | Subject identity, relationship to institution, beneficial ownership |
| **WHAT** | Specific transactions, amounts, instruments, account numbers |
| **WHEN** | Exact dates, duration, frequency of suspicious activity |
| **WHERE** | Accounts, branches, jurisdictions, correspondent banks |
| **WHY** | What makes this suspicious — deviation from expected activity, KYC/CDD red flags |
| **HOW** | Methodology — how the scheme operates, layering steps, evasion techniques |

SAR Writer scores the generated narrative against every element and flags gaps before you submit to FinCEN.

---

## Setup

```bash
git clone https://github.com/tshriraj-del/sar-writer
cd sar-writer
npm install

# Add your Anthropic API key
echo "VITE_ANTHROPIC_API_KEY=your_key_here" > .env

npm run dev
# Open http://localhost:5178
```

---

## Filing Types Supported

- **Initial SAR** — first filing on a subject or scheme
- **Continuing Activity SAR** — follow-up where suspicious activity is ongoing (filed every 90 days)
- **Corrected SAR** — amendment to a previously filed report

---

## Where It Fits in REDWING

SAR Writer is the **regulatory filing layer**. When a case is escalated through the ML pipeline and investigated in FraudSense, SAR Writer handles the mandatory BSA reporting.

| System | Role |
|---|---|
| **ML Detection Lab** | Scores transactions (AUC 0.979, 23 features) |
| **Rule Factory** | Self-improving rule engine — generates detection rules |
| **SyntheticID Lab** | Adversarial simulation + Rule Factory training feed |
| **FraudSense** | Investigation copilot — builds the case |
| **SAR Writer** | ← BSA/AML filing — turns the case into a FinCEN report |
| **Network Intelligence** | Fraud ring detection via graph analysis |
| **Fraud OS** | Unified command center connecting all systems |

→ **[View the full REDWING platform](https://github.com/tshriraj-del/redwing-fraud-os)**

---

## Stack

React 18 · Vite · Tailwind CSS · Anthropic API

---

*For BSA/AML compliance use by financial institutions only. Not legal advice. Always review AI-generated narratives before filing with FinCEN.*
