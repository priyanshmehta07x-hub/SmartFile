import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity, AlertTriangle, ArrowRight, Bell, Building2, Check, CheckCheck,
  ChevronDown, ChevronRight, Clock3, Download, FileCheck2,
  FileClock, Files, Filter, HelpCircle, LayoutDashboard, LogOut, Menu,
  MessageSquareText, Plus, Search, Settings, ShieldCheck, X
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import './reliability.css';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:8080/api').replace(/\/$/, '');
const accounts = {
  citizenA: { label: 'Citizen A', role: 'Citizen', email: 'citizen@smartfile.demo', name: 'Rahul Sharma' },
  citizenB: { label: 'Citizen B', role: 'Citizen', email: 'citizen-b@smartfile.demo', name: 'Ananya Iyer' },
  clerk: { label: 'Clerk', role: 'Clerk', email: 'clerk@smartfile.demo', name: 'Priya Nair' },
  officer: { label: 'Officer', role: 'Officer', email: 'officer@smartfile.demo', name: 'Arjun Kapoor' },
  admin: { label: 'Admin', role: 'Admin', email: 'admin@smartfile.demo', name: 'Aarav Mehta' }
};
const pageItems = [
  ['Overview', LayoutDashboard], ['Apply Application', Plus], ['All applications', Files], ['Track a file', Search],
  ['Workflow', Activity], ['Smart Document Verification', ShieldCheck], ['Complaints', MessageSquareText], ['Departments', Building2],
  ['Audit log', ShieldCheck], ['Settings', Settings]
];
const completedStatuses = new Set([
  'final approved by officer', 'rejected by clerk', 'rejected by officer',
  'approved', 'rejected', 'cancelled'
]);
const clerkReviewStatuses = new Set([
  'submitted', 'under review by clerk', 'verified by clerk', 'returned', 'documents requested'
]);
const officerReviewStatuses = new Set([
  'pending with officer'
]);
const legacyClerkStatuses = new Set([
  'approved', 'final approval', 'finance review', 'officer review',
  'document check', 'submitted', 'clerk verification', 'rejected'
]);
const legacyOfficerStatuses = new Set([
  'approved by clerk', 'forwarded to admin', 'pending with admin',
  'final approved by admin', 'rejected by admin'
]);
const movementLabels = {
  SUBMITTED: 'Application submitted by Citizen',
  ASSIGNED_TO_CLERK: 'File received by Clerk',
  CLERK_VERIFIED: 'Verified by Clerk',
  FORWARDED_TO_OFFICER: 'Forwarded to Officer',
  ASSIGNED_TO_OFFICER: 'Pending with Officer',
  CLERK_REJECTED: 'Application rejected by Clerk',
  OFFICER_FINAL_APPROVED: 'Final Approved by Officer',
  OFFICER_REJECTED: 'Rejected by Officer',
  RETURNED_TO_CITIZEN: 'File returned to Citizen',
  DOCUMENTS_REQUESTED: 'Additional documents requested',
  CITIZEN_RESUBMITTED: 'Updated application resubmitted by Citizen',
  MIGRATED_TO_CLERK_REVIEW: 'File assigned to Clerk review',
  MIGRATED_TO_OFFICER_REVIEW: 'File reassigned to Officer for final decision'
};
const fallbackRows = [
  ['Scholarship application', 'Rahul Sharma', 'Education', 'Under Review by Clerk', 'High', 2],
  ['Building permit renewal', 'Ananya Iyer', 'Urban Development', 'Pending with Officer', 'Normal', 1],
  ['Senior citizen pension', 'Mohan Das', 'Social Welfare', 'Documents requested', 'Normal', 4],
  ['Business registration', 'Aditi Verma', 'Commerce', 'Final Approved by Officer', 'High', 3],
  ['Water connection request', 'Farhan Ali', 'Public Works', 'Rejected by Officer', 'Low', 2],
  ['Land record correction', 'Meera Nair', 'Revenue', 'Returned', 'Normal', 7]
];

function isCompletedStatus(status) {
  return completedStatuses.has(String(status || '').trim().toLowerCase());
}

function canReviewApplication(role, status) {
  const normalized = String(status || '').trim().toLowerCase();
  return role === 'Clerk' ? clerkReviewStatuses.has(normalized)
    : role === 'Officer' && officerReviewStatuses.has(normalized);
}

function formatHolder(file) {
  if (!file.assignedOfficer) return isCompletedStatus(file.status) ? 'No active handler' : 'Citizen';
  const role = file.assignedOfficerRole === 'CLERK' ? 'Clerk'
    : file.assignedOfficerRole === 'OFFICER' ? 'Officer' : 'Staff';
  return `${file.assignedOfficer} (${role})`;
}

function makeFallbackFiles() {
  const now = Date.now();
  return fallbackRows.map(([title, applicant, dept, status, priority, days], index) => {
    const submittedAt = new Date(now - days * 86_400_000).toISOString();
    return {
      id: `SF-${new Date(now).getUTCFullYear()}-${String(41 - index).padStart(4, '0')}`,
      title, applicant, dept, status, priority,
      ownerEmail: index === 0 ? accounts.citizenA.email : index === 1 ? accounts.citizenB.email : null,
      currentStage: status,
      assignedOfficer: ['Under Review by Clerk', 'Verified by Clerk'].includes(status)
        ? accounts.clerk.name
        : ['Pending with Officer', 'Final Approved by Officer', 'Rejected by Officer'].includes(status)
          ? accounts.officer.name : null,
      assignedOfficerRole: ['Under Review by Clerk', 'Verified by Clerk'].includes(status)
        ? 'CLERK'
        : ['Pending with Officer', 'Final Approved by Officer', 'Rejected by Officer'].includes(status)
          ? 'OFFICER' : null,
      submittedAt,
      updatedAt: submittedAt,
      deadline: new Date(now + (2 - days) * 86_400_000).toISOString()
    };
  });
}

function makeFallbackAudit(files) {
  const rows = [];
  function add(file, offsetSeconds, actorEmail, action, remarks) {
    rows.push({
      id: `${file.id}-${action}`,
      application: { fileId: file.id },
      actorEmail,
      action,
      remarks,
      createdAt: new Date(new Date(file.submittedAt).getTime() + offsetSeconds * 1000).toISOString()
    });
  }
  files.forEach(file => {
    add(file, 0, file.ownerEmail || 'system@smartfile.demo', 'SUBMITTED', 'Application received');
    const status = file.status.toLowerCase();
    const stage = String(file.currentStage || '').toLowerCase();
    if (status === 'under review by clerk' || status === 'verified by clerk'
      || stage === 'pending with officer' || status === 'pending with officer'
      || status === 'final approved by officer' || status === 'rejected by clerk'
      || status === 'rejected by officer'
      || status === 'returned' || status === 'documents requested') {
      add(file, 5, 'system@smartfile.demo', 'ASSIGNED_TO_CLERK', 'File assigned to Clerk review');
    }
    if (status === 'verified by clerk' || stage === 'pending with officer'
      || status === 'pending with officer' || status === 'final approved by officer'
      || status === 'rejected by officer') {
      add(file, 10, 'clerk@smartfile.demo', 'CLERK_VERIFIED', 'Documents verified');
    }
    if (stage === 'pending with officer' || status === 'pending with officer'
      || status === 'final approved by officer' || status === 'rejected by officer') {
      add(file, 15, 'clerk@smartfile.demo', 'FORWARDED_TO_OFFICER', `Forwarded to ${accounts.officer.name}`);
      add(file, 20, 'system@smartfile.demo', 'ASSIGNED_TO_OFFICER', `File assigned to ${accounts.officer.name}`);
    } else if (status === 'rejected by clerk') {
      add(file, 10, 'clerk@smartfile.demo', 'CLERK_REJECTED', 'Rejected during Clerk review');
    } else if (status === 'returned') {
      add(file, 10, 'clerk@smartfile.demo', 'RETURNED_TO_CITIZEN', 'Changes requested');
    } else if (status === 'documents requested') {
      add(file, 10, 'clerk@smartfile.demo', 'DOCUMENTS_REQUESTED', 'Additional documents requested');
    }
    if (status === 'final approved by officer') {
      add(file, 25, accounts.officer.email, 'OFFICER_FINAL_APPROVED', 'Final approval completed');
    } else if (status === 'rejected by officer') {
      add(file, 25, accounts.officer.email, 'OFFICER_REJECTED', 'Rejected by Officer');
    }
  });
  return rows.sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
}

function mergeLocalAudit(files, stored) {
  const existingActions = new Set(stored.map(row => `${row.application?.fileId}:${row.action}`));
  const missingSeedEvents = makeFallbackAudit(files)
    .filter(row => !existingActions.has(`${row.application?.fileId}:${row.action}`));
  return [...stored, ...missingSeedEvents].sort((left, right) =>
    new Date(right.createdAt) - new Date(left.createdAt));
}

function readStorage(key, fallback) {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(key);
    return fallback;
  }
}

function readArrayStorage(key, fallback) {
  const stored = readStorage(key, fallback);
  if (Array.isArray(stored)) return stored;
  localStorage.removeItem(key);
  return fallback;
}

function normalizeFile(file) {
  const rawStatus = file.status || 'Submitted';
  const normalizedRawStatus = rawStatus.trim().toLowerCase();
  const clerkLegacy = legacyClerkStatuses.has(normalizedRawStatus);
  const officerLegacy = legacyOfficerStatuses.has(normalizedRawStatus);
  const status = clerkLegacy ? 'Under Review by Clerk'
    : officerLegacy ? 'Pending with Officer' : rawStatus;
  const currentStage = clerkLegacy ? 'Under Review by Clerk'
    : officerLegacy ? 'Pending with Officer' : file.currentStage || status;
  const assignedOfficerRole = file.assignedOfficerRole
    || (['Pending with Officer', 'Final Approved by Officer', 'Rejected by Officer'].includes(currentStage) ? 'OFFICER'
      : ['Under Review by Clerk', 'Verified by Clerk'].includes(currentStage) ? 'CLERK' : null);
  return {
    id: file.fileId || file.id,
    title: file.applicationType || file.title || 'Application',
    applicant: file.applicantName || file.applicant || '—',
    ownerEmail: file.ownerEmail || null,
    assignedOfficerEmail: file.assignedOfficerEmail || null,
    dept: file.department?.name || file.department || file.dept || '—',
    status,
    priority: file.priority || 'Normal',
    currentStage,
    assignedOfficer: clerkLegacy ? accounts.clerk.name
      : officerLegacy ? accounts.officer.name
        : file.assignedOfficer || (['Pending with Officer', 'Final Approved by Officer', 'Rejected by Officer'].includes(currentStage) ? accounts.officer.name
          : ['Under Review by Clerk', 'Verified by Clerk'].includes(currentStage) ? accounts.clerk.name : null),
    assignedOfficerRole,
    submittedAt: file.submittedAt || file.createdAt || null,
    updatedAt: file.updatedAt || file.submittedAt || file.createdAt || null,
    deadline: file.deadline || null
  };
}

