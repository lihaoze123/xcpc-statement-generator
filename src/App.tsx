import type { FC } from "react";
import { App as AntdApp } from "antd";
import TypstInitStatusProvider from "./components/TypstInitStatusProvider";
import ContestEditor from "./contestEditor";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { name as appName, version as appVersion } from "../package.json";
import "./App.css";

const App: FC = () => {
  return (
    <AntdApp>
      <TypstInitStatusProvider>
        <div className="app">
          <main>
            <ContestEditor />
          </main>
          <footer>
            <div>
              <a
                href="https://github.com/lihaoze123/xcpc-statement-generator"
                target="_blank"
              >
                <FontAwesomeIcon icon={faGithub} />
                {appName}
              </a>{" "}
              <span>v{appVersion}</span>{" "}
              <span>({GIT_COMMIT_INFO + (import.meta.env.DEV ? "-dev" : "")})</span>
            </div>
            <div>Developed by chumeng</div>
          </footer>
        </div>
      </TypstInitStatusProvider>
    </AntdApp>
  );
};

export default App;
