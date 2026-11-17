const ReportModel = require('../models/reportModel');
const { generateUniqueTrackingCode, generateTrackingCode } = require('../utils/trackingCode');
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
      reporter_contact,
      river_segment_id,
    } = req.body;

    const contactPhone = (reporter_phone || reporter_contact || '').trim() || null;

    // 1. Kompresi & Upload Foto Bukti
    const { photoUrl, thumbnailUrl } = await processAndUploadPhoto(
      req.file.buffer,
      req.file.originalname,
      'reports'
    );

    // 2. Buat Tracking Code Unik yang Ramah Warga (MUSI-XXXX)
    const trackingCode = await generateUniqueTrackingCode();

    // 3. Simpan ke Database
    const reportData = {
      tracking_code: trackingCode,
      reporter_name: reporter_name && reporter_name.trim() !== '' ? reporter_name.trim() : 'Warga Peduli',
      reporter_phone: contactPhone,
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
        `Laporan dengan kode tiket "${code}" tidak ditemukan. Pastikan format penulisan benar (misal: MUSI-4821 atau SPP-202611-0001).`,
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
 * Pencarian alternatif bagi warga yang lupa kode tiket
 * Filter: phone (nomor HP/WA) ATAU district + date
 */
const searchReports = async (req, res, next) => {
  try {
    const { phone, district, date } = req.query;

    if (!phone && !district && !date) {
      return errorResponse(
        res,
        'Mohon masukkan nomor WhatsApp atau pilih kecamatan dan tanggal untuk melakukan pencarian.',
        null,
        400
      );
    }

    const reports = await ReportModel.searchReports({ phone, district, date });

    // Sanitasi privasi: samarkan nomor telepon pelapor (contoh: 0812****882)
    const sanitizedReports = reports.map((r) => {
      let maskedPhone = null;
      if (r.reporter_phone) {
        const clean = r.reporter_phone.trim();
        if (clean.length > 6) {
          maskedPhone = `${clean.slice(0, 4)}****${clean.slice(-3)}`;
        } else {
          maskedPhone = '******';
        }
      }

      return {
        id: r.id,
        tracking_code: r.tracking_code,
        title: r.title,
        description: r.description,
        category: r.pollution_type,
        pollution_type: r.pollution_type,
        estimated_severity: r.estimated_severity,
        status: r.status,
        district: r.district,
        address_landmark: r.address_landmark,
        photo_url: r.photo_url,
        thumbnail_url: r.thumbnail_url,
        created_at: r.created_at,
        reporter_name: r.reporter_name || 'Warga Peduli',
        reporter_phone_masked: maskedPhone,
      };
    });

    return successResponse(
      res,
      `Ditemukan ${sanitizedReports.length} laporan yang cocok.`,
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