function formatDateTime(value, options = {}) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  const usesDateParts = ['weekday', 'year', 'month', 'day', 'hour', 'minute', 'second']
    .some(part => part in options);
  return new Intl.DateTimeFormat(undefined, {
    ...(usesDateParts ? {} : { dateStyle: 'medium', timeStyle: 'short' }),
    ...options
  }).format(date);
}

function relativeTime(value, now) {
  if (!value) return '—';
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return 'Date unavailable';
  const minutes = Math.round((timestamp - now) / 60_000);
  const absolute = Math.abs(minutes);
  if (absolute < 1) return 'Just now';
  if (absolute < 60) return minutes < 0 ? `${absolute}m ago` : `in ${absolute}m`;
  const hours = Math.round(absolute / 60);
  if (hours < 24) return minutes < 0 ? `${hours}h ago` : `in ${hours}h`;
  const days = Math.round(hours / 24);
  return minutes < 0 ? `${days}d ago` : `in ${days}d`;
}

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, options);
  const rawBody = await response.text();
  let body = null;
  if (rawBody) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      if (response.ok) throw new Error('The server returned an invalid response.');
    }
  }
  if (!response.ok) {
    throw new Error(body?.error || rawBody || `Request failed (${response.status})`);
  }
  if (body === null && response.status !== 204) {
    throw new Error('The server returned an empty response.');
  }
  return body;
}

