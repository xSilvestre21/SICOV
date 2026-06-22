# SICOV - Sistema de Controle de Vendas

Sistema web completo para gestão comercial de representação e revenda de embalagens plásticas industriais. Automatiza o fluxo de vendas desde o cadastro de clientes e fornecedores até a geração de pedidos, orçamentos e cálculo de comissões.

## Funcionalidades

- **Gestão de Pedidos**: criação, edição, cancelamento, reativação, exclusão, envio ao fornecedor, duplicação e geração de PDF
- **Orçamentos**: produtos cadastrados ou ad-hoc, conversão em pedido, histórico de edições, PDF
- **Comissões**: cálculo automático por pedido, parcelamento, valores reais vs. previstos
- **Dashboard**: 7 gráficos interativos com filtros globais (faturamento, comissões, desempenho, cancelados, fornecedores, top clientes)
- **Motor de Cálculo**: 6 modos (dimensões×densidade×fator, peso×preço/kg, qtd×preço, caixas, palete, manual) com faixas de peso e extras
- **Controle de Acesso**: admin (acesso total) e representantes (acesso restrito aos seus clientes)
- **Modo Escuro**: claro, escuro e automático com persistência
- **Responsivo**: funciona em desktop, tablet e celular
- **Segurança**: JWT, Argon2, rate limiting, CORS, Helmet, logout por inatividade

## Tecnologias

### Backend
- Node.js + Express 5
- MongoDB + Mongoose
- JWT (autenticação)
- Argon2 (hash de senhas)
- PDFKit (geração de PDF)
- Nodemailer (emails)
- Pino (logging)

### Frontend
- React 18 + Vite
- Tailwind CSS
- Recharts (gráficos)
- Lucide Icons
- Axios + React Router

### Infraestrutura
- Render (hospedagem)
- MongoDB Atlas (banco de dados)
- GitHub (CI/CD)

## Requisitos

- Node.js 18+
- MongoDB (local ou Atlas)
- NPM ou Yarn

## Instalação

```bash
# Clonar repositório
git clone https://github.com/xSilvestre21/SICOV.git
cd SICOV

# Instalar dependências do backend
npm install

# Instalar dependências do frontend
cd SICOV-WEB
npm install
cd ..

# Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas credenciais
```

## Variáveis de Ambiente

```env
PORT=3000
MONGO_URI=mongodb+srv://...
JWT_SECRET=seu_segredo_jwt
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5173
FRONTEND_URL=http://localhost:5173
ADMIN_REGISTER_SECRET=segredo_para_criar_admin

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu_email@gmail.com
SMTP_PASS=sua_senha_de_app
SMTP_FROM="SICOV" <seu_email@gmail.com>
```

## Execução

```bash
# Desenvolvimento (backend + frontend separados)
npm run dev          # Backend na porta 3000
cd SICOV-WEB && npx vite  # Frontend na porta 5173

# Produção (build + serve)
npm run build        # Compila o frontend
npm start            # Serve backend + frontend na porta 3000
```

## Testes

```bash
npm test                    # Todos os testes
npm run test:unit           # Unitários (587 testes)
npm run test:integration    # Integração (210 testes)
npm run test:coverage       # Com relatório de cobertura
```

## Scripts Úteis

```bash
node scripts/create-admin.js          # Criar usuário admin
node scripts/backup.js                # Exportar banco (JSON.gz)
node scripts/restore.js <arquivo>     # Restaurar backup
node scripts/change-email.js          # Alterar email de usuário
node scripts/update-snapshots.js      # Atualizar códigos nos pedidos
```

## Deploy (Render)

- **Build Command**: `npm install && cd SICOV-WEB && npm install && npx vite build`
- **Start Command**: `npm start`
- Configurar variáveis de ambiente no painel do Render
- Deploy automático a cada push na branch `main`

## Estrutura do Projeto

```
├── app.js                 # Configuração Express
├── server.js              # Ponto de entrada
├── src/
│   ├── controllers/       # Lógica de negócio
│   ├── models/            # Schemas MongoDB
│   ├── routes/            # Endpoints da API
│   ├── services/          # Agregações do dashboard
│   ├── middlewares/       # Auth, isAdmin, rateLimiter
│   └── utils/             # PDF, cálculos, email
├── SICOV-WEB/             # Frontend React
│   ├── src/
│   │   ├── pages/         # Páginas por módulo
│   │   ├── components/    # Componentes reutilizáveis
│   │   ├── contexts/      # Auth, Theme, Dashboard
│   │   └── hooks/         # Custom hooks
│   └── public/            # Assets (logos)
├── scripts/               # Manutenção
└── tests/                 # Testes automatizados
```

## API

Todos os endpoints estão sob o prefixo `/api`:

| Módulo | Endpoints |
|--------|-----------|
| Auth | `POST /api/auth/login`, `/register-admin`, `/refresh`, `/forgot-password`, `/reset-password`, `/change-password` |
| Users | `GET/POST/PUT/PATCH/DELETE /api/users/representatives` |
| Clients | `GET/POST/PUT/PATCH/DELETE /api/clients` |
| Suppliers | `GET/POST/PUT/PATCH/DELETE /api/suppliers` |
| Products | `GET/POST/PUT/PATCH/DELETE /api/products` |
| Orders | `GET/POST/PUT/PATCH/DELETE /api/orders` |
| Quotations | `GET/POST/PUT/DELETE /api/quotations` |
| Commissions | `GET/PATCH /api/commissions` |
| Dashboard | `GET /api/dashboard/*` |
| Settings | `GET/PUT /api/settings` |

## Autor

**Gustavo Silvestre** - Desenvolvido como projeto de TCC em Ciência da Computação.

## Licença

ISC
