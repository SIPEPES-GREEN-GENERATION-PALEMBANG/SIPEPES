const crypto = require('crypto');

/**
 * Generate Unique Tracking Code dengan format ramah warga: MUSI-XXXX
 * Contoh: MUSI-4821
 * @returns {string}
 */
const generateTrackingCode = () => {
  const randomSuffix = crypto.randomInt(1000, 9999); // 4 digit angka acak unik
  return `MUSI-${randomSuffix}`;
};

module.exports = {
  generateTrackingCode,
};
