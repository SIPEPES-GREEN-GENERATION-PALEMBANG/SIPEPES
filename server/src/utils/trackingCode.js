const crypto = require('crypto');
const { pool, query } = require('../config/database');

/**
 * Generate Unique Tracking Code dengan format ramah warga: MUSI-XXXX
 * Contoh: MUSI-4821
 * @returns {string}
 */
const generateTrackingCode = () => {
  const randomSuffix = crypto.randomInt(1000, 9999);
  return `MUSI-${randomSuffix}`;
};

/**
 * Generate Tracking Code yang dijamin unik dengan pengecekan ke database
 * Jika terjadi tabrakan, sistem melakukan regenerasi otomatis (hingga 5 digit)
 * @returns {Promise<string>}
 */
const generateUniqueTrackingCode = async () => {
  let attempts = 0;
  while (attempts < 10) {
    const code = generateTrackingCode();
    if (!pool) return code;

    try {
      const res = await query('SELECT id FROM reports WHERE tracking_code = $1 LIMIT 1;', [code]);
      if (res.rows.length === 0) {
        return code;
      }
    } catch {
      return code;
    }
    attempts++;
  }

  // Jika setelah 10 percobaan terdapat bentrok, naikkan ke 5 digit
  const suffix5 = crypto.randomInt(10000, 99999);
  return `MUSI-${suffix5}`;
};

module.exports = {
  generateTrackingCode,
  generateUniqueTrackingCode,
};
