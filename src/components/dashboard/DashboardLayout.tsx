import { useState, useCallback, useEffect, useRef } from "react";
import { clearOnboardingProgress } from "@/lib/onboardingProgress";
import { processScanFile } from "@/lib/scanUpload";
import { Outlet, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Camera, ImageIcon } from "lucide-react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import MobileBottomNav from "@/components/dashboard/MobileBottomNav";
import { useProfile } from "@/hooks/useProfile";
import { useLoginStreak } from "@/hooks/useLoginStreak";
import { MonthProvider } from "@/contexts/MonthContext";
import NovaTransacaoModal, { type PrefillData, type EditTransactionData } from "@/components/dashboard/NovaTransacaoModal";
import TransferModal from "@/components/dashboard/TransferModal";
import type { ExtractedItem } from "@/components/fatura/InvoiceUploadReviewModal";
import { showScanSavedToast } from "@/components/scan/scanSavedToast";
import BottomSheet from "@/components/shared/BottomSheet";
import ScanCaptureScreen from "@/components/scan/ScanCaptureScreen";
import ScannerScreen from "@/components/scan/ScannerScreen";
import OnboardingFlow from "@/components/onboarding/OnboardingFlow";
import WelcomeToAppModal from "@/components/dashboard/WelcomeToAppModal";
import { supabase } from "@/integrations/supabase/client";
import { createTransaction, getAccounts } from "@/services/transactionService";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useSwipeBack } from "@/hooks/useSwipeBack";
import {
  SKIP_LEGACY_ONBOARDING_KEY,
  SHOW_WELCOME_MODAL_KEY,
  readPendingOnboardingProfile,
  clearPendingOnboardingProfile,
  markShowWelcomeModal,
} from "@/lib/onboardingQuiz";

interface ScanAccountOption {
  id: string;
  name: string;
  type: string;
  is_default: boolean;
}

