import * as cheerio from 'cheerio';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const UA_DESKTOP =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const UA_BOT = 'WhatsApp/2.21.12.21 A';

const SITES = {
    mercadolivre: ['mercadolivre.com.br', 'mercadolivre.com', 'mercadolibre.com'],
    amazon: ['amazon.com.br', 'amazon.com'],
    kabum: ['kabum.com.br'],
};

function identificarSite(hostname) {
    const host = hostname.toLowerCase();
    for (const [site, dominios] of Object.entries(SITES)) {
        if (dominios.some((d) => host === d || host.endsWith('.' + d))) return site;
    }
    return null;
}

// "R$ 1.234,56" | "1234.56" | 1234.56  ->  "1234.56"
function normalizarPreco(valor) {
    if (valor === null || valor === undefined) return '';
    if (typeof valor === 'number') return Number.isFinite(valor) ? String(valor) : '';

    let texto = String(valor).replace(/[^\d.,]/g, '').trim();
    if (!texto) return '';

    const temVirgula = texto.includes(',');
    const temPonto = texto.includes('.');

    if (temVirgula && temPonto) {
        // o último separador que aparece é o decimal
        texto = texto.lastIndexOf(',') > texto.lastIndexOf('.')
            ? texto.replace(/\./g, '').replace(',', '.')
            : texto.replace(/,/g, '');
    } else if (temVirgula) {
        texto = texto.replace(/\./g, '').replace(',', '.');
    } else if (temPonto) {
        // "1.234" é separador de milhar; "1234.56" é decimal
        const partes = texto.split('.');
        if (partes.length > 2 || partes[partes.length - 1].length === 3) {
            texto = texto.replace(/\./g, '');
        }
    }

    const numero = parseFloat(texto);
    return Number.isFinite(numero) && numero > 0 ? String(numero) : '';
}

// Alguns sites (ex: Amazon) gravam entidades HTML dentro do JSON-LD.
function decodificarTexto(texto) {
    if (!texto || !texto.includes('&')) return texto || '';
    return cheerio.load(`<span>${texto}</span>`)('span').text().trim();
}

function absolutizar(url, base) {
    if (!url) return '';
    try {
        const absoluta = new URL(url, base);
        // a Amazon devolve imagens com "carimbos" concatenados depois da extensão
        const limpa = absoluta.href.match(/^(.*?\.(?:jpg|jpeg|png|webp))(?:_|\?|$)/i);
        return limpa ? limpa[1] : absoluta.href;
    } catch {
        return '';
    }
}

// Percorre todo o JSON-LD da página procurando um nó do tipo Product.
function extrairJsonLd($) {
    const fila = [];
    $('script[type="application/ld+json"]').each((_, el) => {
        const bruto = $(el).contents().text();
        if (!bruto) return;
        try {
            fila.push(JSON.parse(bruto));
        } catch {
            /* JSON-LD malformado: ignora */
        }
    });

    while (fila.length) {
        const no = fila.shift();
        if (Array.isArray(no)) {
            fila.push(...no);
            continue;
        }
        if (!no || typeof no !== 'object') continue;

        const tipos = [].concat(no['@type'] || []);
        const ehProduto =
            tipos.some((t) => String(t).toLowerCase() === 'product') || (no.offers && no.name);

        if (ehProduto) {
            const oferta = [].concat(no.offers || [])[0] || {};
            const imagem = Array.isArray(no.image) ? no.image[0] : no.image;
            return {
                nome: typeof no.name === 'string' ? no.name.trim() : '',
                preco: normalizarPreco(oferta.price ?? oferta.lowPrice ?? oferta.highPrice),
                foto: typeof imagem === 'string' ? imagem : '',
            };
        }

        fila.push(...Object.values(no));
    }

    return { nome: '', preco: '', foto: '' };
}

