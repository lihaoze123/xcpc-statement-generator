import { type FC, type ReactNode, useEffect, useState } from "react";
import { typstInitStatus, fontAccessConfirmResolve } from "@/compiler";
import { useTranslation } from "react-i18next";

const TypstInitStatusProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState(typstInitStatus);
  const [showFontModal, setShowFontModal] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    let rafId: number | undefined;

    const loop = () => {
      setStatus(typstInitStatus);

      // Check if font access confirmation is needed
      if (fontAccessConfirmResolve) {
        setShowFontModal(true);
      }

      if (typstInitStatus === "pending") {
        rafId = requestAnimationFrame(loop);
      }
    };

    rafId = requestAnimationFrame(loop);
    return () => {
      if (rafId !== undefined) cancelAnimationFrame(rafId);
    };
  }, []);

  const handleConfirmFont = () => {
    setShowFontModal(false);
    fontAccessConfirmResolve?.();
  };

  return (
    <>
      {children}
      {status === "pending" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
          <div className="text-center">
            <span className="loading loading-spinner loading-lg text-primary"></span>
            <p className="mt-4 text-gray-600">{t('messages:initializingTypst') || 'Initializing Typst compiler...'}</p>
            <p className="mt-2 text-sm text-gray-400">{t('messages:downloadingCompiler') || 'Downloading compiler and fonts'}</p>
          </div>
        </div>
      )}
      {showFontModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">{t('messages:requestFontAccess')}</h3>
            <p className="py-4">{t('messages:fontAccessDescription')}</p>
            <div className="modal-action">
              <button className="btn btn-primary" onClick={handleConfirmFont}>
                {t('common:confirm')}
              </button>
            </div>
          </div>
          <div className="modal-backdrop"></div>
        </div>
      )}
    </>
  );
};

export default TypstInitStatusProvider;
