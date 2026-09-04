import { useState } from "react";

export default function Upload() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [recovery, setRecovery] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();

    if (!file) {
      setError("Please choose a CSV file first.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setRecovery(null);

    try {
      // Upload CSV
      const form = new FormData();
      form.append("file", file);

      const uploadRes = await fetch("http://127.0.0.1:8000/api/upload", {
        method: "POST",
        body: form,
      });

      if (!uploadRes.ok) {
        throw new Error("CSV upload failed.");
      }

      const uploadData = await uploadRes.json();
      setResult(uploadData);

      // Get recovery analysis
      const recoveryRes = await fetch(
        "http://127.0.0.1:8000/api/recovery"
      );

      if (!recoveryRes.ok) {
        throw new Error("Recovery analysis failed.");
      }

      const recoveryData = await recoveryRes.json();
      setRecovery(recoveryData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Upload CSV</h2>

      <form onSubmit={onSubmit}>
        <input
          type="file"
          accept=".csv"
          onChange={(e) => setFile(e.target.files[0])}
        />

        <button type="submit" disabled={loading} style={{ marginLeft: 10 }}>
          {loading ? "Analyzing..." : "Upload & Analyze"}
        </button>
      </form>

      {error && (
        <p style={{ color: "red", marginTop: 12 }}>
          {error}
        </p>
      )}

      {result && (
        <div style={{ marginTop: 20 }}>
          <h3>Upload Complete ✅</h3>

          <p>
            <strong>Records:</strong> {result.records}
          </p>

          <p>
            <strong>Total Amount:</strong> ${result.total_amount}
          </p>
        </div>
      )}

      {recovery && (
        <div style={{ marginTop: 25 }}>
          <h2>Revenue Recovery Analysis</h2>

          <div>
            <p>
              <strong>Revenue at Risk:</strong>{" "}
              ${recovery.revenue_at_risk}
            </p>

            <p>
              <strong>Expected Recovery:</strong>{" "}
              ${recovery.expected_recovery}
            </p>

            <p>
              <strong>Opportunities:</strong>{" "}
              {recovery.total_opportunities}
            </p>
          </div>

          <h3>Recovery Opportunities</h3>

          {recovery.opportunities.map((opportunity) => (
            <div
              key={opportunity.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: 8,
                padding: 15,
                marginTop: 10,
              }}
            >
              <h3>{opportunity.customer}</h3>

              <p>
                <strong>Amount:</strong> ${opportunity.amount}
              </p>

              <p>
                <strong>Risk:</strong> {opportunity.risk_level.toUpperCase()}
              </p>

              <p>
                <strong>Reason:</strong> {opportunity.reason}
              </p>

              <p>
                <strong>Recommended Action:</strong>{" "}
                {opportunity.recommended_action}
              </p>

              <p>
                <strong>Expected Recovery:</strong>{" "}
                ${opportunity.expected_recovery}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
