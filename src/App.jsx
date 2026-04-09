// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./lib/firebase";
import { GlobalProvider } from "./context/GlobalContext";
import Layout from "./components/Layout"; 
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import MyLists from "./pages/MyLists";
import ListView from "./pages/ListView";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading)
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--color-page-bg)', color: 'var(--color-text-body)' }}>
        Carregando...
      </div>
    );

  return (
    <GlobalProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout user={user} />}>
            <Route index element={<Home user={user} />} />
            <Route path="perfil" element={<Profile user={user} />} />
            <Route
              path="minhas-listas"
              element={user ? <MyLists user={user} /> : <Navigate to="/" />}
            />
            <Route path=":code" element={<ListView user={user} />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </GlobalProvider>
  );
}

export default App;