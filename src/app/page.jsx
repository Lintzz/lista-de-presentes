"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";
import { useGlobal } from "../context/GlobalContext";
import { useAuth } from "../context/AuthContext";
import "../styles/Home.css";

const STEPS = [
  { n: "01", text: "Cole o link da loja e a gente puxa foto e preço" },
  { n: "02", text: "Marque prioridade, tamanho e observações" },
  { n: "03", text: "Seus amigos reservam e ninguém repete" },
];

export default function Home() {
  const { user } = useAuth();
  const { showModal } = useGlobal();
  const [code, setCode] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const router = useRouter();

  const handleSearch = (e) => {
    e.preventDefault();
    if (code.trim()) {
      router.push(`/${code.toUpperCase()}`);
    }
  };

  // Logado vai direto para as listas; deslogado faz login e depois segue.
  const handleCreate = async () => {
    if (user) {
      router.push("/minhas-listas");
      return;
    }
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      googleProvider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, googleProvider);
      router.push("/minhas-listas");
    } catch (error) {
      if (error.code !== "auth/popup-closed-by-user" && error.code !== "auth/cancelled-popup-request") {
        showModal("Erro", "Falha no login com Google.", "error");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <section className="home-container">
      <div className="home-hero">
        <span className="home-eyebrow mono">sem presente repetido</span>
        <h1 className="home-title">
          Diga o que você quer<br />ganhar — sem rodeios.
        </h1>
        <p className="home-subtitle">
          Monte sua lista, mande o código pra galera e cada um marca o que vai levar. Simples assim.
        </p>
      </div>

      {/* CARD DE BUSCA */}
      <div className="search-card">
        <div className="search-card-head">
          <h2 className="search-card-title">Recebeu um código?</h2>
          <p className="search-card-desc">Cole abaixo e veja a lista de quem te convidou.</p>
        </div>

        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            placeholder="HQR-832"
            className="input-field search-input"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button type="submit" className="btn-primary search-submit">
            Abrir lista
          </button>
        </form>

        <div className="divider" />

        <div className="search-card-foot">
          <p className="search-card-hint">Quer criar a sua? É de graça.</p>
          <button type="button" onClick={handleCreate} disabled={isLoggingIn} className="btn-ghost">
            {isLoggingIn ? "..." : "Criar minha lista"}
          </button>
        </div>
      </div>

      <div className="home-steps">
        {STEPS.map((step) => (
          <div key={step.n} className="home-step">
            <p className="home-step-num mono">{step.n}</p>
            <p className="home-step-text">{step.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
