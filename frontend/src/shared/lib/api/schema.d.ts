/**
 * このファイルは `pnpm gen:api-types` により自動生成されます。直接編集しないでください。
 */

export interface paths {
  "/api/corporate-relations": {
    get: {
      parameters: {
        query: {
          as_of?: string | null;
          corporation_id?: string | null;
          recorded_as_of?: string | null;
        };
      };
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["CorporateRelationListResponse"];
          };
        };
        422: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
      };
    };
    post: {
      requestBody: {
        content: {
          "application/json": components["schemas"]["CorporateRelationCreateRequest"];
        };
      };
      responses: {
        201: {
          content: {
            "application/json": components["schemas"]["CorporateRelationResponse"];
          };
        };
        404: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
        409: {
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
  };
  "/api/corporate-relations/{relation_id}": {
    get: {
      parameters: {
        query: {
          recorded_as_of?: string | null;
        };
        path: {
          relation_id: string;
        };
      };
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["CorporateRelationResponse"];
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
    patch: {
      parameters: {
        path: {
          relation_id: string;
        };
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["CorporateRelationCorrectionRequest"];
        };
      };
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["CorporateRelationResponse"];
          };
        };
        404: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
        409: {
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
  };
  "/api/corporate-relations/{relation_id}/end": {
    post: {
      parameters: {
        path: {
          relation_id: string;
        };
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["CorporateRelationEndRequest"];
        };
      };
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["CorporateRelationResponse"];
          };
        };
        404: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
        409: {
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
  };
  "/api/corporate-relations/{relation_id}/history": {
    get: {
      parameters: {
        path: {
          relation_id: string;
        };
      };
      responses: {
        200: {
          content: {
            "application/json": Array<components["schemas"]["CorporateRelationRevisionResponse"]>;
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
  };
  "/api/corporations": {
    get: {
      parameters: {
        query: {
          category?: "corporation" | "individual" | null;
          q?: string | null;
          status?: "active" | "dissolved" | "merged_out" | null;
        };
      };
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["CorporationListResponse"];
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
          "application/json": components["schemas"]["CorporationCreateRequest"];
        };
      };
      responses: {
        201: {
          content: {
            "application/json": components["schemas"]["CorporationResponse"];
          };
        };
        409: {
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
  };
  "/api/corporations/{corporation_id}": {
    get: {
      parameters: {
        path: {
          corporation_id: string;
        };
      };
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["CorporationResponse"];
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
          corporation_id: string;
        };
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["CorporationUpdateRequest"];
        };
      };
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["CorporationResponse"];
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
        409: {
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
  };
  "/api/corporations/{corporation_id}/status": {
    patch: {
      parameters: {
        path: {
          corporation_id: string;
        };
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["CorporationStatusChangeRequest"];
        };
      };
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["CorporationResponse"];
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
        409: {
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
  };
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
}

export interface components {
  schemas: {
    CorporateRelationCorrectionRequest: {
      confirmation_status?: "unverified" | "verified";
      evidence?: string;
      valid_from?: string;
      valid_to?: string | null;
    };
    CorporateRelationCreateRequest: {
      confirmation_status?: "unverified" | "verified";
      evidence: string;
      relation_type: "parent_child" | "affiliate" | "fc_vc";
      source_corporation_id: string;
      target_corporation_id: string;
      valid_from: string;
      valid_to?: string | null;
    };
    CorporateRelationEndRequest: {
      valid_to: string;
    };
    CorporateRelationListResponse: {
      items: Array<components["schemas"]["CorporateRelationResponse"]>;
      total: number;
    };
    CorporateRelationResponse: {
      confirmation_status: "unverified" | "verified";
      evidence: string;
      id: string;
      recorded_at: string;
      relation_type: "parent_child" | "affiliate" | "fc_vc";
      source_corporation_id: string;
      target_corporation_id: string;
      valid_from: string;
      valid_to: string | null;
    };
    CorporateRelationRevisionResponse: {
      confirmation_status: "unverified" | "verified";
      evidence: string;
      recorded_at: string;
      valid_from: string;
      valid_to: string | null;
    };
    CorporationCreateRequest: {
      address?: string;
      category: "corporation" | "individual";
      corporate_number?: string | null;
      name: string;
    };
    CorporationListResponse: {
      items: Array<components["schemas"]["CorporationResponse"]>;
      total: number;
    };
    CorporationResponse: {
      address: string;
      category: "corporation" | "individual";
      corporate_number: string | null;
      created_at: string;
      id: string;
      name: string;
      status: "active" | "dissolved" | "merged_out";
      updated_at: string;
    };
    CorporationStatusChangeRequest: {
      status: "active" | "dissolved" | "merged_out";
    };
    CorporationUpdateRequest: {
      address?: string | null;
      corporate_number?: string | null;
      name?: string | null;
    };
    ErrorAction: {
      action_type: components["schemas"]["ErrorActionType"];
      label: string;
    };
    ErrorActionType: "cancel" | "retry" | "fix_input" | "reload" | "go_back" | "save_draft" | "contact_support";
    ErrorDetailScalar: string | number | boolean | null;
    ErrorResponse: {
      actions: Array<components["schemas"]["ErrorAction"]>;
      code: string;
      detail: string;
      details?: {
        [key: string]: components["schemas"]["ErrorDetailScalar"];
      } | null;
      errors?: Array<components["schemas"]["ValidationErrorDetail"]> | null;
      how_to_fix: string;
      reason: string;
      reassurance: string;
      title: string;
      way_out: string;
    };
    HealthResponse: {
      service: string;
      status: "ok";
    };
    HTTPValidationError: {
      detail?: Array<components["schemas"]["ValidationError"]>;
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
