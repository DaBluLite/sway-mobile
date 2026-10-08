export type AlertButtonStyle = 'default' | 'cancel' | 'destructive';
export interface AlertButton { text?: string; onPress?: (value?: string) => void; style?: AlertButtonStyle; isPreferred?: boolean; }
export interface AlertOptions { cancelable?: boolean; onDismiss?: () => void; }
export type AlertPromptType = 'plain-text' | 'secure-text' | 'login-password';
export type AlertPromptKeyboardType = 'default' | 'numeric' | 'email-address' | 'phone-pad';

type AlertState = {
  visible: boolean; title: string; message?: string; buttons: AlertButton[]; options?: AlertOptions;
  showInput: boolean; promptType: AlertPromptType; defaultValue?: string; keyboardType: AlertPromptKeyboardType; inputValue: string;
};
const initialState: AlertState = {
  visible: false, title: '', message: undefined, buttons: [], options: undefined,
  showInput: false, promptType: 'plain-text', defaultValue: undefined, keyboardType: 'default', inputValue: '',
};
let state: AlertState = initialState;
const listeners = new Set<() => void>();
const setState = (next: AlertState) => { state = next; listeners.forEach(l => l()); };
export const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const getSnapshot = () => state;
const normalizeButtons = (buttons?: AlertButton[]): AlertButton[] => buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }];
export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) {
    setState({ ...state, visible: true, title, message, buttons: normalizeButtons(buttons), options, showInput: false, inputValue: '' });
  },
  prompt(title: string, message?: string, callbackOrButtons?: ((value: string) => void) | AlertButton[], type: AlertPromptType = 'plain-text', defaultValue?: string, keyboardType: AlertPromptKeyboardType = 'default') {
    const hasCallback = typeof callbackOrButtons === 'function';
    const buttons: AlertButton[] = hasCallback ? [{ text: 'Cancel', style: 'cancel' }, { text: 'OK', onPress: value => (callbackOrButtons as (value: string) => void)(value ?? '') }] : normalizeButtons(callbackOrButtons as AlertButton[] | undefined);
    setState({ ...state, visible: true, title, message, buttons, showInput: true, promptType: type, defaultValue, keyboardType, inputValue: defaultValue ?? '' });
  },
  dismiss() { setState({ ...state, visible: false }); },
};
export const setAlertInputValue = (text: string) => setState({ ...state, inputValue: text });
export type { AlertState };
