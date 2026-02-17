import type { FC } from "react";
import TypstInitStatusProvider from "./components/TypstInitStatusProvider";
import { ToastProvider } from "./components/ToastProvider";
import ContestEditor from "./contestEditor";
import "./index.css";
import "./App.css";

const App: FC = () => {
  return (
    <ToastProvider>
      <TypstInitStatusProvider>
        <div className="w-screen h-screen overflow-hidden text-gray-800 flex flex-col">
          <ContestEditor />
        </div>
      </TypstInitStatusProvider>
    </ToastProvider>
  );
};

export default App;
