import type { FC } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { name as appName, version as appVersion } from "../package.json";
import TypstInitStatusProvider from "./components/TypstInitStatusProvider";
import { ToastProvider } from "./components/ToastProvider";
import ContestEditor from "./contestEditor";
import "./index.css";
import "./App.css";

const App: FC = () => {
  return (
    <ToastProvider>
      <TypstInitStatusProvider>
        <div className="app w-screen h-screen overflow-hidden text-gray-800 flex flex-col">
          <main className="flex-1 min-h-0 m-0 mx-4 mb-3">
            <ContestEditor />
          </main>
          <footer>
            <a
              href="https://github.com/lihaoze123/xcpc-statement-generator"
              target="_blank"
              rel="noopener noreferrer"
            >
              <FontAwesomeIcon icon={faGithub} className="mr-1.5" />
              {appName} v{appVersion} · {GIT_COMMIT_INFO}
            </a>
            <span className="mx-2">·</span>
            <span>Developed by chumeng with ♥️</span>
          </footer>
        </div>
      </TypstInitStatusProvider>
    </ToastProvider>
  );
};

export default App;
