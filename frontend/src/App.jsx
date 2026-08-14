import React, { useRef } from "react";
import LandingPage from "./LandingPage";
import ChatWidget from "./ChatWidget";
import "./App.css";

export default function App() {
  const chatWidgetRef = useRef(null);

  const handleOpenChatWithMessage = (msg) => {
    chatWidgetRef.current?.openAndSend(msg);
  };

  return (
    <>
      <LandingPage onOpenChatWithMessage={handleOpenChatWithMessage} />
      <ChatWidget ref={chatWidgetRef} />
    </>
  );
}