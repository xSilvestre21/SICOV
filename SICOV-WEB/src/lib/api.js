import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
});

// Injeta o token JWT em todas as requisições
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sicov_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Flag para evitar múltiplas tentativas de refresh simultâneas
let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
}

// Interceptor de resposta: tenta refresh token quando recebe 401
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config;

    // Se não é 401 ou já tentou refresh, rejeita normalmente
    if (err.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(err);
    }

    // Se é a rota de login/refresh, apenas rejeita (não tenta refresh)
    if (originalRequest.url?.includes('/auth/')) {
      return Promise.reject(err);
    }

    // Se já está fazendo refresh, enfileira a requisição
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      });
    }

    // Tenta renovar o token
    const refreshToken = localStorage.getItem('sicov_refreshToken');
    if (!refreshToken) {
      // Sem refresh token — apenas rejeita (ProtectedRoute vai redirecionar)
      return Promise.reject(err);
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const { data } = await axios.post('/api/auth/refresh', { refreshToken });
      const newToken = data.token;
      localStorage.setItem('sicov_token', newToken);
      processQueue(null, newToken);
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api(originalRequest);
    } catch (refreshErr) {
      processQueue(refreshErr, null);
      // Não redireciona aqui — deixa o ProtectedRoute/AuthContext cuidar
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;
