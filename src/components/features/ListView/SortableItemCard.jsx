import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Archive, ArchiveRestore, ChevronLeft, ChevronRight } from "lucide-react";
import { StoreIcon, getStoreStyle } from "../../ui/StoreIcon";

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

  return (
    <div ref={setNodeRef} style={style} className={`gift-card ${isDragging ? "dragging" : ""} ${isGifted && !isOwner && !isGiver ? "gifted" : ""}`}>
      {isDragEnabled && (
        <div {...attributes} {...listeners} className="drag-handle">
          <GripVertical size={20} />
        </div>
      )}

      <div className="gift-img-wrapper">
        {displayImage ? (
          <img src={displayImage} alt={displayName} className="gift-img" />
        ) : (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'var(--color-text-muted)' }}>Sem imagem</div>
        )}
        
        {/* Badge de Categoria Fixa */}
        <div className="gift-badge">{item.category}</div>

        {/* Setas do Carrossel e Contador de Opções */}
        {hasVariations && item.variations.length > 1 && (
          <>
            <button onClick={handlePrev} className="carousel-btn left"><ChevronLeft size={20} /></button>
            <button onClick={handleNext} className="carousel-btn right"><ChevronRight size={20} /></button>
            <div className="carousel-indicator">
              Opção {varIndex + 1} de {item.variations.length}
            </div>
          </>
        )}
      </div>

      <div className="gift-details">
        <div className="gift-title-row">
          <h3 className="gift-name">
            {displayName}
            {item.size && <span className="tag-size">Tam: {item.size}</span>}
            {item.voltage && <span className="tag-volt">{item.voltage}</span>}
          </h3>
          <div className="gift-price-box">
            {displayPrice && <span className="gift-price">R$ {displayPrice}</span>}
            <span className={`tag-prio ${item.priority === "Alta" ? "prio-high" : item.priority === "Média" ? "prio-med" : "prio-low"}`}>
              {item.priority}
            </span>
          </div>
        </div>

        <p className="gift-obs">Obs: {item.obs || "Nenhuma."}</p>

        {/* Renderização condicional dos links: Se tiver variações exibe o link da variação atual, senão exibe os 3 links principais */}
        <div className="stores-list">
          {hasVariations ? (
             currentVariation && currentVariation.link && (
                <a 
                  href={isLocked ? undefined : currentVariation.link} 
                  target={isLocked ? undefined : "_blank"} 
                  rel={isLocked ? undefined : "noreferrer"} 
                  className={`store-btn ${getStoreStyle(currentVariation.link)?.className || "store-gen"}`}
                  style={isLocked ? { pointerEvents: 'none', filter: 'grayscale(100%)', opacity: 0.6 } : {}}
                  onClick={isLocked ? (e) => e.preventDefault() : undefined}
                >
                  <StoreIcon url={currentVariation.link} /> {getStoreStyle(currentVariation.link)?.name || "Ver Loja"}
                </a>
             )
          ) : (
             [item.link1, item.link2, item.link3].filter(Boolean).map((link, idx) => {
               const sInfo = getStoreStyle(link) || { name: "Visitar Loja", className: "store-gen" };
               return (
                 <a 
                   key={idx} 
                   href={isLocked ? undefined : link} 
                   target={isLocked ? undefined : "_blank"} 
                   rel={isLocked ? undefined : "noreferrer"} 
                   className={`store-btn ${sInfo.className}`}
                   style={isLocked ? { pointerEvents: 'none', filter: 'grayscale(100%)', opacity: 0.6 } : {}}
                   onClick={isLocked ? (e) => e.preventDefault() : undefined}
                 >
                   <StoreIcon url={link} /> {sInfo.name}
                 </a>
               );
             })
          )}
        </div>

        <div className="gift-footer">
          {isOwner ? (
            <div style={{display:'flex', gap:'0.5rem', width:'100%', justifyContent:'space-between', flexWrap:'wrap'}}>
              <button onClick={() => handlers.handleToggleArchive(item)} style={{display:'flex', alignItems:'center', gap:'0.25rem', background:'transparent', border:'none', color:'var(--color-text-muted)', cursor:'pointer', fontSize:'0.875rem'}}>
                {item.isArchived ? <><ArchiveRestore size={16} /> Restaurar</> : <><Archive size={16} /> Arquivar</>}
              </button>
              <div style={{display:'flex', gap:'0.5rem', flexWrap:'wrap'}}>
                <button onClick={() => handlers.handleEditItem(item)} className="btn-small bg-info">Editar</button>
                <button onClick={() => handlers.handleOwnerUnmark(item.id)} className="btn-small bg-error">Não ganhei</button>
                <button onClick={() => handlers.handleMarkReceived(item.id)} className="btn-small bg-success">Já ganhei</button>
              </div>
            </div>
          ) : (
            <>
              {isGifted ? (
                isGiver ? (
                  <button onClick={() => handlers.handleUnmarkGift(item)} className="btn-small bg-error" style={{border:'1px solid var(--color-border)'}}>Desmarcar (Você vai dar)</button>
                ) : (
                  <span style={{fontSize:'0.875rem', fontWeight:'700', padding:'0.5rem', backgroundColor:'var(--color-page-bg)', border:'1px solid var(--color-border)', borderRadius:'0.25rem'}}>Já vão dar ({item.giftedBy})</span>
                )
              ) : (
                <button onClick={() => handlers.handleMarkGiftClick(item.id)} className="btn-primary" style={{backgroundColor:'var(--color-success-bg)', color:'var(--color-success-text)'}}>
                  {item.isGroup ? "Vou dar esta opção!" : "Vou dar este presente!"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
