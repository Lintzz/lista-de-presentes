"use client";

// src/context/GlobalContext.jsx
import { createContext, useContext, useState } from "react";
import "./GlobalContext.css"; // Importação do CSS que acabamos de criar

const GlobalContext = createContext();

export function GlobalProvider({ children }) {
  const [modal, setModal] = useState({
    open: false,
    title: "",
    message: "",
    type: "success",
    onConfirm: null,
  });

  const showModal = (title, message, type = "success", onConfirm = null) => {
    setModal({ open: true, title, message, type, onConfirm });
  };

  const closeModal = () => {
    setModal({ ...modal, open: false });
  };

  // Função para pegar as cores do ícone baseado no tipo do modal usando as variáveis globais
  const getModalIconStyle = (type) => {
    switch (type) {
      case "error":
        return { backgroundColor: "var(--color-error-bg)", color: "var(--color-error-text)" };
      case "info":
        return { backgroundColor: "var(--color-info-bg)", color: "var(--color-info-text)" };
      default:
        return { backgroundColor: "var(--color-success-bg)", color: "var(--color-success-text)" };
    }
  };

  return (
    <GlobalContext.Provider value={{ showModal }}>
      {children}
      
      {modal.open && (
        <div className="global-modal-overlay">
          {/* A classe modal-animate continua vindo do seu index.css global */}
          <div className="global-modal-box modal-animate">
            
            <div className="global-modal-icon" style={getModalIconStyle(modal.type)}>
              {modal.type === "success" && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              )}
              {modal.type === "error" && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              {modal.type === "info" && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>

            <h3 className="global-modal-title">
              {modal.title}
            </h3>
            <p className="global-modal-message">
              {modal.message}
            </p>

            <div className="global-modal-actions">
              {modal.onConfirm ? (
                <>
                  <button onClick={closeModal} className="btn-primary">
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      modal.onConfirm();
                      closeModal();
                    }}
                    className="btn-primary"
                  >
                    Confirmar
                  </button>
                </>
              ) : (
                <button onClick={closeModal} className="btn-modal-understand">
                  Entendi
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </GlobalContext.Provider>
  );
}

export const useGlobal = () => useContext(GlobalContext);