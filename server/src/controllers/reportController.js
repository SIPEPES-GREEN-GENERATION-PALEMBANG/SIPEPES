const ReportModel = require('../models/reportModel');
const { generateTrackingCode } = require('../utils/trackingCode');
const { processAndUploadPhoto } = require('../utils/uploader');
const { successResponse, errorResponse } = require('../utils/response');

/**
 * Handler POST /api/v1/reports
 * Mengirim laporan pencemaran baru warga + upload bukti foto
 */
const createReport = async (req, res, next) => {
  try {
    const {
      title,
      description,
      latitude,
      longitude,
      district,
      address_landmark,
      pollution_type,
      estimated_severity,
      reporter_name,
      reporter_phone,
      river_segment_id,
    } = req.body;

    // 1. Kompresi & Upload Foto Bukti
    const { photoUrl, thumbnailUrl } = await processAndUploadPhoto(
      req.file.buffer,
      req.file.originalname,
      'reports'
    );

    // 2. Buat Tracking Code Unik
    const trackingCode = generateTrackingCode();

    // 3. Simpan ke Database
    const reportData = {
      tracking_code: trackingCode,
      reporter_name: reporter_name && reporter_name.trim() !== '' ? reporter_name.trim() : 'Warga Peduli',
      reporter_phone: reporter_phone ? reporter_phone.trim() : null,
      title: title.trim(),
      description: description.trim(),
      photo_url: photoUrl,
      thumbnail_url: thumbnailUrl,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      address_landmark: address_landmark ? address_landmark.trim() : null,
      district: district.trim(),
      pollution_type,
      estimated_severity,
      river_segment_id: river_segment_id || null,
    };

    const createdReport = await ReportModel.create(reportData);

    return successResponse(
      res,
      'Laporan berhasil dikirim dan sedang menunggu verifikasi admin.',
      {
        id: createdReport.id,
        tracking_code: createdReport.tracking_code,
        status: createdReport.status || 'menunggu',
        created_at: createdReport.created_at,
      },
      undefined,
      201
    );
  } catch (err) {
    next(err);
  }
};

/**
 * Handler GET /api/v1/reports
 * Mengambil daftar titik pencemaran tervalidasi untuk peta dan katalog publik
 */
const getPublicReports = async (req, res, next) => {
  try {
    const { severity, district, start_date, end_date } = req.query;

    const reports = await ReportModel.findPublic({
      severity,
      district,
      start_date,
      end_date,
    });

    return successResponse(
      res,
      'Berhasil memuat titik pencemaran',
      reports,
      { total: reports.length }
    );
  } catch (err) {
    next(err);
  }
};

/**
 * Handler GET /api/v1/reports/track/:code
 * Melacak status laporan berdasarkan Tracking Code
 */
const getReportByTrackingCode = async (req, res, next) => {
  try {
    const { code } = req.params;

    if (!code || code.trim() === '') {
      return errorResponse(res, 'Kode tiket pelacakan wajib disertakan.', null, 400);
    }

    const report = await ReportModel.findByTrackingCode(code.trim().toUpperCase());

    if (!report) {
      return errorResponse(
        res,
        `Laporan dengan kode tiket "${code}" tidak ditemukan. Pastikan format penulisan benar (misal: SPP-202611-0001).`,
        null,
        404
      );
    }

    return successResponse(
      res,
      'Status laporan berhasil ditemukan',
      report
    );
  } catch (err) {
    next(err);
  }
};

/**
 * Handler GET /api/v1/reports/search
 * Mencari laporan alternatif bagi warga yang lupa kode tiket
 * Filter: phone ATAU (district + date)
 */
const searchReports = async (req, res, next) => {
  try {
    const { phone, district, date } = req.query;

    if (!phone && !district && !date) {
      return errorResponse(
        res,
        'Masukkan nomor WhatsApp atau pilih kecamatan dan tanggal untuk melakukan pencarian tiket.',
        null,
        400
      );
    }

    const rawReports = await ReportModel.findReportsBySearch({
      phone: phone ? phone.trim() : null,
      district: district ? district.trim() : null,
      date: date ? date.trim() : null,
    });

    // Sanitasi privasi nomor kontak pelapor (FR-2 & Privacy Guard)
    const sanitizedReports = (rawReports || []).map((r) => {
      let maskedPhone = null;
      if (r.reporter_phone && r.reporter_phone.length >= 7) {
        const p = r.reporter_phone.trim();
        maskedPhone = `${p.slice(0, 4)}****${p.slice(-3)}`;
      }

      return {
        id: r.id,
        tracking_code: r.tracking_code,
        title: r.title,
        description: r.description,
        district: r.district,
        address_landmark: r.address_landmark,
        pollution_type: r.pollution_type,
        estimated_severity: r.estimated_severity,
        status: r.status || 'menunggu',
        photo_url: r.photo_url,
        thumbnail_url: r.thumbnail_url || r.photo_url,
        reporter_phone_masked: maskedPhone,
        created_at: r.created_at,
      };
    });

    return successResponse(
      res,
      `Ditemukan ${sanitizedReports.length} laporan yang cocok`,
      sanitizedReports,
      { total: sanitizedReports.length }
    );
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createReport,
  getPublicReports,
  getReportByTrackingCode,
  searchReports,
};
