"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import "../styles/Home.css";

export default function Home() {
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const router = useRouter();

  const handleSearch = (e) => {
    e.preventDefault();
    if (code.trim()) {
      router.push(`/${code.toUpperCase()}`);
    }
  };

  return (
    <div className="home-container">
      <h1 className="home-title">
        Crie e Compartilhe sua Lista de Presentes
      </h1>
      <p className="home-subtitle">
        Organize o que você quer ganhar e ajude seus amigos a não errarem no presente!
      </p>

      {/* CARD DE BUSCA */}
      <div className="search-card">
        <h2 className="search-card-title">
          Tem um código de lista?
        </h2>
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            placeholder="Ex: HQR-832"
            /* Juntamos a classe global 'input-field' com a específica 'search-input' */
            className="input-field search-input"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button type="submit" className="btn-primary">
            Buscar
          </button>
        </form>
      </div>

      {!user && (
        <div className="login-prompt">
          <p className="login-prompt-text">Quer criar a sua?</p>
          <p className="login-prompt-hint">
            Faça login no menu superior para começar.
          </p>
        </div>
      )}
    </div>
  );
}