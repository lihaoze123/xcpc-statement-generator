import type { FC } from "react";
import { useTranslation } from "react-i18next";
import TypstInitStatusProvider from "./components/TypstInitStatusProvider";
import { ToastProvider } from "./components/ToastProvider";
import ContestEditor from "./contestEditor";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { faLanguage } from "@fortawesome/free-solid-svg-icons";
import { name as appName, version as appVersion } from "../package.json";
import "./index.css";
import "./App.css";

const App: FC = () => {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === "zh" ? "en" : "zh";
    i18n.changeLanguage(newLang);
    localStorage.setItem("language", newLang);
  };

  return (
    <ToastProvider>
      <TypstInitStatusProvider>
        <div className="app">
          <main>
            <ContestEditor />
          </main>
          <footer className="flex items-center justify-between px-4 py-2 bg-white border-t border-gray-200 text-sm text-gray-600">
            <div>
              <a
                href="https://github.com/lihaoze123/xcpc-statement-generator"
                target="_blank"
                className="hover:text-[#1D71B7] transition-colors"
              >
                <FontAwesomeIcon icon={faGithub} className="mr-1" />
                {appName}
              </a>{" "}
              <span>v{appVersion}</span>{" "}
              <span className="text-gray-400">({GIT_COMMIT_INFO + (import.meta.env.DEV ? "-dev" : "")})</span>
            </div>
            <div className="flex items-center gap-4">
              <button
                className="text-gray-500 hover:text-[#1D71B7] transition-colors"
                onClick={toggleLanguage}
              >
                <FontAwesomeIcon icon={faLanguage} className="mr-1" />
                {i18n.language === "zh" ? "English" : "中文"}
              </button>
              <span>Developed by chumeng</span>
            </div>
          </footer>
        </div>
      </TypstInitStatusProvider>
    </ToastProvider>
  );
};

export default App;
