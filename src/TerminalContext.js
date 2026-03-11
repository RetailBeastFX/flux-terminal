import { createContext, useContext } from 'react';

export const TerminalContext = createContext(null);

export function useTerminal() {
  return useContext(TerminalContext);
}
