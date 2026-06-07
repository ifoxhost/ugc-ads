import { createContext, useContext, useRef, useCallback } from "react";

type SubmitCallback = () => void;

interface CreateSubmitContextType {
  registerSubmit: (callback: SubmitCallback) => void;
  unregisterSubmit: () => void;
  triggerSubmit: () => void;
}

const CreateSubmitContext = createContext<CreateSubmitContextType | null>(null);

export const CreateSubmitProvider = ({ children }: { children: React.ReactNode }) => {
  const submitCallbackRef = useRef<SubmitCallback | null>(null);

  const registerSubmit = useCallback((callback: SubmitCallback) => {
    submitCallbackRef.current = callback;
  }, []);

  const unregisterSubmit = useCallback(() => {
    submitCallbackRef.current = null;
  }, []);

  const triggerSubmit = useCallback(() => {
    if (submitCallbackRef.current) {
      submitCallbackRef.current();
    }
  }, []);

  return (
    <CreateSubmitContext.Provider value={{ registerSubmit, unregisterSubmit, triggerSubmit }}>
      {children}
    </CreateSubmitContext.Provider>
  );
};

export const useCreateSubmit = () => {
  const context = useContext(CreateSubmitContext);
  if (!context) {
    throw new Error("useCreateSubmit must be used within CreateSubmitProvider");
  }
  return context;
};
