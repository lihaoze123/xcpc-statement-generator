import { type FC, type ReactNode, useEffect, useState } from "react";
import { typstInitStatus, fontAccessConfirmResolve } from "@/compiler";
import { useTranslation } from "react-i18next";

const TypstInitStatusProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [, setStatus] = useState(typstInitStatus);
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
