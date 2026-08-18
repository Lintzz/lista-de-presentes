import * as cheerio from 'cheerio';
import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const urlDoProduto = searchParams.get('url');

    if (!urlDoProduto) {
        return NextResponse.json({ erro: 'URL não fornecida' }, { status: 400 });
    }

    try {
        console.log('🚀 Recebido link:', urlDoProduto);
        
        let dominio;
        try {
            dominio = new URL(urlDoProduto).hostname.toLowerCase();
        } catch (e) {
            return NextResponse.json({ erro: 'Link inválido.' }, { status: 400 });
        }

        if (!dominio.includes('mercadolivre.com.br') && 
            !dominio.includes('amazon.com.br') && 
            !dominio.includes('kabum.com.br')) {
            console.log('❌ Site não suportado:', dominio);
            return NextResponse.json({ 
                erro: 'Site não suportado. Por favor, cole um link do Mercado Livre, Amazon ou KaBuM!.' 
            }, { status: 400 });
        }

        // Fetching with a modern user-agent (WhatsApp) to bypass Mercado Livre basic anti-bot blocks
        const response = await fetch(urlDoProduto, {
            headers: {
                'User-Agent': 'WhatsApp/2.21.12.21 A',
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            }
        });

        const html = await response.text();
        const $ = cheerio.load(html);

        let resultado = { nome: "", preco: "", foto: "" };

        // MERCADO LIVRE
        if (dominio.includes('mercadolivre.com.br')) {
            console.log('🔍 Extraindo do Mercado Livre...');
            const tituloHtml = $('.ui-pdp-title').first().text().trim();
            const tituloOg = $('meta[property="og:title"]').attr('content') || "";
            // As vezes o og:title tem " - R$ XX" no final, podemos limpar
            const titulo = tituloHtml || tituloOg.split(' - R$')[0].trim();

            const precoMeta = $('meta[itemprop="price"]').attr('content');
            const precoFração = $('.andes-money-amount__fraction').first().text().trim();
            const precoOg = $('meta[property="product:price:amount"]').attr('content');
            const precoFinal = precoOg || precoMeta || precoFração;

            const imgElement = $('.ui-pdp-image.ui-pdp-gallery__figure__image').first();
            const imgHtml = imgElement.attr('data-zoom') || imgElement.attr('src');
            const imgOg = $('meta[property="og:image"]').attr('content');
            const imagem = imgHtml || imgOg || "";

            resultado = { nome: titulo, preco: precoFinal, foto: imagem };
        } 
        
        // AMAZON
        else if (dominio.includes('amazon.com.br')) {
            console.log('🔍 Extraindo da Amazon...');
            const titulo = $('#productTitle').text().trim();
            const precoInteiro = $('.a-price-whole').first().text().replace(/[\n\r,.]/g, '').trim();
            const precoFracao = $('.a-price-fraction').first().text().trim();
            const imagem = $('#landingImage').attr('src') || $('#imgBlkFront').attr('src') || "";
            
            let precoFinal = "";
            if (precoInteiro) {
                precoFinal = precoInteiro + (precoFracao ? "," + precoFracao : ",00");
            }

            resultado = { nome: titulo, preco: precoFinal, foto: imagem };
        }

        // KABUM
        else if (dominio.includes('kabum.com.br')) {
            console.log('🔍 Extraindo da KaBuM!...');
            const titulo = $('h1').text().trim();
            const preco = $('h4').first().text().replace('R$', '').trim();
            const imagem = $('meta[property="og:image"]').attr('content') || "";

            resultado = { nome: titulo, preco: preco, foto: imagem };
        }

        return NextResponse.json(resultado);

    } catch (error) {
        console.error('❌ Erro:', error.message);
        return NextResponse.json({ erro: 'Falha ao extrair dados' }, { status: 500 });
    }
}
