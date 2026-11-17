const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { upload } = require('../utils/uploader');
const { validateReportInput } = require('../middleware/validator');

// 1. Submit Laporan Baru + Foto Bukti (Publik Warga)
router.post(
  '/',
  upload.single('photo'),
  validateReportInput,
  reportController.createReport
);

// 2. Ambil Titik Peta & Daftar Laporan Tervalidasi (Publik Warga)
router.get('/', reportController.getPublicReports);

// 3. Pencarian Alternatif (Warga Lupa Kode Tiket - via No. HP atau Kecamatan + Tanggal)
router.get('/search', reportController.searchReports);

// 4. Lacak Status Laporan via Tracking Code Unik (Publik Warga)
router.get('/track/:code', reportController.getReportByTrackingCode);

module.exports = router;
