# :rocket: Lista de Presentes

<p align="center">
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black" alt="Firebase" />
  <img src="https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
</p>

> Uma aplicação web para criação e gerenciamento de listas de presentes personalizadas, com sincronização em tempo real e autenticação. Vá direto ao ponto!

## :clipboard: Tabela de Conteúdos
- [Sobre](#-sobre)
- [Features](#-features)
- [Tecnologias Utilizadas](#-tecnologias-utilizadas)
- [Como Rodar](#-como-rodar)
- [Licença](#-licença)
- [Contato](#-contato)

---

## :package: Preenchimento automatico (scraper)

O endpoint `GET /api/extrair?url=<link>` le nome, preco e foto de links do
Mercado Livre, Amazon e KaBuM!.

**Amazon e KaBuM!** funcionam sem nenhuma configuracao.

**Mercado Livre:** o ML responde com a pagina de "trafego suspeito" para
requisicoes vindas de IPs de datacenter, entao em producao (Vercel) a leitura do
HTML nunca funciona. Nesse caso a rota cai para a API oficial, que exige um app
gratuito criado em [developers.mercadolivre.com.br](https://developers.mercadolivre.com.br):

```
ML_CLIENT_ID=...
ML_CLIENT_SECRET=...
```

O que da para obter pela API (o `GET /items/{id}` de terceiros e bloqueado pelo
proprio ML, com `403 access_denied`):

| Dado | Origem | Disponivel |
| --- | --- | --- |
| Preco | `/products/{id}/items` | sim |
| Nome | `/products/{id}` ou o slug do proprio link | sim |
| Foto | `/products/{id}` | so em links de catalogo (`/p/`) |

Quando algum campo nao vem, a resposta traz um `aviso` e o app avisa o que falta
preencher a mao. Valide as credenciais com `node scripts/testar-api-ml.mjs` antes
de configurar as mesmas variaveis na Vercel (Settings > Environment Variables).

---

## :book: Sobre
Este projeto foi criado com a motivação de facilitar a organização e o compartilhamento de listas de presentes para eventos e ocasiões especiais. Ele entrega valor ao permitir que os usuários criem suas listas de forma intuitiva e sincronizada.

---

## :sparkles: Features
O projeto conta com diversas funcionalidades pensadas para a melhor experiência:
- [x] **Preenchimento Automático:** Adicione o link de um produto e o sistema busca nome, preço e foto automaticamente (Web Scraper).
- [x] **Variações de Produtos:** Crie itens com múltiplas opções (ex: cores diferentes) navegáveis via carrossel.
- [x] **Organização Visual (Drag and Drop):** Reordene os itens facilmente arrastando e soltando.
- [x] **Filtros e Ordenação:** Filtre por categoria e ordene por prioridade ou valor (opção de ocultar presentes já marcados).
- [x] **Reserva de Presentes:** Convidados podem fazer login pelo Google e marcar o que vão dar, evitando presentes repetidos.
- [x] **Arquivamento:** Oculte itens antigos ou que já foram ganhos movendo-os para a aba de arquivados.
- [x] **Compartilhamento Fácil:** Copie o código da lista ou compartilhe direto pelo botão integrado.

---

## :computer: Tecnologias Utilizadas
As principais ferramentas, linguagens e bibliotecas usadas na construção do projeto:
- [React](https://reactjs.org/)
- [Next.js](https://nextjs.org/)
- [Firebase](https://firebase.google.com/)
- [dnd-kit](https://dndkit.com/)
- [Lucide React](https://lucide.dev/)

---

## :rocket: Como Rodar

### Pré-requisitos
Antes de começar, você vai precisar ter instalado na sua máquina o [Node.js](https://nodejs.org/en/) e o [Git](https://git-scm.com/). Além disso, é bom ter um editor para trabalhar com o código, como o [VSCode](https://code.visualstudio.com/).

### Instalação e Execução

```bash
# Clone este repositório
$ git clone https://github.com/Lintzz/lista-de-presentes.git

# Acesse a pasta do projeto no terminal
$ cd lista-de-presentes

# Crie uma cópia do arquivo .env.example para o arquivo .env
$ cp .env.example .env
# (Lembre-se de preencher as chaves corretas do Firebase no arquivo .env)

# Instale as dependências
$ npm install

# Execute a aplicação em modo de desenvolvimento
$ npm run dev
```

---

## :page_facing_up: Licença
Este projeto está sob a licença [MIT](LICENSE).

---

## :telephone_receiver: Contato
Alexandre Lintz - [alexandrelintz.1999@gmail.com](mailto:alexandrelintz.1999@gmail.com)

GitHub: [Lintzz](https://github.com/Lintzz)
