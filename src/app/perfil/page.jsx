"use client";

import { useState, useEffect } from "react";
import { db, auth } from "../../lib/firebase";
import { doc, getDoc, setDoc, collection, query, where, getDocs, writeBatch } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useGlobal } from "../../context/GlobalContext";
import { useAuth } from "../../context/AuthContext";
import { Avatar } from "../../components/ui/Avatar";
import "../../styles/Profile.css";

// Antes os gostos eram um textarea livre. Agora são chips: quando o doc só tem
// o texto antigo, derivamos as tags dele na leitura (sem script de migração).
const toTags = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) {
    return value.split(/[,\n;]+/).map((t) => t.trim()).filter(Boolean);
  }
  return [];
};

function TagEditor({ tags, onAdd, onRemove, editable, dotColor, title, emptyText }) {
  const [draft, setDraft] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const commit = () => {
    const value = draft.trim();
    if (value) onAdd(value);
    setDraft("");
    setIsAdding(false);
  };

  return (
    <div className="tag-group">
      <div className="tag-group-head">
        <span className="tag-dot" style={{ backgroundColor: dotColor }} />
        <span className="tag-group-title">{title}</span>
      </div>

      <div className="tag-list">
        {tags.map((tag, i) => (
          <span key={`${tag}-${i}`} className="chip">
            {tag}
            {editable && (
              <button type="button" className="chip-remove" onClick={() => onRemove(i)} title="Remover">×</button>
            )}
          </span>
        ))}

        {!editable && tags.length === 0 && <span className="tag-empty">{emptyText}</span>}

        {editable && (
          isAdding ? (
            <input
              autoFocus
              className="input-field chip-input"
              value={draft}
              placeholder="Digite e tecle Enter"
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); commit(); }
                if (e.key === "Escape") { setDraft(""); setIsAdding(false); }
              }}
            />
          ) : (
            <button type="button" className="chip-add" onClick={() => setIsAdding(true)}>+ adicionar</button>
          )
        )}
      </div>
    </div>
  );
}

