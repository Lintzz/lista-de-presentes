"use client";

// src/app/[code]/page.jsx
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { db, auth, googleProvider } from "../../lib/firebase";
import { signInWithPopup } from "firebase/auth";
import { collection, query, where, updateDoc, doc, arrayUnion, onSnapshot, getDoc } from "firebase/firestore";
import { useGlobal } from "../../context/GlobalContext";
import { useAuth } from "../../context/AuthContext";

import { RefreshCw } from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { MOTIVOS, ehLinkMorto, TEXTO_MOTIVO } from "../../lib/motivos";
import "../../styles/ListView.css";

import { SortableItemCard } from "../../components/features/ListView/SortableItemCard";

const THEME_COLORS = {
  blue: { border: "var(--list-blue-border)" },
  red: { border: "var(--list-red-border)" },
  green: { border: "var(--list-green-border)" },
  purple: { border: "var(--list-purple-border)" },
  orange: { border: "var(--list-orange-border)" },
  pink: { border: "var(--list-pink-border)" },
};

const CATEGORIES = ["Brinquedos", "Lego", "Roupas", "Calçados", "Eletrônicos", "Livros", "Casa", "Beleza", "Acessórios", "Games", "Outros"];
const PRIORITIES = ["Alta", "Média", "Baixa"];

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// Links de um item, já normalizados: item comum usa link1..3, item com
// variações usa o link de cada opção.
const linksDoItem = (item) =>
  (item.isGroup
    ? (item.variations || []).map((v, varIndex) => ({ url: v.link, varIndex }))
    : ["link1", "link2", "link3"].map((campo) => ({ url: item[campo], campo }))
  ).filter((alvo) => alvo.url);

const temAlgumLink = (item) => linksDoItem(item).length > 0;

// Roda as tarefas com concorrência limitada — o extrator faz HTTP de verdade.
async function comLimite(tarefas, limite, aoConcluir) {
  const resultados = [];
  let proxima = 0;
  await Promise.all(
    Array.from({ length: Math.min(limite, tarefas.length) }, async () => {
      while (proxima < tarefas.length) {
        const indice = proxima++;
        resultados[indice] = await tarefas[indice]();
        aoConcluir?.();
      }
    })
  );
  return resultados;
}

async function checarLink(url) {
  try {
    const resposta = await fetch(`/api/extrair?url=${encodeURIComponent(url)}`);
    const dados = await resposta.json();
    return {
      motivo: dados.motivo || (dados.erro ? MOTIVOS.INACESSIVEL : MOTIVOS.OK),
      preco: dados.preco ? parseFloat(dados.preco) : null,
      foto: dados.foto || "",
    };
  } catch {
    return { motivo: MOTIVOS.INACESSIVEL, preco: null, foto: "" };
  }
}

