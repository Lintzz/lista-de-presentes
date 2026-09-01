"use client";

// src/pages/ListView/index.jsx
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { db, auth, googleProvider } from "../../lib/firebase";
import { signInWithPopup } from "firebase/auth";
import { collection, query, where, updateDoc, doc, arrayUnion, onSnapshot, getDoc } from "firebase/firestore";
import { useGlobal } from "../../context/GlobalContext";
import { useAuth } from "../../context/AuthContext";

import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
// IMPORTANTE: Adicionados ChevronLeft e ChevronRight
import { Archive, ArchiveRestore } from "lucide-react";
import "../../styles/ListView.css";

import { SortableItemCard } from "../../components/features/ListView/SortableItemCard";
import { StoreIcon, getStoreStyle } from "../../components/ui/StoreIcon";

const THEME_COLORS = {
  blue: { border: "var(--list-blue-border)" },
  red: { border: "var(--list-red-border)" },
  green: { border: "var(--list-green-border)" },
  purple: { border: "var(--list-purple-border)" },
  orange: { border: "var(--list-orange-border)" },
  pink: { border: "var(--list-pink-border)" },
};

const CATEGORIES = ["Brinquedos", "Lego", "Roupas", "Calçados", "Eletrônicos", "Livros", "Casa", "Beleza", "Acessórios", "Games", "Outros"];



