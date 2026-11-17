/**
 * Device Reports Storage Helper - SIPEPES v2.0
 * Mengelola riwayat tiket pelaporan warga yang dibuat di browser/perangkat ini.
 * Memungkinkan pelacakan instan tanpa memerlukan pendaftaran/login akun.
 * Disimpan di localStorage dengan batas maksimal 10 tiket terakhir.
 */

const STORAGE_KEY = 'sipepes_warga_my_reports';
const MAX_SAVED_REPORTS = 10;

/**
 * Mengambil semua tiket laporan yang tersimpan di perangkat ini.
 * @returns {Array<Object>} Daftar laporan lokal terurut dari yang terbaru
 */
export function getDeviceReports() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('⚠️ Gagal membaca riwayat tiket dari localStorage:', err);
    return [];
  }
}

/**
 * Menyimpan tiket laporan baru ke riwayat perangkat ini.
 * @param {Object} report Objek data laporan yang baru dikirimkan
 * @returns {Array<Object>} Daftar laporan lokal terbaru
 */
export function saveDeviceReport(report) {
  if (!report || !report.tracking_code) return getDeviceReports();

  try {
    const existing = getDeviceReports();

    const categoryNameMap = {
      minyak_oli: 'Limbah Minyak / B3',
      sampah_domestik: 'Sampah Plastik',
      limbah_industri: 'Limbah Industri',
      lainnya: 'Lainnya / Gulma'
    };
    const cleanCategory =
      categoryNameMap[report.category] ||
      categoryNameMap[report.pollution_type] ||
      (report.category && !report.category.includes('_') ? report.category : 'Limbah Sempadan Musi');

    // Normalisasi struktur data agar konsisten
    const reportItem = {
      id: report.id || `local-${Date.now()}`,
      tracking_code: report.tracking_code,
      title: report.title || 'Laporan Pencemaran Sungai Musi',
      category: cleanCategory,
      pollution_type: report.pollution_type || 'sampah_domestik',
      estimated_severity: report.estimated_severity || report.severity || 'sedang',
      district: report.district || 'Palembang',
      address_landmark: report.address_landmark || '',
      status: report.status || 'menunggu',
      created_at: report.created_at || new Date().toISOString(),
      photo_url: report.photo_url || report.photoPreview || null,
      thumbnail_url: report.thumbnail_url || report.photo_url || null
    };

    // Hapus duplikat kode jika sudah pernah ada
    const filtered = existing.filter(
      (item) => item.tracking_code.toUpperCase() !== report.tracking_code.toUpperCase()
    );

    // Tambahkan di posisi paling depan dan batasi maksimal 10
    const updated = [reportItem, ...filtered].slice(0, MAX_SAVED_REPORTS);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn('⚠️ Gagal menyimpan tiket ke localStorage:', err);
    return getDeviceReports();
  }
}

/**
 * Menghapus satu tiket tertentu dari riwayat perangkat ini.
 * @param {string} trackingCode Kode tiket yang ingin dihapus
 * @returns {Array<Object>} Daftar laporan lokal setelah dihapus
 */
export function removeDeviceReport(trackingCode) {
  if (!trackingCode) return getDeviceReports();

  try {
    const existing = getDeviceReports();
    const updated = existing.filter(
      (item) => item.tracking_code.toUpperCase() !== trackingCode.trim().toUpperCase()
    );

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn('⚠️ Gagal menghapus tiket dari localStorage:', err);
    return getDeviceReports();
  }
}

/**
 * Menghapus seluruh riwayat tiket di perangkat ini (opsi privasi warnet/perangkat publik).
 */
export function clearDeviceReports() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('⚠️ Gagal membersihkan riwayat tiket:', err);
  }
}