function extrairOpenGraph($) {
    const ogTitle = $('meta[property="og:title"]').attr('content') || '';
    return {
        // o og:title do Mercado Livre costuma vir como "Produto - R$ 300,54"
        nome: ogTitle.split(/\s+-\s+R\$/)[0].trim(),
        preco: normalizarPreco(
            $('meta[property="product:price:amount"]').attr('content') ||
                $('meta[itemprop="price"]').attr('content') ||
                $('[itemprop="price"]').attr('content')
        ),
        foto:
            $('meta[property="og:image"]').attr('content') ||
            $('meta[name="twitter:image"]').attr('content') ||
            '',
    };
}

function extrairDom($, site) {
    if (site === 'mercadolivre') {
        const fracao = $('.andes-money-amount__fraction').first().text().trim();
        const centavos = $('.andes-money-amount__cents').first().text().trim();
        const imgEl = $('.ui-pdp-image.ui-pdp-gallery__figure__image').first();
        return {
            nome: $('.ui-pdp-title').first().text().trim(),
            preco: fracao ? normalizarPreco(`${fracao}${centavos ? ',' + centavos : ''}`) : '',
            foto: imgEl.attr('data-zoom') || imgEl.attr('src') || '',
        };
    }

    if (site === 'amazon') {
        const inteiro = $('.a-price-whole').first().text().trim();
        const fracao = $('.a-price-fraction').first().text().trim();
        return {
            nome: $('#productTitle').text().trim(),
            preco:
                normalizarPreco($('.a-price .a-offscreen').first().text()) ||
                (inteiro ? normalizarPreco(`${inteiro}${fracao ? ',' + fracao : ',00'}`) : ''),
            foto: $('#landingImage').attr('src') || $('#imgBlkFront').attr('src') || '',
        };
    }

    if (site === 'kabum') {
        return {
            nome: $('h1').first().text().trim(),
            preco: normalizarPreco($('h4').first().text()),
            foto: '',
        };
    }

    return { nome: '', preco: '', foto: '' };
}

// Mescla as fontes na ordem de confiança, campo a campo.
function mesclar(...fontes) {
    const resultado = { nome: '', preco: '', foto: '' };
    for (const fonte of fontes) {
        for (const campo of ['nome', 'preco', 'foto']) {
            if (!resultado[campo] && fonte?.[campo]) resultado[campo] = fonte[campo];
        }
    }
    return resultado;
}

// O Mercado Livre responde HTTP 200 com uma página de "tráfego suspeito"
// quando a requisição vem de um IP de datacenter (ex: servidores da Vercel).
function ehMuroAntiBot(urlFinal, html) {
    return (
        /\/gz\/account-verification|\/gz\/security|captcha/i.test(urlFinal) ||
        /suspicious-traffic-frontend|Trafego suspeito|tráfego suspeito/i.test(html.slice(0, 4000))
    );
}

const ML_API = 'https://api.mercadolibre.com';

// Extrai o id do anuncio (MLB...) e o do produto de catalogo (MLB.../MLBU...)
// a partir das formas de URL que o Mercado Livre usa.
function extrairIdsMercadoLivre(...urls) {
    const ids = { itemId: '', productId: '' };
    const fila = urls.filter(Boolean);

    while (fila.length) {
        const bruta = fila.shift();
        let url;
        try {
            url = new URL(bruta);
        } catch {
            continue;
        }

        // a página de bloqueio carrega o destino original em ?go=
        const destino = url.searchParams.get('go');
        if (destino) fila.push(destino);

        const texto = decodeURIComponent(url.href);

        // /MLB-6229538278-slug-_JM  ou  ?item_id=MLB6229538278
        ids.itemId ||= (texto.match(/\/(ML[A-Z])-?(\d{6,})-/) || []).slice(1).join('') || '';
        ids.itemId ||= (texto.match(/item_id[=:](ML[A-Z]\d{6,})/i) || [])[1] || '';

        // /p/MLB19338097  ou  /up/MLBU789105008
        ids.productId ||= (texto.match(/\/u?p\/(ML[A-Z]U?\d{6,})/) || [])[1] || '';
    }

    return ids;
}

let tokenEmCache = { valor: '', expiraEm: 0 };