function App() {
  const [role, setRole] = useState(localStorage.getItem('smartfile.role') || 'Admin');
  const [email, setEmail] = useState(localStorage.getItem('smartfile.email') || '');
  const [token, setToken] = useState(localStorage.getItem('smartfile.token') || '');
  const [mode, setMode] = useState(() => localStorage.getItem('smartfile.mode') === 'api' && localStorage.getItem('smartfile.token') ? 'api' : 'demo');
  const [page, setPage] = useState('Overview');
  const [files, setFiles] = useState(() => localStorage.getItem('smartfile.mode') === 'api' && localStorage.getItem('smartfile.token')
    ? []
    : readArrayStorage('smartfile.files', makeFallbackFiles()).map(normalizeFile));
  const [complaints, setComplaints] = useState(() => readArrayStorage('smartfile.complaints', []));
  const [audit, setAudit] = useState(() =>
    mergeLocalAudit(files, readArrayStorage('smartfile.audit', [])));
  const [departmentNames, setDepartmentNames] = useState([]);
  const [officers, setOfficers] = useState([accounts.officer]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [modal, setModal] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [apiUp, setApiUp] = useState(false);
  const [clockOffset, setClockOffset] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [dark, setDark] = useState(() => localStorage.getItem('smartfile.dark') === 'true');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [trackQuery, setTrackQuery] = useState(new URLSearchParams(location.search).get('track') || '');
  const [trackedFile, setTrackedFile] = useState(null);
  const [trackingHistory, setTrackingHistory] = useState([]);
  const noticeTimer = useRef(null);

  const displayNow = now + clockOffset;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local time';
  const userName = email ? (Object.values(accounts).find(user => user.email === email)?.name || email) : 'Demo workspace';
  const accountId = Object.entries(accounts).find(([, user]) => user.email === email)?.[0] || '';
  const accountFiles = useMemo(() => role === 'Citizen' && mode === 'demo'
    ? files.filter(file => file.ownerEmail === email)
    : files, [files, role, mode, email]);
  const ownFileIds = useMemo(() => new Set(accountFiles.map(file => file.id)), [accountFiles]);
  const visibleComplaints = useMemo(() => role === 'Citizen' && mode === 'demo'
    ? complaints.filter(complaint => complaint.ownerEmail === email)
    : complaints, [complaints, role, mode, email]);
  const visibleAudit = useMemo(() => role === 'Citizen' && mode === 'demo'
    ? audit.filter(row => row.actorEmail === email || ownFileIds.has(row.application?.fileId))
    : audit, [audit, role, mode, email, ownFileIds]);
  const filteredFiles = useMemo(() => accountFiles.filter(file => {
    const text = `${file.id} ${file.title} ${file.applicant} ${file.dept} ${file.status}`.toLowerCase();
    const matchesText = text.includes(query.toLowerCase());
    const status = file.status.toLowerCase();
    const matchesStatus = statusFilter === 'All'
      || (statusFilter === 'In review' && !isCompletedStatus(status))
      || (statusFilter === 'Overdue' && file.deadline && new Date(file.deadline).getTime() < displayNow && !isCompletedStatus(status))
      || (statusFilter === 'Completed' && isCompletedStatus(status));
    return matchesText && matchesStatus;
  }), [accountFiles, query, statusFilter, displayNow]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    let active = true;
    const syncClock = async () => {
      const started = Date.now();
      try {
        const health = await request('/health');
        const finished = Date.now();
        if (!active) return;
        const serverTimestamp = Date.parse(health.serverTimeUtc);
        if (Number.isFinite(serverTimestamp)) {
          setClockOffset(serverTimestamp - (started + finished) / 2);
        }
        setApiUp(true);
      } catch {
        if (active) {
          setApiUp(false);
          setClockOffset(0);
        }
      }
    };
    syncClock();
    const sync = window.setInterval(syncClock, 30_000);
    return () => {
      active = false;
      window.clearInterval(tick);
      window.clearInterval(sync);
    };
  }, []);

  useEffect(() => {
    if (!token || mode !== 'api') return;
    let active = true;
    async function loadData() {
      try {
        const [applications, complaintRows, auditRows, departments, availableOfficers] = await Promise.all([
          request('/applications', { headers: { Authorization: `Bearer ${token}` } }),
          request('/complaints', { headers: { Authorization: `Bearer ${token}` } }),
          request('/audit', { headers: { Authorization: `Bearer ${token}` } }),
          request('/departments', { headers: { Authorization: `Bearer ${token}` } }),
          role === 'Clerk'
            ? request('/officers', { headers: { Authorization: `Bearer ${token}` } })
            : Promise.resolve([])
        ]);
        if (!active) return;
        setFiles(applications.map(normalizeFile));
        setComplaints(complaintRows);
        setAudit(auditRows);
        setDepartmentNames(departments.map(department => department.name));
        setOfficers(availableOfficers);
        setError('');
      } catch (reason) {
        if (active) setError(`Could not load saved data: ${reason.message}`);
      }
    }
    loadData();
    const interval = window.setInterval(loadData, 30_000);
    window.addEventListener('focus', loadData);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', loadData);
    };
  }, [token, mode, role]);

  useEffect(() => {
    if (mode !== 'demo') return;
    try {
      localStorage.setItem('smartfile.files', JSON.stringify(files));
      localStorage.setItem('smartfile.complaints', JSON.stringify(complaints));
      localStorage.setItem('smartfile.audit', JSON.stringify(audit));
    } catch {
      setError('Changes could not be saved in this browser. Check available storage.');
    }
  }, [files, complaints, audit, mode]);

  useEffect(() => {
    const onKeyDown = event => {
      if (event.key === 'Escape') setModal(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => () => {
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
  }, []);

  useEffect(() => {
    const fileId = new URLSearchParams(location.search).get('track');
    if (!fileId) return;
    let active = true;
    setTrackQuery(fileId);
    setPage('Track a file');
    setTrackedFile(null);
    setTrackingHistory([]);
    if (mode === 'demo') {
      const localFile = files.find(file => file.id.toLowerCase() === fileId.toLowerCase()
        && (role !== 'Citizen' || file.ownerEmail === email));
      if (localFile) {
        setTrackedFile(localFile);
        setTrackingHistory(audit.filter(row => row.application?.fileId === localFile.id).slice().reverse());
      }
    } else if (token) {
      const headers = { Authorization: `Bearer ${token}` };
      Promise.all([
        request(`/track/${encodeURIComponent(fileId)}`, { headers }),
        request(`/applications/${encodeURIComponent(fileId)}/history`, { headers })
      ])
        .then(([result, history]) => {
          if (active) {
            setTrackedFile(normalizeFile(result));
            setTrackingHistory(history);
          }
        })
        .catch(reason => { if (active) setError(`Tracking failed: ${reason.message}`); });
    }
    return () => { active = false; };
  }, [mode, token, email, role]);

  useEffect(() => {
    if (!trackedFile || mode !== 'demo') return;
    setTrackingHistory(audit.filter(row => row.application?.fileId === trackedFile.id).slice().reverse());
  }, [audit, mode, trackedFile?.id]);

  useEffect(() => {
    if (!trackedFile || mode !== 'api' || !token) return;
    let active = true;
    const refreshTracking = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [result, history] = await Promise.all([
          request(`/track/${encodeURIComponent(trackedFile.id)}`, { headers }),
          request(`/applications/${encodeURIComponent(trackedFile.id)}/history`, { headers })
        ]);
        if (active) {
          setTrackedFile(normalizeFile(result));
          setTrackingHistory(history);
        }
      } catch (reason) {
        if (active) setError(`Tracking refresh failed: ${reason.message}`);
      }
    };
    const interval = window.setInterval(refreshTracking, 30_000);
    window.addEventListener('focus', refreshTracking);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshTracking);
    };
  }, [trackedFile?.id, mode, token]);

  useEffect(() => {
    if (!trackedFile) return;
    const latest = accountFiles.find(file => file.id === trackedFile.id);
    if (latest) setTrackedFile(latest);
  }, [accountFiles, trackedFile?.id]);

  function notify(message) {
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    setNotice(message);
    noticeTimer.current = window.setTimeout(() => setNotice(''), 3500);
  }

  function navigate(nextPage) {
    setPage(nextPage);
    setMobileMenu(false);
    setError('');
  }

  async function signIn(selectedRole) {
    setBusy(true);
    setError('');
    const selectedUser = accounts[selectedRole];
    if (!selectedUser) {
      setError('That account is not available.');
      setBusy(false);
      return;
    }
    try {
      const result = await request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: selectedUser.email, password: 'SmartFile@2026' })
      });
      const roleLabels = { CITIZEN: 'Citizen', CLERK: 'Clerk', OFFICER: 'Officer', ADMIN: 'Admin' };
      const signedInRole = roleLabels[result.role] || selectedUser.role;
      setFiles([]);
      setComplaints([]);
      setAudit([]);
      setDepartmentNames([]);
      setOfficers([]);
      setTrackedFile(null);
      setTrackingHistory([]);
      setQuery('');
      setStatusFilter('All');
      localStorage.setItem('smartfile.token', result.token);
      localStorage.setItem('smartfile.mode', 'api');
      localStorage.setItem('smartfile.role', signedInRole);
      localStorage.setItem('smartfile.email', result.email);
      setToken(result.token);
      setMode('api');
      setRole(signedInRole);
      setEmail(result.email);
      setModal(null);
      notify(`Signed in as ${selectedUser.label}`);
    } catch (reason) {
      if (!apiUp && reason instanceof TypeError) {
        const localFiles = readArrayStorage('smartfile.files', makeFallbackFiles()).map(normalizeFile);
        setFiles(localFiles);
        setOfficers([accounts.officer]);
        setComplaints(readArrayStorage('smartfile.complaints', []));
        setAudit(mergeLocalAudit(localFiles, readArrayStorage('smartfile.audit', [])));
        setTrackedFile(null);
        setTrackingHistory([]);
        setQuery('');
        setStatusFilter('All');
        localStorage.removeItem('smartfile.token');
        localStorage.setItem('smartfile.mode', 'demo');
        localStorage.setItem('smartfile.role', selectedUser.role);
        localStorage.setItem('smartfile.email', selectedUser.email);
        setToken('');
        setMode('demo');
        setRole(selectedUser.role);
        setEmail(selectedUser.email);
        setModal(null);
        notify(`API unavailable: using local demo data for ${selectedUser.label}.`);
      } else {
        setError(`Sign-in failed: ${reason.message}`);
      }
    } finally {
      setBusy(false);
    }
  }

  function signOut() {
    const localFiles = readArrayStorage('smartfile.files', makeFallbackFiles()).map(normalizeFile);
    setFiles(localFiles);
    setOfficers([accounts.officer]);
    setComplaints(readArrayStorage('smartfile.complaints', []));
    setAudit(mergeLocalAudit(localFiles, readArrayStorage('smartfile.audit', [])));
    setTrackedFile(null);
    setTrackingHistory([]);
    setQuery('');
    setStatusFilter('All');
    ['smartfile.token', 'smartfile.mode', 'smartfile.role', 'smartfile.email'].forEach(key => localStorage.removeItem(key));
    setToken('');
    setMode('demo');
    setRole('Admin');
    setEmail('');
    setModal(null);
    notify('Signed out');
  }

  async function submitApplication(form) {
    setBusy(true);
    try {
      let file;
      if (mode === 'api' && token) {
        const response = await request('/applications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(form)
        });
        file = normalizeFile(response);
      } else {
        const year = new Date(displayNow).getUTCFullYear();
        const prefix = `SF-${year}-`;
        const maxId = files.reduce((max, row) => row.id.startsWith(prefix)
          ? Math.max(max, Number(row.id.slice(prefix.length)) || 0) : max, 0);
        file = normalizeFile({
          ...form,
          ownerEmail: role === 'Citizen' ? email : null,
          fileId: `${prefix}${String(maxId + 1).padStart(4, '0')}`,
          status: 'Under Review by Clerk',
          currentStage: 'Under Review by Clerk',
          assignedOfficer: 'Clerk',
          submittedAt: new Date(displayNow).toISOString(),
          updatedAt: new Date(displayNow).toISOString(),
          deadline: new Date(displayNow + 2 * 86_400_000).toISOString()
        });
        appendAudit(file, 'SUBMITTED', 'Application received');
        appendAudit(file, 'ASSIGNED_TO_CLERK', 'File assigned to Clerk review');
      }
      setFiles(current => [file, ...current]);
      await refreshAudit();
      setModal(null);
      notify(`Application saved · ${file.id}`);
    } catch (reason) {
      setError(`Application was not saved: ${reason.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function editApplication(file, form) {
    setBusy(true);
    try {
      let updated;
      if (mode === 'api' && token) {
        const response = await request(`/applications/${encodeURIComponent(file.id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(form)
        });
        updated = normalizeFile(response);
      } else {
        updated = { ...file, title: form.applicationType, applicant: form.applicantName, dept: form.department, priority: form.priority, updatedAt: new Date(displayNow).toISOString() };
        appendAudit(updated, 'UPDATED', 'Application details updated');
      }
      setFiles(current => current.map(item => item.id === file.id ? updated : item));
      await refreshAudit();
      setModal(null);
      notify(`Application saved · ${file.id}`);
    } catch (reason) {
      setError(`Application was not updated: ${reason.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function cancelApplication(file) {
    setBusy(true);
    try {
      let updated;
      if (mode === 'api' && token) {
        const response = await request(`/applications/${encodeURIComponent(file.id)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        updated = normalizeFile(response);
      } else {
        updated = { ...file, status: 'Cancelled', currentStage: 'Cancelled', updatedAt: new Date(displayNow).toISOString() };
        appendAudit(updated, 'CANCELLED', 'Application cancelled');
      }
      setFiles(current => current.map(item => item.id === file.id ? updated : item));
      await refreshAudit();
      setModal(null);
      notify(`Application cancelled · ${file.id}`);
    } catch (reason) {
      setError(`Application was not cancelled: ${reason.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function submitComplaint(form) {
    setBusy(true);
    try {
      let complaint;
      if (mode === 'api' && token) {
        complaint = await request('/complaints', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(form)
        });
      } else {
        complaint = {
          complaintId: `CMP-${String(Date.now()).slice(-6)}`,
          ownerEmail: role === 'Citizen' ? email : null,
          applicantName: form.applicantName,
          category: form.category,
          description: form.description,
          status: 'Open',
          createdAt: new Date(displayNow).toISOString()
        };
        appendAudit(complaint, 'COMPLAINT_SUBMITTED', form.category);
      }
      setComplaints(current => [complaint, ...current]);
      setModal(null);
      notify(`Complaint submitted · ${complaint.complaintId}`);
    } catch (reason) {
      setError(`Complaint was not saved: ${reason.message}`);
    } finally {
      setBusy(false);
    }
  }

  function appendAudit(item, action, remarks, actorEmail = email || 'local-demo') {
    const row = {
      id: `${Date.now()}-${Math.random()}`,
      application: { fileId: item.id || item.fileId || item.complaintId },
      actorEmail,
      action, remarks, createdAt: new Date(displayNow).toISOString()
    };
    setAudit(current => [row, ...current]);
  }

  async function refreshAudit() {
    if (mode !== 'api' || !token) return;
    try {
      const rows = await request('/audit', { headers: { Authorization: `Bearer ${token}` } });
      setAudit(rows);
    } catch (reason) {
      setError(`The record was saved, but audit history could not be refreshed: ${reason.message}`);
    }
  }

  async function applyWorkflowAction(file, action, remarks, assignedOfficerEmail) {
    if (!canReviewApplication(role, file.status)) {
      setError('This application is not waiting for review by your account.');
      return;
    }
    setBusy(true);
    try {
      let updated;
      if (mode === 'api' && token) {
        const response = await request(`/applications/${encodeURIComponent(file.id)}/actions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action, remarks, assignedOfficerEmail })
        });
        updated = normalizeFile(response);
      } else {
        const updates = {
          VERIFY: {
            status: 'Verified by Clerk',
            stage: 'Verified by Clerk',
            officer: accounts.clerk.name,
            officerRole: 'CLERK',
            event: 'CLERK_VERIFIED'
          },
          FORWARD: {
            status: 'Pending with Officer',
            stage: 'Pending with Officer',
            officer: officers.find(officer => officer.email === assignedOfficerEmail)?.name || accounts.officer.name,
            officerEmail: assignedOfficerEmail || accounts.officer.email,
            officerRole: 'OFFICER',
            event: 'FORWARDED_TO_OFFICER'
          },
          REJECT: role === 'Clerk'
            ? { status: 'Rejected by Clerk', stage: 'Rejected by Clerk', officer: null, officerRole: null, event: 'CLERK_REJECTED' }
            : {
              status: 'Rejected by Officer',
              stage: 'Rejected by Officer',
              officer: accounts.officer.name,
              officerRole: 'OFFICER',
              event: 'OFFICER_REJECTED'
            },
          FINAL_APPROVE: {
            status: 'Final Approved by Officer',
            stage: 'Final Approved by Officer',
            officer: accounts.officer.name,
            officerRole: 'OFFICER',
            event: 'OFFICER_FINAL_APPROVED'
          },
          RETURN: { status: 'Returned', stage: 'Returned to Citizen', officer: null, officerRole: null, event: 'RETURNED_TO_CITIZEN' },
          REQUEST_DOCUMENTS: { status: 'Documents requested', stage: 'Awaiting documents from Citizen', officer: null, officerRole: null, event: 'DOCUMENTS_REQUESTED' }
        };
        const transition = updates[action];
        if (!transition) throw new Error('Unsupported workflow action.');
        updated = {
          ...file,
          status: transition.status,
          currentStage: transition.stage,
          assignedOfficer: transition.officer,
          assignedOfficerEmail: transition.officerEmail || file.assignedOfficerEmail || null,
          assignedOfficerRole: transition.officerRole,
          updatedAt: new Date(displayNow).toISOString()
        };
        const actionRemarks = action === 'FORWARD'
          ? `Forwarded to Officer ${transition.officer}${remarks ? `. ${remarks}` : ''}`
          : remarks;
        appendAudit(file, transition.event, actionRemarks);
        if (action === 'FORWARD') {
          appendAudit(file, 'ASSIGNED_TO_OFFICER', `File assigned to ${transition.officer}`, 'system@smartfile.demo');
        }
      }
      setFiles(current => current.map(item => item.id === file.id ? updated : item));
      await refreshAudit();
      setModal(null);
      notify(`${file.id} updated: ${updated.status}`);
    } catch (reason) {
      setError(`Workflow action was not saved: ${reason.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function trackFile(event) {
    event.preventDefault();
    setError('');
    const id = trackQuery.trim();
    if (!id) {
      setError('Enter an application ID to track.');
      return;
    }
    const localFile = accountFiles.find(file => file.id.toLowerCase() === id.toLowerCase());
    if (mode === 'demo' || !apiUp) {
      setTrackedFile(localFile || null);
      setTrackingHistory(localFile
        ? audit.filter(row => row.application?.fileId === localFile.id).slice().reverse()
        : []);
      if (!localFile) setError('No matching application was found in the local demo data.');
      return;
    }
    setBusy(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [remote, history] = await Promise.all([
        request(`/track/${encodeURIComponent(id)}`, { headers }),
        request(`/applications/${encodeURIComponent(id)}/history`, { headers })
      ]);
      setTrackedFile(normalizeFile(remote));
      setTrackingHistory(history);
      setError('');
    } catch (reason) {
      setTrackedFile(null);
      setTrackingHistory([]);
      setError(`Tracking failed: ${reason.message}`);
    } finally {
      setBusy(false);
    }
  }

  const counts = useMemo(() => ({
    total: accountFiles.length,
    pending: accountFiles.filter(file => !isCompletedStatus(file.status)).length,
    approved: accountFiles.filter(file => file.status.toLowerCase() === 'final approved by officer').length,
    overdue: accountFiles.filter(file => file.deadline && new Date(file.deadline).getTime() < displayNow && !isCompletedStatus(file.status)).length
  }), [accountFiles, displayNow]);

  return <div className={`smart-app${dark ? ' dark-mode' : ''}`}>
    <aside className={`smart-sidebar${mobileMenu ? ' open' : ''}`}>
      <div className="smart-brand"><span className="smart-brand-mark">S</span><span>SmartFile<small>PUBLIC SERVICE PLATFORM</small></span><button className="smart-icon mobile-close" aria-label="Close menu" onClick={() => setMobileMenu(false)}><X/></button></div>
      <div className="smart-org"><Building2/><span><b>Government of India</b><small>Central administration</small></span></div>
      <nav aria-label="Main navigation">
        {pageItems.filter(([label]) => label !== 'Apply Application' || role === 'Citizen').map(([label, Icon]) => <button key={label} className={`smart-nav ${page === label ? 'active' : ''}`} onClick={() => label === 'Apply Application' ? setModal({ type: 'wizard' }) : navigate(label)}><Icon/><span>{label}</span></button>)}
      </nav>
      <div className="smart-side-bottom">
        <button className="smart-help" onClick={() => setModal({ type: 'help' })}><HelpCircle/><span><b>Need a hand?</b><small>Open the help centre</small></span><ArrowRight/></button>
        <button className="smart-profile" onClick={() => setModal({ type: email ? 'profile' : 'login' })}><span className="smart-avatar">{role[0]}</span><span><b>{userName}</b><small>{mode === 'demo' ? `${role} · Local demo` : role}</small></span><ChevronDown/></button>
      </div>
    </aside>
    <main className="smart-main">
      <header className="smart-topbar">
        <button className="smart-icon menu-open" aria-label="Open menu" onClick={() => setMobileMenu(true)}><Menu/></button>
        <div className="smart-crumb"><span>Workspace</span><ChevronRight/><b>{page}</b></div>
        <div className="smart-top-actions">
          <span className={`connection ${apiUp && mode === 'api' ? 'online' : ''}`}><i/>{mode === 'demo' ? 'LOCAL DEMO' : apiUp ? 'API CONNECTED' : 'API OFFLINE'}</span>
          <time className="smart-clock" dateTime={new Date(displayNow).toISOString()} title={`Time zone: ${timeZone}`}>{formatDateTime(new Date(displayNow), { dateStyle: 'medium', timeStyle: 'medium' })}<small>{timeZone}</small></time>
          <button className="smart-icon" aria-label="Toggle dark theme" onClick={() => { const next = !dark; setDark(next); localStorage.setItem('smartfile.dark', String(next)); }}><span>{dark ? '☼' : '◐'}</span></button>
          <button className="smart-icon" aria-label="Notifications" onClick={() => navigate('Audit log')}><Bell/></button>
          <button className="smart-user" onClick={() => setModal({ type: email ? 'profile' : 'login' })}><span className="smart-avatar">{role[0]}</span><span>{userName}<small>{role}</small></span><ChevronDown/></button>
        </div>
      </header>
      <section className="smart-content">
        {!apiUp && <div className="smart-banner" role="status"><AlertTriangle/><span>{mode === 'api' && token ? <><b>API offline</b> — server data cannot currently be read or changed. Write actions will report errors rather than silently saving locally.</> : <><b>Local demo mode</b> — changes are stored in this browser only. Connect the API and database for shared persistence.</>}</span></div>}
        {error && <div className="smart-error" role="alert"><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError('')}><X/></button></div>}
        {page === 'Overview' && <Overview files={filteredFiles} counts={counts} now={displayNow} canReview={file => canReviewApplication(role, file.status)} applyLabel={role === 'Citizen' ? 'Apply Application' : 'New application'} onNew={() => setModal({ type: role === 'Citizen' ? 'wizard' : 'application' })} onNavigate={navigate} onView={file => setModal({ type: 'details', file })} onReview={file => setModal({ type: 'action', file })} onExport={() => exportCsv(filteredFiles)}/>}
        {page === 'All applications' && <Applications files={filteredFiles} query={query} setQuery={setQuery} statusFilter={statusFilter} setStatusFilter={setStatusFilter} now={displayNow} canReview={file => canReviewApplication(role, file.status)} applyLabel={role === 'Citizen' ? 'Apply Application' : 'New application'} onNew={() => setModal({ type: role === 'Citizen' ? 'wizard' : 'application' })} onView={file => setModal({ type: 'details', file })} onReview={file => setModal({ type: 'action', file })} onExport={() => exportCsv(filteredFiles)}/>}
        {page === 'Track a file' && <Tracking query={trackQuery} setQuery={setTrackQuery} file={trackedFile} history={trackingHistory} now={displayNow} busy={busy} onSubmit={trackFile} onView={file => setModal({ type: 'details', file })}/>}
        {page === 'Workflow' && <Workflow files={accountFiles} role={role} onAction={file => setModal({ type: 'action', file })}/>}
        {page === 'Complaints' && <Complaints complaints={visibleComplaints} onNew={() => setModal({ type: 'complaint' })}/>}
        {page === 'Departments' && <Departments files={accountFiles} departmentNames={departmentNames}/>}
        {page === 'Audit log' && <AuditLog rows={visibleAudit} now={displayNow}/>}
        {page === 'Analytics' && <Analytics files={accountFiles} counts={counts} onExport={() => exportCsv(accountFiles)}/>}
        {page === 'Smart Document Verification' && <SmartDocumentVerification />}
        {page === 'Settings' && <SettingsPage dark={dark} setDark={setDark} apiUp={apiUp} timeZone={timeZone} mode={mode}/>}
      </section>
      <footer className="smart-footer"><span>© {new Date(displayNow).getUTCFullYear()} SmartFile</span><span>Clock: {apiUp ? 'server-synchronized' : 'device local'} · {timeZone}</span></footer>
    </main>
    {modal && <Modal key={`${modal.type}:${modal.file?.id || ''}`}
      modal={modal} close={() => { setModal(null); setError(''); }}
      busy={busy} error={error} role={role} userName={userName} email={email} mode={mode} accountId={accountId}
      onSignIn={signIn} onSignOut={signOut}
      onSubmitApplication={submitApplication} onEditApplication={editApplication} onCancelApplication={cancelApplication} onSubmitComplaint={submitComplaint}
      onApplyAction={applyWorkflowAction} onReview={file => setModal({ type: 'action', file })}
      officers={officers}
      onOpenEdit={file => setModal({ type: 'edit', file })} onRequestCancel={file => setModal({ type: 'cancel', file })}
    />}
    {notice && <div className="smart-toast" role="status"><CheckCheck/>{notice}</div>}
    <ChatAssistant/>
  </div>;
}

function PageTitle({ eyebrow, title, description, actions }) {
  return <div className="smart-page-title"><div><div className="smart-eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div><div className="smart-page-actions">{actions}</div></div>;
}

function ActionButton({ children, onClick, variant = '', type = 'button', disabled = false }) {
  return <button type={type} className={`smart-button ${variant}`} onClick={onClick} disabled={disabled}>{children}</button>;
}

function Overview({ files, counts, now, canReview, applyLabel, onNew, onNavigate, onView, onReview, onExport }) {
  return <>
    <PageTitle eyebrow={formatDateTime(new Date(now), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} title="Service overview" description="Current application workload and deadlines." actions={<><ActionButton variant="secondary" onClick={onExport}><Download/>Export CSV</ActionButton><ActionButton onClick={onNew}><Plus/>{applyLabel}</ActionButton></>}/>
    <div className="smart-stats">
      <Stat label="Applications" value={counts.total} icon={<Files/>}/>
      <Stat label="Awaiting action" value={counts.pending} icon={<FileClock/>}/>
      <Stat label="Approved" value={counts.approved} icon={<FileCheck2/>}/>
      <Stat label="Past deadline" value={counts.overdue} icon={<AlertTriangle/>}/>
    </div>
    <section className="smart-panel">
      <div className="smart-panel-head"><div><h2>Recently submitted</h2><p>Sorted by most recent submission time.</p></div><ActionButton variant="link" onClick={() => onNavigate('All applications')}>All applications <ArrowRight/></ActionButton></div>
      <FileTable files={files.slice(0, 8)} now={now} canReview={canReview} onView={onView} onReview={onReview}/>
    </section>
  </>;
}

function Stat({ label, value, icon }) {
  return <div className="smart-stat"><span className="smart-stat-icon">{icon}</span><span>{label}</span><b>{value}</b></div>;
}

function Applications({ files, query, setQuery, statusFilter, setStatusFilter, now, canReview, applyLabel, onNew, onView, onReview, onExport }) {
  return <>
    <PageTitle eyebrow="RECORDS" title="All applications" description="Search, filter, review, and export saved application records." actions={<><ActionButton variant="secondary" onClick={onExport}><Download/>Export CSV</ActionButton><ActionButton onClick={onNew}><Plus/>{applyLabel}</ActionButton></>}/>
    <section className="smart-panel">
      <div className="smart-toolbar">
        <label className="smart-search"><Search/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search ID, applicant, department…"/></label>
        <label className="smart-select"><Filter/><select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option>All</option><option>In review</option><option>Overdue</option><option>Completed</option></select></label>
      </div>
      <FileTable files={files} now={now} canReview={canReview} onView={onView} onReview={onReview}/>
      <div className="smart-pagination">Showing {files.length} matching record{files.length === 1 ? '' : 's'}.</div>
    </section>
  </>;
}

function FileTable({ files, now, canReview, onView, onReview }) {
  if (!files.length) return <div className="smart-empty">No applications match this search.</div>;
  return <div className="smart-table-scroll"><table className="smart-table"><thead><tr><th>FILE ID</th><th>APPLICATION</th><th>APPLICANT</th><th>DEPARTMENT</th><th>STATUS</th><th>SUBMITTED</th><th>UPDATED</th><th>DEADLINE</th><th>ACTIONS</th></tr></thead><tbody>
    {files.map(file => <tr key={file.id}><td className="smart-file-id">{file.id}</td><td>{file.title}</td><td>{file.applicant}</td><td>{file.dept}</td><td><span className={`smart-status ${file.status.toLowerCase().replace(/[^a-z]+/g, '-')}`}>{file.status}</span></td><td title={formatDateTime(file.submittedAt)}>{relativeTime(file.submittedAt, now)}</td><td title={formatDateTime(file.updatedAt)}>{relativeTime(file.updatedAt, now)}</td><td title={formatDateTime(file.deadline)}>{file.deadline ? relativeTime(file.deadline, now) : '—'}</td><td><div className="smart-row-actions"><button onClick={() => onView(file)}>Details</button>{canReview(file) && <button onClick={() => onReview(file)}>Review</button>}</div></td></tr>)}
  </tbody></table></div>;
}

function Tracking({ query, setQuery, file, history, now, busy, onSubmit, onView }) {
  const qrContainer = useRef(null);
  function downloadQr() {
    const svg = qrContainer.current?.querySelector('svg');
    if (!svg || !file) return;
    const markup = new XMLSerializer().serializeToString(svg);
    const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${file.id}-tracking.svg`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <>
    <PageTitle eyebrow="APPLICATION TRACKING" title="Track an application" description="View the latest status of an application available to your account."/>
    <form className="smart-panel smart-track-form" onSubmit={onSubmit}><Search/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="For example, SF-2026-0041" aria-label="File ID" required/><ActionButton type="submit" disabled={busy}>{busy ? 'Searching…' : 'Track file'}</ActionButton></form>
    {file ? <section className="smart-panel smart-track-result">
      <div className="smart-panel-head"><div><div className="smart-eyebrow">{file.id}</div><h2>{file.title}</h2><p>{file.applicant} · {file.dept}</p></div><span className="smart-status">{file.status}</span></div>
      <div className="smart-details-grid">
        <div><small>Current stage</small><b>{file.currentStage || file.status}</b></div>
        <div><small>Current officer / staff</small><b>{formatHolder(file)}</b></div>
        <div><small>Department / office</small><b>{file.assignedOfficerRole === 'OFFICER' ? 'Officer' : file.assignedOfficerRole === 'CLERK' ? 'Clerk' : isCompletedStatus(file.status) ? 'Completed' : 'Citizen'} · {file.dept}</b></div>
        <div><small>Submitted</small><b>{formatDateTime(file.submittedAt)}</b></div>
        <div><small>Deadline</small><b>{formatDateTime(file.deadline)}</b></div>
        <div><small>Last updated</small><b>{formatDateTime(file.updatedAt)}</b></div>
      </div>
      <section className="smart-timeline" aria-label="File movement history">
        <h3>File movement history</h3>
        {history.length ? <ol>{history.map((item, index) => {
          const actor = Object.values(accounts).find(account => account.email === item.actorEmail);
          const actorName = actor?.name || (item.actorEmail === 'system@smartfile.demo'
            ? 'System'
            : item.actorEmail || 'System');
          const timestamp = item.createdAt || item.timestamp;
          return <li key={item.id || `${timestamp}-${index}`}>
            <span className="smart-timeline-dot"/>
            <div><b>{movementLabels[item.action] || String(item.action || 'File updated').replaceAll('_', ' ')}</b>
              <small>{formatDateTime(timestamp)} · {actorName}</small>
              {item.remarks && <p>{item.remarks}</p>}
            </div>
          </li>;
        })}</ol> : <div className="smart-empty">No movement history is available yet.</div>}
      </section>
      <div className="smart-track-actions"><ActionButton variant="secondary" onClick={() => onView(file)}>View details</ActionButton><div className="smart-qr" ref={qrContainer}><QRCodeSVG value={`${location.origin}/?track=${encodeURIComponent(file.id)}`} size={104} level="M" includeMargin/><small>Scan to track</small><ActionButton variant="secondary" onClick={downloadQr}><Download/>Download QR</ActionButton></div></div>
    </section> : <div className="smart-empty">Enter a file ID to view its latest status.</div>}
  </>;
}

function Workflow({ files, role, onAction }) {
  const pending = files.filter(file => canReviewApplication(role, file.status));
  const reviewName = role === 'Officer' ? 'Officer final decision' : 'Clerk verification';
  const isWorkflowRole = ['Clerk', 'Officer'].includes(role);
  return <>
    <PageTitle eyebrow="APPROVALS" title="Workflow queue" description={isWorkflowRole ? `Applications waiting for ${reviewName}.` : 'Only Clerk and assigned Officer accounts can process workflow actions.'}/>
    <section className="smart-panel">
      {!pending.length ? <div className="smart-empty">No applications are waiting for {reviewName}.</div> : <div className="smart-table-scroll"><table className="smart-table"><thead><tr><th>FILE ID</th><th>APPLICATION</th><th>STAGE</th><th>DEADLINE</th><th>DECISION</th></tr></thead><tbody>{pending.map(file => <tr key={file.id}><td className="smart-file-id">{file.id}</td><td>{file.title}<small className="smart-subline">{file.applicant}</small></td><td>{file.currentStage}</td><td>{formatDateTime(file.deadline)}</td><td><ActionButton onClick={() => onAction(file)}>{role === 'Officer' ? 'Final decision' : file.status === 'Verified by Clerk' ? 'Forward to Officer' : 'Review and verify'}</ActionButton></td></tr>)}</tbody></table></div>}
    </section>
  </>;
}

function Complaints({ complaints, onNew }) {
  return <>
    <PageTitle eyebrow="CITIZEN SERVICES" title="Complaints" description="Review submitted complaints and their recorded status." actions={<ActionButton onClick={onNew}><Plus/>New complaint</ActionButton>}/>
    <section className="smart-panel">
      {!complaints.length ? <div className="smart-empty">No complaints have been submitted.</div> : <div className="smart-table-scroll"><table className="smart-table"><thead><tr><th>REFERENCE</th><th>CATEGORY</th><th>APPLICANT</th><th>STATUS</th><th>SUBMITTED</th><th>DESCRIPTION</th></tr></thead><tbody>{complaints.map(item => <tr key={item.complaintId}><td className="smart-file-id">{item.complaintId}</td><td>{item.category}</td><td>{item.applicantName}</td><td>{item.status}</td><td>{formatDateTime(item.createdAt)}</td><td>{item.description}</td></tr>)}</tbody></table></div>}
    </section>
  </>;
}

function Departments({ files, departmentNames }) {
  const departments = useMemo(() => departmentNames.length
    ? departmentNames
    : [...new Set(files.map(file => file.dept).filter(name => name && name !== '—'))].sort(),
  [departmentNames, files]);
  return <>
    <PageTitle eyebrow="ORGANIZATION" title="Departments" description="Department workload is calculated from the application records available to this session."/>
    <section className="smart-panel">{departments.length ? <div className="smart-departments">{departments.map(name => <div key={name}><Building2/><span><b>{name}</b><small>{files.filter(file => file.dept === name).length} applications</small></span></div>)}</div> : <div className="smart-empty">No department records are available.</div>}</section>
  </>;
}

function AuditLog({ rows, now }) {
  return <>
    <PageTitle eyebrow="ACCOUNTABILITY" title="Audit log" description="Recorded application workflow actions with actor and timestamp."/>
    <section className="smart-panel">{rows.length ? <div className="smart-table-scroll"><table className="smart-table"><thead><tr><th>TIME</th><th>RECORD</th><th>ACTION</th><th>ACTOR</th><th>REMARKS</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.id || `${row.createdAt}-${index}`}><td title={formatDateTime(row.createdAt)}>{relativeTime(row.createdAt, now)}</td><td>{row.application?.fileId || row.complaintId || '—'}</td><td>{row.action}</td><td>{row.actorEmail || '—'}</td><td>{row.remarks || '—'}</td></tr>)}</tbody></table></div> : <div className="smart-empty">No actions have been recorded.</div>}</section>
  </>;
}

