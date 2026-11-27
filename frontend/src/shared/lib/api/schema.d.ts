/**
 * このファイルは `pnpm gen:api-types` により自動生成されます。直接編集しないでください。
 */

export interface paths {
  "/api/auth/login": {
    post: {
      requestBody: {
        content: {
          "application/json": components["schemas"]["AuthLoginRequest"];
        };
      };
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["AuthSessionResponse"];
          };
        };
        401: {
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
  "/api/auth/logout": {
    post: {
      responses: {
        204: {
          content?: never;
        };
        403: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
      };
    };
  };
  "/api/auth/me": {
    get: {
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["AuthUserResponse"];
          };
        };
        401: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
      };
    };
  };
  "/api/auth/refresh": {
    post: {
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["AuthSessionResponse"];
          };
        };
        401: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
        403: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
      };
    };
  };
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
        401: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
        403: {
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
        401: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
        403: {
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
        401: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
        403: {
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
        401: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
        403: {
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
        401: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
        403: {
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
        401: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
        403: {
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
        401: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
        403: {
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
        401: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
        403: {
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
  "/api/corporations/{corporation_id}": {
    get: {
      parameters: {
        query: {
          as_of?: string | null;
          recorded_as_of?: string | null;
        };
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
        401: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
        403: {
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
        401: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
        403: {
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
  "/api/corporations/{corporation_id}/history": {
    get: {
      parameters: {
        path: {
          corporation_id: string;
        };
      };
      responses: {
        200: {
          content: {
            "application/json": Array<components["schemas"]["CorporationHistoryResponse"]>;
          };
        };
        401: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
        403: {
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
    patch: {
      parameters: {
        path: {
          corporation_id: string;
        };
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["CorporationHistoryCorrectionRequest"];
        };
      };
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["CorporationHistoryResponse"];
          };
        };
        400: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
        401: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
        403: {
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
  "/api/corporations/{corporation_id}/merge": {
    post: {
      parameters: {
        path: {
          corporation_id: string;
        };
      };
      requestBody: {
        content: {
          "application/json": components["schemas"]["CorporationMergerRequest"];
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
        401: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
        403: {
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
        401: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
        403: {
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
  "/api/vendor/users": {
    get: {
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["AuthUserListResponse"];
          };
        };
        401: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
        403: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
      };
    };
    post: {
      requestBody: {
        content: {
          "application/json": components["schemas"]["CreateVendorUserV2Request"];
        };
      };
      responses: {
        201: {
          content: {
            "application/json": components["schemas"]["AuthUserResponse"];
          };
        };
        401: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
        403: {
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
}

export interface components {
  schemas: {
    AuthLoginRequest: {
      email: string;
      password: string;
      scope_type?: "vendor" | "tenant";
      tenant_id?: string | null;
    };
    AuthSessionResponse: {
      access_token_expires_in_seconds: number;
      refresh_token_expires_in_seconds: number;
      user: components["schemas"]["AuthUserResponse"];
    };
    AuthUserListResponse: {
      items: Array<components["schemas"]["AuthUserResponse"]>;
      total: number;
    };
    AuthUserResponse: {
      affiliation_type: "vendor" | "tenant";
      created_at: string;
      display_name: string;
      email: string;
      id: string;
      roles: Array<"vendor_admin" | "vendor_member" | "tenant_admin" | "pharmacist" | "clerk">;
      status: "active" | "disabled";
      tenant_id: string | null;
      updated_at: string;
    };
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
      recorded_by?: string | null;
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
      recorded_by?: string | null;
      valid_from: string;
      valid_to: string | null;
    };
    CorporationCreateRequest: {
      address?: string;
      category: "corporation" | "individual";
      corporate_number?: string | null;
      evidence?: string | null;
      name: string;
      valid_from?: string | null;
      valid_to?: string | null;
    };
    CorporationHistoryCorrectionRequest: {
      address?: string | null;
      as_of: string;
      corporate_number?: string | null;
      evidence: string;
      name?: string | null;
      valid_from?: string | null;
      valid_to?: string | null;
    };
    CorporationHistoryResponse: {
      corporation: components["schemas"]["CorporationResponse"];
      evidence: string | null;
      kind: "legacy" | "registration" | "profile" | "correction" | "dissolution" | "merger";
      recorded_at: string;
      recorded_by?: string | null;
      surviving_corporation_id: string | null;
      valid_from: string;
      valid_to: string | null;
    };
    CorporationListResponse: {
      items: Array<components["schemas"]["CorporationResponse"]>;
      total: number;
    };
    CorporationMergerRequest: {
      effective_date: string;
      evidence: string;
      surviving_corporation_id: string;
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
      valid_from?: string | null;
      valid_to?: string | null;
    };
    CorporationStatusChangeRequest: {
      effective_date?: string | null;
      evidence?: string | null;
      status: "active" | "dissolved" | "merged_out";
    };
    CorporationUpdateRequest: {
      address?: string | null;
      corporate_number?: string | null;
      evidence?: string | null;
      name?: string | null;
      valid_from?: string | null;
      valid_to?: string | null;
    };
    CreateVendorUserV2Request: {
      display_name: string;
      email: string;
      password: string;
      roles?: Array<"vendor_admin" | "vendor_member">;
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
