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

const itemId = process.argv[2] || 'MLB6229538278';
console.log(`2) GET /items/${itemId}`);
const respostaItem = await fetch(`${ML_API}/items/${itemId}`, {
    headers: { Authorization: `Bearer ${dadosToken.access_token}`, accept: 'application/json' },
});
const item = await respostaItem.json();

if (!respostaItem.ok) {
    console.error(`   FALHOU (HTTP ${respostaItem.status}):`, item);
    process.exit(1);
}

console.log('   OK ->', {
    nome: item.title,
    preco: item.price,
    foto: item.pictures?.[0]?.secure_url || item.secure_thumbnail,
});
console.log('\nTudo certo. Configure as mesmas variaveis na Vercel (Settings > Environment Variables).');
