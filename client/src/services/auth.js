import apiClient from './api';

export const authService = {
  /**
   * Login Admin Komunitas GG River Care
   * @param {string} email
   * @param {string} password
   */
  async login(email, password) {
    const res = await apiClient.post('/auth/login', { email, password });
    if (res.success && res.data?.token) {
      localStorage.setItem('sipepes_admin_token', res.data.token);
      localStorage.setItem('sipepes_admin_user', JSON.stringify(res.data.user));
    }
    return res;
  },

  /**
   * Ambil data profil admin aktif
   */
  async getMe() {
    return await apiClient.get('/auth/me');
  },

  /**
   * Keluar dari sesi admin
   */
  logout() {
    localStorage.removeItem('sipepes_admin_token');
    localStorage.removeItem('sipepes_admin_user');
  },

  /**
   * Ambil data user admin dari localStorage
   */
  getStoredUser() {
    const raw = localStorage.getItem('sipepes_admin_user');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  /**
   * Ambil token admin dari localStorage
   */
  getStoredToken() {
    return localStorage.getItem('sipepes_admin_token');
  },

  /**
   * Cek apakah admin sedang terotentikasi
   */
  isAuthenticated() {
    return Boolean(localStorage.getItem('sipepes_admin_token'));
  },
};

export default authService;
