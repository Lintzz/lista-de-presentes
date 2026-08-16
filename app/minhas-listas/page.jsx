"use client";

// src/pages/MyLists/index.jsx
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, addDoc, query, where, onSnapshot, serverTimestamp, deleteDoc, doc, updateDoc } from "firebase/firestore";
import Link from "next/link";
import { useGlobal } from "../../context/GlobalContext";
import { useAuth } from "../../context/AuthContext";
import "./MyLists.css";

const THEME_COLORS = {
  blue: { label: "Azul", varBg: "var(--list-blue-bg)", badgeBg: "var(--list-blue-badge-bg)", badgeText: "var(--list-blue-badge-text)" },
  red: { label: "Vermelho", varBg: "var(--list-red-bg)", badgeBg: "var(--list-red-badge-bg)", badgeText: "var(--list-red-badge-text)" },
  green: { label: "Verde", varBg: "var(--list-green-bg)", badgeBg: "var(--list-green-badge-bg)", badgeText: "var(--list-green-badge-text)" },
  purple: { label: "Roxo", varBg: "var(--list-purple-bg)", badgeBg: "var(--list-purple-badge-bg)", badgeText: "var(--list-purple-badge-text)" },
  orange: { label: "Laranja", varBg: "var(--list-orange-bg)", badgeBg: "var(--list-orange-badge-bg)", badgeText: "var(--list-orange-badge-text)" },
  pink: { label: "Rosa", varBg: "var(--list-pink-bg)", badgeBg: "var(--list-pink-badge-bg)", badgeText: "var(--list-pink-badge-text)" },
};

export default function MyLists() {
  const { user } = useAuth();
  const { showModal } = useGlobal();
  const [lists, setLists] = useState([]);
  const [newListName, setNewListName] = useState("");
  const [newListColor, setNewListColor] = useState("blue");
  const [creating, setCreating] = useState(false);
  const [editModal, setEditModal] = useState({ open: false, id: null, name: "" });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const generateCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const nums = "0123456789";
    let code = "";
    for (let i = 0; i < 3; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    code += "-";
    for (let i = 0; i < 3; i++) code += nums.charAt(Math.floor(Math.random() * nums.length));
    return code;
  };

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "lists"), where("ownerId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLists(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user]);

  const handleCreateList = async (e) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    setCreating(true);
    try {
      const code = generateCode();
      await addDoc(collection(db, "lists"), {
        name: newListName,
        color: newListColor,
        ownerId: user.uid,
        ownerName: user.displayName,
        code: code,
        createdAt: serverTimestamp(),
        items: [],
      });
      setNewListName("");
      setNewListColor("blue");
      showModal("Sucesso", "Lista criada!", "success");
    } catch (error) {
      console.error(error);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteList = (listId, listName) => {
    showModal("Excluir Lista", `Tem certeza que deseja apagar a lista "${listName}"?`, "error", async () => {
      try {
        await deleteDoc(doc(db, "lists", listId));
        showModal("Lista Apagada", "Removida com sucesso.", "success");
      } catch (error) {
        console.error(error);
      }
    });
  };

  const openEditModal = (id, currentName) => setEditModal({ open: true, id, name: currentName });
  
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editModal.name.trim()) return;
    setIsSavingEdit(true);
    try {
      await updateDoc(doc(db, "lists", editModal.id), { name: editModal.name });
      setEditModal({ open: false, id: null, name: "" });
      showModal("Atualizado", "Nome alterado!", "success");
    } catch (error) {
      console.error(error);
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className="mylists-container">
      <h2 className="mylists-title">Minhas Listas</h2>

      <div className="create-list-card">
        <form onSubmit={handleCreateList} className="create-list-form">
          <div className="form-group-name">
            <label className="form-label">Nome da Nova Lista</label>
            <input
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              className="input-field"
              placeholder="Ex: Aniversário de 30 anos"
            />
          </div>

          <div className="form-group-color">
            <label className="form-label" style={{ fontSize: '0.75rem' }}>Cor</label>
            <div className="color-options">
              {Object.entries(THEME_COLORS).map(([key, value]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setNewListColor(key)}
                  className={`color-btn ${newListColor === key ? "active" : ""}`}
                  style={{ backgroundColor: value.varBg }}
                  title={value.label}
                />
              ))}
            </div>
          </div>

          <button disabled={creating} type="submit" className="btn-primary btn-create">
            {creating ? "Criando..." : "Criar"}
          </button>
        </form>
      </div>

      <div className="lists-grid">
        {lists.map((list) => {
          const colorKey = list.color || "blue";
          const theme = THEME_COLORS[colorKey] || THEME_COLORS.blue;

          return (
            <div key={list.id} className="list-card" style={{ borderLeftColor: theme.varBg }}>
              <Link href={`/${list.code}`} className="list-link">
                <div className="list-header">
                  <h3 className="list-name">{list.name}</h3>
                  <span
                    className="list-code-badge"
                    style={{ backgroundColor: theme.badgeBg, color: theme.badgeText }}
                  >
                    {list.code}
                  </span>
                </div>
                <p className="list-items-count">{list.items?.length || 0} itens na lista</p>
              </Link>

              <div className="list-actions">
                <button onClick={(e) => { e.preventDefault(); openEditModal(list.id, list.name); }} className="action-btn edit">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button onClick={(e) => { e.preventDefault(); handleDeleteList(list.id, list.name); }} className="action-btn delete">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {editModal.open && (
        <div className="modal-overlay">
          <div className="modal-content modal-animate">
            <h3 className="modal-title" style={{ marginBottom: '1.5rem' }}>Editar Nome</h3>
            <form onSubmit={handleSaveEdit}>
              <div style={{ marginBottom: '1.5rem' }}>
                <input
                  type="text"
                  autoFocus
                  className="input-field"
                  style={{ textAlign: 'center', fontSize: '1.125rem' }}
                  value={editModal.name}
                  onChange={(e) => setEditModal({ ...editModal, name: e.target.value })}
                />
              </div>
              <div className="edit-modal-buttons">
                <button type="button" onClick={() => setEditModal({ open: false, id: null, name: "" })} className="btn-primary">
                  Cancelar
                </button>
                <button type="submit" disabled={isSavingEdit} className="btn-primary">
                  {isSavingEdit ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}