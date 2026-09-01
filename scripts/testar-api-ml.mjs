/**
 * Valida as credenciais do Mercado Livre usadas pelo /api/extrair.
 *
 * Uso (com ML_CLIENT_ID e ML_CLIENT_SECRET no ambiente ou no .env.local):
 *   node scripts/testar-api-ml.mjs
 *   node scripts/testar-api-ml.mjs MLB6229538278
 */
import fs from 'node:fs';

const ML_API = 'https://api.mercadolibre.com';

// carrega o .env.local sem depender de pacote externo
for (const arquivo of ['.env.local', '.env']) {
    if (!fs.existsSync(arquivo)) continue;
    for (const linha of fs.readFileSync(arquivo, 'utf8').split('\n')) {
        const par = linha.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
        if (par && !process.env[par[1]]) process.env[par[1]] = par[2].replace(/^["']|["']$/g, '');
    }
}

const { ML_CLIENT_ID, ML_CLIENT_SECRET, ML_REFRESH_TOKEN } = process.env;

if (!ML_CLIENT_ID || !ML_CLIENT_SECRET) {
    console.error('Defina ML_CLIENT_ID e ML_CLIENT_SECRET (no ambiente ou no .env.local).');
    process.exit(1);
}

const corpo = new URLSearchParams({
    grant_type: ML_REFRESH_TOKEN ? 'refresh_token' : 'client_credentials',
    client_id: ML_CLIENT_ID,
    client_secret: ML_CLIENT_SECRET,
});
if (ML_REFRESH_TOKEN) corpo.set('refresh_token', ML_REFRESH_TOKEN);

console.log(`1) POST /oauth/token (grant_type=${corpo.get('grant_type')})`);
const respostaToken = await fetch(`${ML_API}/oauth/token`, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
    body: corpo,
});
const dadosToken = await respostaToken.json();

if (!respostaToken.ok || !dadosToken.access_token) {
    console.error(`   FALHOU (HTTP ${respostaToken.status}):`, dadosToken);
    console.error(
        '\n   Se o erro for "unsupported_grant_type" ou "invalid_client", seu app nao aceita\n' +
        '   client_credentials: gere um refresh_token pelo fluxo de autorizacao e defina ML_REFRESH_TOKEN.'
    );
    process.exit(1);
}
console.log(`   OK - token valido por ${dadosToken.expires_in}s`);

// O ML nao libera /items/{id} de terceiros (403 access_denied), entao os dados
// saem do catalogo: /products/{id} traz nome e foto, /products/{id}/items o preco.
const productId = process.argv[2] || 'MLBU789105008';
const cabecalhos = { Authorization: `Bearer ${dadosToken.access_token}`, accept: 'application/json' };

console.log(`2) GET /products/${productId} (nome e foto)`);
const respostaProduto = await fetch(`${ML_API}/products/${productId}`, { headers: cabecalhos });
const produto = respostaProduto.ok ? await respostaProduto.json() : null;
console.log(
    produto?.name
        ? `   OK -> ${produto.name} | foto: ${produto.pictures?.[0]?.secure_url || '(sem foto)'}`
        : `   sem dados (HTTP ${respostaProduto.status}) - normal em link de anuncio (/up/), o nome vem do slug`
);

console.log(`3) GET /products/${productId}/items (preco)`);
const respostaOfertas = await fetch(`${ML_API}/products/${productId}/items`, { headers: cabecalhos });
const ofertas = respostaOfertas.ok ? await respostaOfertas.json() : null;
const preco = ofertas?.results?.[0]?.price;

if (!preco) {
    console.error(`   FALHOU (HTTP ${respostaOfertas.status}):`, ofertas ?? (await respostaOfertas.text()));
    process.exit(1);
}
console.log(`   OK -> R$ ${preco}`);
console.log('\nTudo certo. Configure as mesmas variaveis na Vercel (Settings > Environment Variables).');
