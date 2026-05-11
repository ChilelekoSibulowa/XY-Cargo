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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      agent_withdrawal_requests: {
        Row: {
          agent_user_id: string
          amount: number
          approved_at: string | null
          approved_by: string | null
          created_at: string
          finance_message: string | null
          id: string
          paid_at: string | null
          paid_by: string | null
          payout_destination: string | null
          payout_method: string | null
          payout_reference: string | null
          request_notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          agent_user_id: string
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          finance_message?: string | null
          id?: string
          paid_at?: string | null
          paid_by?: string | null
          payout_destination?: string | null
          payout_method?: string | null
          payout_reference?: string | null
          request_notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          agent_user_id?: string
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          finance_message?: string | null
          id?: string
          paid_at?: string | null
          paid_by?: string | null
          payout_destination?: string | null
          payout_method?: string | null
          payout_reference?: string | null
          request_notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      api_secrets: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          secret_key: string
          secret_value: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          secret_key: string
          secret_value: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          secret_key?: string
          secret_value?: string
          updated_at?: string
        }
        Relationships: []
      }
      branches: {
        Row: {
          address: string | null
          city: string | null
          code: string
          country: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean | null
          manager_id: string | null
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          code: string
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          manager_id?: string | null
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          manager_id?: string | null
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      client_pricing: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          is_active: boolean
          minimum_charge: number | null
          notes: string | null
          rate_per_cbm: number | null
          rate_per_kg: number | null
          service_type: Database["public"]["Enums"]["service_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          is_active?: boolean
          minimum_charge?: number | null
          notes?: string | null
          rate_per_cbm?: number | null
          rate_per_kg?: number | null
          service_type: Database["public"]["Enums"]["service_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          is_active?: boolean
          minimum_charge?: number | null
          notes?: string | null
          rate_per_cbm?: number | null
          rate_per_kg?: number | null
          service_type?: Database["public"]["Enums"]["service_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_pricing_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_pages: {
        Row: {
          created_at: string
          data: Json
          id: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      compliance_charges: {
        Row: {
          amount: number
          awb_number: string | null
          bl_number: string | null
          charge_type: string
          consignment_id: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          entered_by_id: string
          finance_expense_id: string | null
          id: string
          notes: string | null
          recorded_in_finance: boolean | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          awb_number?: string | null
          bl_number?: string | null
          charge_type: string
          consignment_id?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          entered_by_id: string
          finance_expense_id?: string | null
          id?: string
          notes?: string | null
          recorded_in_finance?: boolean | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          awb_number?: string | null
          bl_number?: string | null
          charge_type?: string
          consignment_id?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          entered_by_id?: string
          finance_expense_id?: string | null
          id?: string
          notes?: string | null
          recorded_in_finance?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      consolidation_shipments: {
        Row: {
          consolidation_id: string
          created_at: string
          id: string
          shipment_id: string
        }
        Insert: {
          consolidation_id: string
          created_at?: string
          id?: string
          shipment_id: string
        }
        Update: {
          consolidation_id?: string
          created_at?: string
          id?: string
          shipment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consolidation_shipments_consolidation_id_fkey"
            columns: ["consolidation_id"]
            isOneToOne: false
            referencedRelation: "consolidations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consolidation_shipments_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      consolidations: {
        Row: {
          code: string
          collected_at: string | null
          collected_by: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          delivery_request_assigned_at: string | null
          delivery_request_assigned_driver_id: string | null
          delivery_request_completed_at: string | null
          delivery_request_requested_at: string | null
          delivery_request_requested_by_role: string | null
          delivery_request_requested_by_user_id: string | null
          delivery_request_status: string | null
          id: string
          item_count: number | null
          notes: string | null
          status: string
          total_cbm: number | null
          total_cost: number | null
          total_weight: number | null
          tracking_code: string | null
          updated_at: string
        }
        Insert: {
          code: string
          collected_at?: string | null
          collected_by?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          delivery_request_assigned_at?: string | null
          delivery_request_assigned_driver_id?: string | null
          delivery_request_completed_at?: string | null
          delivery_request_requested_at?: string | null
          delivery_request_requested_by_role?: string | null
          delivery_request_requested_by_user_id?: string | null
          delivery_request_status?: string | null
          id?: string
          item_count?: number | null
          notes?: string | null
          status?: string
          total_cbm?: number | null
          total_cost?: number | null
          total_weight?: number | null
          tracking_code?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          collected_at?: string | null
          collected_by?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          delivery_request_assigned_at?: string | null
          delivery_request_assigned_driver_id?: string | null
          delivery_request_completed_at?: string | null
          delivery_request_requested_at?: string | null
          delivery_request_requested_by_role?: string | null
          delivery_request_requested_by_user_id?: string | null
          delivery_request_status?: string | null
          id?: string
          item_count?: number | null
          notes?: string | null
          status?: string
          total_cbm?: number | null
          total_cost?: number | null
          total_weight?: number | null
          tracking_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consolidations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consolidations_delivery_request_assigned_driver_id_fkey"
            columns: ["delivery_request_assigned_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      covered_areas: {
        Row: {
          city: string
          country: string
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          zone: string | null
        }
        Insert: {
          city: string
          country: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          zone?: string | null
        }
        Update: {
          city?: string
          country?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          zone?: string | null
        }
        Relationships: []
      }
      credit_notes: {
        Row: {
          amount: number
          code: string
          created_at: string
          customer_id: string
          id: string
          invoice_id: string | null
          reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          code: string
          created_at?: string
          customer_id: string
          id?: string
          invoice_id?: string | null
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          code?: string
          created_at?: string
          customer_id?: string
          id?: string
          invoice_id?: string | null
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      currencies: {
        Row: {
          code: string
          created_at: string
          exchange_rate: number | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          symbol: string
        }
        Insert: {
          code: string
          created_at?: string
          exchange_rate?: number | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          symbol: string
        }
        Update: {
          code?: string
          created_at?: string
          exchange_rate?: number | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          symbol?: string
        }
        Relationships: []
      }
      customer_claims: {
        Row: {
          created_at: string
          customer_id: string
          description: string
          finance_response_message: string | null
          id: string
          request_type: string
          requested_amount: number | null
          requested_by_role: string | null
          requested_by_user_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          shipment_code: string | null
          shipment_id: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          description: string
          finance_response_message?: string | null
          id?: string
          request_type?: string
          requested_amount?: number | null
          requested_by_role?: string | null
          requested_by_user_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          shipment_code?: string | null
          shipment_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          description?: string
          finance_response_message?: string | null
          id?: string
          request_type?: string
          requested_amount?: number | null
          requested_by_role?: string | null
          requested_by_user_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          shipment_code?: string | null
          shipment_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_claims_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_claims_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_team_members: {
        Row: {
          created_at: string
          customer_id: string
          email: string
          full_name: string
          id: string
          role: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          email: string
          full_name: string
          id?: string
          role?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          email?: string
          full_name?: string
          id?: string
          role?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_team_members_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          agent_id: string | null
          branch_id: string | null
          city: string | null
          code: string
          company_address: string | null
          company_email: string | null
          company_name: string | null
          company_phone: string | null
          company_registration_number: string | null
          country: string | null
          created_at: string
          customer_type: string | null
          email: string | null
          full_name: string
          id: string
          is_active: boolean | null
          mfa_enabled: boolean
          phone: string
          updated_at: string
          user_id: string | null
          wallet_balance: number | null
        }
        Insert: {
          address?: string | null
          agent_id?: string | null
          branch_id?: string | null
          city?: string | null
          code: string
          company_address?: string | null
          company_email?: string | null
          company_name?: string | null
          company_phone?: string | null
          company_registration_number?: string | null
          country?: string | null
          created_at?: string
          customer_type?: string | null
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean | null
          mfa_enabled?: boolean
          phone: string
          updated_at?: string
          user_id?: string | null
          wallet_balance?: number | null
        }
        Update: {
          address?: string | null
          agent_id?: string | null
          branch_id?: string | null
          city?: string | null
          code?: string
          company_address?: string | null
          company_email?: string | null
          company_name?: string | null
          company_phone?: string | null
          company_registration_number?: string | null
          country?: string | null
          created_at?: string
          customer_type?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          mfa_enabled?: boolean
          phone?: string
          updated_at?: string
          user_id?: string | null
          wallet_balance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_requests: {
        Row: {
          assigned_at: string | null
          assigned_driver_id: string | null
          branch_id: string | null
          completed_at: string | null
          created_at: string | null
          customer_id: string
          id: string
          notes: string | null
          requested_by_id: string
          requested_by_role: string
          shipment_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_driver_id?: string | null
          branch_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          customer_id: string
          id?: string
          notes?: string | null
          requested_by_id: string
          requested_by_role: string
          shipment_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_driver_id?: string | null
          branch_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          customer_id?: string
          id?: string
          notes?: string | null
          requested_by_id?: string
          requested_by_role?: string
          shipment_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_requests_assigned_driver_id_fkey"
            columns: ["assigned_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_requests_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_requests_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_times: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          max_days: number
          min_days: number
          name: string
          service_type: Database["public"]["Enums"]["service_type"] | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          max_days: number
          min_days: number
          name: string
          service_type?: Database["public"]["Enums"]["service_type"] | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          max_days?: number
          min_days?: number
          name?: string
          service_type?: Database["public"]["Enums"]["service_type"] | null
        }
        Relationships: []
      }
      driver_ticket_responses: {
        Row: {
          attachments: Json | null
          created_at: string | null
          driver_id: string
          id: string
          response_text: string
          support_ticket_id: string
          updated_at: string | null
        }
        Insert: {
          attachments?: Json | null
          created_at?: string | null
          driver_id: string
          id?: string
          response_text: string
          support_ticket_id: string
          updated_at?: string | null
        }
        Update: {
          attachments?: Json | null
          created_at?: string | null
          driver_id?: string
          id?: string
          response_text?: string
          support_ticket_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_ticket_responses_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_ticket_responses_support_ticket_id_fkey"
            columns: ["support_ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          branch_id: string | null
          code: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean | null
          license_number: string | null
          phone: string
          updated_at: string
          user_id: string | null
          vehicle_plate: string | null
          vehicle_type: string | null
          wallet_balance: number | null
        }
        Insert: {
          branch_id?: string | null
          code: string
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean | null
          license_number?: string | null
          phone: string
          updated_at?: string
          user_id?: string | null
          vehicle_plate?: string | null
          vehicle_type?: string | null
          wallet_balance?: number | null
        }
        Update: {
          branch_id?: string | null
          code?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          license_number?: string | null
          phone?: string
          updated_at?: string
          user_id?: string | null
          vehicle_plate?: string | null
          vehicle_type?: string | null
          wallet_balance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "drivers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_expenses: {
        Row: {
          amount: number
          approved_by: string | null
          code: string
          created_at: string
          description: string | null
          expense_date: string
          expense_type: string
          id: string
          original_amount: number | null
          original_currency: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          approved_by?: string | null
          code: string
          created_at?: string
          description?: string | null
          expense_date?: string
          expense_type: string
          id?: string
          original_amount?: number | null
          original_currency?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_by?: string | null
          code?: string
          created_at?: string
          description?: string | null
          expense_date?: string
          expense_type?: string
          id?: string
          original_amount?: number | null
          original_currency?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      incident_reports: {
        Row: {
          attachments: Json | null
          created_at: string | null
          description: string
          driver_id: string
          id: string
          report_type: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by_id: string | null
          severity: string | null
          shipment_id: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          attachments?: Json | null
          created_at?: string | null
          description: string
          driver_id: string
          id?: string
          report_type: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by_id?: string | null
          severity?: string | null
          shipment_id?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          attachments?: Json | null
          created_at?: string | null
          description?: string
          driver_id?: string
          id?: string
          report_type?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by_id?: string | null
          severity?: string | null
          shipment_id?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incident_reports_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_reports_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_uploads: {
        Row: {
          created_at: string
          file_name: string
          file_type: string | null
          file_url: string
          id: string
          inspection_type: string
          notes: string | null
          shipment_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_type?: string | null
          file_url: string
          id?: string
          inspection_type?: string
          notes?: string | null
          shipment_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_type?: string | null
          file_url?: string
          id?: string
          inspection_type?: string
          notes?: string | null
          shipment_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspection_uploads_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          code: string
          created_at: string
          customer_id: string
          due_date: string | null
          id: string
          notes: string | null
          shipment_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          code: string
          created_at?: string
          customer_id: string
          due_date?: string | null
          id?: string
          notes?: string | null
          shipment_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          code?: string
          created_at?: string
          customer_id?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          shipment_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      manifest_shipments: {
        Row: {
          created_at: string
          id: string
          manifest_id: string
          shipment_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          manifest_id: string
          shipment_id: string
        }
        Update: {
          created_at?: string
          id?: string
          manifest_id?: string
          shipment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manifest_shipments_manifest_id_fkey"
            columns: ["manifest_id"]
            isOneToOne: false
            referencedRelation: "manifests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manifest_shipments_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      manifests: {
        Row: {
          arrival_date: string | null
          code: string
          created_at: string
          created_by: string | null
          departure_date: string | null
          destination_branch_id: string
          driver_id: string | null
          id: string
          notes: string | null
          origin_branch_id: string
          status: string | null
          updated_at: string
        }
        Insert: {
          arrival_date?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          departure_date?: string | null
          destination_branch_id: string
          driver_id?: string | null
          id?: string
          notes?: string | null
          origin_branch_id: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          arrival_date?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          departure_date?: string | null
          destination_branch_id?: string
          driver_id?: string | null
          id?: string
          notes?: string | null
          origin_branch_id?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "manifests_destination_branch_id_fkey"
            columns: ["destination_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manifests_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manifests_origin_branch_id_fkey"
            columns: ["origin_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_customs_records: {
        Row: {
          awb_bl_number: string
          compliance_notes: string | null
          created_at: string
          id: string
          service_type: string
          status: Database["public"]["Enums"]["customs_status"]
          updated_at: string
        }
        Insert: {
          awb_bl_number: string
          compliance_notes?: string | null
          created_at?: string
          id?: string
          service_type?: string
          status?: Database["public"]["Enums"]["customs_status"]
          updated_at?: string
        }
        Update: {
          awb_bl_number?: string
          compliance_notes?: string | null
          created_at?: string
          id?: string
          service_type?: string
          status?: Database["public"]["Enums"]["customs_status"]
          updated_at?: string
        }
        Relationships: []
      }
      marketing_automation_logs: {
        Row: {
          created_at: string
          email: string
          error_message: string | null
          event_type: string
          fb_event_id: string | null
          fb_event_name: string | null
          id: string
          payload: Json | null
          processed_at: string | null
          provider_response: Json | null
          source: string | null
          status: string | null
          triggered_at: string
        }
        Insert: {
          created_at?: string
          email: string
          error_message?: string | null
          event_type: string
          fb_event_id?: string | null
          fb_event_name?: string | null
          id?: string
          payload?: Json | null
          processed_at?: string | null
          provider_response?: Json | null
          source?: string | null
          status?: string | null
          triggered_at: string
        }
        Update: {
          created_at?: string
          email?: string
          error_message?: string | null
          event_type?: string
          fb_event_id?: string | null
          fb_event_name?: string | null
          id?: string
          payload?: Json | null
          processed_at?: string | null
          provider_response?: Json | null
          source?: string | null
          status?: string | null
          triggered_at?: string
        }
        Relationships: []
      }
      marketing_campaigns: {
        Row: {
          budget: number
          channel: string
          created_at: string
          created_by: string | null
          end_date: string | null
          engagements: number
          id: string
          leads: number
          link_clicks: number
          name: string
          notes: string | null
          page_likes: number
          reach: number
          revenue_attributed: number
          spend: number
          start_date: string | null
          status: string
          updated_at: string
          viewers: number
          views: number
        }
        Insert: {
          budget?: number
          channel: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          engagements?: number
          id?: string
          leads?: number
          link_clicks?: number
          name: string
          notes?: string | null
          page_likes?: number
          reach?: number
          revenue_attributed?: number
          spend?: number
          start_date?: string | null
          status?: string
          updated_at?: string
          viewers?: number
          views?: number
        }
        Update: {
          budget?: number
          channel?: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          engagements?: number
          id?: string
          leads?: number
          link_clicks?: number
          name?: string
          notes?: string | null
          page_likes?: number
          reach?: number
          revenue_attributed?: number
          spend?: number
          start_date?: string | null
          status?: string
          updated_at?: string
          viewers?: number
          views?: number
        }
        Relationships: []
      }
      marketing_email_sequences: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          status: string
          step_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: string
          step_count?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: string
          step_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      marketing_email_subscribers: {
        Row: {
          created_at: string
          email: string
          fbc: string | null
          fbclid: string | null
          fbp: string | null
          id: string
          is_active: boolean
          marketing_consent: boolean
          metadata: Json | null
          notes: string | null
          page_path: string | null
          page_url: string | null
          referrer: string | null
          subscribed_at: string
          subscription_source: string | null
          unsubscribed_at: string | null
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          created_at?: string
          email: string
          fbc?: string | null
          fbclid?: string | null
          fbp?: string | null
          id?: string
          is_active?: boolean
          marketing_consent?: boolean
          metadata?: Json | null
          notes?: string | null
          page_path?: string | null
          page_url?: string | null
          referrer?: string | null
          subscribed_at?: string
          subscription_source?: string | null
          unsubscribed_at?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          fbc?: string | null
          fbclid?: string | null
          fbp?: string | null
          id?: string
          is_active?: boolean
          marketing_consent?: boolean
          metadata?: Json | null
          notes?: string | null
          page_path?: string | null
          page_url?: string | null
          referrer?: string | null
          subscribed_at?: string
          subscription_source?: string | null
          unsubscribed_at?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
      }
      marketing_email_templates: {
        Row: {
          body: string | null
          click_rate: number
          created_at: string
          id: string
          name: string
          open_rate: number
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          click_rate?: number
          created_at?: string
          id?: string
          name: string
          open_rate?: number
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          click_rate?: number
          created_at?: string
          id?: string
          name?: string
          open_rate?: number
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketing_influencer_collaborations: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          platform: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          platform: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          platform?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketing_leads: {
        Row: {
          assigned_to: string | null
          created_at: string
          deal_value: number
          email: string | null
          follow_up_status: string
          full_name: string
          id: string
          phone: string | null
          sales_feedback: string | null
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          deal_value?: number
          email?: string | null
          follow_up_status?: string
          full_name: string
          id?: string
          phone?: string | null
          sales_feedback?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          deal_value?: number
          email?: string | null
          follow_up_status?: string
          full_name?: string
          id?: string
          phone?: string | null
          sales_feedback?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketing_newsletter_subscribers: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketing_page_analytics: {
        Row: {
          bounce_rate: number
          created_at: string
          id: string
          is_landing_page: boolean
          page_path: string
          seo_rank: number | null
          session_duration: number
          traffic_source: string
          updated_at: string
          view_date: string
          views: number
        }
        Insert: {
          bounce_rate?: number
          created_at?: string
          id?: string
          is_landing_page?: boolean
          page_path: string
          seo_rank?: number | null
          session_duration?: number
          traffic_source?: string
          updated_at?: string
          view_date?: string
          views?: number
        }
        Update: {
          bounce_rate?: number
          created_at?: string
          id?: string
          is_landing_page?: boolean
          page_path?: string
          seo_rank?: number | null
          session_duration?: number
          traffic_source?: string
          updated_at?: string
          view_date?: string
          views?: number
        }
        Relationships: []
      }
      marketing_promotions: {
        Row: {
          budget: number
          created_at: string
          end_date: string | null
          id: string
          name: string
          notes: string | null
          promotion_type: string
          revenue_attributed: number
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          budget?: number
          created_at?: string
          end_date?: string | null
          id?: string
          name: string
          notes?: string | null
          promotion_type: string
          revenue_attributed?: number
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          budget?: number
          created_at?: string
          end_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          promotion_type?: string
          revenue_attributed?: number
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketing_social_metrics: {
        Row: {
          clicks: number
          created_at: string
          engagement_rate: number
          engagements: number
          followers: number
          growth_rate: number
          id: string
          leads: number
          likes: number
          platform: string
          reach: number
          recorded_at: string
          updated_at: string
          views: number
        }
        Insert: {
          clicks?: number
          created_at?: string
          engagement_rate?: number
          engagements?: number
          followers?: number
          growth_rate?: number
          id?: string
          leads?: number
          likes?: number
          platform: string
          reach?: number
          recorded_at?: string
          updated_at?: string
          views?: number
        }
        Update: {
          clicks?: number
          created_at?: string
          engagement_rate?: number
          engagements?: number
          followers?: number
          growth_rate?: number
          id?: string
          leads?: number
          likes?: number
          platform?: string
          reach?: number
          recorded_at?: string
          updated_at?: string
          views?: number
        }
        Relationships: []
      }
      marketing_social_posts: {
        Row: {
          content: string
          created_at: string
          engagement_count: number
          id: string
          image_url: string | null
          inquiry_count: number
          link: string | null
          platform: string
          scheduled_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          engagement_count?: number
          id?: string
          image_url?: string | null
          inquiry_count?: number
          link?: string | null
          platform: string
          scheduled_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          engagement_count?: number
          id?: string
          image_url?: string | null
          inquiry_count?: number
          link?: string | null
          platform?: string
          scheduled_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      mission_shipments: {
        Row: {
          created_at: string
          id: string
          mission_id: string
          shipment_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mission_id: string
          shipment_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mission_id?: string
          shipment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_shipments_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_shipments_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      missions: {
        Row: {
          branch_id: string
          code: string
          completed_date: string | null
          created_at: string
          created_by: string | null
          destination_branch_id: string | null
          driver_id: string | null
          id: string
          mission_type: Database["public"]["Enums"]["mission_type"]
          notes: string | null
          scheduled_date: string | null
          status: Database["public"]["Enums"]["mission_status"]
          updated_at: string
        }
        Insert: {
          branch_id: string
          code: string
          completed_date?: string | null
          created_at?: string
          created_by?: string | null
          destination_branch_id?: string | null
          driver_id?: string | null
          id?: string
          mission_type: Database["public"]["Enums"]["mission_type"]
          notes?: string | null
          scheduled_date?: string | null
          status?: Database["public"]["Enums"]["mission_status"]
          updated_at?: string
        }
        Update: {
          branch_id?: string
          code?: string
          completed_date?: string | null
          created_at?: string
          created_by?: string | null
          destination_branch_id?: string | null
          driver_id?: string | null
          id?: string
          mission_type?: Database["public"]["Enums"]["mission_type"]
          notes?: string | null
          scheduled_date?: string | null
          status?: Database["public"]["Enums"]["mission_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "missions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missions_destination_branch_id_fkey"
            columns: ["destination_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missions_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_delivery_logs: {
        Row: {
          channel: string
          created_at: string
          error_message: string | null
          id: string
          notification_id: string | null
          provider_response: Json | null
          status: string
        }
        Insert: {
          channel: string
          created_at?: string
          error_message?: string | null
          id?: string
          notification_id?: string | null
          provider_response?: Json | null
          status: string
        }
        Update: {
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          notification_id?: string | null
          provider_response?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_delivery_logs_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean | null
          message: string
          metadata: Json | null
          notification_type: string | null
          reference_id: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message: string
          metadata?: Json | null
          notification_type?: string | null
          reference_id?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string
          metadata?: Json | null
          notification_type?: string | null
          reference_id?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      package_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          max_height: number | null
          max_length: number | null
          max_weight: number | null
          max_width: number | null
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_height?: number | null
          max_length?: number | null
          max_weight?: number | null
          max_width?: number | null
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_height?: number | null
          max_length?: number | null
          max_weight?: number | null
          max_width?: number | null
          name?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          callback_data: Json | null
          code: string
          created_at: string
          currency: string | null
          customer_id: string | null
          description: string | null
          id: string
          payment_method: string | null
          payment_provider: string
          payment_type: string | null
          phone_number: string | null
          provider_reference: string | null
          shipment_id: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          callback_data?: Json | null
          code: string
          created_at?: string
          currency?: string | null
          customer_id?: string | null
          description?: string | null
          id?: string
          payment_method?: string | null
          payment_provider: string
          payment_type?: string | null
          phone_number?: string | null
          provider_reference?: string | null
          shipment_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          callback_data?: Json | null
          code?: string
          created_at?: string
          currency?: string | null
          customer_id?: string | null
          description?: string | null
          id?: string
          payment_method?: string | null
          payment_provider?: string
          payment_type?: string | null
          phone_number?: string | null
          provider_reference?: string | null
          shipment_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      pickup_destinations: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          requires_details: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          requires_details?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          requires_details?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      product_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          service_type: Database["public"]["Enums"]["service_type"]
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          service_type?: Database["public"]["Enums"]["service_type"]
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          service_type?: Database["public"]["Enums"]["service_type"]
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          bank_account_name: string | null
          bank_account_number: string | null
          bank_name: string | null
          city: string | null
          commission_rate_cbm: number | null
          commission_rate_kg: number | null
          country: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
          wallet_balance: number
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          city?: string | null
          commission_rate_cbm?: number | null
          commission_rate_kg?: number | null
          country?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
          wallet_balance?: number
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          city?: string | null
          commission_rate_cbm?: number | null
          commission_rate_kg?: number | null
          country?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
          wallet_balance?: number
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      receivers: {
        Row: {
          address: string | null
          city: string | null
          code: string
          country: string | null
          created_at: string
          customer_id: string | null
          email: string | null
          full_name: string
          id: string
          is_active: boolean | null
          phone: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          code: string
          country?: string | null
          created_at?: string
          customer_id?: string | null
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean | null
          phone: string
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string
          country?: string | null
          created_at?: string
          customer_id?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "receivers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_team: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          is_active: boolean | null
          notes: string | null
          role_label: string
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          role_label: string
          user_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          role_label?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_team_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          actual_delivery_date: string | null
          additional_charges: number | null
          assigned_driver_id: string | null
          awb_number: string | null
          bl_number: string | null
          branch_id: string
          cbm: number | null
          code: string
          collected_at: string | null
          collected_by: string | null
          consignment_id: string | null
          consolidation_id: string | null
          created_at: string
          created_by: string | null
          currency_id: string | null
          custom_tracking_number: string | null
          customer_id: string
          delivery_request_assigned_at: string | null
          delivery_request_assigned_driver_id: string | null
          delivery_request_completed_at: string | null
          delivery_request_date: string | null
          delivery_request_requested_at: string | null
          delivery_request_requested_by_role: string | null
          delivery_request_requested_by_user_id: string | null
          delivery_request_status: string | null
          description: string | null
          destination_branch_id: string | null
          discount: number | null
          driver_action_notes: string | null
          driver_completed_delivery_at: string | null
          driver_id: string | null
          driver_started_delivery_at: string | null
          estimated_delivery_date: string | null
          handling_method: string | null
          height: number | null
          id: string
          internal_notes: string | null
          length: number | null
          notes: string | null
          paid_amount: number | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_status: string | null
          pickup_date: string | null
          quantity: number | null
          receiver_id: string
          service_type: Database["public"]["Enums"]["service_type"]
          shipping_cost: number | null
          shipping_rate_id: string | null
          status: Database["public"]["Enums"]["shipment_status"]
          total_cost: number | null
          updated_at: string
          weight: number
          width: number | null
        }
        Insert: {
          actual_delivery_date?: string | null
          additional_charges?: number | null
          assigned_driver_id?: string | null
          awb_number?: string | null
          bl_number?: string | null
          branch_id: string
          cbm?: number | null
          code: string
          collected_at?: string | null
          collected_by?: string | null
          consignment_id?: string | null
          consolidation_id?: string | null
          created_at?: string
          created_by?: string | null
          currency_id?: string | null
          custom_tracking_number?: string | null
          customer_id: string
          delivery_request_assigned_at?: string | null
          delivery_request_assigned_driver_id?: string | null
          delivery_request_completed_at?: string | null
          delivery_request_date?: string | null
          delivery_request_requested_at?: string | null
          delivery_request_requested_by_role?: string | null
          delivery_request_requested_by_user_id?: string | null
          delivery_request_status?: string | null
          description?: string | null
          destination_branch_id?: string | null
          discount?: number | null
          driver_action_notes?: string | null
          driver_completed_delivery_at?: string | null
          driver_id?: string | null
          driver_started_delivery_at?: string | null
          estimated_delivery_date?: string | null
          handling_method?: string | null
          height?: number | null
          id?: string
          internal_notes?: string | null
          length?: number | null
          notes?: string | null
          paid_amount?: number | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_status?: string | null
          pickup_date?: string | null
          quantity?: number | null
          receiver_id: string
          service_type?: Database["public"]["Enums"]["service_type"]
          shipping_cost?: number | null
          shipping_rate_id?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          total_cost?: number | null
          updated_at?: string
          weight?: number
          width?: number | null
        }
        Update: {
          actual_delivery_date?: string | null
          additional_charges?: number | null
          assigned_driver_id?: string | null
          awb_number?: string | null
          bl_number?: string | null
          branch_id?: string
          cbm?: number | null
          code?: string
          collected_at?: string | null
          collected_by?: string | null
          consignment_id?: string | null
          consolidation_id?: string | null
          created_at?: string
          created_by?: string | null
          currency_id?: string | null
          custom_tracking_number?: string | null
          customer_id?: string
          delivery_request_assigned_at?: string | null
          delivery_request_assigned_driver_id?: string | null
          delivery_request_completed_at?: string | null
          delivery_request_date?: string | null
          delivery_request_requested_at?: string | null
          delivery_request_requested_by_role?: string | null
          delivery_request_requested_by_user_id?: string | null
          delivery_request_status?: string | null
          description?: string | null
          destination_branch_id?: string | null
          discount?: number | null
          driver_action_notes?: string | null
          driver_completed_delivery_at?: string | null
          driver_id?: string | null
          driver_started_delivery_at?: string | null
          estimated_delivery_date?: string | null
          handling_method?: string | null
          height?: number | null
          id?: string
          internal_notes?: string | null
          length?: number | null
          notes?: string | null
          paid_amount?: number | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_status?: string | null
          pickup_date?: string | null
          quantity?: number | null
          receiver_id?: string
          service_type?: Database["public"]["Enums"]["service_type"]
          shipping_cost?: number | null
          shipping_rate_id?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          total_cost?: number | null
          updated_at?: string
          weight?: number
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_assigned_driver_id_fkey"
            columns: ["assigned_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_consolidation_id_fkey"
            columns: ["consolidation_id"]
            isOneToOne: false
            referencedRelation: "consolidations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_delivery_request_assigned_driver_id_fkey"
            columns: ["delivery_request_assigned_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_destination_branch_id_fkey"
            columns: ["destination_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "receivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_shipping_rate_id_fkey"
            columns: ["shipping_rate_id"]
            isOneToOne: false
            referencedRelation: "shipping_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_rates: {
        Row: {
          created_at: string
          destination_area_id: string | null
          id: string
          is_active: boolean | null
          minimum_charge: number | null
          name: string
          origin_area_id: string | null
          rate_per_cbm: number | null
          rate_per_kg: number | null
          service_type: Database["public"]["Enums"]["service_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          destination_area_id?: string | null
          id?: string
          is_active?: boolean | null
          minimum_charge?: number | null
          name: string
          origin_area_id?: string | null
          rate_per_cbm?: number | null
          rate_per_kg?: number | null
          service_type: Database["public"]["Enums"]["service_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          destination_area_id?: string | null
          id?: string
          is_active?: boolean | null
          minimum_charge?: number | null
          name?: string
          origin_area_id?: string | null
          rate_per_cbm?: number | null
          rate_per_kg?: number | null
          service_type?: Database["public"]["Enums"]["service_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_rates_destination_area_id_fkey"
            columns: ["destination_area_id"]
            isOneToOne: false
            referencedRelation: "covered_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_rates_origin_area_id_fkey"
            columns: ["origin_area_id"]
            isOneToOne: false
            referencedRelation: "covered_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_logs: {
        Row: {
          created_at: string
          id: string
          message: string
          provider: string | null
          provider_response: Json | null
          recipient_phone: string
          reference_id: string | null
          reference_type: string | null
          status: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          provider?: string | null
          provider_response?: Json | null
          recipient_phone: string
          reference_id?: string | null
          reference_type?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          provider?: string | null
          provider_response?: Json | null
          recipient_phone?: string
          reference_id?: string | null
          reference_type?: string | null
          status?: string | null
        }
        Relationships: []
      }
      sourcing_quotes: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          quote_amount: number
          request_id: string
          status: string
          supplier_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          quote_amount: number
          request_id: string
          status?: string
          supplier_name: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          quote_amount?: number
          request_id?: string
          status?: string
          supplier_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "sourcing_quotes_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "sourcing_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      sourcing_request_photos: {
        Row: {
          created_at: string
          id: string
          photo_url: string
          request_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          photo_url: string
          request_id: string
        }
        Update: {
          created_at?: string
          id?: string
          photo_url?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sourcing_request_photos_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "sourcing_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      sourcing_requests: {
        Row: {
          budget: number | null
          created_at: string
          customer_id: string
          description: string | null
          id: string
          product_name: string
          quantity: number
          status: string
          support_responded_by: string | null
          support_response_at: string | null
          support_response_message: string | null
          updated_at: string
        }
        Insert: {
          budget?: number | null
          created_at?: string
          customer_id: string
          description?: string | null
          id?: string
          product_name: string
          quantity?: number
          status?: string
          support_responded_by?: string | null
          support_response_at?: string | null
          support_response_message?: string | null
          updated_at?: string
        }
        Update: {
          budget?: number | null
          created_at?: string
          customer_id?: string
          description?: string | null
          id?: string
          product_name?: string
          quantity?: number
          status?: string
          support_responded_by?: string | null
          support_response_at?: string | null
          support_response_message?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sourcing_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_portal_assignments: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          portal_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          portal_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          portal_id?: string
          user_id?: string
        }
        Relationships: []
      }
      supplier_payment_requests: {
        Row: {
          account_name: string | null
          account_number_iban: string | null
          amount: number
          bank_country: string | null
          bank_name: string | null
          branch: string | null
          company_name: string
          created_at: string
          currency: string
          customer_id: string
          declaration_accepted: boolean
          description: string | null
          documents: Json | null
          exchange_rate: number | null
          id: string
          payable_currency: string | null
          payment_method: string
          purpose: string
          request_code: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_by: string
          submitted_by_role: string
          supplier_address: string | null
          supplier_country: string
          supplier_email: string | null
          supplier_name: string
          support_responded_by: string | null
          support_response_at: string | null
          support_response_message: string | null
          swift_code: string | null
          total_payable: number | null
          updated_at: string
          whatsapp_wechat: string
        }
        Insert: {
          account_name?: string | null
          account_number_iban?: string | null
          amount: number
          bank_country?: string | null
          bank_name?: string | null
          branch?: string | null
          company_name: string
          created_at?: string
          currency: string
          customer_id: string
          declaration_accepted?: boolean
          description?: string | null
          documents?: Json | null
          exchange_rate?: number | null
          id?: string
          payable_currency?: string | null
          payment_method: string
          purpose?: string
          request_code: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by: string
          submitted_by_role?: string
          supplier_address?: string | null
          supplier_country: string
          supplier_email?: string | null
          supplier_name: string
          support_responded_by?: string | null
          support_response_at?: string | null
          support_response_message?: string | null
          swift_code?: string | null
          total_payable?: number | null
          updated_at?: string
          whatsapp_wechat: string
        }
        Update: {
          account_name?: string | null
          account_number_iban?: string | null
          amount?: number
          bank_country?: string | null
          bank_name?: string | null
          branch?: string | null
          company_name?: string
          created_at?: string
          currency?: string
          customer_id?: string
          declaration_accepted?: boolean
          description?: string | null
          documents?: Json | null
          exchange_rate?: number | null
          id?: string
          payable_currency?: string | null
          payment_method?: string
          purpose?: string
          request_code?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by?: string
          submitted_by_role?: string
          supplier_address?: string | null
          supplier_country?: string
          supplier_email?: string | null
          supplier_name?: string
          support_responded_by?: string | null
          support_response_at?: string | null
          support_response_message?: string | null
          swift_code?: string | null
          total_payable?: number | null
          updated_at?: string
          whatsapp_wechat?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payment_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      support_agent_presence: {
        Row: {
          department: string
          display_name: string
          joined_at: string
          last_seen_at: string
          role_label: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          department: string
          display_name: string
          joined_at?: string
          last_seen_at?: string
          role_label?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          department?: string
          display_name?: string
          joined_at?: string
          last_seen_at?: string
          role_label?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_chat_assignments: {
        Row: {
          assigned_by: string | null
          assigned_department: string
          assigned_to: string | null
          assignment_type: string
          chat_id: string
          created_at: string
          id: string
          note: string | null
        }
        Insert: {
          assigned_by?: string | null
          assigned_department: string
          assigned_to?: string | null
          assignment_type?: string
          chat_id: string
          created_at?: string
          id?: string
          note?: string | null
        }
        Update: {
          assigned_by?: string | null
          assigned_department?: string
          assigned_to?: string | null
          assignment_type?: string
          chat_id?: string
          created_at?: string
          id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_chat_assignments_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "support_chats"
            referencedColumns: ["id"]
          },
        ]
      }
      support_chat_attachments: {
        Row: {
          chat_id: string
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          message_id: string | null
          mime_type: string | null
          uploaded_by: string | null
          uploaded_by_type: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          message_id?: string | null
          mime_type?: string | null
          uploaded_by?: string | null
          uploaded_by_type: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          message_id?: string | null
          mime_type?: string | null
          uploaded_by?: string | null
          uploaded_by_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_chat_attachments_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "support_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_chat_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "support_chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      support_chat_escalations: {
        Row: {
          chat_id: string
          created_at: string
          escalated_by: string | null
          escalated_by_name: string | null
          from_department: string
          id: string
          note: string | null
          reason: string | null
          to_department: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          escalated_by?: string | null
          escalated_by_name?: string | null
          from_department: string
          id?: string
          note?: string | null
          reason?: string | null
          to_department: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          escalated_by?: string | null
          escalated_by_name?: string | null
          from_department?: string
          id?: string
          note?: string | null
          reason?: string | null
          to_department?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_chat_escalations_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "support_chats"
            referencedColumns: ["id"]
          },
        ]
      }
      support_chat_internal_notes: {
        Row: {
          chat_id: string
          created_at: string
          created_by: string | null
          created_by_name: string | null
          department: string | null
          id: string
          note: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          department?: string | null
          id?: string
          note: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          department?: string | null
          id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_chat_internal_notes_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "support_chats"
            referencedColumns: ["id"]
          },
        ]
      }
      support_chat_messages: {
        Row: {
          body: string | null
          chat_id: string
          created_at: string
          delivery_status: string
          id: string
          message_type: string
          metadata: Json
          sender_department: string | null
          sender_id: string | null
          sender_name: string
          sender_role: string | null
          sender_type: string
        }
        Insert: {
          body?: string | null
          chat_id: string
          created_at?: string
          delivery_status?: string
          id?: string
          message_type?: string
          metadata?: Json
          sender_department?: string | null
          sender_id?: string | null
          sender_name: string
          sender_role?: string | null
          sender_type: string
        }
        Update: {
          body?: string | null
          chat_id?: string
          created_at?: string
          delivery_status?: string
          id?: string
          message_type?: string
          metadata?: Json
          sender_department?: string | null
          sender_id?: string | null
          sender_name?: string
          sender_role?: string | null
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_chat_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "support_chats"
            referencedColumns: ["id"]
          },
        ]
      }
      support_chats: {
        Row: {
          chat_code: string
          closed_at: string | null
          created_at: string
          current_assigned_agent: string | null
          current_assigned_agent_name: string | null
          current_assigned_agent_role: string | null
          current_department: string
          customer_id: string | null
          driver_id: string | null
          id: string
          issue_category: string
          last_message_at: string
          last_message_preview: string | null
          metadata: Json
          priority: string
          requester_email: string | null
          requester_name: string
          requester_phone: string | null
          requester_role: Database["public"]["Enums"]["app_role"]
          requester_user_id: string | null
          resolved_at: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          chat_code: string
          closed_at?: string | null
          created_at?: string
          current_assigned_agent?: string | null
          current_assigned_agent_name?: string | null
          current_assigned_agent_role?: string | null
          current_department?: string
          customer_id?: string | null
          driver_id?: string | null
          id?: string
          issue_category?: string
          last_message_at?: string
          last_message_preview?: string | null
          metadata?: Json
          priority?: string
          requester_email?: string | null
          requester_name: string
          requester_phone?: string | null
          requester_role: Database["public"]["Enums"]["app_role"]
          requester_user_id?: string | null
          resolved_at?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          chat_code?: string
          closed_at?: string | null
          created_at?: string
          current_assigned_agent?: string | null
          current_assigned_agent_name?: string | null
          current_assigned_agent_role?: string | null
          current_department?: string
          customer_id?: string | null
          driver_id?: string | null
          id?: string
          issue_category?: string
          last_message_at?: string
          last_message_preview?: string | null
          metadata?: Json
          priority?: string
          requester_email?: string | null
          requester_name?: string
          requester_phone?: string | null
          requester_role?: Database["public"]["Enums"]["app_role"]
          requester_user_id?: string | null
          resolved_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_chats_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_chats_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_messages: {
        Row: {
          attachment_name: string | null
          attachment_type: string | null
          attachment_url: string | null
          created_at: string
          id: string
          is_internal: boolean
          message: string
          sender_name: string | null
          sender_role: string
          sender_user_id: string | null
          ticket_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          created_at?: string
          id?: string
          is_internal?: boolean
          message?: string
          sender_name?: string | null
          sender_role?: string
          sender_user_id?: string | null
          ticket_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          created_at?: string
          id?: string
          is_internal?: boolean
          message?: string
          sender_name?: string | null
          sender_role?: string
          sender_user_id?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          description: string
          driver_responded_at: string | null
          escalated_at: string | null
          escalated_by: string | null
          escalated_to_department: string | null
          escalated_to_driver_id: string | null
          escalation_date: string | null
          id: string
          priority: string
          resolution_notes: string | null
          shipment_id: string | null
          sourcing_request_id: string | null
          status: string
          subject: string
          supplier_payment_request_id: string | null
          ticket_code: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description: string
          driver_responded_at?: string | null
          escalated_at?: string | null
          escalated_by?: string | null
          escalated_to_department?: string | null
          escalated_to_driver_id?: string | null
          escalation_date?: string | null
          id?: string
          priority?: string
          resolution_notes?: string | null
          shipment_id?: string | null
          sourcing_request_id?: string | null
          status?: string
          subject: string
          supplier_payment_request_id?: string | null
          ticket_code: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string
          driver_responded_at?: string | null
          escalated_at?: string | null
          escalated_by?: string | null
          escalated_to_department?: string | null
          escalated_to_driver_id?: string | null
          escalation_date?: string | null
          id?: string
          priority?: string
          resolution_notes?: string | null
          shipment_id?: string | null
          sourcing_request_id?: string | null
          status?: string
          subject?: string
          supplier_payment_request_id?: string | null
          ticket_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_escalated_to_driver_id_fkey"
            columns: ["escalated_to_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_sourcing_request_id_fkey"
            columns: ["sourcing_request_id"]
            isOneToOne: false
            referencedRelation: "sourcing_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_supplier_payment_request_id_fkey"
            columns: ["supplier_payment_request_id"]
            isOneToOne: false
            referencedRelation: "supplier_payment_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          category: string | null
          description: string | null
          id: string
          setting_key: string
          setting_type: string | null
          setting_value: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          description?: string | null
          id?: string
          setting_key: string
          setting_type?: string | null
          setting_value?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          description?: string | null
          id?: string
          setting_key?: string
          setting_type?: string | null
          setting_value?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          branch_id: string | null
          code: string
          created_at: string
          created_by: string | null
          currency_id: string | null
          customer_id: string | null
          driver_id: string | null
          id: string
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          shipment_id: string | null
          status: string | null
          transaction_type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          amount: number
          branch_id?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          currency_id?: string | null
          customer_id?: string | null
          driver_id?: string | null
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          shipment_id?: string | null
          status?: string | null
          transaction_type: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          amount?: number
          branch_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          currency_id?: string | null
          customer_id?: string | null
          driver_id?: string | null
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          shipment_id?: string | null
          status?: string | null
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_shipping_cost: {
        Args: {
          p_height: number
          p_length: number
          p_minimum_charge?: number
          p_rate_per_cbm: number
          p_rate_per_kg: number
          p_service_type: Database["public"]["Enums"]["service_type"]
          p_weight: number
          p_width: number
        }
        Returns: number
      }
      can_access_finance_portal: {
        Args: { _user_id: string }
        Returns: boolean
      }
      can_access_support_attachment: {
        Args: { _file_path: string; _user_id: string }
        Returns: boolean
      }
      can_access_support_chat: {
        Args: { _chat_id: string; _user_id: string }
        Returns: boolean
      }
      can_create_support_chat: {
        Args: { _auth_user_id: string; _requester_user_id: string }
        Returns: boolean
      }
      can_manage_driver_workflow: {
        Args: { _user_id: string }
        Returns: boolean
      }
      can_manage_finance_workflow: {
        Args: { _user_id: string }
        Returns: boolean
      }
      can_manage_support_chat: {
        Args: { _chat_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_warehouse_workflow: {
        Args: { _user_id: string }
        Returns: boolean
      }
      cleanup_inactive_customer_accounts: { Args: never; Returns: number }
      customer_last_activity_at: {
        Args: { _customer_id: string }
        Returns: string
      }
      delete_all_parcel_records: { Args: never; Returns: number }
      delete_customer_account: {
        Args: { _customer_id: string }
        Returns: undefined
      }
      delete_shipment_record: {
        Args: { _shipment_id: string }
        Returns: undefined
      }
      delete_shipment_record_internal: {
        Args: { _shipment_id: string }
        Returns: boolean
      }
      driver_finalize_delivery: {
        Args: { p_outcome: string; p_shipment_ids: string[] }
        Returns: {
          expected_count: number
          updated_count: number
        }[]
      }
      driver_has_assigned_consolidation: {
        Args: { _consolidation_id: string }
        Returns: boolean
      }
      driver_has_assigned_customer: {
        Args: { _customer_id: string }
        Returns: boolean
      }
      driver_has_assigned_receiver: {
        Args: { _receiver_id: string }
        Returns: boolean
      }
      driver_has_assigned_shipment: {
        Args: { _shipment_id: string }
        Returns: boolean
      }
      extract_handling_method: { Args: { _notes: string }; Returns: string }
      extract_note_value: {
        Args: { p_key: string; p_notes: string }
        Returns: string
      }
      generate_code: { Args: { prefix: string }; Returns: string }
      get_shipment_tracking_for_notification:
        | {
            Args: {
              _code: string
              _custom_tracking: string
              _notes: string
              _status: Database["public"]["Enums"]["shipment_status"]
            }
            Returns: string
          }
        | {
            Args: {
              _code: string
              _custom_tracking: string
              _notes: string
              _status: string
            }
            Returns: string
          }
      get_unified_notification_message: {
        Args: {
          p_customer_name: string
          p_stage_transition: string
          p_tracking_number?: string
        }
        Returns: string
      }
      get_user_portals: { Args: { _user_id: string }; Returns: string[] }
      has_portal_access: {
        Args: { _portal_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      insert_customer_agent_route_notifications: {
        Args: {
          _agent_route: string
          _customer_id: string
          _customer_route: string
          _exclude_user_id?: string
          _message: string
          _reference_id?: string
          _title: string
        }
        Returns: undefined
      }
      insert_driver_route_notification: {
        Args: {
          _driver_id: string
          _exclude_user_id?: string
          _message: string
          _reference_id?: string
          _route: string
          _title: string
        }
        Returns: undefined
      }
      insert_portal_route_notifications: {
        Args: {
          _exclude_user_id?: string
          _include_admins?: boolean
          _message: string
          _portal_id: string
          _reference_id?: string
          _route: string
          _title: string
        }
        Returns: undefined
      }
      insert_route_notification: {
        Args: {
          _exclude_user_id?: string
          _message: string
          _reference_id?: string
          _route: string
          _title: string
          _user_id: string
        }
        Returns: undefined
      }
      insert_support_department_notifications: {
        Args: {
          _department: string
          _exclude_user_id?: string
          _message: string
          _notification_type: string
          _reference_id: string
          _title: string
        }
        Returns: undefined
      }
      insert_support_requester_notification: {
        Args: {
          _chat_id: string
          _exclude_user_id?: string
          _message: string
          _notification_type: string
          _title: string
        }
        Returns: undefined
      }
      insert_support_ticket_department_notifications: {
        Args: {
          _department: string
          _exclude_user_id?: string
          _message: string
          _ticket_id: string
          _title: string
        }
        Returns: undefined
      }
      insert_support_ticket_requester_notifications: {
        Args: {
          _exclude_user_id?: string
          _message: string
          _ticket_id: string
          _title: string
        }
        Returns: undefined
      }
      is_admin_or_staff: { Args: { _user_id: string }; Returns: boolean }
      is_internal_chat_staff: { Args: { _user_id: string }; Returns: boolean }
      normalize_consolidation_status_value: {
        Args: { _status: string }
        Returns: string
      }
      normalize_tracking_lookup_text: {
        Args: { _value: string }
        Returns: string
      }
      recalculate_consolidation_totals: {
        Args: { _consolidation_id: string }
        Returns: undefined
      }
      record_marketing_page_view: {
        Args: {
          p_is_landing_page?: boolean
          p_page_path: string
          p_traffic_source?: string
        }
        Returns: undefined
      }
      remove_consolidation_item_to_need_action: {
        Args: { p_consolidation_id?: string; p_shipment_id: string }
        Returns: undefined
      }
      remove_submitted_shipment: {
        Args: { p_shipment_id: string }
        Returns: undefined
      }
      replace_consolidation_shipments: {
        Args: { p_consolidation_id: string; p_shipment_ids: string[] }
        Returns: undefined
      }
      rpc_create_warehouse_staff: {
        Args: {
          staff_branch_notes: string
          staff_email: string
          staff_full_name: string
          staff_is_active: boolean
          staff_password: string
          staff_phone: string
        }
        Returns: Json
      }
      shipment_airway_bill_from_notes: {
        Args: { _notes: string }
        Returns: string
      }
      shipment_cbm_from_notes: { Args: { _notes: string }; Returns: number }
      shipment_creation_tracking_from_notes: {
        Args: { _notes: string }
        Returns: string
      }
      shipment_warehouse_tracking_from_notes: {
        Args: { _notes: string }
        Returns: string
      }
      shipsgo_transport_from_service_type: {
        Args: { _service_type: string }
        Returns: string
      }
      support_department_portal_id: {
        Args: { _department: string }
        Returns: string
      }
      sync_consolidation_delivery_request_state: {
        Args: { _consolidation_id: string }
        Returns: undefined
      }
      track_shipment_by_code: {
        Args: { p_code: string }
        Returns: {
          actual_delivery_date: string
          code: string
          created_at: string
          destination: string
          estimated_delivery_date: string
          origin: string
          pickup_date: string
          status: Database["public"]["Enums"]["shipment_status"]
        }[]
      }
      track_shipment_details_by_code: {
        Args: { p_code: string }
        Returns: Json
      }
      tracking_lookup_matches: {
        Args: { _candidate: string; _lookup: string }
        Returns: boolean
      }
      unsubscribe_from_newsletter: {
        Args: { p_email: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "staff"
        | "customer"
        | "driver"
        | "branch_manager"
        | "agent"
      customs_status: "pending_customs" | "customs_cleared" | "flagged"
      mission_status:
        | "requested"
        | "assigned"
        | "approved"
        | "received"
        | "done"
        | "closed"
      mission_type: "pickup" | "delivery" | "transfer" | "supply"
      payment_method:
        | "cash"
        | "wallet"
        | "bank_transfer"
        | "mobile_money"
        | "lipila"
        | "visa_credit_card"
      service_type: "air" | "sea"
      shipment_status:
        | "saved_pickup"
        | "saved_dropoff"
        | "requested_pickup"
        | "approved"
        | "assigned"
        | "received"
        | "delivered"
        | "supplied"
        | "returned"
        | "returned_stock"
        | "returned_delivered"
        | "closed"
        | "created"
        | "incoming"
        | "need_action"
        | "submitted"
        | "confirm_shipment"
        | "outgoing"
        | "in_transit"
        | "arrived"
        | "collected"
      transaction_type:
        | "payment"
        | "refund"
        | "wallet_topup"
        | "wallet_deduction"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "staff",
        "customer",
        "driver",
        "branch_manager",
        "agent",
      ],
      customs_status: ["pending_customs", "customs_cleared", "flagged"],
      mission_status: [
        "requested",
        "assigned",
        "approved",
        "received",
        "done",
        "closed",
      ],
      mission_type: ["pickup", "delivery", "transfer", "supply"],
      payment_method: [
        "cash",
        "wallet",
        "bank_transfer",
        "mobile_money",
        "lipila",
        "visa_credit_card",
      ],
      service_type: ["air", "sea"],
      shipment_status: [
        "saved_pickup",
        "saved_dropoff",
        "requested_pickup",
        "approved",
        "assigned",
        "received",
        "delivered",
        "supplied",
        "returned",
        "returned_stock",
        "returned_delivered",
        "closed",
        "created",
        "incoming",
        "need_action",
        "submitted",
        "confirm_shipment",
        "outgoing",
        "in_transit",
        "arrived",
        "collected",
      ],
      transaction_type: [
        "payment",
        "refund",
        "wallet_topup",
        "wallet_deduction",
      ],
    },
  },
} as const