async function obterTokenMercadoLivre() {
    const agora = Date.now();
    if (tokenEmCache.valor && agora < tokenEmCache.expiraEm) return tokenEmCache.valor;

    if (process.env.ML_ACCESS_TOKEN) return process.env.ML_ACCESS_TOKEN;

    const clientId = process.env.ML_CLIENT_ID;
    const clientSecret = process.env.ML_CLIENT_SECRET;
    if (!clientId || !clientSecret) return '';

    const corpo = new URLSearchParams({
        grant_type: process.env.ML_REFRESH_TOKEN ? 'refresh_token' : 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
    });
    if (process.env.ML_REFRESH_TOKEN) corpo.set('refresh_token', process.env.ML_REFRESH_TOKEN);

    const resposta = await fetch(`${ML_API}/oauth/token`, {
        method: 'POST',
        cache: 'no-store',
        headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
        body: corpo,
    });

    if (!resposta.ok) {
        console.error('Mercado Livre: falha ao obter token', resposta.status, await resposta.text());
        return '';
    }

    const dados = await resposta.json();
    if (!dados.access_token) return '';

    // renova um minuto antes de expirar
    tokenEmCache = {
        valor: dados.access_token,
        expiraEm: agora + Math.max((dados.expires_in || 21600) - 60, 60) * 1000,
    };
    return tokenEmCache.valor;
}

