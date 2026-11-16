import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Camera,
  Image as ImageIcon,
  MapPin,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Copy,
  Check,
  Share2,
  Trash2,
  ExternalLink,
  Navigation,
  Info,
  Download
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useAdmin } from '../../context/AdminContext';
import { compressImage } from '../../lib/compressImage';
import { saveDeviceReport } from '../../lib/deviceReports';
import reportsService from '../../services/reports';
import Stepper from '../../components/Stepper';
import Button from '../../components/Button';
import Card from '../../components/Card';
import ChipGroup from '../../components/ChipGroup';
import Badge from '../../components/Badge';
import Toast from '../../components/Toast';

// Fix ikon Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom Drop Pin
const createDropPinIcon = (severity = 'sedang', isSelected = true) => {
  const colorMap = {
    berat: '#D93A40',
    sedang: '#FFA63D',
    ringan: '#22B573'
  };
  const color = colorMap[severity] || colorMap.sedang;
  const size = isSelected ? 42 : 36;

  return L.divIcon({
    className: 'custom-drop-pin',
    html: `
      <div style="width:${size}px; height:${size}px; transform:translate(-50%, -100%); filter:drop-shadow(0 4px 6px rgba(18,33,63,0.3));">
        <svg viewBox="0 0 36 36" width="${size}" height="${size}" fill="none">
          <path d="M18 2C18 2 6 15.5 6 23C6 29.6 11.4 35 18 35C24.6 35 30 29.6 30 23C30 15.5 18 2 18 2Z" fill="${color}" stroke="#FFFFFF" stroke-width="3"/>
          <circle cx="18" cy="22" r="4.5" fill="#FFFFFF"/>
        </svg>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size]
  });
};

// Komponen Pin yang Bisa Digeser di Peta
function DraggablePin({ position, onPositionChange, severity }) {
  const markerRef = useRef(null);
  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const latLng = marker.getLatLng();
          onPositionChange(parseFloat(latLng.lat.toFixed(5)), parseFloat(latLng.lng.toFixed(5)));
        }
      },
    }),
    [onPositionChange]
  );

  return (
    <Marker
      draggable={true}
      eventHandlers={eventHandlers}
      position={position}
      ref={markerRef}
      icon={createDropPinIcon(severity, true)}
    />
  );
}

// Controller Peta untuk Mengikuti Perubahan Koordinat
function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, 15);
    }
  }, [center, map]);
  return null;
}

export default function WargaReportForm() {
  const { addReport } = useAdmin();
  const navigate = useNavigate();
  const { kode: urlKode } = useParams();

  // State Step Form (1 - 4)
  const [currentStep, setCurrentStep] = useState(1);

  // State Langkah 1: Foto
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoSizes, setPhotoSizes] = useState(null); // { original, compressed }
  const [isCompressing, setIsCompressing] = useState(false);

  // State Langkah 2: Lokasi
  const [coords, setCoords] = useState({ lat: -2.9904, lng: 104.7565 });
  const [district, setDistrict] = useState('Seberang Ulu I');
  const [landmark, setLandmark] = useState('');
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [gpsError, setGpsError] = useState(null);

  // State Langkah 3: Detail Dugaan & Kondisi Lokasi
  const [title, setTitle] = useState('');
  const [pollutionType, setPollutionType] = useState('minyak_oli');
  const [severity, setSeverity] = useState('sedang');
  const [description, setDescription] = useState('');
  // Kondisi Lokasi (Opsional)
  const [areaEstimate, setAreaEstimate] = useState('10 - 50 m²');
  const [nearSettlement, setNearSettlement] = useState('Ya');
  const [waterDepth, setWaterDepth] = useState('Sedang');

  // State Submit & Sukses
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdTicket, setCreatedTicket] = useState(null);
  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [errors, setErrors] = useState({});

  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  // Daftar Kecamatan Palembang
  const districts = [
    'Seberang Ulu I',
    'Seberang Ulu II',
    'Ilir Timur I',
    'Ilir Timur II',
    'Ilir Timur III',
    'Ilir Barat I',
    'Ilir Barat II',
    'Gandus',
    'Kertapati',
    'Plaju',
    'Kalidoni',
    'Bukit Kecil'
  ];

  // Pilihan Kategori Limbah
  const pollutionOptions = [
    { value: 'minyak_oli', label: 'Limbah Minyak / B3', desc: 'Tumpahan oli, minyak kapal, atau bahan kimia' },
    { value: 'sampah_domestik', label: 'Sampah Plastik', desc: 'Timbulan kantong, botol, atau sampah plastik sempadan' },
    { value: 'limbah_industri', label: 'Limbah Industri', desc: 'Busa tebal atau buangan pabrik berwarna pekat' },
    { value: 'lainnya', label: 'Lainnya / Gulma', desc: 'Eceng gondok tebal atau material lain' }
  ];

  // Pilihan Tingkat Dugaan
  const severityOptions = [
    { value: 'berat', label: 'Berat', desc: 'Air menghitam pekat / berbau menyengat / tumpahan masif' },
    { value: 'sedang', label: 'Sedang', desc: 'Sampah mengapung cukup banyak / air keruh' },
    { value: 'ringan', label: 'Ringan', desc: 'Serakan sampah baru / pencemaran lokal kecil' }
  ];

  // Handler Kompresi Foto
  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrors(prev => ({ ...prev, photo: null }));
    setIsCompressing(true);

    try {
      const result = await compressImage(file);
      setPhotoFile(result.file);
      setPhotoPreview(result.previewUrl);
      setPhotoSizes({
        original: (result.originalSize / (1024 * 1024)).toFixed(2),
        compressed: (result.compressedSize / (1024 * 1024)).toFixed(2)
      });
      setToastMessage('Foto berhasil dikompresi dan siap diunggah');
    } catch (err) {
      setErrors(prev => ({ ...prev, photo: err.message || 'Gagal memproses foto.' }));
    } finally {
      setIsCompressing(false);
    }
  };

  // Handler Geolocation Warga
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setGpsError('Browser kamu tidak mendukung deteksi lokasi otomatis.');
      return;
    }

    setIsGettingLocation(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(5));
        const lng = parseFloat(pos.coords.longitude.toFixed(5));
        setCoords({ lat, lng });
        setIsGettingLocation(false);
        setToastMessage('Lokasi GPS kamu berhasil dideteksi');
      },
      (err) => {
        setIsGettingLocation(false);
        setGpsError('Izin akses lokasi ditolak atau sinyal GPS lemah. Silakan geser pin pada peta secara manual.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Validasi Langkah Sebelum Lanjut
  const validateStep = (step) => {
    const newErrors = {};

    if (step === 1) {
      if (!photoPreview) {
        newErrors.photo = 'Mohon sertakan satu foto bukti pencemaran.';
      }
    } else if (step === 2) {
      if (!district) {
        newErrors.district = 'Pilih kecamatan tempat kejadian.';
      }
    } else if (step === 3) {
      if (!title.trim()) {
        newErrors.title = 'Tuliskan judul laporan singkat.';
      } else if (title.length > 80) {
        newErrors.title = 'Judul maksimal 80 karakter.';
      }

      if (!description.trim()) {
        newErrors.description = 'Jelaskan kondisi pencemaran yang kamu lihat.';
      } else if (description.length > 500) {
        newErrors.description = 'Deskripsi maksimal 500 karakter.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 4));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Submit Laporan
  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) return;

    setIsSubmitting(true);
    setErrors(prev => ({ ...prev, submit: null }));

    // Format Cerdas: Gabungkan kondisi lokasi ke deskripsi sesuai Gap 2
    const conditionHeader = `[Kondisi Lokasi: Luas ${areaEstimate} | Dekat Permukiman: ${nearSettlement} | Kedalaman Air: ${waterDepth}]`;
    const fullDescription = `${conditionHeader}\n\n${description}`;

    const reportPayload = {
      title,
      description: fullDescription,
      category: pollutionOptions.find(p => p.value === pollutionType)?.label || 'Sampah Plastik',
      pollution_type: pollutionType,
      estimated_severity: severity,
      latitude: coords.lat,
      longitude: coords.lng,
      district,
      address_landmark: landmark || `Sempadan Sungai Musi, ${district}`,
      photo_url: photoPreview,
      // Warga melapor tanpa akun (FR-2)
      is_anonymous: true,
      reporter_name: 'Warga Peduli Musi'
    };

    let created = null;

    // Coba kirim via API Backend jika live
    if (import.meta.env.VITE_USE_MOCK !== 'true') {
      try {
        const res = await reportsService.createReport(reportPayload, photoFile);
        if (res.success && res.data) {
          created = res.data;
        }
      } catch (apiErr) {
        console.warn('Pengiriman via API backend gagal, beralih ke cache context:', apiErr.message);
      }
    }

    // Fallback simpan ke context jika offline / belum ada backend
    if (!created) {
      created = addReport(reportPayload);
    } else {
      addReport(created);
    }

    // Otomatis simpan ke riwayat perangkat lokal (Jaring Pengaman FR-2)
    saveDeviceReport(created);

    setIsSubmitting(false);
    setCreatedTicket(created);
  };

  const handleCopyCode = () => {
    if (createdTicket?.tracking_code && navigator.clipboard) {
      navigator.clipboard.writeText(createdTicket.tracking_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Unduh Kartu Tiket Digital (PNG) Beresolusi Tinggi
  const handleDownloadTicketCard = (ticketCode, report) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 900;
      canvas.height = 540;

      // Latar Gelap Elegan
      ctx.fillStyle = '#12213F';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Garis aksen pelangi Musi di atas
      const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
      grad.addColorStop(0, '#1D6FF2');
      grad.addColorStop(0.5, '#19D3BD');
      grad.addColorStop(1, '#FFC93C');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, 10);

      // Dekorasi lingkaran halus di sudut kanan atas
      ctx.fillStyle = 'rgba(29, 111, 242, 0.08)';
      ctx.beginPath();
      ctx.arc(820, 100, 160, 0, Math.PI * 2);
      ctx.fill();

      // Brand Title
      ctx.fillStyle = '#19D3BD';
      ctx.font = 'bold 18px Montserrat, sans-serif';
      ctx.fillText('SIPEPES × GREEN GENERATION PALEMBANG', 50, 60);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.font = '13px Montserrat, sans-serif';
      ctx.fillText('PROGRAM GG RIVER CARE • PENJAGA KELESTARIAN SUNGAI MUSI', 50, 85);

      // Divider line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(50, 105);
      ctx.lineTo(850, 105);
      ctx.stroke();

      // Kotak Tiket Emas
      ctx.fillStyle = '#192C54';
      if (ctx.roundRect) {
        ctx.roundRect(50, 130, 800, 160, 18);
        ctx.fill();
      } else {
        ctx.fillRect(50, 130, 800, 160);
      }
      ctx.strokeStyle = '#FFC93C';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#FFC93C';
      ctx.font = 'bold 15px Montserrat, sans-serif';
      ctx.fillText('KODE TIKET PELACAKAN', 80, 165);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 50px monospace';
      ctx.fillText(ticketCode, 80, 225);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = '14px Montserrat, sans-serif';
      ctx.fillText('Status: Menunggu Verifikasi Tim Relawan GG River Care', 80, 260);

      // Detail Laporan
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 20px Montserrat, sans-serif';
      const displayTitle = report?.title || title || 'Laporan Titik Pencemaran Musi';
      ctx.fillText(displayTitle.length > 50 ? displayTitle.slice(0, 47) + '...' : displayTitle, 50, 335);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.font = '15px Montserrat, sans-serif';
      const cat = report?.category || pollutionOptions.find(p => p.value === pollutionType)?.label || 'Limbah';
      const dis = report?.district || district || 'Palembang';
      ctx.fillText(`Kategori: ${cat}   |   Wilayah: ${dis}`, 50, 370);

      const dateStr = new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) + ' WIB';
      ctx.fillText(`Waktu Melapor: ${dateStr}`, 50, 400);

      // Footer Bar
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.fillRect(0, 460, canvas.width, 80);

      ctx.fillStyle = '#19D3BD';
      ctx.font = 'bold 14px Montserrat, sans-serif';
      ctx.fillText('Pantau perkembangan laporanmu kapan saja di:', 50, 505);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`${window.location.origin}/lacak/${ticketCode}`, 420, 505);

      // Trigger Download
      const link = document.createElement('a');
      link.download = `tiket-sipepes-${ticketCode}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      setToastMessage('Kartu tiket digital berhasil diunduh');
    } catch (err) {
      console.error('Gagal membuat kartu tiket:', err);
      setToastMessage('Gagal membuat kartu tiket gambar');
    }
  };

  // ========================================================
  // VIEW: LAPORAN TERKIRIM (W6 / W8)
  // ========================================================
  if (createdTicket || urlKode) {
    const code = createdTicket?.tracking_code || urlKode;
    const shareText = `Halo! Saya baru saja melaporkan pencemaran Sungai Musi melalui SIPEPES GG River Care.\n\nKode Tiket: ${code}\nKategori: ${createdTicket?.category || 'Limbah'}\nWilayah: ${district || createdTicket?.district || 'Palembang'}\n\nPantau statusnya di sini: ${window.location.origin}/lacak/${code}`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

    return (
      <div className="max-w-xl mx-auto py-6 sm:py-10 space-y-6">
        <Card className="text-center space-y-6 p-6 sm:p-10 border-toska-100">
          {/* Ikon Centang Toska Beranimasi */}
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-toska-400 text-ink flex items-center justify-center mx-auto shadow-[0_0_0_12px_#D5F7F1] animate-bounce-short">
            <Check className="w-10 h-10 sm:w-12 sm:h-12 stroke-[3]" />
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-toska-100 text-toska-800 text-xs font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Laporan Berhasil Terkirim</span>
            </span>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
              Terima kasih sudah peduli pada Sungai Musi!
            </h1>

            <p className="text-xs sm:text-sm text-ink-soft leading-relaxed max-w-md mx-auto">
              Laporanmu telah masuk ke antrean dan akan segera diverifikasi oleh tim relawan Green Generation Palembang.
            </p>
          </div>

          {/* Kartu Kode Tiket Besar */}
          <div className="bg-ceria-100 border border-ceria-400/40 rounded-3xl p-6 sm:p-7 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-ceria-800">
              Kode Tiket Pelacakanmu
            </span>

            <div className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-ink tracking-widest tabular-nums select-all font-mono">
              {code}
            </div>

            <p className="text-xs text-ceria-800/90 font-medium">
              Simpan kode ini untuk memantau status tindak lanjut laporanmu kapan saja.
            </p>

            <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={handleCopyCode}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white text-ink text-xs font-bold border border-garis hover:bg-slate-50 shadow-xs cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-toska-800" /> : <Copy className="w-4 h-4 text-ink-muted" />}
                <span>{copied ? 'Tersalin!' : 'Salin Kode'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleDownloadTicketCard(code, createdTicket)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white text-ink text-xs font-bold border border-garis hover:bg-slate-50 shadow-xs cursor-pointer"
              >
                <Download className="w-4 h-4 text-musi-600" />
                <span>Simpan Kartu Tiket (PNG)</span>
              </button>

              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white text-ink text-xs font-bold border border-garis hover:bg-slate-50 shadow-xs"
              >
                <Share2 className="w-4 h-4 text-emerald-600" />
                <span>Bagikan ke WhatsApp</span>
              </a>
            </div>
          </div>

          {/* Tombol Navigasi Lanjutan */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to={`/lacak/${code}`} className="w-full sm:w-auto">
              <Button variant="utama" size="md" className="w-full">
                <span>Lacak Status Laporan Ini</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>

            <Link to="/" className="w-full sm:w-auto">
              <Button variant="garis" size="md" className="w-full">
                <span>Kembali ke Beranda</span>
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  // ========================================================
  // VIEW: FORMULIR 4 LANGKAH
  // ========================================================
  return (
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
      {toastMessage && (
        <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      )}

      {/* Header Formulir & Stepper */}
      <div className="space-y-4 text-center sm:text-left">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
              Laporkan Pencemaran Sungai Musi
            </h1>
          </div>

          <Link to="/" className="text-xs font-bold text-musi-600 hover:text-musi-800 transition inline-flex items-center gap-1 self-center sm:self-auto">
            <span>Batal &amp; Kembali</span>
          </Link>
        </div>

        {/* Stepper Indikator Kemajuan */}
        <Stepper currentStep={currentStep} totalSteps={4} />
      </div>

      {/* Form Container Grid (Form di Kiri, Kolom Tips di Kanan pada Desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Kolom Kiri: Kartu Form Aktif (lg:col-span-8) */}
        <div className="lg:col-span-8">
          <Card className="space-y-6">

            {/* ====================================================
                LANGKAH 1: FOTO BUKTI
               ==================================================== */}
            {currentStep === 1 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-ink">
                    1. Unggah Foto Bukti Pencemaran
                  </h2>
                </div>

                {/* Input Tersembunyi untuk Kamera & Galeri */}
                <input
                  type="file"
                  ref={cameraInputRef}
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
                <input
                  type="file"
                  ref={galleryInputRef}
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />

                {/* Preview Foto atau Tombol Upload */}
                {photoPreview ? (
                  <div className="space-y-3">
                    <div className="relative rounded-2xl overflow-hidden border border-garis bg-slate-100 max-h-80 flex items-center justify-center">
                      <img
                        src={photoPreview}
                        alt="Bukti Pencemaran"
                        className="w-full h-full object-cover max-h-80"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoFile(null);
                          setPhotoPreview(null);
                          setPhotoSizes(null);
                        }}
                        className="absolute top-3 right-3 p-2 rounded-full bg-ink/75 hover:bg-ink text-white transition cursor-pointer shadow-md"
                        title="Hapus foto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {photoSizes && (
                      <div className="p-3 bg-musi-100 rounded-2xl flex items-center justify-between text-xs text-musi-800 font-semibold">
                        <span>Ukuran terkompresi: <strong>{photoSizes.compressed} MB</strong></span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Area Drag-and-Drop Desktop */}
                    <div
                      onClick={() => galleryInputRef.current?.click()}
                      className="border-2 border-dashed border-garis hover:border-musi-600 bg-krem/50 hover:bg-musi-100/30 rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-150 ease-halus space-y-3"
                    >
                      <div className="w-16 h-16 rounded-full bg-white shadow-lembut text-musi-600 flex items-center justify-center mx-auto">
                        <Camera className="w-7 h-7 stroke-[2.2]" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-ink">
                          Klik untuk memilih foto dari perangkat
                        </p>
                        <p className="text-xs text-ink-muted mt-1">
                          Format JPG, PNG, atau WebP (otomatis dikompresi di bawah 2 MB)
                        </p>
                      </div>
                    </div>

                    {/* Tombol Kamera Cepat Khusus Smartphone */}
                    <div className="grid grid-cols-2 gap-3 sm:hidden">
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        className="h-12 rounded-2xl bg-musi-600 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Buka Kamera</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => galleryInputRef.current?.click()}
                        className="h-12 rounded-2xl bg-white border border-garis text-ink text-xs font-bold flex items-center justify-center gap-2 shadow-xs"
                      >
                        <ImageIcon className="w-4 h-4" />
                        <span>Dari Galeri</span>
                      </button>
                    </div>
                  </div>
                )}

                {isCompressing && (
                  <p className="text-xs font-semibold text-musi-600 animate-pulse">
                    Sedang memproses dan mengompresi foto...
                  </p>
                )}

                {errors.photo && (
                  <p className="text-xs font-bold text-tingkat-berat-tx flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" />
                    <span>{errors.photo}</span>
                  </p>
                )}
              </div>
            )}

            {/* ====================================================
                LANGKAH 2: LOKASI SEMPADAN
               ==================================================== */}
            {currentStep === 2 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-ink">
                    2. Tandai Lokasi Sempadan Sungai
                  </h2>
                </div>

                {/* Tombol Deteksi Lokasi Otomatis */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-50 rounded-2xl border border-garis">
                  <div className="text-xs text-ink-soft">
                    <span className="font-bold text-ink block">Posisi Koordinat:</span>
                    <span className="font-mono font-semibold">{coords.lat}, {coords.lng}</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleDetectLocation}
                    disabled={isGettingLocation}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-musi-600 hover:bg-musi-700 text-white text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    <Navigation className={`w-3.5 h-3.5 ${isGettingLocation ? 'animate-spin' : ''}`} />
                    <span>{isGettingLocation ? 'Mencari Sinyal GPS...' : 'Gunakan Lokasi Saya'}</span>
                  </button>
                </div>

                {gpsError && (
                  <p className="text-xs text-tingkat-berat-tx bg-tingkat-berat-bg p-3 rounded-xl font-semibold">
                    {gpsError}
                  </p>
                )}

                {/* Peta Mini dengan Draggable Pin */}
                <div className="h-64 sm:h-72 w-full rounded-2xl overflow-hidden border border-garis relative">
                  <MapContainer
                    center={[coords.lat, coords.lng]}
                    zoom={15}
                    scrollWheelZoom={false}
                    className="w-full h-full"
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MapUpdater center={[coords.lat, coords.lng]} />
                    <DraggablePin
                      position={[coords.lat, coords.lng]}
                      severity={severity}
                      onPositionChange={(lat, lng) => setCoords({ lat, lng })}
                    />
                  </MapContainer>
                  <div className="absolute bottom-2 left-2 z-20 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-lg text-xs font-bold text-ink shadow-xs">
                    Tips: Tekan dan geser pin untuk memindahkan titik
                  </div>
                </div>

                {/* Isian Kecamatan (Wajib) */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-ink uppercase tracking-wider">
                    Kecamatan <span className="text-tingkat-berat-tx">*</span>
                  </label>
                  <select
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="w-full h-12 px-4 bg-white border border-garis rounded-2xl text-sm font-semibold text-ink focus:outline-none focus:border-musi-600 focus:ring-4 focus:ring-musi-100 transition"
                  >
                    {districts.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  {errors.district && (
                    <p className="text-xs text-tingkat-berat-tx font-bold">{errors.district}</p>
                  )}
                </div>

                {/* Isian Patokan Lokasi (Opsional) */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-ink uppercase tracking-wider">
                    Patokan Terdekat <span className="text-ink-muted font-normal">(Opsional)</span>
                  </label>
                  <input
                    type="text"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    placeholder="Contoh: Bawah Jembatan Ampera, dekat Dermaga 7 Ulu"
                    className="w-full h-12 px-4 bg-white border border-garis rounded-2xl text-sm font-medium text-ink focus:outline-none focus:border-musi-600 focus:ring-4 focus:ring-musi-100 transition"
                  />
                </div>
              </div>
            )}

            {/* ====================================================
                LANGKAH 3: DETAIL DUGAAN & KONDISI
               ==================================================== */}
            {currentStep === 3 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-ink">
                    3. Detail Dugaan Pencemaran
                  </h2>
                </div>

                {/* Judul Laporan */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-ink uppercase tracking-wider">
                      Judul Laporan <span className="text-tingkat-berat-tx">*</span>
                    </label>
                    <span className="text-xs font-semibold text-ink-muted">
                      {title.length}/80
                    </span>
                  </div>
                  <input
                    type="text"
                    value={title}
                    maxLength={80}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Contoh: Tumpahan Oli Kapal di Dermaga Pasar 16"
                    className="w-full h-12 px-4 bg-white border border-garis rounded-2xl text-sm font-bold text-ink focus:outline-none focus:border-musi-600 focus:ring-4 focus:ring-musi-100 transition"
                  />
                  {errors.title && (
                    <p className="text-xs text-tingkat-berat-tx font-bold">{errors.title}</p>
                  )}
                </div>

                {/* Jenis Limbah (ChipGroup) */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-ink uppercase tracking-wider">
                    Jenis Limbah yang Terlihat <span className="text-tingkat-berat-tx">*</span>
                  </label>
                  <ChipGroup
                    options={pollutionOptions}
                    value={pollutionType}
                    onChange={setPollutionType}
                  />
                </div>

                {/* Tingkat Dugaan (ChipGroup) */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-ink uppercase tracking-wider">
                    Tingkat Dugaan Pencemaran <span className="text-tingkat-berat-tx">*</span>
                  </label>
                  <ChipGroup
                    options={severityOptions}
                    value={severity}
                    onChange={setSeverity}
                  />
                </div>

                {/* Deskripsi (Textarea dengan penghitung) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-ink uppercase tracking-wider">
                      Deskripsi Kejadian <span className="text-tingkat-berat-tx">*</span>
                    </label>
                    <span className="text-xs font-semibold text-ink-muted">
                      {description.length}/500
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    maxLength={500}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ceritakan apa yang kamu lihat, seperti warna air, bau yang tercium, atau dampak ke warga sekitar..."
                    className="w-full p-4 bg-white border border-garis rounded-2xl text-sm font-medium text-ink focus:outline-none focus:border-musi-600 focus:ring-4 focus:ring-musi-100 transition resize-none"
                  />
                  {errors.description && (
                    <p className="text-xs text-tingkat-berat-tx font-bold">{errors.description}</p>
                  )}
                </div>

                {/* Bagian Kondisi Lokasi (Opsional - Rekomendasi Wawancara GGP) */}
                <div className="pt-3 border-t border-garis space-y-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-ink uppercase tracking-wider">
                      Kondisi Lokasi Sempadan
                    </span>
                    <span className="text-xs text-ink-muted font-semibold">
                      (Opsional)
                    </span>
                  </div>

                  <div className="space-y-3 bg-krem/60 p-4 rounded-2xl border border-garis">
                    {/* Perkiraan Luas */}
                    <div>
                      <span className="block text-xs font-semibold text-ink-muted mb-1.5">
                        Perkiraan Luas Sebaran:
                      </span>
                      <ChipGroup
                        options={['< 10 m²', '10 - 50 m²', '> 50 m²']}
                        value={areaEstimate}
                        onChange={setAreaEstimate}
                      />
                    </div>

                    {/* Dekat Permukiman */}
                    <div>
                      <span className="block text-xs font-semibold text-ink-muted mb-1.5">
                        Dekat Permukiman Warga:
                      </span>
                      <ChipGroup
                        options={['Ya', 'Tidak']}
                        value={nearSettlement}
                        onChange={setNearSettlement}
                      />
                    </div>

                    {/* Kedalaman Air */}
                    <div>
                      <span className="block text-xs font-semibold text-ink-muted mb-1.5">
                        Kedalaman Air di Titik Ini:
                      </span>
                      <ChipGroup
                        options={['Dangkal', 'Sedang', 'Dalam', 'Tidak Tahu']}
                        value={waterDepth}
                        onChange={setWaterDepth}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ====================================================
                LANGKAH 4: TINJAU & KIRIM
               ==================================================== */}
            {currentStep === 4 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-ink">
                    4. Tinjau Ringkasan Laporan
                  </h2>
                </div>

                {/* Pratinjau Foto & Informasi Utama */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-50 border border-garis">
                  <div className="sm:col-span-1 rounded-xl overflow-hidden bg-slate-200 h-36">
                    <img
                      src={photoPreview}
                      alt="Pratinjau Bukti"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <Badge type="tingkat" value={severity} size="md" />
                      <button
                        type="button"
                        onClick={() => setCurrentStep(1)}
                        className="text-musi-600 font-bold hover:underline"
                      >
                        Ubah Foto
                      </button>
                    </div>

                    <h3 className="text-sm sm:text-base font-bold text-ink leading-snug">
                      {title}
                    </h3>

                    <p className="text-ink-soft line-clamp-2">
                      {description}
                    </p>

                    <div className="pt-1 flex items-center justify-between text-ink-muted font-medium border-t border-garis/60">
                      <span>{district} &bull; {landmark || 'Sempadan Sungai'}</span>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(2)}
                        className="text-musi-600 font-bold hover:underline"
                      >
                        Ubah Lokasi
                      </button>
                    </div>
                  </div>
                </div>

                {/* Ringkasan Kondisi Lokasi */}
                <div className="p-4 rounded-2xl bg-white border border-garis text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-ink uppercase tracking-wider">
                      Rangkuman Parameter Observasi
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(3)}
                      className="text-musi-600 font-bold hover:underline"
                    >
                      Ubah Detail
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-ink-soft">
                    <div className="p-2.5 rounded-xl bg-slate-50">
                      <span className="text-xs uppercase font-bold text-ink-muted block">Jenis</span>
                      <span className="font-bold text-ink">
                        {pollutionOptions.find(p => p.value === pollutionType)?.label || 'Sampah Plastik'}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50">
                      <span className="text-xs uppercase font-bold text-ink-muted block">Luas</span>
                      <span className="font-bold text-ink">{areaEstimate}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50">
                      <span className="text-xs uppercase font-bold text-ink-muted block">Permukiman</span>
                      <span className="font-bold text-ink">{nearSettlement}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50">
                      <span className="text-xs uppercase font-bold text-ink-muted block">Kedalaman</span>
                      <span className="font-bold text-ink">{waterDepth}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-musi-100 text-musi-800 text-xs flex items-start gap-2.5">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Laporanmu dikirimkan secara mandiri ke komunitas Green Generation Palembang (GG River Care). Identitas pribadimu aman karena pelaporan ini tidak memerlukan registrasi.
                  </p>
                </div>
              </div>
            )}

            {/* Tombol Aksi Bawah */}
            <div className="pt-4 border-t border-garis flex items-center justify-between gap-3">
              {currentStep > 1 ? (
                <Button
                  type="button"
                  variant="garis"
                  size="md"
                  onClick={handleBack}
                  disabled={isSubmitting}
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Kembali</span>
                </Button>
              ) : (
                <div />
              )}

              {currentStep < 4 ? (
                <Button
                  type="button"
                  variant="utama"
                  size="md"
                  onClick={handleNext}
                >
                  <span>Lanjut</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ajakan"
                  size="lg"
                  onClick={handleSubmitReport}
                  disabled={isSubmitting}
                >
                  <span>{isSubmitting ? 'Mengirim Laporan...' : 'Kirim Laporan Sekarang'}</span>
                  <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                </Button>
              )}
            </div>

          </Card>
        </div>

        {/* Kolom Kanan: Panduan Cepat di Desktop (lg:col-span-4) */}
        <div className="hidden lg:block lg:col-span-4 space-y-4">
          <Card className="p-5 space-y-3 bg-white">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-muted block">
              Tips Mengambil Bukti Valid
            </span>

            <div className="space-y-2.5 text-xs text-ink-soft">
              <div className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-toska-400 mt-1.5 shrink-0" />
                <p>Ambil foto di siang hari atau saat cahaya cukup agar warna air terlihat jelas.</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-toska-400 mt-1.5 shrink-0" />
                <p>Sertakan patokan tepian sempadan seperti tiang dermaga, getek, atau dinding penahan.</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-toska-400 mt-1.5 shrink-0" />
                <p>Pastikan kamu berada di posisi yang aman dari arus sungai saat memotret.</p>
              </div>
            </div>
          </Card>

          <Card className="p-5 space-y-2.5 bg-ceria-100 border-ceria-400/30 text-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-ceria-800 block">
              Apa Setelah Laporan Dikirim?
            </span>
            <p className="text-ceria-800/90 leading-relaxed font-medium">
              Kamu akan menerima <strong>Kode Tiket Unik</strong>. Tim relawan GG River Care akan memvalidasi foto dan lokasimu sebelum titik pencemaran diterbitkan ke peta publik.
            </p>
          </Card>
        </div>

      </div>
    </div>
  );
}
