"use client";

import { useState, useEffect } from "react";
import { db, auth } from "../../lib/firebase";
import { doc, getDoc, setDoc, collection, query, where, getDocs, writeBatch } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useGlobal } from "../../context/GlobalContext";
import { useAuth } from "../../context/AuthContext";
import "./Profile.css";

export default function Profile() {
  const { user } = useAuth();
  const { showModal } = useGlobal();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Handling the case where searchParams might not be fully populated immediately
  const queryUid = searchParams ? searchParams.get("uid") : null;
  const fromListCode = searchParams ? searchParams.get("fromList") : null;
  const targetUid = queryUid || (user ? user.uid : null);
  const isMyProfile = user && targetUid === user.uid;

  const [profileData, setProfileData] = useState({
    displayName: "", photoURL: "", likes: "", dislikes: "", shoeSize: "", shirtSize: "", pantsSize: "",
  });
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const getAvatarUrl = () => {
    if (profileData.photoURL) return profileData.photoURL;
    if (isMyProfile && user.photoURL) return user.photoURL;
    const name = profileData.displayName || user?.displayName || "User";
    return `https://ui-avatars.com/api/?name=${name}&background=random`;
  };

  useEffect(() => {
    if (!targetUid) { router.push("/"); return; }
    const fetchProfile = async () => {
      try {
        const docRef = doc(db, "users", targetUid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.name && !data.displayName) data.displayName = data.name;
          if (isMyProfile) {
            if (!data.displayName) data.displayName = user.displayName;
            if (!data.photoURL) data.photoURL = user.photoURL;
          }
          setProfileData(data);
        } else if (isMyProfile) {
          setProfileData((prev) => ({ ...prev, displayName: user.displayName, photoURL: user.photoURL }));
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [targetUid, router, isMyProfile, user]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!isMyProfile) return;
    setIsSaving(true);
    try {
      const newName = profileData.displayName || user.displayName;
      await setDoc(doc(db, "users", user.uid), { ...profileData, name: newName, displayName: newName });

      if (auth.currentUser && newName !== user.displayName) {
        await updateProfile(auth.currentUser, { displayName: newName, photoURL: profileData.photoURL || user.photoURL });
      }

      const batch = writeBatch(db);
      const q = query(collection(db, "lists"), where("ownerId", "==", user.uid));
      const querySnapshot = await getDocs(q);
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

  if (loading) return <div style={{ textAlign: "center", marginTop: "2.5rem" }}>Carregando perfil...</div>;

  return (
    <div className="profile-container">
      {fromListCode && (
        <Link href={`/${fromListCode}`} className="back-link">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Voltar para a Lista
        </Link>
      )}

      <div className="profile-card">
        <div className="profile-header">
          <div className="avatar-wrapper">
            <img src={getAvatarUrl()} alt="Avatar" className="avatar-img" />
          </div>

          {isMyProfile ? (
            <>
              <div className="form-group-center">
                <label className="label-sm">Seu Nome de Exibição</label>
                <input
                  type="text"
                  value={profileData.displayName || ""}
                  onChange={(e) => setProfileData({ ...profileData, displayName: e.target.value })}
                  className="name-input-large"
                  placeholder="Seu Nome"
                />
              </div>
              <div className="form-group-center">
                <label className="label-sm">URL da Foto (Opcional)</label>
                <input
                  type="text"
                  value={profileData.photoURL || ""}
                  onChange={(e) => setProfileData({ ...profileData, photoURL: e.target.value })}
                  className="photo-input"
                  placeholder="Cole um link de imagem aqui..."
                />
              </div>
            </>
          ) : (
            <div style={{ textAlign: "center" }}>
              <h1 className="display-name">{profileData.displayName || "Usuário sem nome"}</h1>
              <p className="profile-subtitle">Perfil de Presentes</p>
            </div>
          )}
        </div>

        <form onSubmit={handleSave}>
          <div className="sizes-grid">
            <div>
              <label className="size-label">Camiseta</label>
              <input disabled={!isMyProfile} value={profileData.shirtSize || ""} onChange={(e) => setProfileData({ ...profileData, shirtSize: e.target.value })} className="input-field" style={{ textAlign: "center" }} placeholder="Ex: M" />
            </div>
            <div>
              <label className="size-label">Calça</label>
              <input disabled={!isMyProfile} value={profileData.pantsSize || ""} onChange={(e) => setProfileData({ ...profileData, pantsSize: e.target.value })} className="input-field" style={{ textAlign: "center" }} placeholder="Ex: 40" />
            </div>
            <div>
              <label className="size-label">Tênis</label>
              <input disabled={!isMyProfile} value={profileData.shoeSize || ""} onChange={(e) => setProfileData({ ...profileData, shoeSize: e.target.value })} className="input-field" style={{ textAlign: "center" }} placeholder="Ex: 41" />
            </div>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label className="size-label" style={{ textAlign: "left", marginBottom: "0.5rem" }}>Coisas que eu AMO ❤️</label>
            <textarea disabled={!isMyProfile} rows={4} value={profileData.likes || ""} onChange={(e) => setProfileData({ ...profileData, likes: e.target.value })} className="input-field textarea-likes" placeholder="Chocolate, livros..." />
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label className="size-label" style={{ textAlign: "left", marginBottom: "0.5rem" }}>Coisas que eu NÃO gosto ❌</label>
            <textarea disabled={!isMyProfile} rows={3} value={profileData.dislikes || ""} onChange={(e) => setProfileData({ ...profileData, dislikes: e.target.value })} className="input-field textarea-dislikes" placeholder="Uva passa..." />
          </div>

          {isMyProfile && (
            <button type="submit" disabled={isSaving} className="btn-primary btn-submit-profile">
              {isSaving ? "Atualizando..." : "Salvar Perfil"}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}