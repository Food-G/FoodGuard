const BASE_URL = '/api';

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

const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const error = await response.text();
    // 백엔드 오류 응답은 {"error": "안내 문구"} (일부는 {"message": ...}). 화면에는 문구만 보여 준다
    let message = error;
    try {
      const parsed = JSON.parse(error);
      message = parsed?.error ?? parsed?.message ?? error;
    } catch {
      // JSON 이 아니면 본문 그대로
    }
    throw new Error(message || 'API Request Failed');
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
    const response = await fetch(`${BASE_URL}${url}`, {
      method: 'GET',
      headers: getHeaders(),
      cache: 'no-store',
    });
    return handleResponse(response);
  },
  post: async (url: string, body: any) => {
    const response = await fetch(`${BASE_URL}${url}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    return handleResponse(response);
  },
  put: async (url: string, body: any) => {
    const response = await fetch(`${BASE_URL}${url}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    return handleResponse(response);
  },
  delete: async (url: string) => {
    const response = await fetch(`${BASE_URL}${url}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(response);
  },
};