function Analytics({ files, counts, onExport }) {
  const rows = [...new Set(files.map(file => file.status))].map(status => ({ status, count: files.filter(file => file.status === status).length }));
  return <>
    <PageTitle eyebrow="REPORTING" title="Analytics" description="Live counts derived from the application records loaded for this session." actions={<ActionButton variant="secondary" onClick={onExport}><Download/>Export CSV</ActionButton>}/>
    <div className="smart-stats"><Stat label="Total" value={counts.total} icon={<Files/>}/><Stat label="Open" value={counts.pending} icon={<FileClock/>}/><Stat label="Approved" value={counts.approved} icon={<FileCheck2/>}/><Stat label="Overdue" value={counts.overdue} icon={<AlertTriangle/>}/></div>
    <section className="smart-panel"><div className="smart-panel-head"><div><h2>Applications by status</h2><p>Computed from the loaded records.</p></div></div>{rows.length ? <div className="smart-departments">{rows.map(row => <div key={row.status}><Activity/><span><b>{row.status}</b><small>{row.count} application{row.count === 1 ? '' : 's'}</small></span></div>)}</div> : <div className="smart-empty">No records are available for analysis.</div>}</section>
  </>;
}

function SettingsPage({ dark, setDark, apiUp, timeZone, mode }) {
  return <>
    <PageTitle eyebrow="PREFERENCES" title="Settings" description="Manage local appearance and inspect the active data and clock sources."/>
    <section className="smart-panel smart-settings">
      <div className="smart-setting"><span><b>Dark appearance</b><small>Saved on this device.</small></span><button className={`smart-switch${dark ? ' on' : ''}`} role="switch" aria-checked={dark} onClick={() => { const next = !dark; setDark(next); localStorage.setItem('smartfile.dark', String(next)); }}><i/></button></div>
      <div className="smart-setting"><span><b>Data mode</b><small>{mode === 'api' && apiUp ? 'Changes are saved through the backend.' : 'Changes are saved to this browser only.'}</small></span><strong>{mode === 'api' && apiUp ? 'API' : 'LOCAL DEMO'}</strong></div>
      <div className="smart-setting"><span><b>Time zone</b><small>Times display in the device time zone; API timestamps are UTC instants.</small></span><strong>{timeZone}</strong></div>
    </section>
  </>;
}

