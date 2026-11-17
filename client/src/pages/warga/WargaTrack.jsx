import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  MapPin,
  Calendar,
  Share2,
  Copy,
  Check,
  ArrowRight,
  ExternalLink,
  Plus,
  Trash2,
  HelpCircle,
  Phone,
  X,
  Info
} from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import { getDeviceReports, removeDeviceReport, clearDeviceReports } from '../../lib/deviceReports';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Badge from '../../components/Badge';
import Toast from '../../components/Toast';
import reportsService from '../../services/reports';

const categoryLabelMap = {
  minyak_oli: 'Limbah Minyak / B3',
  sampah_domestik: 'Sampah Plastik',
  limbah_industri: 'Limbah Industri',
  lainnya: 'Lainnya / Gulma'
};

const getReportCategory = (report) => {
  if (!report) return 'Limbah Sempadan Musi';
  const val = report.category || report.pollution_type;
  if (!val) return 'Limbah Sempadan Musi';
  if (categoryLabelMap[val]) return categoryLabelMap[val];
  if (typeof val === 'string' && val.includes('_')) {
    return categoryLabelMap[val.toLowerCase()] || val.replace(/_/g, ' ');
  }
  return val;
};

export default function WargaTrack() {
  const { reports } = useAdmin();
  const { kode: paramKode } = useParams();
  const navigate = useNavigate();

  const [inputCode, setInputCode] = useState(paramKode || '');
  const [activeCode, setActiveCode] = useState(paramKode || '');
  const [apiReport, setApiReport] = useState(null);
  const [isSearchingApi, setIsSearchingApi] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Riwayat Tiket di Perangkat Ini (Jaring Pengaman FR-2)
  const [deviceReports, setDeviceReports] = useState(() => getDeviceReports());

  // Modal "Lupa Kode Tiket" State
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [searchTab, setSearchTab] = useState('phone'); // 'phone' | 'district'
  const [searchPhone, setSearchPhone] = useState('');
  const [searchDistrict, setSearchDistrict] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState('');

  // 18 Kecamatan Kota Palembang
  const districtList = [
    'Seberang Ulu I',
    'Seberang Ulu II',
    'Ilir Barat I',
    'Ilir Barat II',
    'Ilir Timur I',
    'Ilir Timur II',
    'Ilir Timur III',
    'Jakabaring',
    'Kertapati',
    'Plaju',
    'Gandus',
    'Kalidoni',
    'Sako',
    'Sematang Borang',
    'Sukarami',
    'Alang-Alang Lebar',
    'Kemuning',
    'Bukit Kecil'
  ];

  // Sinkronisasi dengan URL param jika berubah
  useEffect(() => {
    if (paramKode) {
      setInputCode(paramKode);
      setActiveCode(paramKode);
    } else {
      setInputCode('');
      setActiveCode('');
    }
    // Perbarui riwayat lokal
    setDeviceReports(getDeviceReports());
  }, [paramKode]);

  // Ambil laporan live dari Backend API jika ada activeCode
  useEffect(() => {
    if (!activeCode.trim()) {
      setApiReport(null);
      return;
    }

    let isMounted = true;
    const fetchFromApi = async () => {
      setIsSearchingApi(true);
      try {
        const res = await reportsService.trackReport(activeCode.trim());
        if (isMounted && res.success && res.data) {
          setApiReport(res.data);
        }
      } catch (err) {
        // Fallback ke cache context
      } finally {
        if (isMounted) setIsSearchingApi(false);
      }
    };

    fetchFromApi();
    return () => { isMounted = false; };
  }, [activeCode]);

  // Pencarian Laporan yang Tepat (API Live didahulukan, lalu fallback ke lokal)
  const normalizedSearch = activeCode.trim().toUpperCase();
  const localReport = normalizedSearch
    ? (reports || []).find(
        r => (r.tracking_code && r.tracking_code.toUpperCase() === normalizedSearch) ||
             (r.id && r.id.toUpperCase() === normalizedSearch)
      )
    : null;

  const foundReport = apiReport || localReport;

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (inputCode.trim()) {
      setActiveCode(inputCode.trim());
      navigate(`/lacak/${encodeURIComponent(inputCode.trim())}`, { replace: true });
    }
  };

  const handleCopyCode = () => {
    if (foundReport?.tracking_code && navigator.clipboard) {
      navigator.clipboard.writeText(foundReport.tracking_code);
      setCopied(true);
      setToastMessage('Kode tiket berhasil disalin ke papan klip');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShareWa = () => {
    if (foundReport?.tracking_code) {
      const shareUrl = `${window.location.origin}/lacak/${foundReport.tracking_code}`;
      const text = `Pantau status laporan pencemaran #${foundReport.tracking_code} di SIPEPES GG River Care: ${shareUrl}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }
  };

  // Pilih laporan dari riwayat atau hasil modal cari
  const handleSelectReport = (trackingCode) => {
    setInputCode(trackingCode);
    setActiveCode(trackingCode);
    setForgotModalOpen(false);
    navigate(`/lacak/${encodeURIComponent(trackingCode)}`, { replace: true });
  };

  // Hapus satu tiket dari perangkat lokal
  const handleDeleteDeviceReport = (e, trackingCode) => {
    e.stopPropagation();
    const updated = removeDeviceReport(trackingCode);
    setDeviceReports(updated);
    setToastMessage(`Laporan #${trackingCode} dihapus dari riwayat perangkat`);
  };

  // Bersihkan semua tiket di perangkat lokal
  const handleClearAllDeviceReports = () => {
    clearDeviceReports();
    setDeviceReports([]);
    setToastMessage('Seluruh riwayat tiket di perangkat ini telah dibersihkan');
  };

  // Eksekusi Pencarian Alternatif (Lupa Kode)
  const handlePerformSearch = async (e) => {
    e?.preventDefault();
    setIsSearching(true);
    setSearchError('');
    setSearchResults([]);

    try {
      let cleanPhone = '';
      if (searchTab === 'phone') {
        cleanPhone = searchPhone.replace(/\D/g, '');
        if (!cleanPhone || cleanPhone.length < 4) {
          setSearchError('Masukkan minimal 4 digit nomor WhatsApp/telepon.');
          setIsSearching(false);
          return;
        }
      } else {
        if (!searchDistrict && !searchDate) {
          setSearchError('Pilih kecamatan atau tanggal laporan.');
          setIsSearching(false);
          return;
        }
      }

      let resData = null;
      try {
        const queryParamsObj = {};
        if (searchTab === 'phone') {
          queryParamsObj.phone = cleanPhone;
        } else {
          if (searchDistrict) queryParamsObj.district = searchDistrict;
          if (searchDate) queryParamsObj.date = searchDate;
        }

        const apiRes = await reportsService.searchReports(queryParamsObj);
        if (apiRes && Array.isArray(apiRes.data)) {
          resData = apiRes.data;
        } else if (Array.isArray(apiRes)) {
          resData = apiRes;
        }
      } catch (networkErr) {
        // Fallback jika API backend offline/belum terhubung
      }

      // 2. Fallback pencarian di memori frontend / mock data
      if (!resData) {
        if (searchTab === 'phone') {
          const cleanPhone = searchPhone.replace(/\D/g, '');
          resData = (reports || []).filter(r => {
            const raw = r.reporter_contact || r.reporter_phone || '';
            const repClean = raw.replace(/\D/g, '');
            return repClean.length > 0 && (repClean.includes(cleanPhone.slice(-8)) || cleanPhone.includes(repClean.slice(-8)));
          });
        } else {
          resData = (reports || []).filter(r => {
            let match = true;
            if (searchDistrict && r.district?.toLowerCase() !== searchDistrict.toLowerCase()) match = false;
            if (searchDate && !r.created_at?.startsWith(searchDate)) match = false;
            return match;
          });
        }
      }

      if (!resData || resData.length === 0) {
        setSearchError('Tidak ditemukan laporan yang cocok. Pastikan data yang kamu masukkan sudah sesuai.');
      } else {
        setSearchResults(resData);
      }
    } catch (err) {
      setSearchError('Gagal melakukan pencarian laporan. Silakan coba kembali.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8">
      {toastMessage && (
        <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      )}

      {/* Header Halaman */}
      <div className="space-y-2 text-center sm:text-left">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
          Lacak Status Laporan Pencemaran
        </h1>
        <p className="text-xs sm:text-sm text-ink-soft leading-relaxed">
          Pantau transparansi tindak lanjut laporanmu yang sedang ditangani relawan Green Generation Palembang.
        </p>
      </div>

      {/* Form Input Pencarian Kode Tiket (FR-4) */}
      <Card className="p-4 sm:p-5 space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-2.5">
          <div className="relative flex-1 w-full">
            <Search className="w-5 h-5 text-ink-muted absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              placeholder="Masukkan kode tiket (contoh: MUSI-4821 atau SPP-202611-0012)"
              className="w-full h-12 pl-12 pr-4 bg-slate-50 border border-garis rounded-full text-xs sm:text-sm font-semibold text-ink placeholder:text-ink-muted focus:outline-none focus:border-musi-600 focus:bg-white focus:ring-4 focus:ring-musi-100 transition uppercase tracking-wider"
            />
          </div>

          <Button type="submit" variant="utama" size="md" className="w-full sm:w-auto shrink-0">
            <span>Cek Status</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </form>

        {/* Tautan Jaring Pengaman: Lupa Kode Tiket */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
          <button
            type="button"
            onClick={() => {
              setForgotModalOpen(true);
              setSearchError('');
              setSearchResults([]);
            }}
            className="text-musi-600 hover:text-musi-800 font-bold inline-flex items-center gap-1.5 hover:underline cursor-pointer"
          >
            <HelpCircle className="w-4 h-4" />
            <span>Lupa kode tiketmu? Cari laporanmu di sini</span>
          </button>

          {activeCode && (
            <button
              type="button"
              onClick={() => {
                setActiveCode('');
                setInputCode('');
                navigate('/lacak', { replace: true });
              }}
              className="text-ink-muted hover:text-ink font-semibold cursor-pointer"
            >
              Kembali ke Riwayat Perangkat
            </button>
          )}
        </div>
      </Card>

      {/* ========================================================
          KONDISI 1: KODE TIDAK DITEMUKAN (TIDAK BOLEH NAMPILKAN LAPORAN LAIN)
         ======================================================== */}
      {activeCode && !foundReport && (
        <Card className="text-center p-8 sm:p-12 space-y-4 border-tingkat-berat-bg animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-tingkat-berat-bg text-tingkat-berat-tx flex items-center justify-center mx-auto">
            <XCircle className="w-8 h-8 stroke-[2.2]" />
          </div>

          <div className="space-y-1.5 max-w-md mx-auto">
            <h2 className="text-lg sm:text-xl font-bold text-ink">
              Kode Tiket Tidak Ditemukan
            </h2>
            <p className="text-xs sm:text-sm text-ink-soft leading-relaxed">
              Tidak ada data laporan dengan kode <strong className="font-mono text-ink">{activeCode}</strong>. Pastikan kode yang kamu masukkan sudah benar dan sesuai format (contoh: <span className="font-mono">MUSI-4821</span>).
            </p>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setForgotModalOpen(true);
                setSearchError('');
                setSearchResults([]);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white text-ink text-xs font-bold border border-garis hover:bg-slate-50 transition cursor-pointer"
            >
              <Search className="w-4 h-4 text-musi-600" />
              <span>Cari via No. HP / Wilayah</span>
            </button>

            <Link to="/lapor">
              <Button variant="ajakan" size="md">
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Buat Laporan Baru</span>
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {/* ========================================================
          KONDISI 2: LAPORAN DITEMUKAN BERDASARKAN KODE
         ======================================================== */}
      {foundReport && (
        <div className="space-y-6 animate-fade-in">

          {/* Kartu Status & Kode Tiket */}
          <Card className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-garis">
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                  Kode Tiket Laporan
                </span>
                <div className="text-xl sm:text-2xl font-extrabold text-ink font-mono tracking-wider tabular-nums flex items-center gap-2">
                  <span>{foundReport.tracking_code}</span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="p-1 rounded-lg hover:bg-slate-100 text-ink-muted hover:text-ink transition cursor-pointer"
                    title="Salin kode"
                  >
                    {copied ? <Check className="w-4 h-4 text-toska-800" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Lencana Status Besar */}
              <div>
                <Badge
                  type="status"
                  value={foundReport.status === 'terverifikasi' ? 'valid' : foundReport.status}
                  size="lg"
                />
              </div>
            </div>

            {/* Linimasa 2 Tahap Komunitas Mandiri */}
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-ink-muted block">
                Linimasa Proses Verifikasi
              </span>

              <div className="space-y-4 pl-2 border-l-2 border-garis ml-3">
                {/* Tahap 1: Laporan Diterima */}
                <div className="relative pl-6">
                  <div className="absolute -left-[19px] top-0 w-8 h-8 rounded-full bg-toska-100 text-toska-800 flex items-center justify-center border-2 border-white shadow-xs">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-ink">
                      Laporan Diterima Sistem
                    </h4>
                    <p className="text-xs text-ink-muted mt-0.5">
                      {foundReport.created_at
                        ? new Date(foundReport.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : '10 Nov 2026, 14:22 WIB'}
                    </p>
                    <p className="text-xs text-ink-soft mt-1">
                      Data dan foto bukti tersimpan aman di sistem komunitas GG River Care.
                    </p>
                  </div>
                </div>

                {/* Tahap 2: Peninjauan Relawan */}
                <div className="relative pl-6 pt-2">
                  {foundReport.status === 'menunggu' && (
                    <>
                      <div className="absolute -left-[19px] top-2 w-8 h-8 rounded-full bg-ceria-100 text-ceria-800 flex items-center justify-center border-2 border-white shadow-xs">
                        <Clock className="w-4 h-4 animate-spin-slow" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-ink">
                          Dalam Antrean Verifikasi
                        </h4>
                        <p className="text-xs text-ink-soft mt-1 leading-relaxed">
                          Tim relawan GG River Care sedang memeriksa foto bukti dan koordinat sempadanmu.
                        </p>
                      </div>
                    </>
                  )}

                  {(foundReport.status === 'valid' || foundReport.status === 'terverifikasi') && (
                    <>
                      <div className="absolute -left-[19px] top-2 w-8 h-8 rounded-full bg-musi-100 text-musi-600 flex items-center justify-center border-2 border-white shadow-xs">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div className="space-y-2">
                        <div>
                          <h4 className="text-sm font-bold text-ink">
                            Laporan Diverifikasi &amp; Terbit di Peta
                          </h4>
                          <p className="text-xs text-ink-soft mt-1 leading-relaxed">
                            Laporanmu telah dinyatakan valid dan saat ini sudah tampil di peta sebaran publik untuk bahan advokasi komunitas.
                          </p>
                        </div>
                        <Link to="/">
                          <Button variant="lembut" size="sm">
                            <MapPin className="w-3.5 h-3.5" />
                            <span>Lihat di Peta Sebaran</span>
                          </Button>
                        </Link>
                      </div>
                    </>
                  )}

                  {foundReport.status === 'ditolak' && (
                    <>
                      <div className="absolute -left-[19px] top-2 w-8 h-8 rounded-full bg-tingkat-berat-bg text-tingkat-berat-tx flex items-center justify-center border-2 border-white shadow-xs">
                        <XCircle className="w-4 h-4" />
                      </div>
                      <div className="space-y-3">
                        <div>
                          <h4 className="text-sm font-bold text-ink">
                            Laporan Ditolak
                          </h4>
                          <p className="text-xs text-ink-soft mt-1">
                            Laporan tidak dapat diterbitkan ke peta publik setelah ditinjau oleh tim relawan.
                          </p>
                        </div>

                        {/* Kotak Alasan Penolakan Resmi dari Admin */}
                        <div className="p-4 rounded-2xl bg-tingkat-berat-bg border border-tingkat-berat-tx/20 space-y-1">
                          <span className="text-xs font-bold text-tingkat-berat-tx uppercase tracking-wider block">
                            Alasan Penolakan:
                          </span>
                          <p className="text-xs text-tingkat-berat-tx leading-relaxed font-semibold">
                            "{foundReport.rejection_reason || 'Foto bukti tidak memuat indikasi pencemaran air sempadan Sungai Musi yang jelas atau berada di luar batas wilayah pemantauan.'}"
                          </p>
                        </div>

                        <Link to="/lapor">
                          <Button variant="ajakan" size="sm">
                            <Plus className="w-4 h-4 stroke-[2.5]" />
                            <span>Buat Laporan Baru</span>
                          </Button>
                        </Link>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Tombol Bagikan */}
            <div className="pt-3 border-t border-garis flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleShareWa}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-50 hover:bg-slate-100 text-ink text-xs font-semibold border border-garis transition cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Bagikan Status</span>
              </button>
            </div>
          </Card>

          {/* Rangkuman Detail Laporan yang Dilacak */}
          <Card className="p-5 sm:p-6 space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-muted block">
              Detail Laporan yang Dikirimkan
            </span>

            <div className="flex flex-col sm:flex-row gap-4">
              <div className="w-full sm:w-36 h-36 rounded-2xl overflow-hidden bg-slate-100 shrink-0 border border-garis">
                <img
                  src={foundReport.photo_url || 'https://images.unsplash.com/photo-1618477461853-cf6ed80faba5?auto=format&fit=crop&w=400&q=80'}
                  alt={foundReport.title}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge
                    type="tingkat"
                    value={(foundReport.estimated_severity || foundReport.severity || 'sedang').toLowerCase()}
                    size="md"
                  />
                  <span className="text-xs font-bold text-ink-muted">
                    {getReportCategory(foundReport)}
                  </span>
                </div>

                <h3 className="text-base font-bold text-ink">
                  {foundReport.title}
                </h3>

                <p className="text-xs text-ink-soft leading-relaxed">
                  {foundReport.description}
                </p>

                <div className="pt-2 text-xs text-ink-muted flex items-center gap-1 border-t border-garis/60">
                  <MapPin className="w-3.5 h-3.5 text-musi-600 shrink-0" />
                  <span className="truncate">{foundReport.district} &bull; {foundReport.address_landmark}</span>
                </div>
              </div>
            </div>
          </Card>

        </div>
      )}

      {/* ========================================================
          KONDISI 3: BELUM MENGISI KODE TIKET (TAMPILAN DEFAULT)
          Daftar Laporan yang Pernah Dibuat di Perangkat Ini (Jaring Pengaman FR-2)
         ======================================================== */}
      {!activeCode && (
        <div className="space-y-6 animate-fade-in">
          {deviceReports && deviceReports.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h2 className="text-base sm:text-lg font-bold text-ink flex items-center gap-2">
                    <span>📌 Laporan yang Pernah Kamu Buat di Perangkat Ini</span>
                    <span className="px-2 py-0.5 rounded-full bg-musi-100 text-musi-800 text-xs font-bold">
                      {deviceReports.length}
                    </span>
                  </h2>
                  <p className="text-xs text-ink-muted">
                    Klik salah satu kartu untuk langsung melihat statusnya.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleClearAllDeviceReports}
                  className="text-xs font-semibold text-ink-muted hover:text-tingkat-berat-tx transition cursor-pointer p-1"
                  title="Hapus riwayat lokal jika menggunakan komputer umum"
                >
                  Bersihkan Riwayat
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {deviceReports.map((item) => {
                  // Cek status terbaru jika ada di context reports
                  const liveReport = (reports || []).find(
                    r => r.tracking_code?.toUpperCase() === item.tracking_code?.toUpperCase()
                  );
                  const currentStatus = liveReport?.status || item.status || 'menunggu';

                  return (
                    <div
                      key={item.tracking_code}
                      onClick={() => handleSelectReport(item.tracking_code)}
                      className="bg-white rounded-2xl border border-garis hover:border-musi-600 p-4 transition-all duration-150 ease-halus shadow-xs hover:shadow-md cursor-pointer group space-y-3 relative overflow-hidden"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-extrabold text-ink font-mono tracking-wider">
                              #{item.tracking_code}
                            </span>
                            <Badge
                              type="status"
                              value={currentStatus === 'terverifikasi' ? 'valid' : currentStatus}
                              size="sm"
                            />
                          </div>
                          <h3 className="text-xs sm:text-sm font-bold text-ink truncate group-hover:text-musi-600 transition">
                            {item.title}
                          </h3>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => handleDeleteDeviceReport(e, item.tracking_code)}
                          className="p-1.5 rounded-lg text-ink-muted hover:text-tingkat-berat-tx hover:bg-tingkat-berat-bg transition cursor-pointer shrink-0"
                          title="Hapus dari riwayat perangkat"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="pt-2 border-t border-garis/60 flex items-center justify-between text-xs text-ink-muted">
                        <span className="truncate flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-musi-600 shrink-0" />
                          <span className="truncate">{item.district || 'Palembang'}</span>
                        </span>
                        <span className="text-xs font-bold text-musi-600 inline-flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                          <span>Lihat Linimasa</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <Card className="p-6 sm:p-8 space-y-4 bg-white/80 border-dashed border-garis text-center">
              <div className="w-12 h-12 rounded-2xl bg-musi-100 text-musi-600 flex items-center justify-center mx-auto">
                <Info className="w-6 h-6 stroke-[2]" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-sm sm:text-base font-bold text-ink">
                  Belum Ada Tiket di Perangkat Ini
                </h3>
                <p className="text-xs text-ink-soft leading-relaxed">
                  Setiap kali kamu mengirimkan laporan pencemaran di SIPEPES, tiket akan otomatis tersimpan di browser ini agar kamu bisa memantau penanganannya dengan cepat tanpa perlu registrasi akun.
                </p>
              </div>
              <div>
                <Link to="/lapor">
                  <Button variant="ajakan" size="sm">
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>Kirim Laporan Baru</span>
                  </Button>
                </Link>
              </div>
            </Card>
          )}

          {/* Banner Bantuan GG River Care */}
          <div className="p-4 sm:p-5 rounded-3xl bg-linear-to-r from-musi-100 to-toska-100 border border-musi-600/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-xs sm:text-sm font-bold text-ink">
                Ingin memantau sebaran pencemaran lainnya?
              </h4>
              <p className="text-xs text-ink-soft">
                Seluruh titik pencemaran yang telah dinyatakan valid oleh relawan Green Generation Palembang dapat dilihat langsung di Peta Publik.
              </p>
            </div>
            <Link to="/" className="shrink-0">
              <Button variant="utama" size="sm">
                <MapPin className="w-3.5 h-3.5" />
                <span>Buka Peta Publik</span>
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* ========================================================
          DIALOG MODAL: LUPA KODE TIKET (JARING PENGAMAN FR-2)
         ======================================================== */}
      {forgotModalOpen && (
        <div className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <Card className="max-w-lg w-full p-6 sm:p-7 space-y-5 bg-white shadow-2xl animate-scale-in my-8">
            <div className="flex items-center justify-between pb-3 border-b border-garis">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-musi-100 text-musi-600 flex items-center justify-center shrink-0">
                  <HelpCircle className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-ink">
                    Cari Laporan Warga
                  </h3>
                  <p className="text-xs text-ink-muted">
                    Lupa kode tiket? Temukan kembali laporanmu di bawah ini.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setForgotModalOpen(false)}
                className="p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Pilihan Metode Pencarian (Tab) */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
              <button
                type="button"
                onClick={() => {
                  setSearchTab('phone');
                  setSearchError('');
                  setSearchResults([]);
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                  searchTab === 'phone'
                    ? 'bg-white text-musi-600 shadow-xs'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                Via No. WhatsApp/HP
              </button>

              <button
                type="button"
                onClick={() => {
                  setSearchTab('district');
                  setSearchError('');
                  setSearchResults([]);
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                  searchTab === 'district'
                    ? 'bg-white text-musi-600 shadow-xs'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                Via Wilayah &amp; Tanggal
              </button>
            </div>

            {/* Formulir Tab 1: No. HP */}
            {searchTab === 'phone' && (
              <form onSubmit={handlePerformSearch} className="space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-ink uppercase tracking-wider">
                    Nomor WhatsApp / Telepon Saat Melapor
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      value={searchPhone}
                      onChange={(e) => setSearchPhone(e.target.value)}
                      placeholder="Contoh: 081234567890"
                      className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-garis rounded-2xl text-xs font-semibold text-ink placeholder:text-ink-muted focus:outline-none focus:border-musi-600 focus:bg-white focus:ring-4 focus:ring-musi-100 transition"
                    />
                  </div>
                  <p className="text-xs text-ink-muted">
                    Privasi terjaga: Nomor kontak pelapor disamarkan dan tidak dipublikasikan utuh.
                  </p>
                </div>

                <Button
                  type="submit"
                  variant="utama"
                  size="md"
                  disabled={isSearching}
                  className="w-full"
                >
                  <Search className="w-4 h-4" />
                  <span>{isSearching ? 'Mencari...' : 'Cari Laporan Saya'}</span>
                </Button>
              </form>
            )}

            {/* Formulir Tab 2: Wilayah & Tanggal */}
            {searchTab === 'district' && (
              <form onSubmit={handlePerformSearch} className="space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-ink uppercase tracking-wider">
                    Kecamatan Sempadan Musi
                  </label>
                  <select
                    value={searchDistrict}
                    onChange={(e) => setSearchDistrict(e.target.value)}
                    className="w-full h-11 px-3.5 bg-slate-50 border border-garis rounded-2xl text-xs font-semibold text-ink focus:outline-none focus:border-musi-600 focus:bg-white focus:ring-4 focus:ring-musi-100 transition cursor-pointer"
                  >
                    <option value="">Pilih Kecamatan...</option>
                    {districtList.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-ink uppercase tracking-wider">
                    Perkiraan Tanggal Melapor (Opsional)
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="date"
                      value={searchDate}
                      onChange={(e) => setSearchDate(e.target.value)}
                      className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-garis rounded-2xl text-xs font-semibold text-ink focus:outline-none focus:border-musi-600 focus:bg-white focus:ring-4 focus:ring-musi-100 transition cursor-pointer"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="utama"
                  size="md"
                  disabled={isSearching}
                  className="w-full"
                >
                  <Search className="w-4 h-4" />
                  <span>{isSearching ? 'Mencari...' : 'Cari Laporan'}</span>
                </Button>
              </form>
            )}

            {/* Pesan Error Jika Tidak Ditemukan */}
            {searchError && (
              <div className="p-3.5 rounded-2xl bg-tingkat-berat-bg text-tingkat-berat-tx text-xs font-semibold">
                {searchError}
              </div>
            )}

            {/* Daftar Hasil Pencarian */}
            {searchResults.length > 0 && (
              <div className="space-y-2.5 pt-2 border-t border-garis max-h-60 overflow-y-auto">
                <span className="text-xs font-bold uppercase tracking-wider text-ink-muted block">
                  Ditemukan {searchResults.length} Laporan:
                </span>

                {searchResults.map((rep) => (
                  <div
                    key={rep.id || rep.tracking_code}
                    className="p-3 rounded-2xl bg-slate-50 hover:bg-musi-100/40 border border-garis flex items-center justify-between gap-3 transition"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-ink font-mono">
                          #{rep.tracking_code}
                        </span>
                        <Badge
                          type="status"
                          value={rep.status === 'terverifikasi' ? 'valid' : rep.status}
                          size="sm"
                        />
                      </div>
                      <p className="text-xs font-bold text-ink truncate">
                        {rep.title}
                      </p>
                      <p className="text-xs text-ink-muted truncate">
                        {rep.district} &bull; {rep.created_at ? new Date(rep.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Hari ini'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelectReport(rep.tracking_code)}
                      className="px-3 py-1.5 rounded-full bg-musi-600 hover:bg-musi-700 text-white text-xs font-bold shrink-0 transition cursor-pointer"
                    >
                      Buka Tiket
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Tombol Tutup Dialog */}
            <div className="pt-2 flex justify-end">
              <Button
                type="button"
                variant="garis"
                size="sm"
                onClick={() => setForgotModalOpen(false)}
              >
                <span>Tutup</span>
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
