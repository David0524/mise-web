export default function Landing() {
  return (
    <main style={{ minHeight: "100vh", background: "#FAF5F4", fontFamily: "Georgia, serif",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <h1 style={{ fontFamily: "system-ui, sans-serif", fontSize: "2.4rem", margin: 0, color: "#12141C" }}>Mise</h1>
      <p style={{ maxWidth: 480, textAlign: "center", color: "#4A4453", fontSize: 18 }}>
        A weekly cooking collaborator — not a recipe generator. Plans the week with you, builds
        a shopping list that doesn&apos;t leave you with half a bunch of dill, and talks you
        through cooking it.
      </p>
      <div style={{ display: "flex", gap: "0.8rem", marginTop: "1rem" }}>
        <a href="/signup" style={{ background: "#A94C40", color: "#fff", padding: "0.8rem 1.6rem",
          borderRadius: 999, textDecoration: "none", fontFamily: "system-ui, sans-serif", fontWeight: 700 }}>
          Get started
        </a>
        <a href="/login" style={{ color: "#573C56", padding: "0.8rem 1.6rem",
          textDecoration: "none", fontFamily: "system-ui, sans-serif", fontWeight: 600 }}>
          Sign in
        </a>
      </div>
    </main>
  );
}
