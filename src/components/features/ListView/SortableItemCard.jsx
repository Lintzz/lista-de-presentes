import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Archive, ArchiveRestore, ChevronLeft, ChevronRight } from "lucide-react";
import { StoreIcon, getStoreStyle } from "../../ui/StoreIcon";

const prioClass = (priority) =>
  priority === "Alta" ? "prio-high" : priority === "Média" ? "prio-med" : "prio-low";

export function SortableItemCard({ id, item, isOwner, user, handlers, isDragEnabled }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: id, disabled: !isDragEnabled });

  // Controle do Carrossel para itens com Variação
  const [varIndex, setVarIndex] = useState(0);

  const style = { transform: CSS.Transform.toString(transform), transition };
  const isGifted = !!item.giftedBy;
  const isGiver = user && (item.giftedById === user.uid || (!item.giftedById && item.giftedBy));

  const isLocked = isGifted && !isOwner && !isGiver;

  // Lógica para descobrir qual item exibir na tela (Item Principal vs Variação Selecionada no Carrossel)
  const hasVariations = item.isGroup && item.variations && item.variations.length > 0;
  const currentVariation = hasVariations ? item.variations[varIndex] : null;

  const displayImage = currentVariation && currentVariation.image ? currentVariation.image : item.image;
  const displayName = currentVariation ? `${item.name} - ${currentVariation.name}` : item.name;
  const displayPrice = currentVariation && currentVariation.price ? currentVariation.price : item.price;

  const handlePrev = (e) => {
    e.preventDefault();
    setVarIndex(prev => prev === 0 ? item.variations.length - 1 : prev - 1);
  };

  const handleNext = (e) => {
    e.preventDefault();
    setVarIndex(prev => prev === item.variations.length - 1 ? 0 : prev + 1);
  };

  const storeLinks = hasVariations
    ? (currentVariation?.link ? [currentVariation.link] : [])
    : [item.link1, item.link2, item.link3].filter(Boolean);

  // A revisão de links marca o item quando todos os links dele morreram.
  // Só o dono vê o estado esmaecido — é uma pendência dele, não do visitante.
  const precisaDeLink = !!item.needsLink && isOwner;

  return (
    <div ref={setNodeRef} style={style} className={`gift-card ${isDragging ? "dragging" : ""} ${isLocked ? "gifted" : ""} ${precisaDeLink ? "needs-link" : ""}`}>
      {isDragEnabled && (
        <div {...attributes} {...listeners} className="drag-handle">
          <GripVertical size={18} />
        </div>
      )}

      <div className="gift-img-wrapper">
        {displayImage ? (
          <img src={displayImage} alt={displayName} className="gift-img" />
        ) : (
          <div className="gift-img-empty">sem foto</div>
        )}

        {/* Badge de Categoria Fixa */}
        {item.category && <div className="gift-badge">{item.category}</div>}

        {/* Setas do Carrossel e Contador de Opções */}
        {hasVariations && item.variations.length > 1 && (
          <>
            <button onClick={handlePrev} className="carousel-btn left"><ChevronLeft size={18} /></button>
            <button onClick={handleNext} className="carousel-btn right"><ChevronRight size={18} /></button>
            <div className="carousel-indicator">
              {varIndex + 1} / {item.variations.length}
            </div>
          </>
        )}
      </div>

      <div className="gift-details">
        <div className="gift-title-row">
          <div className="gift-title-box">
            <h3 className="gift-name">{displayName}</h3>
            <div className="gift-tags">
              {item.priority && <span className={`tag-prio ${prioClass(item.priority)}`}>Prioridade {item.priority.toLowerCase()}</span>}
              {item.size && <span className="tag-size">Tam. {item.size}</span>}
              {item.voltage && <span className="tag-volt">{item.voltage}</span>}
              {item.category && <span className="gift-category">{item.category}</span>}
            </div>
          </div>

          <div className="gift-price-box">
            {displayPrice ? <p className="gift-price">R$ {displayPrice}</p> : null}
          </div>
        </div>

        {item.obs && <p className="gift-obs">{item.obs}</p>}

        {precisaDeLink && (
          <div className="needs-link-aviso">
            <span>Os links deste presente saíram do ar. Cadastre um novo.</span>
            <button onClick={() => handlers.handleEditItem(item)} className="btn-small bg-info">Adicionar link</button>
          </div>
        )}

        <div className="gift-footer">
          <div className="stores-list">
            {storeLinks.map((link, idx) => {
              const sInfo = getStoreStyle(link) || { name: "Visitar Loja", className: "store-gen" };
              return (
                <a
                  key={idx}
                  href={isLocked ? undefined : link}
                  target={isLocked ? undefined : "_blank"}
                  rel={isLocked ? undefined : "noreferrer"}
                  className={`store-btn ${sInfo.className} ${isLocked ? "locked" : ""}`}
                  onClick={isLocked ? (e) => e.preventDefault() : undefined}
                >
                  <StoreIcon url={link} /> {sInfo.name}
                </a>
              );
            })}
          </div>

          <div className="gift-actions">
            {isOwner ? (
              <>
                <button onClick={() => handlers.handleToggleArchive(item)} className="btn-archive">
                  {item.isArchived ? <><ArchiveRestore size={16} /> Restaurar</> : <><Archive size={16} /> Arquivar</>}
                </button>
                <button onClick={() => handlers.handleEditItem(item)} className="btn-small bg-info">Editar</button>
                <button onClick={() => handlers.handleOwnerUnmark(item.id)} className="btn-small bg-error">Não ganhei</button>
                <button onClick={() => handlers.handleMarkReceived(item.id)} className="btn-small bg-success">Já ganhei</button>
              </>
            ) : isGifted ? (
              isGiver ? (
                <button onClick={() => handlers.handleUnmarkGift(item)} className="btn-small bg-error">Desmarcar (você vai dar)</button>
              ) : (
                <span className="gift-claimed">Já vão dar ({item.giftedBy})</span>
              )
            ) : (
              <button onClick={() => handlers.handleMarkGiftClick(item.id)} className="btn-claim">
                {item.isGroup ? "Vou dar esta opção!" : "Vou dar este presente!"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
