"use client";

// src/app/minhas-listas/page.jsx
import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, addDoc, query, where, onSnapshot, serverTimestamp, deleteDoc, doc, updateDoc } from "firebase/firestore";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { useGlobal } from "../../context/GlobalContext";
import { useAuth } from "../../context/AuthContext";
import "../../styles/MyLists.css";

const THEME_COLORS = {
  blue: { label: "Azul", varBg: "var(--list-blue-bg)", badgeBg: "var(--list-blue-badge-bg)", badgeText: "var(--list-blue-badge-text)" },
  red: { label: "Vermelho", varBg: "var(--list-red-bg)", badgeBg: "var(--list-red-badge-bg)", badgeText: "var(--list-red-badge-text)" },
  green: { label: "Verde", varBg: "var(--list-green-bg)", badgeBg: "var(--list-green-badge-bg)", badgeText: "var(--list-green-badge-text)" },
  purple: { label: "Roxo", varBg: "var(--list-purple-bg)", badgeBg: "var(--list-purple-badge-bg)", badgeText: "var(--list-purple-badge-text)" },
  orange: { label: "Laranja", varBg: "var(--list-orange-bg)", badgeBg: "var(--list-orange-badge-bg)", badgeText: "var(--list-orange-badge-text)" },
  pink: { label: "Rosa", varBg: "var(--list-pink-bg)", badgeBg: "var(--list-pink-badge-bg)", badgeText: "var(--list-pink-badge-text)" },
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" });

// eventDate é gravado como "YYYY-MM-DD". Listas antigas não têm o campo:
// nesses casos caímos no createdAt (Timestamp do Firestore).
const formatListDate = (list) => {
  if (list.eventDate) {
    const [y, m, d] = list.eventDate.split("-").map(Number);
    if (y && m && d) return dateFormatter.format(new Date(y, m - 1, d));
  }
  if (list.createdAt?.toDate) return `criada em ${dateFormatter.format(list.createdAt.toDate())}`;
  return "sem data definida";
};

const EMPTY_FORM = { open: false, id: null, name: "", eventDate: "", color: "blue" };

export default function MyLists() {
  const { user } = useAuth();
  const { showModal } = useGlobal();
  const [lists, setLists] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

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

  const openCreate = () => setForm({ ...EMPTY_FORM, open: true });
  const openEdit = (list) =>
    setForm({ open: true, id: list.id, name: list.name || "", eventDate: list.eventDate || "", color: list.color || "blue" });
  const closeForm = () => setForm(EMPTY_FORM);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setIsSaving(true);
    try {
      if (form.id) {
        await updateDoc(doc(db, "lists", form.id), {
          name: form.name,
          eventDate: form.eventDate || null,
          color: form.color,
        });
        showModal("Atualizado", "Lista alterada!", "success");
      } else {
        await addDoc(collection(db, "lists"), {
          name: form.name,
          color: form.color,
          eventDate: form.eventDate || null,
          ownerId: user.uid,
          ownerName: user.displayName,
          code: generateCode(),
          createdAt: serverTimestamp(),
          items: [],
        });
        showModal("Sucesso", "Lista criada!", "success");
      }
      closeForm();
    } catch (error) {
      console.error(error);
      showModal("Erro", "Não foi possível salvar a lista.", "error");
    } finally {
      setIsSaving(false);
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

  const totalItems = lists.reduce((acc, l) => acc + (l.items?.filter((i) => !i.isArchived).length || 0), 0);

  return (
    <div className="mylists-container">
      <div className="mylists-head">
        <div>
          <h1 className="mylists-title">Minhas listas</h1>
          <p className="mylists-summary">
            {lists.length === 0
              ? "Nenhuma lista ainda — crie a primeira."
              : `${lists.length} ${lists.length === 1 ? "lista ativa" : "listas ativas"} — ${totalItems} ${totalItems === 1 ? "presente" : "presentes"} no total.`}
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary">Nova lista</button>
      </div>

      <div className="lists-grid">
        {lists.map((list) => {
          const theme = THEME_COLORS[list.color] || THEME_COLORS.blue;
          const active = list.items?.filter((i) => !i.isArchived) || [];
          const archived = (list.items?.length || 0) - active.length;

          return (
            <div key={list.id} className="list-card">
              <div className="list-card-strip" style={{ backgroundColor: theme.varBg }} />

              <div className="list-actions">
                <button onClick={() => openEdit(list)} className="action-btn edit" title="Editar lista">
                  <Pencil size={16} />
                </button>
                <button onClick={() => handleDeleteList(list.id, list.name)} className="action-btn delete" title="Excluir lista">
                  <Trash2 size={16} />
                </button>
              </div>

              <Link href={`/${list.code}`} className="list-link">
                <div className="list-header">
                  <div className="list-header-text">
                    <h3 className="list-name">{list.name}</h3>
                    <p className="list-date">{formatListDate(list)}</p>
                  </div>
                  <span
                    className="list-code-badge mono"
                    style={{ backgroundColor: theme.badgeBg, color: theme.badgeText }}
                  >
                    {list.code}
                  </span>
                </div>

                {/* Sem contagem de reservados: quem é dono da lista não pode
                    saber o que já foi marcado, senão acaba a surpresa. */}
                <div className="list-counts">
                  <span>{active.length} {active.length === 1 ? "presente" : "presentes"}</span>
                  {archived > 0 && <span>{archived} {archived === 1 ? "arquivado" : "arquivados"}</span>}
                </div>
              </Link>
            </div>
          );
        })}
      </div>

      {form.open && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal-content modal-animate" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">{form.id ? "Editar lista" : "Nova lista"}</h3>
            <p className="modal-desc">Dê um nome, escolha a data do evento e uma cor.</p>

            <form onSubmit={handleSubmit} className="list-form">
              <label className="field">
                <span className="field-label">Nome da lista</span>
                <input
                  type="text"
                  autoFocus
                  className="input-field"
                  placeholder="Ex: Aniversário de 30 anos"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>

              <label className="field">
                <span className="field-label">Data do evento (opcional)</span>
                <input
                  type="date"
                  className="input-field"
                  value={form.eventDate}
                  onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
                />
              </label>

              <div className="field">
                <span className="field-label">Cor</span>
                <div className="color-options">
                  {Object.entries(THEME_COLORS).map(([key, value]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setForm({ ...form, color: key })}
                      className={`color-btn ${form.color === key ? "active" : ""}`}
                      style={{ backgroundColor: value.varBg }}
                      title={value.label}
                    />
                  ))}
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" onClick={closeForm} className="btn-ghost">Cancelar</button>
                <button type="submit" disabled={isSaving} className="btn-primary">
                  {isSaving ? "Salvando..." : form.id ? "Salvar" : "Criar lista"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