const DashboardLayout = () => {
  useSwipeBack();
  const profileState = useProfile();
  const { profile, loading: profileLoading, refetch: refetchProfile } = profileState;
  const { user } = useAuth();
  const navigate = useNavigate();
  const { streak, streakDates } = useLoginStreak();
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [modalType, setModalType] = useState<"receita" | "despesa">("despesa");

  // OCR state
  const [showScanner, setShowScanner] = useState(false);
  const [showScanScreen, setShowScanScreen] = useState(false);
  const [scanPhotoUrl, setScanPhotoUrl] = useState<string | null>(null);
  const [scanResultReady, setScanResultReady] = useState(false);
  const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([]);
  const [avgConfidence, setAvgConfidence] = useState<number>(0);
  const [scanAccountId, setScanAccountId] = useState<string | null>(null);
  const [confirmingImport, setConfirmingImport] = useState(false);
  const [scanAccounts, setScanAccounts] = useState<ScanAccountOption[]>([]);

  // Fallback pre-fill for low confidence items
  const [prefillData, setPrefillData] = useState<PrefillData | null>(null);
  const [editTransaction, setEditTransaction] = useState<EditTransactionData | null>(null);


  const getSafeTransactionDate = useCallback((rawDate: string | null | undefined) => {
    const today = new Date();
    const fallback = today.toISOString().split("T")[0];

    if (!rawDate) return fallback;

    const parsed = new Date(`${rawDate}T12:00:00`);
    if (Number.isNaN(parsed.getTime())) return fallback;

    // Keep the date printed on the receipt, even from past months; only
    // future dates are treated as a misread.
    if (parsed > today) return fallback;

    return rawDate;
  }, []);

  // Global listener for the mobile + button and desktop "Nova transação"
  useEffect(() => {
    const handleDirect = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.type === "transferencia") {
        setShowTransferModal(true);
      } else if (detail?.type === "receita" || detail?.type === "despesa") {
        setModalType(detail.type);
        setShowModal(true);
      }
    };
    // The viewfinder opens in the app rather than handing off to the system camera
    // sheet, so the frame, the gallery and manual entry all sit on one screen.
    const handleScanner = () => setShowScanner(true);
    const handleEditTransaction = (e: Event) => {
      const detail = (e as CustomEvent).detail as EditTransactionData;
      if (detail) {
        setEditTransaction(detail);
        setModalType(detail.type);
        setShowModal(true);
      }
    };
    // Fired after "Apagar tudo" in Configurações — brings back the
    // "Vamos deixar tudo pronto?" prompt, same as right after signup.
    const handleShowWelcome = () => {
      markShowWelcomeModal();
      setShowWelcomeModal(true);
      refetchProfile();
    };
    // One sheet now asks which kind of entry it is, so there is nothing to choose first.
    const handleTypeChooser = () => {
      setModalType("despesa");
      setShowModal(true);
    };
    window.addEventListener("open-type-chooser", handleTypeChooser);
    window.addEventListener("open-nova-transacao-direct", handleDirect);
    window.addEventListener("open-scanner", handleScanner);
    window.addEventListener("edit-transaction", handleEditTransaction);
    window.addEventListener("show-welcome-modal", handleShowWelcome);
    return () => {
      window.removeEventListener("open-type-chooser", handleTypeChooser);
      window.removeEventListener("open-nova-transacao-direct", handleDirect);
      window.removeEventListener("open-scanner", handleScanner);
      window.removeEventListener("edit-transaction", handleEditTransaction);
      window.removeEventListener("show-welcome-modal", handleShowWelcome);
    };
  }, [refetchProfile]);

  // Two taps on any empty part of any screen start an entry. Controls and anything
  // inside an open sheet are left alone, or the gesture would fire while you are
  // using them — and a double tap that lands on text should not count either.
  useEffect(() => {
    let last = 0;
    const onPointerUp = (e: PointerEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest('button, a, input, textarea, select, [role="dialog"], [role="button"], [contenteditable]')) {
        last = 0;
        return;
      }
      const now = Date.now();
      if (now - last < 320) {
        last = 0;
        window.dispatchEvent(new CustomEvent("open-type-chooser"));
      } else {
        last = now;
      }
    };
    document.addEventListener("pointerup", onPointerUp);
    return () => document.removeEventListener("pointerup", onPointerUp);
  }, []);

  const handleSuccess = useCallback(() => {
    window.dispatchEvent(new CustomEvent("transaction-created"));
  }, []);

  useEffect(() => {
    if (!showScanScreen || !user) return;

    getAccounts()
      .then((accounts) => {
        const filteredAccounts = (accounts as ScanAccountOption[]).filter((account) => account.type !== "investment");
        setScanAccounts(filteredAccounts);
      })
      .catch(() => {
        toast.error("Erro ao carregar contas");
      });
  }, [showScanScreen, user]);

  const closeScanScreen = useCallback(() => {
    setShowScanScreen(false);
    setScanResultReady(false);
    setScanPhotoUrl((url) => {
      if (url) setTimeout(() => URL.revokeObjectURL(url), 600);
      return null;
    });
  }, []);

  // OCR scan handler: show the photo while the AI reads it, then the confirm card
  const handleScanFile = useCallback(async (file: File) => {
    setExtractedItems([]);
    setScanResultReady(false);
    // Same capture screen for camera and gallery; some gallery files (HEIC) come without a MIME type
    setScanPhotoUrl(file.type === "application/pdf" ? null : URL.createObjectURL(file));
    setShowScanScreen(true);
    try {
      const data = await processScanFile(file, "transaction");

      const items: ExtractedItem[] = (data.items || []).map((item: any) => ({
        ...item,
        date: getSafeTransactionDate(item.date),
        selected: true,
      }));

      if (items.length === 0) {
        closeScanScreen();
        toast.error("Não encontramos nenhum valor nesse comprovante. Tente outra foto.");
        return;
      }

      setExtractedItems(items);
      setAvgConfidence(data.avg_confidence || 0);
      setScanResultReady(true);
    } catch (err: any) {
      closeScanScreen();
      toast.error(err?.message || "Erro ao processar documento");
    }
  }, [getSafeTransactionDate, closeScanScreen]);

  // Preselect the default account once accounts load
  useEffect(() => {
    if (scanAccountId || scanAccounts.length === 0) return;
    setScanAccountId((scanAccounts.find((a) => a.is_default) ?? scanAccounts[0]).id);
  }, [scanAccounts, scanAccountId]);

  // Confirm import of scanned transactions
  const handleConfirmScanImport = useCallback(async (scanned: ExtractedItem[]) => {
    const selectedItems = scanned.filter((i) => i.selected !== false);
    if (!user || selectedItems.length === 0) return false;
    setConfirmingImport(true);
    try {
      for (const item of selectedItems) {
        await createTransaction(
          {
            name: item.description,
            type: (item.type as "receita" | "despesa") || "despesa",
            amount: item.amount,
            category: item.category || "outros",
            // Already sanitized when scanned; keep whatever the person set while editing
            date: item.date || getSafeTransactionDate(null),
            time: item.time || null,
            status: "pago",
            account_id: item.account_id || scanAccountId,
            payment_method: "conta",
            recurrence_type: item.is_recurring ? "fixa" : (item.installment_total && item.installment_total > 1 ? "parcelado" : "unica"),
            installments: item.installment_total || null,
            installment_current: item.installment_current || null,
          },
          user.id
        );
      }

      showScanSavedToast(
        selectedItems,
        () => navigate("/transacoes"),
      );
      setExtractedItems([]);
      handleSuccess();
      return true;
    } catch (err: any) {
      toast.error(err?.message || "Erro ao importar transações");
      return false;
    } finally {
      setConfirmingImport(false);
    }
  }, [user, handleSuccess, getSafeTransactionDate, scanAccountId, navigate]);

  const handleModalClose = useCallback(() => {
    setShowModal(false);
    setPrefillData(null);
    setEditTransaction(null);
  }, []);

  // People who signed up through the new pre-signup onboarding quiz
  // (Welcome carousel -> quiz -> account -> plans) shouldn't see this old
  // onboarding again. CreateAccountStep flags this in localStorage right
  // after signup — it can't mark profiles.has_completed_profile itself
  // (RLS needs a live session, which doesn't exist yet for e-mail/password
  // signups pending confirmation), so we finish that write here, the first
  // time this layout mounts with both a real session and a loaded profile.
  const [skippingLegacyOnboarding, setSkippingLegacyOnboarding] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(SKIP_LEGACY_ONBOARDING_KEY) === "1"
  );

  // "Let's finish setting up?" modal — shown once, right after the new
  // onboarding flow lands someone in the app for the first time.
  const [showWelcomeModal, setShowWelcomeModal] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(SHOW_WELCOME_MODAL_KEY) === "1"
  );

  useEffect(() => {
    if (!skippingLegacyOnboarding || !user || !profile || profile.has_completed_profile) return;
    localStorage.removeItem(SKIP_LEGACY_ONBOARDING_KEY);
    const pending = readPendingOnboardingProfile();
    clearPendingOnboardingProfile();
    const update: Record<string, unknown> = { has_completed_profile: true };
    if (pending?.displayName) update.display_name = pending.displayName;
    if (typeof pending?.initialScore === "number") update.initial_score = pending.initialScore;
    if (pending?.initialScoreLabel) update.initial_score_label = pending.initialScoreLabel;
    supabase
      .from("profiles" as any)
      .update(update as any)
      .eq("id", user.id)
      .then(() => {
        markShowWelcomeModal();
        // The modal's own state was already initialized (at mount, before
        // this async write landed) from localStorage — flip it directly too,
        // otherwise it'd never show until a future remount picks the flag up.
        setShowWelcomeModal(true);
        refetchProfile();
      });
  }, [skippingLegacyOnboarding, user, profile, refetchProfile]);
  // Signed in: the saved onboarding (result + paywall loop) has done its job
  useEffect(() => {
    if (user) clearOnboardingProgress();
  }, [user]);

  const dismissWelcomeModal = useCallback(() => {
    localStorage.removeItem(SHOW_WELCOME_MODAL_KEY);
    setShowWelcomeModal(false);
  }, []);
  const handleConfigureNow = useCallback(() => {
    dismissWelcomeModal();
    navigate("/configurar");
  }, [dismissWelcomeModal, navigate]);

  // Show full-screen onboarding if profile loaded and name not set yet
  const showOnboarding =
    !profileLoading && profile && !profile.has_completed_profile && !onboardingDismissed && !skippingLegacyOnboarding;

  const handleOnboardingComplete = useCallback(async () => {
    setOnboardingDismissed(true);
    await refetchProfile();
    window.dispatchEvent(new CustomEvent("transaction-created"));
  }, [refetchProfile]);

  // Drives the scroll edge: nothing is under the header until the page has moved.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <MonthProvider>
      {showOnboarding && (
        <OnboardingFlow onComplete={handleOnboardingComplete} onRefetch={refetchProfile} />
      )}
      <div className="willo-bg min-h-screen text-foreground" style={showOnboarding ? { display: "none" } : undefined}>
        <div className="willo-scroll-edge md:hidden" data-on={scrolled} aria-hidden="true" />
        <div className="w-full mx-auto px-4 md:px-6 lg:px-8 xl:px-12 pt-0 pb-24 md:pb-8">
          <DashboardHeader profile={profile} streak={streak} streakDates={streakDates} />
          <Outlet context={profileState} />
        </div>
        <MobileBottomNav />
        <WelcomeToAppModal open={showWelcomeModal} onConfigure={handleConfigureNow} onSkip={dismissWelcomeModal} />
        <ScannerScreen
          open={showScanner}
          onClose={() => setShowScanner(false)}
          onCapture={(file) => { setShowScanner(false); handleScanFile(file); }}
          onManual={() => { setShowScanner(false); setModalType("despesa"); setShowModal(true); }}
        />

        <ScanCaptureScreen
          open={showScanScreen}
          photoUrl={scanPhotoUrl}
          items={scanResultReady ? extractedItems : null}
          onItemsChange={setExtractedItems}
          accounts={scanAccounts}
          accountId={scanAccountId}
          onAccountChange={setScanAccountId}
          lowConfidence={avgConfidence > 0 && avgConfidence < 0.7}
          confirming={confirmingImport}
          onClose={closeScanScreen}
          onConfirm={async () => {
            if (await handleConfirmScanImport(extractedItems)) closeScanScreen();
          }}
        />

        <NovaTransacaoModal
          open={showModal}
          onClose={handleModalClose}
          onSuccess={handleSuccess}
          initialType={modalType}
          prefillData={prefillData}
          editTransaction={editTransaction}
        />
        <TransferModal open={showTransferModal} onClose={() => setShowTransferModal(false)} onSuccess={handleSuccess} />
      </div>
    </MonthProvider>
  );
};

export default DashboardLayout;
