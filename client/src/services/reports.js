import apiClient from './api';

// Pemetaan dua arah label UI vs Database Enum (Gap 3)
export const POLLUTION_TYPE_MAP = {
  minyak_oli: 'Limbah Minyak / B3',
  sampah_domestik: 'Sampah Plastik / Domestik',
  limbah_industri: 'Limbah Industri',
  lainnya: 'Lainnya / Gulma',
};

export const SEVERITY_LABEL_MAP = {
  ringan: 'Ringan',
  sedang: 'Sedang',
  berat: 'Berat',
};

export const reportsService = {
  /**
   * Submit Laporan Baru Warga + Upload Foto (Multipart Form Data)
   * @param {Object} data - Field laporan
   * @param {File|Blob} photoFile - Berkas foto hasil kompresi
   */
  async createReport(data, photoFile) {
    const formData = new FormData();

    if (photoFile) {
      formData.append('photo', photoFile, photoFile.name || 'foto-laporan.webp');
    }

    formData.append('title', data.title || '');
    formData.append('description', data.description || '');
    formData.append('latitude', String(data.latitude));
    formData.append('longitude', String(data.longitude));
    formData.append('district', data.district || '');
    formData.append('pollution_type', data.pollution_type || 'sampah_domestik');
    formData.append('estimated_severity', data.estimated_severity || 'sedang');

    if (data.address_landmark) {
      formData.append('address_landmark', data.address_landmark);
    }
    if (data.reporter_name) {
      formData.append('reporter_name', data.reporter_name);
    }
    if (data.reporter_contact) {
      formData.append('reporter_contact', data.reporter_contact);
    }
    if (typeof data.is_anonymous !== 'undefined') {
      formData.append('is_anonymous', String(data.is_anonymous));
    }

    return await apiClient.post('/reports', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  /**
   * Ambil Titik Peta & Daftar Laporan Tervalidasi (Publik Warga)
   * @param {Object} params - { district, severity, from, to }
   */
  async getPublicReports(params = {}) {
    return await apiClient.get('/reports', { params });
  },

  /**
   * Lacak Status Laporan via Tracking Code (Publik Warga)
   * @param {string} trackingCode
   */
  async trackReport(trackingCode) {
    const cleanCode = (trackingCode || '').trim();
    return await apiClient.get(`/reports/track/${encodeURIComponent(cleanCode)}`);
  },

  /**
   * Ambil Daftar Laporan Admin (Filter status, search, pagination)
   * @param {Object} params - { status, severity, district, search, page, limit }
   */
  async getAdminReports(params = {}) {
    return await apiClient.get('/admin/reports', { params });
  },

  /**
   * Ambil Detail Laporan Admin berdasarkan ID
   * @param {string} id
   */
  async getReportById(id) {
    return await apiClient.get(`/admin/reports/${id}`);
  },

  /**
   * Verifikasi Laporan oleh Admin (Ubah status ke valid/ditolak + audit log)
   * @param {string} id
   * @param {Object} payload - { status: 'valid'|'ditolak', official_severity, notes }
   */
  async verifyReport(id, payload) {
    return await apiClient.patch(`/admin/reports/${id}/verify`, payload);
  },

  /**
   * Unduh Berkas Rekapitulasi (PDF atau Excel)
   * @param {'pdf'|'excel'} format
   * @param {Object} filters - { district, severity, status, startDate, endDate }
   */
  async exportReports(format = 'pdf', filters = {}) {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1';
    const token = localStorage.getItem('sipepes_admin_token');

    const params = new URLSearchParams({
      format,
      ...filters,
    });

    const response = await fetch(`${apiBaseUrl}/admin/reports/export?${params.toString()}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Gagal mengunduh berkas rekapitulasi (${response.statusText})`);
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;

    const timestamp = new Date().toISOString().slice(0, 10);
    const ext = format === 'excel' ? 'xlsx' : 'pdf';
    link.download = `Rekap_SIPEPES_GGP_${timestamp}.${ext}`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);

    return { success: true };
  },

  /**
   * Ringkasan Statistik Metrik Dashboard Admin
   */
  async getStatsSummary() {
    return await apiClient.get('/stats/summary');
  },

  /**
   * Tren Mingguan & Komposisi Kategori
   */
  async getStatsTrends() {
    return await apiClient.get('/stats/trends');
  },

  /**
   * Master Data Segmen Sungai Musi
   */
  async getRiverSegments() {
    return await apiClient.get('/river-segments');
  },
};

export default reportsService;