export default function ListView() {
  const { user } = useAuth();
  const { code } = useParams();
  const { showModal } = useGlobal();
  const [listData, setListData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [newItem, setNewItem] = useState({ name: "", image: "", link1: "", link2: "", link3: "", price: "", obs: "", priority: "Média", category: "Outros", size: "", voltage: "", isGroup: false, variations: [], isArchived: false });

  // Estados do Modal do Extrator
  const [isScraperModalOpen, setIsScraperModalOpen] = useState(false);
  const [scraperLink, setScraperLink] = useState("");
  const [isScraping, setIsScraping] = useState(false);

  const [sortBy, setSortBy] = useState("manual");
  const [filterCategory, setFilterCategory] = useState("Todas");
  const [viewMode, setViewMode] = useState("active");
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  useEffect(() => {
    const fetchList = async () => {
      const q = query(collection(db, "lists"), where("code", "==", code.toUpperCase()));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const docData = snapshot.docs[0];
          setListData({ id: docData.id, ...docData.data() });
        } else setListData(null);
        setLoading(false);
      });
      return () => unsubscribe();
    };
    fetchList();
  }, [code]);

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  const isOwner = user && listData && user.uid === listData.ownerId;
  const listTheme = listData && THEME_COLORS[listData.color] ? THEME_COLORS[listData.color] : THEME_COLORS.blue;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(listData.code);
    showModal("Código Copiado!", `O código ${listData.code} foi copiado.`, "success");
  };

  const handleShare = async () => {
    const shareData = { title: `Lista: ${listData.name}`, text: `Veja minha lista "${listData.name}"! Código: ${listData.code}`, url: window.location.href };
    if (navigator.share) { try { await navigator.share(shareData); } catch (err) {} } else handleCopyCode();
  };

  const handleEditItem = (item) => {
    setNewItem({ ...item, image: item.image || "", link1: item.link1 || "", link2: item.link2 || "", link3: item.link3 || "", obs: item.obs || "", priority: item.priority || "Média", category: item.category || "Outros", size: item.size || "", voltage: item.voltage || "", isGroup: item.isGroup || false, variations: item.variations || [], isArchived: item.isArchived || false });
    setEditingId(item.id);
    setIsFormOpen(true);
    window.scrollTo({ top: 150, behavior: "smooth" });
  };

  const resetForm = () => {
    setNewItem({ name: "", image: "", link1: "", link2: "", link3: "", price: "", obs: "", priority: "Média", category: "Outros", size: "", voltage: "", isGroup: false, variations: [], isArchived: false });
    setEditingId(null);
    setIsFormOpen(false);
  };

  const handleCategoryChange = (e) => {
    const newCategory = e.target.value;
    setNewItem((prev) => ({ ...prev, category: newCategory, size: newCategory === "Roupas" || newCategory === "Calçados" ? prev.size : "", voltage: newCategory === "Eletrônicos" || newCategory === "Casa" ? prev.voltage : "" }));
  };

  const handleAddVariation = () => setNewItem((prev) => ({ ...prev, variations: [...prev.variations, { name: "", image: "", link: "", price: "" }] }));
  const handleVariationChange = (index, field, value) => { const newVars = [...newItem.variations]; newVars[index][field] = value; setNewItem((prev) => ({ ...prev, variations: newVars })); };
  const handleRemoveVariation = (index) => { const newVars = newItem.variations.filter((_, i) => i !== index); setNewItem((prev) => ({ ...prev, variations: newVars })); };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!newItem.name || (!newItem.isGroup && !newItem.price)) { showModal("Erro", "Nome e valor são obrigatórios.", "error"); return; }
    const listRef = doc(db, "lists", listData.id);
    try {
      if (editingId) {
        const updatedItems = listData.items.map((item) => item.id === editingId ? { ...item, ...newItem, price: parseFloat(newItem.price || 0) } : item);
        await updateDoc(listRef, { items: updatedItems });
        showModal("Atualizado!", "Item editado.", "success");
      } else {
        const itemToAdd = { id: Date.now().toString(), ...newItem, price: parseFloat(newItem.price || 0), giftedBy: null, giftedById: null, isArchived: false };
        await updateDoc(listRef, { items: arrayUnion(itemToAdd) });
        showModal("Sucesso!", "Item adicionado.", "success");
      }
      resetForm();
    } catch (error) { showModal("Erro", "Erro ao salvar.", "error"); }
  };

  const handleAutoFill = async () => {
    if (!scraperLink) { 
      showModal("Ops!", "Cole o link primeiro antes de buscar.", "info"); 
      return; 
    }
    
    setIsScraping(true);
    
    try {
      const API_URL = "/api/extrair";
      const response = await fetch(`${API_URL}?url=${encodeURIComponent(scraperLink)}`);
      const data = await response.json();
      
      if (data.erro) { 
        showModal("Erro", data.erro, "error"); 
      } else {
        setNewItem((prev) => ({ ...prev, name: data.nome || prev.name, price: data.preco ? parseFloat(data.preco) : prev.price, image: data.foto || prev.image, link1: scraperLink }));
        showModal("Sucesso!", "Preenchido automaticamente!", "success");
        setIsScraperModalOpen(false); 
        setScraperLink(""); 
      }
    } catch (error) { 
      showModal("Erro", "Falha ao conectar com o extrator.", "error"); 
    } finally {
      setIsScraping(false); 
    }
  };

  const checkUserProfileName = async (uid) => { try { const userSnap = await getDoc(doc(db, "users", uid)); if (userSnap.exists() && userSnap.data().name) return userSnap.data().name; } catch (error) {} return null; };

  const handleMarkGiftClick = async (itemId) => {
    let currentUser = user;
    try {
      if (!currentUser) { googleProvider.setCustomParameters({ prompt: "select_account" }); const result = await signInWithPopup(auth, googleProvider); currentUser = result.user; }
      const profileName = await checkUserProfileName(currentUser.uid);
      if (!profileName) showModal("Complete seu perfil", "Por favor, salve seu nome para continuar.", "info");
      else {
        showModal("Confirmar", `Marcar presente como ${profileName}?`, "info", async () => {
          const updatedItems = listData.items.map((item) => item.id === itemId ? { ...item, giftedBy: profileName, giftedById: currentUser.uid } : item);
          await updateDoc(doc(db, "lists", listData.id), { items: updatedItems });
          showModal("Obrigado!", "Presente marcado com sucesso!", "success");
        });
      }
    } catch (error) { if (error.code !== "auth/popup-closed-by-user") showModal("Erro", "Falha no login.", "error"); }
  };

  const handleUnmarkGift = async (item) => {
    const currentName = await checkUserProfileName(user?.uid);
    if (!user || (item.giftedById && item.giftedById !== user.uid && item.giftedBy !== currentName)) { showModal("Atenção", "Só pode desmarcar presentes que você marcou.", "error"); return; }
    showModal("Liberar?", "Deseja desmarcar?", "info", async () => {
      const updatedItems = listData.items.map((i) => i.id === item.id ? { ...i, giftedBy: null, giftedById: null } : i);
      await updateDoc(doc(db, "lists", listData.id), { items: updatedItems });
    });
  };

  const handleMarkReceived = (itemId) => { showModal("Já ganhou?", "Isso remove o item da lista.", "info", async () => { const updatedItems = listData.items.filter((item) => item.id !== itemId); await updateDoc(doc(db, "lists", listData.id), { items: updatedItems }); }); };
  const handleOwnerUnmark = (itemId) => { showModal("Não ganhou?", "Desmarcar presente?", "info", async () => { const updatedItems = listData.items.map((item) => item.id === itemId ? { ...item, giftedBy: null, giftedById: null } : item); await updateDoc(doc(db, "lists", listData.id), { items: updatedItems }); }); };
  const handleToggleArchive = async (item) => { const action = item.isArchived ? "Restaurar" : "Arquivar"; showModal(action, `Deseja ${action.toLowerCase()}?`, "info", async () => { const updatedItems = listData.items.map((i) => i.id === item.id ? { ...i, isArchived: !item.isArchived } : i); await updateDoc(doc(db, "lists", listData.id), { items: updatedItems }); }); };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = listData.items.findIndex((i) => i.id === active.id);
    const newIndex = listData.items.findIndex((i) => i.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) { const newItems = arrayMove(listData.items, oldIndex, newIndex); await updateDoc(doc(db, "lists", listData.id), { items: newItems }); }
  };

  const getFilteredItems = () => {
    if (!listData?.items) return [];
    
    let items = listData.items.filter((item) => {
      const matchArchive = viewMode === "archived" ? item.isArchived : !item.isArchived;
      const matchCategory = filterCategory === "Todas" || (item.category || "Outros") === filterCategory;
      const matchAvailable = (showOnlyAvailable && !isOwner) ? !item.giftedBy : true;

      return matchArchive && matchCategory && matchAvailable;
    });

    if (sortBy === "value") items.sort((a, b) => a.price - b.price);
    else if (sortBy === "priority") { const pMap = { Alta: 3, Média: 2, Baixa: 1 }; items.sort((a, b) => pMap[b.priority] - pMap[a.priority]); }
    
    return items;
  };

  const filteredItems = getFilteredItems();
  const isDragEnabled = isOwner && filterCategory === "Todas" && sortBy === "manual" && viewMode === "active";
  const handlers = { handleEditItem, handleOwnerUnmark, handleMarkReceived, handleMarkGiftClick, handleUnmarkGift, handleToggleArchive };

  if (loading) return <div style={{textAlign:'center', padding:'3rem', color:'var(--color-text-body)'}}>Carregando lista...</div>;
  if (!listData) return <div style={{textAlign:'center', padding:'3rem', color:'var(--color-text-body)'}}>Lista não encontrada :(</div>;

  return (
    <div className="list-view-container">
      {/* Modal do Extrator */}
      {isScraperModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content modal-animate">
            <h3 className="modal-title" style={{ marginBottom: '1rem' }}>Preenchimento Automático</h3>
            <p className="modal-desc">Cole o link do produto abaixo para buscarmos o Nome, Preço e Foto.</p>
            
            <input 
              type="text" 
              placeholder="Cole o link aqui..." 
              value={scraperLink} 
              onChange={(e) => setScraperLink(e.target.value)} 
              className="input-field" 
              style={{ marginBottom: '1.5rem' }}
              disabled={isScraping}
            />

            {isScraping ? (
              <div style={{ textAlign: 'center', margin: '1rem 0' }}>
                <div className="spinner"></div>
                <p style={{ marginTop: '1rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                  Buscando dados na loja...<br/><strong>Isso pode demorar um pouco, por favor aguarde.</strong>
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                <button type="button" onClick={() => setIsScraperModalOpen(false)} className="btn-primary" style={{ backgroundColor: 'transparent', color: 'var(--prio-high)', border: '1px solid var(--color-border)' }}>
                  Cancelar
                </button>
                <button type="button" onClick={handleAutoFill} className="btn-primary">
                  Buscar Dados
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="list-header-card" style={{ borderLeftColor: listTheme.border }}>
        <div>
          <h1 className="list-header-title">{listData.name}</h1>
          <p className="list-header-info">Criado por: <span>{listData.ownerName}</span></p>
          {!isOwner && <div style={{marginTop:'0.5rem', fontSize:'0.875rem'}}><Link to={`/perfil?uid=${listData.ownerId}&fromList=${listData.code}`} style={{color:'var(--color-primary)'}}>Ver perfil</Link></div>}
        </div>
        <div className="header-actions">
          {isOwner && (
            <div onClick={handleCopyCode} className="action-box">
              <span className="code-label">Código</span>
              <span className="code-value">{listData.code}</span>
            </div>
          )}
          <button onClick={handleShare} className="action-box" style={{border:'1px solid var(--color-border)', height:'100%', padding:'0.75rem'}}>
             <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
             </svg>
          </button>
        </div>
      </div>

      {isOwner && (
        <>
          {!isFormOpen ? (
            <button onClick={() => setIsFormOpen(true)} className="btn-add-item">
              <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
              <span>Adicionar Presente</span>
            </button>
          ) : (
            <div className="form-card modal-animate">
              <div style={{display:'flex', justifyContent:'space-between'}}>
                <h3 style={{fontWeight:'bold', fontSize:'1.125rem', color:'var(--color-card-heading)'}}>{editingId ? "Editar" : "Novo"}</h3>
                <button onClick={resetForm} style={{background:'transparent', border:'none', color:'var(--prio-high)', cursor:'pointer', fontWeight:'bold'}}>Cancelar</button>
              </div>
              <form onSubmit={handleSaveItem} className="form-grid">
                <div className="form-grid-2">
                  <input maxLength={50} placeholder="Nome do item" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} className="input-field" />
                  <input placeholder="URL da Foto" value={newItem.image} onChange={(e) => setNewItem({ ...newItem, image: e.target.value })} className="input-field" />
                </div>

                <div className="form-grid-4">
                  <div>
                    <label className="filter-label">Categoria</label>
                    <select value={newItem.category} onChange={handleCategoryChange} className="input-field"><option value="Outros">Outros</option>{CATEGORIES.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}</select>
                  </div>
                  {(newItem.category === "Roupas" || newItem.category === "Calçados") && (<div><label className="filter-label">Tamanho</label><input value={newItem.size} onChange={(e) => setNewItem({ ...newItem, size: e.target.value })} className="input-field" /></div>)}
                  {["Eletrônicos", "Casa", "Beleza"].includes(newItem.category) && (<div><label className="filter-label">Voltagem</label><select value={newItem.voltage} onChange={(e) => setNewItem({ ...newItem, voltage: e.target.value })} className="input-field"><option value="">Selecione...</option><option value="110v">110v</option><option value="220v">220v</option><option value="Bivolt">Bivolt</option></select></div>)}
                  <div><label className="filter-label">Prioridade</label><select value={newItem.priority} onChange={(e) => setNewItem({ ...newItem, priority: e.target.value })} className="input-field"><option value="Alta">Alta</option><option value="Média">Média</option><option value="Baixa">Baixa</option></select></div>
                  {!newItem.isGroup && (<div><label className="filter-label">Valor (R$)</label><input type="number" value={newItem.price} onChange={(e) => setNewItem({ ...newItem, price: e.target.value })} className="input-field" placeholder="0.00" /></div>)}
                </div>

                <div className="checkbox-group">
                  <input type="checkbox" id="isGroup" checked={newItem.isGroup} onChange={(e) => setNewItem({ ...newItem, isGroup: e.target.checked })} style={{width:'1.25rem', height:'1.25rem', cursor:'pointer'}} />
                  <label htmlFor="isGroup" style={{fontSize:'0.875rem', fontWeight:'600', cursor:'pointer'}}>Este item possui variações (Ex: Cores diferentes)</label>
                </div>
            
                {newItem.isGroup && (
                  <div className="variations-box">
                    <h4 style={{fontSize:'0.875rem', fontWeight:'bold', marginBottom:'1rem', marginTop: '0'}}>Opções do Presente</h4>
                    {newItem.variations.map((v, i) => (
                      <div key={i} className="variation-item">
                        <button type="button" onClick={() => handleRemoveVariation(i)} className="btn-remove-var">X</button>
                        <div><label className="filter-label">Nome da Opção *</label><input value={v.name} onChange={(e) => handleVariationChange(i, "name", e.target.value)} className="input-field" /></div>
                        <div><label className="filter-label">Preço (R$)</label><input type="number" value={v.price} onChange={(e) => handleVariationChange(i, "price", e.target.value)} className="input-field" /></div>
                        <div><label className="filter-label">URL da Foto</label><input value={v.image} onChange={(e) => handleVariationChange(i, "image", e.target.value)} className="input-field" /></div>
                        <div><label className="filter-label">Link da Loja</label><input value={v.link} onChange={(e) => handleVariationChange(i, "link", e.target.value)} className="input-field" /></div>
                      </div>
                    ))}
                    <button type="button" onClick={handleAddVariation} style={{background:'transparent', border:'1px solid var(--color-primary)', color:'var(--color-primary)', padding:'0.5rem 1rem', borderRadius:'0.25rem', fontWeight:'bold', cursor:'pointer'}}>+ Adicionar Nova Opção</button>
                  </div>
                )}

                {!newItem.isGroup && (
                  <div>
                    <label className="filter-label" style={{ marginBottom: '0.25rem' }}>Links</label>
                    <div className="form-grid-4">
                      <input placeholder="Link 1" value={newItem.link1} onChange={(e) => setNewItem({ ...newItem, link1: e.target.value })} className="input-field" />
                      <input placeholder="Link 2" value={newItem.link2} onChange={(e) => setNewItem({ ...newItem, link2: e.target.value })} className="input-field" />
                      <input placeholder="Link 3" value={newItem.link3} onChange={(e) => setNewItem({ ...newItem, link3: e.target.value })} className="input-field" />
                      
                      <button type="button" onClick={() => setIsScraperModalOpen(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', height: '100%' }}>
                        ✨ Preencher usando Link
                      </button>
                    </div>
                  </div>
                )}
                <textarea placeholder="Observações" value={newItem.obs} onChange={(e) => setNewItem({ ...newItem, obs: e.target.value })} className="input-field" />
                <button type="submit" className="btn-primary">{editingId ? "Salvar" : "Adicionar"}</button>
              </form>
            </div>
          )}
        </>
      )}

      {isOwner && (
        <div className="tabs-container">
          <button onClick={() => setViewMode("active")} className={`tab-btn ${viewMode === "active" ? "active" : ""}`}>Ativos</button>
          <button onClick={() => setViewMode("archived")} className={`tab-btn ${viewMode === "archived" ? "active" : ""}`} style={{display:'flex', gap:'0.25rem', alignItems:'center'}}>Arquivados <Archive size={14} /></button>
        </div>
      )}

      <div className="filters-bar">
        <div className="filter-group">
          <span className="filter-label">Filtrar:</span>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="input-field" style={{padding:'0.5rem'}}>
            <option value="Todas">Todas</option>
            {CATEGORIES.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
          </select>
        </div>
        <div className="filter-group">
          <span className="filter-label">Ordenar:</span>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="input-field" style={{padding:'0.5rem'}}>
            <option value="manual">Padrão</option>
            <option value="priority">Prioridade</option>
            <option value="value">Valor</option>
          </select>
        </div>
        
        {/* Agora a caixinha só aparece se a pessoa NÃO for a dona da lista */}
        {!isOwner && (
          <div className="filter-group" style={{ marginLeft: window.innerWidth > 768 ? 'auto' : '0' }}>
            <input 
              type="checkbox" 
              id="showAvailable" 
              checked={showOnlyAvailable} 
              onChange={(e) => setShowOnlyAvailable(e.target.checked)} 
              style={{ width: '1.25rem', height: '1.25rem', cursor: 'pointer' }}
            />
            <label htmlFor="showAvailable" className="filter-label" style={{ cursor: 'pointer', margin: 0 }}>
              Ocultar já marcados
            </label>
          </div>
        )}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={filteredItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="gift-list">
            {filteredItems.length === 0 ? (
              <div style={{textAlign:'center', padding:'2rem', border:'1px dashed var(--color-border)', borderRadius:'0.5rem', color:'var(--color-text-muted)'}}>Nenhum item encontrado.</div>
            ) : (
              filteredItems.map((item) => (
                <SortableItemCard key={item.id} id={item.id} item={item} isOwner={isOwner} user={user} handlers={handlers} isDragEnabled={isDragEnabled} />
              ))
            )}
          </div>
        </SortableContext>
      </DndContext>

      <button onClick={scrollToTop} className={`scroll-top ${!showScrollTop ? "hidden" : ""}`} title="Voltar ao topo">
        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18"/></svg>
      </button>
    </div>
  );
}