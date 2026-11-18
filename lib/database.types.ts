export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      invoice_audits: {
        Row: {
          action: string
          created_at: string
          detail: string
          id: string
          invoice_id: string
          user_id: string | null
          username: string
        }
        Insert: {
          action: string
          created_at?: string
          detail: string
          id?: string
          invoice_id: string
          user_id?: string | null
          username: string
        }
        Update: {
          action?: string
          created_at?: string
          detail?: string
          id?: string
          invoice_id?: string
          user_id?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_audits_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_audits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          base_price_usd: number
          id: string
          invoice_id: string
          line_number: number
          product_code: string
          product_name: string
          quantity: number
          subtotal_cup: number
          subtotal_usd: number
          unit_price_cup: number
        }
        Insert: {
          base_price_usd: number
          id?: string
          invoice_id: string
          line_number: number
          product_code: string
          product_name: string
          quantity: number
          subtotal_cup: number
          subtotal_usd: number
          unit_price_cup: number
        }
        Update: {
          base_price_usd?: number
          id?: string
          invoice_id?: string
          line_number?: number
          product_code?: string
          product_name?: string
          quantity?: number
          subtotal_cup?: number
          subtotal_usd?: number
          unit_price_cup?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          client_ci: string
          client_name: string
          created_at: string
          created_by: string | null
          created_by_username: string
          deleted_at: string | null
          id: string
          modified_at: string | null
          payment_method: string
          rate: number
          reference: string
          request_id: string
          status: string
          total_cup: number
          total_usd: number
          transporter_ci: string | null
          transporter_name: string | null
          vehicle_plate: string | null
          warehouse_id: string
          warehouse_name: string
        }
        Insert: {
          client_ci: string
          client_name: string
          created_at?: string
          created_by?: string | null
          created_by_username: string
          deleted_at?: string | null
          id?: string
          modified_at?: string | null
          payment_method: string
          rate: number
          reference: string
          request_id: string
          status?: string
          total_cup: number
          total_usd: number
          transporter_ci?: string | null
          transporter_name?: string | null
          vehicle_plate?: string | null
          warehouse_id: string
          warehouse_name: string
        }
        Update: {
          client_ci?: string
          client_name?: string
          created_at?: string
          created_by?: string | null
          created_by_username?: string
          deleted_at?: string | null
          id?: string
          modified_at?: string | null
          payment_method?: string
          rate?: number
          reference?: string
          request_id?: string
          status?: string
          total_cup?: number
          total_usd?: number
          transporter_ci?: string | null
          transporter_name?: string | null
          vehicle_plate?: string | null
          warehouse_id?: string
          warehouse_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          code: string
          created_at: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          role: string
          username: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id: string
          is_active?: boolean
          role: string
          username: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          role?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_role_fkey"
            columns: ["role"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["name"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          label: string
          name: string
        }
        Insert: {
          created_at?: string
          label: string
          name: string
        }
        Update: {
          created_at?: string
          label?: string
          name?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          movement_type: string
          observation: string | null
          product_code: string
          quantity: number
          stock_after: number
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type: string
          observation?: string | null
          product_code: string
          quantity: number
          stock_after: number
          warehouse_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type?: string
          observation?: string | null
          product_code?: string
          quantity?: number
          stock_after?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_code_fkey"
            columns: ["product_code"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "stock_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_warehouses: {
        Row: {
          created_at: string
          user_id: string
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
          warehouse_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_warehouses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_warehouses_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_products: {
        Row: {
          base_price_usd: number
          created_at: string
          deleted_at: string | null
          product_code: string
          stock: number
          warehouse_id: string
        }
        Insert: {
          base_price_usd: number
          created_at?: string
          deleted_at?: string | null
          product_code: string
          stock?: number
          warehouse_id: string
        }
        Update: {
          base_price_usd?: number
          created_at?: string
          deleted_at?: string | null
          product_code?: string
          stock?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_products_product_code_fkey"
            columns: ["product_code"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "warehouse_products_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          is_archived: boolean
          location: string | null
          name: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id: string
          is_archived?: boolean
          location?: string | null
          name: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          is_archived?: boolean
          location?: string | null
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_invoice: {
        Args: { p_invoice_id: string; p_user_id: string; p_username: string }
        Returns: string
      }
      import_inventory: {
        Args: { p_rows: Json; p_user_id: string; p_warehouse_id: string }
        Returns: string[]
      }
      is_admin: { Args: never; Returns: boolean }
      normalize_product_name: { Args: { p_name: string }; Returns: string }
      process_invoice: {
        Args: {
          p_client_ci: string
          p_client_name: string
          p_lines: Json
          p_payment_method: string
          p_rate: number
          p_request_id: string
          p_transporter_ci: string
          p_transporter_name: string
          p_user_id: string
          p_username: string
          p_vehicle_plate: string
          p_warehouse_id: string
        }
        Returns: string
      }
      purge_invoice: { Args: { p_invoice_id: string }; Returns: string }
      register_product: {
        Args: {
          p_base_price?: number
          p_code?: string
          p_name?: string
          p_stock?: number
          p_user_id?: string
          p_warehouse_id: string
        }
        Returns: string
      }
      register_stock_entry: {
        Args: {
          p_code: string
          p_observation: string
          p_quantity: number
          p_user_id: string
          p_warehouse_id: string
        }
        Returns: number
      }
      register_stock_exit: {
        Args: {
          p_code: string
          p_observation: string
          p_quantity: number
          p_user_id: string
          p_warehouse_id: string
        }
        Returns: number
      }
      set_warehouse_stock: {
        Args: {
          p_code: string
          p_new_stock: number
          p_observation?: string
          p_user_id?: string
          p_warehouse_id: string
        }
        Returns: number
      }
      transfer_stock: {
        Args: {
          p_code: string
          p_destination_id: string
          p_observation: string
          p_origin_id: string
          p_quantity: number
          p_user_id: string
        }
        Returns: string
      }
      update_invoice: {
        Args: {
          p_client_ci: string
          p_client_name: string
          p_invoice_id: string
          p_lines: Json
          p_payment_method: string
          p_transporter_ci: string
          p_transporter_name: string
          p_user_id: string
          p_username: string
          p_vehicle_plate: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
