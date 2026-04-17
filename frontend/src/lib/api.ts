const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

// Helper function to get auth token
export const getAuthToken = (): string | null => {
  return localStorage.getItem('access_token');
};

// Helper function to set auth tokens
export const setAuthTokens = (access: string, refresh: string) => {
  localStorage.setItem('access_token', access);
  localStorage.setItem('refresh_token', refresh);
};

// Helper function to clear auth tokens
export const clearAuthTokens = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
};

// Helper function to get headers
const getHeaders = (includeAuth: boolean = true): HeadersInit => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (includeAuth) {
    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  
  return headers;
};

// Helper function to handle file upload headers
const getFileUploadHeaders = (): HeadersInit => {
  const headers: HeadersInit = {};
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

// API request helper
const apiRequest = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Determine if we need to set Content-Type (not for FormData)
  const isFormData = options.body instanceof FormData;
  
  // Build headers
  const headers: HeadersInit = {};
  
  // Only set Content-Type for non-FormData requests
  // FormData's Content-Type with boundary is set automatically by the browser
  if (!isFormData && options.method !== 'GET') {
    headers['Content-Type'] = 'application/json';
  }
  
  // Always include auth token if available (for both FormData and JSON requests)
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // Merge with any custom headers
  const finalHeaders = {
    ...headers,
    ...options.headers,
  };
  
  const response = await fetch(url, {
    ...options,
    headers: finalHeaders,
  });

  if (!response.ok) {
    if (response.status === 401) {
      // Try to refresh token
      const refreshed = await refreshToken();
      if (refreshed) {
        // Retry request with new token
        const retryResponse = await fetch(url, {
          ...options,
          headers: {
            ...getHeaders(),
            ...options.headers,
          },
        });
        if (!retryResponse.ok) {
          const retryError = await retryResponse.json().catch(() => ({ detail: retryResponse.statusText }));
          const apiError: any = new Error(retryError.detail || retryError.message || retryError.error || 'API Error');
          apiError.errors = retryError.errors;
          apiError.error = retryError.error;
          throw apiError;
        }
        return retryResponse.json();
      } else {
        clearAuthTokens();
        window.location.href = '/login';
        throw new Error('Authentication failed');
      }
    }
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    const apiError: any = new Error(error.detail || error.message || error.error || 'API Error');
    apiError.errors = error.errors;
    apiError.error = error.error;
    throw apiError;
  }

  return response.json();
};

// Refresh token
const refreshToken = async (): Promise<boolean> => {
  const refresh = localStorage.getItem('refresh_token');
  if (!refresh) return false;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });

    if (response.ok) {
      const data = await response.json();
      setAuthTokens(data.access, refresh);
      return true;
    }
  } catch (error) {
    console.error('Token refresh failed:', error);
  }
  return false;
};

// Auth API
export const authAPI = {
  register: async (data: {
    username: string;
    email: string;
    password: string;
    password2: string;
    first_name?: string;
    last_name?: string;
  }) => {
    // Don't use apiRequest for registration - no auth token needed
    const response = await fetch(`${API_BASE_URL}/auth/register/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      const apiError: any = new Error(error.error || error.detail || 'Registration failed');
      apiError.errors = error.errors;
      throw apiError;
    }

    return response.json();
  },

  login: async (username: string, password: string) => {
    // Don't use apiRequest for login - no auth token needed
    const response = await fetch(`${API_BASE_URL}/auth/login/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || 'Login failed');
    }

    return response.json();
  },
};

// Location API
export const locationAPI = {
  getStates: async () => {
    try {
      const url = `${API_BASE_URL}/states/`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('States API response:', data);
      // Handle paginated response: extract 'results' array if present
      return Array.isArray(data) ? data : (data.results || []);
    } catch (error) {
      console.error('Error fetching states:', error);
      return [];
    }
  },

  getDistricts: async (stateId?: number) => {
    try {
      const url = stateId 
        ? `${API_BASE_URL}/districts/?state=${stateId}` 
        : `${API_BASE_URL}/districts/`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      // Handle paginated response: extract 'results' array if present
      return Array.isArray(data) ? data : (data.results || []);
    } catch (error) {
      console.error('Error fetching districts:', error);
      return [];
    }
  },

  getCities: async (districtId?: number) => {
    try {
      const url = districtId 
        ? `${API_BASE_URL}/cities/?district=${districtId}` 
        : `${API_BASE_URL}/cities/`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      // Handle paginated response: extract 'results' array if present
      return Array.isArray(data) ? data : (data.results || []);
    } catch (error) {
      console.error('Error fetching cities:', error);
      return [];
    }
  },
};

