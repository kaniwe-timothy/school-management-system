import React, { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import {
  Camera,
  CameraOff,
  CheckCircle2,
  ImageUp,
  QrCode,
  RefreshCw,
  Search,
  ShieldAlert,
  X,
  XCircle,
} from 'lucide-react';
import type {
  FeePayment,
  ReceiptVerificationResult,
  SchoolDatabase,
  StudentFeeSummary,
} from '../shared/types';
import { computeStudentFeeSummaries, formatUGX } from '../utils/schoolFinance';
import { parseScannedReceiptQr, type ParsedReceiptQr } from '../utils/receiptQr';

export function ReceiptScannerModal({
  db,
  authToken,
  initialQrInput,
  onCollectFee,
  onOpenReceipt,
  onClose,
}: {
  db: SchoolDatabase;
  authToken: string;
  initialQrInput?: ParsedReceiptQr;
  onCollectFee: (studentId: string) => void;
  onOpenReceipt: (payment: FeePayment, summary: StudentFeeSummary) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [manualInput, setManualInput] = useState(initialQrInput?.receiptNo || '');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [result, setResult] = useState<ReceiptVerificationResult | null>(null);

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  const verifyParsedReceipt = useCallback(
    async (parsed: ParsedReceiptQr) => {
      setVerifying(true);
      setVerifyError('');
      setManualInput(parsed.receiptNo);
      try {
        const params = new URLSearchParams({ receiptNo: parsed.receiptNo });
        if (parsed.sid) params.set('sid', parsed.sid);
        if (parsed.amt !== undefined) params.set('amt', String(parsed.amt));

        const res = await fetch(`/api/payments/verify?${params.toString()}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || 'Could not verify receipt against ledger.');
        }
        setResult(data as ReceiptVerificationResult);
      } catch (err) {
        setVerifyError(err instanceof Error ? err.message : 'Verification failed.');
        setResult(null);
      } finally {
        setVerifying(false);
      }
    },
    [authToken]
  );

  const startCamera = useCallback(async () => {
    setCameraError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        'Live camera access is unavailable in this browser. Upload a photo of the QR code or type the receipt number below.'
      );
      return;
    }

    stopCamera();
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch {
      setCameraError(
        'Camera permission was declined or no camera was detected. Use "Scan Photo" or type the Receipt No. below.'
      );
      setCameraActive(false);
    }
  }, [stopCamera]);

  useEffect(() => {
    if (!cameraActive) return;

    let lastScanTime = 0;
    const scanFrame = (now: number) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      if (now - lastScanTime >= 140) {
        lastScanTime = now;
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (w > 0 && h > 0) {
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, w, h);
            const imgData = ctx.getImageData(0, 0, w, h);
            const code = jsQR(imgData.data, w, h, { inversionAttempts: 'dontInvert' });
            if (code?.data) {
              const parsed = parseScannedReceiptQr(code.data);
              if (parsed) {
                stopCamera();
                void verifyParsedReceipt(parsed);
                return;
              }
            }
          }
        }
      }

      rafRef.current = requestAnimationFrame(scanFrame);
    };

    rafRef.current = requestAnimationFrame(scanFrame);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [cameraActive, stopCamera, verifyParsedReceipt]);

  useEffect(() => {
    if (initialQrInput?.receiptNo) {
      void verifyParsedReceipt(initialQrInput);
    }
    return () => {
      stopCamera();
    };
  }, [initialQrInput, stopCamera, verifyParsedReceipt]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setVerifyError('');

    try {
      const imageUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(imageUrl);
        const canvas = canvasRef.current || document.createElement('canvas');
        const maxDim = 1400;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height, 1));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          setVerifyError('Unable to read uploaded image.');
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h);
        const code = jsQR(imgData.data, w, h, { inversionAttempts: 'attemptBoth' });
        if (!code?.data) {
          setVerifyError('No readable QR code found in that image. Try a clearer photo or type the Receipt No.');
          return;
        }
        const parsed = parseScannedReceiptQr(code.data);
        if (!parsed) {
          setVerifyError('Scanned QR code is not a valid school fee receipt.');
          return;
        }
        stopCamera();
        void verifyParsedReceipt(parsed);
      };
      img.onerror = () => {
        URL.revokeObjectURL(imageUrl);
        setVerifyError('Could not load the selected image.');
      };
      img.src = imageUrl;
    } catch {
      setVerifyError('Unable to process receipt photo.');
    }
  };

  const handleManualVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseScannedReceiptQr(manualInput);
    if (!parsed) {
      setVerifyError('Enter a receipt number (for example, RCP-2026-0001).');
      return;
    }
    stopCamera();
    void verifyParsedReceipt(parsed);
  };

  const matchedSummary = result?.student
    ? computeStudentFeeSummaries(db).find((s) => s.student.id === result.student?.id)
    : undefined;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 no-print">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-xl">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-slate-900 truncate">
                Scan &amp; Verify Fee Receipt QR
              </h3>
              <p className="text-xs text-slate-500 truncate">
                Use mobile camera, photo upload, or receipt number to verify instantly in SQLite ledger.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            aria-label="Close scanner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Camera & Photo Scanner Controls */}
          {!result && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-950 overflow-hidden relative min-h-[220px] flex flex-col items-center justify-center">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className={`w-full max-h-72 object-cover ${cameraActive ? 'block' : 'hidden'}`}
                />
                <canvas ref={canvasRef} className="hidden" />

                {cameraActive ? (
                  <>
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="w-44 h-44 border-2 border-emerald-400 rounded-xl shadow-[0_0_0_9999px_rgba(15,23,42,0.45)]" />
                    </div>
                    <div className="absolute bottom-3 inset-x-3 flex items-center justify-between gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-900/80 text-white text-xs">
                        Point camera at receipt QR code...
                      </span>
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700"
                      >
                        <CameraOff className="w-3.5 h-3.5" />
                        Stop Camera
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="p-6 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-blue-600/20 text-sky-300 flex items-center justify-center mx-auto">
                      <Camera className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-white">Camera Receipt Scanner</div>
                      <p className="text-xs text-slate-300 max-w-md mx-auto">
                        Open your phone or laptop camera to scan the QR code printed on any student fee receipt.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={startCamera}
                        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 whitespace-nowrap"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        Start Mobile / Webcam Camera
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-900 bg-amber-300 rounded-xl hover:bg-amber-200 whitespace-nowrap"
                      >
                        <ImageUp className="w-3.5 h-3.5" />
                        Scan QR from Photo
                      </button>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </div>
                )}
              </div>

              {cameraError && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-xs text-amber-900">
                  {cameraError}
                </div>
              )}
            </div>
          )}

          {/* Manual Receipt Lookup / Quick Re-Check */}
          <form onSubmit={handleManualVerify} className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Or type Receipt No. (e.g., RCP-2026-0001) or paste QR link..."
                className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <button
              type="submit"
              disabled={verifying}
              className="px-4 py-2.5 text-xs font-semibold text-white bg-blue-700 rounded-xl hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {verifying ? 'Checking Ledger...' : 'Verify Receipt'}
            </button>
          </form>

          {verifyError && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs text-rose-800 font-medium">
              {verifyError}
            </div>
          )}

          {/* Instant Ledger Verification Result */}
          {result && (
            <div className="space-y-4">
              {!result.verified ? (
                <div className="p-5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
                  <XCircle className="w-6 h-6 text-rose-700 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="text-sm font-bold text-rose-950">Receipt Not Verified</div>
                    <p className="text-xs text-rose-800">
                      {result.message || 'This receipt was not found in the school fee ledger.'}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div
                    className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${
                      result.integrityMatch
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-amber-50 border-amber-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {result.integrityMatch ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-700 shrink-0 mt-0.5" />
                      ) : (
                        <ShieldAlert className="w-6 h-6 text-amber-700 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div
                          className={`text-sm font-bold ${
                            result.integrityMatch ? 'text-emerald-950' : 'text-amber-950'
                          }`}
                        >
                          {result.integrityMatch
                            ? 'Verified Authentic Payment in Student Ledger'
                            : 'Receipt Found — QR Integrity Mismatch Detected'}
                        </div>
                        <p
                          className={`text-xs mt-0.5 ${
                            result.integrityMatch ? 'text-emerald-800' : 'text-amber-900'
                          }`}
                        >
                          {result.integrityMatch
                            ? `Receipt ${result.payment?.receiptNo} matches the official SQLite ledger record.`
                            : result.mismatchReason}
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-xs font-bold text-slate-900 shrink-0">
                      {result.payment?.receiptNo}
                    </span>
                  </div>

                  {/* Verified Receipt + Live Student Ledger */}
                  {result.payment && result.student && result.termSummary && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                        <div className="font-semibold text-slate-900 pb-1.5 border-b border-slate-200">
                          Scanned Receipt Record
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-500">Amount Verified</span>
                          <span className="font-mono font-bold text-emerald-700 tabular-nums">
                            {formatUGX(result.payment.amount)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-500">Payment Date</span>
                          <span className="font-mono text-slate-900">{result.payment.paymentDate}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-500">Method &amp; Term</span>
                          <span className="text-slate-900">
                            {result.payment.method} · {result.payment.term}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-500">Recorded By</span>
                          <span className="text-slate-900">{result.payment.recordedBy}</span>
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200/80 space-y-2 text-xs">
                        <div className="font-semibold text-slate-900 pb-1.5 border-b border-blue-200/70">
                          Live Student Ledger ({result.activeTerm})
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-600">Student</span>
                          <span className="font-semibold text-slate-900 text-right">
                            {result.student.fullName}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-600">ID &amp; Class</span>
                          <span className="font-mono text-slate-900">
                            {result.student.admissionNo} · {result.className}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-600">Term Paid / Billed</span>
                          <span className="font-mono tabular-nums text-slate-900">
                            {formatUGX(result.termSummary.totalPaid)} / {formatUGX(result.termSummary.netBilled)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2 pt-1 border-t border-blue-200/70 font-semibold">
                          <span className="text-slate-800">Remaining Balance</span>
                          <span
                            className={`font-mono tabular-nums ${
                              result.termSummary.balance > 0 ? 'text-rose-700' : 'text-emerald-700'
                            }`}
                          >
                            {formatUGX(result.termSummary.balance)} ({result.termSummary.feeStatus})
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Recent Student Ledger Transactions */}
                  {result.studentPayments && result.studentPayments.length > 0 && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-800">
                        Student Payment Ledger History ({result.studentPayments.length})
                      </div>
                      <div className="max-h-44 overflow-y-auto divide-y divide-slate-100 text-xs">
                        {result.studentPayments.map((p) => {
                          const isScanned = p.id === result.payment?.id;
                          return (
                            <div
                              key={p.id}
                              className={`px-4 py-2 flex items-center justify-between gap-2 ${
                                isScanned ? 'bg-emerald-50/70 font-semibold' : ''
                              }`}
                            >
                              <div>
                                <span className="font-mono text-slate-900">{p.receiptNo}</span>
                                <span className="text-slate-500 ml-2">
                                  {p.paymentDate} · {p.term} · {p.method}
                                </span>
                              </div>
                              <span className="font-mono tabular-nums text-emerald-700">
                                {formatUGX(p.amount)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setResult(null);
                    setVerifyError('');
                    setManualInput('');
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Scan Another Receipt
                </button>

                <div className="flex flex-wrap items-center gap-2">
                  {result?.verified && result.payment && matchedSummary && (
                    <button
                      type="button"
                      onClick={() => onOpenReceipt(result.payment!, matchedSummary)}
                      className="px-3.5 py-2 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100"
                    >
                      Open Receipt &amp; QR
                    </button>
                  )}
                  {result?.verified && result.student && result.termSummary && result.termSummary.balance > 0 && (
                    <button
                      type="button"
                      onClick={() => onCollectFee(result.student!.id)}
                      className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700"
                    >
                      Collect Remaining Balance
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