function ApplicationWizard({ close, busy, onSubmitApplication, email, userName, role, mode, token }) {
  const [step, setStep] = useState(1);
  const [service, setService] = useState(null);
  const [errors, setErrors] = useState({});
  const [applicant, setApplicant] = useState({
    applicantName: role === 'Citizen' && userName !== 'Demo workspace' ? userName : '',
    fatherName: '', mobile: '', email: email || '', dateOfBirth: '', state: 'Punjab',
    district: '', collegeName: '', course: '', academicYear: '2026-27',
    scholarshipCategory: 'General', scholarshipScheme: 'State Merit Scholarship'
  });
  const [documents, setDocuments] = useState({});
  const [mismatch, setMismatch] = useState(null);

  const services = [
    ['scholarship', 'Scholarship Application', 'Education', 'Student scholarship application', '5-7 business days'],
    ['income', 'Income Certificate', 'Revenue', 'Proof of annual family income', '3-5 business days'],
    ['caste', 'Caste Certificate', 'Revenue', 'Category/community certificate', '3-5 business days'],
    ['residential', 'Residential Certificate', 'Residence', 'Proof of residence', '2-4 business days'],
    ['bonafide', 'Bonafide Certificate', 'Education', 'Institution student certificate', '2-3 business days'],
    ['other', 'Other Government Services', 'Citizen Services', 'Additional public service', 'Department dependent']
  ];
  const requiredDocuments = service?.[0] === 'scholarship'
    ? [
        ['income', 'Income Certificate'],
        ['caste', 'Caste Certificate'],
        ['bonafide', 'Bonafide Certificate'],
        ['residential', 'Residential Certificate'],
        ['marksheet', 'Academic Marksheet']
      ]
    : service ? [['support', 'Supporting Document']] : [];

  function validateDetails() {
    const next = {};
    if (!applicant.applicantName.trim()) next.applicantName = 'Applicant name is required.';
    if (!applicant.fatherName.trim()) next.fatherName = "Father's name is required.";
    if (!/^[6-9]\d{9}$/.test(applicant.mobile)) next.mobile = 'Enter a valid 10-digit mobile number.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applicant.email)) next.email = 'Enter a valid email address.';
    if (!applicant.dateOfBirth) next.dateOfBirth = 'Date of birth is required.';
    if (!applicant.district.trim()) next.district = 'District is required.';
    if (service?.[0] === 'scholarship' && !applicant.collegeName.trim()) next.collegeName = 'College name is required.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function nextStep() {
    if (step === 1 && !service) return setErrors({ service: 'Select a government service.' });
    if (step === 2 && !validateDetails()) return;
    if (step === 3) {
      const missing = requiredDocuments.filter(([key]) => documents[key]?.status !== 'VERIFIED');
      if (missing.length) return setErrors({ documents: `Verification required: ${missing.map(([, name]) => name).join(', ')}` });
    }
    setErrors({});
    setStep(current => Math.min(current + 1, 5));
  }

  async function verifyDocument(key, name, file) {
    if (!file) return;
    if (!/\.(pdf|jpe?g|png)$/i.test(file.name)) {
      setMismatch({ required: name, detected: 'Unsupported File', message: 'Only PDF, JPG, JPEG, and PNG files are accepted.' });
      setDocuments(previous => ({ ...previous, [key]: { status: 'UPLOAD_FAILED', filename: file.name } }));
      return;
    }
    setDocuments(previous => ({ ...previous, [key]: { status: 'SCANNING', filename: file.name } }));
    let result;
    if (mode === 'api' && token) {
      try {
        const form = new FormData();
        form.append('file', file);
        form.append('requiredDocument', name);
        result = await request('/documents/verify', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
      } catch (reason) {
        setMismatch({ required: name, detected: 'Unable to Verify', message: reason.message });
        setDocuments(previous => ({ ...previous, [key]: { status: 'UNABLE_TO_VERIFY', filename: file.name } }));
        return;
      }
    } else {
      const detected = file.name.toLowerCase().includes('income') ? 'INCOME_CERTIFICATE'
        : file.name.toLowerCase().includes('caste') ? 'CASTE_CERTIFICATE'
          : file.name.toLowerCase().includes('bonafide') ? 'BONAFIDE_CERTIFICATE'
            : file.name.toLowerCase().includes('residential') || file.name.toLowerCase().includes('residence') ? 'RESIDENTIAL_CERTIFICATE'
              : file.name.toLowerCase().includes('marksheet') ? 'ACADEMIC_MARKSHEET' : 'UNKNOWN_DOCUMENT';
      const requiredCode = name.toUpperCase().replaceAll(' ', '_');
      result = {
        status: detected === requiredCode ? 'VERIFIED' : 'MISMATCH',
        detectedDocument: detected,
        requiredDocument: requiredCode,
        confidence: detected === requiredCode ? 96 : 94,
        canProceed: detected === requiredCode,
        message: detected === requiredCode ? 'Document matches the required document type.' : 'Uploaded document does not match the required document.'
      };
    }
    setDocuments(previous => ({ ...previous, [key]: { status: result.status, filename: file.name, detected: result.detectedDocument, confidence: result.confidence } }));
    if (result.status !== 'VERIFIED') setMismatch({ required: name, detected: result.detectedDocument?.replaceAll('_', ' ') || 'Unknown Document', message: result.message });
  }

  async function submit() {
    const blocked = requiredDocuments.some(([key]) => documents[key]?.status !== 'VERIFIED');
    if (blocked) return setStep(3);
    await onSubmitApplication({
      applicationType: service[1],
      applicantName: applicant.applicantName.trim(),
      department: service[2],
      priority: 'Normal'
    });
  }

  const progress = ['Select Service', 'Applicant Details', 'Upload Documents', 'Verification', 'Review & Submit'];
  return <div className="smart-wizard">
    <div className="smart-modal-head"><h2 id="modal-title">New application</h2><button className="smart-icon" aria-label="Close" onClick={close}><X/></button></div>
    <ol className="smart-progress">{progress.map((label, index) => <li key={label} className={step >= index + 1 ? 'active' : ''}><b>{index + 1}</b><span>{label}</span></li>)}</ol>
    {step === 1 && <section className="smart-service-grid">{services.map(item => <button type="button" key={item[0]} className={`smart-service-card ${service?.[0] === item[0] ? 'selected' : ''}`} onClick={() => { setService(item); setErrors({}); }}>
      <span><Building2/></span><b>{item[1]}</b><small>{item[3]}</small><em>{item[2]} · {item[4]}</em><strong>Apply <ArrowRight/></strong>
    </button>)}</section>}
    {step === 2 && <section className="smart-wizard-form">
      {[
        ['applicantName', 'Applicant Name', 'text'], ['fatherName', "Father's Name", 'text'],
        ['mobile', 'Mobile Number', 'tel'], ['email', 'Email', 'email'], ['dateOfBirth', 'Date of Birth', 'date'],
        ['state', 'State', 'text'], ['district', 'District', 'text'], ['collegeName', 'College Name', 'text'],
        ['course', 'Course', 'text'], ['academicYear', 'Academic Year', 'text']
      ].map(([key, label, type]) => <label key={key}>{label}<input type={type} value={applicant[key]} onChange={event => setApplicant(previous => ({ ...previous, [key]: event.target.value }))}/>{errors[key] && <small className="smart-field-error">{errors[key]}</small>}</label>)}
      <label>Scholarship Category<select value={applicant.scholarshipCategory} onChange={event => setApplicant(previous => ({ ...previous, scholarshipCategory: event.target.value }))}><option>General</option><option>SC</option><option>ST</option><option>OBC</option><option>EWS</option></select></label>
      <label>Scholarship Scheme<select value={applicant.scholarshipScheme} onChange={event => setApplicant(previous => ({ ...previous, scholarshipScheme: event.target.value }))}><option>State Merit Scholarship</option><option>Post-Matric Scholarship</option><option>National Means-cum-Merit Scholarship</option></select></label>
    </section>}
    {step === 3 && <section className="smart-document-wizard">{requiredDocuments.map(([key, name]) => {
      const record = documents[key];
      return <div className="smart-upload-slot" key={key}>
        <div><b>{name}</b><small>PDF, JPG, JPEG or PNG · Maximum 10 MB</small></div>
        {record && <span className={`smart-status ${record.status === 'VERIFIED' ? 'approved' : 'rejected'}`}>{record.status.replaceAll('_', ' ')}</span>}
        <label className="smart-button secondary">Upload document<input type="file" accept=".pdf,.jpg,.jpeg,.png" hidden onChange={event => verifyDocument(key, name, event.target.files?.[0])}/></label>
        {record?.filename && <small className="smart-upload-name">{record.filename}</small>}
      </div>;
    })}{errors.documents && <p className="smart-form-error">{errors.documents}</p>}</section>}
    {step === 4 && <section className="smart-verification-summary">
      <div className="smart-verification-icon"><CheckCheck/></div><h3>Document verification status</h3>
      {requiredDocuments.map(([key, name]) => <div key={key}><b>{name}</b><span className={`smart-status ${documents[key]?.status === 'VERIFIED' ? 'approved' : 'rejected'}`}>{documents[key]?.status || 'PENDING'}</span></div>)}
    </section>}
    {step === 5 && <section className="smart-review-grid">
      <div><small>Service</small><b>{service?.[1]}</b></div><div><small>Applicant</small><b>{applicant.applicantName}</b></div>
      <div><small>Mobile</small><b>{applicant.mobile}</b></div><div><small>Institution</small><b>{applicant.collegeName || '—'}</b></div>
      <div><small>Course</small><b>{applicant.course || '—'}</b></div><div><small>Scheme</small><b>{applicant.scholarshipScheme}</b></div>
    </section>}
    {errors.service && <p className="smart-form-error">{errors.service}</p>}
    <div className="smart-modal-actions">
      {step > 1 && <button type="button" className="smart-button secondary" onClick={() => setStep(current => current - 1)}>Back</button>}
      {step < 5 ? <button type="button" className="smart-button" onClick={nextStep}>Continue</button> : <button type="button" className="smart-button" disabled={busy} onClick={submit}>{busy ? 'Submitting…' : 'Submit Application'}</button>}
    </div>
    {mismatch && <div className="smart-mismatch-inline" role="alert">
      <AlertTriangle/><div><b>DOCUMENT MISMATCH DETECTED</b><small>Required: {mismatch.required} · Uploaded: {mismatch.detected}</small><p>{mismatch.message}</p></div>
      <button className="smart-button secondary" onClick={() => setMismatch(null)}>Replace Document</button>
    </div>}
  </div>;
}

function SmartDocumentVerification() {
  const slots = [
    ['income', 'Income Certificate'],
    ['caste', 'Caste Certificate'],
    ['bonafide', 'Bonafide Certificate'],
    ['residential', 'Residential Certificate'],
    ['marksheet', 'Academic Marksheet']
  ];
  const [records, setRecords] = useState({});
  const [mismatch, setMismatch] = useState(null);
  const [scanning, setScanning] = useState('');

  async function verify(key, name, file) {
    if (!file) return;
    setScanning(name);
    setMismatch(null);
    const delay = new Promise(resolve => window.setTimeout(resolve, 650));
    let result;
    const token = localStorage.getItem('smartfile.token');
    if (token && localStorage.getItem('smartfile.mode') === 'api') {
      const form = new FormData();
      form.append('file', file);
      form.append('requiredDocument', name);
      try {
        result = await Promise.all([
          request('/documents/verify', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form }),
          delay
        ]).then(values => values[0]);
      } catch (reason) {
        result = { status: 'UPLOAD_FAILED', detectedDocument: 'FILE_VALIDATION_ERROR', message: reason.message, canProceed: false };
      }
    } else {
      await delay;
      const value = file.name.toLowerCase();
      const detected = value.includes('income') ? 'INCOME_CERTIFICATE'
        : value.includes('caste') ? 'CASTE_CERTIFICATE'
          : value.includes('bonafide') ? 'BONAFIDE_CERTIFICATE'
            : value.includes('residential') || value.includes('residence') ? 'RESIDENTIAL_CERTIFICATE'
              : value.includes('marksheet') ? 'ACADEMIC_MARKSHEET' : 'UNKNOWN_DOCUMENT';
      const required = name.toUpperCase().replaceAll(' ', '_');
      result = {
        status: detected === required ? 'VERIFIED' : 'MISMATCH',
        detectedDocument: detected,
        requiredDocument: required,
        confidence: detected === required ? 96 : 94,
        canProceed: detected === required,
        message: detected === required ? 'Document matches the required document type.' : 'Uploaded document does not match the required document.'
      };
    }
    setScanning('');
    setRecords(previous => ({
      ...previous,
      [key]: { filename: file.name, status: result.status, detected: result.detectedDocument, confidence: result.confidence }
    }));
    if (result.status !== 'VERIFIED') setMismatch({
      required: name,
      detected: String(result.detectedDocument || 'Unknown Document').replaceAll('_', ' '),
      message: result.message
    });
  }

  function sample(key, name, detectedName) {
    const file = new File([`${detectedName}\nDemo Document - Not valid for official use\nRahul Kumar`], `Demo_${detectedName.replaceAll(' ', '_')}.pdf`, { type: 'application/pdf' });
    verify(key, name, file);
  }

  return <>
    <PageTitle eyebrow="DEMO MODE | RULE-BASED DOCUMENT INTELLIGENCE" title="Smart Document Verification" description="Ready-to-use scholarship demo with backend verification when the API is available."/>
    {scanning && <div className="smart-scanning"><ShieldCheck/><div><b>Scanning: {scanning}</b><small>File validation → OCR/Text extraction → Classification → Comparison</small></div></div>}
    <div className="smart-verification-grid">{slots.map(([key, name]) => {
      const record = records[key];
      return <section className="smart-document-slot" key={key}>
        <div><b>{name}</b><small>PDF, JPG, JPEG or PNG · 10 MB maximum</small></div>
        {record && <span className={`smart-status ${record.status === 'VERIFIED' ? 'approved' : 'rejected'}`}>{record.status.replaceAll('_', ' ')}</span>}
        {record?.filename && <small className="smart-upload-name">{record.filename}{record.confidence ? ` · ${record.confidence}%` : ''}</small>}
        <label className="smart-button secondary">Upload document<input type="file" accept=".pdf,.jpg,.jpeg,.png" hidden onChange={event => verify(key, name, event.target.files?.[0])}/></label>
        <div className="smart-sample-actions">
          {name === 'Caste Certificate'
            ? <><button className="smart-button secondary" onClick={() => sample(key, name, 'Caste Certificate')}>Demo Caste Certificate</button><button className="smart-button danger" onClick={() => sample(key, name, 'Income Certificate')}>Demo Wrong Income Certificate</button></>
            : <button className="smart-button secondary" onClick={() => sample(key, name, name)}>Upload Demo Document</button>}
        </div>
      </section>;
    })}</div>
    {Object.values(records).length === slots.length && Object.values(records).every(record => record.status === 'VERIFIED')
      && <section className="smart-success"><CheckCheck/><div><b>All required documents verified</b><small>The scholarship demo application is ready for final review.</small></div></section>}
    {mismatch && <div className="smart-mismatch-inline lab-mismatch" role="alert">
      <AlertTriangle/><div><b>DOCUMENT MISMATCH DETECTED</b><small>Required: {mismatch.required} · Uploaded: {mismatch.detected}</small><p>{mismatch.message}</p></div>
      <button className="smart-button" onClick={() => setMismatch(null)}>Replace Document</button>
    </div>}
  </>;
}

function ChatAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hello. I am SmartFile Assistant. Ask me about services, required documents, verification, or tracking.' }
  ]);

  async function send(text) {
    const question = (text || input).trim();
    if (!question) return;
    setMessages(previous => [...previous, { role: 'user', text: question }]);
    setInput('');
    setTyping(true);
    let answer;
    try {
      const token = localStorage.getItem('smartfile.token');
      if (token && localStorage.getItem('smartfile.mode') === 'api') {
        const data = await request(`/chat?message=${encodeURIComponent(question)}`, { headers: { Authorization: `Bearer ${token}` } });
        answer = data.answer;
      } else throw new Error('Local demo knowledge');
    } catch {
      const value = question.toLowerCase();
      answer = value.includes('document') && value.includes('scholarship')
        ? 'For scholarship, configured documents are: Income Certificate, Bonafide Certificate, Residential Certificate, and Previous Academic Marksheet. Caste Certificate is required only if applicable.'
        : value.includes('mismatch') || value.includes('rejected')
          ? 'This means the uploaded file was classified differently from the required slot. Replace it with the correct document and verify again.'
          : value.includes('track')
            ? 'Open Track a file and enter the application ID shown after submission.'
            : 'Select a service, complete applicant details, upload all required documents, and submit when every document is verified.';
    }
    await new Promise(resolve => window.setTimeout(resolve, 350));
    setTyping(false);
    setMessages(previous => [...previous, { role: 'assistant', text: answer }]);
  }

  return <>
    {open && <section className="smart-chat-panel" role="dialog" aria-label="SmartFile Assistant">
      <div className="smart-chat-head"><span><MessageSquareText/></span><div><b>SmartFile Assistant</b><small>Knowledge-based help · Demo context</small></div><button className="smart-icon" onClick={() => setOpen(false)}><X/></button></div>
      <div className="smart-chat-messages">{messages.map((message, index) => <div className={`smart-chat-message ${message.role}`} key={index}>{message.text}</div>)}
        {typing && <div className="smart-chat-message assistant">Typing…</div>}
      </div>
      <div className="smart-chat-suggestions"><button onClick={() => send('What documents are required for scholarship?')}>Scholarship documents</button><button onClick={() => send('How do I track my application?')}>Track application</button></div>
      <form className="smart-chat-input" onSubmit={event => { event.preventDefault(); send(); }}><input value={input} onChange={event => setInput(event.target.value)} placeholder="Ask SmartFile Assistant"/><button type="submit">Send</button></form>
    </section>}
    <button className="smart-chat-button" aria-label="Open SmartFile Assistant" onClick={() => setOpen(current => !current)}><MessageSquareText/></button>
  </>;
}

