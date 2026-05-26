import { TOKEN_KEY_NAME } from '../const';

type Token = string;

const getToken = (): Token => localStorage.getItem(TOKEN_KEY_NAME) ?? '';

const saveToken = (token: Token): void => {
  localStorage.setItem(TOKEN_KEY_NAME, token);
};

const dropToken = (): void => {
  localStorage.removeItem(TOKEN_KEY_NAME);
};

export { dropToken, getToken, saveToken };
export type { Token };
