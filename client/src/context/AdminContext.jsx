import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  initialReports,
  mockAdminUser,
  sempadanList,
  auditLogs,
  advocacyArchives,
  weeklyTrendData,
  wasteComposition,
  criticalPoints
} from '../data/mockReports';
import reportsService from '../services/reports';
import authService from '../services/auth';
import mockAdapter from '../services/mockAdapter';
import { supabase } from '../lib/supabaseClient';

const AdminContext = createContext();

const isMock = import.meta.env.VITE_USE_MOCK === 'true';

export function AdminProvider({ children }) {
  const [reports, setReports] = useState(() => {
    const saved = localStorage.getItem('sipepes_admin_reports_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((r) => ({
          ...r,
          reporter_source: r.reporter_source?.toLowerCase().includes('mobile')
            ? 'Via Portal Pelaporan Warga'
            : (r.reporter_source || 'Via Portal Pelaporan Warga')
        }));
      } catch (e) {
        return initialReports;
      }
    }
    return initialReports;
  });

  const [adminUser, setAdminUser] = useState(() => {
    const token = localStorage.getItem('sipepes_admin_token');
    const raw = localStorage.getItem('sipepes_admin_user');
    if (token && raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed) return parsed;
      } catch (e) {
        // ignore
      }
    }
    return null;
  });

  // Selected report for Master-Detail verification view
  const [selectedReportId, setSelectedReportId] = useState(
    initialReports[0]?.id || null
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [districtFilter, setDistrictFilter] = useState('all');
  const [isLoadingReports, setIsLoadingReports] = useState(false);

  // Simpan cache lokal
  useEffect(() => {
    if (reports && reports.length > 0) {
      localStorage.setItem('sipepes_admin_reports_v2', JSON.stringify(reports));
    }
  }, [reports]);

  // Muat data laporan dari API Live
  const refreshReports = useCallback(async (isSilent = false) => {
    if (isMock) return;
    if (!isSilent) setIsLoadingReports(true);

    try {
      const token = localStorage.getItem('sipepes_admin_token');
      if (token) {
        // Mode Admin: Ambil seluruh antrean laporan
        const res = await reportsService.getAdminReports({ limit: 100 });
        if (res?.success && res.data?.reports) {
          setReports(res.data.reports);
          return;
        }
      }

      // Mode Publik: Ambil laporan publik tervalidasi
      const pubRes = await reportsService.getPublicReports();
      if (pubRes?.success && Array.isArray(pubRes.data)) {
        setReports(prev => {
          const apiIds = new Set(pubRes.data.map(r => String(r.id)));
          // Pertahankan laporan lokal yang belum ada di API
          const localOnly = prev.filter(r => !apiIds.has(String(r.id)));
          return [...pubRes.data, ...localOnly];
        });
      }
    } catch (err) {
      console.warn('Sinkronisasi API gagal, tetap menggunakan state lokal:', err.message);
    } finally {
      if (!isSilent) setIsLoadingReports(false);
    }
  }, []);

  // Inisialisasi awal saat AdminProvider terpasang atau status auth berganti
  useEffect(() => {
    refreshReports(false);
  }, [refreshReports, adminUser?.id]);

  // Listener Realtime Supabase + Polling Fallback 20 Detik
  useEffect(() => {
    let channel = null;

    if (supabase && !isMock) {
      try {
        channel = supabase
          .channel('admin_context_reports')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'reports' },
            () => {
              refreshReports(true);
            }
          )
          .subscribe();
      } catch (err) {
        console.warn('Supabase Realtime channel error:', err);
      }
    }

    const interval = setInterval(() => {
      refreshReports(true);
    }, 20000);

    return () => {
      clearInterval(interval);
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [refreshReports]);

  const login = async (email, password, accountName) => {
    // 1. Coba otentikasi via API Live jika tidak dalam mode mock
    if (!isMock) {
      try {
        const res = await authService.login(email, password);
        if (res.success && res.data?.user) {
          const u = res.data.user;
          const userObj = {
            id: u.id,
            username: u.email,
            full_name: u.full_name || u.name || 'Admin GG River Care',
            role: u.role || 'admin',
            email: u.email,
            unit_kerja: accountName || 'Tim Relawan GG River Care'
          };
          localStorage.setItem('sipepes_admin_user', JSON.stringify(userObj));
          setAdminUser(userObj);
          refreshReports(false);
          return { success: true };
        }
      } catch (apiErr) {
        console.warn('API backend login gagal, mengecek fallback offline:', apiErr.message);
      }
    }

    // 2. Fallback validasi offline/mock
    try {
      const mockRes = await mockAdapter.login(email, password);
      if (mockRes.success) {
        const userObj = {
          ...mockAdminUser,
          username: email,
          email: email,
          unit_kerja: accountName || mockAdminUser.unit_kerja
        };
        localStorage.setItem('sipepes_admin_user', JSON.stringify(userObj));
        setAdminUser(userObj);
        return { success: true };
      }
    } catch (err) {
      return { success: false, message: err.message || 'Kombinasi Email dan password tidak valid.' };
    }

    return { success: false, message: 'Kombinasi Email dan password tidak valid.' };
  };

  const logout = () => {
    authService.logout();
    setAdminUser(null);
  };

  const addReport = (newReportData) => {
    const trackingCode = `MUSI-${Math.floor(1000 + Math.random() * 9000)}`;
    const newReport = {
      id: newReportData.id || `rep-${Date.now()}`,
      tracking_code: newReportData.tracking_code || trackingCode,
      title: newReportData.title || 'Laporan Baru Warga',
      description: newReportData.description || '',
      category: newReportData.category || 'Sampah Plastik / Domestik',
      pollution_type: newReportData.pollution_type || 'sampah_domestik',
      estimated_severity: newReportData.estimated_severity || 'sedang',
      latitude: newReportData.latitude || -2.9904,
      longitude: newReportData.longitude || 104.7565,
      address_landmark: newReportData.address_landmark || 'Dermaga 7 Ulu, Seberang Ulu I',
      district: newReportData.district || 'Seberang Ulu I',
      status: newReportData.status || 'menunggu',
      created_at: newReportData.created_at || new Date().toISOString(),
      reporter_name: newReportData.is_anonymous ? 'Anonim (Warga Palembang)' : (newReportData.reporter_name || 'Warga Palembang'),
      reporter_contact: newReportData.is_anonymous ? 'Disembunyikan' : (newReportData.reporter_contact || '+62 812-xxxx-xxxx'),
      reporter_source: 'Via Portal Pelaporan Warga',
      photo_url: newReportData.photo_url || 'https://images.unsplash.com/photo-1621451537084-482c73073a0f?auto=format&fit=crop&w=800&q=80'
    };

    setReports(prev => [newReport, ...prev]);
    return newReport;
  };

  const verifyReport = async (id, newStatus, severity, notes, rejectionReason = '') => {
    // 1. Optimistic Update Local State
    setReports(prevReports =>
      prevReports.map(rep => {
        if (String(rep.id) === String(id)) {
          return {
            ...rep,
            status: newStatus,
            official_severity: severity || rep.estimated_severity,
            estimated_severity: severity || rep.estimated_severity,
            rejection_reason: newStatus === 'ditolak' ? rejectionReason : null,
            admin_notes: notes || rep.admin_notes,
            verified_by: adminUser?.full_name || 'Admin GG River Care',
            verified_at: new Date().toISOString()
          };
        }
        return rep;
      })
    );

    // 2. Kirim ke API Live Backend jika aktif
    if (!isMock) {
      try {
        await reportsService.verifyReport(id, {
          status: newStatus,
          official_severity: severity,
          notes: notes || rejectionReason || 'Verifikasi oleh Admin GG River Care',
        });
      } catch (apiErr) {
        console.warn('Gagal sinkronisasi verifikasi ke API backend:', apiErr.message);
      }
    }
  };

  // Metrik Laporan Dinamis
  const totalReports = reports.length;
  const menungguCount = reports.filter(r => r.status === 'menunggu').length;
  const validCount = reports.filter(r => r.status === 'valid' || r.status === 'terverifikasi').length;
  const ditolakCount = reports.filter(r => r.status === 'ditolak').length;

  const stats = {
    totalMasuk: totalReports,
    persenKenaikan: '+14%',
    subMasuk: `${totalReports} Total Masuk`,
    antreanVerifikasi: menungguCount,
    urgentCount: reports.filter(r => r.status === 'menunggu' && r.is_urgent).length,
    terverifikasiValid: validCount,
    persenValid: totalReports > 0 ? `${Math.round((validCount / totalReports) * 100)}% valid` : '0%',
    subValid: 'Terbit di Peta Publik',
    laporanDitolak: ditolakCount,
    persenDitolak: totalReports > 0 ? `${Math.round((ditolakCount / totalReports) * 100)}% total` : '0%',
    subDitolak: 'Terdokumentasi rapi',
    // Dynamic counts
    menunggu: menungguCount,
    valid: validCount,
    ditolak: ditolakCount
  };

  const selectedReport = reports.find(r => String(r.id) === String(selectedReportId)) || reports[0];

  return (
    <AdminContext.Provider
      value={{
        adminUser,
        login,
        logout,
        reports,
        refreshReports,
        isLoadingReports,
        stats,
        selectedReportId,
        setSelectedReportId,
        selectedReport,
        addReport,
        verifyReport,
        searchQuery,
        setSearchQuery,
        statusFilter,
        setStatusFilter,
        severityFilter,
        setSeverityFilter,
        districtFilter,
        setDistrictFilter,
        sempadanList,
        auditLogs,
        advocacyArchives,
        weeklyTrendData,
        wasteComposition,
        criticalPoints
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin harus digunakan di dalam AdminProvider');
  }
  return context;
}
