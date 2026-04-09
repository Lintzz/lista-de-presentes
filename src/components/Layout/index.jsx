// src/components/Layout.jsx
import { useState, useEffect } from "react";
import { Outlet, Link, useNavigate } from "react-router-dom";
import { signInWithPopup, signOut, updateProfile } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "../../lib/firebase";
import { useGlobal } from "../../context/GlobalContext";
import logoImg from "../../assets/Logo.png";
import "./Layout.css"; // Importação do CSS

export default function Layout({ user }) {
  const navigate = useNavigate();
  const { showModal } = useGlobal();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [showNameModal, setShowNameModal] = useState(false);
  const [nameInput, setNameInput] = useState("");

  useEffect(() => {
    const checkUserProfile = async () => {
      if (user) {
        try {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);

          if (!docSnap.exists() || !docSnap.data().name) {
            setNameInput(user.displayName || "");
            setShowNameModal(true);
          }
        } catch (error) {
          console.error("Erro ao verificar perfil:", error);
        }
      }
    };
    checkUserProfile();
  }, [user]);

  const handleSaveName = async () => {
    if (!nameInput.trim()) {
      showModal("Atenção", "Por favor, digite como prefere ser chamado.", "error");
      return;
    }
    try {
      await setDoc(doc(db, "users", user.uid), { name: nameInput }, { merge: true });
      await updateProfile(user, { displayName: nameInput });
      setShowNameModal(false);
      showModal("Sucesso", "Nome salvo com sucesso!", "success");
    } catch (error) {
      console.error("Erro ao salvar nome:", error);
      showModal("Erro", "Não foi possível salvar seu nome.", "error");
    }
  };

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      googleProvider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      if (error.code !== "auth/popup-closed-by-user" && error.code !== "auth/cancelled-popup-request") {
        showModal("Erro", "Falha no login com Google.", "error");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  return (
    <div className="layout-wrapper">
      {/* Modal Global de Nome */}
      {showNameModal && (
        <div className="modal-overlay">
          <div className="modal-content modal-animate">
            <h3 className="modal-title">Boas-vindas!</h3>
            <p className="modal-desc">
              Como você quer que seu nome apareça para seus amigos e nas listas?
            </p>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="input-field"
              style={{ marginBottom: '1rem' }}
              placeholder="Seu nome completo"
              maxLength={30}
              autoFocus
            />
            <button onClick={handleSaveName} className="btn-primary" style={{ width: '100%' }}>
              Salvar e Continuar
            </button>
          </div>
        </div>
      )}

      <header className="header">
        <div className="header-container">
          <Link to="/" className="logo-link">
            <img src={logoImg} alt="GiftList Logo" className="logo-img" />
          </Link>

          <div className="header-right">
            {user ? (
              <>
                <Link to="/minhas-listas" className="nav-link">
                  Minhas Listas
                </Link>

                <Link to="/minhas-listas" className="nav-link-mobile">
                  <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </Link>

                <div className="user-menu">
                  <Link to="/perfil" className="profile-link">
                    <img src={user.photoURL} alt="Perfil" className="profile-img" />
                    <span className="profile-name">{user.displayName}</span>
                  </Link>

                  <button onClick={handleLogout} className="btn-logout" title="Sair">
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
                </div>
              </>
            ) : (
              <button onClick={handleLogin} disabled={isLoggingIn} className="btn-primary">
                {isLoggingIn ? "..." : "Entrar com Google"}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="main-content">
        <Outlet />
      </main>

      <footer className="footer">
        <p>Meu Presente &copy; {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}