// Item com variações não tem preço próprio: usamos o da primeira opção.
const itemPrice = (item) => {
  if (item.isGroup && item.variations?.length) return parseFloat(item.variations[0].price) || 0;
  return parseFloat(item.price) || 0;
};

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

  // Revisão em massa dos links
  const [revisao, setRevisao] = useState(null); // { itens, naoChecados, feito, total }
  const [isRevisando, setIsRevisando] = useState(false);
  const [progresso, setProgresso] = useState({ feito: 0, total: 0 });

  const [sortBy, setSortBy] = useState("manual");
  const [filterCategory, setFilterCategory] = useState("Todas");
  const [viewMode, setViewMode] = useState("active");
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  useEffect(() => {
    const q = query(collection(db, "lists"), where("code", "==", code.toUpperCase()));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const docData = snapshot.docs[0];
        setListData({ id: docData.id, ...docData.data() });
      } else setListData(null);
      setLoading(false);
    });
    return () => unsubscribe();
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
    // A marcação só é apagada, nunca criada aqui: quem marca é a revisão de
    // links. Assim um item que o dono criou sem link de propósito não fica
    // esmaecido na lista.
    const voltouATerLink = temAlgumLink(newItem);
    try {
      if (editingId) {
        const updatedItems = listData.items.map((item) => item.id === editingId ? { ...item, ...newItem, price: parseFloat(newItem.price || 0), needsLink: voltouATerLink ? false : !!item.needsLink } : item);
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
        if (data.aviso) showModal("Preenchido em parte", data.aviso, "info");
        else showModal("Sucesso!", "Preenchido automaticamente!", "success");
        setIsScraperModalOpen(false);
        setScraperLink("");
      }
    } catch (error) {
      showModal("Erro", "Falha ao conectar com o extrator.", "error");
    } finally {
      setIsScraping(false);
    }
  };

  // === REVISÃO DOS LINKS ===
  // Checa cada link dos presentes ativos, monta um relatório e só grava depois
  // que o dono confirmar. Link só é removido quando a loja prova que a página
  // morreu (404/410) ou a URL é inválida — loja não suportada ou que bloqueou o
  // robô é preservada e listada como "não deu pra checar".
  const handleRevisarLinks = async () => {
    const itens = (listData.items || []).filter((i) => !i.isArchived && temAlgumLink(i));
    if (!itens.length) {
      showModal("Nada para revisar", "Nenhum presente ativo tem link cadastrado.", "info");
      return;
    }

    const alvos = itens.flatMap((item) => linksDoItem(item).map((alvo) => ({ ...alvo, item })));
    setIsRevisando(true);
    setProgresso({ feito: 0, total: alvos.length });

    try {
      const respostas = await comLimite(
        alvos.map((alvo) => () => checarLink(alvo.url)),
        3,
        () => setProgresso((p) => ({ ...p, feito: p.feito + 1 }))
      );
      const checados = alvos.map((alvo, i) => ({ ...alvo, ...respostas[i] }));

      const naoChecados = [];
      const relatorio = [];

      for (const item of itens) {
        const meus = checados.filter((c) => c.item.id === item.id);
        const mortos = meus.filter((c) => ehLinkMorto(c.motivo));
        const vivos = meus.filter((c) => !ehLinkMorto(c.motivo));

        meus
          .filter((c) => c.motivo !== MOTIVOS.OK && !ehLinkMorto(c.motivo))
          .forEach((c) => naoChecados.push({ nome: item.name, url: c.url, motivo: c.motivo }));

        const entrada = {
          id: item.id,
          nome: item.name,
          remover: mortos.map((c) => c.url),
          ficaSemLink: meus.length > 0 && vivos.length === 0,
          precoAntes: item.price,
          precoNovo: null,
          fotoNova: "",
          variacoes: {},
        };

        if (item.isGroup) {
          // Cada opção tem preço e foto próprios: atualiza uma a uma.
          for (const c of meus) {
            if (c.motivo !== MOTIVOS.OK) continue;
            const atual = item.variations[c.varIndex] || {};
            const mudancas = {};
            if (c.preco && parseFloat(atual.price || 0) !== c.preco) mudancas.price = c.preco;
            if (c.foto && !atual.image) mudancas.image = c.foto;
            if (Object.keys(mudancas).length) entrada.variacoes[c.varIndex] = { ...mudancas, nome: atual.name };
          }
        } else {
          const bom = meus.find((c) => c.motivo === MOTIVOS.OK && c.preco);
          if (bom && parseFloat(item.price || 0) !== bom.preco) entrada.precoNovo = bom.preco;

          const comFoto = meus.find((c) => c.motivo === MOTIVOS.OK && c.foto);
          if (comFoto && !item.image) entrada.fotoNova = comFoto.foto;
        }

        const mudouAlgo =
          entrada.remover.length ||
          entrada.precoNovo !== null ||
          entrada.fotoNova ||
          Object.keys(entrada.variacoes).length;

        if (mudouAlgo) relatorio.push(entrada);
      }

      setRevisao({ itens: relatorio, naoChecados, total: alvos.length });
    } catch (error) {
      console.error(error);
      showModal("Erro", "Falha ao revisar os links.", "error");
    } finally {
      setIsRevisando(false);
    }
  };

  const handleAplicarRevisao = async () => {
    if (!revisao) return;
    const porId = Object.fromEntries(revisao.itens.map((e) => [e.id, e]));

    const updatedItems = listData.items.map((item) => {
      const entrada = porId[item.id];
      if (!entrada) return item;

      const novo = { ...item };
      if (entrada.precoNovo !== null) novo.price = entrada.precoNovo;
      if (entrada.fotoNova) novo.image = entrada.fotoNova;

      if (item.isGroup) {
        novo.variations = (item.variations || []).map((v, i) => {
          const mudancas = entrada.variacoes[i];
          const atualizada = mudancas ? { ...v, ...(mudancas.price ? { price: mudancas.price } : {}), ...(mudancas.image ? { image: mudancas.image } : {}) } : { ...v };
          if (entrada.remover.includes(v.link)) atualizada.link = "";
          return atualizada;
        });
      } else {
        for (const campo of ["link1", "link2", "link3"]) {
          if (item[campo] && entrada.remover.includes(item[campo])) novo[campo] = "";
        }
      }

      // Marca o item para o dono voltar e cadastrar um link novo.
      novo.needsLink = entrada.ficaSemLink;
      return novo;
    });

    try {
      await updateDoc(doc(db, "lists", listData.id), { items: updatedItems });
      const semLink = revisao.itens.filter((e) => e.ficaSemLink).length;
      setRevisao(null);
      showModal(
        "Revisão aplicada!",
        semLink
          ? `${semLink} ${semLink === 1 ? "presente ficou" : "presentes ficaram"} sem link e ${semLink === 1 ? "está marcado" : "estão marcados"} na lista.`
          : "Links e preços atualizados.",
        "success"
      );
    } catch (error) {
      console.error(error);
      showModal("Erro", "Não foi possível salvar a revisão.", "error");
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

  if (loading) return <div className="list-view-message">Carregando lista...</div>;
  if (!listData) return <div className="list-view-message">Lista não encontrada :(</div>;

  const filteredItems = getFilteredItems();
  const isDragEnabled = isOwner && filterCategory === "Todas" && sortBy === "manual" && viewMode === "active";
  const handlers = { handleEditItem, handleOwnerUnmark, handleMarkReceived, handleMarkGiftClick, handleUnmarkGift, handleToggleArchive };

  const activeItems = listData.items?.filter((i) => !i.isArchived) || [];
  // Só é calculado/exibido para visitantes (ver header abaixo).
  const reservedCount = activeItems.filter((i) => i.giftedBy).length;
  const totalValue = activeItems.reduce((acc, i) => acc + itemPrice(i), 0);

  return (
    <div className="list-view-container" style={{ "--accent": listTheme.border }}>
      {/* === CABEÇALHO DA LISTA === */}
      <div className="list-header-card">
        <div className="list-header-main">
          <div>
            <p className="list-header-eyebrow">Lista de {listData.ownerName}</p>
            <h1 className="list-header-title">{listData.name}</h1>
            {!isOwner && (
              <Link href={`/perfil?uid=${listData.ownerId}&fromList=${listData.code}`} className="list-header-profile">
                Ver perfil de {listData.ownerName}
              </Link>
            )}
          </div>

          <div className="list-stats">
            <div>
              <p className="stat-value">{activeItems.length}</p>
              <p className="stat-label">presentes</p>
            </div>
            {/* O dono não vê quantos já foram reservados — isso entregaria a surpresa. */}
            {!isOwner && (
              <>
                <div className="list-stats-sep" />
                <div>
                  <p className="stat-value" style={{ color: "var(--color-success-text)" }}>{reservedCount}</p>
                  <p className="stat-label">reservados</p>
                </div>
              </>
            )}
            <div className="list-stats-sep" />
            <div>
              <p className="stat-value">{currency.format(totalValue)}</p>
              <p className="stat-label">total da lista</p>
            </div>
          </div>
        </div>

        <div className="header-actions">
          <button onClick={handleCopyCode} className="action-box" title="Copiar código">
            <span className="code-label">código</span>
            <span className="code-value mono">{listData.code}</span>
          </button>
          <button onClick={handleShare} className="btn-primary btn-share">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            <span className="btn-share-label">Compartilhar</span>
          </button>
        </div>
      </div>

      {/* === BARRA DE FILTROS === */}
      <div className="filters-bar">
        {isOwner && (
          <>
            <button onClick={() => setViewMode("active")} className={`btn-pill ${viewMode === "active" ? "active" : ""}`}>Ativos</button>
            <button onClick={() => setViewMode("archived")} className={`btn-pill ${viewMode === "archived" ? "active" : ""}`}>Arquivados</button>
          </>
        )}

        {!isOwner && (
          <button
            onClick={() => setShowOnlyAvailable((v) => !v)}
            className={`btn-pill ${showOnlyAvailable ? "active" : ""}`}
          >
            Só disponíveis
          </button>
        )}

        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="filter-select">
          <option value="Todas">Todas as categorias</option>
          {CATEGORIES.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
        </select>

        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="filter-select">
          <option value="manual">Ordem padrão</option>
          <option value="priority">Maior prioridade</option>
          <option value="value">Menor preço</option>
        </select>

        {isOwner && (
          <>
            <button
              onClick={handleRevisarLinks}
              disabled={isRevisando}
              className="btn-pill filters-check"
              title="Testa cada link, atualiza preço e foto e remove os que morreram"
            >
              <RefreshCw size={14} className={isRevisando ? "spin" : ""} />
              {isRevisando ? `Revisando ${progresso.feito}/${progresso.total}...` : "Revisar links"}
            </button>
            <button onClick={() => setIsFormOpen(true)} className="btn-dashed filters-add">+ Adicionar presente</button>
          </>
        )}
      </div>

      {/* === LISTA DE PRESENTES === */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={filteredItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="gift-list">
            {filteredItems.length === 0 ? (
              <div className="gift-list-empty">Nenhum item encontrado.</div>
            ) : (
              filteredItems.map((item) => (
                <SortableItemCard key={item.id} id={item.id} item={item} isOwner={isOwner} user={user} handlers={handlers} isDragEnabled={isDragEnabled} />
              ))
            )}
          </div>
        </SortableContext>
      </DndContext>

      <button onClick={scrollToTop} className={`scroll-top ${!showScrollTop ? "hidden" : ""}`} title="Voltar ao topo">
        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
      </button>

      {/* === MODAL: FORMULÁRIO DE PRESENTE === */}
      {isOwner && isFormOpen && (
        <div className="modal-overlay" onClick={resetForm}>
          <div className="modal-content modal-wide modal-animate" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">{editingId ? "Editar presente" : "Adicionar presente"}</h3>
            <p className="modal-desc">Cola o link da loja — a gente preenche o resto.</p>

            <form onSubmit={handleSaveItem} className="form-grid">
              <div className="form-grid-2">
                <label className="field">
                  <span className="field-label">Nome do presente</span>
                  <input maxLength={50} placeholder="Ex: Fone bluetooth" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} className="input-field" />
                </label>
                <label className="field">
                  <span className="field-label">URL da foto</span>
                  <input placeholder="https://..." value={newItem.image} onChange={(e) => setNewItem({ ...newItem, image: e.target.value })} className="input-field" />
                </label>
              </div>

              <div className="form-grid-4">
                <label className="field">
                  <span className="field-label">Categoria</span>
                  <select value={newItem.category} onChange={handleCategoryChange} className="input-field">
                    <option value="Outros">Outros</option>
                    {CATEGORIES.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
                  </select>
                </label>

                {(newItem.category === "Roupas" || newItem.category === "Calçados") && (
                  <label className="field">
                    <span className="field-label">Tamanho</span>
                    <input value={newItem.size} onChange={(e) => setNewItem({ ...newItem, size: e.target.value })} className="input-field" />
                  </label>
                )}

                {["Eletrônicos", "Casa", "Beleza"].includes(newItem.category) && (
                  <label className="field">
                    <span className="field-label">Voltagem</span>
                    <select value={newItem.voltage} onChange={(e) => setNewItem({ ...newItem, voltage: e.target.value })} className="input-field">
                      <option value="">Selecione...</option>
                      <option value="110v">110v</option>
                      <option value="220v">220v</option>
                      <option value="Bivolt">Bivolt</option>
                    </select>
                  </label>
                )}

                {!newItem.isGroup && (
                  <label className="field">
                    <span className="field-label">Valor (R$)</span>
                    <input type="number" step="0.01" value={newItem.price} onChange={(e) => setNewItem({ ...newItem, price: e.target.value })} className="input-field" placeholder="0,00" />
                  </label>
                )}
              </div>

              <div className="field">
                <span className="field-label">Prioridade</span>
                <div className="prio-group">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNewItem({ ...newItem, priority: p })}
                      className={`prio-option ${newItem.priority === p ? `active prio-${p === "Alta" ? "high" : p === "Média" ? "med" : "low"}` : ""}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <label className="checkbox-group">
                <input type="checkbox" checked={newItem.isGroup} onChange={(e) => setNewItem({ ...newItem, isGroup: e.target.checked })} />
                <span>Este item possui variações (Ex: cores diferentes)</span>
              </label>

              {newItem.isGroup && (
                <div className="variations-box">
                  <h4 className="variations-title">Opções do presente</h4>
                  {newItem.variations.map((v, i) => (
                    <div key={i} className="variation-item">
                      <button type="button" onClick={() => handleRemoveVariation(i)} className="btn-remove-var" title="Remover opção">×</button>
                      <label className="field"><span className="field-label">Nome da opção *</span><input value={v.name} onChange={(e) => handleVariationChange(i, "name", e.target.value)} className="input-field" /></label>
                      <label className="field"><span className="field-label">Preço (R$)</span><input type="number" step="0.01" value={v.price} onChange={(e) => handleVariationChange(i, "price", e.target.value)} className="input-field" /></label>
                      <label className="field"><span className="field-label">URL da foto</span><input value={v.image} onChange={(e) => handleVariationChange(i, "image", e.target.value)} className="input-field" /></label>
                      <label className="field"><span className="field-label">Link da loja</span><input value={v.link} onChange={(e) => handleVariationChange(i, "link", e.target.value)} className="input-field" /></label>
                    </div>
                  ))}
                  <button type="button" onClick={handleAddVariation} className="btn-dashed">+ Adicionar nova opção</button>
                </div>
              )}

              {!newItem.isGroup && (
                <div className="field">
                  <span className="field-label">Links das lojas</span>
                  <div className="links-grid">
                    <input placeholder="Link 1" value={newItem.link1} onChange={(e) => setNewItem({ ...newItem, link1: e.target.value })} className="input-field" />
                    <input placeholder="Link 2" value={newItem.link2} onChange={(e) => setNewItem({ ...newItem, link2: e.target.value })} className="input-field" />
                    <input placeholder="Link 3" value={newItem.link3} onChange={(e) => setNewItem({ ...newItem, link3: e.target.value })} className="input-field" />
                  </div>
                  <button type="button" onClick={() => setIsScraperModalOpen(true)} className="btn-ghost btn-autofill">
                    ✨ Preencher usando Link
                  </button>
                </div>
              )}

              <label className="field">
                <span className="field-label">Observações</span>
                <textarea rows={3} placeholder="Ex: prefiro algodão pesado, sem estampa grande." value={newItem.obs} onChange={(e) => setNewItem({ ...newItem, obs: e.target.value })} className="input-field" />
              </label>

              <div className="modal-actions">
                <button type="button" onClick={resetForm} className="btn-ghost">Cancelar</button>
                <button type="submit" className="btn-primary">{editingId ? "Salvar" : "Adicionar"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* === MODAL: RELATÓRIO DA REVISÃO === */}
      {revisao && (
        <div className="modal-overlay" onClick={() => setRevisao(null)}>
          <div className="modal-content modal-wide modal-animate" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Revisão dos links</h3>
            <p className="modal-desc">
              {revisao.total} {revisao.total === 1 ? "link checado" : "links checados"}.
              {revisao.itens.length === 0 ? " Nada para mudar." : " Confira antes de salvar."}
            </p>

            {revisao.itens.length > 0 && (
              <ul className="revisao-lista">
                {revisao.itens.map((entrada) => (
                  <li key={entrada.id} className={`revisao-item ${entrada.ficaSemLink ? "sem-link" : ""}`}>
                    <strong className="revisao-nome">{entrada.nome}</strong>
                    <div className="revisao-mudancas">
                      {entrada.precoNovo !== null && (
                        <span className="revisao-tag preco">
                          {moeda.format(entrada.precoAntes || 0)} → {moeda.format(entrada.precoNovo)}
                        </span>
                      )}
                      {Object.entries(entrada.variacoes).map(([i, m]) => (
                        <span key={i} className="revisao-tag preco">
                          {m.nome || `Opção ${Number(i) + 1}`}
                          {m.price ? `: ${moeda.format(m.price)}` : ""}
                          {m.image ? " + foto" : ""}
                        </span>
                      ))}
                      {entrada.fotoNova && <span className="revisao-tag foto">+ foto</span>}
                      {entrada.remover.length > 0 && (
                        <span className="revisao-tag remove">
                          − {entrada.remover.length} {entrada.remover.length === 1 ? "link quebrado" : "links quebrados"}
                        </span>
                      )}
                      {entrada.ficaSemLink && <span className="revisao-tag alerta">fica sem link</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {revisao.naoChecados.length > 0 && (
              <details className="revisao-nao-checados">
                <summary>
                  {revisao.naoChecados.length} {revisao.naoChecados.length === 1 ? "link não pôde" : "links não puderam"} ser
                  checado{revisao.naoChecados.length === 1 ? "" : "s"} — nenhum será removido
                </summary>
                <ul>
                  {revisao.naoChecados.map((n, i) => (
                    <li key={i}>
                      <strong>{n.nome}</strong> — {TEXTO_MOTIVO[n.motivo] || n.motivo}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <div className="modal-actions">
              <button type="button" onClick={() => setRevisao(null)} className="btn-ghost">
                {revisao.itens.length === 0 ? "Fechar" : "Cancelar"}
              </button>
              {revisao.itens.length > 0 && (
                <button type="button" onClick={handleAplicarRevisao} className="btn-primary">Aplicar mudanças</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* === MODAL DO EXTRATOR === */}
      {isScraperModalOpen && (
        <div className="modal-overlay scraper-overlay">
          <div className="modal-content modal-animate">
            <h3 className="modal-title">Preenchimento automático</h3>
            <p className="modal-desc">Cole o link do produto abaixo para buscarmos o nome, preço e foto.</p>

            <input
              type="text"
              placeholder="Cole o link aqui..."
              value={scraperLink}
              onChange={(e) => setScraperLink(e.target.value)}
              className="input-field"
              disabled={isScraping}
            />

            {isScraping ? (
              <div className="scraper-loading">
                <div className="spinner"></div>
                <p>
                  Buscando dados na loja...<br /><strong>Isso pode demorar um pouco, por favor aguarde.</strong>
                </p>
              </div>
            ) : (
              <div className="modal-actions">
                <button type="button" onClick={() => setIsScraperModalOpen(false)} className="btn-ghost">Cancelar</button>
                <button type="button" onClick={handleAutoFill} className="btn-primary">Buscar dados</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
