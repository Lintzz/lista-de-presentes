export const getDomain = (url) => { try { return new URL(url).hostname.replace("www.", ""); } catch (e) { return null; } };

export const StoreIcon = ({ url }) => {
  const domain = getDomain(url);
  if (!domain) return <span style={{fontSize:'12px'}}>🌐</span>;
  return <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`} alt="icon" style={{width:'20px', height:'20px', borderRadius:'4px', backgroundColor:'var(--color-white)', padding:'1px'}} onError={(e) => (e.target.style.display = "none")} />;
};

export const getStoreStyle = (url) => {
  if (!url) return null;
  const lowerUrl = url.toLowerCase();
  const domain = getDomain(url);

  if (lowerUrl.includes("mercadolivre")) return { name: "Mercado Livre", className: "store-ml" };
  if (lowerUrl.includes("amazon")) return { name: "Amazon", className: "store-amz" };
  if (lowerUrl.includes("shopee")) return { name: "Shopee", className: "store-shp" };
  if (lowerUrl.includes("magazineluiza")) return { name: "Magalu", className: "store-mgl" };

  const siteName = domain ? domain.split(".")[0].charAt(0).toUpperCase() + domain.split(".")[0].slice(1) : "Visitar Loja";
  return { name: siteName, className: "store-gen" };
};