function Modal({ modal, close, busy, error, role, userName, email, mode, accountId, officers, onSignIn, onSignOut, onSubmitApplication, onEditApplication, onCancelApplication, onSubmitComplaint, onApplyAction, onReview, onOpenEdit, onRequestCancel }) {
  const [title, setTitle] = useState(modal.file?.title || '');
  const [name, setName] = useState(modal.file?.applicant || (userName === 'Demo workspace' ? '' : userName));
  const [department, setDepartment] = useState(modal.file?.dept || 'Education');
  const [priority, setPriority] = useState(modal.file?.priority || 'Normal');
  const [category, setCategory] = useState('Delayed application');
  const [description, setDescription] = useState('');
  const [action, setAction] = useState(role === 'Officer'
    ? 'FINAL_APPROVE'
    : modal.file?.status === 'Verified by Clerk' ? 'FORWARD' : 'VERIFY');
  const [remarks, setRemarks] = useState('');
  const [assignedOfficerEmail, setAssignedOfficerEmail] = useState(modal.file?.assignedOfficerEmail || officers[0]?.email || '');
  useEffect(() => {
    if (!assignedOfficerEmail && officers.length) setAssignedOfficerEmail(officers[0].email);
  }, [assignedOfficerEmail, officers]);
  const file = modal.file;
  const canManage = file && (role !== 'Citizen' || mode === 'api' || file.ownerEmail === email);
  const canChange = file && ['Submitted', 'Returned'].includes(file.status);

  function submit(event) {
    event.preventDefault();
    if (modal.type === 'application') return onSubmitApplication({ applicationType: title.trim(), applicantName: name.trim(), department, priority });
    if (modal.type === 'edit') return onEditApplication(modal.file, { applicationType: title.trim(), applicantName: name.trim(), department, priority });
    if (modal.type === 'complaint') return onSubmitComplaint({ category, applicantName: name.trim(), description: description.trim() });
    if (modal.type === 'action') return onApplyAction(file, action, remarks.trim(), assignedOfficerEmail);
  }

  if (modal.type === 'wizard') {
    return <div className="smart-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
      <section className="smart-modal smart-wizard-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <ApplicationWizard close={close} busy={busy} onSubmitApplication={onSubmitApplication} email={email} userName={userName} role={role} mode={mode} token={localStorage.getItem('smartfile.token') || ''}/>
      </section>
    </div>;
  }

  return <div className="smart-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
    <section className="smart-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="smart-modal-head"><h2 id="modal-title">{modal.type === 'login' ? 'Choose an account' : modal.type === 'application' ? 'New application' : modal.type === 'edit' ? 'Edit application' : modal.type === 'cancel' ? 'Cancel application' : modal.type === 'complaint' ? 'Submit a complaint' : modal.type === 'action' ? 'Record workflow decision' : modal.type === 'details' ? 'Application details' : modal.type === 'profile' ? 'Account' : 'Help centre'}</h2><button className="smart-icon" aria-label="Close dialog" onClick={close}><X/></button></div>
      {modal.type === 'login' && <><p className="smart-modal-description">Choose a demo account. If the API is unavailable, its data is isolated by account in this browser.</p>{error && <p className="smart-form-error" role="alert">{error}</p>}<div className="smart-role-grid">{Object.entries(accounts).map(([accountKey, account]) => <button key={accountKey} className="smart-role" onClick={() => onSignIn(accountKey)} disabled={busy}><b>{account.label} · {account.name}</b><small>{account.email}</small></button>)}</div></>}
      {modal.type === 'profile' && <><p>{userName} · {role}</p><div className="smart-modal-actions"><ActionButton variant="secondary" disabled={!accountId || busy} onClick={() => onSignIn(accountId)}>Switch / refresh account</ActionButton><ActionButton variant="danger" onClick={onSignOut}><LogOut/>Sign out</ActionButton></div></>}
      {modal.type === 'help' && <div className="smart-help-body"><p>Use All applications to search and filter records. Workflow actions require a staff role and are recorded in the audit log.</p><p>Times are displayed in your device time zone. When the API is online, the clock is synchronized to its UTC timestamp.</p><p>Local demo changes persist in this browser but are not shared with other devices.</p><ActionButton onClick={close}>Close</ActionButton></div>}
      {modal.type === 'details' && file && <><div className="smart-details-grid"><div><small>File ID</small><b>{file.id}</b></div><div><small>Status</small><b>{file.status}</b></div><div><small>Applicant</small><b>{file.applicant}</b></div><div><small>Department</small><b>{file.dept}</b></div><div><small>Current officer / staff</small><b>{formatHolder(file)}</b></div><div><small>Submitted</small><b>{formatDateTime(file.submittedAt)}</b></div><div><small>Updated</small><b>{formatDateTime(file.updatedAt)}</b></div><div><small>Deadline</small><b>{formatDateTime(file.deadline)}</b></div></div><div className="smart-modal-actions"><ActionButton variant="secondary" onClick={close}>Close</ActionButton>{canManage && canChange && <><ActionButton variant="danger" onClick={() => onRequestCancel(file)}>Cancel application</ActionButton><ActionButton variant="secondary" onClick={() => onOpenEdit(file)}>Edit</ActionButton></>}{canReviewApplication(role, file.status) && <ActionButton onClick={() => onReview(file)}>Review</ActionButton>}</div></>}
      {modal.type === 'cancel' && <><p className="smart-modal-description">This will mark {file?.id} as cancelled and keep the record in the audit history.</p>{error && <p className="smart-form-error" role="alert">{error}</p>}<div className="smart-modal-actions"><ActionButton variant="secondary" onClick={close}>Keep application</ActionButton><ActionButton variant="danger" disabled={busy} onClick={() => onCancelApplication(file)}>{busy ? 'Cancelling…' : 'Confirm cancellation'}</ActionButton></div></>}
      {(modal.type === 'application' || modal.type === 'edit' || modal.type === 'complaint' || modal.type === 'action') && <form onSubmit={submit}>
        {(modal.type === 'application' || modal.type === 'edit') && <>
          <label>Application type<input required maxLength="120" value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Scholarship application"/></label>
          <label>Applicant name<input required maxLength="120" value={name} readOnly={role === 'Citizen'} onChange={event => setName(event.target.value)} placeholder="Full name"/></label>
          <label>Department<select value={department} onChange={event => setDepartment(event.target.value)}>{['Education','Revenue','Urban Development','Social Welfare','Public Works','Commerce','Finance','Legal'].map(item => <option key={item}>{item}</option>)}</select></label>
          <label>Priority<select value={priority} onChange={event => setPriority(event.target.value)}>{['Low','Normal','High'].map(item => <option key={item}>{item}</option>)}</select></label>
        </>}
        {modal.type === 'complaint' && <>
          <label>Category<select value={category} onChange={event => setCategory(event.target.value)}>{['Delayed application','Staff conduct','Incorrect information','Other'].map(item => <option key={item}>{item}</option>)}</select></label>
          <label>Applicant name<input required maxLength="120" value={name} readOnly={role === 'Citizen'} onChange={event => setName(event.target.value)} placeholder="Full name"/></label>
          <label>Description<textarea required maxLength="2000" value={description} onChange={event => setDescription(event.target.value)} rows="4"/></label>
        </>}
        {modal.type === 'action' && <>
          <p className="smart-modal-description">{file?.id} · {file?.title}</p>
          <p className="smart-modal-description">{role === 'Officer'
            ? 'Only the Officer assigned to this file can make the final decision.'
            : file?.status === 'Verified by Clerk'
              ? `Documents are verified. Forward the file to ${officers.find(officer => officer.email === assignedOfficerEmail)?.name || 'a designated Officer'} for final review.`
              : 'Verify the documents before forwarding the file to the designated Officer.'}</p>
          <label>Decision<select value={action} onChange={event => setAction(event.target.value)}>
            {role === 'Officer'
              ? <><option value="FINAL_APPROVE">Final approve</option><option value="REJECT">Reject</option></>
              : file?.status === 'Verified by Clerk'
                ? <><option value="FORWARD">Forward to Officer</option><option value="RETURN">Return for changes</option><option value="REJECT">Reject</option></>
                : <><option value="VERIFY">Verify documents</option><option value="RETURN">Return for changes</option><option value="REJECT">Reject</option><option value="REQUEST_DOCUMENTS">Request documents</option></>}
          </select></label>
          {role === 'Clerk' && action === 'FORWARD' && <label>Designated Officer<select value={assignedOfficerEmail} onChange={event => setAssignedOfficerEmail(event.target.value)} required>
            {officers.map(officer => <option key={officer.email} value={officer.email}>{officer.name}</option>)}
          </select></label>}
          <label>Remarks{['RETURN','REJECT'].includes(action) ? ' (required)' : ''}<textarea value={remarks} onChange={event => setRemarks(event.target.value)} required={['RETURN','REJECT'].includes(action)} maxLength="2000" rows="3"/></label>
        </>}
        {error && <p className="smart-form-error" role="alert">{error}</p>}
        <div className="smart-modal-actions"><ActionButton variant="secondary" onClick={close}>Cancel</ActionButton><ActionButton type="submit" disabled={busy}>{busy ? 'Saving…' : ['application','edit'].includes(modal.type) ? 'Save application' : modal.type === 'complaint' ? 'Submit complaint' : action === 'FINAL_APPROVE' ? 'Final approve' : action === 'VERIFY' ? 'Verify documents' : action === 'FORWARD' ? 'Forward to Officer' : 'Record decision'}</ActionButton></div>
      </form>}
    </section>
  </div>;
}

function exportCsv(files) {
  const headers = ['File ID','Application','Applicant','Department','Status','Priority','Submitted at','Updated at','Deadline'];
  const rows = files.map(file => [file.id,file.title,file.applicant,file.dept,file.status,file.priority,file.submittedAt,file.updatedAt,file.deadline]);
  const csv = [headers, ...rows].map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'smartfile-applications.csv';
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

createRoot(document.getElementById('root')).render(<App/>);
