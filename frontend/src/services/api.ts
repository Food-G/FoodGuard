const BASE_URL = '/api';
const TIMEOUT_MS = 10000;

const getHeaders = () => {
  const token = localStorage.getItem('token');
  const headers: any = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

const fetchWithTimeout = (url: string, options: RequestInit) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
};

const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'API Request Failed');
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    const json = await response.json();
    return json;
  }
  return response.text();
};

export const api = {
  get: async (url: string) => {
    const response = await fetchWithTimeout(`${BASE_URL}${url}`, {
      method: 'GET',
      headers: getHeaders(),
      cache: 'no-store',
    });
    return handleResponse(response);
  },
  post: async (url: string, body: any) => {
    const response = await fetchWithTimeout(`${BASE_URL}${url}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    return handleResponse(response);
  },
  put: async (url: string, body: any) => {
    const response = await fetchWithTimeout(`${BASE_URL}${url}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    return handleResponse(response);
  },
  delete: async (url: string) => {
    const response = await fetchWithTimeout(`${BASE_URL}${url}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(response);
  },
};