export default function Profile() {
  const { user } = useAuth();
  const { showModal } = useGlobal();
  const searchParams = useSearchParams();
  const router = useRouter();

  const queryUid = searchParams ? searchParams.get("uid") : null;
  const fromListCode = searchParams ? searchParams.get("fromList") : null;
  const targetUid = queryUid || (user ? user.uid : null);
  const isMyProfile = user && targetUid === user.uid;

  const [profileData, setProfileData] = useState({
    displayName: "", photoURL: "", likeTags: [], dislikeTags: [], shoeSize: "", shirtSize: "", pantsSize: "",
  });
  const [stats, setStats] = useState({ lists: 0, items: 0, reserved: 0 });
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!targetUid) { router.push("/"); return; }

    const fetchProfile = async () => {
      try {
        const docSnap = await getDoc(doc(db, "users", targetUid));

        let data = {};
        if (docSnap.exists()) {
          data = { ...docSnap.data() };
          if (data.name && !data.displayName) data.displayName = data.name;
        }
        if (isMyProfile) {
          if (!data.displayName) data.displayName = user.displayName;
          if (!data.photoURL) data.photoURL = user.photoURL;
        }
        data.likeTags = toTags(data.likeTags ?? data.likes);
        data.dislikeTags = toTags(data.dislikeTags ?? data.dislikes);

        setProfileData((prev) => ({ ...prev, ...data }));

        // Estatísticas derivadas das listas desta pessoa
        const listsSnap = await getDocs(query(collection(db, "lists"), where("ownerId", "==", targetUid)));
        let items = 0;
        let reserved = 0;
        listsSnap.forEach((snap) => {
          const active = (snap.data().items || []).filter((i) => !i.isArchived);
          items += active.length;
          reserved += active.filter((i) => i.giftedBy).length;
        });
        setStats({ lists: listsSnap.size, items, reserved });
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [targetUid, router, isMyProfile, user]);

  const addTag = (field, value) =>
    setProfileData((prev) => (prev[field].includes(value) ? prev : { ...prev, [field]: [...prev[field], value] }));
  const removeTag = (field, index) =>
    setProfileData((prev) => ({ ...prev, [field]: prev[field].filter((_, i) => i !== index) }));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!isMyProfile) return;
    setIsSaving(true);
    try {
      const newName = profileData.displayName || user.displayName;
      await setDoc(doc(db, "users", user.uid), {
        ...profileData,
        name: newName,
        displayName: newName,
        // Mantemos likes/dislikes em texto para não quebrar leituras antigas
        likes: profileData.likeTags.join(", "),
        dislikes: profileData.dislikeTags.join(", "),
      });

      if (auth.currentUser && newName !== user.displayName) {
        await updateProfile(auth.currentUser, { displayName: newName, photoURL: profileData.photoURL || user.photoURL });
      }

      const batch = writeBatch(db);
      const querySnapshot = await getDocs(query(collection(db, "lists"), where("ownerId", "==", user.uid)));
      querySnapshot.forEach((docSnap) => {
        if (docSnap.data().ownerName !== newName) {
          batch.update(doc(db, "lists", docSnap.id), { ownerName: newName });
        }
      });
      await batch.commit();

      showModal("Perfil Atualizado!", "Dados salvos com sucesso.", "success", () => window.location.reload());
    } catch (error) {
      console.error(error);
      showModal("Erro", "Não foi possível salvar.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="profile-message">Carregando perfil...</div>;

  const displayName = profileData.displayName || "Usuário sem nome";

  return (
    <div className="profile-page">
      {fromListCode && (
        <Link href={`/${fromListCode}`} className="back-link">
          <ArrowLeft size={16} />
          Voltar para a lista
        </Link>
      )}

      <form onSubmit={handleSave} className="profile-grid">
        <aside className="profile-aside">
          <Avatar src={profileData.photoURL} name={displayName} size={84} fontSize={30} />

          <div>
            <h1 className="profile-display-name">{displayName}</h1>
            {isMyProfile && user?.email && <p className="profile-email mono">{user.email}</p>}
            {!isMyProfile && <p className="profile-email">Perfil de presentes</p>}
          </div>

          <div className="divider profile-divider" />

          <div className="profile-stats">
            <div>
              <p className="stat-value">{stats.lists}</p>
              <p className="stat-label">listas</p>
            </div>
            <div>
              <p className="stat-value">{stats.items}</p>
              <p className="stat-label">presentes</p>
            </div>
            {/* No próprio perfil não mostramos reservados: estragaria a surpresa. */}
            {!isMyProfile && (
              <div>
                <p className="stat-value">{stats.reserved}</p>
                <p className="stat-label">reservados</p>
              </div>
            )}
          </div>

          {isMyProfile && (
            <button type="submit" disabled={isSaving} className="btn-primary profile-save">
              {isSaving ? "Salvando..." : "Salvar alterações"}
            </button>
          )}
        </aside>

        <div className="profile-content">
          <section className="surface-card">
            <div className="card-head">
              <h2 className="card-title">Como quero ser chamado(a)</h2>
              <p className="card-desc">É esse nome que aparece no topo das suas listas.</p>
            </div>

            <input
              type="text"
              disabled={!isMyProfile}
              value={profileData.displayName || ""}
              onChange={(e) => setProfileData({ ...profileData, displayName: e.target.value })}
              className="input-field name-input"
              placeholder="Seu nome"
            />

            {isMyProfile && (
              <label className="field">
                <span className="field-label">URL da foto (opcional)</span>
                <input
                  type="text"
                  value={profileData.photoURL || ""}
                  onChange={(e) => setProfileData({ ...profileData, photoURL: e.target.value })}
                  className="input-field"
                  placeholder="Cole um link de imagem aqui..."
                />
              </label>
            )}
          </section>

          <section className="surface-card">
            <div className="card-head">
              <h2 className="card-title">Meus tamanhos</h2>
              <p className="card-desc">Evita presente que não serve.</p>
            </div>

            <div className="sizes-grid">
              <label className="field">
                <span className="field-label">Camiseta</span>
                <input disabled={!isMyProfile} value={profileData.shirtSize || ""} onChange={(e) => setProfileData({ ...profileData, shirtSize: e.target.value })} className="input-field size-input mono" placeholder="M" />
              </label>
              <label className="field">
                <span className="field-label">Calça</span>
                <input disabled={!isMyProfile} value={profileData.pantsSize || ""} onChange={(e) => setProfileData({ ...profileData, pantsSize: e.target.value })} className="input-field size-input mono" placeholder="40" />
              </label>
              <label className="field">
                <span className="field-label">Calçado</span>
                <input disabled={!isMyProfile} value={profileData.shoeSize || ""} onChange={(e) => setProfileData({ ...profileData, shoeSize: e.target.value })} className="input-field size-input mono" placeholder="41" />
              </label>
            </div>
          </section>

          <section className="surface-card gostos-card">
            <div className="card-head">
              <h2 className="card-title">Meus gostos</h2>
              <p className="card-desc">Dicas rápidas para quem não sabe o que dar.</p>
            </div>

            <TagEditor
              title="Pode mandar"
              dotColor="var(--prio-low)"
              tags={profileData.likeTags}
              editable={!!isMyProfile}
              emptyText="Nada informado ainda."
              onAdd={(v) => addTag("likeTags", v)}
              onRemove={(i) => removeTag("likeTags", i)}
            />

            <div className="divider" />

            <TagEditor
              title="Melhor evitar"
              dotColor="var(--color-error-text)"
              tags={profileData.dislikeTags}
              editable={!!isMyProfile}
              emptyText="Nada informado ainda."
              onAdd={(v) => addTag("dislikeTags", v)}
              onRemove={(i) => removeTag("dislikeTags", i)}
            />
          </section>
        </div>
      </form>
    </div>
  );
}
