import { useState, useEffect, useCallback, useRef } from 'react';
import reportsService from '../services/reports';
import mockAdapter from '../services/mockAdapter';
import { supabase } from '../lib/supabaseClient';

const isMock = import.meta.env.VITE_USE_MOCK === 'true';

/**
 * useValidReports Hook - SIPEPES v2.0
 * Mengambil daftar laporan berstatus valid untuk Peta Sebaran Publik Warga
 * Didukung Supabase Realtime + Smart Polling (20 detik)
 */
export function useValidReports(filters = {}) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const fetchReports = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const activeService = isMock ? mockAdapter : reportsService;
      let res;
      try {
        res = await activeService.getPublicReports(filtersRef.current);
      } catch (apiErr) {
        if (!isMock) {
          console.warn('Gagal memuat API live, mencoba mock adapter:', apiErr.message);
          res = await mockAdapter.getPublicReports(filtersRef.current);
        } else {
          throw apiErr;
        }
      }

      const list = Array.isArray(res?.data) ? res.data : (res?.data?.reports || []);
      // Pastikan hanya status valid/terverifikasi
      const validOnly = list.filter(r => r.status === 'valid' || r.status === 'terverifikasi');
      setReports(validOnly);
      setError(null);
    } catch (err) {
      console.error('Error in useValidReports:', err);
      setError(err.message || 'Gagal memuat peta laporan.');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  // Inisialisasi awal saat filter berubah
  useEffect(() => {
    fetchReports(false);
  }, [fetchReports, filters.district, filters.severity]);

  // Realtime Supabase + Polling Fallback 20 Detik
  useEffect(() => {
    let channel = null;

    // 1. Supabase Realtime Subscription jika Supabase Client terkonfigurasi
    if (supabase && !isMock) {
      try {
        channel = supabase
          .channel('public:reports')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'reports' },
            () => {
              fetchReports(true);
            }
          )
          .subscribe();
      } catch (subErr) {
        console.warn('Gagal menghubungkan Supabase Realtime, menggunakan polling:', subErr);
      }
    }

    // 2. Polling Fallback 20 Detik
    const interval = setInterval(() => {
      fetchReports(true);
    }, 20000);

    return () => {
      clearInterval(interval);
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [fetchReports]);

  return {
    reports,
    loading,
    error,
    refetch: () => fetchReports(false),
  };
}

export default useValidReports;
