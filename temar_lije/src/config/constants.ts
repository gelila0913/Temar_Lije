export const API_BASE_URL =
  import.meta.env?.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.port === '5173'
    ? 'http://localhost:3000'
    : '/api');

export const getSocketUrl = (namespace = '') => {
  if (typeof window !== 'undefined') {
    if (window.location.port === '5173') {
      return `http://localhost:3000${namespace}`;
    }
    return `${window.location.origin}${namespace}`;
  }
  return namespace || '/';
};