// Category API
export const categoryAPI = {
  getAll: async () => {
    try {
      const url = `${API_BASE_URL}/categories/`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Categories API response:', data);
      // Handle paginated response: extract 'results' array if present
      return Array.isArray(data) ? data : (data.results || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      return [];
    }
  },
};

// Tag API
export const tagAPI = {
  getAll: async () => {
    return apiRequest<Array<{ id: number; name: string; slug: string; usage_count: number }>>('/tags/', {
      headers: getHeaders(false),
    });
  },

  search: async (query: string) => {
    return apiRequest<Array<{ id: number; name: string; slug: string; usage_count: number }>>(`/tags/?search=${encodeURIComponent(query)}`, {
      headers: getHeaders(false),
    });
  },
};

// Issue API
export const issueAPI = {
  getAll: async (params?: {
    page?: number;
    category?: number;
    state?: number;
    district?: number;
    city?: number;
    scope?: string;
    status?: string;
    sort_by?: 'trending' | 'recent' | 'votes' | 'comments';
    search?: string;
  }) => {
    try {
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.category) queryParams.append('category', params.category.toString());
      if (params?.state) queryParams.append('state', params.state.toString());
      if (params?.district) queryParams.append('district', params.district.toString());
      if (params?.city) queryParams.append('city', params.city.toString());
      if (params?.scope) queryParams.append('scope', params.scope);
      if (params?.status) queryParams.append('status', params.status);
      if (params?.sort_by) queryParams.append('sort_by', params.sort_by);
      if (params?.search && params.search.trim()) queryParams.append('search', params.search.trim());

      const url = `/issues/${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await apiRequest<{
        count: number;
        next: string | null;
        previous: string | null;
        results: any[];
      }>(url, {
        headers: getHeaders(false),
      });
      
      // Ensure results is always an array
      return {
        count: response.count || 0,
        next: response.next || null,
        previous: response.previous || null,
        results: Array.isArray(response.results) ? response.results : []
      };
    } catch (error) {
      console.error('Error fetching issues:', error);
      // Return empty structure on error
      return {
        count: 0,
        next: null,
        previous: null,
        results: []
      };
    }
  },

  getById: async (id: number) => {
    return apiRequest<any>(`/issues/${id}/`, {
      headers: getHeaders(false),
    });
  },

  create: async (data: {
    title: string;
    description: string;
    is_anonymous: boolean;
    category: number;
    state?: number;
    district?: number;
    city?: number;
    scope: string;
    tags?: string[];
    submission_token?: string;
  }, mediaFiles: File[] = []) => {
    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('description', data.description);
    formData.append('is_anonymous', data.is_anonymous.toString());
    formData.append('category', data.category.toString());
    formData.append('scope', data.scope);
    if (data.state) formData.append('state', data.state.toString());
    if (data.district) formData.append('district', data.district.toString());
    if (data.city) formData.append('city', data.city.toString());
    if (data.tags && data.tags.length > 0) {
      data.tags.forEach(tag => {
        if (tag.trim()) {
          formData.append('tags', tag.trim());
        }
      });
    }
    if (data.submission_token) formData.append('submission_token', data.submission_token);

    // Add media files
    mediaFiles.forEach((file, index) => {
      formData.append(`media_${index}`, file);
    });

    const token = getAuthToken();
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/issues/`, {
      method: 'POST',
      headers: headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || error.message || 'Failed to create issue');
    }

    return response.json();
  },

  update: async (id: number, data: {
    title: string;
    description: string;
    is_anonymous: boolean;
    category: number;
    state?: number;
    district?: number;
    city?: number;
    scope: string;
    tags?: string[];
  }) => {
    return apiRequest<any>(`/issues/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: number) => {
    const response = await fetch(`${API_BASE_URL}/issues/${id}/`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || error.message || 'Failed to delete issue');
    }
  },

  getMine: async (page?: number) => {
    const query = page ? `?page=${page}` : '';
    return apiRequest<{ count: number; next: string | null; previous: string | null; results: any[] }>(`/issues/mine/${query}`);
  },

  vote: async (id: number, voteType: 'upvote' | 'downvote') => {
    return apiRequest<any>(`/issues/${id}/vote/`, {
      method: 'POST',
      body: JSON.stringify({ vote_type: voteType }),
    });
  },

  view: async (id: number) => {
    return apiRequest<{ views_count: number }>(`/issues/${id}/view/`, {
      method: 'POST',
    });
  },

  getComments: async (id: number) => {
    return apiRequest<Array<any>>(`/issues/${id}/comments/`, {
      headers: getHeaders(false),
    });
  },
};

// Comment API
export const commentAPI = {
  create: async (data: {
    issue: number;
    content: string;
    is_anonymous: boolean;
    parent?: number;
  }) => {
    return apiRequest<any>('/comments/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  vote: async (id: number, voteType: 'upvote' | 'downvote') => {
    return apiRequest<any>(`/comments/${id}/vote/`, {
      method: 'POST',
      body: JSON.stringify({ vote_type: voteType }),
    });
  },
};

// Media API
export const mediaAPI = {
  upload: async (issueId: number, file: File, mediaType: 'image' | 'video' | 'audio', caption?: string) => {
    const formData = new FormData();
    formData.append('issue', issueId.toString());
    formData.append('file', file);
    formData.append('media_type', mediaType);
    if (caption) formData.append('caption', caption);

    const response = await fetch(`${API_BASE_URL}/media/`, {
      method: 'POST',
      headers: getFileUploadHeaders(),
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || error.message || 'Failed to upload media');
    }

    return response.json();
  },
};

// Search API
export const searchAPI = {
  search: async (query: string) => {
    return apiRequest<{ issues: any[]; tags: any[] }>(`/search/?q=${encodeURIComponent(query)}`, {
      headers: getHeaders(false),
    });
  },
};

// Current user (for is_staff check and profile)
export const getCurrentUser = async (): Promise<{
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_staff: boolean;
  date_joined: string;
} | null> => {
  if (!getAuthToken()) return null;
  try {
    return await apiRequest<any>('/auth/me/');
  } catch {
    return null;
  }
};

// Admin API (staff only)
export const adminAPI = {
  getStats: async () => {
    return apiRequest<{
      total_issues: number;
      by_status: Record<string, number>;
      recent_7_days: number;
      pending_count: number;
    }>('/admin/stats/');
  },

  getGrievances: async (params?: {
    page?: number;
    status?: string;
    search?: string;
    ordering?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.status) queryParams.append('status', params.status);
    if (params?.search) queryParams.append('search', params.search);
    if (params?.ordering) queryParams.append('ordering', params.ordering);
    const url = `/admin/grievances/${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const data = await apiRequest<{ count: number; next: string | null; previous: string | null; results: any[] }>(url);
    return {
      count: data.count ?? 0,
      next: data.next ?? null,
      previous: data.previous ?? null,
      results: Array.isArray(data.results) ? data.results : [],
    };
  },

  getGrievance: async (id: number) => {
    return apiRequest<any>(`/admin/grievances/${id}/`);
  },

  updateGrievance: async (
    id: number,
    patch: { status?: string; is_featured?: boolean; is_verified?: boolean }
  ) => {
    return apiRequest<any>(`/admin/grievances/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },

  getNotes: async (issueId: number) => {
    return apiRequest<any[]>(`/admin/grievances/${issueId}/notes/`);
  },

  addNote: async (issueId: number, data: { content: string; note_type: 'internal' | 'public_response' }) => {
    return apiRequest<any>(`/admin/grievances/${issueId}/notes/`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getStaff: async () => {
    return apiRequest<Array<{ id: number; username: string; name: string; email: string }>>('/admin/staff/');
  },

  getAssignmentCategories: async () => {
    const data = await apiRequest<any[]>('/admin/assignment-categories/');
    return Array.isArray(data) ? data : data?.results ?? [];
  },

  updateAssignmentCategory: async (id: number, patch: { initiator_admin?: number }) => {
    return apiRequest<any>(`/admin/assignment-categories/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },

  advanceWorkflow: async (
    issueId: number,
    data: { to_stage: string; assigned_to?: number; notes?: string }
  ) => {
    return apiRequest<any>(`/admin/grievances/${issueId}/workflow/`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

export const WORKFLOW_STAGES = [
  { value: 'pending', label: 'Pending' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'assigned_to_team', label: 'Assigned to Team' },
  { value: 'resolution_done', label: 'Resolution Done' },
  { value: 'validated', label: 'Validated' },
  { value: 'remarks', label: 'Remarks (Closed)' },
] as const;

