# AI Revenue Recovery

> **Detect revenue at risk. Explain why. Recover it.**

AI Revenue Recovery is an AI-agent-style revenue recovery prototype built for a hackathon.

It identifies revenue that is at risk, explains the reason behind the risk, recommends an appropriate recovery action, executes bounded recovery actions, and records the result in a recovery history.

---

##  What Problem Does It Solve?

Businesses lose revenue because payments can fail, invoices become overdue, payments remain pending, or customers leave valuable invoices unpaid.

The problem is not only identifying unpaid money.

A useful revenue recovery system should answer:

- Which revenue is at risk?
- Why is it at risk?
- Which customers should be prioritized?
- What action should be taken?
- How likely is the action to recover the money?
- What happened after the action was executed?

**AI Revenue Recovery** brings these steps together into one workflow.

---

1. AI RECOVERY AGENT
 follows this agent-style workflow:

Detect → Diagnose → Decide → Execute → Measure → Record

2. 🔄 How the Prototype Works

CSV Upload
   ↓
Risk Analysis
   ↓
Recovery Opportunities
   ↓
AI Recovery Decision
   ↓
Execute Recovery
   ↓
Updated Metrics
   ↓
Audit Trail

3. 🏗️ Architecture

React + Vite
      ↓
   REST API
      ↓
FastAPI Backend
      ↓
SQLite Database
