import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
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

    // Se não é 401 ou já tentou refresh, rejeita
    if (err.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(err);
    }

    // Se é a rota de login/refresh, não tenta refresh
    if (originalRequest.url?.includes('/auth/')) {
      localStorage.removeItem('sicov_token');
      localStorage.removeItem('sicov_refreshToken');
      localStorage.removeItem('sicov_user');
      window.location.href = '/login';
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

    originalRequest._retry = true;
    isRefreshing = true;

    const refreshToken = localStorage.getItem('sicov_refreshToken');
    if (!refreshToken) {
      localStorage.removeItem('sicov_token');
      localStorage.removeItem('sicov_user');
      window.location.href = '/login';
      return Promise.reject(err);
    }

    try {
      const { data } = await axios.post('/api/auth/refresh', { refreshToken });
      const newToken = data.token;
      localStorage.setItem('sicov_token', newToken);
      processQueue(null, newToken);
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api(originalRequest);
    } catch (refreshErr) {
      processQueue(refreshErr, null);
      localStorage.removeItem('sicov_token');
      localStorage.removeItem('sicov_refreshToken');
      localStorage.removeItem('sicov_user');
      window.location.href = '/login';
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;
