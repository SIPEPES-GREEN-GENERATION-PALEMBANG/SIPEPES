import { initialReports, mockAdminUser } from '../data/mockReports';

const STORAGE_KEY = 'sipepes_admin_reports_v2';

function getStoredReports() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return initialReports;
    }
  }
  return initialReports;
}

function saveReports(reports) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

export const mockAdapter = {
  async createReport(data, photoFile) {
    await new Promise(r => setTimeout(r, 600));
    const reports = getStoredReports();
    const trackingCode = `SPP-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(Math.floor(1000 + Math.random() * 9000))}`;

    const newReport = {
      id: `rep-${Date.now()}`,
      tracking_code: trackingCode,
      title: data.title || 'Laporan Pencemaran Sungai',
      description: data.description || '',
      category: data.pollution_type || 'sampah_domestik',
      pollution_type: data.pollution_type || 'sampah_domestik',
      estimated_severity: data.estimated_severity || 'sedang',
      latitude: parseFloat(data.latitude) || -2.9909,
      longitude: parseFloat(data.longitude) || 104.7565,
      district: data.district || 'Ilir Barat I',
      address_landmark: data.address_landmark || 'Sempadan Sungai Musi',
      photo_url: photoFile ? URL.createObjectURL(photoFile) : 'https://images.unsplash.com/photo-1618477388954-7852f32655ec?auto=format&fit=crop&w=800&q=80',
      status: 'menunggu',
      created_at: new Date().toISOString(),
      reporter_name: data.reporter_name || 'Warga Peduli Musi',
      reporter_contact: data.reporter_contact || '',
      is_anonymous: Boolean(data.is_anonymous),
      reporter_source: 'Via Portal Pelaporan Warga',
    };

    reports.unshift(newReport);
    saveReports(reports);
    return { success: true, message: 'Laporan berhasil dibuat', data: newReport };
  },

  async getPublicReports(params = {}) {
    await new Promise(r => setTimeout(r, 300));
    const reports = getStoredReports();
    let filtered = reports.filter(r => r.status === 'valid' || r.status === 'terverifikasi');

    if (params.district && params.district !== 'all') {
      filtered = filtered.filter(r => r.district === params.district);
    }
    if (params.severity && params.severity !== 'all') {
      filtered = filtered.filter(r => (r.official_severity || r.estimated_severity) === params.severity);
    }

    return { success: true, data: filtered };
  },

  async trackReport(trackingCode) {
    await new Promise(r => setTimeout(r, 400));
    const reports = getStoredReports();
    const cleanCode = (trackingCode || '').trim().toUpperCase();
    const found = reports.find(r => (r.tracking_code || '').toUpperCase() === cleanCode);

    if (!found) {
      const err = new Error(`Laporan dengan kode tiket '${cleanCode}' tidak ditemukan.`);
      err.status = 404;
      throw err;
    }

    return { success: true, data: found };
  },

  async getAdminReports(params = {}) {
    await new Promise(r => setTimeout(r, 300));
    const reports = getStoredReports();
    let filtered = [...reports];

    if (params.status && params.status !== 'all') {
      filtered = filtered.filter(r => r.status === params.status);
    }
    if (params.severity && params.severity !== 'all') {
      filtered = filtered.filter(r => (r.official_severity || r.estimated_severity) === params.severity);
    }
    if (params.district && params.district !== 'all') {
      filtered = filtered.filter(r => r.district === params.district);
    }
    if (params.search) {
      const q = params.search.toLowerCase();
      filtered = filtered.filter(r =>
        (r.title || '').toLowerCase().includes(q) ||
        (r.tracking_code || '').toLowerCase().includes(q) ||
        (r.district || '').toLowerCase().includes(q)
      );
    }

    return {
      success: true,
      data: {
        reports: filtered,
        pagination: {
          total: filtered.length,
          page: 1,
          limit: filtered.length,
          totalPages: 1,
        },
      },
    };
  },

  async verifyReport(id, { status, official_severity, notes }) {
    await new Promise(r => setTimeout(r, 400));
    const reports = getStoredReports();
    const idx = reports.findIndex(r => String(r.id) === String(id));
    if (idx === -1) {
      const err = new Error(`Laporan dengan ID '${id}' tidak ditemukan.`);
      err.status = 404;
      throw err;
    }

    reports[idx] = {
      ...reports[idx],
      status,
      official_severity: official_severity || reports[idx].estimated_severity,
      admin_notes: notes || '',
      verified_at: new Date().toISOString(),
      verified_by: mockAdminUser.full_name,
    };

    saveReports(reports);
    return { success: true, message: 'Status laporan berhasil diperbarui', data: reports[idx] };
  },

  async login(email, password) {
    await new Promise(r => setTimeout(r, 400));
    if (
      (email === 'admin@sipepes.com' && password === 'admin123') ||
      (email === 'admin@sipepes.or.id' && password === 'admin123') ||
      (email && password)
    ) {
      localStorage.setItem('sipepes_admin_token', 'mock_jwt_token_admin_musilaban_2026');
      localStorage.setItem('sipepes_admin_user', JSON.stringify(mockAdminUser));
      return { success: true, data: { token: 'mock_jwt_token_admin_musilaban_2026', user: mockAdminUser } };
    }
    const err = new Error('Kombinasi Email dan password tidak valid');
    err.status = 400;
    throw err;
  },
};

export default mockAdapter;
