// Avatar reutilizado pelo header e pelo perfil.
// Com foto: mostra a imagem. Sem foto: círculo com gradiente e a inicial do nome.
export function Avatar({ src, name, size = 30, fontSize }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";

  if (src) {
    return (
      <img
        src={src}
        alt={name || "Avatar"}
        className="avatar-img"
        style={{ width: size, height: size, borderRadius: "999px", objectFit: "cover", flexShrink: 0 }}
      />
    );
  }

  return (
    <span
      className="avatar-fallback"
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: fontSize || Math.round(size * 0.42) }}
    >
      {initial}
    </span>
  );
}
