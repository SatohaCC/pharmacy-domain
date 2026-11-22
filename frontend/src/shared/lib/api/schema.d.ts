/**
 * このファイルは `pnpm gen:api-types` により自動生成されます。直接編集しないでください。
 */

export interface paths {
  "/api/health": {
    get: {
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["HealthResponse"];
          };
        };
      };
    };
  };
  "/api/tasks": {
    get: {
      parameters: {
        query: {
          priority?: "low" | "medium" | "high" | null;
          q?: string | null;
          status?: "open" | "done" | null;
        };
      };
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["TaskListResponse"];
          };
        };
        422: {
          content: {
            "application/json": components["schemas"]["HTTPValidationError"];
          };
        };
      };
    };
    post: {
      requestBody: {
        content: {
          "application/json": components["schemas"]["TaskCreateRequest"];
        };
      };
      responses: {
        201: {
          content: {
            "application/json": components["schemas"]["TaskResponse"];
          };
        };
        422: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
      };
    };
  };
  "/api/tasks/{task_id}": {
    get: {
      parameters: {
        path: {
          task_id: string;
        };
      };
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["TaskResponse"];
          };
        };
        404: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
        422: {
          content: {
            "application/json": components["schemas"]["HTTPValidationError"];
          };
        };
      };
    };
    patch: {
      parameters: {
        path: {
          task_id: string;
        };
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["TaskUpdateRequest"];
        };
      };
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["TaskResponse"];
          };
        };
        400: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
        404: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
        422: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
      };
    };
    delete: {
      parameters: {
        path: {
          task_id: string;
        };
      };
      responses: {
        204: {
          content?: never;
        };
        404: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
        422: {
          content: {
            "application/json": components["schemas"]["HTTPValidationError"];
          };
        };
      };
    };
  };
}

export interface components {
  schemas: {
    ErrorResponse: {
      code: string;
      detail: string;
      errors?: Array<components["schemas"]["ValidationErrorDetail"]> | null;
    };
    HealthResponse: {
      service: string;
      status: "ok";
    };
    HTTPValidationError: {
      detail?: Array<components["schemas"]["ValidationError"]>;
    };
    TaskCreateRequest: {
      description?: string;
      priority?: "low" | "medium" | "high";
      title: string;
    };
    TaskListResponse: {
      items: Array<components["schemas"]["TaskResponse"]>;
      total: number;
    };
    TaskResponse: {
      created_at: string;
      description: string;
      id: string;
      priority: "low" | "medium" | "high";
      status: "open" | "done";
      title: string;
      updated_at: string;
    };
    TaskUpdateRequest: {
      description?: string | null;
      priority?: "low" | "medium" | "high" | null;
      status?: "open" | "done" | null;
      title?: string | null;
    };
    ValidationError: {
      ctx?: Record<string, unknown>;
      input?: unknown;
      loc: Array<string | number>;
      msg: string;
      type: string;
    };
    ValidationErrorDetail: {
      loc: Array<string | number>;
      msg: string;
      type: string;
    };
  };
}
