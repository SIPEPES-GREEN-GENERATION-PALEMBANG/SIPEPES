import axios from 'axios';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 15000,
  headers: {
    'Accept': 'application/json',
  },
});

// Interceptor Request: Tambahkan token JWT bila tersedia
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('sipepes_admin_token');
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor Response: Ekstrak data dan standardisasi pesan error
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const responseData = error.response?.data;
    const message = responseData?.message || error.message || 'Terjadi kesalahan jaringan.';
    const status = error.response?.status;
    const errors = responseData?.errors || [];

    // Jika token kedaluwarsa atau tidak valid (401), bersihkan sesi
    if (status === 401) {
      localStorage.removeItem('sipepes_admin_token');
      localStorage.removeItem('sipepes_admin_user');
    }

    const enhancedError = new Error(message);
    enhancedError.status = status;
    enhancedError.errors = errors;
    enhancedError.originalError = error;
    return Promise.reject(enhancedError);
  }
);

export default apiClient;
