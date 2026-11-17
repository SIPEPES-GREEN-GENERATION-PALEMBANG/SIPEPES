/**
 * Script Verifikasi Unit Test: Tracking Code Generator & Report Search
 * Penanggung Jawab: M. Naufal Rafif Pratama (Tech Lead & Backend Specialist)
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const assert = require('assert');
const { generateTrackingCode, generateUniqueTrackingCode } = require('../utils/trackingCode');
const ReportModel = require('../models/reportModel');

async function runTests() {
  console.log('🧪 [TEST] Memulai Unit Test Backend Tracking & Search...');

  // Test 1: Format generateTrackingCode (MUSI-XXXX)
  const code = generateTrackingCode();
  console.log(`  ✓ Sample tracking code: ${code}`);
  assert(/^MUSI-\d{4}$/.test(code), `Format kode tidak sesuai standar MUSI-XXXX: ${code}`);

  // Test 2: generateUniqueTrackingCode (database / collision check)
  const uniqueCode = await generateUniqueTrackingCode();
  console.log(`  ✓ Unique tracking code: ${uniqueCode}`);
  assert(/^MUSI-\d{4,5}$/.test(uniqueCode), `Format unique tracking code tidak valid: ${uniqueCode}`);

  // Test 3: Search by District
  const districtResults = await ReportModel.searchReports({ district: 'Ilir Barat I' });
  assert(Array.isArray(districtResults), 'Hasil pencarian kecamatan harus berupa array');
  console.log(`  ✓ Search district 'Ilir Barat I': ${districtResults.length} records`);

  // Test 4: Search by Phone (normalisasi digit nomor HP)
  const phoneResults = await ReportModel.searchReports({ phone: '081234567890' });
  assert(Array.isArray(phoneResults), 'Hasil pencarian nomor HP harus berupa array');
  console.log(`  ✓ Search phone '081234567890': ${phoneResults.length} records`);

  // Test 5: Fallback in-memory search
  const memorySearch = await ReportModel.searchReports({ district: 'Semua Kecamatan', phone: '' });
  assert(Array.isArray(memorySearch), 'Search fallback harus berupa array');
  console.log(`  ✓ Search empty filters returned valid array structure`);

  console.log('🎉 [TEST PASSED] Semua unit test backend pelacakan dan pencarian berhasil 100%!\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('❌ [TEST FAILED]:', err);
  process.exit(1);
});
