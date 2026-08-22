export const API_BASE_URL =
  import.meta.env?.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.port === '5173'
    ? 'http://localhost:3000'
    : '/api');

/**
 * Custom error class containing API response status and error message
 */
export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Base fetch wrapper with error parsing and credentials support
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const config = {
    ...options,
    headers,
    credentials: options.credentials || 'include', // includes cookies for refresh tokens
  };

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  let response;
  try {
    response = await fetch(url, config);
  } catch (err) {
    throw new ApiError(
      'Unable to connect to the server. Please ensure the backend is running.',
      0,
      null,
    );
  }

  let data;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json().catch(() => null);
  } else {
    data = await response.text().catch(() => null);
  }

  if (!response.ok) {
    let errorMessage = 'An unexpected error occurred';
    if (data) {
      if (Array.isArray(data.message)) {
        // NestJS class-validator errors array
        errorMessage = data.message.join('. ');
      } else if (typeof data.message === 'string') {
        errorMessage = data.message;
      } else if (typeof data.error === 'string') {
        errorMessage = data.error;
      }
    }
    throw new ApiError(errorMessage, response.status, data);
  }

  return data;
}

export const authApi = {
  /**
   * Register a new user
   * @param {{ fullName: string, email: string, password: string, role: string }} data
   */
  async register({ fullName, email, password, role, classroomCode }) {
    // Backend RegisterRole enum is 'STUDENT' or 'TEACHER'
    const normalizedRole = (role || 'student').toUpperCase();
    return request('/auth/register', {
      method: 'POST',
      body: {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        role: normalizedRole,
        ...(classroomCode ? { classroomCode: classroomCode.trim().toUpperCase() } : {}),
      },
    });
  },

  /**
   * Login user with email and password
   * @param {{ email: string, password: string }} data
   */
  async login({ email, password }) {
    return request('/auth/login', {
      method: 'POST',
      body: {
        email: email.trim().toLowerCase(),
        password,
      },
    });
  },

  /**
   * Get Google OAuth kickoff URL
   * @param {{ role?: string }} [options]
   */
  getGoogleAuthUrl({ role } = {}) {
    if (role && (role.toUpperCase() === 'TEACHER' || role.toUpperCase() === 'STUDENT')) {
      return `${API_BASE_URL}/auth/google?role=${role.toUpperCase()}`;
    }
    return `${API_BASE_URL}/auth/google`;
  },

  /**
   * Refresh token using HttpOnly cookie
   */
  async refresh() {
    return request('/auth/refresh', {
      method: 'POST',
    });
  },

  /**
   * Verify email address using token from email link
   * @param {{ token: string }} data
   */
  async verifyEmail({ token }) {
    return request('/auth/verify-email', {
      method: 'POST',
      body: { token },
    });
  },

  /**
   * Resend verification email
   * @param {{ email: string }} data
   */
  async resendVerification({ email }) {
    return request('/auth/resend-verification', {
      method: 'POST',
      body: { email: email.trim().toLowerCase() },
    });
  },

  /**
   * Request password reset email
   * @param {{ email: string }} data
   */
  async forgotPassword({ email }) {
    return request('/auth/forgot-password', {
      method: 'POST',
      body: { email: email.trim().toLowerCase() },
    });
  },

  /**
   * Reset password with token and new password
   * @param {{ token: string, newPassword: string }} data
   */
  async resetPassword({ token, newPassword }) {
    return request('/auth/reset-password', {
      method: 'POST',
      body: { token, newPassword },
    });
  },

  /**
   * Logout user
   * @param {string} accessToken
   */
  async logout(accessToken) {
    const headers = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    return request('/auth/logout', {
      method: 'POST',
      headers,
    });
  },
};
