export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiResponse<T> {
  success: true;
  data: T;
  meta: {
    timestamp: string;
    pagination?: PaginationMeta;
  };
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Array<{
      field?: string;
      message: string;
    }>;
  };
  meta: {
    timestamp: string;
    path: string;
    requestId?: string;
  };
}