async function consultarApiMercadoLivre(caminho, token) {
    const resposta = await fetch(`${ML_API}${caminho}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
    });
    if (!resposta.ok) {
        console.error('Mercado Livre: falha na API', caminho, resposta.status);
        return null;
    }
    return resposta.json();
}

// O proprio link carrega o nome do produto no slug; é o ultimo recurso quando a
// API nao expoe o titulo (anuncios de vendedor, fora do catalogo).
function nomeDoSlug(...urls) {
    const fila = urls.filter(Boolean);

    while (fila.length) {
        const bruta = fila.shift();
        let caminho;
        try {
            const url = new URL(bruta);
            // a página de bloqueio carrega o link original em ?go=
            const destino = url.searchParams.get('go');
            if (destino) fila.push(destino);
            caminho = decodeURIComponent(url.pathname);
        } catch {
            continue;
        }

        for (const segmento of caminho.split('/').filter(Boolean)) {
            if (/^(p|up|sec|gz|social)$/i.test(segmento)) continue;
            if (/^ML[A-Z]U?\d+$/i.test(segmento)) continue;

            const palavras = segmento
                .replace(/^ML[A-Z]-?\d+-/i, '')
                .replace(/-_JM$/i, '')
                .split('-')
                .filter(Boolean);

            if (palavras.length < 3) continue;
            return palavras.map((p) => p[0].toUpperCase() + p.slice(1)).join(' ');
        }
    }
    return '';
}

// Usada quando o scraping do Mercado Livre esbarra no muro anti-bot. A API nao
// libera /items/{id} de terceiros, entao os dados vem do catalogo:
//   /products/{id}        -> nome e fotos (apenas links de catalogo, /p/)
//   /products/{id}/items  -> preco da oferta vencedora
async function buscarNoMercadoLivrePelaApi(ids, urlsParaSlug) {
    const resultado = { nome: '', preco: '', foto: '' };
    const token = ids.productId ? await obterTokenMercadoLivre() : '';

    if (token) {
        const produto = await consultarApiMercadoLivre(`/products/${ids.productId}`, token);
        if (produto?.name) {
            resultado.nome = produto.name;
            resultado.foto = produto.pictures?.[0]?.secure_url || produto.pictures?.[0]?.url || '';
        }

        const ofertas = await consultarApiMercadoLivre(`/products/${ids.productId}/items`, token);
        const oferta = ofertas?.results?.[0];
        resultado.preco =
            normalizarPreco(oferta?.price) || normalizarPreco(produto?.buy_box_winner?.price);
    }

    if (!resultado.nome) resultado.nome = nomeDoSlug(...urlsParaSlug);
    if (!resultado.nome && !resultado.preco) return null;

    const faltando = [!resultado.nome && 'o nome', !resultado.preco && 'o preço', !resultado.foto && 'a foto']
        .filter(Boolean)
        .join(' e ');
    if (faltando) {
        resultado.aviso = `O Mercado Livre não deixa o servidor ler a página. Preenchi o que a API oficial libera — ${faltando} você precisa completar.`;
    }

    return resultado;
}

async function buscarHtml(url, userAgent) {
    return fetch(url, {
        redirect: 'follow',
        cache: 'no-store',
        headers: {
            'User-Agent': userAgent,
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            'Upgrade-Insecure-Requests': '1',
        },
    });
}

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const urlDoProduto = searchParams.get('url');

    if (!urlDoProduto) {
        return NextResponse.json({ erro: 'URL não fornecida' }, { status: 400 });
    }

    let alvo;
    try {
        alvo = new URL(urlDoProduto.trim());
        if (!/^https?:$/.test(alvo.protocol)) throw new Error('protocolo inválido');
    } catch {
        return NextResponse.json({ erro: 'Link inválido.' }, { status: 400 });
    }

    if (!identificarSite(alvo.hostname)) {
        return NextResponse.json(
            { erro: 'Site não suportado. Por favor, cole um link do Mercado Livre, Amazon ou KaBuM!.' },
            { status: 400 }
        );
    }

    try {
        let response = await buscarHtml(alvo.href, UA_DESKTOP);
        let html = await response.text();

        // Algumas páginas só entregam as meta tags para crawlers de preview.
        if (!response.ok || !/og:title|ld\+json/.test(html)) {
            const alternativa = await buscarHtml(alvo.href, UA_BOT);
            if (alternativa.ok) {
                const htmlAlternativo = await alternativa.text();
                if (/og:title|ld\+json/.test(htmlAlternativo)) {
                    response = alternativa;
                    html = htmlAlternativo;
                }
            }
        }

        if (!response.ok) {
            return NextResponse.json(
                { erro: `A loja bloqueou a consulta (HTTP ${response.status}). Preencha manualmente.` },
                { status: 502 }
            );
        }

        // Links curtos (mercadolivre.com/sec/...) redirecionam para o domínio real,
        // então o site é reavaliado a partir da URL final.
        const urlFinal = response.url || alvo.href;
        const site = identificarSite(new URL(urlFinal).hostname);
        if (!site) {
            return NextResponse.json(
                { erro: 'Site não suportado. Por favor, cole um link do Mercado Livre, Amazon ou KaBuM!.' },
                { status: 400 }
            );
        }

        const bloqueado = ehMuroAntiBot(urlFinal, html);

        let resultado = { nome: '', preco: '', foto: '' };
        if (!bloqueado) {
            const $ = cheerio.load(html);
            resultado = mesclar(extrairJsonLd($), extrairOpenGraph($), extrairDom($, site));
            resultado.nome = decodificarTexto(resultado.nome);
            resultado.foto = absolutizar(resultado.foto, urlFinal);
        }

        const vazio = !resultado.nome && !resultado.preco && !resultado.foto;

        // Fallback oficial: a API do Mercado Livre nao depende do IP de origem.
        if (site === 'mercadolivre' && vazio) {
            const urls = [urlFinal, alvo.href];
            const viaApi = await buscarNoMercadoLivrePelaApi(extrairIdsMercadoLivre(...urls), urls);
            if (viaApi) {
                viaApi.foto = absolutizar(viaApi.foto, urlFinal);
                return NextResponse.json(viaApi);
            }
        }

        if (bloqueado) {
            return NextResponse.json(
                {
                    erro:
                        'O Mercado Livre bloqueou a consulta automática vinda do servidor. ' +
                        'Preencha os dados manualmente por enquanto.',
                },
                { status: 502 }
            );
        }

        if (vazio) {
            return NextResponse.json(
                { erro: 'Não encontrei os dados do produto nessa página. Confira se o link é de um produto.' },
                { status: 422 }
            );
        }

        return NextResponse.json(resultado);
    } catch (error) {
        console.error('Erro ao extrair:', error);
        return NextResponse.json({ erro: 'Falha ao acessar o link da loja.' }, { status: 500 });
    }
}
