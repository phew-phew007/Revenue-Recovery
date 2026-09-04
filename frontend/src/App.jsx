import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE = "http://127.0.0.1:8000";

/* -----------------------------
   Formatting helpers
----------------------------- */

function formatCurrency(amount, currency = "INR") {
  const value = Number(amount || 0);

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `₹${value.toLocaleString("en-IN")}`;
  }
}

function formatPercent(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

/* -----------------------------
   Risk badge
----------------------------- */

function RiskBadge({ risk }) {
  const normalized = String(risk || "low").toLowerCase();

  return (
    <span className={`risk-badge ${normalized}`}>
      {normalized.toUpperCase()}
    </span>
  );
}

/* -----------------------------
   Progress bar
----------------------------- */

function ProgressBar({ value }) {
  const score = Math.min(100, Math.max(0, Number(value || 0)));

  return (
    <div className="progress-track">
      <div
        className="progress-fill"
        style={{ width: `${score}%` }}
      />
    </div>
  );
}

/* -----------------------------
   AI decision helper
----------------------------- */

function getRecoveryDecision(opportunity) {
  const status = String(
    opportunity.status || ""
  ).toLowerCase();

  const reason = String(
    opportunity.reason || ""
  ).toLowerCase();

  const action =
    opportunity.recommended_action ||
    "Review payment status";

  if (
    status === "failed" ||
    reason.includes("failed")
  ) {
    return {
      trigger: "Payment failure detected",
      decision: action,
      control: "Retry once, then escalate for review",
    };
  }

  if (
    status === "overdue" ||
    reason.includes("overdue")
  ) {
    return {
      trigger: "Overdue receivable detected",
      decision: action,
      control: "Priority follow-up with bounded escalation",
    };
  }

  if (
    status === "pending" ||
    reason.includes("pending")
  ) {
    return {
      trigger: "Payment still pending",
      decision: action,
      control: "Send reminder and monitor response",
    };
  }

  if (
    reason.includes("high-value") ||
    reason.includes("medium-value")
  ) {
    return {
      trigger: "Unpaid invoice detected",
      decision: action,
      control: "Prioritize payment recovery",
    };
  }

  return {
    trigger: "Revenue risk detected",
    decision: action,
    control: "Review and execute approved recovery action",
  };
}

/* -----------------------------
   Opportunity card
----------------------------- */

function OpportunityCard({
  opportunity,
  index,
  onRecover,
  busy,
}) {
  const risk = String(
    opportunity.risk_level ||
      opportunity.risk ||
      "low"
  ).toLowerCase();

  const riskScore = Number(
    opportunity.risk_score || 0
  );

  const probability = Number(
    opportunity.recovery_probability || 0
  );

  const confidence = Number(
    opportunity.confidence || 0
  );

  const expectedRecovery =
    opportunity.expected_recovery !== undefined
      ? Number(opportunity.expected_recovery)
      : Number(opportunity.amount || 0) *
        probability;

  const decision = getRecoveryDecision(
    opportunity
  );

  return (
    <div className={`opportunity-card ${risk}`}>
      {/* Card top */}
      <div className="card-top">
        <RiskBadge risk={risk} />

        <span className="card-number">
          #{index + 1}
        </span>
      </div>

      {/* Customer */}
      <h3 className="customer-name">
        {opportunity.customer ||
          "Unknown Customer"}
      </h3>

      {/* Money */}
      <div className="money-grid">
        <div className="money-box">
          <span>Revenue at risk</span>

          <strong>
            {formatCurrency(
              opportunity.amount,
              opportunity.currency || "INR"
            )}
          </strong>
        </div>

        <div className="money-box recovery">
          <span>Expected recovery</span>

          <strong>
            {formatCurrency(
              expectedRecovery,
              opportunity.currency || "INR"
            )}
          </strong>
        </div>
      </div>

      {/* Risk score */}
      <div className="risk-score-section">
        <div className="score-header">
          <span>Risk score</span>

          <strong>
            {riskScore}/100
          </strong>
        </div>

        <ProgressBar value={riskScore} />
      </div>

      {/* Why */}
      <div className="explanation-section">
        <h4>Why is this at risk?</h4>

        <p>
          {opportunity.reason ||
            "Payment status requires review"}
        </p>
      </div>

      {/* AI Recovery Decision */}
      <div className="ai-decision">
        <div className="ai-decision-title">
          <span className="ai-spark">✦</span>

          <h4>AI Recovery Decision</h4>
        </div>

        <div className="decision-flow">
          <div className="decision-row">
            <span>Detect</span>
            <strong>{decision.trigger}</strong>
          </div>

          <div className="decision-arrow">
            ↓
          </div>

          <div className="decision-row">
            <span>Decide</span>
            <strong>{decision.decision}</strong>
          </div>

          <div className="decision-arrow">
            ↓
          </div>

          <div className="decision-row">
            <span>Control</span>
            <strong>{decision.control}</strong>
          </div>
        </div>
      </div>

      {/* Recommended Action */}
      <div className="action-section">
        <h4>Recommended Action</h4>

        <p>
          {opportunity.recommended_action ||
            "Review payment status"}
        </p>
      </div>

      {/* Card stats */}
      <div className="card-stats">
        <div>
          <span>Recovery Probability</span>

          <strong>
            {formatPercent(probability)}
          </strong>
        </div>

        <div>
          <span>AI Confidence</span>

          <strong>
            {formatPercent(confidence)}
          </strong>
        </div>
      </div>

      {/* Recovery action */}
      <button
        className="recover-button"
        onClick={() =>
          onRecover(opportunity.id)
        }
        disabled={busy}
      >
        {busy
          ? "Processing..."
          : "Run Recovery Action"}
      </button>

      <div className="bounded-note">
        <span>✓</span>
        Bounded action • Result recorded in audit trail
      </div>
    </div>
  );
}

/* -----------------------------
   Main App
----------------------------- */

function App() {
  const [opportunities, setOpportunities] =
    useState([]);

  const [metrics, setMetrics] = useState({
    revenue_at_risk: 0,
    recovered_revenue: 0,
    recovery_rate: 0,
    expected_recovery: 0,
    opportunity_count: 0,
  });

  const [history, setHistory] =
    useState([]);

  const [filter, setFilter] =
    useState("all");

  const [loading, setLoading] =
    useState(true);

  const [uploading, setUploading] =
    useState(false);

  const [busyId, setBusyId] =
    useState(null);

  const [batchBusy, setBatchBusy] =
    useState(false);

  const [selectedFile, setSelectedFile] =
    useState(null);

  const [message, setMessage] =
    useState("");

  const [messageType, setMessageType] =
    useState("success");

  const fileInputRef =
    useRef(null);

  /* -----------------------------
     Message
  ----------------------------- */

  const showMessage = (
    text,
    type = "success"
  ) => {
    setMessage(text);
    setMessageType(type);

    window.setTimeout(() => {
      setMessage("");
    }, 4000);
  };

  /* -----------------------------
     Load dashboard
  ----------------------------- */

  const loadDashboard = async () => {
    try {
      setLoading(true);

      const response = await fetch(
        `${API_BASE}/api/recovery`
      );

      if (!response.ok) {
        throw new Error(
          "Unable to load recovery data"
        );
      }

      const data =
        await response.json();

      setOpportunities(
        data.opportunities || []
      );

      setMetrics({
        revenue_at_risk: Number(
          data.metrics?.revenue_at_risk || 0
        ),

        recovered_revenue: Number(
          data.metrics?.recovered_revenue || 0
        ),

        recovery_rate: Number(
          data.metrics?.recovery_rate || 0
        ),

        expected_recovery: Number(
          data.metrics?.expected_recovery || 0
        ),

        opportunity_count: Number(
          data.metrics?.opportunity_count ||
            data.opportunities?.length ||
            0
        ),
      });
    } catch (error) {
      console.error(error);

      showMessage(
        "Could not load recovery data. Make sure the backend is running.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  /* -----------------------------
     Load recovery history
  ----------------------------- */

  const loadHistory = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/api/recovery/history`
      );

      if (!response.ok) {
        return;
      }

      const data =
        await response.json();

      setHistory(
        data.history || []
      );
    } catch (error) {
      console.error(
        "History error:",
        error
      );
    }
  };

  /* -----------------------------
     Initial load
  ----------------------------- */

  useEffect(() => {
    loadDashboard();
    loadHistory();
  }, []);

  /* -----------------------------
     Filter
  ----------------------------- */

  const filteredOpportunities =
    useMemo(() => {
      if (filter === "all") {
        return opportunities;
      }

      return opportunities.filter(
        (item) => {
          const risk = String(
            item.risk_level ||
              item.risk ||
              "low"
          ).toLowerCase();

          return risk === filter;
        }
      );
    }, [opportunities, filter]);

  /* -----------------------------
     Counts
  ----------------------------- */

  const counts = useMemo(() => {
    return {
      all: opportunities.length,

      high: opportunities.filter(
        (item) =>
          String(
            item.risk_level ||
              item.risk ||
              ""
          ).toLowerCase() === "high"
      ).length,

      medium: opportunities.filter(
        (item) =>
          String(
            item.risk_level ||
              item.risk ||
              ""
          ).toLowerCase() === "medium"
      ).length,

      low: opportunities.filter(
        (item) =>
          String(
            item.risk_level ||
              item.risk ||
              ""
          ).toLowerCase() === "low"
      ).length,
    };
  }, [opportunities]);

  /* -----------------------------
     File selection
  ----------------------------- */

  const handleFileChange = (
    event
  ) => {
    const file =
      event.target.files?.[0];

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (
      !file.name
        .toLowerCase()
        .endsWith(".csv")
    ) {
      showMessage(
        "Please select a CSV file.",
        "error"
      );

      event.target.value = "";
      setSelectedFile(null);

      return;
    }

    setSelectedFile(file);
    setMessage("");
  };

  /* -----------------------------
     Upload CSV
  ----------------------------- */

  const uploadCSV = async () => {
    if (!selectedFile) {
      showMessage(
        "Please choose a CSV file first.",
        "error"
      );

      return;
    }

    try {
      setUploading(true);
      setMessage("");

      const formData =
        new FormData();

      formData.append(
        "file",
        selectedFile
      );

      const response =
        await fetch(
          `${API_BASE}/api/upload`,
          {
            method: "POST",
            body: formData,
          }
        );

      const data =
        await response
          .json()
          .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.detail ||
            data.message ||
            "CSV upload failed"
        );
      }

      showMessage(
        data.message ||
          "Revenue data analyzed successfully.",
        "success"
      );

      setSelectedFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value =
          "";
      }

      await loadDashboard();
      await loadHistory();
    } catch (error) {
      console.error(error);

      showMessage(
        error.message ||
          "Unable to analyze the CSV file.",
        "error"
      );
    } finally {
      setUploading(false);
    }
  };

  /* -----------------------------
     Individual recovery
  ----------------------------- */

  const executeRecovery =
    async (id) => {
      try {
        setBusyId(id);

        const response =
          await fetch(
            `${API_BASE}/api/recovery/${id}/execute`,
            {
              method: "POST",
            }
          );

        const data =
          await response
            .json()
            .catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            data.detail ||
              data.message ||
              "Recovery action failed"
          );
        }

        showMessage(
          "Recovery action executed and recorded successfully.",
          "success"
        );

        await loadDashboard();
        await loadHistory();
      } catch (error) {
        console.error(error);

        showMessage(
          error.message ||
            "Unable to execute recovery action.",
          "error"
        );
      } finally {
        setBusyId(null);
      }
    };

  /* -----------------------------
     Batch recovery
  ----------------------------- */

  const executeBatchRecovery =
    async () => {
      if (
        opportunities.length ===
        0
      ) {
        showMessage(
          "There are no active recovery opportunities.",
          "error"
        );

        return;
      }

      const confirmed =
        window.confirm(
          `Run recovery actions for all ${opportunities.length} active opportunities?`
        );

      if (!confirmed) {
        return;
      }

      try {
        setBatchBusy(true);

        const ids =
          opportunities.map(
            (opportunity) =>
              opportunity.id
          );

        const response =
          await fetch(
            `${API_BASE}/api/recovery/batch-execute`,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify(ids),
            }
          );

        const data =
          await response
            .json()
            .catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            data.detail ||
              data.message ||
              "Batch recovery failed"
          );
        }

        const successful =
          Array.isArray(
            data.results
          )
            ? data.results.length
            : data.processed || 0;

        showMessage(
          `${successful} recovery action${
            successful === 1
              ? ""
              : "s"
          } executed and recorded successfully.`,
          "success"
        );

        await loadDashboard();
        await loadHistory();
      } catch (error) {
        console.error(error);

        showMessage(
          error.message ||
            "Unable to execute recovery actions.",
          "error"
        );
      } finally {
        setBatchBusy(false);
      }
    };

  /* -----------------------------
     Render
  ----------------------------- */

  return (
    <div className="app">

      {/* HEADER */}
      <header className="app-header">
        <div className="header-inner">
          <div>
            <h1>
              AI Revenue Recovery
            </h1>

            <p>
              Detect revenue at risk.
              Explain why. Recover it.
            </p>
          </div>
        </div>
      </header>

      <main className="main-container">

        {/* MESSAGE */}
        {message && (
          <div
            className={`message ${
              messageType === "error"
                ? "message-error"
                : "message-success"
            }`}
          >
            <span>{message}</span>

            <button
              type="button"
              onClick={() =>
                setMessage("")
              }
              aria-label="Close message"
            >
              ×
            </button>
          </div>
        )}

        {/* --------------------------------
            UPLOAD SECTION
        -------------------------------- */}
        <section className="upload-panel">

          <div className="upload-copy">

            <span className="section-label">
              START WITH YOUR DATA
            </span>

            <h2>
              Upload revenue data.
            </h2>

            <p>
              Upload a CSV and AI Revenue
              Recovery will identify risky
              payments, explain why they are
              at risk, and prioritize the
              right recovery action.
            </p>

          </div>

          <div className="upload-controls">

            <label className="file-picker">

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={
                  handleFileChange
                }
              />

              <span className="upload-icon">
                ↑
              </span>

              <span className="file-name">
                {selectedFile
                  ? selectedFile.name
                  : "Choose CSV file"}
              </span>

            </label>

            <button
              className="analyze-button"
              onClick={uploadCSV}
              disabled={
                uploading ||
                !selectedFile
              }
            >
              {uploading
                ? "Analyzing..."
                : "Analyze Revenue"}
            </button>

            <span className="file-help">
              CSV files only
            </span>

          </div>
        </section>

        {/* --------------------------------
            AGENT WORKFLOW
        -------------------------------- */}
        <section className="workflow-panel">

          <div className="workflow-heading">

            <div>
              <span className="section-label">
                AI RECOVERY AGENT
              </span>

              <h2>
                From risk detection to recovery.
              </h2>

              <p>
                A bounded workflow that detects
                revenue risk, chooses an intervention,
                executes the approved action, and
                records the result.
              </p>
            </div>

            <div className="workflow-badge">
              <span>✦</span>
              AI-guided recovery
            </div>

          </div>

          <div className="workflow-steps">

            <div className="workflow-step">
              <div className="workflow-number">
                01
              </div>

              <div>
                <strong>
                  Detect
                </strong>

                <span>
                  Identify revenue at risk
                </span>
              </div>
            </div>

            <div className="workflow-line">
              →
            </div>

            <div className="workflow-step">
              <div className="workflow-number">
                02
              </div>

              <div>
                <strong>
                  Diagnose
                </strong>

                <span>
                  Explain the risk
                </span>
              </div>
            </div>

            <div className="workflow-line">
              →
            </div>

            <div className="workflow-step">
              <div className="workflow-number">
                03
              </div>

              <div>
                <strong>
                  Decide
                </strong>

                <span>
                  Choose the right intervention
                </span>
              </div>
            </div>

            <div className="workflow-line">
              →
            </div>

            <div className="workflow-step">
              <div className="workflow-number">
                04
              </div>

              <div>
                <strong>
                  Execute
                </strong>

                <span>
                  Run a bounded action
                </span>
              </div>
            </div>

            <div className="workflow-line">
              →
            </div>

            <div className="workflow-step">
              <div className="workflow-number">
                05
              </div>

              <div>
                <strong>
                  Record
                </strong>

                <span>
                  Preserve the audit trail
                </span>
              </div>
            </div>

          </div>
        </section>

        {/* --------------------------------
            REVENUE INTELLIGENCE
        -------------------------------- */}
        <section className="intelligence-panel">

          <div className="intelligence-header">

            <div>

              <span className="section-label">
                REVENUE INTELLIGENCE
              </span>

              <h2>
                Your recovery opportunity
              </h2>

              <p>
                AI-ranked revenue that can still
                be recovered.
              </p>

            </div>

            <div className="expected-recovery">

              <span>
                Expected Recovery
              </span>

              <strong>
                {formatCurrency(
                  metrics.expected_recovery
                )}
              </strong>

              <small>
                from{" "}
                {
                  metrics.opportunity_count
                }{" "}
                active opportunities
              </small>

            </div>

          </div>

          <div className="metrics-grid">

            <div className="metric-card">

              <span>
                Revenue at Risk
              </span>

              <strong>
                {formatCurrency(
                  metrics.revenue_at_risk
                )}
              </strong>

              <small>
                Total identified exposure
              </small>

            </div>

            <div className="metric-card">

              <span>
                Recovered Revenue
              </span>

              <strong>
                {formatCurrency(
                  metrics.recovered_revenue
                )}
              </strong>

              <small>
                Successfully recovered
              </small>

            </div>

            <div className="metric-card">

              <span>
                Recovery Rate
              </span>

              <strong>
                {formatPercent(
                  metrics.recovery_rate
                )}
              </strong>

              <small>
                Recovered vs total exposure
              </small>

            </div>

            <div className="metric-card">

              <span>
                Active Opportunities
              </span>

              <strong>
                {metrics.opportunity_count}
              </strong>

              <small>
                Accounts requiring recovery
              </small>

            </div>

          </div>
        </section>

        {/* --------------------------------
            RECOVERY QUEUE
        -------------------------------- */}
        <section className="queue-panel">

          <div className="queue-header">

            <div>

              <span className="section-label">
                RECOVERY QUEUE
              </span>

              <h2>
                Recovery Opportunities
              </h2>

              <p>
                Prioritized accounts where
                revenue can still be recovered.
              </p>

            </div>

            <div className="queue-actions">

              <div className="filter-tabs">

                <button
                  className={
                    filter === "all"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setFilter("all")
                  }
                >
                  All ({counts.all})
                </button>

                <button
                  className={
                    filter === "high"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setFilter("high")
                  }
                >
                  High ({counts.high})
                </button>

                <button
                  className={
                    filter === "medium"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setFilter("medium")
                  }
                >
                  Medium ({counts.medium})
                </button>

                <button
                  className={
                    filter === "low"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setFilter("low")
                  }
                >
                  Low ({counts.low})
                </button>

              </div>

              <button
                className="recover-all-button"
                onClick={
                  executeBatchRecovery
                }
                disabled={
                  batchBusy ||
                  opportunities.length ===
                    0
                }
              >
                {batchBusy
                  ? "Processing..."
                  : "Recover All"}
              </button>

            </div>
          </div>

          {loading ? (

            <div className="empty-state">

              <h3>
                Loading recovery opportunities...
              </h3>

              <p>
                AI Revenue Recovery is
                analyzing your data.
              </p>

            </div>

          ) : filteredOpportunities.length ===
            0 ? (

            <div className="empty-state">

              <h3>
                No recovery opportunities
              </h3>

              <p>
                Upload revenue data or select
                another risk filter.
              </p>

            </div>

          ) : (

            <div className="opportunities-grid">

              {filteredOpportunities.map(
                (
                  opportunity,
                  index
                ) => (

                  <OpportunityCard
                    key={
                      opportunity.id
                    }
                    opportunity={
                      opportunity
                    }
                    index={index}
                    onRecover={
                      executeRecovery
                    }
                    busy={
                      busyId ===
                        opportunity.id ||
                      batchBusy
                    }
                  />

                )
              )}

            </div>
          )}

        </section>

        {/* --------------------------------
            AUDIT TRAIL
        -------------------------------- */}
        {history.length > 0 && (

          <section className="history-panel">

            <div className="history-header">

              <div>

                <span className="section-label">
                  AUDIT TRAIL
                </span>

                <h2>
                  Recovery History
                </h2>

                <p>
                  Every executed recovery action
                  is recorded for traceability.
                </p>

              </div>

              <div className="audit-badge">
                ✓ Actions recorded
              </div>

            </div>

            <div className="history-table-wrapper">

              <table className="history-table">

                <thead>

                  <tr>
                    <th>
                      Customer
                    </th>

                    <th>
                      Amount
                    </th>

                    <th>
                      Action
                    </th>

                    <th>
                      Status
                    </th>
                  </tr>

                </thead>

                <tbody>

                  {history.map(
                    (item, index) => (

                      <tr
                        key={
                          item.id ||
                          index
                        }
                      >

                        <td>
                          {item.customer ||
                            item.recovery
                              ?.customer ||
                            "Unknown"}
                        </td>

                        <td>
                          {formatCurrency(
                            item.amount ||
                              item.recovery
                                ?.amount ||
                              0,

                            item.currency ||
                              item.recovery
                                ?.currency ||
                              "INR"
                          )}
                        </td>

                        <td>
                          {item.action ||
                            item.recommended_action ||
                            item.recovery
                              ?.recommended_action ||
                            "Recovery action"}
                        </td>

                        <td>
                          <span className="history-status">
                            ✓ Recovered
                          </span>
                        </td>

                      </tr>

                    )
                  )}

                </tbody>

              </table>

            </div>

          </section>
        )}

      </main>

      {/* FOOTER */}
      <footer className="app-footer">

        <p>
          AI Revenue Recovery
          <span>•</span>
          Detect revenue at risk.
          Explain why. Recover it.
        </p>

      </footer>

    </div>
  );
}

export default App;